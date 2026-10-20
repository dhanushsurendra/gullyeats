const mongoose = require('mongoose')

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  cartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
    required: true,
  },
  seq: { type: Number, default: 0 },
})

module.exports = mongoose.model('Counter', CounterSchema)
