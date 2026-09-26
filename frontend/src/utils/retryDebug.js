// ── TEMPORARY: Retry-bug diagnostic logging ───────────────────────────────
// Added to investigate "blank video on the other side after tapping Retry",
// shared by VideoCall.jsx (appointment calls) and DirectVideoCall.jsx
// (ad-hoc calls) so both use identical logging behavior. Logging only — no
// call/reconnect logic lives here. Off by default; enable per build with
// VITE_RETRY_DEBUG=true (the e2e suite sets it for its dev server; it is
// deliberately NOT set in .env or .env.production, so production stays quiet).
//
// Exception: retryDebugExtractFingerprint below is kept here only as a
// backward-compatible re-export for VideoCall.jsx, which still uses it
// purely for logging. The real implementation — and the copy DirectVideoCall
// .jsx's actual reconnect fix depends on — lives in webrtcSdp.js, outside
// this file and outside the RETRY_DEBUG flag, on purpose.
export const RETRY_DEBUG = import.meta.env.VITE_RETRY_DEBUG === "true";
export { extractDtlsFingerprint as retryDebugExtractFingerprint } from "./webrtcSdp";

// `callId` is an appointmentId (VideoCall.jsx) or a direct-call roomId
// (DirectVideoCall.jsx) — logged under the same "appt=" label so
// VideoCall.jsx's existing "[RETRY-DEBUG]" console output is byte-for-byte
// unchanged by this refactor into a shared file.
export function retryDebugLog(role, callId, label, data) {
  if (!RETRY_DEBUG) return;
  console.log(
    `[RETRY-DEBUG] ${new Date().toISOString()} role=${role || "unknown"} appt=${callId || "unknown"} ${label}`,
    data !== undefined ? data : "",
  );
}

// TEMPORARY (RETRY_DEBUG): samples getStats() every 2s for 20s (10 samples)
// after an offer is applied, logging the inbound-rtp video report so we can
// tell "media never arrived" apart from "media arrived but never rendered".
// Read-only — never touches the RTCPeerConnection's negotiation state.
export function retryDebugPollInboundVideoStats(pc, role, callId, label) {
  if (!RETRY_DEBUG || !pc) return;
  let ticks = 0;
  const intervalId = setInterval(async () => {
    ticks += 1;
    if (!pc || pc.signalingState === "closed") {
      clearInterval(intervalId);
      return;
    }
    try {
      const report = await pc.getStats();
      let inboundVideo = null;
      report.forEach((stat) => {
        if (stat.type === "inbound-rtp" && stat.kind === "video") {
          inboundVideo = {
            bytesReceived: stat.bytesReceived,
            framesDecoded: stat.framesDecoded,
            packetsReceived: stat.packetsReceived,
            packetsLost: stat.packetsLost,
            frameWidth: stat.frameWidth,
            frameHeight: stat.frameHeight,
          };
        }
      });
      retryDebugLog(role, callId, `${label}:stats_tick_${ticks}/10`, {
        inboundVideo,
      });
    } catch (err) {
      retryDebugLog(role, callId, `${label}:stats_tick_${ticks}/10:ERROR`, {
        message: err?.message,
      });
    }
    if (ticks >= 10) clearInterval(intervalId);
  }, 2000);
}
