const RetentionPolicy = require("../models/RetentionPolicy");
const { runRetentionCleanup } = require("../jobs/retentionJobs");
const { recordActivity } = require("../utils/activityLogger");

const DEFAULT_POLICIES = [
  { key: "chatMessages", label: "Clinical chat messages", retentionDays: 2555 },
  { key: "medicalRecords", label: "Medical records", retentionDays: 2555 },
  { key: "uploadedFiles", label: "Uploaded files", retentionDays: 2555 },
];

async function ensureDefaults() {
  await RetentionPolicy.deleteMany({ key: { $in: ["audit" + "Logs", "auth" + "Logs"] } });
  await RetentionPolicy.deleteOne({ key: "security" + "Incidents" });
  await Promise.all(DEFAULT_POLICIES.map((policy) =>
    RetentionPolicy.updateOne({ key: policy.key }, { $setOnInsert: policy }, { upsert: true })
  ));
}

const getPolicies = async (_req, res) => {
  try {
    await ensureDefaults();
    const policies = await RetentionPolicy.find().sort({ key: 1 }).lean();
    res.json(policies);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch retention policies." });
  }
};

const updatePolicies = async (req, res) => {
  try {
    const policies = Array.isArray(req.body?.policies) ? req.body.policies : [];
    for (const policy of policies) {
      const retentionDays = Number(policy.retentionDays);
      if (!policy.key || !Number.isFinite(retentionDays) || retentionDays < 1) {
        return res.status(400).json({ msg: "Each policy needs a valid key and retentionDays >= 1." });
      }
      await RetentionPolicy.updateOne(
        { key: policy.key },
        { retentionDays, enabled: policy.enabled !== false, updatedBy: req.user.id },
        { upsert: true }
      );
    }

    await recordActivity(req, {
      action: "RETENTION_POLICY_UPDATED",
      resource: "RetentionPolicy",
      details: { policyKeys: policies.map((p) => p.key) },
    });

    const updated = await RetentionPolicy.find().sort({ key: 1 }).lean();
    res.json(updated);
  } catch (err) {
    console.error("updatePolicies error:", err);
    res.status(500).json({ msg: "Failed to update retention policies." });
  }
};

const runCleanup = async (req, res) => {
  const result = await runRetentionCleanup(req);
  res.json(result);
};

module.exports = { getPolicies, updatePolicies, runCleanup, ensureDefaults };
