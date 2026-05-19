local g        = string.gsub
-- Compact sha256
---@diagnostic disable-next-line
local sha256         = loadstring(g(
  g(
    g(
      g(
        g(
          g(
            g(
              g(
                'Sa=XbandSb=XbxWSc=XlshiftSd=unpackSe=2^32SYf(g,h)Si=g/2^hSj=i%1Ui-j+j*eVSYk(l,m)Sn=l/2^mUn-n%1VSo={0x6a09e667Tbb67ae85T3c6ef372Ta54ff53aT510e527fT9b05688cT1f83d9abT5be0cd19}Sp={0x428a2f98T71374491Tb5c0fbcfTe9b5dba5T3956c25bT59f111f1T923f82a4Tab1c5ed5Td807aa98T12835b01T243185beT550c7dc3T72be5d74T80deb1feT9bdc06a7Tc19bf174Te49b69c1Tefbe4786T0fc19dc6T240ca1ccT2de92c6fT4a7484aaT5cb0a9dcT76f988daT983e5152Ta831c66dTb00327c8Tbf597fc7Tc6e00bf3Td5a79147T06ca6351T14292967T27b70a85T2e1b2138T4d2c6dfcT53380d13T650a7354T766a0abbT81c2c92eT92722c85Ta2bfe8a1Ta81a664bTc24b8b70Tc76c51a3Td192e819Td6990624Tf40e3585T106aa070T19a4c116T1e376c08T2748774cT34b0bcb5T391c0cb3T4ed8aa4aT5b9cca4fT682e6ff3T748f82eeT78a5636fT84c87814T8cc70208T90befffaTa4506cebTbef9a3f7Tc67178f2}SYq(r,q)if e-1-r[1]<q then r[2]=r[2]+1;r[1]=q-(e-1-r[1])-1 else r[1]=r[1]+qVUrVSYs(t)Su=#t;t[#t+1]=0x80;while#t%64~=56Zt[#t+1]=0VSv=q({0,0},u*8)fWw=2,1,-1Zt[#t+1]=a(k(a(v[w]TFF000000),24)TFF)t[#t+1]=a(k(a(v[w]TFF0000),16)TFF)t[#t+1]=a(k(a(v[w]TFF00),8)TFF)t[#t+1]=a(v[w]TFF)VUtVSYx(y,w)Uc(y[w]W0,24)+c(y[w+1]W0,16)+c(y[w+2]W0,8)+(y[w+3]W0)VSYz(t,w,A)SB={}fWC=1,16ZB[C]=x(t,w+(C-1)*4)VfWC=17,64ZSD=B[C-15]SE=b(b(f(B[C-15],7),f(B[C-15],18)),k(B[C-15],3))SF=b(b(f(B[C-2],17),f(B[C-2],19)),k(B[C-2],10))B[C]=(B[C-16]+E+B[C-7]+F)%eVSG,h,H,I,J,j,K,L=d(A)fWC=1,64ZSM=b(b(f(J,6),f(J,11)),f(J,25))SN=b(a(J,j),a(Xbnot(J),K))SO=(L+M+N+p[C]+B[C])%eSP=b(b(f(G,2),f(G,13)),f(G,22))SQ=b(b(a(G,h),a(G,H)),a(h,H))SR=(P+Q)%e;L,K,j,J,I,H,h,G=K,j,J,(I+O)%e,H,h,G,(O+R)%eVA[1]=(A[1]+G)%e;A[2]=(A[2]+h)%e;A[3]=(A[3]+H)%e;A[4]=(A[4]+I)%e;A[5]=(A[5]+J)%e;A[6]=(A[6]+j)%e;A[7]=(A[7]+K)%e;A[8]=(A[8]+L)%eUAVUY(t)t=t W""t=type(t)=="string"and{t:byte(1,-1)}Wt;t=s(t)SA={d(o)}fWw=1,#t,64ZA=z(t,w,A)VU("%08x"):rep(8):format(d(A))V',
                "S", " local "), "T", ",0x"), "U", " return "), "V", " end "), "W", "or "), "X", "bit32."), "Y",
    "function "), "Z",
  " do "))()

local ca = peripheral.find("cryptographic_accelerator")
if ca and ca.sha256 then
  sha256 = ca.sha256
