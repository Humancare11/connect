const mongoose = require("mongoose");

const CATEGORY_IDS = [
  "general", "mental", "skin", "women", "men",
  "family", "weight", "chronic", "eeb", "sexual", "travel",
];

const DEFAULT_PRICES = {
  general:  6,
  mental:  15,
  skin:    11,
  women:   12,
  men:     10,
  family:   8,
  weight:  10,
  chronic: 18,
  eeb:     12,
  sexual:  10,
  travel:  11,
};

const categoryPricingSchema = new mongoose.Schema(
  {
    // A stable per-category identifier: either one of the 11 legacy
    // CATEGORY_IDS (pinned so the public GET /api/pricing response keys
    // never change for existing consumers) or a dynamically generated
    // HealthcareCategory.pricingSlug for any category created afterward.
    // No longer restricted to the fixed CATEGORY_IDS enum - shape is
    // validated instead, since pricing now scales to any category.
    categoryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: /^[a-z0-9-]+$/,
    },
    label: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      // The currency of `price` only (always USD). EUR and GBP prices live in
      // their own fields below; nothing is ever converted between them.
      type: String,
      default: "USD",
      enum: ["USD"],
    },
    // Optional until an admin enters them (older categories only have the USD
    // `price`). Once set they must stay a positive number: the API never
    // clears them, and this validator rejects a null/zero that slips through.
    priceEur: {
      type: Number,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "EUR price must be greater than 0.",
      },
    },
    priceGbp: {
      type: Number,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "GBP price must be greater than 0.",
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const CategoryPricing = mongoose.model("CategoryPricing", categoryPricingSchema);

const CATEGORY_LABELS = {
  general: "General & Everyday Care",
  mental:  "Mental Health",
  skin:    "Skin & Hair",
  women:   "Women's Health",
  men:     "Men's Health",
  family:  "Children & Family",
  weight:  "Weight & Nutrition",
  chronic: "Chronic Care & Expert Opinion",
  eeb:     "Eye, Ear & Bone",
  sexual:  "Sexual Health",
  travel:  "Travel & Global Care",
};

async function seedCategoryPricing() {
  for (const id of CATEGORY_IDS) {
    await CategoryPricing.updateOne(
      { categoryId: id },
      {
        $setOnInsert: {
          categoryId: id,
          label: CATEGORY_LABELS[id],
          price: DEFAULT_PRICES[id],
        },
      },
      { upsert: true },
    );
  }
}

module.exports = { CategoryPricing, seedCategoryPricing, CATEGORY_IDS };
