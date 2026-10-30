// Live chat for visitors priced in EUR / GBP: no exact price is ever quoted (the chat does not know their per-service price);
// the chat says the price is shown at booking and points to the booking page. USD visitors, visitors with no known country and
// every visitor while MULTI_CURRENCY_ENABLED is off are unchanged.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer } = require("./helpers/liveChatServer");
const { buildSystemPrompt } = require("../services/liveChat/aiService");
const priceMode = require("../services/liveChat/priceMode");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

const setFlag = (on) => {
  if (on) process.env.MULTI_CURRENCY_ENABLED = "true";
  else delete process.env.MULTI_CURRENCY_ENABLED;
};

describe("live chat prices: helpers", () => {
  after(() => setFlag(false));

  test("hasAmount sees $, € and £ amounts and currency words, not plain numbers", () => {
    for (const text of ["It is $49.", "Only €30 today", "just £25", "49 USD", "30 euros", "25 pounds", "EUR 30"]) {
      assert.equal(priceMode.hasAmount(text), true, text);
    }
    for (const text of ["Book in 5 minutes.", "Hello", "Our doctors are online 24 hours a day.", ""]) {
      assert.equal(priceMode.hasAmount(text), false, text);
    }
  });

  test("withoutPrices drops only the sentences that quote an amount and says the price is shown at booking", () => {
    assert.equal(
      priceMode.withoutPrices("You can see a doctor online. A general consultation is $49, and a refill is $60. Book from Book Appointment."),
      `${priceMode.PRICE_AT_BOOKING} You can see a doctor online. Book from Book Appointment.`,
    );
    assert.equal(priceMode.withoutPrices("It costs €30."), priceMode.PRICE_AT_BOOKING);
    assert.equal(priceMode.withoutPrices("Book from Book Appointment."), "Book from Book Appointment.", "no amount: untouched");
  });

  test("the chat currency follows the visitor's country, and is USD when the flag is off", () => {
    setFlag(false);
    assert.equal(priceMode.hidesPrices({ geo: { country: "Germany" } }), false);
    setFlag(true);
    assert.equal(priceMode.hidesPrices({ geo: { country: "Germany" } }), true);
    assert.equal(priceMode.hidesPrices({ geo: { country: "United Kingdom" } }), true);
    assert.equal(priceMode.hidesPrices({ geo: { country: "India" } }), false);
    assert.equal(priceMode.hidesPrices({ geo: { country: "" } }), false, "unknown country: USD, unchanged");
    assert.equal(priceMode.hidesPrices({}), false);
    setFlag(false);
  });

  test("the AI prompt: the Prices list and the price rule are left out only for a visitor who is not priced in USD", () => {
    const usd = buildSystemPrompt(DEFAULT_SETTINGS, []);
    assert.ok(usd.includes("Prices (USD):"));
    assert.ok(usd.includes("A General consultation is $49."));
    assert.ok(buildSystemPrompt(DEFAULT_SETTINGS, [], { hidePrices: false }) === usd, "default is exactly the old prompt");

    const hidden = buildSystemPrompt(DEFAULT_SETTINGS, [], { hidePrices: true });
    assert.equal(hidden.includes("Prices (USD):"), false);
    assert.equal(hidden.includes("$49"), false);
    assert.equal(/General consultation: \$/.test(hidden), false);
    assert.ok(hidden.includes("never state a price"));
    assert.ok(hidden.includes("shown when they book"));
  });
});

