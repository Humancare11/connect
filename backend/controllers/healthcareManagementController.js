const mongoose = require("mongoose");
const HealthcareCategory = require("../models/HealthcareCategory");
const HealthcareSpecialty = require("../models/HealthcareSpecialty");
const HealthcareCondition = require("../models/HealthcareCondition");
const { CategoryPricing } = require("../models/CategoryPricing");
const {
  buildCategoryPricingLookup,
  resolveEffectiveCategoryPrice,
  generateUniquePricingSlug,
} = require("../utils/categoryPricing");

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseNonNegativeNumber(value, field, fallback = 0) {
  if (value === undefined || value === null || value === "") return { value: fallback };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return { error: `${field} must be a non-negative number.` };
  }
  return { value: number };
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function duplicateMessage(err, label) {
  if (err?.code === 11000) return `${label} already exists.`;
  return null;
}

function categoryPayload(body, partial = false) {
  const payload = {};
  const name = cleanString(body.name);
  if (!partial || body.name !== undefined) {
    if (!name) return { error: "Name is required." };
    payload.name = name;
  }
  if (body.icon !== undefined) payload.icon = cleanString(body.icon);
  if (body.description !== undefined) payload.description = cleanString(body.description);
  // Price is only accepted at creation, to seed the category's matching
  // CategoryPricing row (see createCategory). On update it's intentionally
  // never part of this payload - price is managed exclusively through
  // CategoryPricing via PUT /api/pricing/:categoryId, so a `price` sent
  // here on an update is silently ignored rather than written to the
  // (legacy, no-longer-authoritative) HealthcareCategory.price field.
  if (!partial) {
    const parsed = parseNonNegativeNumber(body.price, "Price");
    if (parsed.error) return { error: parsed.error };
    payload.price = parsed.value;
    payload.currency = "USD";
  }
  if (body.isActive !== undefined || !partial) {
    payload.isActive = parseBoolean(body.isActive, true);
  }
  return { payload };
}

function specialtyPayload(body, partial = false) {
  const payload = {};
  const categoryId = cleanString(body.categoryId);
  if (!partial || body.categoryId !== undefined) {
    if (!isObjectId(categoryId)) return { error: "Valid category is required." };
    payload.categoryId = categoryId;
  }
  const name = cleanString(body.name);
  if (!partial || body.name !== undefined) {
    if (!name) return { error: "Name is required." };
    payload.name = name;
  }
  if (body.icon !== undefined) payload.icon = cleanString(body.icon);
  if (body.description !== undefined) payload.description = cleanString(body.description);
  if (body.isActive !== undefined || !partial) {
    payload.isActive = parseBoolean(body.isActive, true);
  }
  return { payload };
}

function conditionPayload(body, partial = false) {
  const payload = {};
  const specialtyId = cleanString(body.specialtyId);
  if (!partial || body.specialtyId !== undefined) {
    if (!isObjectId(specialtyId)) return { error: "Valid specialty is required." };
    payload.specialtyId = specialtyId;
  }
  const name = cleanString(body.name);
  if (!partial || body.name !== undefined) {
    if (!name) return { error: "Name is required." };
    payload.name = name;
  }
  if (body.icon !== undefined) payload.icon = cleanString(body.icon);
  if (body.description !== undefined) payload.description = cleanString(body.description);
  if (body.isActive !== undefined || !partial) {
    payload.isActive = parseBoolean(body.isActive, true);
  }
  return { payload };
}

async function ensureCategory(categoryId) {
  const category = await HealthcareCategory.findById(categoryId).select("_id").lean();
  return Boolean(category);
}

async function ensureSpecialty(specialtyId) {
  const specialty = await HealthcareSpecialty.findById(specialtyId).select("_id").lean();
  return Boolean(specialty);
}

async function listCategories(_req, res) {
  try {
    const [categories, pricingLookup] = await Promise.all([
      HealthcareCategory.find().select("-displayOrder").sort({ name: 1 }).lean(),
      buildCategoryPricingLookup(),
    ]);

    // `price`/`currency` are overwritten with the resolved effective value
    // (CategoryPricing override, falling back to the category's own price)
    // so the admin table and edit form always show the same number the
    // booking flow actually uses - never the raw, possibly-stale field.
    const enrichedCategories = await Promise.all(
      categories.map(async (category) => {
        const { price, currency } = await resolveEffectiveCategoryPrice(
          category,
          pricingLookup,
        );
        return { ...category, price, currency };
      }),
    );

    res.json(enrichedCategories);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch categories." });
  }
}

