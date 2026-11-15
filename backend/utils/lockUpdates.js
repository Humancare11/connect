// Issued documents (Prescription, Medical Certificate) are write-once: once created they can never be changed
// through Mongoose, signed or not. Only UPDATES are blocked. Deletes stay allowed on purpose, because the
// retention job (jobs/retentionJobs.js) has to remove old records.
function lockAgainstUpdates(schema, label) {
  const locked = () => new Error(`${label} cannot be changed once issued.`);

  schema.pre("save", function () {
    if (!this.isNew) throw locked();
  });
  schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"], function () {
    throw locked();
  });
  // doc.updateOne(...) on a loaded document is a separate hook from Query#updateOne.
  schema.pre("updateOne", { document: true, query: false }, function () {
    throw locked();
  });
}

module.exports = { lockAgainstUpdates };
