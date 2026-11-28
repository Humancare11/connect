// When the patient's client cannot restart ICE itself (the installed app does
// not declare `iceRestart`), the doctor's browser sends the restart offer.
//
// Both sides must not offer at once: the doctor yields on a collision and the
// app ignores the doctor's offer, so the doctor waits until the patient has
// been quiet.
export const PEER_OFFER_QUIET_MS = 3000;
// A restart needs time to find a path; another one too soon would start over.
export const OWN_RESTART_MIN_GAP_MS = 7000;

// peerCapabilities null = not learned yet: keep the previous behaviour.
export const doctorRestartsItself = ({ enabled, isDoctor, peerCapabilities }) =>
  Boolean(enabled && isDoctor && peerCapabilities && peerCapabilities.iceRestart !== true);

// "send" now, or "wait" for the next recovery tick.
export function doctorRestartDecision({ now, lastPeerOfferAt, lastOwnRestartAt, signalingState, makingOffer }) {
  if (makingOffer || signalingState !== "stable") return "wait";
  if (lastPeerOfferAt && now - lastPeerOfferAt < PEER_OFFER_QUIET_MS) return "wait";
  if (lastOwnRestartAt && now - lastOwnRestartAt < OWN_RESTART_MIN_GAP_MS) return "wait";
  return "send";
}
