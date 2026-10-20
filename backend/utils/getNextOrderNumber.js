const Counter = require('../models/Counter')

async function getNextOrderNumber(cartId) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date())

  const counter = await Counter.findByIdAndUpdate(
    `cart-${cartId}-${today}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )

  return {
    orderNumber: counter.seq,
  }
}

module.exports = getNextOrderNumber