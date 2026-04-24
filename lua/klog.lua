-- Klog (Krawlet Logistic) transfer client
-- Twijn 2026-04-14

---@class KlogOptions
---@field apiUrl? string Base API URL (default: https://api.krawlet.cc/v1/)
---@field wsUrl? string WebSocket URL (default: derived from apiUrl)
---@field apiKey? string API key; if omitted, settings key klog.apiKey is used.
---@field inputExcludes? string[] Inventory peripheral name patterns to exclude. Supports * wildcard.

---@class KlogTransferOptions
---@field to string Destination ender storage target (entity id, configured link, or entity name).
---@field quantity? number Max quantity to transfer.
---@field itemName? string Optional item name filter.
---@field itemNbt? string Optional exact NBT filter.
---@field memo? string Optional note attached to the transfer.
---@field timeout? number Seconds worker should wait for new source items or destination space (default worker behavior if omitted).
---@field disableExternalStaging? boolean If true, do not move items from external inventories into the Klog ender storage.

---@alias KlogTransferStatus
---| "pending"
---| "in_progress"
---| "completed"
---| "failed"
---| "cancelled"

---@alias KlogTransferNotificationType
---| "error"
---| "info"
---| "success"

---@class KlogTransfer
---@field id string Transfer id.
---@field status KlogTransferStatus Current transfer status.
---@field fromEntityId? string Sender entity id.
---@field fromUsername? string Sender username when available.
---@field toEntityId? string Recipient entity id.
---@field toUsername? string Recipient username when available.
---@field to? string Destination target.
---@field quantity? number Requested quantity.
---@field quantityTransferred? number Quantity moved so far.
---@field itemName? string Item id filter.
---@field itemDisplayName? string Human-readable item name when available.
---@field itemNbt? string Item NBT filter.
---@field memo? string Transfer note.
---@field timeout? number Worker timeout in seconds.
---@field error? string Failure or cancellation reason.
---@field notifications? KlogTransferNotification[] Transfer notification history when requested.
---@field createdAt? string Creation timestamp.
---@field updatedAt? string Last update timestamp.

---@class KlogTransferNotification
---@field id string Notification id.
---@field transferId string Transfer id.
---@field senderEntityId? string Sender entity id when available.
---@field type KlogTransferNotificationType Notification type.
---@field message string Notification message.
---@field timestamp string Notification timestamp.

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
  local wsUrl = options.wsUrl or apiUrl:gsub("^http", "ws") .. "ws"
  local apiKey = options.apiKey or settings.get("klog.apiKey")

  assert(estorage, "Peripheral not found: " .. estorageName)

  local ws = nil
  local authenticated = false
  local nextMessageId = 1
  local pendingWsMessages = {}
  local localTransferIds = {}
  local incomingTransferState = {}
  local emitIncomingTransferEvents
  local emitIncomingTransferNotificationEvents

  local function getNextMessageId()
    local id = tostring(nextMessageId)
    nextMessageId = nextMessageId + 1
    return id
  end

  local function closeWebSocket()
    if ws then
      pcall(function()
        ws.close()
      end)
      ws = nil
    end
    authenticated = false
  end

  local function sendWebSocketMessage(message)
    if not ws then
      return false, "WebSocket not connected"
    end

    local ok, err = pcall(function()
      ws.send(message)
    end)

    if not ok then
      closeWebSocket()
      return false, tostring(err)
    end

    return true
  end

  local function connectWebSocket()
    if ws then
      closeWebSocket()
    end

    ws = http.websocket(wsUrl)
    if not ws then
      return false, "Failed to connect to WebSocket"
    end

    authenticated = false

    local authId = getNextMessageId()
    local authSent, authErr = sendWebSocketMessage(textutils.serializeJSON({
      type = "auth",
      token = apiKey,
      id = authId,
    }))
    if not authSent then
      return false, authErr or "Failed to send WebSocket auth"
    end

    local timeout = os.startTimer(5)
    while true do
      local event, url, message = os.pullEvent()

      if event == "timer" then
        if url == timeout then
          closeWebSocket()
          return false, "WebSocket auth timeout"
        end
      elseif event == "websocket_message" then
        if url == wsUrl then
          local data = textutils.unserializeJSON(message)
          if data and data.type == "transfer_update" and data.payload then
            emitIncomingTransferEvents(data.payload)
          elseif data and data.type == "transfer_notification" and data.payload then
            emitIncomingTransferNotificationEvents(data.payload)
          end
          if data and data.id == authId then
            if data.type == "auth_ok" then
              authenticated = true
              os.cancelTimer(timeout)
              return true
            elseif data.type == "error" then
              closeWebSocket()
              os.cancelTimer(timeout)
              return false, data.payload and data.payload.message or "Auth failed"
            end
          end
        end
      elseif event == "websocket_closed" then
        if url == wsUrl then
          closeWebSocket()
          return false, "WebSocket closed during auth"
        end
      end
    end
  end

  local function queuePendingWsMessage(data)
    if data then
      if data.type == "transfer_notification" then
        return
      end
      table.insert(pendingWsMessages, data)
    end
  end

  local function popPendingWsMessage(matchFn)
    for i, data in ipairs(pendingWsMessages) do
      if matchFn(data) then
        table.remove(pendingWsMessages, i)
        return data
      end
    end
    return nil
  end

  if not apiKey then
    print("Use \\krawlet api to generate a code. Paste the quick code below (6 digits):")
    while true do
      local input = read()
      if input and #input == 6 then
        local response, _, errResponse = http.post(
          apiUrl .. "apikey/quickcode/redeem",
          textutils.serializeJSON({ code = input }),
          { ["Content-Type"] = "application/json" }
        )
        if response then
          local data = textutils.unserializeJSON(response.readAll())
          response:close()
          if data and data.success then
            print("API key redeemed successfully!")
            apiKey = data.data.apiKey
            settings.set("klog.apiKey", apiKey)
            settings.save()
            break
          else
            printError("Failed to redeem API key: " .. (data and data.error and data.error.message or "Unknown error"))
            print("Please try again:")
          end
        else
          printError("Failed to redeem API key")
          print("Please try again:")
        end
      end
    end
  end

  local function wsRequest(messageType, payload)
    if not ws or not authenticated then
      local connected, connectErr = connectWebSocket()
      if not connected then
        return false, connectErr
      end
    end

    local msgId = getNextMessageId()
    local timeout

    local requestBody = textutils.serializeJSON({
      type = messageType,
      id = msgId,
      payload = payload,
    })

    local sent, sendErr = sendWebSocketMessage(requestBody)
    if not sent then
      local connected, connectErr = connectWebSocket()
      if not connected then
        return false, connectErr or sendErr
      end

      sent, sendErr = sendWebSocketMessage(requestBody)
      if not sent then
        return false, sendErr
      end
    end

    local resultType = messageType .. "_ok"

    timeout = os.startTimer(10)

    while true do
      local queued = popPendingWsMessage(function(data)
        return data and data.id == msgId
      end)

      if queued then
        os.cancelTimer(timeout)
        if queued.type == "error" then
          return false, queued.payload and queued.payload.message or "Unknown error"
        elseif queued.type == resultType then
          return true, queued.payload
        end
      end

      local event, url, message = os.pullEvent()

      if event == "timer" then
        if url == timeout then
          return false, "WebSocket request timeout"
        end
      elseif event == "websocket_message" then
        if url == wsUrl then
          local data = textutils.unserializeJSON(message)
          if data and data.type == "transfer_update" and data.payload then
            emitIncomingTransferEvents(data.payload)
          elseif data and data.type == "transfer_notification" and data.payload then
            emitIncomingTransferNotificationEvents(data.payload)
          end
          if data and data.id == msgId then
            os.cancelTimer(timeout)
            if data.type == "error" then
              return false, data.payload and data.payload.message or "Unknown error"
            elseif data.type == resultType then
              return true, data.payload
            end
          elseif data then
            queuePendingWsMessage(data)
          end
        end
      elseif event == "websocket_closed" then
        if url == wsUrl then
          closeWebSocket()
          os.cancelTimer(timeout)
          return false, "WebSocket disconnected"
        end
      end
    end
  end

  local function waitForTransferUpdate(transferId, timeoutSeconds)
    local timeout = os.startTimer(timeoutSeconds or 10)

    while true do
      local queued = popPendingWsMessage(function(data)
        return data and data.type == "transfer_update" and data.payload and data.payload.id == transferId
      end)

      if queued then
        os.cancelTimer(timeout)
        return true, queued.payload
      end

      local event, url, message = os.pullEvent()

      if event == "timer" then
        if url == timeout then
          return false, "Timed out waiting for transfer update"
        end
      elseif event == "websocket_message" then
        if url == wsUrl then
          local data = textutils.unserializeJSON(message)
          if data and data.type == "transfer_update" and data.payload then
            emitIncomingTransferEvents(data.payload)
          elseif data and data.type == "transfer_notification" and data.payload then
            emitIncomingTransferNotificationEvents(data.payload)
          end
          if data and data.type == "transfer_update" and data.payload and data.payload.id == transferId then
            os.cancelTimer(timeout)
            return true, data.payload
          elseif data then
            queuePendingWsMessage(data)
          end
        end
      elseif event == "websocket_closed" then
        if url == wsUrl then
          closeWebSocket()
          os.cancelTimer(timeout)
          return false, "WebSocket disconnected"
        end
      end
    end
  end

  local klog = {
    _handlers = {},
    _VERSION = "1.3.0",
  }

  local function emitEvent(eventType, payload)
    os.queueEvent(eventType, payload)

    local handlers = klog._handlers[eventType]
    if not handlers then
      return
    end

    for _, handler in pairs(handlers) do
      local ok, err = pcall(handler, payload)
      if not ok then
        printError("Error in handler for event '" .. eventType .. "': " .. tostring(err))
      end
    end
  end

  local function copyTransferPayload(payload)
    local copied = {}
    for key, value in pairs(payload) do
      copied[key] = value
    end
    return copied
  end

  local function copyTransferNotificationPayload(payload)
    local copied = {}
    for key, value in pairs(payload) do
      copied[key] = value
    end
    return copied
  end

  emitIncomingTransferEvents = function(payload)
    if type(payload) ~= "table" then
      return
    end

    if type(payload.id) ~= "string" or payload.id == "" then
      return
    end

    if localTransferIds[payload.id] then
      return
    end

    local previous = incomingTransferState[payload.id]
    local status = payload.status
    local quantityTransferred = payload.quantityTransferred

    if not previous then
      incomingTransferState[payload.id] = {
        status = status,
        quantityTransferred = quantityTransferred,
      }
      emitEvent("transfer_incoming_started", copyTransferPayload(payload))
    elseif previous.status ~= status or previous.quantityTransferred ~= quantityTransferred then
      incomingTransferState[payload.id] = {
        status = status,
        quantityTransferred = quantityTransferred,
      }
      emitEvent("transfer_incoming_updated", copyTransferPayload(payload))
    end

    if status == "completed" then
      incomingTransferState[payload.id] = nil
      emitEvent("transfer_incoming_completed", copyTransferPayload(payload))
    elseif status == "failed" then
      incomingTransferState[payload.id] = nil
      emitEvent("transfer_incoming_failed", copyTransferPayload(payload))
    elseif status == "cancelled" then
      incomingTransferState[payload.id] = nil
      emitEvent("transfer_incoming_cancelled", copyTransferPayload(payload))
    end
  end

  emitIncomingTransferNotificationEvents = function(payload)
    if type(payload) ~= "table" then
      return
    end

    if type(payload.transferId) ~= "string" or payload.transferId == "" then
      return
    end

    emitEvent("transfer_notification", copyTransferNotificationPayload(payload))

    if payload.type == "error" then
      emitEvent("transfer_notification_error", copyTransferNotificationPayload(payload))
    elseif payload.type == "success" then
      emitEvent("transfer_notification_success", copyTransferNotificationPayload(payload))
    else
      emitEvent("transfer_notification_info", copyTransferNotificationPayload(payload))
    end
  end

  local function removeHandler(eventType, handler)
    local handlers = klog._handlers[eventType]
    if not handlers then
      return false
    end

    for index, registeredHandler in ipairs(handlers) do
      if registeredHandler == handler then
        table.remove(handlers, index)
        if #handlers == 0 then
          klog._handlers[eventType] = nil
        end
        return true
      end
    end

    return false
  end

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

  ---Get input inventories used for staging into ender storage.
  ---The staging ender storage itself and any configured exclude patterns are omitted.
  ---@return table[] chests Inventory peripheral objects.
  function klog.getInputChests()
    local chests = {}
    for _, chest in ipairs(table.pack(peripheral.find("inventory"))) do
      if not isExcluded(chest) then
        table.insert(chests, chest)
      end
    end
    return chests
  end

  ---Count matching items across all input inventories.
  ---@param itemName string Item id to match (for example minecraft:diamond).
  ---@param itemNbt? string Optional exact NBT to match.
  ---@return number total Total matching item count.
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

  local function countEstorageItems(itemName, itemNbt)
    local total = 0
    for _, item in pairs(estorage.list()) do
      if (not itemName or item.name == itemName) and (not itemNbt or item.nbt == itemNbt) then
        total = total + item.count
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
    if opts.memo ~= nil and type(opts.memo) ~= "string" then
      return "Memo must be a string if specified"
    end
    if opts.timeout and (type(opts.timeout) ~= "number" or opts.timeout <= 0 or opts.timeout > 30) then
      return "Timeout must be a positive number between 0.1 and 30 seconds if specified"
    end
    if opts.disableExternalStaging ~= nil and type(opts.disableExternalStaging) ~= "boolean" then
      return "disableExternalStaging must be a boolean if specified"
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
  ---@return KlogTransfer|false transfer Transfer data on success, false on failure.
  ---@return string|nil err Error message when transfer is false.
  function klog.transfer(opts)
    local err = checkTransferOpts(opts)
    if err then
      emitEvent("transfer_failed", {
        to = opts and opts.to,
        quantity = opts and opts.quantity,
        itemName = opts and opts.itemName,
        itemNbt = opts and opts.itemNbt,
        memo = opts and opts.memo,
        error = err,
      })
      return false, err
    end

    if opts.itemName then
      local stagedCount = countEstorageItems(opts.itemName, opts.itemNbt)
      local externalCount = opts.disableExternalStaging and 0 or klog.countItem(opts.itemName, opts.itemNbt)
      opts.quantity = math.min(opts.quantity or math.huge, stagedCount + externalCount)
      if opts.quantity <= 0 then
        local errMsg = "No items available to transfer"
        emitEvent("transfer_failed", {
          to = opts.to,
          quantity = opts.quantity,
          itemName = opts.itemName,
          itemNbt = opts.itemNbt,
          memo = opts.memo,
          error = errMsg,
        })
        return false, errMsg
      end
    end

    ---@type KlogTransfer|nil
    local transfer = nil
    local lastStatus = nil
    local lastQuantityTransferred = nil
    local terminalEventQueued = false
    local sendTransferDone = false
    local sendTransferError = nil

    local function markSendTransferDone(err)
      sendTransferDone = true
      if err and not sendTransferError then
        sendTransferError = err
      end
    end

    local function buildTransferPayload(errorMessage)
      local payload = {}
      if transfer then
        for key, value in pairs(transfer) do
          payload[key] = value
        end
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
      emitEvent(eventName, payload)
    end

    local function transferItems()
      if opts.disableExternalStaging then
        return
      end

      local itemsRemaining = opts.quantity or math.huge
      if opts.quantity then
        local stagedCount = countEstorageItems(opts.itemName, opts.itemNbt)
        itemsRemaining = math.max(0, opts.quantity - stagedCount)
      end

      local function shouldStopItemTransfer()
        if sendTransferDone then
          return true
        end
        if not transfer then
          return false
        end
        return transfer.status == "completed" or transfer.status == "failed" or transfer.status == "cancelled"
      end

      while itemsRemaining > 0 do
        if shouldStopItemTransfer() then
          break
        end

        local chests = klog.getInputChests()
        local movedThisPass = 0

        for _, chest in ipairs(chests) do
          if shouldStopItemTransfer() or itemsRemaining <= 0 then
            break
          end

          local items = chest.list()
          for slot, item in pairs(items) do
            if shouldStopItemTransfer() or itemsRemaining <= 0 then
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
          sleep(0.25)
        else
          sleep(0)
        end
      end
    end

    local function sendTransfer()
      local ok, payload = wsRequest("create_transfer", {
        to = opts.to,
        quantity = opts.quantity,
        itemName = opts.itemName,
        itemNbt = opts.itemNbt,
        memo = opts.memo,
        timeout = opts.timeout,
      })

      if not ok then
        queueTerminalEvent("transfer_failed", buildTransferPayload(payload))
        markSendTransferDone(payload)
        return false, payload
      end

      if type(payload) ~= "table" then
        local errMsg = "Unexpected create_transfer response"
        queueTerminalEvent("transfer_failed", buildTransferPayload(errMsg))
        markSendTransferDone(errMsg)
        return false, errMsg
      end

      if type(payload.id) ~= "string" or type(payload.status) ~= "string" then
        local errMsg = "Malformed create_transfer response"
        queueTerminalEvent("transfer_failed", buildTransferPayload(errMsg))
        markSendTransferDone(errMsg)
        return false, errMsg
      end

      transfer = payload
      localTransferIds[transfer.id] = true
      emitEvent("transfer_started", buildTransferPayload())

      while transfer and (transfer.status == "pending" or transfer.status == "in_progress") do
        local statusOk, statusPayload = waitForTransferUpdate(transfer.id, 35)

        if not statusOk then
          if transfer and transfer.id then
            localTransferIds[transfer.id] = nil
          end
          queueTerminalEvent("transfer_failed", buildTransferPayload(statusPayload))
          markSendTransferDone(statusPayload)
          return false, statusPayload
        end

        if type(statusPayload) ~= "table" then
          local errMsg = "Invalid transfer update payload"
          if transfer and transfer.id then
            localTransferIds[transfer.id] = nil
          end
          queueTerminalEvent("transfer_failed", buildTransferPayload(errMsg))
          markSendTransferDone(errMsg)
          return false, errMsg
        end

        transfer = statusPayload
        local status = transfer.status
        local quantityTransferred = transfer.quantityTransferred

        if status ~= lastStatus or quantityTransferred ~= lastQuantityTransferred then
          emitEvent("transfer_update", buildTransferPayload())
          lastStatus = status
          lastQuantityTransferred = quantityTransferred
        end

        if status == "completed" then
          localTransferIds[transfer.id] = nil
          queueTerminalEvent("transfer_completed", buildTransferPayload())
          markSendTransferDone()
          return true
        elseif status == "failed" then
          localTransferIds[transfer.id] = nil
          queueTerminalEvent("transfer_failed", buildTransferPayload(transfer.error))
          markSendTransferDone(transfer.error or "Transfer failed")
          return false, transfer.error or "Transfer failed"
        elseif status == "cancelled" then
          localTransferIds[transfer.id] = nil
          queueTerminalEvent("transfer_cancelled", buildTransferPayload(transfer.error))
          markSendTransferDone(transfer.error or "Transfer cancelled")
          return false, transfer.error or "Transfer cancelled"
        end
      end

      if transfer and transfer.id then
        localTransferIds[transfer.id] = nil
      end
      markSendTransferDone()
      return true
    end

    parallel.waitForAll(transferItems, sendTransfer)

    if sendTransferError then
      return false, sendTransferError
    end

    if not transfer then
      return false, "Transfer failed"
    end

    return transfer, nil
  end

  ---Compatibility wrapper around klog.transfer.
  ---This needs to be reworked.
  ---@param opts KlogTransferOptions Same options as klog.transfer.
  ---@param callback? function Callback invoked as callback(transfer, err) when finished.
  ---@return KlogTransfer|false transfer Transfer data on success, false on failure.
  ---@return string|nil err Error message when transfer is false.
  function klog.transferAsync(opts, callback)
    local transfer, err = klog.transfer(opts)
    if type(callback) == "function" then
      callback(transfer, err)
    end
    return transfer, err
  end

  ---Cancel a transfer by id.
  ---@param transferId string
  ---@return boolean ok
  ---@return string|nil err
  function klog.cancelTransfer(transferId)
    if not transferId or type(transferId) ~= "string" then
      return false, "Invalid transfer ID"
    end

    local ok, payload = wsRequest("cancel_transfer", {
      transferId = transferId,
    })

    if not ok then
      return false, payload
    end
    return true
  end

  local function checkNotifyType(notifyType)
    if notifyType == nil then
      return nil
    end

    if notifyType ~= "error" and notifyType ~= "info" and notifyType ~= "success" then
      return "Notification type must be one of: error, info, success"
    end

    return nil
  end

  ---Send a transfer notification over WebSocket.
  ---@param transferId string
  ---@param message string
  ---@param notifyType? KlogTransferNotificationType
  ---@return KlogTransferNotification|false notification Notification payload on success, false on failure.
  ---@return string|nil err Error message when notification is false.
  function klog.notifyTransfer(transferId, message, notifyType)
    if not transferId or type(transferId) ~= "string" then
      return false, "Invalid transfer ID"
    end

    if type(message) ~= "string" or message:gsub("%s+", "") == "" then
      return false, "Notification message is required"
    end

    local typeErr = checkNotifyType(notifyType)
    if typeErr then
      return false, typeErr
    end

    local ok, payload = wsRequest("notify_transfer", {
      transferId = transferId,
      type = notifyType,
      message = message,
    })

    if not ok then
      return false, payload
    end

    if type(payload) ~= "table" or type(payload.id) ~= "string" then
      return false, "Unexpected notify_transfer response"
    end

    return payload
  end

  ---Send an info transfer notification over HTTP.
  ---@param transferId string
  ---@param message string
  ---@param notifyType? KlogTransferNotificationType
  ---@return KlogTransferNotification|false notification Notification payload on success, false on failure.
  ---@return string|nil err Error message when notification is false.
  function klog.notifyTransferHttp(transferId, message, notifyType)
    if not transferId or type(transferId) ~= "string" then
      return false, "Invalid transfer ID"
    end

    if type(message) ~= "string" or message:gsub("%s+", "") == "" then
      return false, "Notification message is required"
    end

    local typeErr = checkNotifyType(notifyType)
    if typeErr then
      return false, typeErr
    end

    local response, _, errorResponse = http.post(
      apiUrl .. "transfers/" .. transferId .. "/notify",
      textutils.serializeJSON({
        type = notifyType,
        message = message,
      }),
      {
        ["Content-Type"] = "application/json",
        ["Authorization"] = "Bearer " .. apiKey,
      }
    )

    if not response then
      if errorResponse then
        local ok, parsed = pcall(textutils.unserializeJSON, errorResponse.readAll())
        errorResponse:close()
        if ok and parsed and parsed.error and parsed.error.message then
          return false, parsed.error.message
        end
      end
      return false, "Failed to send transfer notification"
    end

    local data = textutils.unserializeJSON(response.readAll())
    response:close()

    if data and data.ok and data.data and type(data.data.id) == "string" then
      return data.data
    end

    if data and data.error and data.error.message then
      return false, data.error.message
    end

    return false, "Unexpected notify endpoint response"
  end

  ---Send a typed transfer notification over WebSocket.
  ---@param transferId string
  ---@param message string
  ---@return KlogTransferNotification|false notification
  ---@return string|nil err
  function klog.notifyTransferInfo(transferId, message)
    return klog.notifyTransfer(transferId, message, "info")
  end

  ---Send a success transfer notification over WebSocket.
  ---@param transferId string
  ---@param message string
  ---@return KlogTransferNotification|false notification
  ---@return string|nil err
  function klog.notifyTransferSuccess(transferId, message)
    return klog.notifyTransfer(transferId, message, "success")
  end

  ---Send an error transfer notification over WebSocket.
  ---@param transferId string
  ---@param message string
  ---@return KlogTransferNotification|false notification
  ---@return string|nil err
  function klog.notifyTransferError(transferId, message)
    return klog.notifyTransfer(transferId, message, "error")
  end

  ---Get a transfer by id.
  ---@param transferId string
  ---@param opts? { inclNotifs?: boolean }
  ---@return KlogTransfer|false transfer Transfer payload on success, false on failure.
  ---@return string|nil err Error message when transfer is false.
  function klog.getTransfer(transferId, opts)
    if not transferId or type(transferId) ~= "string" then
      return false, "Invalid transfer ID"
    end

    local inclNotifs = opts and opts.inclNotifs

    local ok, payload = wsRequest("get_transfer", {
      transferId = transferId,
      inclNotifs = inclNotifs or nil,
    })

    if not ok then
      return false, payload
    end

    if type(payload) ~= "table" then
      return false, "Unexpected get_transfer response"
    end

    if type(payload.id) ~= "string" or type(payload.status) ~= "string" then
      return false, "Malformed get_transfer response"
    end

    return payload
  end

  ---List all transfers visible to the current API key.
  ---@param opts? { inclNotifs?: boolean }
  ---@return KlogTransfer[]|false transfers Transfer list on success, false on failure.
  ---@return string|nil err Error message when transfers is false.
  function klog.getTransfers(opts)
    local inclNotifs = opts and opts.inclNotifs

    local ok, payload = wsRequest("list_transfers", {
      inclNotifs = inclNotifs or nil,
    })

    if not ok then
      return false, payload
    end

    if type(payload) ~= "table" then
      return false, "Unexpected list_transfers response"
    end

    if payload.transfers ~= nil and type(payload.transfers) ~= "table" then
      return false, "Malformed list_transfers response"
    end

    return payload.transfers or {}
  end

  ---List available transfer target names.
  ---@return string[]|false targets Sorted target names on success, false on failure.
  ---@return string|nil err Error message when targets is false.
  function klog.getTransferTargets()
    local ok, payload = wsRequest("list_targets", {})

    if not ok then
      return false, payload
    end

    if type(payload) ~= "table" then
      return false, "Unexpected list_targets response"
    end

    local values = {}
    for _, target in pairs(payload.targets or {}) do
      if target.name and target.name ~= "" then
        table.insert(values, target.name)
      end
    end
    table.sort(values)

    return values
  end

  local ok, err = connectWebSocket()
  assert(ok, "Failed to start WebSocket: " .. (err or "unknown error"))

  ---Register an event handler for Klog lifecycle events.
  ---
  ---Handlers are invoked synchronously when Klog emits an event.
  ---Events are also queued with os.queueEvent for compatibility with pullEvent-based consumers.
  ---
  ---Klog emits these transfer lifecycle events during klog.transfer(...):
  --- - transfer_started(payload)
  --- - transfer_update(payload)
  --- - transfer_completed(payload)
  --- - transfer_cancelled(payload)
  --- - transfer_failed(payload)
  ---
  ---Incoming transfer updates received over WebSocket are emitted as:
  --- - transfer_incoming_started(payload)
  --- - transfer_incoming_updated(payload)
  --- - transfer_incoming_completed(payload)
  --- - transfer_incoming_cancelled(payload)
  --- - transfer_incoming_failed(payload)
  ---
  ---Incoming transfer notifications received over WebSocket are emitted as:
  --- - transfer_notification(payload) for any notification
  --- - transfer_notification_info(payload) for info-type notifications
  --- - transfer_notification_success(payload) for success-type notifications
  --- - transfer_notification_error(payload) for error-type notifications
  ---@param eventType string Event name to subscribe to.
  ---@param handler function Callback invoked with the event payload.
  ---@return function unsubscribe Call to remove this handler.
  function klog.on(eventType, handler)
    if type(handler) ~= "function" then
      error("Handler must be a function")
    end
    klog._handlers[eventType] = klog._handlers[eventType] or {}
    table.insert(klog._handlers[eventType], handler)
    return function()
      return removeHandler(eventType, handler)
    end
  end

  ---Remove a previously registered event handler.
  ---@param eventType string Event name.
  ---@param handler function Registered handler function.
  ---@return boolean removed True when a handler was removed.
  function klog.off(eventType, handler)
    if type(handler) ~= "function" then
      error("Handler must be a function")
    end
    return removeHandler(eventType, handler)
  end

  ---Close the websocket connection.
  ---No automatic reconnect is attempted after close.
  function klog.close()
    closeWebSocket()
  end

  return klog
end
