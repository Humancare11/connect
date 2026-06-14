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
    categoryId: {
      type: String,
      required: true,
      unique: true,
      enum: CATEGORY_IDS,
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
      type: String,
      default: "USD",
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
