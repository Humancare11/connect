const ConsultationNote = require("../models/ConsultationNote");
const { encryptFields, emptyFields } = require("./consultationNoteFields");

// Moves legacy single-text notes (`content`, plaintext) into the encrypted structured blob, as the "Note" field.
// Idempotent: only notes with no cipher blob are touched, and `content` is left in place (no data is ever removed).
// Status is not changed, so previously "final" notes stay as they were.
async function migrateConsultationNotes() {
  const cursor = ConsultationNote.find({ $or: [{ cipherText: "" }, { cipherText: { $exists: false } }], content: { $ne: "" } })
    .select("_id content")
    .lean()
    .cursor();
  let migrated = 0;
  for await (const note of cursor) {
    const result = await ConsultationNote.updateOne(
      { _id: note._id, $or: [{ cipherText: "" }, { cipherText: { $exists: false } }] },
      { $set: encryptFields({ ...emptyFields(), note: note.content }) },
    );
    migrated += result.modifiedCount;
  }
  return { migrated };
}

module.exports = { migrateConsultationNotes };
