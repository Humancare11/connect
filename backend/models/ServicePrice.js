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
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
      maxlength: 120,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // `price` is the USD price. EUR / GBP / INR are entered by hand (nothing is converted from USD). They are optional so the
    // services created before multi-currency stay valid until they are priced; once set they must stay a positive number (the API
    // never clears them, and these validators reject a null / zero that slips through).
    priceEur: {
      type: Number,
      validate: { validator: (value) => Number.isFinite(value) && value > 0, message: "EUR price must be greater than 0." },
    },
    priceGbp: {
      type: Number,
      validate: { validator: (value) => Number.isFinite(value) && value > 0, message: "GBP price must be greater than 0." },
    },
    priceInr: {
      type: Number,
      validate: { validator: (value) => Number.isFinite(value) && value > 0, message: "INR price must be greater than 0." },
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
