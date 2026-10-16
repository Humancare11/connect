const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createSitePages } = require("../services/liveChat/sitePages");
const { titlesFor, serviceTitleFor } = require("../services/liveChat/pageSynonyms");
const { buildSystemPrompt, tidyReply, validate } = require("../services/liveChat/aiService");
const safety = require("../services/liveChat/safety");
const { DEFAULT_SETTINGS, QUICK_OPTIONS, CANNED_REPLIES } = require("../services/liveChat/settingsDefaults");

const sp = createSitePages();
const titles = (links) => links.map((l) => l.title);
const BOOK = "Book an appointment";

describe("live chat: page links follow the strict rule (one clearly matching page + Book, else Book alone)", () => {
  // [patient message, topic is medical, expected link titles when the model names no page]
  const TABLE = [
    ["leg pain", true, ["Joint Pain", BOOK]],
    ["back pain", true, ["Back Pain", BOOK]],
    ["I have a fever", true, ["Fever", BOOK]],
    ["hair fall", true, ["Skin & Hair Care", BOOK]],
    ["my hair is falling out", true, ["Skin & Hair Care", BOOK]],
    ["I feel stressed", true, ["Behavioral Medicine", BOOK]],
    ["sleep problems", true, [BOOK]],
    ["I have a cold sore", true, [BOOK]],
    ["what is the price of a gas card", false, ["Pricing", BOOK]],
    ["I need to fill my car with gas", true, [BOOK]],
    ["skin", true, [BOOK]],
    ["I feel sad", true, [BOOK]],
    ["who are you?", false, []],
    // service questions: the service page is added by the server even when the model named none
    ["I need a sick note", false, ["Doctor's note (sick note)", BOOK]],
    ["price?", false, ["Pricing", BOOK]],
    ["how much does it cost", false, ["Pricing", BOOK]],
    ["can I get a prescription refill", false, [BOOK]],
  ];
  for (const [text, medical, expected] of TABLE) {
    test(`"${text}" -> ${expected.join(" + ") || "no buttons"}`, () => {
      assert.deepEqual(titles(sp.arrange([], { allowContent: true, medical, hintText: text })), expected);
    });
  }

  test("chest tightness never gets a page from the fallback (it is handled as an emergency)", () => {
    assert.deepEqual(titlesFor("chest tightness"), []);
    assert.deepEqual(titles(sp.arrange([], { allowContent: true, medical: true, hintText: "chest tightness" })), [BOOK]);
  });

  test("at most one health-topic page, and a message with two topics gets one topic's page only", () => {
    assert.equal(sp.hintFor("I have back pain and a fever").length, 1);
    assert.deepEqual(titles(sp.arrange([], { allowContent: true, medical: true, hintText: "I have back pain and a fever" })).length, 2);
    for (const text of ["leg pain", "headache", "stomach pain"]) assert.ok(sp.hintFor(text).length <= 1);
  });

  test("weak single words no longer match", () => {
    for (const text of ["gas", "skin", "sad", "sleep", "cold", "tension", "hair", "stomach", "price of gas"]) {
      assert.deepEqual(titlesFor(text), [], text);
    }
  });

  test("negative phrases cancel a group", () => {
    assert.deepEqual(titlesFor("I have a cold sore"), []);
    assert.deepEqual(titlesFor("I have a cold"), ["Cold & Flu", "Upper Respiratory Infection"]);
    assert.deepEqual(titlesFor("how much is a gas card"), []);
  });

  test("service questions map to the service page title", () => {
    assert.equal(serviceTitleFor("I need a sick note for work"), "Doctor's note (sick note)");
    assert.equal(serviceTitleFor("price?"), "Pricing");
    assert.equal(serviceTitleFor("hello"), "");
  });

  test("health-topic pages are never added when the setting forbids them, but service pages still are", () => {
    assert.deepEqual(titles(sp.arrange([], { allowContent: false, medical: true, hintText: "back pain" })), [BOOK]);
    assert.deepEqual(titles(sp.arrange([], { allowContent: false, medical: false, hintText: "price?" })), ["Pricing", BOOK]);
  });

  test("a page the model names is kept; the fallback adds no second service page", () => {
    const pricing = sp.pages.find((p) => p.title === "Pricing");
    assert.deepEqual(titles(sp.arrange([pricing.url], { allowContent: true, medical: false, hintText: "price?" })), ["Pricing", BOOK]);
  });

  test("Book is last, never duplicated, at most 3 buttons, and absent when the linked page is a booking page", () => {
    const urls = (l) => l.map((x) => x.url);
    const all = sp.arrange(["/appointment-booking", "/telemedicine-cost-usa", "/doctors-note", "/joint-pain"], { allowContent: true, medical: true, hintText: "leg pain" });
    assert.equal(all.length, 3);
    assert.equal(all[0].title, "Joint Pain");
    assert.ok(all.at(-1).url.startsWith("/appointment-booking"));
    assert.equal(urls(all).filter((u) => u.startsWith("/appointment-booking")).length, 1);
    assert.deepEqual(titles(sp.arrange([], { allowContent: true, medical: false, hintText: "who are you?" })), []);
    // a health-topic page that is itself a booking page (a category page) gets no second Book card
    const cat = createSitePages([{ type: "category", title: "Skin & Hair", url: "/appointment-booking/skin-hair", keywords: [] }, { type: "service", title: BOOK, url: "/appointment-booking", keywords: [] }]);
    assert.deepEqual(titles(cat.arrange([], { allowContent: true, medical: true, hintText: "hair fall" })), ["Skin & Hair"]);
    // order: matched page, Pricing, Book
    assert.deepEqual(titles(sp.arrange(["/telemedicine-cost-usa"], { allowContent: true, medical: true, hintText: "back pain" })), ["Back Pain", "Pricing", BOOK]);
  });

  test("when the phrase map names a page it wins over a different page picked by the model", () => {
    const men = sp.pages.find((p) => p.title === "Hair Loss (Men's Health)");
    assert.ok(men, "fixture page exists");
    assert.deepEqual(titles(sp.arrange([men.url], { allowContent: true, medical: true, hintText: "hair fall" })), ["Skin & Hair Care", BOOK]);
    // no clear map match: the model's page stays
    assert.deepEqual(titles(sp.arrange([men.url], { allowContent: true, medical: true, hintText: "something odd" })).includes(men.title), true);
  });

  test("the prompt says a page is added only when one clearly matches", () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS, sp.pagesForPrompt(), {});
    assert.match(prompt, /Add a page ONLY when one page clearly matches/);
    assert.doesNotMatch(prompt, /even loosely/);
  });
});

