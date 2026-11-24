// READ-ONLY production health counts for Humancare Connect.
// It never writes, updates or deletes anything. It refuses to run unless the
// database user has ONLY a read role. The output file contains numbers,
// collection/index names, status codes and API paths only: no names, emails,
// phones, ids, medical text or bank data.
//
// Usage (Windows cmd, from the backend folder):
//   set "PROD_COUNTS_URI=<read-only connection string>"
//   node scripts\prodCounts.js
// Output: <your home folder>\db-prod-counts.json

const fs = require("fs");
const os = require("os");
const path = require("path");

let MongoClient;
try {
  ({ MongoClient } = require("mongodb"));
} catch {
  ({ MongoClient } = require("mongoose").mongo);
}

const URI = process.env.PROD_COUNTS_URI;
if (!URI) {
  console.error("Set PROD_COUNTS_URI first (read-only user).");
  process.exit(1);
}
const OUT = path.join(os.homedir(), "db-prod-counts.json");
const T = { maxTimeMS: 60000 };
const ALLOWED_ROLES = ["read", "readAnyDatabase"];

const nonEmpty = (f) => ({ [f]: { $exists: true, $nin: [null, "", []] } });
const anyNonEmpty = (fields) => ({ $or: fields.map(nonEmpty) });
const encrypted = { cipherText: { $exists: true, $nin: [null, ""] } };
const notEncrypted = { cipherText: { $in: [null, ""] } };

