// Static checks for the doctor greeter, the round button and the held first message. Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AVATAR_MS,
  CHAT_MS,
  DARK_MS,
  LOOP_FROM,
  MP4_SRC,
  SHOW_PILL_AT,
  SHRINK_AFTER_MS,
  WEBM_SRC,
  introPlayedThisLoad,
  markIntroPlayed,
  nextStep,
  shouldPlayIntro,
} from "../src/features/livechat/greeterConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const launcher = strip(read("src/features/livechat/LauncherButton.jsx"));
const greeter = strip(read("src/features/livechat/DoctorGreeter.jsx"));
const widget = strip(read("src/features/livechat/LiveChatWidget.jsx"));
const form = strip(read("src/features/livechat/ContactForm.jsx"));
const css = strip(read("src/features/livechat/LiveChatWidget.css"));

const base = { reduced: false, saveData: false, width: 1280, played: false, open: false, invite: false };

test("timings match the approved design", () => {
  assert.equal(SHOW_PILL_AT, 3.2);
  assert.equal(LOOP_FROM, 4.0);
  assert.equal(SHRINK_AFTER_MS, 10_000);
  assert.equal(AVATAR_MS, 4200);
  assert.equal(DARK_MS, 500);
  assert.equal(CHAT_MS, 4500);
});

test("the round button cycles avatar -> dark -> chat icon -> avatar", () => {
  assert.deepEqual(nextStep("avatar"), { next: "dark", ms: AVATAR_MS });
  assert.deepEqual(nextStep("dark"), { next: "chat", ms: DARK_MS });
  assert.deepEqual(nextStep("chat"), { next: "avatar", ms: CHAT_MS });
});

test("the intro plays on every page load for everyone on a desktop; not on a phone, with the window open or an invite", () => {
  assert.equal(shouldPlayIntro(base), true);
  assert.equal(shouldPlayIntro({ ...base, played: true }), false, "already played on this page load");
  assert.equal(shouldPlayIntro({ ...base, open: true }), false, "chat window already open");
  assert.equal(shouldPlayIntro({ ...base, invite: true }), false, "an admin wrote to the visitor");
  assert.equal(shouldPlayIntro({ ...base, reduced: true }), false, "reduced motion");
  assert.equal(shouldPlayIntro({ ...base, saveData: true }), false, "data saver");
  assert.equal(shouldPlayIntro({ ...base, width: 480 }), false, "phone");
  assert.equal(shouldPlayIntro({ ...base, width: 481 }), true);
});

test("the played flag is page memory only: set once, no storage, and not read from the browser", () => {
  const config = strip(read("src/features/livechat/greeterConfig.js"));
  assert.equal(introPlayedThisLoad(), false);
  markIntroPlayed();
  assert.equal(introPlayedThisLoad(), true, "a remounted widget (route change) sees that the intro already played");
  assert.doesNotMatch(config, /sessionStorage|localStorage|hcLiveChatGreeted|wasGreeted|markGreeted/);
  assert.doesNotMatch(widget + greeter, /sessionStorage|localStorage|hcLiveChatGreeted|hasSession/);
  assert.match(widget, /played: introPlayedThisLoad\(\)/);
  assert.match(greeter, /markIntroPlayed\(\)/);
});

