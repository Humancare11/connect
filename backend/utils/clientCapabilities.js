// What a participant's client says it supports, relayed to the other side in
// "peer-joined". Only known boolean flags are accepted; anything missing or
// malformed reads as "not supported" so an old (or hostile) client can't opt
// itself into behavior it doesn't have.
//   peerRebuild: handles "request-peer-rebuild"
//   iceRestart:  its restart offers really restart ICE
function sanitizeCapabilities(raw) {
  return {
    peerRebuild: Boolean(raw && raw.peerRebuild === true),
    iceRestart: Boolean(raw && raw.iceRestart === true),
  };
}

module.exports = { sanitizeCapabilities };