describe("live chat: emergency detector covers a tight chest", () => {
  for (const text of ["chest tightness", "I have chest tightness", "tight chest", "my chest feels tight", "tightness in my chest", "chest is tight", "pressure in my chest", "heavy chest"]) {
    test(`"${text}"`, () => assert.ok(safety.detectEmergency(text), text));
  }
  test("not triggered by unrelated chest words", () => {
    for (const text of ["treasure chest", "chest of drawers", "I want to book a visit", "hair fall"]) assert.ok(!safety.detectEmergency(text), text);
  });
});

describe("live chat: brand name and reply style", () => {
  const prompt = buildSystemPrompt(DEFAULT_SETTINGS, sp.pagesForPrompt(), {});

  test("the prompt and the fixed texts never use the short brand name", () => {
    assert.doesNotMatch(prompt.replace(/^BRAND:.*$/m, ""), /Humancare(?! Connect)/); // the BRAND rule itself names the short form
    for (const kind of ["fallback", "fallbackMedication"]) {
      for (const lang of ["en", "hi", "es"]) assert.doesNotMatch(safety.FIXED_TEXT[kind][lang], /Humancare(?! Connect)/, `${kind}.${lang}`);
    }
  });

  test("the refusal sentence is the reviewed one, with the full brand", () => {
    assert.ok(safety.FIXED_TEXT.fallback.en.includes("I can't give medical advice, but a licensed Humancare Connect doctor can help you."));
    assert.ok(prompt.includes("I can't give medical advice, but a licensed Humancare Connect doctor can help you."));
  });

  test("the prompt carries the brand, voice and price rules", () => {
    assert.match(prompt, /BRAND: in English always write "Humancare Connect"/);
    assert.match(prompt, /first person plural/);
    assert.match(prompt, /never write "Sorry for the confusion"/);
    assert.match(prompt, /no dashes/);
    assert.match(prompt, /state the actual price in USD from the Prices list/);
  });

  test("no prompt line and no fixed or default text says 'visit', 'in-person' or 'video call' (it is an online consultation)", () => {
    const FORBIDDEN = /visit|in-person|in person|video call|videollamada|vídeo llamada|वीडियो कॉल|वीडियो/i;
    // Page titles are the site's own data (e.g. "How a telemedicine visit works"): the prompt tells the model not to repeat them.
    const settingsVariants = [DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, aiMayLinkConditionPages: false }, { prices: [] }];
    for (const settings of settingsVariants) {
      for (const line of buildSystemPrompt(settings, sp.pagesForPrompt().filter((p) => !FORBIDDEN.test(p.title)), { pageHint: ["Joint Pain"], unansweredStreak: 1, shorter: true }).split(String.fromCharCode(10))) {
        if (line.startsWith("WORDING:")) continue; // the rule itself names the forbidden words
        assert.doesNotMatch(line, FORBIDDEN, line.slice(0, 60));
      }
    }
    assert.match(prompt, /WORDING: our service is an online consultation/);
    assert.match(prompt, /Our doctors decide if a sick note is appropriate during your online consultation./);
    for (const [kind, langs] of Object.entries(safety.FIXED_TEXT)) {
      for (const [lang, text] of Object.entries(langs)) assert.doesNotMatch(text, FORBIDDEN, `${kind}.${lang}`);
    }
    for (const option of QUICK_OPTIONS) assert.doesNotMatch(option.reply || "", FORBIDDEN, option.key);
    for (const canned of CANNED_REPLIES) assert.doesNotMatch(canned.text, FORBIDDEN, canned.title);
  });

  test("the quiet-chat lines never say 'closed' or 'ended', exist in en / hi / es, and follow the chat's language", () => {
    for (const kind of ["inactive", "quietSinceYesterday"]) {
      assert.deepEqual(Object.keys(safety.FIXED_TEXT[kind]).sort(), ["en", "es", "hi"]);
      for (const [lang, text] of Object.entries(safety.FIXED_TEXT[kind])) {
        assert.ok(text.length > 20, lang);
        assert.doesNotMatch(text, /closed|ended|end of the day|cerrad|finaliz|बंद|समाप्त/i, `${kind}.${lang}`);
      }
    }
    assert.equal(safety.FIXED_TEXT.inactive.en, "No new messages for a while. You can keep writing here any time and we'll continue.");
    assert.equal(safety.fixedText("inactive", "hi-IN"), safety.FIXED_TEXT.inactive.hi);
    assert.equal(safety.fixedText("quietSinceYesterday", "es"), safety.FIXED_TEXT.quietSinceYesterday.es);
    assert.equal(safety.fixedText("inactive", "und"), safety.FIXED_TEXT.inactive.en);
  });

  test("tidyReply: straight quotes, no dashes, full brand", () => {
    assert.equal(tidyReply("Sorry for the confusion—I’m Connect AI for Humancare Connect."), "Sorry for the confusion, I'm Connect AI for Humancare Connect.");
    assert.equal(tidyReply("We’re here – book below."), "We're here, book below.");
    assert.equal(tidyReply("A licensed Humancare doctor can help."), "A licensed Humancare Connect doctor can help.");
    assert.equal(tidyReply("Humancare Connect is open."), "Humancare Connect is open.");
    assert.equal(tidyReply("Visit humancareconnect.co today"), "Visit humancareconnect.co today");
  });

  test("validate() applies tidyReply to the reply the patient sees", () => {
    const parsed = validate({ reply: "We can help—book below. It’s easy.", handoff: false, handoffReason: "none", offTopic: false, topic: "booking", links: [], language: { code: "en" } });
    assert.equal(parsed.reply, "We can help, book below. It's easy.");
  });
});