test("the ring has fixed pixel sizes and opts out of the site's global svg max-width/height rules", () => {
  assert.match(css, /\.lcw-gr-ring \{\s*position: absolute;\s*top: -4px;\s*left: -4px;\s*width: 72px;\s*height: 72px;\s*max-width: none;\s*max-height: none;/);
  assert.doesNotMatch(css, /\.lcw-gr-ring \{[^}]*calc\(100% \+ 8px\)/);
});

test("video sources are versioned and WebM comes before MP4", () => {
  assert.equal(WEBM_SRC, "/livechat/doctor.webm?v=1");
  assert.equal(MP4_SRC, "/livechat/doctor.mp4?v=1");
  for (const file of ["doctor.webm", "doctor.mp4", "poster.jpg"]) assert.ok(fs.existsSync(path.join(root, "public/livechat", file)), file);
  assert.ok(greeter.indexOf("src={WEBM_SRC}") < greeter.indexOf("src={MP4_SRC}"));
  assert.ok(launcher.indexOf("src={WEBM_SRC}") < launcher.indexOf("src={MP4_SRC}"));
});

test("videos are muted, inline, preloaded and aria-hidden; the avatar only shows after it has seeked past the walk-in", () => {
  for (const src of [greeter, launcher]) {
    assert.match(src, /muted playsInline preload="auto"/);
    assert.match(src, /mute\(/, "muted is also set as a DOM property for Safari/iOS");
    assert.match(src, /keepLooping\(/);
  }
  assert.match(launcher, /LOOP_FROM/);
  assert.match(launcher, /const shown = useVideo && ready \? phase : "chat"/);
  assert.match(launcher, /video\.currentTime = LOOP_FROM/);
});

test("pauses: hidden tab, and the avatar video whenever the avatar is not on screen", () => {
  assert.match(greeter, /document\.hidden/);
  assert.match(greeter, /addEventListener\("visibilitychange"/);
  assert.match(greeter, /removeEventListener\("visibilitychange"/);
  assert.match(launcher, /!tabHidden && phase !== "chat"/);
  assert.match(launcher, /video\.pause\(\)/);
});

test("the 10 s shrink clock only counts visible time while the pill is not focused or filled", () => {
  assert.match(greeter, /document\.hidden \|\| focusedRef\.current \|\| textRef\.current\.trim\(\)/);
  assert.match(greeter, /clearInterval\(timer\)/);
});

test("accessibility: named buttons and input, decorative video, pill hidden from keyboard until shown", () => {
  assert.match(greeter, /aria-label="Write a message"/);
  assert.match(greeter, /aria-label="Send message"/);
  assert.match(greeter, /aria-hidden="true" tabIndex=\{-1\}/);
  assert.match(greeter, /inert=\{!pillShown \|\| mode === "fly"\}/);
  assert.match(greeter, /event\.key === "Escape"/);
  assert.match(greeter, /circRef\.current\?\.focus\(\)/, "focus moves to the round button after the flight");
  assert.match(launcher, /aria-label="Open chat"/);
  assert.match(css, /\.lcw-root button:focus-visible/);
});

test("every class is .lcw-*; sizes, phone rule and reduced motion", () => {
  const classes = css.match(/\.[a-z][\w-]*/gi).filter((cls) => /\.(gr|ph|launcher|held)/i.test(cls) || /lcw-(gr|ph|launcher|held)/.test(cls));
  assert.ok(classes.length > 20);
  assert.ok(classes.every((cls) => cls.startsWith(".lcw-") || /^\.(\d)/.test(cls)), classes.filter((cls) => !cls.startsWith(".lcw-")).join(" "));
  assert.match(css, /\.lcw-launcher--round \{[^}]*width: 64px;[^}]*height: 64px;/);
  assert.match(css, /@media \(max-width: 480px\) \{\s*\.lcw-gr-ask,\s*\.lcw-gr-minif \{\s*display: none;/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^@]*\.lcw-gr-live i,[^@]*animation: none;/);
  assert.match(css, /right: max\(20px, env\(safe-area-inset-right, 0px\)\)/);
  assert.match(css, /ellipse 58% 54% at 52% 54%/, "the video edges are feathered with the radial mask");
});

test("the old launcher, greeting bubble and logo are gone", () => {
  assert.equal(fs.existsSync(path.join(root, "src/features/livechat/GreetingBubble.jsx")), false);
  assert.equal(fs.existsSync(path.join(root, "public/livechat/launcher-logo.png")), false);
  assert.doesNotMatch(widget, /GreetingBubble/);
  assert.doesNotMatch(css, /lcw-greet|lcw-launcher--logo|lcw-launcher-flip/);
});

test("held first message: kept while the form shows, sent by chat.send once the chat exists, restored if the window closes", () => {
  assert.match(widget, /const openWithText = \(text\) => \{\s*setStage\("compact"\);/);
  assert.match(widget, /heldText=\{held\}/);
  assert.match(widget, /chat\.send\(text\)/);
  assert.match(widget, /if \(!open\) \{\s*setPill\(held\)/, "closing before the chat starts puts the text back in the pill");
  assert.match(widget, /setDraft\(heldRef\.current\)/, "a chat that cannot take it gets it in the message box");
  assert.match(widget, /phase !== "chat"\) return;/, "nothing is sent while the contact form is up");
  assert.match(form, /Waiting to send/);
});

test("the unread badge sits on the round button and an unread message or admin invite ends the intro", () => {
  assert.match(launcher, /\{unread > 0 && <span className="lcw-badge">\{unread\}<\/span>\}/);
  assert.match(widget, /chat\.unread > 0 \|\| chat\.invite/);
  assert.match(css, /\.lcw-launcher--round \.lcw-badge \{\s*position: absolute;/);
});

test("chat disabled in admin settings: nothing mounts, so no video or poster is ever requested", () => {
  const loader = strip(read("src/features/livechat/LiveChatWidgetLoader.jsx"));
  assert.match(loader, /if \(!ENABLED \|\| !serverOn \|\| !publicPage\) return null;/);
  assert.match(loader, /lazy\(\(\) => import\("\.\/LiveChatWidget"\)\)/, "the greeter ships in the lazy widget chunk");
  assert.doesNotMatch(loader, /doctor\.(webm|mp4)|poster\.jpg|<video/);
  assert.doesNotMatch(read("index.html"), /livechat\/(doctor|poster)/, "no preload hint on the page");
});
