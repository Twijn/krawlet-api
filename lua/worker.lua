local wsUri = "ws://localhost:3000/api/v1/ws"

local enderStorageA = peripheral.wrap("top")
local enderStorageB = peripheral.wrap("bottom")

assert(enderStorageA and enderStorageA.setFrequency, "Expected ender storage on top")
assert(enderStorageB and enderStorageB.setFrequency, "Expected ender storage on bottom")
assert(enderStorageA.areComputerChangesEnabled() and enderStorageB.areComputerChangesEnabled(), "Expected computer changes to be enabled on ender storages")

local token = settings.get("kworker.token")
local ws = nil
local workerComputerId = os.getComputerID()

assert(token ~= nil, "Token not set in settings (kworker.token)")

local reconnectTime = 5

local nextId = 1
local function getNextId()
  local id = nextId
  nextId = nextId + 1
  return id
end

local function connectWebSocket()
  if ws then
    ws.close()
  end

  http.websocketAsync(wsUri)
end
local function reconnectWebSocket()
  print("Reconnecting in " .. reconnectTime .. " seconds")
  sleep(reconnectTime)
  reconnectTime = math.min(reconnectTime * 2, 120)
  print("Reconnecting...")
  connectWebSocket()
end

local function send(type, data)
  if not ws then
    print("Websocket not connected, cannot send message")
    return
  end

  data.type = type
  local message = textutils.serializeJSON(data)
  ws.send(message)
end

local requestCallbacks = {}

local function request(msgType, data, cb)
  if type(data) == "function" then
    cb = data
    data = {}
  elseif type(data) ~= "table" then
    data = {}
  end

  local id = getNextId()

  if cb then
    requestCallbacks[id] = cb
  end

  data.id = id
  send(msgType, data)
end

local function processTransfer(transfer)
  local sourceStorage, destinationStorage = enderStorageA, enderStorageB
  local destinationStorageName = peripheral.getName(destinationStorage)
  local startedAt = os.epoch("utc")

  local hasItemNameFilter = transfer.itemName ~= nil
  local hasItemNbtFilter = transfer.itemNbt ~= nil
  local hasQuantityLimit = type(transfer.quantity) == "number" and transfer.quantity > 0
  local targetQuantity = hasQuantityLimit and transfer.quantity or math.huge

  local timeout = transfer.timeout or 5

  sourceStorage.setFrequency(table.unpack(transfer.from))
  destinationStorage.setFrequency(table.unpack(transfer.to))

  local requests = {}

  local leftToSchedule = targetQuantity
  local totalMoved = 0

  local function matchesItemFilter(item)
    if hasItemNameFilter and item.name ~= transfer.itemName then
      return false
    end

    if hasItemNbtFilter and item.nbt ~= transfer.itemNbt then
      return false
    end

    return true
  end

  local function moveItem(sourceInv, destination, slot, count)
    return function()
      local moved = sourceInv.pushItems(destination, slot, count)
      totalMoved = totalMoved + moved
    end
  end

  local function scheduleMove()
    leftToSchedule = targetQuantity - totalMoved
    requests = {}

    local currentItems = sourceStorage.list()
    for slot, item in pairs(currentItems) do
      if matchesItemFilter(item) then
        local maxMovable = math.min(item.count, leftToSchedule)
        leftToSchedule = leftToSchedule - maxMovable
        table.insert(requests, moveItem(sourceStorage, destinationStorageName, slot, maxMovable))
      end
    end

    if #requests > 0 then
      parallel.waitForAll(table.unpack(requests))
    end
  end

  local function countMatchingItems(inv)
    local items = inv.list()
    local count = 0
    for _, item in pairs(items) do
      if matchesItemFilter(item) then
        count = count + item.count
      end
    end
    return count
  end

  local function canStackTogether(left, right)
    if left.name ~= right.name then
      return false
    end

    if left.nbt ~= nil or right.nbt ~= nil then
      return left.nbt == right.nbt
    end

    return true
  end

  local function destinationCanAcceptItem(sourceItem)
    local destinationItems = destinationStorage.list()
    local occupiedSlots = 0

    for slot, destinationItem in pairs(destinationItems) do
      occupiedSlots = occupiedSlots + 1

      if canStackTogether(sourceItem, destinationItem) then
        local detail = destinationStorage.getItemDetail(slot)
        local maxCount = detail and detail.maxCount or 64
        if destinationItem.count < maxCount then
          return true
        end
      end
    end

    return occupiedSlots < destinationStorage.size()
  end

  local function destinationHasCapacityForMatchingItems()
    local sourceItems = sourceStorage.list()

    for _, sourceItem in pairs(sourceItems) do
      if matchesItemFilter(sourceItem) and destinationCanAcceptItem(sourceItem) then
        return true
      end
    end

    return false
  end

  local function waitForSpaceAndItems()
    while true do
      local sourceItemCount = countMatchingItems(sourceStorage)

      if sourceItemCount > 0 and destinationHasCapacityForMatchingItems() then
        return
      end
      sleep(0)
    end
  end

  local function mainLoop()
    while totalMoved < targetQuantity do
      scheduleMove()

      if not hasQuantityLimit then
        print(string.format("Moved %d items, transfer complete!", totalMoved))
        send("transfer_complete", {
          id = transfer.id,
          totalMoved = totalMoved,
          requestedQuantity = transfer.quantity,
          itemName = transfer.itemName,
          itemNbt = transfer.itemNbt,
          workerId = workerComputerId,
          elapsedMs = os.epoch("utc") - startedAt,
        })
        return
      end

      if leftToSchedule > 0 then
        print(string.format("Moved %d/%d items, waiting for more to move...", totalMoved, transfer.quantity))
        send("transfer_progress", {
          id = transfer.id,
          totalMoved = totalMoved,
          requestedQuantity = transfer.quantity,
          itemName = transfer.itemName,
          itemNbt = transfer.itemNbt,
          workerId = workerComputerId,
          elapsedMs = os.epoch("utc") - startedAt,
        })

        local timedOut = false
        parallel.waitForAny(waitForSpaceAndItems, function()
          sleep(timeout)
          timedOut = true
        end)

        if timedOut then
          print("Transfer timed out waiting for more items to move")
          local reason = "Timed out waiting for items to move"
          local sourceItemCount = countMatchingItems(sourceStorage)
          if sourceItemCount == 0 then
            reason = "Source storage was empty for too long."
          elseif not destinationHasCapacityForMatchingItems() then
            reason = "Destination storage was full for too long."
          end
          send("transfer_failed", {
            id = transfer.id,
            totalMoved = totalMoved,
            reason = reason,
            requestedQuantity = transfer.quantity,
            itemName = transfer.itemName,
            itemNbt = transfer.itemNbt,
            workerId = workerComputerId,
            elapsedMs = os.epoch("utc") - startedAt,
          })
          return
        end
      end
    end
    
    print(string.format("Moved %d/%d items, transfer complete!", totalMoved, transfer.quantity))
    send("transfer_complete", {
      id = transfer.id,
      totalMoved = totalMoved,
      requestedQuantity = transfer.quantity,
      itemName = transfer.itemName,
      itemNbt = transfer.itemNbt,
      workerId = workerComputerId,
      elapsedMs = os.epoch("utc") - startedAt,
    })
  end

  local function cancelCheckLoop()
    while true do
      local e, url, msg = os.pullEvent()

      if url == wsUri then
        if e == "websocket_message" then
          local data = textutils.unserializeJSON(msg)
          local cancelId = nil
          if data then
            cancelId = data.id or (data.payload and data.payload.id)
          end

          if data and data.type == "transfer_cancel" and cancelId == transfer.id then
            print("Transfer cancelled by server")
            send("transfer_cancelled", {
              id = transfer.id,
              totalMoved = totalMoved,
              requestedQuantity = transfer.quantity,
              itemName = transfer.itemName,
              itemNbt = transfer.itemNbt,
              workerId = workerComputerId,
              elapsedMs = os.epoch("utc") - startedAt,
            })
            return
          end
        elseif e == "websocket_closed" or e == "websocket_failure" then
          print("Websocket closed or failed during transfer: " .. msg)
          return
        end
      end
    end
  end

  parallel.waitForAny(mainLoop, cancelCheckLoop)
