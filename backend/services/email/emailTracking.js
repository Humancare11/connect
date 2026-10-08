const EmailTrackingOptOut = require("../../models/EmailTrackingOptOut");
const { EMAIL_DOMAIN } = require("../../models/Mailbox");
const { getTrackingState } = require("./emailSettings");
const { newToken, trackingUrl } = require("./trackingToken");

// Apple Mail Privacy Protection loads every image through Apple's servers the
// moment mail arrives, so opens by these recipients cannot be told from a
// prefetch. They are shown as "Tracking unavailable" and get no image at all.
const APPLE_DOMAINS = new Set(["icloud.com", "me.com", "mac.com"]);

const domainOf = (address) => String(address || "").toLowerCase().split("@").pop();

// Decides whether ONE outgoing mail carries a tracking image.
//   requested  true / false from the compose form's "Track opens" box; undefined → the mailbox default
//   state      override for tests (see getTrackingState)
// → { enabled: true, token, hash, imageUrl, disclosure }
//   { enabled: false, reason }   reason ∈ tracking_off | mail_off | internal_recipients | apple_recipient | opted_out
async function planTracking({ mailbox, to = [], cc = [], requested, state } = {}) {
  const s = state || (await getTrackingState());
  if (!s.active) return { enabled: false, reason: "tracking_off" };

  const wanted = requested === undefined ? mailbox?.trackOpensDefault !== false : Boolean(requested);
  if (!wanted) return { enabled: false, reason: "mail_off" };

  const addresses = [...to, ...cc].map((a) => String(a.address || "").toLowerCase()).filter(Boolean);
  // One pixel is shared by every recipient, so an open by our own staff would count as the client's.
  if (addresses.some((a) => domainOf(a) === EMAIL_DOMAIN)) return { enabled: false, reason: "internal_recipients" };
  if (addresses.some((a) => APPLE_DOMAINS.has(domainOf(a)))) return { enabled: false, reason: "apple_recipient" };
  if (addresses.length && (await EmailTrackingOptOut.exists({ address: { $in: addresses } }))) {
    return { enabled: false, reason: "opted_out" };
  }

  const { token, hash } = newToken();
  return {
    enabled: true,
    token,
    hash,
    imageUrl: trackingUrl(s.baseUrl, token),
    disclosure: s.disclosureEnabled ? s.disclosureText : "",
  };
}

module.exports = { planTracking, APPLE_DOMAINS };
