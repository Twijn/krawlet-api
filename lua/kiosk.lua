local apiKey = settings.get("kiosk.apiKey")
local kioskName = settings.get("kiosk.name")
local commandNumber = settings.get("kiosk.commandNumber")
local apiUrl = "https://api.krawlet.cc/v1/"

local save = false
if not apiKey then
  print("Enter API key (kraw_xxx):")
  apiKey = read()
  settings.set("kiosk.apiKey", apiKey)
  save = true
end

if not commandNumber then
  print("Enter a unique command number for this kiosk (e.g. '1' for command 'k1'):")
  commandNumber = read()
  settings.set("kiosk.commandNumber", commandNumber)
  save = true
end

if not kioskName then
  print("Enter a name for this kiosk (e.g. 'Kiosk #1'):")
  kioskName = read()
  settings.set("kiosk.name", kioskName)
  save = true
end

if save then
  settings.save()
end

local enderStorage = "sc-goodies:ender_storage"

local modem = peripheral.find("modem")
if not modem or modem.isWireless() then
  printError("No modem found. Please attach a wired modem to use this program.")
  return
end

local localName = modem.getNameLocal()
if not localName then
  printError("Failed to get modem name. Make sure the modem is properly attached (right click).")
  return
end

local BOT_NAME = "&9Krawlet&bKiosk"

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

local function selectItem(itemName)
  for slot = 1, 16 do
    local detail = turtle.getItemDetail(slot)
    if detail and detail.name == itemName then
      turtle.select(slot)
      return true
    end
  end
  return false
end

local function retrieveAndSelectEnderStorage()
  if selectItem(enderStorage) then
    return true
  end
  for i, inv in ipairs(table.pack(peripheral.find("inventory"))) do
    for slot, item in pairs(inv.list()) do
      if item.name == enderStorage then
        inv.pushItems(localName, slot, 1)
        selectItem(enderStorage)
        return true
      end
    end
  end
  return false
end

local function getEnderStorageColors()
  if retrieveAndSelectEnderStorage() then
    local succ, err = turtle.place()
    if not succ then
      err = "Failed to place ender storage: " .. (err or "Unknown error")
      printError(err)
      return false, err
    end
    sleep(0.25)
    local estorage = peripheral.wrap("front")
    local color1, color2, color3 = estorage.getFrequency()
    turtle.dig()
    return { color1, color2, color3 }
  else
    return false
  end
end

-- This appears to be bugged
-- if not chatbox or not chatbox.hasCapability("command") or not chatbox.hasCapability("tell") then
--   printError("Receive your license with '/chatbox license register', set on this computer with 'chatbox register <key>'")
--   return
-- end

local function run()
  local e, user, command, args, pkt = os.pullEvent("command")

  if command == "kk" .. commandNumber then
    if args[1] == "storage" then
      local colors, errMsg = getEnderStorageColors()
      if colors then
        print("Ender storage colors: " .. table.concat(colors, ", "))
        local response, errMsg = post("players/" .. pkt.user.uuid .. "/link", { colors = colors })
        if response then
          print(textutils.serialize(response))
          turtle.drop()
          chatbox.tell(user, "<blue>Here is your private ender storage!</blue><br><gray>Setup a small modem network with input inventories (chests, barrels, etc), the ender storage, and a computer and run <white>wget https://krawlet.cc/klog-cli.lua</white> for a simple Klog request manager.</gray>", BOT_NAME, "minimessage")
        else
          chatbox.tell(user, "<red>" .. errMsg .. "</red>", BOT_NAME, "minimessage")
        end
      else
        if errMsg then
          errMsg = "<red>An error occurred!</red>" .. (errMsg and (" <gray>" .. errMsg .. "</gray>") or "")
        else
          errMsg = "<red>We are currently out of ender storages!</red> <gray>Please use a different kiosk or ask Twijn to refill " .. kioskName .. ".</gray>"
        end
        chatbox.tell(user, errMsg, BOT_NAME, "minimessage")
      end
    else
      chatbox.tell(user, "<red>Unknown kiosk command.</red> <gray>Usage: \\kk" .. commandNumber .. " storage</gray>", BOT_NAME, "minimessage")
    end
  end
end

local function drawMonitors()
  local topMonitor = peripheral.wrap("top")
  if topMonitor then
    local monX, monY = topMonitor.getSize()
    topMonitor.setCursorPos(2, monY)
    topMonitor.write(string.format("\\kk%s storage", commandNumber))
  end
end

drawMonitors()

while true do
  run()
end
