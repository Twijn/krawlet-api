local enderStorage = "sc-goodies:ender_storage"

local clrs = {
  colors.white,
  colors.orange,
  colors.magenta,
  colors.lightBlue,
  colors.yellow,
  colors.lime,
  colors.pink,
  colors.gray,
  colors.lightGray,
  colors.cyan,
  colors.purple,
  colors.blue,
  colors.brown,
  colors.green,
  colors.red,
  colors.black,
}

local args = {...}

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

if turtle.getItemDetail(16) then
  error("Please clear slot 16 before running this program")
end

local color1 = args[1] and colors[args[1]:lower()] or nil
local color2 = args[2] and colors[args[2]:lower()] or nil
local color3 = args[3] and colors[args[3]:lower()] or nil

if args[1]:lower() == "emerald" then
  while true do
    selectItem(enderStorage)
    turtle.placeDown()
    sleep(0.25)
    peripheral.call("bottom", "setFrequency", colors.white, colors.white, colors.white)

    repeat
      sleep(0.25)
    until peripheral.call("bottom", "getOwner") and peripheral.call("bottom", "areComputerChangesEnabled")

    turtle.select(16)
    turtle.digDown()
    if turtle.detectUp() then
      turtle.dropUp()
    else
      turtle.drop()
    end
  end
  return
end

if not color1 or not color2 then
  printError("You must provide at least 2 colors as arguments, or 'emerald' to create private changeable frequencies. Valid colors are: white, orange, magenta, lightBlue, yellow, lime, pink, gray, lightGray, cyan, purple, blue, brown, green, red, black")
  return
end

local function configureColor(color3)
  selectItem(enderStorage)
  turtle.placeDown()
  sleep(0.25)
  peripheral.call("bottom", "setFrequency", color1, color2, color3)
  repeat
    sleep(0.25)
  until peripheral.call("bottom", "getOwner")
  turtle.select(16)
  turtle.digDown()
  if turtle.detectUp() then
    turtle.dropUp()
  else
    turtle.drop()
  end
end

local function run()
  if color3 then
    configureColor(color3)
  else
    for _, color in ipairs(clrs) do
      configureColor(color)
    end
  end
end

run()
