// Read-only report: what the live chat AI quotes now (from the Super Admin pricing) against the old manual "Prices the AI may
// quote" list, plus every typed price left in the Business facts and the quick-option replies.
//
// It NEVER writes: it only reads ServicePrice, HealthcareCategory, CategoryPricing and the live chat settings document.
// Nothing is changed or deleted; the old manual list stays stored (and ignored) in the database.
//
// Usage (from backend/):   node scripts/liveChatPriceReport.js
// It reads the database in the environment's .env file (.env.production when NODE_ENV=production). Exit code 1 when something needs
// attention (a mismatch, a missing price or a typed price), 0 when everything agrees.
const path = require("path");
const mongoose = require("mongoose");
const { AI_SERVICES, createLivePrices } = require("../services/liveChat/livePrices");
const { amountsIn } = require("../services/liveChat/priceMode");

const pad = (text, n) => String(text).padEnd(n);

// Builds the report from plain data (tested without a database).
//   live: { USD: [{ key, text, amount, currency }], EUR: [...], ... }   legacy: [{ name, price }]
function buildReport({ live, legacy = [], businessFacts = "", quickOptions = [] }) {
  const rows = AI_SERVICES.map((def) => {
    const old = legacy.find((p) => String(p.name).trim().toLowerCase() === def.name.toLowerCase());
    const byCurrency = {};
    for (const code of ["USD", "EUR", "GBP", "INR"]) byCurrency[code] = (live[code] || []).find((i) => i.key === def.key) || null;
    const usd = byCurrency.USD;
    let status = "ok";
    if (!usd) status = "NO PRICE (the AI quotes nothing for it)";
    else if (old && Math.abs(Number(old.price) - usd.amount) >= 0.005) status = `DIFFERENT (old list $${old.price})`;
    else if (!old) status = "not in the old list";
    return { def, old, byCurrency, status };
  });
  const knownNames = new Set(AI_SERVICES.map((d) => d.name.toLowerCase()));
  const legacyOnly = legacy.filter((p) => !knownNames.has(String(p.name).trim().toLowerCase()));
  const typed = [];
  if (amountsIn(businessFacts).length) typed.push({ where: "Business facts", amounts: amountsIn(businessFacts).map((a) => a.value) });
  quickOptions.forEach((o) => {
    if (amountsIn(o.reply).length) typed.push({ where: `Quick option "${o.key}" reply`, amounts: amountsIn(o.reply).map((a) => a.value) });
  });
  const attention = rows.filter((r) => r.status !== "ok").length + typed.length + legacyOnly.length;
  return { rows, legacyOnly, typed, attention };
}

function print(report) {
  console.log("\nAI service                    Source                                  USD       EUR       GBP       INR       Status");
  for (const r of report.rows) {
    const cell = (code) => (r.byCurrency[code] ? r.byCurrency[code].text + (r.byCurrency[code].currency !== code ? "*" : "") : "-");
    console.log(
      `${pad(r.def.name, 29)} ${pad(`${r.def.source}:${r.def.ref}`, 39)} ${pad(cell("USD"), 9)} ${pad(cell("EUR"), 9)} ${pad(cell("GBP"), 9)} ${pad(cell("INR"), 9)} ${r.status}`,
    );
  }
  console.log("(* = that currency has no price yet, so checkout charges the USD price)");
  if (report.legacyOnly.length) {
    console.log("\nIn the old manual list only (no Super Admin record is mapped to them; the AI no longer quotes them):");
    report.legacyOnly.forEach((p) => console.log(`  - ${p.name}: $${p.price}`));
  }
  if (report.typed.length) {
    console.log("\nPrices typed into free text (they can go stale; use {price:key} in quick replies, remove them from Business facts):");
    report.typed.forEach((t) => console.log(`  - ${t.where}: ${t.amounts.join(", ")}`));
  }
  console.log(report.attention ? `\n${report.attention} item(s) need attention.` : "\nEverything agrees.");
}

async function main() {
  require("dotenv").config({ path: path.resolve(__dirname, "..", process.env.NODE_ENV === "production" ? ".env.production" : ".env") });
  await require("../config/db")();
  console.log(`Live chat price report - ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}   Database: ${mongoose.connection.name} on ${mongoose.connection.host}   (read-only)`);

  const livePrices = createLivePrices({ ttlMs: 0 });
  const live = {};
  for (const code of ["USD", "EUR", "GBP", "INR"]) live[code] = await livePrices.forCurrency(code);
  const settings = await require("../models/LcSettings").findOne({ key: "default" }).lean();
  const report = buildReport({ live, legacy: settings?.prices || [], businessFacts: settings?.businessFacts || "", quickOptions: settings?.quickOptions || [] });
  print(report);
  return report.attention ? 1 : 0;
}

if (require.main === module) {
  main()
    .then(async (code) => {
      await mongoose.disconnect();
      process.exit(code);
    })
    .catch((err) => {
      console.error("liveChatPriceReport failed:", err);
      process.exit(1);
    });
}

module.exports = { buildReport };
