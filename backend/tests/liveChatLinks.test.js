const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startChatServer } = require("./helpers/liveChatServer");
const { createSitePages } = require("../services/liveChat/sitePages");
const { build, SERVICE_PAGES } = require("../scripts/buildLiveChatSitePages");
const { buildSystemPrompt, SCHEMA, validate } = require("../services/liveChat/aiService");

const ROOT = path.join(__dirname, "..", "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const stored = require("../data/liveChatSitePages.json");

describe("live chat: page links come from a server allowlist built from the app's own routes", () => {
  test("the committed allowlist is up to date with App.jsx and searchIndex.js", () => {
    const { pages } = build({ appSource: read("frontend/src/App.jsx"), indexSource: read("frontend/src/data/searchIndex.js") });
    assert.deepEqual(stored, pages, "run: node backend/scripts/buildLiveChatSitePages.js");
  });

  test("every allowlisted page is an active route and a safe path; every service page is included", () => {
    const app = read("frontend/src/App.jsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const routes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
    for (const page of stored) {
      assert.ok(routes.has(page.url), `${page.url} is not routed in App.jsx`);
      assert.match(page.url, /^\/[A-Za-z0-9\-/&]*$/, page.url);
      assert.ok(page.title.length > 1);
    }
    for (const s of SERVICE_PAGES) assert.ok(stored.some((p) => p.url === s.url), `${s.url} missing`);
    assert.ok(stored.some((p) => p.url === "/appointment-booking"));
    assert.ok(stored.filter((p) => p.type === "condition").length > 50);
  });

  const sitePages = createSitePages();

  test("filterLinks keeps only allowlisted urls, uses the list's own title, drops invented and external urls, caps at 3", () => {
    const out = sitePages.filterLinks([
      { title: "Totally legit", url: "https://evil.example/phish" },
      { title: "Hacked title", url: "/appointment-booking" },
      { title: "x", url: "/made-up-page" },
      { title: "x", url: "//evil.example" },
      { title: "x", url: "javascript:alert(1)" },
      { title: "x", url: "/doctors-note" },
      { title: "dup", url: "/doctors-note" },
      "/online-prescription-refills",
      "/lab-requisitions",
      { nope: true },
      null,
    ]);
    assert.deepEqual(out.map((l) => l.url), ["/appointment-booking", "/doctors-note", "/online-prescription-refills"]);
    assert.equal(out[0].title, "Book an appointment");
    assert.deepEqual(sitePages.filterLinks("not an array"), []);
    assert.deepEqual(sitePages.filterLinks(undefined), []);
  });

  test("candidates match the patient's words (fever, UTI, sick note, second opinion, booking) and always include booking", () => {
    const urls = (text) => sitePages.candidatesFor(text).map((p) => p.url);
    assert.ok(urls("I have a fever since yesterday").some((u) => u.endsWith("/fever")));
    assert.ok(urls("burning when I pee, maybe a UTI").some((u) => u.includes("urinary-tract-infection")));
    assert.ok(urls("can I get a sick note?").includes("/doctors-note"));
    assert.ok(urls("I want a second opinion on my diagnosis").includes("/online-second-medical-opinion"));
    assert.ok(urls("how do I book?").includes("/appointment-booking"));
    assert.ok(urls("zzzz qqqq").includes("/appointment-booking"));
  });

  test("the prompt lists only the candidate pages and keeps the safety rules; the schema has links", () => {
    const pages = [{ title: "Fever", url: "/general-and-everyday-care/general-physician/fever" }];
    const prompt = buildSystemPrompt({ prices: [], handoffRules: {} }, pages);
    assert.ok(prompt.includes("Fever -> /general-and-everyday-care/general-physician/fever"));
    assert.ok(prompt.includes("never invent a url"));
    assert.ok(prompt.includes("Never diagnose"));
    assert.ok(buildSystemPrompt({ prices: [], handoffRules: {} }, []).includes("always return an empty links array"));
    assert.ok(SCHEMA.required.includes("links"));
    assert.equal(SCHEMA.properties.links.items.additionalProperties, false);
    assert.deepEqual(validate({ reply: "ok", handoff: false, handoffReason: "none", topic: "other" }).links, []);
  });

  describe("in a chat", () => {
    let lc;
    before(async () => {
      lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    });
    after(async () => {
      await lc.close();
    });
    beforeEach(() => {
      lc.ai.calls.length = 0;
      lc.ai.queue.length = 0;
    });
    async function openChat() {
      const contact = await lc.submitContact();
      const socket = await lc.chatSocket(contact.token);
      await lc.call(socket, "chat:start", {});
      return socket;
    }
    const reply = (extra) => ({
      ok: true, reply: "The fever page has details and you can book there.", handoff: false, handoffReason: "none", topic: "other",
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50, costUsd: 0.0001 }, ...extra,
    });

    test("the AI gets only matching pages; real links reach the patient, invented ones are dropped", async () => {
      const socket = await openChat();
      lc.ai.queue.push(
        reply({
          links: [
            { title: "Fever – learn more", url: "/general-and-everyday-care/general-physician/fever" },
            { title: "Fake", url: "https://phishing.example/login" },
            { title: "Invented", url: "/fever-cure-now" },
            { title: "Book", url: "/appointment-booking" },
          ],
        })
      );
      await lc.call(socket, "chat:message", { text: "I have a fever" });
      assert.ok(lc.ai.calls[0].pages.some((p) => p.url.endsWith("/fever")), "the model was shown the fever page");
      assert.ok(lc.ai.calls[0].pages.length <= 15);
      const state = (await lc.call(socket, "chat:resume")).conversation;
      const last = state.messages.at(-1);
      assert.equal(last.sender, "ai");
      assert.deepEqual(last.links.map((l) => l.url), ["/general-and-everyday-care/general-physician/fever", "/appointment-booking"]);
      assert.equal(JSON.stringify(state).includes("phishing"), false);
      assert.equal(JSON.stringify(state).includes("fever-cure-now"), false);
      socket.close();
    });

    test("a reply with no links shows no buttons; a reply without a links field works too", async () => {
      const socket = await openChat();
      lc.ai.queue.push(reply({ links: [] }), reply({ links: undefined }));
      await lc.call(socket, "chat:message", { text: "hello" });
      await lc.call(socket, "chat:message", { text: "hello again" });
      const state = (await lc.call(socket, "chat:resume")).conversation;
      assert.equal(state.messages.filter((m) => m.links).length, 0);
      socket.close();
    });

    test("quick-option replies carry their page link", async () => {
      const socket = await openChat();
      await lc.call(socket, "chat:option", { key: "sick_notes" });
      const last = (await lc.call(socket, "chat:resume")).conversation.messages.at(-1);
      assert.equal(last.sender, "ai");
      assert.deepEqual(last.links, [{ title: "Doctor's note (sick note)", url: "/doctors-note" }]);
      socket.close();
    });

    test("settings accept an allowlisted option link and refuse any other", async () => {
      const current = (await lc.rest("GET", "/settings")).body.settings;
      const options = (link) => current.quickOptions.map((o, i) => (i === 0 ? { ...o, link } : o));
      const bad = await lc.rest("PUT", "/settings", { role: "superadmin", body: { quickOptions: options("https://evil.example") } });
      assert.equal(bad.status, 400);
      assert.ok(bad.body.errors["quickOptions.0.link"]);
      const good = await lc.rest("PUT", "/settings", { role: "superadmin", body: { quickOptions: options("/lab-requisitions") } });
      assert.equal(good.status, 200);
      assert.equal((await lc.rest("GET", "/settings")).body.settings.quickOptions[0].link, "/lab-requisitions");
      assert.ok((await lc.rest("GET", "/settings")).body.linkPages.some((p) => p.url === "/appointment-booking"));
    });
  });
});
