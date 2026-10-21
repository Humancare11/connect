import { useEffect, useLayoutEffect, useRef, useState } from "react";
import LauncherButton from "./LauncherButton";
import {
  FLY_MS,
  MAX_PILL_CHARS,
  MP4_SRC,
  POSTER_SRC,
  SHOW_PILL_AT,
  SHRINK_AFTER_MS,
  START_TIMEOUT_MS,
  WEBM_SRC,
  keepLooping,
  markGreeted,
  mute,
  watchSources,
} from "./greeterConfig";

// What the patient sees while the chat is closed (docs/chat-greeter-demo.html):
//   intro   the doctor walks in and waves at the bottom-right, a "Write a message…" pill slides in beside him
//   fly     after SHRINK_AFTER_MS of visible, idle time he shrinks into the round button (FLIP animation)
//   compact the pill and the round button (LauncherButton); only the round button on phones
// Typing in either pill and sending, or clicking the doctor or the round button, calls onOpen(text). `stage` is the
// parent's remembered stage: a greeter that mounts as "compact" never plays the intro.
const EASE = "cubic-bezier(.55,0,.25,1)";
const TICK_MS = 250;

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Pill({ className, text, setText, onSubmit, formRef, inputRef, onFocus, onBlur, inert }) {
  const typing = text.trim().length > 0;
  return (
    <form
      ref={formRef}
      className={`${className}${typing ? " is-typing" : ""}`}
      autoComplete="off"
      inert={inert}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
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
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
      />
      <button type="submit" aria-label="Send message">
        <SendIcon />
      </button>
    </form>
  );
}

export default function DoctorGreeter({ stage, video = true, unread = 0, text, setText, onOpen, onSettled }) {
  const [mode, setMode] = useState(stage === "intro" ? "intro" : "compact"); // intro | fly | compact
  const [pillShown, setPillShown] = useState(false);
  const [playing, setPlaying] = useState(false); // the intro video has started: the 10 s clock runs
  const [arrive, setArrive] = useState(false);
  const [popIn] = useState(() => stage !== "intro"); // a bar that was not flown in pops in
  const introVideoRef = useRef(null);
  const docRef = useRef(null);
  const askFormRef = useRef(null);
  const askInputRef = useRef(null);
  const miniFormRef = useRef(null);
  const miniInputRef = useRef(null);
  const circRef = useRef(null);
  const focusedRef = useRef(false);
  const textRef = useRef(text);
  const refocusRef = useRef(false);
  textRef.current = text;

  // The intro counts as played as soon as it starts, so later pages of this session show the compact bar.
  useEffect(() => {
    if (mode === "intro") markGreeted();
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

  // The flight (FLIP): the doctor and the pill move from where they are to where the compact bar is already laid out
  // (hidden), then the compact bar takes over.
  useLayoutEffect(() => {
    if (mode !== "fly") return undefined;
    const doc = docRef.current;
    const ask = askFormRef.current;
    const circ = circRef.current;
    const miniForm = miniFormRef.current;
    const animations = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      refocusRef.current = Boolean(doc && (document.activeElement === doc || ask?.contains(document.activeElement)));
      setArrive(true);
      toCompact();
    };
    const timer = setTimeout(finish, FLY_MS + 60);
    if (!doc || !circ || typeof doc.animate !== "function") {
      finish();
      return () => clearTimeout(timer);
    }
    const d = doc.getBoundingClientRect();
    const c = circ.getBoundingClientRect();
    const dx = c.left + c.width / 2 - (d.left + d.width / 2);
    const dy = c.top + c.height / 2 - (d.top + d.height * 0.54);
    const scale = c.width / (d.width * 0.9);
    doc.style.transformOrigin = "50% 54%";
    const move = doc.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], { duration: FLY_MS, easing: EASE, fill: "forwards" });
    animations.push(move, doc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 620, fill: "forwards" }));
    const a = ask?.getBoundingClientRect();
    const m = miniForm?.getBoundingClientRect();
    if (a && m && a.width > 0 && m.width > 0) {
      ask.style.transformOrigin = "0 0";
      animations.push(
        ask.animate(
          [{ transform: "none" }, { transform: `translate(${m.left - a.left}px, ${m.top - a.top}px) scale(${m.width / a.width}, ${m.height / a.height})` }],
          { duration: FLY_MS, easing: EASE, fill: "forwards" }
        )
      );
    }
    move.finished.then(finish, () => {});
    return () => {
      done = true;
      clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // A flight that began with the keyboard on the doctor or the pill ends with the focus on the round button.
  useLayoutEffect(() => {
    if (mode === "compact" && refocusRef.current) {
      refocusRef.current = false;
      circRef.current?.focus();
    }
  }, [mode]);

  const open = () => onOpen(text.trim());
  const sendFrom = (inputRef) => () => {
    if (!text.trim()) inputRef.current?.focus();
    else open();
  };
  const onFocus = () => {
    focusedRef.current = true;
  };
  const onBlur = () => {
    focusedRef.current = false;
  };

  return (
    <>
      {mode !== "compact" && (
        <div key="intro" className="lcw-gr">
          <div className={`lcw-gr-ask${pillShown ? " is-show" : ""}`}>
            <Pill
              className="lcw-gr-form"
              text={text}
              setText={setText}
              onSubmit={sendFrom(askInputRef)}
              formRef={askFormRef}
              inputRef={askInputRef}
              onFocus={onFocus}
              onBlur={onBlur}
              inert={!pillShown || mode === "fly"}
            />
          </div>
          <button ref={docRef} type="button" className="lcw-gr-doc" onClick={open} aria-label="Open chat" aria-expanded="false">
            <video ref={introVideoRef} muted playsInline preload="auto" poster={POSTER_SRC} aria-hidden="true" tabIndex={-1}>
              <source src={WEBM_SRC} type='video/webm; codecs="vp9"' />
              <source src={MP4_SRC} type="video/mp4" />
            </video>
          </button>
        </div>
      )}
      {mode !== "intro" && (
        <div key="mini" className={`lcw-gr-mini${mode === "fly" ? " is-measuring" : ""}${popIn ? " is-pop" : ""}`}>
          <Pill
            className="lcw-gr-minif"
            text={text}
            setText={setText}
            onSubmit={sendFrom(miniInputRef)}
            formRef={miniFormRef}
            inputRef={miniInputRef}
            onFocus={onFocus}
            onBlur={onBlur}
            inert={mode === "fly"}
          />
          <LauncherButton buttonRef={circRef} unread={unread} avatar={video} arrive={arrive} onOpen={open} />
        </div>
      )}
    </>
  );
}
