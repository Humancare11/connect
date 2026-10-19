// Static checks for the redesigned live chat launcher and greeting. Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const launcher = read("src/features/livechat/LauncherButton.jsx");
const greeting = read("src/features/livechat/GreetingBubble.jsx");
const css = read("src/features/livechat/LiveChatWidget.css");

test("front face is the existing launcher logo, which is a real PNG with an alpha channel", () => {
  assert.match(launcher, /LOGO_SRC = "\/livechat\/launcher-logo\.png"/);
  const png = fs.readFileSync(path.join(root, "public/livechat/launcher-logo.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png[25], 6, "RGBA colour type, so the area outside the border is transparent");
});

test("flip every 3s, with hover, focus, hidden-tab and reduced-motion pauses, and the timer is cleaned up", () => {
  assert.match(launcher, /FLIP_EVERY_MS = 3000/);
  assert.match(launcher, /setInterval\(/);
  assert.match(launcher, /clearInterval\(/);
  assert.match(launcher, /hovered \|\| focused \|\| tabHidden \|\| reduced/);
  assert.match(launcher, /addEventListener\("visibilitychange"/);
  assert.match(launcher, /removeEventListener\("visibilitychange"/);
  assert.match(css, /\.lcw-launcher-flip \{[^}]*transition: transform 0\.6s/);
  assert.match(css, /rotateY\(180deg\)/);
});

test("accessibility: label kept, faces hidden from screen readers, greeting is a status region", () => {
  assert.match(launcher, /aria-label="Open chat"/);
  assert.match(launcher, /className="lcw-launcher-flip" aria-hidden="true"/);
  assert.match(greeting, /role="status"/);
  assert.match(css, /\.lcw-launcher:focus-visible/);
});

test("size: 56px, 48px at 480px and narrower, and every launcher and greeting class is .lcw-*", () => {
  assert.match(css, /\.lcw-launcher--logo \{\s*width: 56px;/);
  assert.match(css, /@media \(max-width: 480px\) \{\s*\.lcw-launcher--logo \{\s*width: 48px;/);
  const classes = css.match(/\.[a-z][\w-]*/g).filter((cls) => /launcher|greet/.test(cls));
  assert.ok(classes.length > 0);
  assert.ok(classes.every((cls) => cls.startsWith(".lcw-")));
});

test("reduced motion removes the back face and the bouncing dots", () => {
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^@]*\.lcw-launcher-back \{\s*display: none;[^@]*\.lcw-launcher-dots i,\s*\.lcw-greet-dots i \{\s*animation: none;/);
});

test("greeting: dots for 1.2s before the message; show rules and the X are unchanged", () => {
  assert.match(greeting, /TYPING_MS = 1200/);
  assert.match(greeting, /const DELAY_MS = 3000/);
  assert.match(greeting, /Are you looking to consult with a doctor\?/);
  assert.match(greeting, /aria-label="Dismiss greeting"/);
  assert.match(css, /border-radius: 18px 18px 5px 18px/);
});
