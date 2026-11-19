const { recordOpen } = require("../email/trackingRecorder");
const { recordClick, findLink } = require("../email/clickRecorder");
const { recordMarketingOpen, recordMarketingClick, findMarketingLink } = require("./tracking");

// The public tracking routes (/api/e image, /api/l links) ask the Email page first. Only a token it does not
// know ("unknown_token") is tried against the marketing recipients, so every existing token behaves exactly as
// before and a marketing token costs one extra lookup. Failures of the marketing side are swallowed by the callers.

async function recordOpenAny(args, options) {
  const result = await recordOpen(args, options);
  if (result && result.recorded === false && result.why === "unknown_token") return recordMarketingOpen(args, options);
  return result;
}

async function recordClickAny(args, options) {
  const result = await recordClick(args, options);
  if (result && result.recorded === false && result.why === "unknown_token") return recordMarketingClick(args, options);
  return result;
}

// Same shape as findLink(), plus `marketing: true` for a marketing link.
async function findLinkAny(token) {
  return (await findLink(token)) || (await findMarketingLink(token));
}

module.exports = { recordOpenAny, recordClickAny, findLinkAny };
