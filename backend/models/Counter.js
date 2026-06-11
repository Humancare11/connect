const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true },
    value: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Counter", counterSchema);
