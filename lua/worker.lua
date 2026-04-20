local wsUri = "wss://api.krawlet.cc/v1/ws"

local enderStorageA = peripheral.wrap("top")
local enderStorageB = peripheral.wrap("bottom")
local enderStoragePublic = peripheral.wrap("front")

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
  local startedAt = os.epoch("utc")

  if type(transfer.from) ~= "table" or #transfer.from ~= 3 or type(transfer.to) ~= "table" or #transfer.to ~= 3 then
    local reason = "Invalid transfer frequencies (expected from/to color triplets)"
    print(reason)
    send("transfer_failed", {
      id = transfer.id,
      totalMoved = 0,
      reason = reason,
      requestedQuantity = transfer.quantity,
      itemName = transfer.itemName,
      itemNbt = transfer.itemNbt,
      workerId = workerComputerId,
      elapsedMs = os.epoch("utc") - startedAt,
    })
    return
  end

  if transfer.fromType == "public" then
    if not enderStoragePublic or not enderStoragePublic.setFrequency then
      local reason = "Public transfer requested but no ender storage was found on the front side"
      print(reason)
      send("transfer_failed", {
        id = transfer.id,
        totalMoved = 0,
        reason = reason,
        requestedQuantity = transfer.quantity,
        itemName = transfer.itemName,
        itemNbt = transfer.itemNbt,
        workerId = workerComputerId,
        elapsedMs = os.epoch("utc") - startedAt,
      })
      return
    end

    if not enderStoragePublic.areComputerChangesEnabled() then
      local reason = "Front ender storage must have computer changes enabled for public transfers"
      print(reason)
      send("transfer_failed", {
        id = transfer.id,
        totalMoved = 0,
        reason = reason,
        requestedQuantity = transfer.quantity,
        itemName = transfer.itemName,
        itemNbt = transfer.itemNbt,
        workerId = workerComputerId,
        elapsedMs = os.epoch("utc") - startedAt,
      })
      return
    end

    sourceStorage = enderStoragePublic
  end

  local destinationStorageName = peripheral.getName(destinationStorage)

  local fromLabel = transfer.fromName or "source"
  local toLabel = transfer.toName or "destination"
  print(string.format("Starting transfer %s (%s -> %s)", transfer.id or "unknown", fromLabel, toLabel))

  local hasItemNameFilter = transfer.itemName ~= nil
  local hasItemNbtFilter = transfer.itemNbt ~= nil
  local hasQuantityLimit = type(transfer.quantity) == "number" and transfer.quantity > 0
  local targetQuantity = hasQuantityLimit and transfer.quantity or math.huge

  local timeout = tonumber(transfer.timeout)
  if not timeout or timeout <= 0 then
    timeout = 5
  end

  sourceStorage.setFrequency(table.unpack(transfer.from))
  destinationStorage.setFrequency(table.unpack(transfer.to))

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

  local function scheduleMove()
    local remainingToSchedule = targetQuantity - totalMoved

    local currentItems = sourceStorage.list()
    for slot, item in pairs(currentItems) do
      if matchesItemFilter(item) then
        if remainingToSchedule <= 0 then
          break
        end

        local maxMovable = math.min(item.count, remainingToSchedule)
        local moved = sourceStorage.pushItems(destinationStorageName, slot, maxMovable)
        if moved > 0 then
          totalMoved = totalMoved + moved
          remainingToSchedule = remainingToSchedule - moved
        end
      end
    end

    -- Remaining quantity must be based on actual moved items, not scheduled attempts.
    leftToSchedule = targetQuantity - totalMoved
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

  local function waitForSpaceAndItems(deadlineMs)
    while true do
      local sourceItemCount = countMatchingItems(sourceStorage)

      if sourceItemCount > 0 and destinationHasCapacityForMatchingItems() then
        return true
      end

      if os.epoch("utc") >= deadlineMs then
        return false
      end

      sleep()
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

        local deadlineMs = os.epoch("utc") + math.floor(timeout * 1000)
        local timedOut = not waitForSpaceAndItems(deadlineMs)

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
          elseif data.type == "public_transfer" then
            local transfer = data.payload
            if transfer and transfer.id then
              print("Received public transfer request, processing...")
              processTransfer(transfer)
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
