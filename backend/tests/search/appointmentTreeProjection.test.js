// PR1 guard: /api/appointment-tree must keep projecting conditions to the
// explicit public allowlist, even now that PR2 added internal fields.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

const HealthcareCategory = require("../../models/HealthcareCategory");
const HealthcareSpecialty = require("../../models/HealthcareSpecialty");
const HealthcareCondition = require("../../models/HealthcareCondition");
const { CategoryPricing } = require("../../models/CategoryPricing");
const { getAppointmentTree } = require("../../controllers/healthcareManagementController");

const PUBLIC_CONDITION_FIELDS = "_id specialtyId name icon description isActive";

// Emulates MongoDB inclusion projection for the stubbed queries.
function project(docs, fields) {
  if (!fields) return docs;
  const keep = fields.split(/\s+/);
  return docs.map((doc) => Object.fromEntries(Object.entries(doc).filter(([k]) => keep.includes(k))));
}

function stubFind(model, docs, captured) {
  const original = model.find;
  model.find = () => {
    let fields;
    const query = {
      select(f) { fields = f; captured[model.modelName] = f; return query; },
      sort() { return query; },
      lean: async () => project(docs, fields),
    };
    return query;
  };
  return () => { model.find = original; };
}

test("appointment-tree condition projection is unchanged and hides PR2 fields", async () => {
  const catId = new mongoose.Types.ObjectId();
  const specId = new mongoose.Types.ObjectId();
  const captured = {};
  const restore = [
    stubFind(HealthcareCategory, [{ _id: catId, name: "Skin & Hair", icon: "", description: "", isActive: true, pricingSlug: "skin", price: 11 }], captured),
    stubFind(HealthcareSpecialty, [{ _id: specId, categoryId: catId, name: "Dermatology", icon: "", description: "", isActive: true, aliases: ["skin doctor"] }], captured),
    stubFind(HealthcareCondition, [{
      _id: new mongoose.Types.ObjectId(), specialtyId: specId, name: "Acne", icon: "", description: "", isActive: true,
      aliases: ["pimples"], kind: "condition", legacyId: "acne", slug: "acne", route: "/acne",
      createdAt: new Date(), updatedAt: new Date(), __v: 0,
    }], captured),
  ];
  const originalPricingFind = CategoryPricing.find;
  CategoryPricing.find = () => ({ lean: async () => [{ categoryId: "skin", price: 11 }] });

  try {
    const body = await new Promise((resolve, reject) => {
      getAppointmentTree({}, {
        status() { return this; },
        json: (payload) => resolve(JSON.parse(JSON.stringify(payload))),
      }).catch(reject);
    });

    assert.equal(captured.HealthcareCondition, PUBLIC_CONDITION_FIELDS);
    const specialty = body[0].specialties[0];
    assert.deepEqual(Object.keys(specialty).sort(), ["_id", "conditions", "description", "icon", "isActive", "name"]);
    assert.deepEqual(
      Object.keys(specialty.conditions[0]).sort(),
      ["_id", "description", "icon", "isActive", "name", "specialtyId"],
    );
    assert.deepEqual(Object.keys(body[0]).sort(), ["_id", "currency", "description", "icon", "isActive", "name", "price", "specialties"]);
  } finally {
    restore.forEach((fn) => fn());
    CategoryPricing.find = originalPricingFind;
  }
});
