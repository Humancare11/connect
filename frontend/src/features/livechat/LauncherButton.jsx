import { useEffect, useRef, useState } from "react";
import { LOOP_FROM, MP4_SRC, POSTER_SRC, WEBM_SRC, keepLooping, mute, nextStep, watchSources } from "./greeterConfig";

// The closed-chat round button (64px). It alternates: the live avatar (the doctor's video cropped to head and shoulders,
// looping from LOOP_FROM so the walk-in is never shown, a blinking LIVE badge and a ring that fills) -> fades to black ->
// a black circle with the chat icon -> back. Without video (reduced motion, data saver, video that cannot play) it is
// just the chat icon. The avatar only shows once its video has seeked past the walk-in, and the video is paused whenever
// the avatar is not on screen or the tab is hidden.
export default function LauncherButton({ unread = 0, onOpen, buttonRef, avatar = true, arrive = false }) {
  const [phase, setPhase] = useState("avatar"); // avatar | dark | chat
  const [ready, setReady] = useState(false); // the video sits at LOOP_FROM or later
  const [failed, setFailed] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const videoRef = useRef(null);
  const useVideo = avatar && !failed;
  const shown = useVideo && ready ? phase : "chat";

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Seek past the walk-in before anything is shown; keep looping from there.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    mute(video);
    const onSeeked = () => {
      if (video.currentTime >= LOOP_FROM - 0.05) setReady(true);
    };
    const toStart = () => {
      if (video.currentTime < LOOP_FROM - 0.05) video.currentTime = LOOP_FROM;
      else onSeeked();
    };
    video.addEventListener("loadedmetadata", toStart);
    video.addEventListener("seeked", onSeeked);
    const stopWatching = watchSources(video, () => setFailed(true));
    const stopLooping = keepLooping(video);
    if (video.readyState >= 1) toStart();
    return () => {
      video.removeEventListener("loadedmetadata", toStart);
      video.removeEventListener("seeked", onSeeked);
      stopWatching();
      stopLooping();
    };
  }, [useVideo]);

  // Play only while the avatar is (becoming) visible.
  const shouldPlay = useVideo && ready && !tabHidden && phase !== "chat";
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!shouldPlay) {
      video.pause();
      return;
    }
    video.play().catch((error) => {
      if (error?.name === "NotAllowedError") setFailed(true); // autoplay refused (e.g. iOS low-power mode)
    });
  }, [shouldPlay]);

  // The cycle. Its first step waits for the video; a hidden tab holds it.
  useEffect(() => {
    if (!useVideo || tabHidden || (phase === "avatar" && !ready)) return undefined;
    const { next, ms } = nextStep(phase);
    const timer = setTimeout(() => setPhase(next), ms);
    return () => clearTimeout(timer);
  }, [useVideo, tabHidden, phase, ready]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`lcw-launcher lcw-launcher--round lcw-ph-${shown}${arrive ? " lcw-launcher--arrive" : ""}`}
      onClick={onOpen}
      aria-label="Open chat"
      aria-expanded="false"
    >
      {useVideo && (
        <>
          <span className="lcw-gr-cav" aria-hidden="true">
            <video ref={videoRef} muted playsInline preload="auto" poster={POSTER_SRC} tabIndex={-1}>
              <source src={WEBM_SRC} type='video/webm; codecs="vp9"' />
              <source src={MP4_SRC} type="video/mp4" />
            </video>
            <span className="lcw-gr-live">
              <i />
              LIVE
            </span>
          </span>
          <svg className="lcw-gr-ring" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
            <circle className="lcw-gr-track" cx="36" cy="36" r="34" />
            <circle className="lcw-gr-prog" cx="36" cy="36" r="34" />
          </svg>
        </>
      )}
      <svg className="lcw-gr-chatico" width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 17h-5.2l-2.3 2.8L9.2 17H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
      {unread > 0 && <span className="lcw-badge">{unread}</span>}
    </button>
  );
}
