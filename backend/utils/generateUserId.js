const generateUserId = (role) => {
  const random = Math.random().toString(36).substring(2, 6)
  const time = Date.now().toString(36).slice(-2)

  const prefix = role === "vendor" ? "VEN" : role === "staff" ? "STF" : "CRT"

  return `${prefix}-${random}${time}`.toUpperCase()
}

module.exports = generateUserId
