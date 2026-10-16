const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const safety = require("../services/liveChat/safety");
const { validate, isTooLong, buildSystemPrompt, createAiService, MAX_REPLY_CHARS } = require("../services/liveChat/aiService");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

describe("reply filter (model output -> patient)", () => {
  test("blocks dose units, medication names, 'you have <condition>', 'take <drug>' and diagnos*", () => {
    const blocked = [
      "Take 400 mg every six hours.",
      "The usual dose is 5 ml twice a day.",
      "Try 2 tablets with water.",
      "One pill at night helps.",
      "Ibuprofen can help with that.",
      "Metformin is common for this.",
      "You may have a migraine.",
      "You probably have an infection.",
      "That sounds like the flu.",
      "It could be a UTI.",
      "Try taking paracetamol.",
      "Use some cream on it.",
      "You should take a painkiller.",
      "A doctor will diagnose you.",
      "This is a common diagnosis.",
      "Puede tener una infección.",
      "Tome una pastilla cada ocho horas.",
      "Aapko bukhar hai.",
      "आपको संक्रमण हो सकता है।",
      "रोज़ 2 गोली लें।",
    ];
    for (const text of blocked) assert.equal(safety.checkReply(text).blocked, true, text);
  });

  test("never blocks service wording: refills, sick notes, lab requisitions, second opinions, prices, booking", () => {
    const fine = [
      "Prescription refills are $60. Choose Prescription refill in Book Appointment and a doctor will review your request.",
      "Doctor notes and sick notes are $49. A doctor reviews your request and, where appropriate, issues the note.",
      "Lab requisitions are $49. Book a visit and the doctor decides what is appropriate.",
      "A Second Medical Opinion is $60. A specialist reviews your reports and treatment plan.",
      "A general consultation is $49. Fit to fly is $69. See /telemedicine-cost-usa",
      "Book from Book Appointment, pick a time and pay. Same-day visits are common.",
      "Take a look at our pricing page, or use the booking page to pick a time.",
      "No insurance is needed: prices are flat. We follow HIPAA standards.",
      "You can talk to a licensed doctor online. Book here: /appointment-booking",
      "La consulta general cuesta $49. Reserve aquí.",
      "सामान्य परामर्श $49 है। यहां बुक करें।",
    ];
    for (const text of fine) {
      const verdict = safety.checkReply(text);
      assert.equal(verdict.blocked, false, `${text} -> ${verdict.reason}`);
    }
  });

  test("every fixed safe reply passes the filter itself", () => {
    for (const kind of ["fallback", "fallbackMedication"]) {
      for (const lang of ["en", "hi", "es"]) {
        assert.equal(safety.checkReply(safety.FIXED_TEXT[kind][lang]).blocked, false, `${kind}.${lang}`);
      }
    }
  });
});

describe("medication wording picks the fallback variant", () => {
  test("detects medicine and refill talk in three languages", () => {
    for (const text of ["can I take ibuprofen?", "I need a refill", "what dose is safe", "mi receta está vencida", "mujhe dawai chahiye", "मुझे दवा चाहिए", "tell me about metformin"]) {
      assert.equal(safety.isMedicationText(text), true, text);
    }
    for (const text of ["do I have diabetes?", "I need a sick note", "how much is a consultation", "cuanto cuesta la consulta"]) {
      assert.equal(safety.isMedicationText(text), false, text);
    }
  });
});

describe("emergency detector (patient message)", () => {
  test("matches the listed emergencies in English, Hindi/Hinglish and Spanish", () => {
    const cases = {
      en: [
        "I have chest pain", "there is a tight pressure in my chest", "I can't breathe", "trouble breathing", "I'm short of breath",
        "I think I'm having a stroke", "my face is drooping and my speech is slurred", "I took an overdose", "took too many pills",
        "I want to kill myself", "I want to die", "thinking of suicide", "I want to hurt myself", "severe bleeding", "the bleeding won't stop",
      ],
      hi: ["मुझे सीने में दर्द है", "सांस नहीं ले पा रहा", "मैं आत्महत्या करना चाहता हूँ", "बहुत खून बह रहा है", "mujhe seene mein dard hai", "saans nahi aa rahi", "main marna chahta hoon", "khoon nahi ruk raha"],
      es: ["Tengo dolor de pecho", "no puedo respirar", "me falta el aire", "creo que es un derrame cerebral", "tomé una sobredosis", "quiero morir", "tengo un sangrado fuerte"],
    };
    for (const [language, texts] of Object.entries(cases)) {
      for (const text of texts) assert.deepEqual(safety.detectEmergency(text), { language }, text);
    }
  });

  test("ordinary service messages are not emergencies", () => {
    for (const text of ["how much is a consultation?", "I need a sick note", "can I get a prescription refill", "what are your prices", "I want to book for tomorrow", "cuanto cuesta", "मुझे रिफिल चाहिए", ""]) {
      assert.equal(safety.detectEmergency(text), null, text);
    }
  });

  test("the fixed 911 message starts with the call-911 instruction in all three languages", () => {
    assert.match(safety.FIXED_TEXT.emergency.en, /^Please call 911 right now/);
    assert.match(safety.FIXED_TEXT.emergency.hi, /911/);
    assert.match(safety.FIXED_TEXT.emergency.es, /911/);
  });
});

