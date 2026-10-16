// READ-ONLY diagnostic:  npm run livechat:decrypt-check
//
// Counts, per chat, how many encrypted live-chat fields cannot be decrypted with the current key alone and with the
// current + previous keys (LIVECHAT_ENCRYPTION_KEY, LIVECHAT_ENCRYPTION_KEY_PREVIOUS). Prints only counts, chat codes and
// an 8-hex SHA-256 fingerprint of each configured key (to compare environments). Never prints a key, a message or
// any patient data, and never writes to the database (find/cursor reads only; no index or collection creation).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { parseLiveChatKey } = require("../utils/liveChat/config");
const { activeKey, previousKeys, keyFingerprint, tryDecryptLiveChatText } = require("../utils/liveChat/crypto");

async function main() {
  const configured = parseLiveChatKey(process.env.LIVECHAT_ENCRYPTION_KEY);
  const previous = previousKeys();
  const current = activeKey();
  console.log("Key fingerprints (first 8 hex of SHA-256):");
  console.log(`  current  LIVECHAT_ENCRYPTION_KEY           ${keyFingerprint(current)}${configured ? "" : "  (not set: derived from JWT_SECRET, development only)"}`);
  previous.forEach((key, i) => console.log(`  previous LIVECHAT_ENCRYPTION_KEY_PREVIOUS #${i + 1}  ${keyFingerprint(key)}`));
  if (!previous.length) console.log("  previous (none configured)");

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection;

  const perChat = new Map(); // conversationId -> { total, failCurrent, failAll }
  const note = (id, record) => {
    if (!record?.cipherText) return;
    const row = perChat.get(id) || { total: 0, failCurrent: 0, failAll: 0 };
    row.total += 1;
    if (!tryDecryptLiveChatText(record, [current]).ok) {
      row.failCurrent += 1;
      if (!tryDecryptLiveChatText(record, [current, ...previous]).ok) row.failAll += 1;
    }
    perChat.set(id, row);
  };

  for await (const m of db.collection("lcmessages").find({}, { projection: { conversationId: 1, text: 1, sourceText: 1, translations: 1 } })) {
    note(m.conversationId, m.text);
    note(m.conversationId, m.sourceText);
    for (const t of m.translations || []) note(m.conversationId, t.text);
  }
  for await (const c of db.collection("lcconversations").find({}, { projection: { conversationId: 1, contact: 1 } })) {
    for (const field of ["name", "email", "phone"]) note(c.conversationId, c.contact?.[field]);
  }
  for await (const f of db.collection("lcfiles").find({}, { projection: { conversationId: 1, name: 1 } })) note(f.conversationId, f.name);
  let visitors = { total: 0, failCurrent: 0, failAll: 0 };
  for await (const v of db.collection("lcvisitors").find({}, { projection: { name: 1, email: 1, phone: 1 } })) {
    for (const field of ["name", "email", "phone"]) {
      if (!v[field]?.cipherText) continue;
      visitors.total += 1;
      if (!tryDecryptLiveChatText(v[field], [current]).ok) {
        visitors.failCurrent += 1;
        if (!tryDecryptLiveChatText(v[field], [current, ...previous]).ok) visitors.failAll += 1;
      }
    }
  }

  const rows = [...perChat.entries()];
  const sum = (key) => rows.reduce((n, [, r]) => n + r[key], 0);
  console.log(`\nChats scanned: ${rows.length}; encrypted fields: ${sum("total")}`);
  console.log(`Fields failing with the current key only: ${sum("failCurrent")}`);
  console.log(`Fields failing with current + previous keys: ${sum("failAll")}`);
  console.log(`Visitor fields: ${visitors.total}; failing current only: ${visitors.failCurrent}; failing with all keys: ${visitors.failAll}`);
  const bad = rows.filter(([, r]) => r.failCurrent).sort((a, b) => b[1].failCurrent - a[1].failCurrent);
  console.log(`\nChats with at least one field the current key cannot read: ${bad.length}`);
  for (const [id, r] of bad.slice(0, 200)) console.log(`  ${id}  fields ${r.total}  fail(current) ${r.failCurrent}  fail(all keys) ${r.failAll}`);
  if (bad.length > 200) console.log(`  ... and ${bad.length - 200} more`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("livechat:decrypt-check failed:", String(err?.message || err).replace(/mongodb(\+srv)?:\/\/\S+/g, "[uri]"));
  process.exit(1);
});