async function main() {
  const client = new MongoClient(URI, { readPreference: "secondaryPreferred" });
  await client.connect();
  const db = client.db();
  const C = (n) => db.collection(n);

  // Safety: only a read-only user may run this.
  const status = await db.admin().command({ connectionStatus: 1 });
  const roles = (status.authInfo?.authenticatedUserRoles || []).map((r) => r.role);
  const bad = roles.filter((r) => !ALLOWED_ROLES.includes(r));
  if (!roles.length || bad.length) {
    console.error("REFUSING TO RUN: the user must have only a read role. Found:", roles.join(", ") || "(none)");
    await client.close();
    process.exit(2);
  }
  console.log(`Connected read-only to database "${db.databaseName}". Counting...`);

  const out = { database: db.databaseName, generatedAt: new Date().toISOString(), roles };
  const safe = async (key, fn) => {
    process.stdout.write(`  ${key}... `);
    try {
      out[key] = await fn();
      console.log("ok");
    } catch (e) {
      out[key] = { error: e.codeName || e.message };
      console.log("skipped:", out[key].error);
    }
  };
  const count = (coll, filter = {}) => C(coll).countDocuments(filter, T);

  // 1. Collections, sizes, indexes
  await safe("collections", async () => {
    const list = await db.listCollections({}, { nameOnly: true }).toArray();
    const res = {};
    for (const { name } of list.sort((a, b) => a.name.localeCompare(b.name))) {
      const r = { count: await C(name).estimatedDocumentCount() };
      try {
        const s = await db.command({ collStats: name });
        r.dataMB = +(s.size / 1048576).toFixed(2);
        r.avgDocBytes = Math.round(s.avgObjSize || 0);
        r.indexMB = +(s.totalIndexSize / 1048576).toFixed(2);
      } catch {}
      try {
        r.indexes = (await C(name).indexes()).map((i) => i.name + (i.unique ? " (unique)" : "") + (i.expireAfterSeconds !== undefined ? " (ttl)" : ""));
      } catch {}
      res[name] = r;
    }
    return res;
  });

  // 2. Encryption of medical records
  const encCheck = async (coll, plainFields) => ({
    total: await count(coll),
    encryptedOnly: await count(coll, { ...encrypted, $nor: plainFields.map(nonEmpty) }),
    plainTextOnly: await count(coll, { ...notEncrypted, ...anyNonEmpty(plainFields) }),
    bothEncryptedAndPlain: await count(coll, { ...encrypted, ...anyNonEmpty(plainFields) }),
  });
  await safe("enc_prescriptions", () => encCheck("prescriptions", ["diagnosis", "instructions", "medicines"]));
  await safe("enc_medicalcertificates", () => encCheck("medicalcertificates", ["diagnosis", "notes", "recommendation"]));
  await safe("enc_consultationnotes", () => encCheck("consultationnotes", ["content"]));
  // ChatMessage has never had a plaintext field (cipherText from its first commit), so only count encrypted vs empty.
  await safe("enc_chatmessages", async () => ({ total: await count("chatmessages"), encrypted: await count("chatmessages", encrypted), withoutCipherText: await count("chatmessages", notEncrypted) }));
  await safe("enc_medicalreports", async () => ({ total: await count("medicalreports"), encrypted: await count("medicalreports", encrypted) }));

  // 3. Patient details copied onto appointments, plain PHI on users
  await safe("appointment_patient_copies", async () => ({
    total: await count("appointments"),
    withPhone: await count("appointments", nonEmpty("patientDetails.phone")),
    withEmail: await count("appointments", nonEmpty("patientDetails.email")),
    withDob: await count("appointments", nonEmpty("patientDetails.dob")),
  }));
  await safe("users_phi", async () => ({
    total: await count("users"),
    withMobile: await count("users", nonEmpty("mobile")),
    withDob: await count("users", nonEmpty("dob")),
  }));

  // 4. Doctor bank details readable as plain text
  await safe("enrollment_bank", async () => ({
    total: await count("enrollments"),
    accountNumberFilled: await count("enrollments", nonEmpty("accountNumber")),
    accountNumberPlainDigits: await count("enrollments", { accountNumber: { $regex: /^\s*\d{6,20}\s*$/ } }),
    ifscPlainFormat: await count("enrollments", { ifscCode: { $regex: /^\s*[A-Za-z]{4}0[A-Za-z0-9]{6}\s*$/ } }),
    paypalPlainEmail: await count("enrollments", { paypalId: { $regex: /@/ } }),
  }));

  // 5. Orphaned references
  const orphan = async (coll, field, targets, { str = false } = {}) => {
    const match = { [field]: { $nin: [null, ""] } };
    const p = [{ $match: match }];
    let local = field;
    if (str) {
      p.push({ $addFields: { __ref: { $convert: { input: `$${field}`, to: "objectId", onError: null, onNull: null } } } });
      local = "__ref";
    }
    // All lookups first, then ONE projection to sizes ($size on an already-projected number would error with 2+ targets).
    targets.forEach((t, i) => p.push({ $lookup: { from: t, localField: local, foreignField: "_id", as: `__m${i}` } }));
    p.push({ $project: { _id: 0, ...Object.fromEntries(targets.map((_, j) => [`__m${j}`, { $size: `$__m${j}` }])) } });
    p.push({ $match: Object.fromEntries(targets.map((_, i) => [`__m${i}`, 0])) }, { $count: "n" });
    const r = await C(coll).aggregate(p, T).toArray();
    return { withReference: await count(coll, match), orphans: r[0]?.n || 0 };
  };
  await safe("orphan_appointments_patient", () => orphan("appointments", "patientId", ["users"]));
  await safe("orphan_appointments_doctor", () => orphan("appointments", "doctorId", ["doctors"]));
  await safe("orphan_catcons_patient", () => orphan("categoryconsultations", "patientId", ["users"]));
  await safe("catcons_doctor_vs_enrollments", () => orphan("categoryconsultations", "assignedDoctorId", ["enrollments"]));
  await safe("catcons_doctor_vs_doctors", () => orphan("categoryconsultations", "assignedDoctorId", ["doctors"]));
  await safe("orphan_chat_sender", () => orphan("chatmessages", "senderId", ["users", "doctors"], { str: true }));
  await safe("orphan_prescriptions_appointment", () => orphan("prescriptions", "appointmentId", ["appointments", "categoryconsultations"]));
  await safe("orphan_payments_user", () => orphan("payments", "user", ["users"]));

  // 6. Audit log and security incidents
  await safe("auditlogs", async () => {
    const first = await C("auditlogs").find({}, { projection: { _id: 0, timestamp: 1 }, ...T }).sort({ timestamp: 1 }).limit(1).toArray();
    const last = await C("auditlogs").find({}, { projection: { _id: 0, timestamp: 1 }, ...T }).sort({ timestamp: -1 }).limit(1).toArray();
    const since = new Date(Date.now() - 400 * 86400000);
    const perMonth = await C("auditlogs").aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ], T).toArray();
    return {
      total: await count("auditlogs"),
      anonymousUnauthorized: await count("auditlogs", { userRole: "anonymous", "details.type": "unauthorized_access" }),
      firstEntry: first[0]?.timestamp || null,
      lastEntry: last[0]?.timestamp || null,
      perMonth: Object.fromEntries(perMonth.map((m) => [m._id, m.n])),
    };
  });
  const groupCount = async (coll, field, limit = 15) =>
    Object.fromEntries((await C(coll).aggregate([
      { $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: limit },
    ], T).toArray()).map((g) => [String(g._id), g.n]));
  await safe("securityincidents", async () => ({
    total: await count("securityincidents"),
    byStatus: await groupCount("securityincidents", "status"),
    // `resource` holds the raw request URL (can carry ids, emails or tokens in path/query). Raw values stay in memory only;
    // the output gets the path with query removed and ids/numbers/long tokens/emails replaced by placeholders.
    byResource: await (async () => {
      const raw = await C("securityincidents").aggregate([{ $group: { _id: "$resource", n: { $sum: 1 } } }], T).toArray();
      const norm = (u) => String(u || "").split("?")[0].split("#")[0].slice(0, 200)
        .replace(/[^/]*@[^/]*/g, ":email").replace(/[0-9a-f]{24}/gi, ":id")
        .replace(/\/\d+(?=\/|$)/g, "/:n").replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, "/:token");
      const merged = {};
      for (const g of raw) merged[norm(g._id)] = (merged[norm(g._id)] || 0) + g.n;
      return Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 10));
    })(),
  }));

  // 7. Status vocabularies and counters
  await safe("status_values", async () => ({
    appointments: await groupCount("appointments", "status"),
    categoryconsultations: await groupCount("categoryconsultations", "status"),
    enrollmentsApplication: await groupCount("enrollments", "applicationStatus"),
    enrollmentsApproval: await groupCount("enrollments", "approvalStatus"),
  }));
  await safe("counters", async () =>
    Object.fromEntries((await C("counters").find({}, { projection: { value: 1 }, ...T }).toArray()).map((c) => [String(c._id), c.value])));

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\nDone. Saved to ${OUT}`);
  await client.close();
}

main().catch((e) => {
  console.error("Failed:", e.codeName || e.message);
  process.exit(1);
});
