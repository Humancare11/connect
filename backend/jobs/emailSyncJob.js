const os = require("os");
const crypto = require("crypto");
const Mailbox = require("../models/Mailbox");
const { syncMailbox } = require("../services/gmail/syncMailbox");
const { assertNotProductionDb } = require("../utils/dbGuard");

const { emitEmailChanged } = require("../services/email/emailEvents");

const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 60_000;
const DEFAULT_INTERVAL_MS = 20_000;
const CONCURRENCY = 4;

// EMAIL_SYNC_INTERVAL_MS, default 20 s, kept between 10 and 60 s.
function syncIntervalMs(env = process.env) {
  const requested = Number(env.EMAIL_SYNC_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, requested));
}

// Polls every active shared mailbox, every 20 s by default (EMAIL_SYNC_INTERVAL_MS, clamped to
// 10–60 s), up to CONCURRENCY mailboxes at the same time. Safe with several backend instances: each mailbox is
// guarded by a lease (Mailbox.acquireLease), so only one instance syncs it.
let running = false;

async function runEmailSync(owner, { sync = syncMailbox, listMailboxes, concurrency = CONCURRENCY, notify = emitEmailChanged } = {}) {
  if (running) return; // previous tick still going on this instance
  running = true;
  try {
    const mailboxes = await (listMailboxes ? listMailboxes() : Mailbox.find({ isActive: true }).select("_id address").lean());
    // A small pool: one slow or failing mailbox no longer holds the others back.
    let next = 0;
    const worker = async () => {
      while (next < mailboxes.length) {
        const m = mailboxes[next++];
        try {
          const res = await sync(m._id, { owner });
          if (!res.skipped && (res.created || res.updated)) {
            console.log(`[email-sync] ${m.address}: ${res.mode}, +${res.created} new, ${res.updated} updated`);
            // Tell open dashboards (no mail data in the event).
            notify(m._id);
          }
        } catch (err) {
          console.error(`[email-sync] ${m.address} failed:`, err?.message || err);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, mailboxes.length)) }, worker));
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
  const intervalMs = syncIntervalMs();
  const owner = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  setInterval(() => runEmailSync(owner).catch((err) => console.error("[email-sync] error:", err)), intervalMs).unref();
  console.log(`[email-sync] polling every ${intervalMs / 1000}s.`);
}

module.exports = { runEmailSync, scheduleEmailSync, syncIntervalMs, CONCURRENCY };
