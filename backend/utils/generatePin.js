const { randomInt } = require('crypto')

// Cryptographically random 4-digit PIN (1000–9999).
const generatePin = () => String(randomInt(1000, 10000))

module.exports = generatePin
