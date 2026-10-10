const os = require("os");
const crypto = require("crypto");
const Mailbox = require("../models/Mailbox");
const { syncMailbox } = require("../services/gmail/syncMailbox");
const { assertNotProductionDb } = require("../utils/dbGuard");

const MIN_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 60_000;

// Polls every active shared mailbox. Polling every 30–60s (EMAIL_SYNC_INTERVAL_MS,
// clamped to that range). Safe with several backend instances: each mailbox is
// guarded by a lease (Mailbox.acquireLease), so only one instance syncs it.
let running = false;

async function runEmailSync(owner) {
  if (running) return; // previous tick still going on this instance
  running = true;
  try {
    const mailboxes = await Mailbox.find({ isActive: true }).select("_id address").lean();
    for (const m of mailboxes) {
      try {
        const res = await syncMailbox(m._id, { owner });
        if (!res.skipped && (res.created || res.updated)) {
          console.log(`[email-sync] ${m.address}: ${res.mode}, +${res.created} new, ${res.updated} updated`);
        }
      } catch (err) {
        console.error(`[email-sync] ${m.address} failed:`, err?.message || err);
      }
    }
  } finally {
    running = false;
  }
}

// Off unless EMAIL_SYNC_ENABLED=true, so no environment starts polling Gmail
// until it has been deliberately switched on.
function scheduleEmailSync() {
  if (process.env.EMAIL_SYNC_ENABLED !== "true") {
    console.log("[email-sync] disabled (set EMAIL_SYNC_ENABLED=true to enable).");
    return;
  }
  if (!process.env.GOOGLE_SA_JSON_B64 && !process.env.GOOGLE_SA_JSON_PATH) {
    console.warn("[email-sync] EMAIL_SYNC_ENABLED is true but no Google service-account key is set; not starting.");
    return;
  }
  // A deployed production server (NODE_ENV=production) is meant to sync. Anywhere
  // else, refuse to poll if MONGO_URI points at the production cluster, so a local
  // run can never write mail into production data.
  if (process.env.NODE_ENV !== "production") {
    try {
      assertNotProductionDb({ uri: process.env.MONGO_URI });
    } catch (err) {
      console.error(`[email-sync] not starting: ${err.message}`);
      return;
    }
  }
  const requested = Number(process.env.EMAIL_SYNC_INTERVAL_MS) || 45_000;
  const intervalMs = Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, requested));
  const owner = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  setInterval(() => runEmailSync(owner).catch((err) => console.error("[email-sync] error:", err)), intervalMs).unref();
  console.log(`[email-sync] polling every ${intervalMs / 1000}s.`);
}

module.exports = { runEmailSync, scheduleEmailSync };
