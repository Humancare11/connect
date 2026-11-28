// Safety net for a connected call whose remote picture has stopped (or never
// appeared) while the other camera is on: first re-attach the stream, then one
// ICE restart, with a visible notice rather than a silent black tile.
export const REMOTE_VIDEO_STALL_MS = 5000;
export const REMOTE_VIDEO_CHECK_MS = 1000;

// update(now, { eligible, frames }) -> "ok" | "reattach" | "restart" | "stalled"
// `frames` is the element's total presented frames, or null if unknown.
export function createRemoteVideoWatch(stallMs = REMOTE_VIDEO_STALL_MS) {
  let lastFrames = null;
  let since = 0;
  let stage = 0; // 0 fine, 1 re-attached, 2 restarted
  const reset = () => {
    lastFrames = null;
    stage = 0;
  };
  return {
    reset,
    update(now, { eligible, frames }) {
      if (!eligible || typeof frames !== "number") {
        reset();
        return "ok";
      }
      if (lastFrames === null) {
        lastFrames = frames;
        since = now;
        return stage ? "stalled" : "ok";
      }
      if (frames > lastFrames) {
        lastFrames = frames;
        since = now;
        stage = 0;
        return "ok";
      }
      // A re-attach restarts the element's counter: take the new base, not as progress.
      lastFrames = frames;
      if (now - since < stallMs) return stage ? "stalled" : "ok";
      since = now;
      if (stage === 0) {
        stage = 1;
        return "reattach";
      }
      if (stage === 1) {
        stage = 2;
        return "restart";
      }
      return "stalled";
    },
  };
}

export function presentedFrames(video) {
  const total = video?.getVideoPlaybackQuality?.().totalVideoFrames;
  return typeof total === "number" ? total : null;
}
