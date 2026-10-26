// Automatic recovery of a local camera/mic that dies mid-call (device
// unplugged, Bluetooth headset dropped, the OS/browser reclaimed the camera
// while the tab was backgrounded, permission revoked).
//
// A MediaStreamTrack that ends does not come back by itself: the sender keeps
// "sending" a dead track, the local UI still says camera/mic on, and the peer
// sees a frozen frame or silence. Recovery = re-acquire via getUserMedia and
// replaceTrack onto the existing sender; the page supplies that as `recover`
// (both call pages already have such a function for the permission-retry
// flow), this module only decides WHEN and HOW OFTEN to run it.

// A track whose readyState is "ended" in the stream we believe is current.
// (Tracks the page stops on purpose are removed from / replaced in the stream
// first, so they never show up here.)
export const hasEndedTrack = (stream) =>
  Boolean(stream) && stream.getTracks().some((track) => track.readyState === "ended");

// 0.5s, 3s, 8s: quick first retry (a replug/foreground is usually instant),
// then back off before giving up and handing over to the Retry button.
export const DEFAULT_RECOVERY_DELAYS_MS = [500, 3000, 8000];

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createLocalMediaRecovery({
  hasProblem,
  recover,
  isActive = () => true,
  onState = () => {},
  delaysMs = DEFAULT_RECOVERY_DELAYS_MS,
  sleep = realSleep,
  log = () => {},
}) {
  let running = false;
  let failed = false;

  const run = async () => {
    running = true;
    onState({ phase: "recovering" });
    for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
      await sleep(delaysMs[attempt]);
      if (!isActive()) {
        running = false;
        return;
      }
      try {
        await recover();
      } catch (err) {
        log("local_media_recover_attempt_failed", { attempt: attempt + 1, error: err?.message || String(err) });
      }
      if (!hasProblem()) {
        running = false;
        failed = false;
        log("local_media_recovered", { attempt: attempt + 1 });
        onState(null);
        return;
      }
    }
    running = false;
    failed = true;
    log("local_media_recovery_gave_up", { attempts: delaysMs.length });
    onState({ phase: "failed" });
  };

  return {
    // `force` (a devicechange, i.e. something actually changed) re-arms
    // recovery even after a previous give-up; the periodic poll never does,
    // so a permanently dead device doesn't produce retries forever.
    check(reason, { force = false } = {}) {
      if (!isActive() || running) return;
      if (!hasProblem()) {
        if (failed) {
          failed = false;
          onState(null);
        }
        return;
      }
      if (failed && !force) return;
      failed = false;
      log("local_media_problem_detected", { reason });
      void run();
    },
    // Manual "Retry" button after a give-up.
    retryNow() {
      if (!isActive() || running) return;
      failed = false;
      void run();
    },
    get running() {
      return running;
    },
    get failed() {
      return failed;
    },
  };
}
