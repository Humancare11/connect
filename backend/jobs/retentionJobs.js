const ChatMessage = require("../models/ChatMessage");
const Prescription = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const RetentionPolicy = require("../models/RetentionPolicy");
const { recordActivity } = require("../utils/activityLogger");
const { deleteUploadsOlderThan } = require("../utils/uploadStorage");
const { deleteObject } = require("../utils/visitNoteStorage");

function cutoff(days) {
  return new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
}

// Signed prescriptions / certificates own a private S3 copy of the doctor's signature. When their rows are deleted
// the copies go too. An S3 failure is logged and never stops the job (the object is just left behind).
async function deleteSignatureCopies(keys) {
  let deleted = 0;
  for (const key of keys) {
    try {
      await deleteObject(key);
      deleted += 1;
    } catch (err) {
      console.error("retention: could not delete signature copy", key, err?.message);
    }
  }
  return deleted;
}

async function runRetentionCleanup(req = null) {
  const policies = await RetentionPolicy.find({ enabled: true }).lean();
  const byKey = Object.fromEntries(policies.map((policy) => [policy.key, policy]));
  const result = {};

  if (byKey.chatMessages) {
    const deleted = await ChatMessage.deleteMany({ createdAt: { $lt: cutoff(byKey.chatMessages.retentionDays) } });
    result.chatMessages = deleted.deletedCount || 0;
  }

  if (byKey.medicalRecords) {
    const olderThan = cutoff(byKey.medicalRecords.retentionDays);
    const filter = { createdAt: { $lt: olderThan } };
    // Collect the signature keys first, delete the rows, and only then the S3 copies.
    const withSignature = { ...filter, signatureKey: { $exists: true, $ne: "" } };
    const [rxSigned, certSigned] = await Promise.all([
      Prescription.find(withSignature).select("signatureKey").lean(),
      MedicalCertificate.find(withSignature).select("signatureKey").lean(),
    ]);
    const [prescriptions, certificates] = await Promise.all([
      Prescription.deleteMany(filter),
      MedicalCertificate.deleteMany(filter),
    ]);
    result.medicalRecords = (prescriptions.deletedCount || 0) + (certificates.deletedCount || 0);
    result.medicalSignatureFiles = await deleteSignatureCopies([...rxSigned, ...certSigned].map((d) => d.signatureKey));
  }

  if (byKey.uploadedFiles) {
    const olderThan = cutoff(byKey.uploadedFiles.retentionDays);
    result.uploadedFiles = await deleteUploadsOlderThan(olderThan);
  }

  // Website live chat has its own policy and its own collections (Lc*); it runs even when the module is switched off.
  if (byKey.liveChat) {
    const { runLiveChatRetention } = require("../services/liveChat/retention");
    const liveChat = await runLiveChatRetention({ cutoff: cutoff(byKey.liveChat.retentionDays) });
    result.liveChat = liveChat.chats + liveChat.contacts;
    result.liveChatDetail = liveChat;
  }

  // Super Admin Trash: chats deleted 30+ days ago are purged for good (always, like the live-chat retention).
  try {
    const { createTrashService } = require("../services/liveChat/trashService");
    const models = {
      LcConversation: require("../models/LcConversation"),
      LcMessage: require("../models/LcMessage"),
      LcFile: require("../models/LcFile"),
      LcPageVisit: require("../models/LcPageVisit"),
      LcVisitor: require("../models/LcVisitor"),
      LcChatDeletionAudit: require("../models/LcChatDeletionAudit"),
    };
    const trashPurge = await createTrashService({ models, archive: null }).autoPurge();
    result.liveChatTrash = trashPurge.deleted;
  } catch (err) {
    console.error("live chat trash purge error:", err);
  }

  await recordActivity(req, {
    action: "RETENTION_CLEANUP_RUN",
    resource: "RetentionPolicy",
    details: result,
  });

  return { msg: "Retention cleanup completed.", deleted: result };
}

function scheduleRetentionCleanup() {
  const intervalMs = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runRetentionCleanup().catch((err) => console.error("retention cleanup error:", err));
  }, intervalMs).unref();
}

module.exports = { runRetentionCleanup, scheduleRetentionCleanup };
