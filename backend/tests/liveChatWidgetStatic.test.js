const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// What can be checked without a browser: patient-facing wording and scroll rules.
// (The real wheel / touch behaviour is checked in a browser run, see docs/live-chat.md.)
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
    assert.match(widget, /let status = "Online"/);
  });

  test("backend texts a patient can read never say offline", () => {
    const patientFacing = [
      ["services", "liveChat", "chatService.js"],
      ["services", "liveChat", "followUpEmail.js"],
      ["services", "liveChat", "settingsDefaults.js"],
      ["services", "liveChat", "aiService.js"],
    ];
    for (const parts of patientFacing) {
      const strings = offlineStrings(read("backend", ...parts));
      assert.deepEqual(strings, [], `${parts.at(-1)}: ${strings.join(" | ")}`);
    }
    // agentService: the only "offline" strings are team-only lines (internal: true) and the log/reason codes
    const agent = offlineStrings(read("backend", "services", "liveChat", "agentService.js"));
    assert.deepEqual(agent.filter((s) => !/went offline|agent_offline/.test(s)), []);
  });

  test("the patient texts for a hand-over are the approved wording", () => {
    const chat = read("backend", "services", "liveChat", "chatService.js");
    assert.ok(chat.includes("Thanks, ${name}! Connecting you to our team now. You can keep typing your question here."));
    assert.ok(chat.includes("Our team will connect with you by email at ${email || \"your email address\"} shortly."));
  });
});

describe("live chat: daily chat limit in the widget", () => {
  test("when the limit is hit the chat body shows only the limit message and the input is disabled", () => {
    const hook = read(FEATURE, "useLiveChat.js");
    assert.match(hook, /chat_limit: "You've reached today's chat limit\. Please try again tomorrow or email support@humancareconnect\.co\."/);
    assert.match(hook, /res\.error === "chat_limit"\) setLimitReached\(true\)/);
    const widget = read(FEATURE, "LiveChatWidget.jsx");
    assert.match(widget, /!conversation && limitReached && \(/);
    assert.match(widget, /!conversation && !limitReached && <div className="lcw-sys">Starting your chat/);
    assert.match(widget, /limitReached \? "Chat is unavailable today" : locked \? "Fill in the form to start"/);
  });
});

describe("live chat: the AI's name comes from one setting", () => {
  const OLD_NAME = /Humancare AI|HumanCare AI|Humancare['’]s AI|Humancare Assistant/i;
  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "tests", "dist", "dist-ssr", "uploads"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(jsx?|css|json)$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  test("no hard-coded old AI name in frontend/src or backend (the one old-default constant for the migration excepted)", () => {
    const hits = [];
    for (const file of [...walk(path.join(ROOT, "frontend", "src")), ...walk(path.join(ROOT, "backend"))]) {
      if (file.endsWith(path.join("services", "liveChat", "settingsDefaults.js"))) continue; // OLD_DEFAULT_GREETING lives here
      if (OLD_NAME.test(fs.readFileSync(file, "utf8"))) hits.push(path.relative(ROOT, file));
    }
    assert.deepEqual(hits, []);
    const defaults = read("backend", "services", "liveChat", "settingsDefaults.js");
    assert.equal((defaults.match(/Humancare AI/g) || []).length, 1, "only the old default greeting mentions it");
  });

  test("the widget shows the server's AI name in the header, the message label and the typing line", () => {
    const widget = read(FEATURE, "LiveChatWidget.jsx");
    assert.match(widget, /conversation\?\.aiName \|\| configAiName/);
    assert.match(widget, /: aiName\}<\/strong>/);
    assert.match(widget, /: aiName\}<\/span>/);
    assert.match(widget, /\{aiName\} is typing/);
    assert.doesNotMatch(widget, /AI Healthcare Coordinator/);
    assert.match(read("frontend", "src", "pages", "admin", "livechat", "ChatConversation.jsx"), /const label = ai \? aiName :/);
  });

  test("the system prompt uses the name and says it is an AI, never a person, doctor or nurse", () => {
    const { buildSystemPrompt } = require("../services/liveChat/aiService");
    const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");
    for (const [settings, name] of [[DEFAULT_SETTINGS, "Connect AI"], [{ ...DEFAULT_SETTINGS, aiDisplayName: "Nova" }, "Nova"], [{ prices: [] }, "Connect AI"]]) {
      const prompt = buildSystemPrompt(settings);
      assert.ok(prompt.startsWith(`You are ${name},`), name);
      assert.ok(prompt.includes(`Never claim to be a person, a doctor or a nurse. If the patient asks who or what you are, say you are an AI assistant.`));
      assert.ok(prompt.includes(`I'm ${name}, an AI assistant for Humancare Connect`), "the off-topic example uses the name");
      assert.doesNotMatch(prompt, /\{AI_NAME\}/);
    }
  });
});

