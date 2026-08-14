const { CategoryPricing } = require("../models/CategoryPricing");
const HealthcareCategory = require("../models/HealthcareCategory");
const { slugify } = require("./slugify");

// Maps the 11 legacy category display names to the short CategoryPricing id
// they've always used. Price resolution itself now goes through
// HealthcareCategory.pricingSlug (see resolveEffectiveCategoryPrice below),
// which is reliable for any category including ones created after this
// list existed - this map's only remaining job is pinning those 11 legacy
// slugs during backfillCategoryPricingSlugs(), so GET /api/pricing's
// response keys (depended on by the static marketing pages) never move.
const CATEGORY_NAME_TO_ID = {
  "General & Everyday Care": "general",
  "Mental Health": "mental",
  "Skin & Hair": "skin",
  "Skin & Hair Care": "skin",
  "Women's Health": "women",
  "Men's Health": "men",
  "Children & Family": "family",
  "Children & Family Care": "family",
  "Weight & Nutrition": "weight",
  "Chronic Care & Expert Opinion": "chronic",
  "Eye, Ear & Bone": "eeb",
  "Sexual Health": "sexual",
  "Travel & Global Care": "travel",
};

// Fetches every CategoryPricing record once, for callers resolving prices
// for several categories at a time (e.g. the appointment tree), so the
// lookup is O(1) per category instead of one query each.
async function buildCategoryPricingLookup() {
  const records = await CategoryPricing.find({}, "categoryId price").lean();
  return new Map(records.map((record) => [record.categoryId, record]));
}

// Resolves the price that should actually be shown/charged for a
// HealthcareCategory, keyed by its stable `pricingSlug` (see the
// HealthcareCategory schema): the CategoryPricing record for that slug
// takes precedence when one exists and its price is a positive number;
// otherwise the category's own (legacy, no-longer-admin-editable) `price`
// field is used as a defensive fallback - this only matters for a category
// that somehow has no CategoryPricing row at all, which shouldn't happen
// given createCategory() and backfillCategoryPricingSlugs() both guarantee
// one, but costs nothing to keep as a safety net.
//
// The currency is always taken from the category (locked to "USD" by the
// HealthcareCategory schema), never from CategoryPricing - the booking UI's
// price formatting is USD-only, so accepting a different currency here
// would silently mislabel the amount actually charged.
//
// `pricingLookup` is an optional pre-built Map (see buildCategoryPricingLookup)
// for bulk callers; single-lookup callers may omit it.
// Logs every time resolveEffectiveCategoryPrice() has to fall through to
// the legacy HealthcareCategory.price field - this path is expected to be
// permanently unreachable now that createCategory() and
// backfillCategoryPricingSlugs() both guarantee a CategoryPricing row for
// every category, but it's silent otherwise. This is Phase D's
// verification signal: the Phase E schema removal is only safe once a real
// production traffic window shows zero occurrences of this warning.
function logFallbackPriceUsage(category, reason) {
  console.warn(
    `[categoryPricing] FALLBACK_PRICE_USED reason="${reason}" categoryId=${category?._id} ` +
      `name="${category?.name}" pricingSlug=${category?.pricingSlug || "(none)"}`,
  );
}

async function resolveEffectiveCategoryPrice(category, pricingLookup) {
  const fallbackPrice = Number.isFinite(Number(category?.price))
    ? Number(category.price)
    : 0;
  const currency = category?.currency || "USD";

  const pricingSlug = category?.pricingSlug;
  if (!pricingSlug) {
    logFallbackPriceUsage(category, "no_pricing_slug");
    return { price: fallbackPrice, currency };
  }

  const record = pricingLookup
    ? pricingLookup.get(pricingSlug)
    : await CategoryPricing.findOne({ categoryId: pricingSlug })
        .select("price")
        .lean();

  const overridePrice = Number(record?.price);
  if (Number.isFinite(overridePrice) && overridePrice > 0) {
    return { price: overridePrice, currency };
  }
  logFallbackPriceUsage(
    category,
    record ? "category_pricing_price_not_positive" : "no_category_pricing_record",
  );
  return { price: fallbackPrice, currency };
}

// Generates a HealthcareCategory.pricingSlug from a category name, appending
// a numeric suffix on collision so it's always unique. `session` (optional)
// threads a Mongo transaction through the uniqueness check so a category
// created concurrently within the same transaction is accounted for.
// Returns null if the name contains no slug-safe characters at all.
async function generateUniquePricingSlug(name, session) {
  const base = slugify(name);
  if (!base) return null;

  let candidate = base;
  // Bounded, not because collisions are expected, but so a pathological
  // input can never hang the request loop.
  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const query = HealthcareCategory.findOne({ pricingSlug: candidate })
      .select("_id")
      .lean();
    if (session) query.session(session);
    // eslint-disable-next-line no-await-in-loop
    const existing = await query;
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return null;
}

// One-time (idempotent, safe to run on every boot) backfill: assigns a
// pricingSlug to any HealthcareCategory that doesn't have one yet, and
// ensures a matching CategoryPricing record exists for it. The 11 legacy
// category names are pinned to their existing short CategoryPricing ids
// so GET /api/pricing's response keys - already depended on by name across
// the static marketing pages - never change. Categories outside that list
// (created before pricingSlug existed) get a freshly generated slug.
async function backfillCategoryPricingSlugs() {
  const categories = await HealthcareCategory.find({
    $or: [{ pricingSlug: { $exists: false } }, { pricingSlug: null }],
  });

  for (const category of categories) {
    const pinnedSlug = CATEGORY_NAME_TO_ID[category.name];
    // eslint-disable-next-line no-await-in-loop
    const slug = pinnedSlug || (await generateUniquePricingSlug(category.name));
    if (!slug) {
      console.error(
        `[categoryPricing] Could not derive a pricingSlug for category "${category.name}" (${category._id}) - skipping.`,
      );
      continue; // eslint-disable-line no-continue
    }

    category.pricingSlug = slug;
    try {
      // eslint-disable-next-line no-await-in-loop
      await category.save();
    } catch (err) {
      if (err?.code === 11000) {
        console.error(
          `[categoryPricing] pricingSlug "${slug}" collided while backfilling category ${category._id} - skipping this run.`,
        );
        continue; // eslint-disable-line no-continue
      }
      throw err;
    }

    const price = Number.isFinite(Number(category.price)) ? Number(category.price) : 0;
    // eslint-disable-next-line no-await-in-loop
    await CategoryPricing.updateOne(
      { categoryId: slug },
      {
        $setOnInsert: {
          categoryId: slug,
          label: category.name,
          price,
          currency: "USD",
        },
      },
      { upsert: true },
    );
  }
}

// Corrects any CategoryPricing record whose currency isn't "USD". Every
// consumer of CategoryPricing already treats its price as a USD amount
// (see resolveEffectiveCategoryPrice's currency comment above) - this only
// fixes stale/incorrect labels, it never changes a stored price number.
async function normalizeCategoryPricingCurrency() {
  await CategoryPricing.updateMany(
    { currency: { $ne: "USD" } },
    { $set: { currency: "USD" } },
  );
}

module.exports = {
  CATEGORY_NAME_TO_ID,
  buildCategoryPricingLookup,
  resolveEffectiveCategoryPrice,
  generateUniquePricingSlug,
  backfillCategoryPricingSlugs,
  normalizeCategoryPricingCurrency,
};
