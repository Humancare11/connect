const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer } = require("./helpers/liveChatServer");
const { createSitePages } = require("../services/liveChat/sitePages");
const { createSiteCatalog, buildPages } = require("../services/liveChat/siteCatalog");
const { titlesFor } = require("../services/liveChat/pageSynonyms");
const { buildSystemPrompt } = require("../services/liveChat/aiService");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");
const safety = require("../services/liveChat/safety");
const fallback = require("../data/liveChatSitePages.json");

const rows = () => ({
  categories: [
    { _id: "c1", name: "Eye, Ear & Bone", isActive: true },
    { _id: "c2", name: "Hidden Category", isActive: false },
  ],
  specialties: [
    { _id: "s1", categoryId: "c1", name: "Orthopedics", aliases: ["bones"], isActive: true },
    { _id: "s2", categoryId: "c2", name: "Under Hidden", isActive: true },
  ],
  conditions: [
    { _id: "d1", specialtyId: "s1", name: "Joint Pain", aliases: ["aching joints"], route: "/joint-pain", isActive: true },
    { _id: "d2", specialtyId: "s1", name: "Heel Pain", aliases: [], route: "/eye-ear-bone/orthopedics/heel-pain", isActive: true },
    { _id: "d3", specialtyId: "s1", name: "Bad Route", aliases: [], route: "https://evil.example/x", isActive: true },
    { _id: "d4", specialtyId: "s1", name: "Switched Off", aliases: [], route: "/off", isActive: false },
    { _id: "d5", specialtyId: "s2", name: "Hidden Parent", aliases: [], route: "/hidden", isActive: true },
  ],
});

describe("live chat: the AI's page list comes from the site's database (siteCatalog)", () => {
  test("builds categories, specialties and conditions; keeps service pages; drops inactive, hidden and unsafe ones; no blogs", () => {
    const pages = buildPages(rows(), fallback);
    const urls = pages.map((p) => p.url);
    assert.ok(urls.includes("/joint-pain") && urls.includes("/eye-ear-bone/orthopedics/heel-pain"));
    assert.ok(urls.includes("/appointment-booking") && urls.includes("/telemedicine-cost-usa"), "service pages stay");
    assert.equal(pages.some((p) => /Hidden|Switched|Bad Route/.test(p.title)), false);
    const dbOnly = pages.filter((p) => p.type === "condition" && ["Joint Pain", "Heel Pain"].includes(p.title));
    assert.equal(dbOnly.length, 2);
    assert.equal(pages.filter((p) => p.url === "/joint-pain").length, 1, "no duplicate url when the database and the static list agree");
    assert.equal(new Set(pages.map((p) => p.type)).has("blog"), false);
    // a specialty with a real page uses its url; the category's real page too
    assert.equal(pages.find((p) => p.title === "Orthopedics").url, "/eye-ear-bone/orthopedics");
    assert.equal(pages.find((p) => p.title === "Eye, Ear & Bone").url, "/eye-ear-bone");
    // aliases become keywords, and the booking pre-filter names are kept
    const joint = pages.find((p) => p.url === "/joint-pain");
    assert.deepEqual([joint.category, joint.specialty], ["Eye, Ear & Bone", "Orthopedics"]);
    assert.ok(joint.keywords.includes("aching joints"));
  });

  test("static condition pages stay when the database has few; Book opens on the matching database specialty", () => {
    const pages = buildPages({ categories: rows().categories, specialties: rows().specialties, conditions: [] }, fallback);
    const knee = pages.find((p) => p.url === "/eye-ear-bone/orthopedics/knee-pain");
    assert.ok(knee, "the static Knee Pain page is kept");
    assert.deepEqual([knee.category, knee.specialty], ["Eye, Ear & Bone", "Orthopedics"]);
    assert.equal(createSitePages(pages).bookingFor(knee.url).url, "/appointment-booking/eye-ear-bone/orthopedics");
    const chest = pages.find((p) => p.url === "/chronic-care/cardiology/chest-pain");
    assert.equal(chest.category, undefined, "no database specialty with that title: plain booking page");
  });

  test("a specialty or category without a real page gets the booking page for it", () => {
    const pages = buildPages({ categories: [{ _id: "c", name: "Brand New Care", isActive: true }], specialties: [{ _id: "s", categoryId: "c", name: "New Spec", isActive: true }], conditions: [{ _id: "d", specialtyId: "s", name: "Thing", route: "/thing", isActive: true }] }, fallback);
    assert.equal(pages.find((p) => p.title === "Brand New Care").url, "/appointment-booking/brand-new-care");
    assert.equal(pages.find((p) => p.title === "New Spec").url, "/appointment-booking/brand-new-care/new-spec");
  });

  test("cached for 10 minutes, one read at a time; an error serves the last good list; nothing usable -> null", async () => {
    let clock = 0;
    let reads = 0;
    let fail = false;
    let data = rows();
    const find = (key) => () => ({
      select: () => ({
        lean: async () => {
          if (key === "categories") reads += 1;
          if (fail) throw new Error("db down");
          return data[key];
        },
      }),
    });
    const models = {
      HealthcareCategory: { find: find("categories") },
      HealthcareSpecialty: { find: find("specialties") },
      HealthcareCondition: { find: find("conditions") },
    };
    const catalog = createSiteCatalog({ models, fallbackPages: fallback, now: () => clock });
    const [a, b] = await Promise.all([catalog.load(), catalog.load()]);
    assert.equal(reads, 1, "parallel loads share one read");
    assert.equal(a, b);
    clock = 9 * 60_000;
    assert.equal(await catalog.load(), a);
    assert.equal(reads, 1, "still cached");
    clock = 10 * 60_000 + 1;
    fail = true;
    assert.equal(await catalog.load(), a, "the last good list is served on an error");
    assert.equal(reads, 2);
    const empty = createSiteCatalog({ models, fallbackPages: fallback, now: () => clock });
    data = { categories: [], specialties: [], conditions: [] };
    fail = false;
    assert.equal(await empty.load(), null, "an empty database: keep the static list");
    const broken = createSiteCatalog({ models, fallbackPages: fallback, now: () => clock });
    fail = true;
    assert.equal(await broken.load(), null);
  });

  test("sitePages.refresh swaps the live list in and ignores an empty or failing source", async () => {
    const live = buildPages(rows(), fallback);
    let answer = live;
    const sp = createSitePages(undefined, { source: async () => answer });
    assert.equal(sp.has("/joint-pain"), true, "static list has /joint-pain too");
    assert.equal(sp.has("/eye-ear-bone/orthopedics/heel-pain"), false);
    await sp.refresh();
    assert.equal(sp.has("/eye-ear-bone/orthopedics/heel-pain"), true);
    answer = null;
    await sp.refresh();
    assert.equal(sp.has("/eye-ear-bone/orthopedics/heel-pain"), true, "null keeps the current list");
    const failing = createSitePages(undefined, { source: async () => { throw new Error("x"); } });
    await failing.refresh();
    assert.equal(failing.has("/appointment-booking"), true);
  });
});

