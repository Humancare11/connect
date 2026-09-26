// Small, dependency-free SDP-parsing helpers for raw WebRTC signaling.
// Deliberately NOT in retryDebug.js and NOT gated behind any debug flag —
// extractDtlsFingerprint backs real reconnect logic (DirectVideoCall.jsx's
// handleOffer/rebuildForRenegotiatedPeer detect a peer that rebuilt its
// RTCPeerConnection by comparing DTLS fingerprints across offers), not just
// diagnostic logging, and must keep working even if debug logging is
// disabled or removed entirely.

// Pulls the DTLS fingerprint out of an SDP blob (the `a=fingerprint:` line).
// Read-only parse, no effect on negotiation. Returns null if the SDP is
// missing or has no fingerprint line (e.g. malformed/unusual SDP) — callers
// must treat null as "unknown," never as "unchanged" or "changed."
export function extractDtlsFingerprint(sdp) {
  if (!sdp) return null;
  const match = /a=fingerprint:\S+\s+(\S+)/i.exec(sdp);
  return match ? match[1] : null;
}

// Negotiated direction of each media section, e.g. ["audio:sendrecv",
// "video:recvonly"]. Diagnostic only (never drives negotiation): lets callers
// log — and warn about — an answer that is receive-only even though local
// tracks exist, which silently produces a one-way call.
export function extractSdpDirections(sdp) {
  if (!sdp) return [];
  return sdp
    .split(/\r?\nm=/)
    .slice(1)
    .map((section) => {
      const kind = section.split(" ")[0];
      const match = /a=(sendrecv|sendonly|recvonly|inactive)/.exec(section);
      return `${kind}:${match ? match[1] : "?"}`;
    });
}
