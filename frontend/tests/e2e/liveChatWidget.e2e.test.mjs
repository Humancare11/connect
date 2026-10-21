// Browser-level tests of the patient chat widget (real Chromium through playwright-core, no real DB / OpenAI).
//   npm run test:e2e   (from frontend/)
//
// - the widget is served by a Vite dev server from tests/e2e/harness (only the widget, no app);
// - /api/livechat/contact is answered inside the browser (page.route), so each test chooses the response;
// - the chat socket is a small socket.io server in this file (namespace /livechat) that plays the backend.
// The tests skip themselves when Chromium or the backend's socket.io package is not installed.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..");
const require = createRequire(import.meta.url);

function findBrowser() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), "AppData", "Local", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse();
    for (const dir of dirs) {
      for (const sub of ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-headless-shell-mac-arm64/chrome-headless-shell"]) {
        const candidate = path.join(root, dir, sub);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

let chromium;
let SocketServer;
let createServer;
let reactPlugin;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  SocketServer = require(path.join(frontendRoot, "..", "backend", "node_modules", "socket.io")).Server;
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

const TOKEN = "e2e-token";
const VISITOR = "e2e-visitor-0123456789";
const NOTICE_429 = "Too many attempts. Please wait a few minutes and try again.";

describe("live chat widget in a real browser", { skip: skipReason || false }, () => {
  let vite;
  let viteUrl;
  let httpServer;
  let io;
  let browser;
  let page;
  let context;
  const mock = { events: [], failNextMessage: false, conversation: null };

  const freshConversation = () => ({
    conversationId: "HCE2ETEST1",
    mode: "ai",
    canRequestAgent: true,
    canSwitchToAi: false,
    aiName: "Connect AI",
    optionsUsed: true,
    options: [],
    emailFollowUp: false,
    aiUnavailable: false,
    agent: null,
    rating: null,
    canRate: false,
    canContinue: false,
    closedReason: "",
    messages: [
      { id: "m1", sender: "ai", text: "Hi Dana! I'm Connect AI. How can I help you today?", at: new Date().toISOString() },
      { id: "m2", sender: "ai", text: "You can ask about our services, prices and booking.", at: new Date().toISOString() },
    ],
  });

  before(async () => {
    httpServer = http.createServer();
    io = new SocketServer(httpServer, { cors: { origin: "*" } });
    io.of("/livechat").on("connection", (socket) => {
      const reply = (event, handler) =>
        socket.on(event, (a, b) => {
          const [payload, ack] = typeof a === "function" ? [{}, a] : [a, b];
          mock.events.push([event, payload]);
          handler(payload || {}, ack);
        });
      reply("chat:resume", (_p, ack) => ack({ ok: true, needContact: false, firstName: "Dana", conversation: mock.conversation }));
      reply("chat:start", (_p, ack) => {
        mock.conversation ||= freshConversation(); // a patient who has never chatted gets a new chat here
        ack({ ok: true, conversation: mock.conversation });
      });
      reply("chat:end", (_p, ack) => ack({ ok: true }));
      reply("chat:message", (payload, ack) => {
        if (mock.failNextMessage) {
          mock.failNextMessage = false;
          return ack({ ok: false, error: "server_error" });
        }
        const message = { id: `p${mock.conversation.messages.length + 1}`, sender: "patient", text: payload.text, at: new Date().toISOString() };
        mock.conversation.messages.push(message);
        ack({ ok: true });
        socket.emit("chat:message", { conversationId: mock.conversation.conversationId, message });
        return undefined;
      });
      socket.on("chat:typing", () => {});
    });
    await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const socketUrl = `http://127.0.0.1:${httpServer.address().port}`;

    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: {
        "import.meta.env.VITE_API_URL": JSON.stringify(""),
        "import.meta.env.VITE_SOCKET_URL": JSON.stringify(socketUrl),
      },
      server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
      optimizeDeps: { entries: ["tests/e2e/harness/index.html"] },
    });
    await vite.listen();
    viteUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  });

  after(async () => {
    await context?.close();
    await browser?.close();
    await vite?.close();
    io?.close();
    httpServer?.close();
  });

  beforeEach(async () => {
    mock.events.length = 0;
    mock.failNextMessage = false;
    mock.conversation = freshConversation();
    await context?.close();
    context = await browser.newContext({ viewport: { width: 420, height: 800 }, reducedMotion: "reduce" }); // reduced motion: no intro, the launcher is the plain round button
    page = await context.newPage();
  });

  // A returning visitor: token and visitor id in the browser, the window already open.
  async function openAsReturningVisitor() {
    await page.addInitScript(
      ([token, visitor]) => {
        if (!sessionStorage.getItem("hcTestBooted")) {
          sessionStorage.setItem("hcTestBooted", "1");
          localStorage.setItem("hcLiveChatToken", token);
          localStorage.setItem("hcLiveChatVisitorId", visitor);
          sessionStorage.setItem("hcLiveChatOpen", "1");
        }
      },
      [TOKEN, VISITOR]
    );
    await page.goto(`${viteUrl}/tests/e2e/harness/index.html`);
    await page.waitForSelector(".lcw-window");
    await page.getByText("How can I help you today?").waitFor();
  }
  async function openAsNewVisitor() {
    await page.goto(`${viteUrl}/tests/e2e/harness/index.html`);
    await page.locator(".lcw-launcher").click();
    await page.waitForSelector(".lcw-cform");
  }
  const sentEvents = (name) => mock.events.filter(([event]) => event === name).map(([, payload]) => payload);
  const fillForm = async () => {
    await page.locator('.lcw-cform input[autocomplete="name"]').fill("Dana Reed");
    await page.locator('.lcw-cform input[type="email"]').fill("dana@example.com");
    await page.locator('.lcw-cform input[type="tel"]').fill("+918655835989");
  };

  describe("header buttons", () => {
    test("X opens 'End this chat?'; Cancel keeps the chat", async () => {
      await openAsReturningVisitor();
      await page.getByRole("button", { name: "End chat" }).first().click();
      await page.getByRole("heading", { name: "End this chat?" }).waitFor();
      assert.equal(await page.getByLabel("Also clear this chat from this device").isChecked(), false, "unchecked by default");
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("heading", { name: "End this chat?" }).waitFor({ state: "detached" });
      assert.ok(await page.locator(".lcw-window").isVisible());
      assert.equal(sentEvents("chat:end").length, 0);
    });

    test("End chat closes the chat on the server and the widget, and keeps the device's history", async () => {
      await openAsReturningVisitor();
      await page.locator(".lcw-head > .lcw-x").nth(1).click();
      await page.getByRole("dialog", { name: "End this chat?" }).getByRole("button", { name: "End chat" }).click();
      await page.waitForSelector(".lcw-window", { state: "detached" });
      assert.deepEqual(sentEvents("chat:end"), [{ clear: false }]);
      assert.equal(await page.evaluate(() => localStorage.getItem("hcLiveChatToken")), TOKEN, "the device still remembers the chat");
    });

    test("End chat with 'clear' forgets the token and the visitor on this device; the next visit shows the contact form", async () => {
      await openAsReturningVisitor();
      await page.locator(".lcw-head > .lcw-x").nth(1).click();
      await page.getByLabel("Also clear this chat from this device").check();
      await page.getByRole("dialog", { name: "End this chat?" }).getByRole("button", { name: "End chat" }).click();
      await page.waitForSelector(".lcw-window", { state: "detached" });
      assert.deepEqual(sentEvents("chat:end"), [{ clear: true }]);
      assert.equal(await page.evaluate(() => localStorage.getItem("hcLiveChatToken")), null);
      assert.equal(await page.evaluate(() => localStorage.getItem("hcLiveChatVisitorId")), null);
      await page.locator(".lcw-launcher").click();
      await page.waitForSelector(".lcw-cform");
    });

    test("'–' only minimises: the window folds into the launcher and nothing is ended", async () => {
      await openAsReturningVisitor();
      await page.getByRole("button", { name: "Minimize chat" }).click();
      await page.waitForSelector(".lcw-window", { state: "detached" });
      assert.ok(await page.locator(".lcw-launcher").isVisible());
      assert.equal(sentEvents("chat:end").length, 0);
      await page.locator(".lcw-launcher").click();
      await page.getByText("How can I help you today?").waitFor();
    });
  });

  describe("failed messages", () => {
    test("a failed message stays at the bottom with 'Not sent – tap to retry', and the retry delivers it", async () => {
      await openAsReturningVisitor();
      mock.failNextMessage = true;
      await page.getByLabel("Your message").fill("What does a consultation cost?");
      await page.getByLabel("Your message").press("Enter");
      const failed = page.locator(".lcw-msg--failed");
      await failed.waitFor();
      assert.match(await failed.innerText(), /Not sent – tap to retry/);
      const lastIsFailed = await page
        .locator(".lcw-body")
        .evaluate((body) => body.querySelector(".lcw-msg--failed") === [...body.children].filter((el) => !el.matches(".lcw-typing")).at(-1));
      assert.ok(lastIsFailed, "the failed bubble is the last thing in the chat");

      await failed.click(); // retry (the socket is connected, so it goes through)
      await page.locator(".lcw-msg--failed").waitFor({ state: "detached" });
      await page.locator(".lcw-msg--right", { hasText: "What does a consultation cost?" }).waitFor();
      assert.equal(sentEvents("chat:message").filter((p) => p.text === "What does a consultation cost?").length, 2, "sent twice: the failure and the retry");
    });
  });

  describe("Start chat error paths", () => {
    const contactCalls = [];
    beforeEach(() => {
      contactCalls.length = 0;
    });
    const answerContact = (respond) =>
      page.route("**/api/livechat/contact", async (route) => {
        contactCalls.push(JSON.parse(route.request().postData() || "{}"));
        await respond(route);
      });
    const ok = (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, visitorId: VISITOR, firstName: "Dana", token: TOKEN }) });

    test("too many attempts (429) shows the wait message", async () => {
      await answerContact((route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ msg: "slow down" }) }));
      await openAsNewVisitor();
      await fillForm();
      await page.getByRole("button", { name: /start chat/i }).click();
      await page.getByText(NOTICE_429).waitFor();
    });

    test("a network failure shows 'We couldn't reach the server'", async () => {
      await answerContact((route) => route.abort("failed"));
      await openAsNewVisitor();
      await fillForm();
      await page.getByRole("button", { name: /start chat/i }).click();
      await page.getByText("We couldn't reach the server. Please check your connection and try again.").waitFor();
    });

    test("the hidden field is filled (autofill): 'Please try again.', nothing is sent, and a second submit goes through", async () => {
      await answerContact(ok);
      await openAsNewVisitor();
      await fillForm();
      const hidden = page.locator('input[name="hc_ref_note"]');
      assert.equal(await hidden.getAttribute("autocomplete"), "hc-no-fill");
      assert.equal(await hidden.getAttribute("tabindex"), "-1");
      assert.equal(await page.locator(".lcw-hp").getAttribute("aria-hidden"), "true");
      assert.ok((await hidden.boundingBox()).x < -1000, "off-screen");
      await hidden.evaluate((input) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, "autofilled value");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.getByRole("button", { name: /start chat/i }).click();
      await page.getByText("Please try again.").waitFor();
      assert.equal(contactCalls.length, 0, "nothing was sent while the hidden field was filled");
      assert.equal(await hidden.inputValue(), "", "the field was cleared");

      await page.getByRole("button", { name: /start chat/i }).click(); // second submit, field empty
      await page.getByText("How can I help you today?").waitFor();
      assert.equal(contactCalls.length, 1);
      assert.equal(contactCalls[0].hcRefNote, "");
    });

    test("the server refusing a filled hidden field is also recoverable", async () => {
      let first = true;
      await answerContact((route) => {
        if (first) {
          first = false;
          return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ ok: false, error: "try_again", errors: { form: "Please try again." } }) });
        }
        return ok(route);
      });
      await openAsNewVisitor();
      await fillForm();
      await page.getByRole("button", { name: /start chat/i }).click();
      await page.getByText("Please try again.").waitFor();
      await page.getByRole("button", { name: /start chat/i }).click();
      await page.getByText("How can I help you today?").waitFor();
      assert.equal(contactCalls.length, 2);
    });
  });
  describe("doctor greeter and round button", () => {
    const launcher = () => page.locator(".lcw-launcher");
    const setHidden = (hidden) =>
      page.evaluate((value) => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    // A new browser context. `compact` starts with the window open (no intro) and minimises it: the compact bar.
    let compactStart = false;
    async function newPage({ width = 1280, height = 800, reducedMotion = false, compact = false, returning = false, userAgent, noVp9 = false } = {}) {
      compactStart = compact;
      await context?.close();
      context = await browser.newContext({ viewport: { width, height }, reducedMotion: reducedMotion ? "reduce" : "no-preference", ...(userAgent ? { userAgent } : {}) });
      page = await context.newPage();
      if (noVp9) await page.addInitScript(() => (HTMLVideoElement.prototype.canPlayType = () => ""));
      await page.addInitScript(
        ([isCompact, isReturning, token, visitor]) => {
          if (sessionStorage.getItem("hcTestBooted")) return;
          sessionStorage.setItem("hcTestBooted", "1");
          if (isCompact) sessionStorage.setItem("hcLiveChatOpen", "1");
          if (isReturning) {
            localStorage.setItem("hcLiveChatToken", token);
            localStorage.setItem("hcLiveChatVisitorId", visitor);
          }
        },
        [compact, returning, TOKEN, VISITOR]
      );
    }
    // The page clock runs normally until it is paused; the video itself always plays in real time.
    async function load({ clock = true } = {}) {
      if (clock) await page.clock.install({ time: Date.now() });
      await page.goto(`${viteUrl}/tests/e2e/harness/index.html`);
      if (compactStart) {
        await page.getByRole("button", { name: "Minimize chat" }).click();
        await page.locator(".lcw-launcher--round").waitFor();
      }
    }
    const freeze = async () => page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
    const tick = (ms) => page.clock.runFor(ms);
    const introPill = () => page.locator(".lcw-gr-minif:not(.is-away)");
    const answerContact = () =>
      page.route("**/api/livechat/contact", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, visitorId: VISITOR, firstName: "Dana", token: TOKEN }) })
      );
    // Real time: the page's own timers are frozen by the clock.
    const realWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const videoTime = () => page.locator(".lcw-gr-doc video").evaluate((v) => v.currentTime);

    test("intro: the doctor plays, the pill slides in at about 3.2 s with a grey arrow that turns black when typing, then he flies into the compact bar", async () => {
      await newPage();
      await load();
      const doctor = page.locator(".lcw-gr-doc");
      await doctor.waitFor();
      assert.equal(await doctor.getAttribute("aria-label"), "Open chat");
      assert.equal(await introPill().count(), 0, "no pill while he is still walking in");
      await introPill().waitFor({ timeout: 8000 });
      assert.ok((await videoTime()) >= 3.1, "the pill came in with the video, not before");
      const input = introPill().getByLabel("Write a message");
      assert.equal(await input.getAttribute("placeholder"), "Write a message…");
      const arrow = introPill().getByRole("button", { name: "Send message" });
      assert.equal(await arrow.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(230, 230, 230)");
      await input.fill("hi");
      await realWait(400); // the colour change is a 0.15 s CSS transition
      assert.equal(await arrow.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(17, 17, 17)");
      await input.fill("");
      await input.blur();
      await freeze();
      await tick(10500); // the 10 s clock counts visible, idle time
      await tick(1000);
      await page.locator(".lcw-launcher--round").waitFor();
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0, "the doctor is gone");
      await realWait(700); // the arrival animation
      const box = await launcher().boundingBox();
      assert.ok(Math.round(box.width) === 64 && Math.round(box.height) === 64, `round button is 64px (got ${box.width}x${box.height})`);
      assert.equal(await launcher().getAttribute("aria-label"), "Open chat");
      assert.ok(await page.locator(".lcw-gr-minif").isVisible());
    });


    test("the doctor stands on the compact bar's bottom line, there is no mask or background, and only he moves when he shrinks (the pill stays put)", async () => {
      await newPage();
      await load();
      await introPill().waitFor({ timeout: 8000 });
      await realWait(900); // the pill's slide-in
      await freeze();
      const intro = await page.evaluate(() => {
        const rect = (el) => el.getBoundingClientRect().toJSON();
        const doc = document.querySelector(".lcw-gr-doc");
        const video = doc.querySelector("video");
        return {
          doc: rect(doc),
          slot: rect(document.querySelector(".lcw-gr-slot")),
          pill: rect(document.querySelector(".lcw-gr-minif")),
          mask: getComputedStyle(video).maskImage || getComputedStyle(video).webkitMaskImage || "none",
          docBg: getComputedStyle(doc).backgroundColor,
          poster: video.getAttribute("poster"),
          src: video.querySelector("source").getAttribute("src"),
        };
      });
      assert.equal(intro.mask, "none", "no radial mask on the intro video");
      assert.equal(intro.docBg, "rgba(0, 0, 0, 0)", "no background behind the doctor");
      assert.equal(intro.src, "/livechat/doctor-alpha.webm?v=1");
      assert.equal(intro.poster, "/livechat/poster-alpha.webp?v=1");
      assert.ok(Math.abs(intro.doc.bottom - intro.slot.bottom) <= 2, `feet on the bar's bottom line: doctor ${intro.doc.bottom} vs bar ${intro.slot.bottom}`);
      assert.ok(Math.abs(intro.pill.top + intro.pill.height / 2 - (intro.slot.top + intro.slot.height / 2)) <= 1, "the pill is vertically centred on the bar");
      assert.ok(intro.pill.right <= intro.slot.left, "the pill is left of the round button's place");
      await tick(10_500); // he starts to fly; the animation itself runs in real time
      const pillAt = () => page.locator(".lcw-gr-minif").evaluate((el) => el.getBoundingClientRect().toJSON());
      const samples = [await pillAt()];
      for (let i = 0; i < 5; i += 1) {
        await realWait(150);
        samples.push(await pillAt());
      }
      await tick(1000);
      await launcher().waitFor();
      await realWait(700);
      samples.push(await pillAt());
      for (const r of samples) {
        for (const key of ["left", "top", "right", "bottom"]) assert.ok(Math.abs(r[key] - intro.pill[key]) <= 1, `the pill did not move (${key}: ${r[key]} vs ${intro.pill[key]})`);
      }
      const button = await launcher().boundingBox();
      assert.ok(Math.abs(button.y + button.height - intro.doc.bottom) <= 2, "the round button sits on the doctor's bottom line");
      assert.ok(Math.abs(button.x - intro.slot.left) <= 1.5, "the round button is where the slot was");
    });

    test("Safari/iOS (and a browser without VP9) get doctor-ios.mp4 with a soft edge mask, and the intro plays", async () => {
      const iosUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
      const macUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
      const cases = [
        { name: "Safari", options: { userAgent: macUa } },
        { name: "iPhone Chrome", options: { userAgent: iosUa.replace("Version/17.4 Mobile", "CriOS/124.0 Mobile") } },
        { name: "no VP9", options: { noVp9: true } },
      ];
      for (const { name, options } of cases) {
        await newPage(options);
        const requested = [];
        page.on("request", (request) => requested.push(request.url()));
        await load({ clock: false });
        const doctor = page.locator(".lcw-gr-doc");
        await doctor.waitFor();
        assert.ok(await doctor.evaluate((el) => el.classList.contains("lcw-gr-doc--ios")), `${name}: iOS variant`);
        assert.equal(await doctor.locator("source").getAttribute("src"), "/livechat/doctor-ios.mp4?v=1", name);
        assert.equal(await doctor.locator("video").getAttribute("poster"), null, `${name}: no poster (it would be transparent on grey)`);
        const mask = await doctor.locator("video").evaluate((v) => getComputedStyle(v).maskImage || getComputedStyle(v).webkitMaskImage);
        assert.match(mask, /radial-gradient/, `${name}: soft radial edge mask`);
        for (const attr of ["controls", "autoplay", "loop"]) assert.equal(await doctor.locator("video").getAttribute(attr), null, `${name}: no ${attr}`);
        assert.equal(await doctor.locator("video").evaluate((v) => v.muted && v.playsInline), true, `${name}: muted and inline`);
        await page.waitForFunction(() => document.querySelector(".lcw-gr-doc video")?.currentTime > 0.5, null, { timeout: 8000 });
        assert.equal(requested.filter((url) => url.includes("doctor-alpha")).length, 0, `${name}: the transparent video was not requested`);
      }
    });

    test("play() rejected (iOS Low Power Mode): the compact bar shows straight away", async () => {
      await newPage();
      await page.addInitScript(() => {
        HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("play() refused", "NotAllowedError"));
      });
      await load({ clock: false });
      await launcher().waitFor({ timeout: 8000 });
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0);
      assert.ok(await page.locator(".lcw-gr-minif").isVisible());
      await page.waitForFunction(() => document.querySelectorAll("video").length === 0, null, { timeout: 8000 }); // the avatar gives up too: the button is just the chat icon
    });

    test("after the video ends he loops only the standing part: never back to the walk-in", async () => {
      await newPage();
      await load();
      await introPill().waitFor({ timeout: 8000 });
      await freeze();
      await page.locator(".lcw-gr-doc video").evaluate((v) => {
        window.__times = [];
        v.addEventListener("timeupdate", () => window.__times.push(v.currentTime));
        v.currentTime = Math.max(0, v.duration - 0.6);
      });
      await realWait(3500);
      const seen = await page.evaluate(() => window.__times);
      const wrapped = seen.findIndex((t, i) => i > 0 && t < seen[i - 1] - 1);
      assert.ok(wrapped > 0, "the video reached its end and looped");
      assert.ok(Math.min(...seen.slice(wrapped)) >= 3.9, `after the loop it never goes below 4.0 s (min ${Math.min(...seen.slice(wrapped))})`);
      assert.equal(await page.locator(".lcw-gr-doc").count(), 1);
    });

    test("while the patient is typing or has text in the pill the doctor does not shrink", async () => {
      await newPage();
      await load();
      await introPill().waitFor({ timeout: 8000 });
      await freeze();
      await introPill().getByLabel("Write a message").fill("I have a question");
      await tick(30_000);
      assert.equal(await page.locator(".lcw-gr-doc").count(), 1);
      assert.equal(await page.locator(".lcw-launcher--round").count(), 0);
      await introPill().getByLabel("Write a message").fill("");
      await introPill().getByLabel("Write a message").blur();
      await tick(10_500);
      await tick(1000);
      await page.locator(".lcw-launcher--round").waitFor();
    });

    test("the avatar never shows the walk-in, has a LIVE badge and a ring, and cycles avatar -> black -> chat icon -> avatar", async () => {
      await newPage({ compact: true });
      await load();
      await page.locator(".lcw-ph-avatar").waitFor({ timeout: 8000 });
      assert.equal((await page.locator(".lcw-gr-live").innerText()).trim(), "LIVE");
      assert.equal(await page.locator(".lcw-gr-prog").evaluate((el) => getComputedStyle(el).animationName), "lcw-gr-ringfill");
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0, "no intro");
      // Sample the avatar video for a while: whenever the avatar is visible the video is at 4.0 s or later.
      const walkIn = await page.locator(".lcw-gr-cav video").evaluate(
        (v) =>
          new Promise((resolve) => {
            const cav = v.closest(".lcw-gr-cav");
            let bad = 0;
            let visible = 0;
            const timer = setInterval(() => {
              if (Number(getComputedStyle(cav).opacity) > 0.05) {
                visible += 1;
                if (v.currentTime < 3.95) bad += 1;
              }
            }, 30);
            setTimeout(() => {
              clearInterval(timer);
              resolve({ bad, visible });
            }, 1500);
          })
      );
      assert.ok(walkIn.visible > 10, "the avatar was on screen");
      assert.equal(walkIn.bad, 0, "the walk-in was never visible in the avatar");
      await freeze();
      await tick(4300);
      await page.locator(".lcw-ph-dark").waitFor();
      await tick(600);
      await page.locator(".lcw-ph-chat").waitFor();
      await realWait(600); // the icon fades in
      assert.equal(await page.locator(".lcw-gr-chatico").evaluate((el) => getComputedStyle(el).opacity), "1");
      assert.equal(await page.locator(".lcw-gr-cav video").evaluate((v) => v.paused), true, "the video is paused while the chat icon shows");
      await tick(4600);
      await page.locator(".lcw-ph-avatar").waitFor();
    });

    test("typing in the pill and sending opens the chat with the form; the text waits, then is sent as the first message after Start chat", async () => {
      await newPage();
      mock.conversation = null; // no chat yet: the server creates it on chat:start
      await load();
      await answerContact();
      await introPill().waitFor({ timeout: 8000 });
      await introPill().getByLabel("Write a message").fill("I need a prescription refill");
      await introPill().getByLabel("Write a message").press("Enter");
      await page.waitForSelector(".lcw-cform");
      assert.equal((await page.locator(".lcw-held-text").innerText()).trim(), "I need a prescription refill");
      assert.match(await page.locator(".lcw-held small").innerText(), /Waiting to send/);
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0, "the greeter is gone while the window is open");
      assert.equal(sentEvents("chat:message").length, 0, "nothing is sent before the form");
      await fillForm();
      await page.getByRole("button", { name: "Start chat" }).click();
      await page.locator(".lcw-msg--right", { hasText: "I need a prescription refill" }).waitFor();
      const order = mock.events.map(([event]) => event);
      assert.ok(order.indexOf("chat:start") !== -1 && order.indexOf("chat:start") < order.indexOf("chat:message"), `chat:start comes before the first message (${order})`);
      assert.deepEqual(sentEvents("chat:message"), [{ text: "I need a prescription refill" }], "sent once, exactly as typed");
      assert.equal(await page.locator(".lcw-held").count(), 0);
    });

    test("clicking the round button with text typed in the compact pill holds the text the same way", async () => {
      await newPage({ compact: true });
      await load({ clock: false });
      await answerContact();
      await page.getByLabel("Write a message").fill("Do you take insurance?");
      await launcher().click();
      await page.waitForSelector(".lcw-cform");
      assert.equal((await page.locator(".lcw-held-text").innerText()).trim(), "Do you take insurance?");
      await fillForm();
      await page.getByRole("button", { name: "Start chat" }).click();
      await page.locator(".lcw-msg--right", { hasText: "Do you take insurance?" }).waitFor();
      assert.equal(sentEvents("chat:message").length, 1);
    });

    test("closing the window before the chat starts puts the typed text back in the pill", async () => {
      await newPage({ compact: true });
      await load({ clock: false });
      await page.getByLabel("Write a message").fill("Hello there");
      await page.getByRole("button", { name: "Send message" }).click();
      await page.waitForSelector(".lcw-cform");
      await page.getByRole("button", { name: "Minimize chat" }).click();
      await page.locator(".lcw-launcher--round").waitFor();
      await page.waitForFunction(() => document.querySelector(".lcw-gr-minif input")?.value === "Hello there"); // restored right after the window closes
      assert.equal(sentEvents("chat:message").length, 0);
    });

    test("a returning patient also gets the intro, and a message typed in its pill goes straight into the chat", async () => {
      await newPage({ returning: true });
      mock.conversation = freshConversation();
      await load({ clock: false });
      await page.locator(".lcw-gr-doc").waitFor();
      await introPill().waitFor({ timeout: 8000 });
      await introPill().getByLabel("Write a message").fill("Is the doctor available today?");
      await introPill().getByRole("button", { name: "Send message" }).click();
      await page.locator(".lcw-msg--right", { hasText: "Is the doctor available today?" }).waitFor();
      assert.equal(await page.locator(".lcw-cform").count(), 0);
      assert.deepEqual(sentEvents("chat:message"), [{ text: "Is the doctor available today?" }]);
    });

    test("clicking the doctor opens the chat; closing it brings back the compact bar, not the intro", async () => {
      await newPage();
      await load();
      await page.locator(".lcw-gr-doc").click();
      await page.waitForSelector(".lcw-cform");
      assert.equal(await page.locator("video").count(), 0, "no video plays while the window is open");
      await page.getByRole("button", { name: "Minimize chat" }).click();
      await page.locator(".lcw-launcher--round").waitFor();
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0);
      assert.equal(await page.locator(".lcw-gr-minif.is-away").count(), 0, "the pill is in place at once, not sliding in again");
    });

    test("the intro plays again on every reload and in every new tab", async () => {
      await newPage();
      await load();
      await page.locator(".lcw-gr-doc").waitFor();
      await page.reload();
      await page.locator(".lcw-gr-doc").waitFor();
      assert.equal(await page.locator(".lcw-launcher--round").count(), 0, "a reload starts with the intro, not the compact bar");
      const second = await context.newPage();
      await second.goto(`${viteUrl}/tests/e2e/harness/index.html`);
      await second.locator(".lcw-gr-doc").waitFor();
    });

    test("the ring, the circle and the LIVE badge are fully visible, in the viewport and not clipped, with the site's global svg rule and the cookie banner", async () => {
      for (const [width, height] of [
        [1280, 800],
        [1440, 900],
        [390, 844],
      ]) {
        await newPage({ width, height, compact: true });
        await load({ clock: false });
        // what index.css does to every svg on the real site
        await page.addStyleTag({ content: "img,video,canvas,svg{max-width:100%;height:auto}" });
        await page.locator(".lcw-ph-avatar").waitFor({ timeout: 8000 });
        await realWait(700); // the pop-in animation
        for (const banner of [false, true]) {
          await page.evaluate((on) => document.documentElement.classList.toggle("hc-cookie-open", on), banner);
          await realWait(100);
          const report = await page.evaluate(() => {
            const button = document.querySelector(".lcw-launcher--round");
            const ring = document.querySelector(".lcw-gr-ring");
            const live = document.querySelector(".lcw-gr-live");
            const box = (el) => el.getBoundingClientRect();
            const clippers = [];
            for (let el = button; el && el !== document.documentElement; el = el.parentElement) {
              const cs = getComputedStyle(el);
              if (el !== button && (cs.overflow !== "visible" || cs.clipPath !== "none" || cs.contain.includes("paint"))) clippers.push(el.className || el.tagName);
            }
            return { b: box(button), r: box(ring), l: box(live), w: innerWidth, h: innerHeight, clippers };
          });
          const label = `${width}x${height} banner=${banner}`;
          assert.deepEqual(report.clippers, [], `${label}: no ancestor clips the button`);
          assert.equal(Math.round(report.b.width), 64, label);
          assert.equal(Math.round(report.r.width), 72, `${label}: ring is 72px wide (got ${report.r.width})`);
          assert.equal(Math.round(report.r.height), 72, `${label}: ring is 72px tall (got ${report.r.height})`);
          assert.equal(Math.round(report.r.left), Math.round(report.b.left) - 4, `${label}: ring is centred on the button`);
          assert.equal(Math.round(report.r.top), Math.round(report.b.top) - 4, `${label}: ring is centred on the button`);
          for (const [name, r] of [["button", report.b], ["ring", report.r], ["LIVE badge", report.l]]) {
            assert.ok(r.left >= 0 && r.top >= 0 && r.right <= report.w && r.bottom <= report.h, `${label}: ${name} inside the viewport ${JSON.stringify(r)}`);
          }
          assert.ok(report.l.left >= report.b.left && report.l.right <= report.b.right && report.l.bottom <= report.b.bottom, `${label}: LIVE badge inside the circle`);
        }
      }
    });

    test("a hidden tab pauses the videos and holds the 10 s clock", async () => {
      await newPage();
      await load();
      await introPill().waitFor({ timeout: 8000 });
      await freeze();
      await setHidden(true);
      assert.equal(await page.locator(".lcw-gr-doc video").evaluate((v) => v.paused), true);
      await tick(30_000);
      assert.equal(await page.locator(".lcw-gr-doc").count(), 1, "the intro waits while the tab is hidden");
      await setHidden(false);
      await page.locator(".lcw-gr-doc video").evaluate((v) => v.paused).then((paused) => assert.equal(paused, false));
      await tick(10_500);
      await tick(1000);
      await page.locator(".lcw-launcher--round").waitFor();
    });

    test("prefers-reduced-motion: no video, no flying; the compact bar with the chat icon only", async () => {
      await newPage({ reducedMotion: true });
      await load({ clock: false });
      await page.locator(".lcw-launcher--round").waitFor();
      assert.equal(await page.locator("video").count(), 0);
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0);
      assert.equal(await page.locator(".lcw-gr-live").count(), 0);
      assert.equal(await page.locator(".lcw-gr-chatico").evaluate((el) => getComputedStyle(el).opacity), "1");
      assert.equal(await page.locator(".lcw-ph-chat").count(), 1);
    });

    test("phone (390x844): the intro plays with the transparent video, no pill, feet on the button's line, flies into the round button, all inside the viewport", async () => {
      await newPage({ width: 390, height: 844 });
      await load();
      const doctor = page.locator(".lcw-gr-doc");
      await doctor.waitFor();
      assert.equal(await doctor.locator("source").getAttribute("src"), "/livechat/doctor-alpha.webm?v=1", "Chromium gets the transparent video");
      assert.equal(await doctor.evaluate((el) => el.classList.contains("lcw-gr-doc--ios")), false);
      assert.equal(await page.locator(".lcw-gr-minif").evaluate((el) => getComputedStyle(el).display), "none", "no pill on phones");
      await page.waitForFunction(() => document.querySelector(".lcw-gr-doc video")?.currentTime > 0.5, null, { timeout: 8000 });
      for (const banner of [false, true]) {
        await page.evaluate((on) => document.documentElement.classList.toggle("hc-cookie-open", on), banner);
        await realWait(100);
        const m = await page.evaluate(() => {
          const rect = (el) => el.getBoundingClientRect().toJSON();
          return { doc: rect(document.querySelector(".lcw-gr-doc")), slot: rect(document.querySelector(".lcw-gr-slot")), w: innerWidth, h: innerHeight };
        });
        const label = `banner=${banner}`;
        assert.ok(m.doc.height >= 140 && m.doc.height <= 171, `${label}: about 150px tall, 170px at most (got ${m.doc.height})`);
        assert.ok(Math.abs(m.doc.bottom - m.slot.bottom) <= 2, `${label}: feet on the round button's bottom line (${m.doc.bottom} vs ${m.slot.bottom})`);
        assert.ok(m.doc.left >= 0 && m.doc.top >= 0 && m.doc.right <= m.w && m.doc.bottom <= m.h, `${label}: the doctor is inside the viewport ${JSON.stringify(m.doc)}`);
        assert.ok(m.slot.right <= m.w - 16, `${label}: the button's place keeps its margin`);
      }
      await page.evaluate(() => document.documentElement.classList.remove("hc-cookie-open"));
      const before = await page.locator(".lcw-gr-slot").boundingBox();
      await freeze();
      await tick(10_500);
      await tick(1000);
      await launcher().waitFor();
      await realWait(700);
      assert.equal(await page.locator(".lcw-gr-doc").count(), 0, "the doctor flew into the button");
      const button = await launcher().boundingBox();
      assert.ok(Math.abs(button.x - before.x) <= 1.5 && Math.abs(button.y - before.y) <= 1.5, "the button is exactly where the doctor was heading");
      assert.ok(button.x >= 0 && button.y >= 0 && button.x + button.width <= 390 && button.y + button.height <= 844, "button inside the viewport");
      await page.locator(".lcw-ph-avatar").waitFor({ timeout: 8000 });
    });

    test("phone: tapping the doctor opens the chat", async () => {
      await newPage({ width: 390, height: 844 });
      await load();
      await page.locator(".lcw-gr-doc").click();
      await page.waitForSelector(".lcw-cform");
      assert.equal(await page.locator(".lcw-held").count(), 0);
    });

    test("the unread badge sits on the round button, and the keyboard reaches both the pill and the button", async () => {
      await newPage({ compact: true, returning: true });
      mock.conversation = freshConversation();
      await load({ clock: false });
      await page.locator(".lcw-launcher--round").waitFor();
      await page.waitForFunction(() => true);
      for (let i = 0; i < 50 && !sentEvents("chat:resume").length; i += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      io.of("/livechat").emit("chat:message", {
        conversationId: mock.conversation.conversationId,
        message: { id: "a1", sender: "agent", agentName: "Sam", text: "Hello, this is Sam.", at: new Date().toISOString() },
      });
      await page.locator(".lcw-launcher--round .lcw-badge").waitFor();
      assert.equal((await page.locator(".lcw-launcher--round .lcw-badge").innerText()).trim(), "1");
      await page.getByLabel("Write a message").focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Send message");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Open chat");
      await page.keyboard.press("Enter");
      await page.getByText("Hello, this is Sam.").waitFor();
      assert.equal(await page.locator(".lcw-badge").count(), 0, "opening clears the badge");
    });
  });
});
