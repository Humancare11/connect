// Every reported AI mistake is a row in tests/fixtures/liveChatMistakes.json: {patient_message, expected, ...}. This runs each row
// through the emergency detector, the reply filter and arrange() (the same code the chat uses), so a fixed mistake stays fixed.
// How to add a row: docs/live-chat.md, "How to report an AI mistake".
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const safety = require("../services/liveChat/safety");
const { createSitePages, AGENT_URL, BOOKING_URL } = require("../services/liveChat/sitePages");
const { rows } = require("./fixtures/liveChatMistakes.json");

const sp = createSitePages(undefined, { log: () => {} });
const PRICING_URL = "/telemedicine-cost-usa";
const KINDS = ["emergency", "refusal", "pricing", "book", "agent", "none"];
const kindOf = (expected) => (expected.startsWith("page:") ? "page" : expected);
const urlsOf = (row) =>
  sp
    .arrange(row.model_links || [], {
      allowContent: true,
      medical: row.medical ?? ["page", "agent"].includes(kindOf(row.expected)),
      hintText: row.patient_message,
      language: row.language || "en",
    })
    .map((l) => l.url);

describe("live chat: the mistakes file is well formed", () => {
  test("every row has a message and a known expectation; no duplicates", () => {
    assert.ok(rows.length >= 40, "the seed rows are kept");
    const seen = new Set();
    for (const row of rows) {
      assert.equal(typeof row.patient_message, "string", JSON.stringify(row));
      assert.ok(row.patient_message.trim(), "empty patient_message");
      assert.ok(KINDS.includes(row.expected) || /^page:\/\S+$/.test(row.expected), `unknown expected "${row.expected}" for "${row.patient_message}"`);
      if (row.expected === "refusal") assert.equal(typeof row.ai_reply, "string", `refusal rows need ai_reply: "${row.patient_message}"`);
      if (row.expected.startsWith("page:")) assert.ok(sp.has(row.expected.slice(5)), `page ${row.expected.slice(5)} is not on the site list`);
      const key = `${row.patient_message}|${row.language || ""}`;
      assert.equal(seen.has(key), false, `duplicate row: "${row.patient_message}"`);
      seen.add(key);
    }
  });
});

describe("live chat: reported mistakes (tests/fixtures/liveChatMistakes.json)", () => {
  for (const row of rows) {
    test(`"${row.patient_message}" -> ${row.expected}${row.note ? ` (${row.note})` : ""}`, () => {
      const emergency = safety.detectEmergency(row.patient_message);
      if (row.expected === "emergency") {
        assert.ok(emergency, "should be an emergency");
        if (row.language) assert.equal(emergency.language, row.language);
        return;
      }
      assert.equal(emergency, null, "must not be an emergency");
      if (row.expected === "refusal") {
        assert.equal(safety.checkReply(row.ai_reply).blocked, true, "the reply filter should block this reply");
        return;
      }
      const urls = urlsOf(row);
      if (row.expected === "none") return assert.deepEqual(urls, []);
      assert.equal(urls.length, 1, `exactly one button, got [${urls}]`);
      if (row.expected === "pricing") assert.equal(urls[0], PRICING_URL);
      else if (row.expected === "book") assert.equal(urls[0], BOOKING_URL);
      else if (row.expected === "agent") assert.equal(urls[0], AGENT_URL);
      else assert.equal(urls[0], row.expected.slice(5));
    });
  }
});
