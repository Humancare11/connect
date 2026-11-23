const { marketingConfig } = require("./config");
const { createSesSender } = require("./sesSender");
const { createMarketingQueue } = require("./queue");
const { purgeOldRecipients } = require("./purge");
const { sweepExpiredTestCopies } = require("./signature");

const DAY_MS = 24 * 3600 * 1000;

// Starts the sending queue and the daily retention purge. Does nothing unless MARKETING_ENABLED=true, so a
// server (or a local run) without it never sends, and never touches the marketing collections.
function startMarketingWorker({ cfg = marketingConfig(), sender = null } = {}) {
  if (!cfg.enabled) return null;
  const queue = createMarketingQueue({ sender: sender || createSesSender({ cfg }), cfg });
  queue.start();

  const purge = () =>
    purgeOldRecipients({ months: cfg.retentionMonths })
      .then((n) => n && console.log(`[marketing] retention: removed personal fields of ${n} recipients`))
      .catch((err) => console.error("[marketing] retention purge failed:", err?.name || "error"));
  // Daily: remove the stored image of test-mail signature copies that expired (7 days).
  const sweep = () => {
    let store;
    try {
      store = require("../../utils/emailAttachments").createS3AttachmentStore();
    } catch {
      return null;
    }
    return sweepExpiredTestCopies({ store })
      .then((n) => n && console.log(`[marketing] removed ${n} expired test signature copies`))
      .catch((err) => console.error("[marketing] signature sweep failed:", err?.name || "error"));
  };
  purge();
  sweep();
  const timer = setInterval(() => {
    purge();
    sweep();
  }, DAY_MS);
  if (timer.unref) timer.unref();

  console.log("[marketing] sending worker started");
  return queue;
}

module.exports = { startMarketingWorker };
