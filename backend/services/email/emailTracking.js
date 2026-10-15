const EmailTrackingOptOut = require("../../models/EmailTrackingOptOut");
const { EMAIL_DOMAIN } = require("../../models/Mailbox");
const { getTrackingState } = require("./emailSettings");
const { newToken, trackingUrl } = require("./trackingToken");

// Apple Mail Privacy Protection loads every image through Apple's servers the moment
// mail arrives. These recipients DO get the image: such loads are recorded apart from
// real opens and shown as "Opened (Apple — may be automatic)" (see openClassifier.js).
const APPLE_DOMAINS = new Set(["icloud.com", "me.com", "mac.com"]);

const domainOf = (address) => String(address || "").toLowerCase().split("@").pop();

// Decides whether ONE outgoing mail carries a tracking image.
//   requested  true / false from the compose form's "Track opens" box; undefined → the mailbox default
//   state      override for tests (see getTrackingState)
// → { enabled: true, token, hash, imageUrl, disclosure, includesInternal, allRecipientsApple }
//   { enabled: false, reason }   reason ∈ tracking_off | mail_off | internal_recipients | opted_out
//   internal_recipients only when the Super Admin switched "Track mail to company addresses" off.
async function planTracking({ mailbox, to = [], cc = [], requested, state } = {}) {
  const s = state || (await getTrackingState());
  if (!s.active) return { enabled: false, reason: "tracking_off" };

  const wanted = requested === undefined ? mailbox?.trackOpensDefault !== false : Boolean(requested);
  if (!wanted) return { enabled: false, reason: "mail_off" };

  const addresses = [...to, ...cc].map((a) => String(a.address || "").toLowerCase()).filter(Boolean);
  // One pixel is shared by every recipient, so an open by our own staff can look like
  // the client's. With the Super Admin toggle on (the default) the mail is still tracked
  // and the screens carry a caveat.
  const includesInternal = addresses.some((a) => domainOf(a) === EMAIL_DOMAIN);
  if (includesInternal && s.trackInternalRecipients === false) return { enabled: false, reason: "internal_recipients" };
  const allRecipientsApple = addresses.length > 0 && addresses.every((a) => APPLE_DOMAINS.has(domainOf(a)));
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
    includesInternal,
    allRecipientsApple,
  };
}

module.exports = { planTracking, APPLE_DOMAINS };