async function createCategory(req, res) {
  const { payload, error } = categoryPayload(req.body);
  if (error) return res.status(400).json({ msg: error });

  const pricingSlug = await generateUniquePricingSlug(payload.name);
  if (!pricingSlug) {
    return res.status(400).json({
      msg: "Could not derive a valid pricing identifier from this category name - please include at least one letter or number.",
    });
  }

  // Created together, in one transaction, so a category can never exist
  // without a matching CategoryPricing record (or vice versa).
  const session = await mongoose.startSession();
  try {
    let category;
    await session.withTransaction(async () => {
      const [created] = await HealthcareCategory.create(
        [{ ...payload, pricingSlug }],
        { session },
      );
      category = created;

      await CategoryPricing.create(
        [
          {
            categoryId: pricingSlug,
            label: payload.name,
            price: payload.price,
            currency: payload.currency,
            updatedBy: req.user?.id,
          },
        ],
        { session },
      );
    });

    res.status(201).json({ msg: "Category created.", category });
  } catch (err) {
    res.status(err?.code === 11000 ? 409 : 500).json({ msg: duplicateMessage(err, "Category") || "Failed to create category." });
  } finally {
    session.endSession();
  }
}

async function updateCategory(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid category ID." });
  const { payload, error } = categoryPayload(req.body, true);
  if (error) return res.status(400).json({ msg: error });
  try {
    const category = await HealthcareCategory.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ msg: "Category not found." });
    res.json({ msg: "Category updated.", category });
  } catch (err) {
    res.status(err?.code === 11000 ? 409 : 500).json({ msg: duplicateMessage(err, "Category") || "Failed to update category." });
  }
}

async function deleteCategory(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid category ID." });
  try {
    const category = await HealthcareCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ msg: "Category not found." });
    const specialties = await HealthcareSpecialty.find({ categoryId: req.params.id }).select("_id").lean();
    const specialtyIds = specialties.map((specialty) => specialty._id);
    await HealthcareCondition.deleteMany({ specialtyId: { $in: specialtyIds } });
    await HealthcareSpecialty.deleteMany({ categoryId: req.params.id });
    if (category.pricingSlug) {
      await CategoryPricing.deleteOne({ categoryId: category.pricingSlug });
    }
    res.json({ msg: "Category deleted." });
  } catch (err) {
    res.status(500).json({ msg: "Failed to delete category." });
  }
}

async function listSpecialties(_req, res) {
  try {
    const specialties = await HealthcareSpecialty.find()
      .select("-doctorCount -displayOrder")
      .populate("categoryId", "name icon isActive")
      .sort({ name: 1 })
      .lean();
    res.json(specialties);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch specialties." });
  }
}

async function createSpecialty(req, res) {
  const { payload, error } = specialtyPayload(req.body);
  if (error) return res.status(400).json({ msg: error });
  if (!(await ensureCategory(payload.categoryId))) return res.status(404).json({ msg: "Category not found." });
  try {
    const specialty = await HealthcareSpecialty.create(payload);
    const populated = await specialty.populate("categoryId", "name icon isActive");
    res.status(201).json({ msg: "Specialty created.", specialty: populated });
  } catch (err) {
    res.status(err?.code === 11000 ? 409 : 500).json({ msg: duplicateMessage(err, "Specialty") || "Failed to create specialty." });
  }
}

async function updateSpecialty(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid specialty ID." });
  const { payload, error } = specialtyPayload(req.body, true);
  if (error) return res.status(400).json({ msg: error });
  if (payload.categoryId && !(await ensureCategory(payload.categoryId))) return res.status(404).json({ msg: "Category not found." });
  try {
    const specialty = await HealthcareSpecialty.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate("categoryId", "name icon isActive");
    if (!specialty) return res.status(404).json({ msg: "Specialty not found." });
    res.json({ msg: "Specialty updated.", specialty });
  } catch (err) {
    res.status(err?.code === 11000 ? 409 : 500).json({ msg: duplicateMessage(err, "Specialty") || "Failed to update specialty." });
  }
}

