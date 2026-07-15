const mongoose = require("mongoose");

const servicePriceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 120,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    icon: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { versionKey: false },
);

module.exports = mongoose.model("ServicePrice", servicePriceSchema);
