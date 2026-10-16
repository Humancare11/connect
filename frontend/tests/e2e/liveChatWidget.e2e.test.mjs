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
      reply("chat:start", (_p, ack) => ack({ ok: true, conversation: mock.conversation }));
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
    context = await browser.newContext({ viewport: { width: 420, height: 800 } });
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
});
