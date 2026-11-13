// Reading encrypted records for LISTS: one record that cannot be decrypted (wrong key, damaged data) must never make the whole list fail.
// The record comes back without its protected fields, marked unreadable, with a message the screens can show. Only the record id is logged,
// never any data.
const { decryptPHI } = require("./phiCrypto");

const UNREADABLE_MESSAGE = "This record can't be displayed right now. Please contact support.";

// -> { data } or { unreadable: true }
function tryDecryptPHI(doc, label = "record") {
  try {
    return { data: decryptPHI(doc) || {} };
  } catch {
    console.error(`[phi] ${label} ${doc && doc._id ? String(doc._id) : "(no id)"} cannot be decrypted with the current key`);
    return { unreadable: true };
  }
}

module.exports = { UNREADABLE_MESSAGE, tryDecryptPHI };