end

local updateDomain = "https://krawlet.cc/"

local motd = {
  {"Welcome to Klog CLI!", colors.blue},
  {"Type 'help' for a list of commands.", colors.lightGray},
  {"Use 'transfer <target> <item> <quantity>' to transfer items to another ender storage target.", colors.lightGray},
  {"Use '\\klog optIn' in-game to opt in to in-game notifications for transfers", colors.white},
}

local function downloadFile(url, filename)
  term.setTextColor(colors.yellow)
  print("Downloading " .. filename .. " from " .. url .. "...")
  local success, errMsg = pcall(function()
    local response = http.get(url)
    if response then
      local content = response.readAll()
      local file = fs.open(filename, "w")
      file.write(content)
      file.close()
      print(filename .. " downloaded successfully!")
    else
      printError("Failed to download " .. filename)
    end
  end)
  term.setTextColor(colors.white)
  if not success then
    printError("Error downloading " .. filename .. ": " .. errMsg)
    return
  end
end

term.setTextColor(colors.blue)

local libraries = {
  ["/lib/klog.lua"] = updateDomain .. "klog.lua",
  ["/lib/pager.lua"] = "https://raw.githubusercontent.com/Twijn/cc-misc/main/util/pager.lua",
  ["/lib/cmd.lua"] = "https://raw.githubusercontent.com/Twijn/cc-misc/main/util/cmd.lua",
}

for path, url in pairs(libraries) do
  if not fs.exists(path) then
    downloadFile(url, path)
  end
end

local mainWindow = window.create(term.current(), 1, 1, term.getSize())
term.redirect(mainWindow)

local function checkForUpdates()
  local response = http.get(updateDomain .. "sha256")
  if not response then
    return
  end
  local manifest = textutils.unserializeJSON(response.readAll())
  if not manifest then
    return
  end

  local filesToCheck = {
    { path = "/klog-cli.lua", key = "klog-cli.lua" },
    { path = "/lib/klog.lua", key = "klog.lua" },
  }

  local outdated = {}
  for _, entry in ipairs(filesToCheck) do
    local expected = manifest[entry.key]
    if expected and fs.exists(entry.path) then
      local f = fs.open(entry.path, "r")
      local content = f.readAll()
      f.close()
      local actual = sha256(content)
      if actual ~= expected then
        table.insert(outdated, entry.path)
      end
    end
  end

  if #outdated > 0 then
    term.setTextColor(colors.orange)
    print("Warning: outdated file(s) detected. Run 'update' to update.")
    for _, path in ipairs(outdated) do
      print("  " .. path)
    end
    term.setTextColor(colors.white)
  end
end

checkForUpdates()

if not package.path:find("/lib/?.lua") then
  package.path = package.path .. ";/lib/?.lua"
end

local cmd = require("cmd")
local createKlog = require("klog")

local enderStorage = nil
local outputInventory = nil

local function getOutputInventory()
  if outputInventory and outputInventory.getInventory then
    local success, inv = pcall(outputInventory.getInventory, outputInventory)
    if success and inv then
      return inv
    else
      return false, inv or "Failed to get inventory from output peripheral"
    end
  elseif outputInventory.pullItems or outputInventory.pushItems or (outputInventory.list and outputInventory.size) then
    return outputInventory
  else
    return false, "Output peripheral does not appear to be an inventory"
  end
end

local enderStorages = table.pack(peripheral.find("ender_storage"))
if enderStorages.n == 1 then
  enderStorage = enderStorages[1]
elseif enderStorages.n > 1 then
  printError("Multiple ender storages found. Please specify which one to use.")
  local selectedIndex = 1
  while true do
    term.clear()
    term.setCursorPos(1, 1)
    print("Select an ender storage:")
    for i = 1, enderStorages.n do
      local _, ownerName = enderStorages[i].getOwner()
      if ownerName == "Retests" and selectedIndex == 1 then
        selectedIndex = i
      end
      print((selectedIndex == i and ">" or " ") .. peripheral.getName(enderStorages[i]) .. " [" .. ownerName .. "]")
    end
    local event, key = os.pullEvent("key")
    if event == "key" then
      if key == keys.up then
        selectedIndex = selectedIndex > 1 and selectedIndex - 1 or enderStorages.n
      elseif key == keys.down then
        selectedIndex = selectedIndex < enderStorages.n and selectedIndex + 1 or 1
      elseif key == keys.enter then
        enderStorage = enderStorages[selectedIndex]
        break
      end
    end
  end
