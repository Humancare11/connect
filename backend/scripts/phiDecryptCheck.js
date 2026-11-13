// READ-ONLY diagnostic:  npm run phi:decrypt-check
//
// Lists, per collection, how many encrypted records exist and the IDS of those that cannot be decrypted with the current PHI key
// (prescriptions, medical certificates, medical reports, visit notes, consultation reports and amendments, call transcript lines).
// Prints only counts, ids and an 8-hex fingerprint of the key in use. Never prints a key or any record content, and never writes to the
// database (cursor reads with a projection of the cipher envelope only; no index or collection creation).
const path = require("path");
const nodeEnv = process.env.NODE_ENV;
require("dotenv").config({ path: path.resolve(__dirname, "..", nodeEnv === "production" ? ".env.production" : nodeEnv === "uat" ? ".env.uat" : ".env"), quiet: true });
const mongoose = require("mongoose");
const { phiKeyStatus } = require("../utils/phiCrypto");
const { checkDocuments } = require("../utils/phiDecryptCheck");

const COLLECTIONS = [
  { label: "prescriptions", model: "Prescription" },
  { label: "medical certificates", model: "MedicalCertificate" },
  { label: "medical reports", model: "MedicalReport" },
  { label: "visit notes", model: "ConsultationNote" },
  { label: "consultation reports", model: "ConsultationReport" },
  { label: "report amendments", model: "ConsultationReportAmendment" },
  { label: "call transcript lines", model: "TranscriptSegment", envelope: (d) => d.enc, projection: { enc: 1 } },
];

async function main() {
  const status = phiKeyStatus();
  console.log(`PHI key in use: ${status.source === "configured" ? "PHI_ENCRYPTION_KEY" : status.source === "invalid" ? "JWT fallback (PHI_ENCRYPTION_KEY is set but invalid)" : "JWT fallback (PHI_ENCRYPTION_KEY not set)"}, fingerprint ${status.fingerprint}`);
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  let anyBad = false;
  for (const spec of COLLECTIONS) {
    const Model = require(`../models/${spec.model}`);
    const projection = spec.projection || { cipherText: 1, iv: 1, authTag: 1 };
    const cursor = mongoose.connection.db.collection(Model.collection.name).find({}, { projection });
    const { total, unreadable } = await checkDocuments(cursor, spec.envelope || ((d) => d));
    if (unreadable.length) anyBad = true;
    console.log(`\n${spec.label}: ${total} encrypted, ${unreadable.length} cannot be decrypted`);
    for (const id of unreadable) console.log(`  ${id}`);
  }
  console.log(anyBad ? "\nSome records cannot be read with this key. Nothing was changed." : "\nEvery encrypted record can be read with this key.");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("phi:decrypt-check failed:", error?.message || error);
  process.exit(1);
});
