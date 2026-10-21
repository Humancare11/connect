// Settings and small helpers for the doctor greeter (DoctorGreeter.jsx, LauncherButton.jsx). The video is the
// doctor walking in (0-3 s) and then standing and waving; every loop starts at LOOP_FROM so the walk-in is never repeated.
export const VIDEO_VERSION = "?v=1"; // bump when doctor.webm / doctor.mp4 / poster.jpg are replaced (the names are not hashed)
export const WEBM_SRC = `/livechat/doctor.webm${VIDEO_VERSION}`;
export const MP4_SRC = `/livechat/doctor.mp4${VIDEO_VERSION}`;
export const POSTER_SRC = `/livechat/poster.jpg${VIDEO_VERSION}`;
// The intro: the doctor on a transparent background (VP9 with alpha), and its transparent standing frame.
export const ALPHA_WEBM_SRC = `/livechat/doctor-alpha.webm${VIDEO_VERSION}`;
// Safari, iOS and iPadOS (and any browser without VP9) get the same shot as an H.264 MP4 with its light-grey background,
// whose box edges are faded with a soft mask (see .lcw-gr-doc--ios in the CSS).
export const IOS_MP4_SRC = `/livechat/doctor-ios.mp4${VIDEO_VERSION}`;
export const ALPHA_POSTER_SRC = `/livechat/poster-alpha.webp${VIDEO_VERSION}`;
export const CHAR_CENTER = 0.43; // the doctor's centre, as a fraction of the intro video's width

export const SHOW_PILL_AT = 3.2; // seconds into the video: the message pill slides in
export const LOOP_FROM = 4.0; // seconds: every loop restarts here
export const SHRINK_AFTER_MS = 10_000; // visible, idle time before the doctor flies into the round button
export const START_TIMEOUT_MS = 2500; // the video must start playing within this, else the compact bar is shown
export const FLY_MS = 750;
export const AVATAR_MS = 4200; // round button: live avatar (the ring fills in this time)
export const DARK_MS = 500; // ... fades to black
export const CHAT_MS = 4500; // ... black circle with the chat icon
export const MAX_PILL_CHARS = 500;

const REDUCED = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(REDUCED).matches);
export const saveDataOn = () => typeof navigator !== "undefined" && Boolean(navigator.connection?.saveData);

// Whether the video (intro or live avatar) may be used at all. Without it the round button just shows the chat icon.
export const canUseVideo = () => !prefersReducedMotion() && !saveDataOn();

// The intro plays on every full page load or refresh (new tab, reload), and never again until the next one: this flag
// lives in the page's own memory, so client-side route changes (even through a page without the widget) do not restart
// it and nothing is stored in the browser.
let introPlayed = false;
export const introPlayedThisLoad = () => introPlayed;
export const markIntroPlayed = () => {
  introPlayed = true;
};

// Safari and every iOS browser (all WebKit) do not play VP9-with-alpha WebM correctly, whatever canPlayType says.
export function isSafari(userAgent, maxTouchPoints = 0) {
  const ua = String(userAgent || "");
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return true; // iPadOS reports a Mac
  return /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua);
}

// Can this browser play the transparent intro video (VP9 with alpha in WebM)?
export function canPlayAlphaIntro() {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  if (isSafari(navigator.userAgent, navigator.maxTouchPoints)) return false;
  try {
    return Boolean(document.createElement("video").canPlayType('video/webm; codecs="vp9"'));
  } catch {
    return false;
  }
}

// Which intro video this browser gets: "alpha" (transparent WebM) or "ios" (MP4 with a grey background).
export const introVideoKind = () => (canPlayAlphaIntro() ? "alpha" : "ios");

// On every device, phones included, except with reduced motion or data saver, with the chat window already open, an
// admin invite waiting, or once it has played on this page load.
export function shouldPlayIntro({ reduced, saveData, played, open, invite }) {
  return !(reduced || saveData || played || open || invite);
}

// The next step of the round button's cycle: live avatar -> black -> chat icon -> live avatar.
export function nextStep(phase) {
  if (phase === "avatar") return { next: "dark", ms: AVATAR_MS };
  if (phase === "dark") return { next: "chat", ms: DARK_MS };
  return { next: "avatar", ms: CHAT_MS };
}

// Keeps a muted video looping from LOOP_FROM instead of from 0. Seeks back just before the end (frame callback where
// the browser has one, else timeupdate) so there is no flash of the first frame; `ended` is the safety net.
// Returns a function that stops it.
export function keepLooping(video) {
  let stopped = false;
  let handle = 0;
  const nearEnd = () => Number.isFinite(video.duration) && video.currentTime >= LOOP_FROM && video.duration - video.currentTime < 0.15;
  const check = () => {
    if (!stopped && !video.paused && nearEnd()) video.currentTime = LOOP_FROM;
  };
  const onEnded = () => {
    if (stopped || document.hidden) return;
    video.currentTime = LOOP_FROM;
    video.play().catch(() => {});
  };
  const frame = () => {
    check();
    if (!stopped) handle = video.requestVideoFrameCallback(frame);
  };
  video.addEventListener("timeupdate", check);
  video.addEventListener("ended", onEnded);
  if (typeof video.requestVideoFrameCallback === "function") handle = video.requestVideoFrameCallback(frame);
  return () => {
    stopped = true;
    video.removeEventListener("timeupdate", check);
    video.removeEventListener("ended", onEnded);
    if (handle && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(handle);
  };
}

// A <source> that cannot be played fires `error` on the <source>, not on the <video>. Calls onFail only when the last
// one fails, so a browser that skips an unsupported WebM and plays the MP4 is not treated as a failure.
export function watchSources(video, onFail) {
  const handler = (event) => {
    if (event.target === video || event.target === video.lastElementChild) onFail();
  };
  video.addEventListener("error", handler, true);
  return () => video.removeEventListener("error", handler, true);
}

// React does not reliably render the `muted` attribute; autoplay on Safari/iOS needs it set on the element.
export function mute(video) {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
}
