// Runs between setRemoteDescription(offer) and createAnswer(): makes sure a
// local track we hold is actually SENT in the answer. After an offer collision
// (rollback of our own offer, then answering theirs) the transceivers the
// offer matched can be recvonly/inactive even though we have live local
// tracks, so the answer comes out recvonly and the peer receives nothing.
// Real call logic — `log` is only a diagnostic callback (label, data).
export async function ensureLocalTracksSentInAnswer(pc, localStream, log = () => {}) {
  try {
    const transceivers = pc.getTransceivers();
    log(
      "answer:transceivers_before_createAnswer",
      transceivers.map((t) => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        receiverKind: t.receiver?.track?.kind ?? null,
        senderTrackKind: t.sender?.track?.kind ?? null,
        senderTrackState: t.sender?.track?.readyState ?? null,
      })),
    );

    const liveLocalTracks = (localStream?.getTracks() || []).filter((t) => t.readyState === "live");
    const attached = new Set(transceivers.map((t) => t.sender?.track).filter(Boolean));

    for (const t of transceivers) {
      if (t.currentDirection === "stopped") continue;
      if (t.direction !== "recvonly" && t.direction !== "inactive") continue;

      const senderTrack = t.sender?.track;
      if (senderTrack) {
        if (senderTrack.readyState === "live") {
          const was = t.direction;
          t.direction = "sendrecv";
          log("answer:transceiver_forced_sendrecv", { mid: t.mid, was, kind: senderTrack.kind });
        }
        continue;
      }

      // No sender track: adopt a live local track of the same kind that no
      // sender is carrying yet.
      const kind = t.receiver?.track?.kind;
      const spare = liveLocalTracks.find((tr) => tr.kind === kind && !attached.has(tr));
      if (!spare) continue;
      try {
        await t.sender.replaceTrack(spare);
        attached.add(spare);
        const was = t.direction;
        t.direction = "sendrecv";
        log("answer:transceiver_attached_spare_track", { mid: t.mid, was, kind });
      } catch (err) {
        log("answer:transceiver_attach_failed", { mid: t.mid, kind, message: err?.message });
      }
    }
  } catch (err) {
    log("answer:ensureLocalTracksSent_ERROR", { message: err?.message });
  }
}