else
  printError("No ender storages attached")
  return
end

if settings.get("klog.outputInv") then
  outputInventory = peripheral.wrap(settings.get("klog.outputInv"))
  if not outputInventory then
    printError("klog.outputInv set but peripheral could not be resolved")
  end
end

local klog = createKlog(peripheral.getName(enderStorage), {
  apiKey = settings.get("klog.apiKey"),
  apiUrl = settings.get("klog.apiUrl") or nil,
})

local transferTargets, transferTargetsErr = klog.getTransferTargets()
if transferTargets == false then
  printError("Failed to load transfer targets: " .. (transferTargetsErr or "Unknown error"))
  transferTargets = {}
end

local items = {}

local function rescanItems()
  local newItems = {}

  local stagedItems = enderStorage.list()
  for _, item in pairs(stagedItems) do
    newItems[item.name] = (newItems[item.name] or 0) + item.count
  end

  for i, chest in pairs(klog.getInputChests()) do
    local chestItems = chest.list()
    for slot, item in pairs(chestItems) do
      newItems[item.name] = (newItems[item.name] or 0) + item.count
    end
  end
  items = newItems
end

local function rescanItemLoop()
  while true do
    rescanItems()
    sleep(60)
  end
end

local function getItemNames()
  local itemNames = {}
  for itemName, _ in pairs(items) do
    table.insert(itemNames, itemName)
  end
  return itemNames
end

local function emptyEstorageToOutput()
  local outputInv, outputInvErr = getOutputInventory()

  if not outputInv then
    -- if outputInventory is set but we failed to get a valid inventory interface, print an error. If outputInventory isn't set, we can just skip this without an error
    if outputInventory then
      printError("Unable to get output inventory: " .. (outputInvErr or "Unknown error"))
    end
    return
  end

  local estorageSize = enderStorage.size()
  local estorageName = peripheral.getName(enderStorage)
  local outputName = settings.get("klog.outputInv") -- outputInventory may not always be a peripheral
  local outputIsInventory = type(outputInv.list) == "function" or type(outputInv.size) == "function"
  local supportsPull = type(outputInv.pullItems) == "function"
  local supportsPush = outputName and outputIsInventory and type(enderStorage.pushItems) == "function"

  if not supportsPull and not supportsPush then
    printError("Configured output peripheral cannot move items (missing pullItems/pushItems support)")
    outputInventory = nil
    settings.set("klog.outputInv", nil)
    return
  end

  local function moveItemsToOutput(fromSlot)
    return function()
      if supportsPull then
        outputInv.pullItems(estorageName, fromSlot)
      elseif supportsPush then
        enderStorage.pushItems(outputName, fromSlot)
      end
    end
  end

  local movements = {}
  for slot = 1, estorageSize do
    table.insert(movements, moveItemsToOutput(slot))
  end
  parallel.waitForAll(table.unpack(movements))
end

local transferWindow = nil
local incomingTransfer = nil -- this really doesn't need to track the transaction itself as it's only used as a boolean to activate emptyEstorageToOutput
local returnCursorX, returnCursorY, returnCursorBlink

