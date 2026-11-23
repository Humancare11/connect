const crypto = require("crypto");
const EmailSignature = require("../../models/EmailSignature");
const MarketingCampaign = require("../../models/MarketingCampaign");
const MarketingSignatureCopy = require("../../models/MarketingSignatureCopy");
const { newToken, hashToken, isTokenShape } = require("../email/trackingToken");
const { displaySize } = require("../../utils/signatureDisplay");

// Signature in marketing mail. The image is the SENDING admin's (decided by the verified session, never the request).
// It is HOSTED, not attached: a campaign owns a copy (marketing-signatures/<campaignId>/...) made when it starts, so a
// later change or deletion of the admin's own signature cannot affect it; a test mail gets a temporary copy
// (marketing-signatures/test/...) that expires after 7 days. Both are served by routes/publicMarketingSignature.js,
// which is not part of open or click tracking.

const CAMPAIGN_PREFIX = "marketing-signatures";
const TEST_PREFIX = "marketing-signatures/test";
const TEST_TTL_MS = 7 * 24 * 3600 * 1000;
const EXT = { "image/png": "png", "image/jpeg": "jpg" };

const randomName = (mime) => `${crypto.randomBytes(12).toString("hex")}.${EXT[mime] || "png"}`;
const sigUrl = (baseUrl, token) => `${baseUrl}/api/m/sig/${token}`;

// The admin's own signature image record, or null.
async function loadOwnSignature(ownerId) {
  const row = await EmailSignature.findOne({ owner: ownerId }).lean();
  return { image: row?.image || null, autoAdd: row ? row.autoAdd !== false : true };
}

// What a mail needs to draw the image: { url, width, height } (display size, like the Email page).
const asBlock = (url, image) => {
  const shown = displaySize(image.width, image.height);
  return { url, width: shown.width, height: shown.height };
};

// Copies the sender's current image to a key this campaign owns. → the snapshot to store, or null when there is no image.
async function snapshotForCampaign({ campaignId, ownerId, store }) {
  const { image } = await loadOwnSignature(ownerId);
  if (!image) return null;
  const bytes = await store.get(image.key);
  const key = `${CAMPAIGN_PREFIX}/${campaignId}/${randomName(image.mime)}`;
  await store.put(key, bytes, image.mime);
  return { token: newToken().token, key, mime: image.mime, width: image.width, height: image.height };
}

async function removeCampaignSignature(campaign, store) {
  if (!campaign?.signature?.key) return;
  try {
    await store.remove(campaign.signature.key);
  } catch (err) {
    console.error("[marketing] could not remove a signature copy:", err?.name || "error");
  }
}

// A temporary hosted copy for a test mail. → { url, width, height } | null (no image)
async function createTestCopy({ ownerId, store, baseUrl, now = new Date() }) {
  const { image } = await loadOwnSignature(ownerId);
  if (!image) return null;
  const bytes = await store.get(image.key);
  const key = `${TEST_PREFIX}/${randomName(image.mime)}`;
  await store.put(key, bytes, image.mime);
  const t = newToken();
  try {
    await MarketingSignatureCopy.create({
      tokenHash: t.hash,
      key,
      mime: image.mime,
      width: image.width,
      height: image.height,
      expiresAt: new Date(now.getTime() + TEST_TTL_MS),
    });
  } catch (err) {
    await store.remove(key).catch(() => {});
    throw err;
  }
  return asBlock(sigUrl(baseUrl, t.token), image);
}

// The block for a campaign that already has its snapshot (real mails).
const campaignBlock = (campaign, baseUrl) =>
  campaign?.signature?.token ? asBlock(sigUrl(baseUrl, campaign.signature.token), campaign.signature) : null;

// For the preview only: the image inline as a data: URI, because a draft has no public copy yet. Never used in a sent mail.
async function previewBlock({ ownerId, store }) {
  const { image } = await loadOwnSignature(ownerId);
  if (!image) return null;
  const bytes = await store.get(image.key);
  return asBlock(`data:${image.mime};base64,${bytes.toString("base64")}`, image);
}

// Public lookup by token: a campaign's snapshot, else an unexpired test copy. → { key, mime } | null
async function findHostedByToken(token, now = new Date()) {
  if (!isTokenShape(token)) return null;
  const campaign = await MarketingCampaign.findOne({ "signature.token": token }).select("signature").lean();
  if (campaign?.signature) return { key: campaign.signature.key, mime: campaign.signature.mime };
  const copy = await MarketingSignatureCopy.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: now }, removedAt: null })
    .select("key mime")
    .lean();
  return copy ? { key: copy.key, mime: copy.mime } : null;
}

// Daily: remove the stored image of test copies that expired. → number removed
async function sweepExpiredTestCopies({ store, now = new Date() }) {
  const rows = await MarketingSignatureCopy.find({ expiresAt: { $lte: now }, removedAt: null }).limit(500).lean();
  let n = 0;
  for (const row of rows) {
    try {
      await store.remove(row.key);
      await MarketingSignatureCopy.updateOne({ _id: row._id }, { $set: { removedAt: now } });
      n += 1;
    } catch (err) {
      console.error("[marketing] could not remove an expired signature copy:", err?.name || "error");
    }
  }
  return n;
}

module.exports = {
  TEST_TTL_MS,
  loadOwnSignature,
  snapshotForCampaign,
  removeCampaignSignature,
  createTestCopy,
  campaignBlock,
  previewBlock,
  findHostedByToken,
  sweepExpiredTestCopies,
};
