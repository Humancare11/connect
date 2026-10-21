import { useEffect, useLayoutEffect, useRef, useState } from "react";
import LauncherButton from "./LauncherButton";
import {
  ALPHA_POSTER_SRC,
  ALPHA_WEBM_SRC,
  IOS_MP4_SRC,
  CHAR_CENTER,
  FLY_MS,
  MAX_PILL_CHARS,
  SHOW_PILL_AT,
  SHRINK_AFTER_MS,
  START_TIMEOUT_MS,
  keepLooping,
  markIntroPlayed,
  mute,
  watchSources,
} from "./greeterConfig";

// What the patient sees while the chat is closed (docs/chat-greeter-demo.html). One bar holds the "Write a message…"
// pill and the round button's slot, bottom-right, from the start:
//   intro   the transparent doctor video stands on the bar's bottom line over the slot (walks in, waves); the pill
//           slides in at its final place when he has walked in
//   fly     after SHRINK_AFTER_MS of visible, idle time only the doctor shrinks into the round button (FLIP animation)
//   compact the pill and the round button (LauncherButton); only the round button on phones
// Typing in the pill and sending, or clicking the doctor or the round button, calls onOpen(text). `stage` is the
// parent's remembered stage: a greeter that mounts as "compact" never plays the intro. `introKind` picks the video:
// "alpha" (transparent WebM) or "ios" (MP4 with a grey background, edges faded by the CSS mask). On phones there is no
// pill; the doctor stands over the round button's slot all the same.
const EASE = "cubic-bezier(.55,0,.25,1)";
const TICK_MS = 250;

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function DoctorGreeter({ stage, video = true, introKind = "alpha", unread = 0, text, setText, onOpen, onSettled }) {
  const [mode, setMode] = useState(stage === "intro" ? "intro" : "compact"); // intro | fly | compact
  const [pillShown, setPillShown] = useState(false);
  const [playing, setPlaying] = useState(false); // the intro video has started: the 10 s clock runs
  const [arrive, setArrive] = useState(false);
  const [popIn] = useState(() => stage !== "intro"); // a bar that was not flown in pops in
  const introVideoRef = useRef(null);
  const docRef = useRef(null);
  const slotRef = useRef(null);
  const inputRef = useRef(null);
  const circRef = useRef(null);
  const focusedRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const textRef = useRef(text);
  const refocusRef = useRef(false);
  textRef.current = text;
  const away = mode === "intro" && !pillShown;

  // The intro counts as played as soon as it starts, so a widget that remounts on the same page load (a route change
  // through a page without the chat) shows the compact bar.
  useEffect(() => {
    if (mode === "intro") markIntroPlayed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The parent asked for the compact bar (unread message, admin invite): no flight.
  useEffect(() => {
    if (stage !== "intro" && mode === "intro") setMode("compact");
  }, [stage, mode]);

  const toCompact = () => {
    setMode("compact");
    onSettled?.();
  };

  // Intro video: starts when it can play, shows the pill at SHOW_PILL_AT, loops from LOOP_FROM, and gives up (compact
  // bar, chat icon) if it cannot play or does not start in time.
  useEffect(() => {
    if (mode !== "intro") return undefined;
    const el = introVideoRef.current;
    if (!el) return undefined;
    mute(el);
    let started = false;
    const giveUp = () => {
      if (!started) toCompact();
    };
    const start = () => {
      el.play().catch(giveUp);
    };
    const onPlaying = () => {
      started = true;
      setPlaying(true);
      clearTimeout(timer);
    };
    const onTime = () => {
      if (el.currentTime >= SHOW_PILL_AT) setPillShown(true);
    };
    const onVisibility = () => {
      if (document.hidden) el.pause();
      else if (started) el.play().catch(() => {});
      else start();
    };
    const timer = setTimeout(() => {
      if (!document.hidden) giveUp();
    }, START_TIMEOUT_MS);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", onVisibility);
    const stopWatching = watchSources(el, () => toCompact());
    const stopLooping = keepLooping(el);
    if (el.readyState >= 3) start();
    else el.addEventListener("canplay", start, { once: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("canplay", start);
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatching();
      stopLooping();
      el.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // The 10 s clock only counts visible time while the patient is not typing or focused in the pill.
  useEffect(() => {
    if (mode !== "intro" || !playing) return undefined;
    let elapsed = 0;
    const timer = setInterval(() => {
      if (document.hidden || focusedRef.current || textRef.current.trim()) return;
      elapsed += TICK_MS;
      if (elapsed >= SHRINK_AFTER_MS) {
        clearInterval(timer);
        setMode("fly");
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [mode, playing]);

  // The flight (FLIP): only the doctor moves, from where he stands to the round button's slot, then the button takes
  // over. The pill is already in its final place and does not move.
  useLayoutEffect(() => {
    if (mode !== "fly") return undefined;
    const doc = docRef.current;
    const slot = slotRef.current;
    const animations = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      refocusRef.current = Boolean(doc && document.activeElement === doc);
      setArrive(true);
      toCompact();
    };
    const timer = setTimeout(finish, FLY_MS + 60);
    if (!doc || !slot || typeof doc.animate !== "function") {
      finish();
      return () => clearTimeout(timer);
    }
    const d = doc.getBoundingClientRect();
    const c = slot.getBoundingClientRect();
    const dx = c.left + c.width / 2 - (d.left + d.width * CHAR_CENTER);
    const dy = c.top + c.height / 2 - (d.top + d.height * 0.54);
    const scale = c.width / (d.width * 0.9);
    doc.style.transformOrigin = `${CHAR_CENTER * 100}% 54%`;
    const move = doc.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], { duration: FLY_MS, easing: EASE, fill: "forwards" });
    animations.push(move, doc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 620, fill: "forwards" }));
    move.finished.then(finish, () => {});
    return () => {
      done = true;
      clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // A flight that began with the keyboard on the doctor ends with the focus on the round button.
  useLayoutEffect(() => {
    if (mode === "compact" && refocusRef.current) {
      refocusRef.current = false;
      circRef.current?.focus();
    }
  }, [mode]);

  // iOS Safari does not resize the page when the keyboard opens, it covers the bottom: while the pill is focused the bar
  // is lifted by the part of the layout viewport the keyboard hides (--lcw-kb, read by .lcw-root).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!focused || !vv) return undefined;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--lcw-kb", `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--lcw-kb");
    };
  }, [focused]);

  const open = () => onOpen(text.trim());
  const typing = text.trim().length > 0;

  return (
    <div className={`lcw-gr-mini${popIn ? " is-pop" : ""}`}>
      <form
        className={`lcw-gr-minif${away ? " is-away" : ""}${typing ? " is-typing" : ""}`}
        autoComplete="off"
        inert={away}
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) inputRef.current?.focus();
          else open();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          maxLength={MAX_PILL_CHARS}
          placeholder="Write a message…"
          aria-label="Write a message"
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
          onFocus={() => {
            focusedRef.current = true;
            setFocused(true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            setFocused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
        />
        <button type="submit" aria-label="Send message">
          <SendIcon />
        </button>
      </form>
      <span ref={slotRef} className={`lcw-gr-slot${mode === "fly" ? " is-hidden" : ""}`}>
        {mode !== "intro" && <LauncherButton buttonRef={circRef} unread={unread} avatar={video} arrive={arrive} onOpen={open} />}
      </span>
      {mode !== "compact" && (
        <button ref={docRef} type="button" className={`lcw-gr-doc${introKind === "ios" ? " lcw-gr-doc--ios" : ""}`} onClick={open} aria-label="Open chat" aria-expanded="false">
          {introKind === "ios" ? (
            <video ref={introVideoRef} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} disablePictureInPicture disableRemotePlayback>
              <source src={IOS_MP4_SRC} type="video/mp4" />
            </video>
          ) : (
            <video ref={introVideoRef} muted playsInline preload="auto" poster={ALPHA_POSTER_SRC} aria-hidden="true" tabIndex={-1} disablePictureInPicture disableRemotePlayback>
              <source src={ALPHA_WEBM_SRC} type='video/webm; codecs="vp9"' />
            </video>
          )}
        </button>
      )}
    </div>
  );
}