async function deleteSpecialty(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid specialty ID." });
  try {
    const specialty = await HealthcareSpecialty.findByIdAndDelete(req.params.id);
    if (!specialty) return res.status(404).json({ msg: "Specialty not found." });
    await HealthcareCondition.deleteMany({ specialtyId: req.params.id });
    res.json({ msg: "Specialty deleted." });
  } catch (err) {
    res.status(500).json({ msg: "Failed to delete specialty." });
  }
}

async function listConditions(_req, res) {
  try {
    const conditions = await HealthcareCondition.find()
      .populate({
        path: "specialtyId",
        select: "name icon isActive categoryId",
        populate: { path: "categoryId", select: "name icon isActive" },
      })
      .sort({ name: 1 })
      .lean();
    res.json(conditions);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch conditions." });
  }
}

async function createCondition(req, res) {
  const { payload, error } = conditionPayload(req.body);
  if (error) return res.status(400).json({ msg: error });
  if (!(await ensureSpecialty(payload.specialtyId))) return res.status(404).json({ msg: "Specialty not found." });
  try {
    const condition = await HealthcareCondition.create(payload);
    const populated = await condition.populate({
      path: "specialtyId",
      select: "name icon isActive categoryId",
      populate: { path: "categoryId", select: "name icon isActive" },
    });
    res.status(201).json({ msg: "Condition created.", condition: populated });
  } catch (err) {
    res.status(err?.code === 11000 ? 409 : 500).json({ msg: duplicateMessage(err, "Condition") || "Failed to create condition." });
  }
}

async function updateCondition(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid condition ID." });
  const { payload, error } = conditionPayload(req.body, true);
  if (error) return res.status(400).json({ msg: error });
  if (payload.specialtyId && !(await ensureSpecialty(payload.specialtyId))) return res.status(404).json({ msg: "Specialty not found." });
  try {
    const condition = await HealthcareCondition.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate({
        path: "specialtyId",
        select: "name icon isActive categoryId",
        populate: { path: "categoryId", select: "name icon isActive" },
      });
    if (!condition) return res.status(404).json({ msg: "Condition not found." });
    res.json({ msg: "Condition updated.", condition });
  } catch (err) {
    res.status(err?.code === 11000 ? 409 : 500).json({ msg: duplicateMessage(err, "Condition") || "Failed to update condition." });
  }
}

async function deleteCondition(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid condition ID." });
  try {
    const condition = await HealthcareCondition.findByIdAndDelete(req.params.id);
    if (!condition) return res.status(404).json({ msg: "Condition not found." });
    res.json({ msg: "Condition deleted." });
  } catch (err) {
    res.status(500).json({ msg: "Failed to delete condition." });
  }
}

async function getAppointmentTree(_req, res) {
  try {
    const [categories, specialties, conditions, pricingLookup] = await Promise.all([
      HealthcareCategory.find({ isActive: true }).sort({ name: 1 }).lean(),
      HealthcareSpecialty.find({ isActive: true }).sort({ name: 1 }).lean(),
      HealthcareCondition.find({ isActive: true }).sort({ name: 1 }).lean(),
      buildCategoryPricingLookup(),
    ]);

    const conditionsBySpecialty = conditions.reduce((map, condition) => {
      const key = String(condition.specialtyId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(condition);
      return map;
    }, new Map());

    const specialtiesByCategory = specialties.reduce((map, specialty) => {
      const key = String(specialty.categoryId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        _id: specialty._id,
        name: specialty.name,
        icon: specialty.icon,
        description: specialty.description,
        isActive: specialty.isActive,
        conditions: conditionsBySpecialty.get(String(specialty._id)) || [],
      });
      return map;
    }, new Map());

    const enrichedCategories = await Promise.all(
      categories.map(async (category) => {
        const { price, currency } = await resolveEffectiveCategoryPrice(
          category,
          pricingLookup,
        );
        return {
          _id: category._id,
          name: category.name,
          icon: category.icon,
          description: category.description,
          price,
          currency,
          isActive: category.isActive,
          specialties: specialtiesByCategory.get(String(category._id)) || [],
        };
      }),
    );

    res.json(enrichedCategories);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch appointment tree." });
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
  getAppointmentTree,
};
