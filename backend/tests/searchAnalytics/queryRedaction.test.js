const test = require("node:test");
const assert = require("node:assert/strict");
const { redactQuery, analyzeForAnalytics } = require("../../services/search/queryRedaction");
const aiService = require("../../services/search/searchAiService");

// Frozen copy of the implementation that lived in searchAiService.js before it
// moved to the shared module. The OpenAI path must stay byte-for-byte equal.
function legacyRedactQuery(query) {
  return String(query || "")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\d{5,}/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

// ── redactQuery: golden behaviour ─────────────────────────────────────────
test("the AI service re-exports the shared redactQuery", () => {
  assert.equal(aiService.redactQuery, redactQuery);
});

test("redactQuery golden outputs", () => {
  const golden = [
    ["", ""],
    [undefined, ""],
    [null, ""],
    ["knee pain", "knee pain"],
    ["  knee   pain \n", "knee pain"],
    ["mail me at john.doe@example.com now", "mail me at [email] now"],
    ["call +1 (555) 123-4567 please", "call [number] please"],
    ["id 123456789", "id [number]"],
    ["id 1234", "id 1234"],
    ["x".repeat(500), "x".repeat(100)],
    [12345678, "[number]"],
  ];
  for (const [input, expected] of golden) assert.equal(redactQuery(input), expected, String(input));
});

test("redactQuery equals the pre-move implementation on a large generated corpus", () => {
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  const alphabet = "ab cd@.-+()0123456789  xyz\n\té";
  for (let i = 0; i < 4000; i += 1) {
    let text = "";
    const length = next() % 160;
    for (let j = 0; j < length; j += 1) text += alphabet[next() % alphabet.length];
    assert.equal(redactQuery(text), legacyRedactQuery(text));
  }
});

// ── analyzeForAnalytics: events that must be dropped ──────────────────────
const dropped = (q) => analyzeForAnalytics(q);

test("contact details drop the event", () => {
  for (const q of [
    "email me a@b.com", "john.doe@example.com", "ping @someone", "http://x.test", "https://example.org/a",
    "www.example", "example.com", "my site foo.io",
  ]) {
    const result = dropped(q);
    assert.equal(result.store, false, q);
    assert.ok(result.reasons.includes("contact"), `${q}: ${result.reasons}`);
  }
});

test("numeric identifiers, phone numbers, ips and dates drop the event", () => {
  for (const q of [
    "call +1 (555) 123-4567", "5551234567", "12345", "patient 10234", "appointment 8765432",
    "192.168.1.10", "2001:db8:85a3::8a2e:370:7334", "::1", "fe80::1",
    "12/03/1985", "12-03-1985", "1985-03-12", "03.12.85",
  ]) {
    const result = dropped(q);
    assert.equal(result.store, false, q);
    assert.ok(result.reasons.includes("number"), `${q}: ${result.reasons}`);
  }
});

test("mixed letter/digit identifiers drop the event", () => {
  for (const q of ["apt-2024-0073", "ab123c", "mrn88231x", "order a1b2c3"]) {
    const result = dropped(q);
    assert.equal(result.store, false, q);
    assert.ok(result.reasons.includes("identifier") || result.reasons.includes("number"), q);
  }
  assert.ok(dropped("tkt4821x").reasons.includes("identifier"));
});

test("self-identification and address cues drop the event", () => {
  for (const q of [
    "my name is priya", "i am called raj", "patient name asha", "full name",
    "mr smith diabetes", "mrs rao fever", "ms. jones cough", "my address", "home address",
    "42 baker street", "main road clinic", "apartment 4b", "pin code", "zip code", "flat no",
  ]) {
    const result = dropped(q);
    assert.equal(result.store, false, q);
    assert.ok(result.reasons.includes("selfid"), `${q}: ${result.reasons}`);
  }
});

test("doctor-name searches drop the event", () => {
  for (const q of ["dr rahul", "dr. priya sharma", "dr rahul testname cardiology"]) {
    const result = dropped(q);
    assert.equal(result.store, false, q);
    assert.ok(result.reasons.includes("doctor"), q);
  }
});

test("long narratives and unusable input drop the event", () => {
  assert.deepEqual(dropped("i have had a really bad cough for about three weeks now").reasons, ["length"]);
  assert.deepEqual(dropped("x".repeat(101)).reasons, ["length"]);
  assert.deepEqual(dropped("a").reasons, ["length"]);
  assert.deepEqual(dropped("").reasons, ["length"]);
  for (const bad of [undefined, null, 5, {}, ["knee"]]) assert.deepEqual(dropped(bad), { store: false, reasons: ["invalid"] });
});

test("an event is dropped, never stored with placeholders", () => {
  const result = dropped("mail me at someone@example.com about diabetes");
  assert.equal(result.store, false);
  assert.ok(!("term" in result));
});

// ── Intended non-matches (false positives we must not create) ─────────────
test("ordinary health searches are kept", () => {
  for (const q of [
    "knee pain", "type 2 diabetes", "covid19", "covid 19", "hba1c", "vitamin b12", "vitamin d", "sars-cov-2",
    "road rash", "ms symptoms", "ibs", "i have acne", "doctor for migraine", "heartburn at night",
    "high blood pressure", "adhd evaluation", "uti in men", "back pain 3 days", "cough for 2 weeks",
    "birth control", "sick note", "dr", "name@", "e.coli", "h.pylori", "st john's wort", "ankle sprain",
    "pms", "mister",
  ]) {
    const result = dropped(q);
    assert.deepEqual(result, { store: true, reasons: [] }, `${q}: ${result.reasons}`);
  }
});

test("analysis is pure and does not mutate or depend on case", () => {
  const input = "Knee Pain";
  assert.deepEqual(analyzeForAnalytics(input), { store: true, reasons: [] });
  assert.equal(input, "Knee Pain");
  assert.equal(analyzeForAnalytics("MY NAME IS RAJ").store, false);
});