describe("live chat: lay words find the page (English, Hindi/Hinglish, Spanish)", () => {
  const sp = createSitePages();
  const titles = (text) => sp.hintFor(text).map((p) => p.title);

  test("the synonym map", () => {
    assert.deepEqual(titlesFor("hi ai please suggest me something i have pain in my legs").slice(0, 3), ["Joint Pain", "Knee Pain", "Orthopedics"]);
    assert.ok(titles("hi ai please suggest me something i have pain in my legs").includes("Joint Pain"));
    assert.ok(titles("my knees hurt").includes("Knee Pain"));
    assert.ok(titles("ghutne me dard hai").includes("Knee Pain"));
    assert.ok(titles("sar dard ki dawai").includes("Headache"));
    assert.ok(titles("sugar badh gayi hai").includes("Type 2 Diabetes"));
    assert.ok(titles("do I have diabetes").includes("Type 2 Diabetes"));
    assert.ok(titles("me duele la cabeza, dolor de cabeza").includes("Headache"));
    assert.ok(titles("me duelen las rodillas").includes("Knee Pain"));
    assert.ok(titles("मुझे सिर दर्द है").includes("Headache"));
    assert.ok(titles("I get bad headaches").includes("Headache"), "plural");
    assert.deepEqual(titles("how much is a consultation?"), []);
    assert.deepEqual(titles("what dose of paracetamol"), [], "a medicine alone names no page");
  });

  test("only pages that exist are returned (a missing title is skipped)", () => {
    const small = createSitePages([{ type: "condition", title: "Knee Pain", url: "/knee", keywords: [] }, { type: "service", title: "Book an appointment", url: "/appointment-booking", keywords: [] }]);
    assert.deepEqual(small.hintFor("pain in my legs").map((p) => p.url), ["/knee"]);
  });
});

