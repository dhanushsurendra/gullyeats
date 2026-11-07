const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // The menu item's names in each script, copied like name.
    names: { hi: String, kn: String, ta: String },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false } 
);

module.exports = OrderItemSchema;