describe("live chat: doctor greeter and round button", () => {
  const widget = stripComments(read(FEATURE, "LiveChatWidget.jsx"));
  const launcher = stripComments(read(FEATURE, "LauncherButton.jsx"));
  const greeter = stripComments(read(FEATURE, "DoctorGreeter.jsx"));
  const css = stripComments(read(FEATURE, "LiveChatWidget.css"));
  // the declarations of the first `selector { ... }` rule (plain string search, selectors are matched literally)
  const rule = (selector) => {
    const at = css.indexOf(`${selector} {`);
    return at === -1 ? "" : css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  };

  test("the closed launcher is a real 'Open chat' button (the round button, and the doctor in the intro)", () => {
    assert.match(launcher, /aria-label="Open chat"/);
    assert.match(greeter, /className=\{`lcw-gr-doc[^>]*aria-label="Open chat"/);
    assert.match(widget, /<DoctorGreeter/);
    assert.doesNotMatch(widget, /GreetingBubble|LOGO_SRC|lcw-launcher--logo/);
  });

  test("the old H logo launcher and the greeting bubble are gone", () => {
    assert.equal(fs.existsSync(path.join(ROOT, FEATURE, "GreetingBubble.jsx")), false);
    assert.equal(fs.existsSync(path.join(ROOT, "frontend", "public", "livechat", "launcher-logo.png")), false);
    assert.doesNotMatch(css, /lcw-launcher--(logo|hc|flipped)|lcw-launcher-(flip|face|dots)|lcw-greet/);
  });

  test("the video and poster are shipped, versioned and same-origin", () => {
    const dir = path.join(ROOT, "frontend", "public", "livechat");
    for (const file of ["doctor.webm", "doctor.mp4", "poster.jpg", "doctor-alpha.webm", "poster-alpha.webp"]) assert.ok(fs.statSync(path.join(dir, file)).size > 1000, file);
    const config = read(FEATURE, "greeterConfig.js");
    assert.match(config, /VIDEO_VERSION = "\?v=1"/);
    assert.match(config, /WEBM_SRC = `\/livechat\/doctor\.webm\$\{VIDEO_VERSION\}`/);
    assert.match(config, /MP4_SRC = `\/livechat\/doctor\.mp4\$\{VIDEO_VERSION\}`/);
    assert.match(config, /ALPHA_WEBM_SRC = `\/livechat\/doctor-alpha\.webm\$\{VIDEO_VERSION\}`/);
    assert.match(config, /ALPHA_POSTER_SRC = `\/livechat\/poster-alpha\.webp\$\{VIDEO_VERSION\}`/);
    assert.ok(launcher.indexOf("src={WEBM_SRC}") < launcher.indexOf("src={MP4_SRC}"), "the avatar lists WebM before MP4");
  });

  test("round button: 64px, black circle, and on phones the pill shares its row", () => {
    assert.match(rule(".lcw-launcher--round"), /width:\s*64px/);
    assert.match(rule(".lcw-launcher--round"), /border-radius:\s*50%/);
    assert.match(css, /@media \(max-width: 480px\) \{[^@]*--gr-gut-r:/);
  });
});

describe("live chat: widget header status", () => {
  const widget = read(FEATURE, "LiveChatWidget.jsx");
  const css = read(FEATURE, "LiveChatWidget.css");

  test("no status dots at all: not on the avatar, not before the status text, in any state", () => {
    assert.doesNotMatch(widget, /lcw-dot(?![s-])/, "no dot element in the header");
    assert.doesNotMatch(widget, /lcw-dot-sm/);
    assert.doesNotMatch(css, /\.lcw-dot(?![s-])|\.lcw-dot-sm/, "no dot styles left");
    assert.doesNotMatch(css, /fbbf24|#22c55e|#4ade80|--wait/i, "no green or amber status colours left");
    assert.match(widget, /<small>\s*<span title=\{status\}>/, "only the status text sits in the status line");
  });

  test("waiting text is 'Connecting to our team' and the status line wraps instead of truncating", () => {
    assert.match(widget, /"Connecting to our team"/);
    assert.doesNotMatch(widget, /Connecting you with a live agent/);
    const span = css.match(/\.lcw-who small span\s*\{([^}]*)\}/)[1];
    assert.match(span, /white-space:\s*normal/);
    assert.doesNotMatch(span, /text-overflow|nowrap/);
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

describe("live chat: no Turnstile / Cloudflare captcha", () => {
  test("the widget, server and build no longer load or check Turnstile", () => {
    for (const file of ["ContactForm.jsx", "useLiveChat.js", "LiveChatWidget.css"]) {
      assert.doesNotMatch(read(FEATURE, file), /turnstile|captcha|challenges\.cloudflare/i, file);
    }
    for (const gone of [[FEATURE, "turnstile.js"], ["backend", "services", "liveChat", "turnstile.js"]]) {
      assert.equal(fs.existsSync(path.join(ROOT, ...gone)), false, gone.join("/"));
    }
    assert.doesNotMatch(read("backend", "routes", "liveChatPublic.js"), /verifyTurnstile|captcha/i);
    assert.doesNotMatch(read("backend", ".env.example"), /TURNSTILE/i);
  });

  test("the honeypot stays in the form, with nothing a browser would autofill", () => {
    const form = read(FEATURE, "ContactForm.jsx");
    assert.match(form, /name="hc_ref_note"/);
    const block = form.slice(form.indexOf('className="lcw-hp"'), form.indexOf("</div>", form.indexOf('className="lcw-hp"')));
    assert.match(block, /aria-hidden="true"/);
    assert.match(block, /tabIndex={-1}/);
    assert.match(block, /autoComplete="hc-no-fill"/);
    assert.doesNotMatch(block, /company|website|url|autoComplete="(?:name|email|tel|url|organization|off)"/i);
    assert.match(read(FEATURE, "LiveChatWidget.css"), /.lcw-hp {[^}]*left: -9999px/);
    const hook = read(FEATURE, "useLiveChat.js");
    assert.match(hook, /hcRefNote/);
    assert.doesNotMatch(hook, /companyUrl/);
  });
});