describe("live chat: the links of a reply (arrange)", () => {
  const live = buildPages(rows(), fallback);
  const sp = createSitePages(live);
  const urls = (links) => links.map((l) => l.url);

  test("matched page first, booking card last and opened on the matched specialty", () => {
    const links = sp.arrange([{ title: "x", url: "/appointment-booking" }, { title: "x", url: "/joint-pain" }], { medical: true });
    assert.deepEqual(urls(links), ["/joint-pain", "/appointment-booking/eye-ear-bone/orthopedics"]);
    assert.equal(links[1].title, "Book an appointment");
  });

  test("no page from the model: the server uses the lay-word match; none matches: booking only", () => {
    assert.deepEqual(urls(sp.arrange([], { medical: true, hintText: "pain in my legs" })), ["/joint-pain", "/appointment-booking/eye-ear-bone/orthopedics"]);
    assert.deepEqual(urls(sp.arrange([], { medical: true, hintText: "what dose of paracetamol" })), ["/appointment-booking"]);
  });

  test("setting OFF: booking only, whatever the model or the map says", () => {
    assert.deepEqual(urls(sp.arrange([{ url: "/joint-pain" }], { allowContent: false, medical: true, hintText: "pain in my legs" })), ["/appointment-booking"]);
    assert.deepEqual(sp.pagesForPrompt({ allowContent: false }).some((p) => sp.isContent(p.url)), false);
    assert.equal(sp.pagesForPrompt({ allowContent: true }).some((p) => sp.isContent(p.url)), true);
  });

  test("invented urls are dropped; a non-medical reply keeps the model's order and gets no extra booking card", () => {
    assert.deepEqual(urls(sp.arrange([{ url: "https://evil.example" }, { url: "/telemedicine-cost-usa" }, { url: "/made-up" }], { medical: false })), ["/telemedicine-cost-usa"]);
    assert.deepEqual(urls(sp.arrange([{ url: "/doctors-note" }, { url: "/appointment-booking" }], { medical: false })), ["/doctors-note", "/appointment-booking"]);
  });

  test("at most 3 cards, and the booking card is never the one dropped", () => {
    const links = sp.arrange([{ url: "/joint-pain" }, { url: "/doctors-note" }, { url: "/telemedicine-cost-usa" }, { url: "/appointment-booking" }], { medical: true });
    assert.equal(links.length, 3);
    assert.equal(links[0].url, "/joint-pain");
    assert.ok(links[2].url.startsWith("/appointment-booking"));
  });

  test("the model sees every page title and path, and a short hint", () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS, sp.pagesForPrompt({ allowContent: true }), { pageHint: ["Joint Pain"] });
    assert.match(prompt, /- Joint Pain -> \/joint-pain/);
    assert.match(prompt, /- Heel Pain -> /);
    assert.match(prompt, /HINT: .*Joint Pain/);
    assert.match(prompt, /MEDICAL REPLY SHAPE/);
  });
});

