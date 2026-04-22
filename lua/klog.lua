-- Klog (Krawlet Logistic) transfer client
-- Twijn 2026-04-14

---@class KlogOptions
---@field apiUrl? string Base API URL (default: https://api.krawlet.cc/v1/)
---@field apiKey? string API key; if omitted, settings key klog.apiKey is used.
---@field inputExcludes? string[] Inventory peripheral name patterns to exclude. Supports * wildcard.

---@class KlogTransferOptions
---@field to string Destination ender storage target (entity id, configured link, or entity name).
---@field quantity? number Max quantity to transfer.
---@field itemName? string Optional item name filter.
---@field itemNbt? string Optional exact NBT filter.
---@field timeout? number Seconds worker should wait for new source items or destination space (default worker behavior if omitted).
---@field pollInterval? number Status polling interval in seconds (default: 0.5).

---Create a Klog client bound to an ender storage peripheral.
---
---@param estorageName string Peripheral name for the staging ender storage.
---@param options? KlogOptions
---@return table klog
return function(estorageName, options)
  options = options or {}
  local inputExcludes = options.inputExcludes or textutils.unserializeJSON(settings.get("klog.inputExcludes") or "{}")
  local estorage = peripheral.wrap(estorageName)
  local apiUrl = options.apiUrl or "https://api.krawlet.cc/v1/"
  local apiKey = options.apiKey or settings.get("klog.apiKey")

  assert(estorage, "Peripheral not found: " .. estorageName)

  local function handleResponse(response, errResponse)
    response = response or errResponse
    if response then
      local data = textutils.unserializeJSON(response.readAll())
      response:close()
      if data and data.success then
        return data
      else
        return false, data and data.error and data.error.message or "Unknown error"
      end
    end
  end

  local function get(uri)
    local headers = {}
    if apiKey then
      headers["Authorization"] = "Bearer " .. apiKey
    end
    local response, _, errResponse = http.get(
      apiUrl .. uri,
      headers
    )
    return handleResponse(response, errResponse)
  end

  local function post(uri, data)
    local headers = {}
    if apiKey then
      headers["Authorization"] = "Bearer " .. apiKey
    end
    if data then
      headers["Content-Type"] = "application/json"
      data = textutils.serializeJSON(data)
    end

    local response, _, errResponse = http.post(apiUrl .. uri, data, headers)
    return handleResponse(response, errResponse)
  end

  if not apiKey then
    print("Use \\krawlet api to generate a code. Paste the quick code below (6 digits):")
    while true do
      local input = read()
      if input and #input == 6 then
        local response, error = post("apikey/quickcode/redeem", { code = input })
        if not response or not response.success then
          printError("Failed to redeem API key: " .. (error or "Unknown error"))
          print("Please try again:")
        else
          print("API key redeemed successfully!")
          apiKey = response.data.apiKey
          settings.set("klog.apiKey", apiKey)
          settings.save()
          break
        end
      end
    end
  end

  local klog = {
    _VERSION = "1.0.0",
  }

  local function matchesExclude(name, pattern)
    -- Escape Lua pattern special chars, then replace * with .*
    local luaPattern = pattern:gsub("([%(%)%.%%%+%-%?%[%^%$])", "%%%1"):gsub("%*", ".*")
    return name:match("^" .. luaPattern .. "$") ~= nil
  end

  local function isExcluded(chest)
    local name = type(chest) == "string" and chest or peripheral.getName(chest)
    if name == estorageName then return true end
    if not inputExcludes then return false end
    for _, exclude in pairs(inputExcludes) do
      if matchesExclude(name, exclude) then
        return true
      end
    end
    return false
  end

  function klog.getInputChests()
    local chests = {}
    for _, chest in ipairs(table.pack(peripheral.find("inventory"))) do
      if not isExcluded(chest) then
        table.insert(chests, chest)
      end
    end
    return chests
  end

  function klog.countItem(itemName, itemNbt)
    local total = 0
    local chests = klog.getInputChests()
    for _, chest in ipairs(chests) do
      local items = chest.list()
      for _, item in pairs(items) do
        if item.name == itemName and (not itemNbt or item.nbt == itemNbt) then
          total = total + item.count
        end
      end
    end
    return total
  end

  local function checkTransferOpts(opts)
    if not opts or type(opts) ~= "table" then
      return "Options must be provided as a table"
    end
    if type(opts.to) ~= "string" or opts.to == "" then
      return "Invalid transfer target (opts.to)"
    end
    if opts.quantity and (type(opts.quantity) ~= "number" or opts.quantity <= 0) then
      return "Quantity must be a positive number if specified"
    end
    if opts.timeout and (type(opts.timeout) ~= "number" or opts.timeout <= 0 or opts.timeout > 30) then
      return "Timeout must be a positive number between 0.1 and 30 seconds if specified"
    end
    return nil
  end

  ---Run a transfer synchronously.
  ---
  ---Lifecycle events emitted via os.queueEvent:
  --- - transfer_started(payload)
  --- - transfer_update(payload) when status changes
  --- - transfer_completed(payload)
  --- - transfer_cancelled(payload)
  --- - transfer_failed(payload)
  ---
  ---Failures are normalized so local pipeline and remote/API failures look similar to consumers.
  ---Exactly one terminal event (completed/cancelled/failed) is emitted per attempt.
  ---
  ---@param opts KlogTransferOptions
  ---@return table|false transfer Transfer data on success, false on failure.
  ---@return string|nil err Error message when transfer is false.
  function klog.transfer(opts)
    local err = checkTransferOpts(opts)
    if err then
      os.queueEvent("transfer_failed", {
        to = opts and opts.to,
        quantity = opts and opts.quantity,
        itemName = opts and opts.itemName,
        itemNbt = opts and opts.itemNbt,
        error = err,
      })
      return false, err
    end

    if opts.itemName then
      local itemCount = klog.countItem(opts.itemName, opts.itemNbt)
      opts.quantity = math.min(opts.quantity or math.huge, itemCount)
      if opts.quantity <= 0 then
        local errMsg = "No items available to transfer"
        os.queueEvent("transfer_failed", {
          to = opts.to,
          quantity = opts.quantity,
          itemName = opts.itemName,
          itemNbt = opts.itemNbt,
          error = errMsg,
        })
        return false, errMsg
      end
    end

    local pollInterval = type(opts.pollInterval) == "number" and opts.pollInterval or 0.5
    local transfer, errMsg = nil, nil
    local transferId = nil
    local transferDone = false
    local terminalEventQueued = false
    local lastStatus = nil
    local lastQuantityTransferred = nil

    local function countAlreadyStagedMatchingItems()
      local count = 0
      local stagedItems = estorage.list()

      for _, item in pairs(stagedItems) do
        local nameMatches = (not opts.itemName or item.name == opts.itemName)
        local nbtMatches = (not opts.itemNbt or item.nbt == opts.itemNbt)
        if nameMatches and nbtMatches then
          count = count + item.count
        end
      end

      return count
    end

    local alreadyStaged = countAlreadyStagedMatchingItems()
    local itemsRemaining = opts.quantity and math.max(0, opts.quantity - alreadyStaged) or math.huge

    local function buildTransferPayload(errorMessage)
      local payload = {}

      if transfer then
        for key, value in pairs(transfer) do
          payload[key] = value
        end
      end

      if not payload.id and transferId then
        payload.id = transferId
      end
      if not payload.to then
        payload.to = opts.to
      end
      if not payload.quantity then
        payload.quantity = opts.quantity
      end
      if not payload.itemName then
        payload.itemName = opts.itemName
      end
      if not payload.itemNbt then
        payload.itemNbt = opts.itemNbt
      end
      if errorMessage and not payload.error then
        payload.error = errorMessage
      end

      return payload
    end

    local function queueTerminalEvent(eventName, payload)
      if terminalEventQueued then
        return
      end
      terminalEventQueued = true
      os.queueEvent(eventName, payload)
    end

    local function transferItems()
      while not transferDone and itemsRemaining > 0 do
        local chests = klog.getInputChests()
        local movedThisPass = 0

        for _, chest in ipairs(chests) do
          if transferDone or itemsRemaining <= 0 then
            break
          end

          local items = chest.list()
          for slot, item in pairs(items) do
            if transferDone or itemsRemaining <= 0 then
              break
            end

            if (not opts.itemName or item.name == opts.itemName) and
               (not opts.itemNbt or item.nbt == opts.itemNbt) then

              local toMove = math.min(item.count, itemsRemaining)
              if toMove <= 0 then
                break
              end

              local moved = chest.pushItems(estorageName, slot, toMove)
              if moved > 0 then
                itemsRemaining = itemsRemaining - moved
                movedThisPass = movedThisPass + moved
              end
            end
          end
        end

        if movedThisPass == 0 then
          sleep(pollInterval)
        else
          sleep(0)
        end
      end
    end

    local function sendTransfer()
      local response, postErr = post("transfers", {
        to = opts.to,
        quantity = opts.quantity,
        itemName = opts.itemName,
        itemNbt = opts.itemNbt,
        timeout = opts.timeout,
      })

      transfer = response and response.data
      transferId = transfer and transfer.id

      if not response or not response.success or not transferId then
        errMsg = (response and response.error and response.error.message) or postErr or "Failed to create transfer."
        transferDone = true
        queueTerminalEvent("transfer_failed", buildTransferPayload(errMsg))
        return
      end

      os.queueEvent("transfer_started", buildTransferPayload())

      while not transferDone do
        sleep(pollInterval)

        local statusResponse, getErr = get("transfers/" .. transferId)
        if statusResponse and statusResponse.data then
          transfer = statusResponse.data
          local status = transfer.status
          local quantityTransferred = transfer.quantityTransferred

          if status ~= lastStatus or quantityTransferred ~= lastQuantityTransferred then
            os.queueEvent("transfer_update", buildTransferPayload())
            lastStatus = status
            lastQuantityTransferred = quantityTransferred
          end

          if status == "completed" then
            queueTerminalEvent("transfer_completed", buildTransferPayload())
            transferDone = true
            return
          elseif status == "failed" or status == "cancelled" then
            if status == "failed" then
              queueTerminalEvent("transfer_failed", buildTransferPayload(transfer.error))
            else
              queueTerminalEvent("transfer_cancelled", buildTransferPayload(transfer.error))
            end
            errMsg = transfer.error or ("Transfer " .. status .. ".")
            transferDone = true
            return
          end
        else
          errMsg = (statusResponse and statusResponse.error and statusResponse.error.message) or getErr or "Failed to get transfer status."
          transferDone = true
          queueTerminalEvent("transfer_failed", buildTransferPayload(errMsg))
          return
        end
      end
    end

    parallel.waitForAll(transferItems, sendTransfer)

    if errMsg then
      return false, errMsg, transfer -- because I hate myself
    end

    return transfer, nil
  end

  ---Start a transfer in a coroutine and return the thread.
  ---Caller is responsible for resuming/monitoring the coroutine result.
  ---@param opts KlogTransferOptions Same options as klog.transfer.
  ---@return thread
  function klog.transferAsync(opts)

    local thread = coroutine.create(function()
      return klog.transfer(opts)
    end)
    coroutine.resume(thread)
    return thread
  end

  ---Cancel a transfer by id.
  ---@param transferId string
  ---@return boolean ok
  ---@return string|nil err
  function klog.cancelTransfer(transferId)
    if not transferId or type(transferId) ~= "string" then
      return false, "Invalid transfer ID"
    end

    local response, errMsg = post("transfers/" .. transferId .. "/cancel")
    if not response or not response.success then
      return false, (response and response.error and response.error.message) or errMsg or "Failed to cancel transfer."
    end
    return true
  end

  function klog.getTransfer(transferId)
    if not transferId or type(transferId) ~= "string" then
      return false, "Invalid transfer ID"
    end

    local response, errMsg = get("transfers/" .. transferId)
    if not response or not response.success then
      return false, errMsg or "Failed to get transfer."
    end
    return response.data
  end

  function klog.getTransfers()
    local response, errMsg = get("transfers")
    if not response or not response.success then
      return false, errMsg or "Failed to fetch transfers."
    end
    return response.data
  end

  function klog.getTransferTargets()
    local response, errMsg = get("transfers/targets")
    if not response or not response.success then
      return false, errMsg or "Failed to fetch transfer targets."
    end

    local values = {}
    for _, target in pairs(response.data) do
      if target.name and target.name ~= "" then
        table.insert(values, target.name)
      end
    end
    table.sort(values)

    return values
  end

  return klog
end