local function drawTransferStatus(transfer)
  if not transferWindow then
    local width, height = mainWindow.getSize()
    transferWindow = window.create(mainWindow, 1, height - 3, width, 4)
    if not transferWindow then
      printError("Failed to create transfer status window")
      return end
  end

  local w,h = transferWindow.getSize()

  local function cl(x, y)
    transferWindow.setCursorPos(x, y)
    transferWindow.clearLine()
  end

  transferWindow.setBackgroundColor(colors.gray)

  cl(2, 1)
  transferWindow.setTextColor(colors.blue)
  transferWindow.write("Transfer")

  if transfer then
    cl(2, 2)
    transferWindow.setTextColor(colors.lightGray)
    transferWindow.write(string.format("%s -> %s", transfer.fromName or "unknown", transfer.toName or "unknown"))
    
    cl(2, 3)
    transferWindow.setTextColor(colors.white)
    transferWindow.write(string.format("Item: %s", transfer.itemDisplayName or transfer.itemName or "unknown"))
    if transfer.memo then
      transferWindow.setTextColor(colors.lightBlue)
      transferWindow.write("  Memo: " .. transfer.memo)
    end

    cl(2, 4)
    transferWindow.setTextColor(colors.white)
    transferWindow.write(string.format("Quantity: %d/%d", transfer.quantityTransferred or 0, transfer.quantity or 0))

    if transfer.status then
      local statusColor = colors.white
      if transfer.status == "failed" then
        statusColor = colors.red
      elseif transfer.status == "completed" then
        statusColor = colors.lime
      elseif transfer.status == "cancelled" then
        statusColor = colors.orange
      elseif transfer.status == "in_progress" then
        statusColor = colors.blue
      end
      
      transferWindow.setTextColor(statusColor)
      transferWindow.setCursorPos(w - 1 - #transfer.status, 1)
      transferWindow.write(transfer.status)

      if transfer.status == "failed" or transfer.status == "cancelled" or transfer.status == "completed" then
        local txt = "Press any key or wait to close"
        transferWindow.setTextColor(colors.white)
        transferWindow.setCursorPos(w - 1 - #txt, 4)
        transferWindow.write(txt)
      end
    end

    if transfer.error then
      transferWindow.setCursorPos(w - 1 - #transfer.error, 2)
      transferWindow.setTextColor(colors.red)
      transferWindow.write(transfer.error)
    end
  else
    cl(2, 2)
    transferWindow.setTextColor(colors.red)
    transferWindow.write("No active transfer")
  end

  transferWindow.setTextColor(colors.white)
end

local function closeTransferWindow()
  if transferWindow then
    transferWindow.setBackgroundColor(colors.black)
    transferWindow.clear()
    transferWindow = nil
  end
  term.setCursorPos(returnCursorX, returnCursorY)
  term.setCursorBlink(returnCursorBlink)
  mainWindow.redraw()
end

local function incomingTransferLoop()
  while true do
    if incomingTransfer then
      emptyEstorageToOutput()
      sleep()
    else
      sleep(0.25)
    end
  end
end

local function keyPressOrWait(time)
  local timerId = os.startTimer(time)
  while true do
    local event, param = os.pullEvent()
    if event == "key" then
      sleep() -- prevent key press from entering cmd
      return true
    elseif event == "timer" and param == timerId then
      return false
    end
  end
end

local function transferStart(isIncoming)
  return function(xfr)
    returnCursorX, returnCursorY = term.getCursorPos()
    returnCursorBlink = term.getCursorBlink()
    if isIncoming then
      incomingTransfer = xfr
    end
    drawTransferStatus(xfr)
  end
end

local function transferUpdate(isIncoming)
  return function(xfr)
    if isIncoming then
      incomingTransfer = xfr
    end
    drawTransferStatus(xfr)
  end
end

local function transferStop(waitTime, isIncoming)
  return function(xfr)
    drawTransferStatus(xfr)
    if isIncoming then
      incomingTransfer = nil
    end
    keyPressOrWait(waitTime)
    closeTransferWindow()
  end
end

-- Incoming transfer events
-- Start transfer
klog.on("transfer_incoming_started", transferStart(true))
-- Transfer updated
klog.on("transfer_incoming_update", transferUpdate(true))
-- Cancel/fail/complete (completion) events
klog.on("transfer_incoming_cancelled", transferStop(20, true))
klog.on("transfer_incoming_failed", transferStop(20, true))
klog.on("transfer_incoming_completed", transferStop(5, true))

-- Outgoing transfer events
-- Start transfer
klog.on("transfer_started", transferStart(false))
-- Transfer updated
klog.on("transfer_update", transferUpdate(false))
-- Cancel/fail/complete (completion) events
klog.on("transfer_cancelled", transferStop(20, false))
klog.on("transfer_failed", transferStop(20, false))
klog.on("transfer_completed", transferStop(5, false))

local function websocketListenerLoop()
  while true do
    local ok, err = klog.listen({
      reconnect = true,
      reconnectDelay = 1,
    })

    if not ok and err and err ~= "" then
      printError("Klog listener stopped: " .. err)
    end

    sleep(0.25)
  end
end

local manipulators = {}

for _, m in pairs({peripheral.find("manipulator")}) do
  if m.hasModule("plethora:introspection") then
    table.insert(manipulators, peripheral.getName(m))
  end
end

local commands = {
  transfer = {
    description = "Transfer items to another ender storage target",
    category = "general",
    usage = "transfer <target> <item> <quantity> [memo]",
    complete = function(args)
      if #args == 1 then
        return transferTargets
      elseif #args == 2 then
        return getItemNames()
      end
      return ""
    end,
    execute = function(args, ctx)
      local target = args[1]
      local item = args[2]
      local quantity = tonumber(args[3])
      local memo = args[4] or nil
      for i = 5, #args do
        if not memo then memo = "" end
        memo = memo .. " " .. args[i]
      end
      if not target or not item then
        ctx.err("transfer <target> <item> <quantity> [memo]")
        return
      end

      if args[3] and (not quantity or quantity <= 0) then
        ctx.err("quantity must be a positive number")
        return
      end

      klog.transfer({
        to = target,
        itemName = item,
        quantity = quantity,
        memo = memo,
      }, ctx)
    end,
  },
  rescan = {
    description = "Rescan input storages for items",
    category = "general",
    execute = function(args, ctx)
      rescanItems()
      ctx.succ("Rescan complete!")
    end,
  },
  ["list-items"] = {
    description = "List all items currently in input storages and the Klog ender storage",
    category = "general",
    aliases = { "list", "ls" },
    execute = function(args, ctx)
      rescanItems()
      local p = ctx.pager("Items in Inputs + Klog Estorage")
      for itemName, quantity in pairs(items) do
        p.print(" x" .. quantity .. " - " .. itemName)
      end
      p.show()
    end,
  },
  update = {
    description = "Update klog-cli and klog with the latest version from the server",
    category = "system",
    usage = "update",
    execute = function(args, ctx)
      downloadFile(updateDomain .. "klog.lua", "/lib/klog.lua")
      downloadFile(updateDomain .. "klog-cli.lua", "/klog-cli.lua")
      if not cmd.VERSION then
        fs.delete("lib/cmd.lua")
      end
      ctx.succ("Items updated!")
      ctx.mess("Please restart the program to apply updates.")
    end,
  },
  output = {
    description = "Specify where to output received items.",
    category = "system",
    usage = "output <manipulator/peripheral name>",
    complete = function(args)
      if #args == 1 then
        return manipulators
      end
      return {}
    end,
    execute = function(args, ctx)
      local peripheralName = args[1]

      if not peripheralName then
        ctx.err("Usage: output <manipulator/peripheral name>")
        return
      end

      if not peripheral.isPresent(peripheralName) then
        ctx.err(string.format("Peripheral %s is not present!", peripheralName))
        return
      end

      local selected = peripheral.wrap(peripheralName)
      if not selected then
        ctx.err(string.format("Failed to wrap peripheral %s", peripheralName))
        return
      end

      outputInventory = selected
      settings.set("klog.outputInv", peripheralName)
      settings.save()
      ctx.succ("Output inventory saved successfully!")
    end
  },
}

local disableMotdValue = settings.get("klog.disableMotd")
if not disableMotdValue and disableMotdValue ~= "false" then
  for _, motdLine in pairs(motd) do
    local text = motdLine[1]
    local color = motdLine[2] or colors.white
    term.setTextColor(color)
    print(text)
  end
  term.setTextColor(colors.white)
end

if outputInventory then
  emptyEstorageToOutput()
end

local function safe(fn, name)
  return function()
    local ok, err = pcall(fn)
    if not ok then
      printError("Error in " .. tostring(name) .. ": " .. tostring(err))
    end
  end
end

local function initCmd()
  cmd("klog-cli", "1.3.0", commands)
end


parallel.waitForAny(
  safe(initCmd, "initCmd"),
  safe(rescanItemLoop, "rescanItemLoop"),
  safe(incomingTransferLoop, "incomingTransferLoop"),
  safe(websocketListenerLoop, "websocketListenerLoop")
)

klog.close()
