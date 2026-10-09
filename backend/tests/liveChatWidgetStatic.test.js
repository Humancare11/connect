const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// What can be checked without a browser: patient-facing wording, scroll rules and Turnstile settings.
// (The real wheel / touch / Turnstile behaviour is checked in a browser run, see docs/live-chat.md.)
const ROOT = path.join(__dirname, "..", "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const FEATURE = path.join("frontend", "src", "features", "livechat");

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
// every quoted / template string and JSX text run that mentions "offline"
const offlineStrings = (src) => {
  const code = stripComments(src);
  const found = [];
  for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (/offline/i.test(m[2])) found.push(m[2]);
  for (const m of code.matchAll(/>([^<>{}\n]*offline[^<>{}\n]*)</gi)) found.push(m[1]);
  return found;
};

describe("live chat: patient-facing wording", () => {
  test("no patient-facing string in the widget says the team is offline or talks about support hours", () => {
    for (const file of fs.readdirSync(path.join(ROOT, FEATURE)).filter((f) => /\.(jsx?|css)$/.test(f))) {
      const strings = offlineStrings(read(FEATURE, file)).filter((s) => s !== "offline"); // "offline" = the socket state value
      assert.deepEqual(strings, [], `${file}: ${strings.join(" | ")}`);
    }
    const widget = stripComments(read(FEATURE, "LiveChatWidget.jsx"));
    assert.doesNotMatch(widget, /support hours|Team offline/i);
    assert.match(widget, /Message received/);
    assert.match(widget, /Humancare AI · Online/);
  });

  test("backend texts a patient can read never say offline (older saved texts are only listed so they can be replaced)", () => {
    const allowed = new Set([
      "Our team is offline right now. Leave your request and we'll reply to your email as soon as we're back.",
      "Our team is offline right now. We've saved your request and will reply by email.",
    ]);
    const patientFacing = [
      ["services", "liveChat", "chatService.js"],
      ["services", "liveChat", "followUpEmail.js"],
      ["services", "liveChat", "settingsDefaults.js"],
      ["services", "liveChat", "aiService.js"],
    ];
    for (const parts of patientFacing) {
      const strings = offlineStrings(read("backend", ...parts)).filter((s) => !allowed.has(s));
      assert.deepEqual(strings, [], `${parts.at(-1)}: ${strings.join(" | ")}`);
    }
    // agentService: the only "offline" strings are team-only lines (internal: true) and the log/reason codes
    const agent = offlineStrings(read("backend", "services", "liveChat", "agentService.js"));
    assert.deepEqual(agent.sort(), ["Asked for an agent while the team was offline."].concat(agent.filter((s) => /went offline|agent_offline/.test(s))).sort());
  });

  test("the default 'no agent available' text is the approved thank-you with the patient's name and email", () => {
    const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");
    assert.equal(
      DEFAULT_SETTINGS.offlineMessage,
      "Thanks, {firstName}! We've received your question and details. Our team will get back to you at {email} shortly."
    );
  });
});

describe("live chat: widget scrolling rules", () => {
  const css = read(FEATURE, "LiveChatWidget.css");
  const rule = (selector) => {
    const m = css.match(new RegExp(`(?:^|\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
    return m ? m[1] : "";
  };

  test("the message area is a shrinkable, scrollable flex child that does not leak scrolling to the page", () => {
    const body = rule(".lcw-body");
    assert.match(body, /flex:\s*1/);
    assert.match(body, /min-height:\s*0/);
    assert.match(body, /overflow-y:\s*auto/);
    assert.match(body, /overscroll-behavior:\s*contain/);
    assert.match(rule(".lcw-body > *"), /flex-shrink:\s*0/);
    assert.match(rule(".lcw-window"), /flex-direction:\s*column/);
  });

  test("the site's smooth scroller (Lenis) is told to leave the widget alone", () => {
    const widget = read(FEATURE, "LiveChatWidget.jsx");
    assert.equal((widget.match(/data-lenis-prevent/g) || []).length, 2, "window and message area");
  });

  test("no wheel / touch handler in the widget blocks scrolling", () => {
    for (const file of fs.readdirSync(path.join(ROOT, FEATURE)).filter((f) => /\.jsx?$/.test(f))) {
      const src = stripComments(read(FEATURE, file));
      assert.doesNotMatch(src, /onWheel|onTouchMove|["']wheel["']|["']touchmove["']/, file);
    }
  });
});

describe("live chat: Turnstile stays invisible unless Cloudflare needs the person", () => {
  test("interaction-only appearance, and the container is collapsed until a challenge is shown", () => {
    const ts = read(FEATURE, "turnstile.js");
    assert.match(ts, /appearance:\s*"interaction-only"/);
    assert.match(ts, /before-interactive-callback/);
    assert.match(read(FEATURE, "ContactForm.jsx"), /lcw-captcha\$\{challenge \? " is-active" : ""\}/);
    const css = read(FEATURE, "LiveChatWidget.css");
    const hidden = css.match(/\.lcw-captcha\s*\{([^}]*)\}/)[1];
    assert.match(hidden, /width:\s*1px/);
    assert.match(hidden, /opacity:\s*0/);
    assert.match(css, /\.lcw-captcha\.is-active\s*\{[^}]*min-height:\s*65px/);
  });

  test("the 'for testing only' widget can only come from Cloudflare's dev test keys; a real key needs the env var", () => {
    const ts = read(FEATURE, "turnstile.js");
    assert.match(ts, /TEST_SITE_KEY = "1x00000000000000000000AA"/);
    assert.match(ts, /VITE_TURNSTILE_SITE_KEY \|\| \(import\.meta\.env\.DEV \? TEST_SITE_KEY : ""\)/, "the test key is DEV-only");
    const server = read("backend", "services", "liveChat", "turnstile.js");
    assert.match(server, /secret/i, "the server check is kept");
  });
});