describe("live chat prices: service prices for EUR / GBP / INR visitors", () => {
  const ENV = ["MULTI_CURRENCY_ENABLED", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
  const saved = {};
  before(() => { for (const k of ENV) saved[k] = process.env[k]; });
  after(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  const rupees = (on) => {
    if (on) { process.env.RAZORPAY_KEY_ID = "rzp_test_k"; process.env.RAZORPAY_KEY_SECRET = "s"; }
    else { delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; }
  };
  const serviceSentences = [
    "Fit to fly certificates cost $69.",
    "A Fit to fly certificate is €63.",
    "Lab requisitions are £32.",
    "Doctor notes & sick notes are ₹1,499.",
    "Lab requisitions are Rs. 1499.",
    "Fit to fly is 1499 rupees.",
  ];

  test("a service price is never quoted to a EUR, GBP or INR visitor: the price is shown at booking", () => {
    setFlag(true);
    rupees(true);
    for (const country of ["Germany", "United Kingdom", "India"]) {
      const conv = { geo: { country } };
      assert.equal(priceMode.hidesPrices(conv), true, country);
      for (const text of serviceSentences) {
        assert.equal(priceMode.hasAmount(text), true, text);
        assert.equal(priceMode.withoutPrices(text), priceMode.PRICE_AT_BOOKING, `${country}: ${text}`);
      }
    }
  });

  test("the AI prompt for those visitors has no service price list (Fit to fly, Lab requisitions, ...)", () => {
    const hidden = buildSystemPrompt(DEFAULT_SETTINGS, [], { hidePrices: true });
    for (const name of ["Fit to fly", "Lab requisitions", "Doctor notes & sick notes", "Prescription refills", "Second medical opinion"]) {
      assert.equal(new RegExp(`${name}:? ?\$`, "i").test(hidden), false, name);
    }
    assert.equal(/\$\s?\d/.test(hidden), false);
  });

  test("an Indian visitor is a USD visitor (prices allowed) while Razorpay keys are missing or the flag is off", () => {
    setFlag(true);
    rupees(false);
    assert.equal(priceMode.hidesPrices({ geo: { country: "India" } }), false);
    setFlag(false);
    rupees(true);
    for (const country of ["India", "Germany", "United Kingdom"]) assert.equal(priceMode.hidesPrices({ geo: { country } }), false, country);
  });

  test("a USD visitor keeps the service sentences", () => {
    setFlag(true);
    rupees(true);
    assert.equal(priceMode.hidesPrices({ geo: { country: "United States" } }), false);
    assert.equal(priceMode.hidesPrices({ geo: {} }), false);
  });
});

describe("live chat prices: in a chat", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    setFlag(false);
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    setFlag(true);
  });

  async function openChat(country) {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    assert.equal(started.ok, true, JSON.stringify(started));
    await lc.models.LcConversation.updateOne({ conversationId: started.conversation.conversationId }, { $set: { "geo.country": country } });
    return { socket, id: started.conversation.conversationId };
  }
  const lastAi = async (socket) => {
    const resumed = await lc.call(socket, "chat:resume");
    return resumed.conversation.messages.at(-1);
  };

  test("EUR visitor, quick option: no exact price, says it is shown at booking, links to booking", async () => {
    const { socket } = await openChat("Germany");
    assert.equal((await lc.call(socket, "chat:option", { key: "consultation" })).ok, true);
    const last = await lastAi(socket);
    assert.equal(last.sender, "ai");
    assert.equal(/[$€£]\s?\d/.test(last.text), false, last.text);
    assert.ok(last.text.includes(priceMode.PRICE_AT_BOOKING), last.text);
    assert.deepEqual((last.links || []).map((l) => l.url), ["/appointment-booking"]);
    socket.close();
  });

  test("GBP visitor: the refill card does not quote $60 either", async () => {
    const { socket } = await openChat("United Kingdom");
    await lc.call(socket, "chat:option", { key: "refill" });
    const last = await lastAi(socket);
    assert.equal(last.text.includes("$"), false, last.text);
    assert.ok(last.text.includes(priceMode.PRICE_AT_BOOKING));
    socket.close();
  });

  test("USD visitor (India): the card is exactly as before, with its own page link", async () => {
    const { socket } = await openChat("India");
    await lc.call(socket, "chat:option", { key: "consultation" });
    const last = await lastAi(socket);
    assert.ok(last.text.startsWith("You can see a licensed US doctor online. A general consultation is $49"), last.text);
    assert.deepEqual((last.links || []).map((l) => l.url), ["/online-doctor-consultation"]);
    socket.close();
  });

  test("a EUR visitor with the flag off is a USD visitor: unchanged", async () => {
    setFlag(false);
    const { socket } = await openChat("Germany");
    await lc.call(socket, "chat:option", { key: "refill" });
    const last = await lastAi(socket);
    assert.ok(last.text.startsWith("Prescription refills are $60."), last.text);
    socket.close();
  });

  test("AI: a EUR visitor's request tells the model not to quote prices, and a dollar amount that slips through is cut", async () => {
    const { socket } = await openChat("France");
    lc.ai.queue.push({
      ok: true, reply: "A General consultation is $49. You can book it any time.", handoff: false, handoffReason: "none", topic: "pricing", links: [],
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50, costUsd: 0.0001 },
    });
    const sent = await lc.call(socket, "chat:message", { text: "how much is a consultation?" });
    assert.equal(sent.ok, true);
    assert.equal(lc.ai.calls.length, 1);
    assert.equal(lc.ai.calls[0].hidePrices, true);
    const last = await lastAi(socket);
    assert.equal(last.text.includes("$"), false, last.text);
    assert.ok(last.text.includes(priceMode.PRICE_AT_BOOKING));
    assert.ok(last.text.includes("You can book it any time."));
    assert.deepEqual((last.links || []).map((l) => l.url), ["/appointment-booking"], "points to booking");
    socket.close();
  });

  test("AI: a USD visitor is unchanged (prices allowed, nothing cut)", async () => {
    const { socket } = await openChat("India");
    lc.ai.queue.push({
      ok: true, reply: "A General consultation is $49.", handoff: false, handoffReason: "none", topic: "pricing", links: [],
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50, costUsd: 0.0001 },
    });
    await lc.call(socket, "chat:message", { text: "how much is a consultation?" });
    assert.equal(lc.ai.calls[0].hidePrices, false);
    const last = await lastAi(socket);
    assert.equal(last.text, "A General consultation is $49.");
    socket.close();
  });
});