end

local function connect()
  connectWebSocket()

  while true do
    local e, url, msg = os.pullEvent()

    if url == wsUri then
      if e == "websocket_success" then
        print("Websocket connected")
        ws = msg
        reconnectTime = 5
      elseif e == "websocket_message" then
        -- print("Websocket message received: " .. msg)
        local data = textutils.unserializeJSON(msg)
        if data and data.type then
          if data.id and requestCallbacks[data.id] then
            requestCallbacks[data.id](data)
            requestCallbacks[data.id] = nil
          elseif data.type == "hello" then
            request("auth", {
              token = token,
              workerId = workerComputerId,
            }, function(response)
              if response.type == "auth_ok" then
                print(string.format("Logged in with key name %s", response.payload.name))
              else
                print("Authentication failed: " .. (response.payload and response.payload.message or "Unknown error"))
                ws.close()
              end
            end)
          elseif data.type == "transfer" then
            processTransfer(data.payload)
          elseif data.type == "storage_list" then
            local requestId = data.id
            local colors = data.payload and data.payload.colors
            if not requestId or not colors or #colors ~= 3 then
              print("storage_list: invalid payload, ignoring")
            else
              print("Listing storage contents for colors: " .. table.concat(colors, ","))
              enderStorageA.setFrequency(table.unpack(colors))
              local rawItems = enderStorageA.list()
              local items = {}
              for _, item in pairs(rawItems) do
                table.insert(items, {
                  name = item.name,
                  count = item.count,
                  nbt = item.nbt,
                })
              end
              send("storage_list_result", {
                id = requestId,
                payload = { items = items },
              })
            end
          end
        end
      elseif e == "websocket_failure" then
        print("Websocket error: " .. msg)
        reconnectWebSocket()
      elseif e == "websocket_closed" then
        print("Websocket closed: " .. msg)
        reconnectWebSocket()
      end
    end
  end
end

while true do
  local success, err = pcall(connect)
  if not success then
    print("Error in main loop: " .. err)
    reconnectWebSocket()
  end
end
