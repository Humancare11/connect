const { marketingConfig } = require("./config");
const { createSesSender } = require("./sesSender");
const { createMarketingQueue } = require("./queue");
const { purgeOldRecipients } = require("./purge");

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
  purge();
  const timer = setInterval(purge, DAY_MS);
  if (timer.unref) timer.unref();

  console.log("[marketing] sending worker started");
  return queue;
}

module.exports = { startMarketingWorker };
