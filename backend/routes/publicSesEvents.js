const { marketingConfig } = require("../services/marketing/config");
const { verifySnsMessage, confirmSubscription, SnsVerifyError } = require("../services/marketing/snsVerify");
const { applySesEvent } = require("../services/marketing/sesEvents");
const { createIpGate } = require("./publicTracking");

// POST /api/ses/events: Amazon SNS delivers SES events here (bounces, complaints, deliveries, rejects).
//   - Nothing is trusted until the SNS signature checks out AND the message is for OUR topic (SES_SNS_TOPIC_ARN).
//   - Anything else answers 403 with no detail, so the endpoint reveals nothing.
//   - A verified event is applied idempotently; a database failure answers 500 so SNS retries it.
// Mounted with a plain-text body parser (SNS posts JSON as text/plain). Always available, so mail already out
// keeps getting its bounces and complaints handled even if MARKETING_ENABLED is switched off.
//
// Options exist so tests can use fakes.
function createSesEventsHandler({
  cfg = () => marketingConfig(),
  verify = verifySnsMessage,
  confirm = confirmSubscription,
  apply = applySesEvent,
  limitPerMinute = 600,
  now,
} = {}) {
  const allow = createIpGate({ limitPerMinute, now });

  return async function handler(req, res) {
    const topicArn = cfg().snsTopicArn;
    if (!topicArn) return res.status(404).json({ msg: "Not found." });
    if (!allow(req.ip || "")) return res.status(429).end();

    let msg;
    try {
      msg = await verify(typeof req.body === "string" ? req.body : "", { topicArn });
    } catch (err) {
      if (!(err instanceof SnsVerifyError)) console.error("[ses-events] verify failed:", err?.name || "error");
      return res.status(403).end();
    }

    try {
      if (msg.Type === "SubscriptionConfirmation") {
        await confirm(msg);
      } else if (msg.Type === "Notification") {
        let event = null;
        try {
          event = JSON.parse(msg.Message);
        } catch {
          event = null; // an SNS test message or something else: nothing to apply
        }
        if (event) await apply(event);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[ses-events] could not apply:", err?.name || "error");
      return res.status(500).end();
    }
  };
}

module.exports = { handler: createSesEventsHandler(), create: createSesEventsHandler };
