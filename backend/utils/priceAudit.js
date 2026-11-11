// Who changed which Super Admin price, when, from what to what. Admin only: nothing here reaches a patient.
//
// recordActivity is the app's audit hook; it is currently a no-op by design (see utils/activityLogger.js), so each change is
// ALSO written as one structured line to the server log (pm2): the admin's id, the record and the before/after per currency.
// No patient data is involved.
const { recordActivity } = require("./activityLogger");

const FIELDS = ["price", "priceEur", "priceGbp", "priceInr"];
const CURRENCY_OF = { price: "USD", priceEur: "EUR", priceGbp: "GBP", priceInr: "INR" };

// { USD: { from, to }, EUR: ... } for the fields that differ between two records (either may be null for a create / delete).
function priceChanges(before, after) {
  const out = {};
  for (const field of FIELDS) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (from !== to) out[CURRENCY_OF[field]] = { from, to };
  }
  return out;
}

async function auditPriceChange(req, { action, resource, id, name = "", slug = "", changes }) {
  try {
    console.log(`[pricing-audit] ${JSON.stringify({ at: new Date().toISOString(), action, resource, id: String(id), slug, by: String(req?.user?.id || ""), changes })}`);
    await recordActivity(req, { action, resource, resourceId: String(id), success: true, details: { name, slug, changes } });
  } catch {
    /* an audit problem never blocks a price save */
  }
}

module.exports = { priceChanges, auditPriceChange };
