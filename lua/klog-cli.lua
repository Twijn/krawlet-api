local g        = string.gsub
-- Compact sha256
sha256         = loadstring(g(
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

local apiUri = "https://api.krawlet.cc/v1/"
local updateDomain = "https://krawlet.cc/"

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
      printError("Failed to download " .. filename .. ": No response from server.")
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
      print((selectedIndex == i and ">" or " ") .. peripheral.getName(enderStorages[i]))
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
  return
else
  printError("No ender storages attached")
  return
end

local klog = createKlog(peripheral.getName(enderStorage), {
  apiKey = settings.get("klog.apiKey"),
})

local transferTargets = klog.getTransferTargets()

local items = {}

local function rescanItems()
  local newItems = {}
  for i, chest in pairs(klog.getInputChests()) do
    local chestItems = chest.list()
    for slot, item in pairs(chestItems) do
      newItems[item.name] = (newItems[item.name] or 0) + item.count
    end
  end
  items = newItems
end

local function getItemNames()
  local itemNames = {}
  for itemName, _ in pairs(items) do
    table.insert(itemNames, itemName)
  end
  return itemNames
end

local function runTransferWithEvents(opts, ctx)
  local transferResult = nil
  local transferErr = nil
  local runnerDone = false
  local sawTerminalEvent = false
  local defaultTextColor = term.getTextColor()
  local lastRenderedLines = 0
  local progress = {
    id = nil,
    status = "queued",
    quantity = opts.quantity,
    quantityTransferred = 0,
    error = nil,
    to = opts.to,
    itemName = opts.itemName,
  }

  local function clamp(value, minValue, maxValue)
    return math.max(minValue, math.min(maxValue, value))
  end

  local function clearAndHome()
    term.setCursorPos(1, 1)
    term.clear()
  end

  local function updateProgress(payload, status, errorMessage)
    if payload then
      progress.id = payload.id or progress.id
      progress.quantity = payload.quantity or progress.quantity
      progress.quantityTransferred = payload.quantityTransferred or progress.quantityTransferred
      progress.status = payload.status or status or progress.status
      progress.error = payload.error or errorMessage or progress.error
    else
      progress.status = status or progress.status
      progress.error = errorMessage or progress.error
    end
  end

  local function wrapText(text, width)
    local wrapped = {}
    local remaining = tostring(text or "")

    if width <= 0 then
      return { "" }
    end

    while #remaining > width do
      local chunk = remaining:sub(1, width)
      local breakPos = chunk:match("^.*() %S*$")

      if breakPos and breakPos > 1 then
        table.insert(wrapped, remaining:sub(1, breakPos - 1))
        remaining = remaining:sub(breakPos + 1)
      else
        table.insert(wrapped, chunk)
        remaining = remaining:sub(width + 1)
      end

      remaining = remaining:gsub("^%s+", "")
    end

    if #remaining > 0 then
      table.insert(wrapped, remaining)
    end

    if #wrapped == 0 then
      table.insert(wrapped, "")
    end

    return wrapped
  end

  local function renderProgressLine()
    local width, height = term.getSize()

    local barWidth = clamp(width - 40, 10, 28)
    local quantity = tonumber(progress.quantity) or 0
    local transferred = tonumber(progress.quantityTransferred) or 0
    local ratio = quantity > 0 and clamp(transferred / quantity, 0, 1) or 0
    local percent = quantity > 0 and math.floor(ratio * 100 + 0.5) or 0
    local filled = math.floor(ratio * barWidth)
    local bar = string.rep("#", filled) .. string.rep("-", barWidth - filled)

    local color = defaultTextColor
    if progress.status == "completed" then
      color = colors.lime
    elseif progress.status == "failed" then
      color = colors.red
    elseif progress.status == "cancelled" then
      color = colors.orange
    else
      color = colors.yellow
    end

    local countText = quantity > 0 and string.format("%d/%d", transferred, quantity) or string.format("%d/?", transferred)
    local statusText = progress.error and (progress.status .. ": " .. progress.error) or progress.status
    local headerText = string.format("[%s] %3d%% %s", bar, percent, countText)
    local idValue = progress.id
    if not idValue then
      idValue = (progress.status == "failed" or progress.status == "cancelled") and "not-assigned" or "pending"
    end
    local itemValue = progress.itemName or "any"
    local qtyValue = quantity > 0 and tostring(quantity) or "any"
    local idLine = string.format("id=%s to=%s", idValue, tostring(progress.to or "?"))
    local itemLine = string.format("item=%s qty=%s", itemValue, qtyValue)

    local lines = { headerText }
    local wrappedStatus = wrapText(statusText, width)
    for _, line in ipairs(wrappedStatus) do
      table.insert(lines, line)
    end
    table.insert(lines, idLine)
    table.insert(lines, itemLine)

    local maxRenderableLines = math.max(1, height - 1)
    if #lines > maxRenderableLines then
      local trimmed = {}
      for i = 1, maxRenderableLines do
        trimmed[i] = lines[i]
      end
      lines = trimmed
    end

    clearAndHome()
    term.setTextColor(color)
    for i, line in ipairs(lines) do
      local displayLine = line
      if #displayLine > width then
        displayLine = displayLine:sub(1, width)
      end
      term.setCursorPos(1, i)
      term.clearLine()
      write(displayLine)
    end

    for i = #lines + 1, lastRenderedLines do
      term.setCursorPos(1, i)
      term.clearLine()
    end

    lastRenderedLines = #lines

    term.setCursorPos(1, 1)
    term.setTextColor(defaultTextColor)
  end

  local function finishProgressLine()
    local _, height = term.getSize()
    local nextLine = clamp(lastRenderedLines + 1, 1, height)
    term.setTextColor(defaultTextColor)
    term.setCursorPos(1, nextLine)
  end

  local function transferRunner()
    transferResult, transferErr = klog.transfer(opts)
    runnerDone = true
    os.queueEvent("klog_cli_transfer_runner_done")
  end

  local function eventListener()
    updateProgress(nil, "queued", nil)
    renderProgressLine()

    while true do
      local event, payload = os.pullEvent()

      if event == "transfer_started" then
        updateProgress(payload, "started", nil)
        renderProgressLine()
      elseif event == "transfer_update" then
        updateProgress(payload, payload and payload.status or "updating", nil)
        renderProgressLine()
      elseif event == "transfer_completed" then
        updateProgress(payload, "completed", nil)
        renderProgressLine()
        sawTerminalEvent = true
      elseif event == "transfer_failed" then
        updateProgress(payload, "failed", (payload and payload.error) or "unknown error")
        renderProgressLine()
        sawTerminalEvent = true
      elseif event == "transfer_cancelled" then
        updateProgress(payload, "cancelled", payload and payload.error or nil)
        renderProgressLine()
        sawTerminalEvent = true
      elseif event == "klog_cli_transfer_runner_done" then
        runnerDone = true
      end

      if runnerDone and sawTerminalEvent then
        finishProgressLine()
        return
      end

      if runnerDone and transferResult == false and not sawTerminalEvent then
        updateProgress(nil, "failed", transferErr or "Unknown error")
        renderProgressLine()
        finishProgressLine()
        return
      end
    end
  end

  parallel.waitForAll(transferRunner, eventListener)

  if transferResult then
    if not sawTerminalEvent then
      ctx.succ("Transfer completed! ID:", transferResult.id)
    end
    return true
  end

  if not sawTerminalEvent then
    ctx.err("Transfer failed: " .. (transferErr or "Unknown error"))
  end
  return false
end

local commands = {
  transfer = {
    description = "Transfer items to another ender storage target",
    category = "general",
    usage = "transfer <target> <item> <quantity> [timeoutSeconds]",
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
      local timeout = args[4] and tonumber(args[4]) or nil
      if not target or not item then
        ctx.err("Usage: transfer <target> <item> [quantity] [timeoutSeconds]")
        return
      end

      if args[3] and (not quantity or quantity <= 0) then
        ctx.err("quantity must be a positive number")
        return
      end

      if args[4] and not timeout then
        ctx.err("timeoutSeconds must be a number")
        return
      end

      runTransferWithEvents({
        to = target,
        itemName = item,
        quantity = quantity,
        timeout = timeout,
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
    description = "List all items currently in input storages",
    category = "general",
    aliases = { "list", "ls" },
    execute = function(args, ctx)
      local p = ctx.pager("Items in Inputs")
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
      ctx.succ("Items updated!")
      ctx.mess("Please restart the program to apply updates.")
    end,
  }
}

parallel.waitForAny(
  function()
    while true do
      rescanItems()
      sleep(30)
    end
  end,
  function()
    cmd("klog-cli", "1.0.0", commands)
  end
)