describe("200-character reply rule (links do not count)", () => {
  const reply = (text) => ({ reply: text, handoff: false, handoffReason: "none", offTopic: false, topic: "other", links: [], language: { code: "en", name: "English" } });

  test("replyLength skips absolute urls, www urls and site paths", () => {
    assert.equal(safety.replyLength("Book here: /appointment-booking"), "Book here:".length);
    assert.equal(safety.replyLength("See https://humancareconnect.co/telemedicine-cost-usa for prices"), "See for prices".length);
    assert.equal(safety.replyLength("go to www.example.com now"), "go to now".length);
    assert.equal(safety.replyLength("and/or fractions 1/2 stay"), "and/or fractions 1/2 stay".length);
  });

  test("validate accepts 200 characters, rejects 201, and does not count urls", () => {
    assert.ok(validate(reply("a".repeat(200))));
    assert.equal(validate(reply("a".repeat(201))), null);
    assert.ok(validate(reply(`${"a".repeat(190)} /appointment-booking https://humancareconnect.co/a/very/long/path/to/a/page`)));
    assert.equal(MAX_REPLY_CHARS, 200);
    assert.equal(isTooLong(reply("a".repeat(201))), true);
    assert.equal(isTooLong(reply("a".repeat(200))), false);
  });

  test("the prompt states the 200-character rule, excluding links, and the price rule", () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS);
    assert.match(prompt, /at most 200 characters, not counting links or URLs/);
    assert.match(prompt, /2-3 key prices/);
    assert.match(prompt, /Pricing page/);
  });

  const AI_ENV = { LIVECHAT_MODEL: "gpt-6-luna", LIVECHAT_OPENAI_API_KEY: "k", LIVECHAT_PRICE_INPUT_PER_1M: "0.1", LIVECHAT_PRICE_OUTPUT_PER_1M: "0.5" };
  const result = (text) => ({ text: JSON.stringify(reply(text)), finishReason: "stop", refusal: false, usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 10 } });
  const serviceWith = (answers, seen = []) =>
    createAiService({ env: AI_ENV, providers: { openai: () => ({ complete: async (input) => (seen.push(input), answers.shift()) }) }, log: () => {} });

  test("a too-long reply is retried once asking for a shorter one; a short second answer is used", async () => {
    const seen = [];
    const out = await serviceWith([result("x".repeat(250)), result("Short answer.")], seen).generateReply({ settings: DEFAULT_SETTINGS, history: [{ role: "patient", text: "hi" }] });
    assert.equal(out.ok, true);
    assert.equal(out.reply, "Short answer.");
    assert.equal(seen.length, 2);
    assert.doesNotMatch(seen[0].system, /previous answer was longer than 200/);
    assert.match(seen[1].system, /previous answer was longer than 200/);
    assert.equal(out.usage.inputTokens, 200); // both calls are counted
  });

  test("still over after the retry: kind too_long (the caller sends the safe fallback)", async () => {
    const seen = [];
    const out = await serviceWith([result("x".repeat(250)), result("y".repeat(300))], seen).generateReply({ settings: DEFAULT_SETTINGS, history: [{ role: "patient", text: "hi" }] });
    assert.deepEqual([out.ok, out.kind, seen.length], [false, "too_long", 2]);
    assert.equal(out.usage.inputTokens, 200);
  });

  test("an invalid (not too long) answer is not retried", async () => {
    const seen = [];
    const out = await serviceWith([{ text: "not json", finishReason: "stop", refusal: false, usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 } }], seen).generateReply({ settings: DEFAULT_SETTINGS, history: [{ role: "patient", text: "hi" }] });
    assert.deepEqual([out.ok, out.kind, seen.length], [false, "invalid", 1]);
  });
});

describe("prompt: condition-page links setting and the SAFETY rule", () => {
  test("on (default): the model may add one matching condition page; off: booking link only", () => {
    const pages = [{ title: "Book an appointment", url: "/appointment-booking" }];
    assert.match(buildSystemPrompt(DEFAULT_SETTINGS, pages), /the ONE health-topic page/);
    assert.match(buildSystemPrompt({ ...DEFAULT_SETTINGS, aiMayLinkConditionPages: true }, pages), /You MAY also add the one best matching condition page/);
    const off = buildSystemPrompt({ ...DEFAULT_SETTINGS, aiMayLinkConditionPages: false }, pages);
    assert.match(off, /Give only the booking page link: never link a condition page/);
    assert.match(off, /put only the booking page/);
    assert.doesNotMatch(off, /You MAY also add/);
  });

  test("the SAFETY prompt forbids all medical information and keeps the emergency rule", () => {
    const lines = buildSystemPrompt(DEFAULT_SETTINGS).split("\n");
    const rule = lines.find((l) => l.startsWith("SAFETY"));
    for (const needle of ["NO medical information or advice", "diagnose", "treatment", "medications, doses or interactions", "test results", '"general information"', "licensed Humancare Connect doctor"]) {
      assert.ok(rule.includes(needle), needle);
    }
    assert.ok(lines.some((l) => l.startsWith("EMERGENCY") && l.includes("911")));
  });
});

describe("livechat:eval (manual red-team script)", () => {
  test("has about 40 prompts in English, Hindi and Spanish, and the emergency ones are caught by the detector", () => {
    const { PROMPTS } = require("../scripts/liveChatEval");
    assert.ok(PROMPTS.length >= 38 && PROMPTS.length <= 45, String(PROMPTS.length));
    for (const lang of ["en", "hi", "es"]) assert.ok(PROMPTS.filter((p) => p[0] === lang).length >= 8, lang);
    for (const [, kind, prompt] of PROMPTS.filter((p) => p[1] === "emergency")) assert.ok(safety.detectEmergency(prompt), prompt);
    for (const [, kind, prompt] of PROMPTS.filter((p) => p[1] === "refuse")) assert.equal(safety.detectEmergency(prompt), null, prompt);
  });

  test("is not part of the test suite or a CI step: it only runs through npm run livechat:eval", () => {
    const pkg = require("../package.json");
    assert.equal(pkg.scripts["livechat:eval"], "node scripts/liveChatEval.js");
    assert.doesNotMatch(pkg.scripts.test, /liveChatEval/);
  });
});
