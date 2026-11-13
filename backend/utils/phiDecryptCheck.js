// Counts records that cannot be decrypted with the current PHI key. Pure logic over any async iterable of documents (tested without a database).
// Returns ids only; never any decrypted or encrypted content.
const { decryptPHI } = require("./phiCrypto");

// envelopeOf(doc) -> the { cipherText, iv, authTag } object of the record, or null when it holds nothing encrypted (old plaintext data, gaps).
async function checkDocuments(docs, envelopeOf) {
  const result = { total: 0, unreadable: [] };
  for await (const doc of docs) {
    const envelope = envelopeOf(doc);
    if (!envelope || !envelope.cipherText) continue;
    result.total += 1;
    try {
      decryptPHI(envelope);
    } catch {
      result.unreadable.push(String(doc._id));
    }
  }
  return result;
}

module.exports = { checkDocuments };
