import { CONNECTION_STATE_COLORS, roleLabel } from "./reportUtils";

// A sample older than this is shown dimmed with "No recent samples". (Kept as a
// module-level helper: the clock read is deliberate - staleness is "now" relative.)
const isStale = (sample) => Date.now() - sample.at > 6000;

// "Live" section of an admin call report. Extracted verbatim from
// AdminDirectVideoCallDetail.jsx. Samples are keyed by `participantKey(p)`.
export default function LiveCard({ liveOpen, participants, liveSamples, participantKey }) {
  const active = participants.filter((p) => p.connectionState !== "left");
  return (
    <div className="dvc-card">
      <div className="dvc-form__title">
        <h2>Live</h2>
        <p>
          Technical connection data only — mic/camera on-off, connection state, network quality.
          Never audio, video, or an audio level. Updates automatically while this page is open, no
          action needed.
        </p>
      </div>
      {!liveOpen ? (
        <div className="dvc-empty">Connecting…</div>
      ) : active.length === 0 ? (
        <div className="dvc-empty">Waiting for a participant to be in the call…</div>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {active.map((p) => {
            const sample = liveSamples[participantKey(p)];
            const stale = sample && isStale(sample);
            return (
              <div
                key={participantKey(p)}
                style={{
                  minWidth: 220,
                  flex: "1 1 240px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  opacity: stale ? 0.5 : 1,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1f44", marginBottom: 8 }}>
                  {roleLabel(p.role)}
                </div>
                {!sample ? (
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>No samples yet…</div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#374151", flexWrap: "wrap" }}>
                      <span>Mic: {sample.micOn ? "On" : "Off"}</span>
                      <span>Camera: {sample.camOn ? "On" : "Off"}</span>
                      <span style={{ color: CONNECTION_STATE_COLORS[sample.connectionState] || "#374151" }}>
                        {sample.connectionState || "unknown"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#6b7280", marginTop: 6, flexWrap: "wrap" }}>
                      <span>RTT: {typeof sample.rtt === "number" ? `${sample.rtt}ms` : "-"}</span>
                      <span>
                        Loss: {typeof sample.packetLoss === "number" ? `${(sample.packetLoss * 100).toFixed(1)}%` : "-"}
                      </span>
                      <span>Jitter: {typeof sample.jitter === "number" ? `${sample.jitter}ms` : "-"}</span>
                    </div>
                    {stale && <div style={{ fontSize: 11, color: "#d97706", marginTop: 6 }}>No recent samples</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