describe("live chat: warmer fixed strings and replies still pass the reply filter", () => {
  test("every fixed fallback string passes checkReply and starts warmly", () => {
    for (const kind of ["fallback", "fallbackMedication"]) {
      for (const lang of ["en", "hi", "es"]) {
        const text = safety.FIXED_TEXT[kind][lang];
        assert.equal(safety.checkReply(text).blocked, false, `${kind}.${lang}`);
        assert.match(text, /Book here:$|यहां बुक करें:$|Reserve aquí:$/);
      }
    }
    assert.match(safety.FIXED_TEXT.fallback.en, /^Sorry you're not feeling well\./);
    assert.match(safety.FIXED_TEXT.fallback.en, /by video/);
  });

  test("the opener, the refusal and the page name are not blocked; advice still is", () => {
    for (const reply of [
      "Sorry you're dealing with leg pain. I can't give medical advice, but a licensed Humancare doctor can help you by video. Our Joint Pain page is below.",
      "Sorry you're worried about this. I can't give medical advice, but a licensed Humancare doctor can help you by video.",
      "Lamento que tenga dolor de cabeza. No puedo dar consejo médico, pero un médico de Humancare puede ayudarle por video.",
      "सिर दर्द के बारे में सुनकर दुख हुआ। मैं चिकित्सीय सलाह नहीं दे सकता, लेकिन Humancare के डॉक्टर वीडियो पर मदद कर सकते हैं।",
      "Sorry you're dealing with this. Our Type 2 Diabetes page is below.",
    ]) {
      assert.equal(safety.checkReply(reply).blocked, false, reply);
      assert.ok(safety.replyLength(reply) <= 200, reply);
    }
    assert.equal(safety.checkReply("Sorry to hear that. You probably have diabetes.").blocked, true);
    assert.equal(safety.checkReply("Sorry you're in pain. Take ibuprofen 400 mg.").blocked, true);
  });
});

describe("live chat: end to end, a medical message gets the matching page card above Book", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(async () => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    await lc.setSettings({ aiMayLinkConditionPages: true });
  });
  const reply = (text, over = {}) => ({
    ok: true, reply: text, handoff: false, handoffReason: "none", offTopic: false, topic: "medical", links: [],
    language: { code: "en", name: "English" }, usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 }, ...over,
  });
  async function openChat() {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    await lc.call(socket, "chat:start", { path: "/", title: "Home" });
    return socket;
  }
  const lastAi = async (socket) => (await lc.call(socket, "chat:resume")).conversation.messages.filter((m) => m.sender === "ai").at(-1);

  test("leg pain: the model named no page, the server adds the best match above the booking card", async () => {
    lc.ai.queue.push(reply("Sorry you're dealing with leg pain. I can't give medical advice, but a licensed Humancare doctor can help you by video."));
    const socket = await openChat();
    await lc.call(socket, "chat:message", { text: "hi ai please suggest me something i have pain in my legs" });
    const ai = await lastAi(socket);
    assert.equal(ai.text.startsWith("Sorry you're dealing with leg pain."), true);
    assert.deepEqual(ai.links.map((l) => l.url), ["/joint-pain", "/appointment-booking"]);
    assert.deepEqual(lc.ai.calls[0].pageHint, ["Joint Pain", "Knee Pain", "Orthopedics"]);
    assert.ok(lc.ai.calls[0].pages.length > 100);
    socket.close();
  });

  test("setting OFF: Book only, and the model is not shown health-topic pages", async () => {
    await lc.setSettings({ aiMayLinkConditionPages: false });
    lc.ai.queue.push(reply("Sorry you're dealing with leg pain. I can't give medical advice, but a licensed Humancare doctor can help you by video.", { links: [{ title: "Joint Pain", url: "/joint-pain" }] }));
    const socket = await openChat();
    await lc.call(socket, "chat:message", { text: "pain in my legs" });
    assert.deepEqual((await lastAi(socket)).links.map((l) => l.url), ["/appointment-booking"]);
    assert.equal(lc.ai.calls[0].pages.some((p) => p.url === "/joint-pain"), false);
    assert.deepEqual(lc.ai.calls[0].pageHint, []);
    socket.close();
  });

  test("a price question gets no health-topic page and no forced booking card", async () => {
    lc.ai.queue.push(reply("A general consultation is $49.", { topic: "pricing", links: [{ title: "Pricing", url: "/telemedicine-cost-usa" }] }));
    const socket = await openChat();
    await lc.call(socket, "chat:message", { text: "how much is a consultation?" });
    assert.deepEqual((await lastAi(socket)).links.map((l) => l.url), ["/telemedicine-cost-usa"]);
    socket.close();
  });

  test("a blocked reply still gets the fixed warm text with the page and Book cards", async () => {
    lc.ai.queue.push(reply("You may have a migraine. Rest in a dark room.", { language: { code: "hi", name: "Hindi" } }));
    const socket = await openChat();
    await lc.call(socket, "chat:message", { text: "sar dard ho raha hai" });
    const ai = await lastAi(socket);
    assert.equal(ai.text, safety.FIXED_TEXT.fallback.hi);
    assert.deepEqual(ai.links.map((l) => l.url), ["/general-and-everyday-care/general-physician/headache", "/appointment-booking"]);
    socket.close();
  });
});

describe("live chat: Hindi and Hinglish replies are gender-neutral", () => {
  test("the prompt tells the model to avoid 'main ... sakta/sakti hoon' and gives the neutral phrasing", () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS, []);
    assert.match(prompt, /gender-neutral phrasing/);
    assert.match(prompt, /medical salah dena mere liye sambhav nahi hai/);
    assert.match(prompt, /never "main \.\.\. sakta\/sakti hoon"/);
  });
});
