// Live chat prices: the AI quotes the Super Admin pricing in the visitor's own currency (what checkout would charge), and every
// AI / quick-option reply is checked against that list. An amount that is not an exact price of the list is cut, the patient is
// told the price is shown when they book, and the booking page (never the generic Pricing blog) is the link.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A } = require("./helpers/liveChatServer");
const { buildSystemPrompt } = require("../services/liveChat/aiService");
const priceMode = require("../services/liveChat/priceMode");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

const setFlag = (on) => {
  if (on) process.env.MULTI_CURRENCY_ENABLED = "true";
  else delete process.env.MULTI_CURRENCY_ENABLED;
};
const item = (key, name, amount, currency = "USD", text) => ({ key, name, amount, currency, text: text || `${{ USD: "$", EUR: "€", GBP: "£", INR: "₹" }[currency]}${amount}` });
const LIST = [item("general-consultation", "General consultation", 49), item("prescription-refills", "Prescription refills", 60)];

describe("live chat prices: helpers", () => {
  after(() => setFlag(false));

  test("hasAmount sees $, €, £ and ₹ amounts and currency words, not plain numbers", () => {
    for (const text of ["It is $49.", "Only €30 today", "just £25", "49 USD", "30 euros", "25 pounds", "EUR 30", "₹1,499", "Rs. 999"]) {
      assert.equal(priceMode.hasAmount(text), true, text);
    }
    for (const text of ["Book in 5 minutes.", "Hello", "Our doctors are online 24 hours a day.", "Call 911", ""]) {
      assert.equal(priceMode.hasAmount(text), false, text);
    }
  });

  test("amountsIn reads the number and the currency of every amount", () => {
    assert.deepEqual(priceMode.amountsIn("$49 and €30"), [{ value: 49, currency: "USD" }, { value: 30, currency: "EUR" }]);
    const found = priceMode.amountsIn("₹1,499 or Rs. 999 or 25 pounds");
    assert.deepEqual(found.map((x) => `${x.currency}${x.value}`).sort(), ["GBP25", "INR1499", "INR999"]);
    assert.deepEqual(priceMode.amountsIn("$49.50"), [{ value: 49.5, currency: "USD" }]);
  });

  test("guardAmounts: an exact listed price passes; any other amount (or another currency) is cut", () => {
    assert.equal(priceMode.guardAmounts("A General consultation is $49.", LIST).changed, false);
    assert.equal(priceMode.guardAmounts("Refills are $60 and a consultation is $49.", LIST).changed, false);
    assert.equal(priceMode.guardAmounts("No amount here.", LIST).changed, false);
    const wrong = priceMode.guardAmounts("A General consultation is $59. Book from Book Appointment.", LIST);
    assert.equal(wrong.changed, true);
    assert.equal(wrong.text, `${priceMode.PRICE_AT_BOOKING} Book from Book Appointment.`);
    assert.equal(priceMode.guardAmounts("It is €49.", LIST).changed, true, "the number is right but the currency is not the list's");
    assert.equal(priceMode.guardAmounts("It costs $49.", []).changed, true, "no prices known: nothing may be quoted");
    assert.equal(priceMode.guardAmounts("It costs $5.", LIST).text, priceMode.PRICE_AT_BOOKING);
  });

  test("withoutPrices drops only the sentences that quote an amount and says the price is shown at booking", () => {
    assert.equal(
      priceMode.withoutPrices("You can see a doctor online. A general consultation is $49, and a refill is $60. Book from Book Appointment."),
      `${priceMode.PRICE_AT_BOOKING} You can see a doctor online. Book from Book Appointment.`,
    );
    assert.equal(priceMode.withoutPrices("Book from Book Appointment."), "Book from Book Appointment.");
  });

  test("fillPrices puts the live price into {price:key}; a missing price cuts that sentence", () => {
    assert.equal(priceMode.fillPrices("Refills are {price:prescription-refills}. Book now.", LIST), "Refills are $60. Book now.");
    assert.equal(
      priceMode.fillPrices("Refills are {price:fit-to-fly}. Book now.", LIST),
      `${priceMode.PRICE_AT_BOOKING} Book now.`,
    );
    assert.equal(priceMode.fillPrices("Plain text.", LIST), "Plain text.");
  });

  test("quickReplyFor swaps a stored OLD default reply for the current one, and leaves an admin's own text alone", () => {
    const { quickReplyFor, OLD_DEFAULT_QUICK_REPLIES, QUICK_OPTIONS } = require("../services/liveChat/settingsDefaults");
    const refill = QUICK_OPTIONS.find((o) => o.key === "refill");
    assert.ok(refill.reply.includes("{price:prescription-refills}"));
    assert.equal(quickReplyFor({ key: "refill", reply: OLD_DEFAULT_QUICK_REPLIES.refill }), refill.reply);
    assert.equal(quickReplyFor({ key: "refill", reply: "Refills are $60 today only." }), "Refills are $60 today only.");
    for (const o of QUICK_OPTIONS) assert.equal(priceMode.hasAmount(o.reply), false, `${o.key} has no typed price`);
  });

  test("the chat currency follows the visitor's country: the checkout rule (flag, Razorpay for INR, USD when unknown)", () => {
    const keys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"].map((k) => [k, process.env[k]]);
    try {
      setFlag(false);
      assert.equal(priceMode.chatCurrencyOf({ geo: { country: "Germany" } }), "USD");
      setFlag(true);
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      assert.equal(priceMode.chatCurrencyOf({ geo: { country: "Germany" } }), "EUR");
      assert.equal(priceMode.chatCurrencyOf({ geo: { country: "United Kingdom" } }), "GBP");
      assert.equal(priceMode.chatCurrencyOf({ geo: { country: "India" } }), "USD", "INR needs the Razorpay keys");
      process.env.RAZORPAY_KEY_ID = "rzp_test_k";
      process.env.RAZORPAY_KEY_SECRET = "s";
      assert.equal(priceMode.chatCurrencyOf({ geo: { country: "India" } }), "INR");
      assert.equal(priceMode.chatCurrencyOf({ geo: { country: "" } }), "USD");
      assert.equal(priceMode.chatCurrencyOf({}), "USD");
    } finally {
      for (const [k, v] of keys) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      setFlag(false);
    }
  });

  test("the AI prompt lists the live prices with their symbol, has no typed example price, and quotes nothing without a list", () => {
    const eur = buildSystemPrompt(DEFAULT_SETTINGS, [], { prices: { currency: "EUR", items: [item("general-consultation", "General consultation", 39, "EUR")] } });
    assert.ok(eur.includes("Prices (EUR):"));
    assert.ok(eur.includes("- General consultation: €39"));
    assert.equal(/\$\d/.test(eur), false, "no typed dollar example in the prompt");
    assert.ok(eur.includes("not in the Prices list"));
    assert.equal(eur.includes("Fit to fly: "), false, "only the services that have a price are listed");

    const none = buildSystemPrompt(DEFAULT_SETTINGS, [], { prices: { currency: "USD", items: [] } });
    assert.equal(none.includes("Prices ("), false);
    assert.ok(none.includes("never state a price"));
    assert.ok(none.includes("shown when they book"));
    assert.equal(buildSystemPrompt(DEFAULT_SETTINGS, []).includes("Prices ("), false, "no list given: quote nothing");
    assert.equal(buildSystemPrompt({ ...DEFAULT_SETTINGS, prices: [{ name: "Old", price: 1 }] }, [], { prices: { currency: "USD", items: LIST } }).includes("Old"), false, "the old manual list is never read");
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
    for (const code of Object.keys(lc.prices.book)) if (code !== "USD") delete lc.prices.book[code];
    lc.prices.book.USD = { "general-consultation": 49, "mental-health": 49, "doctor-notes": 49, "lab-requisitions": 49, "chronic-care-management": 55, "prescription-refills": 60, "second-opinion": 60, "fit-to-fly": 69 };
  });

  async function openChat(country) {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    assert.equal(started.ok, true, JSON.stringify(started));
    await lc.models.LcConversation.updateOne({ conversationId: started.conversation.conversationId }, { $set: { "geo.country": country } });
    return { socket, id: started.conversation.conversationId };
  }
  const lastMessage = async (socket) => (await lc.call(socket, "chat:resume")).conversation.messages.at(-1);
  const modelSays = (reply, extra = {}) =>
    lc.ai.queue.push({ ok: true, reply, handoff: false, handoffReason: "none", topic: "pricing", links: [], usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50, costUsd: 0.0001 }, ...extra });
  const ask = async (socket, text = "how much is a consultation?") => {
    assert.equal((await lc.call(socket, "chat:message", { text })).ok, true);
    return lastMessage(socket);
  };

  test("USD visitor, quick option: the live price fills the card, with its own page link", async () => {
    const { socket } = await openChat("United States");
    await lc.call(socket, "chat:option", { key: "consultation" });
    const last = await lastMessage(socket);
    assert.ok(last.text.includes("A general consultation is $49."), last.text);
    assert.deepEqual((last.links || []).map((l) => l.url), ["/online-doctor-consultation"]);
    socket.close();
  });

  test("a price change in the Super Admin pricing shows in the next card, no restart", async () => {
    const { socket } = await openChat("United States");
    lc.prices.book.USD["prescription-refills"] = 72.5;
    await lc.call(socket, "chat:option", { key: "refill" });
    assert.ok((await lastMessage(socket)).text.startsWith("Prescription refills are $72.50."));
    socket.close();
  });

  test("EUR visitor: the card quotes the EUR price checkout would charge", async () => {
    lc.prices.book.EUR = { "prescription-refills": 55 };
    const { socket } = await openChat("Germany");
    await lc.call(socket, "chat:option", { key: "refill" });
    assert.ok((await lastMessage(socket)).text.startsWith("Prescription refills are €55."));
    socket.close();
  });

  test("EUR visitor, service with no EUR price yet: the USD price is quoted as USD, like checkout", async () => {
    const { socket } = await openChat("France");
    await lc.call(socket, "chat:option", { key: "refill" });
    assert.ok((await lastMessage(socket)).text.startsWith("Prescription refills are $60."));
    socket.close();
  });

  test("GBP and INR visitors get their own symbols (INR only while Razorpay is set up)", async () => {
    lc.prices.book.GBP = { "prescription-refills": 48 };
    lc.prices.book.INR = { "prescription-refills": 1499 };
    process.env.RAZORPAY_KEY_ID = "rzp_test_k";
    process.env.RAZORPAY_KEY_SECRET = "s";
    try {
      const uk = await openChat("United Kingdom");
      await lc.call(uk.socket, "chat:option", { key: "refill" });
      assert.ok((await lastMessage(uk.socket)).text.startsWith("Prescription refills are £48."));
      uk.socket.close();
      const india = await openChat("India");
      await lc.call(india.socket, "chat:option", { key: "refill" });
      assert.ok((await lastMessage(india.socket)).text.startsWith("Prescription refills are ₹1,499."));
      india.socket.close();
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      const indiaUsd = await openChat("India");
      await lc.call(indiaUsd.socket, "chat:option", { key: "refill" });
      assert.ok((await lastMessage(indiaUsd.socket)).text.startsWith("Prescription refills are $60."), "no Razorpay: an Indian visitor pays USD");
      indiaUsd.socket.close();
    } finally {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
    }
  });

  test("a EUR visitor with the flag off is a USD visitor", async () => {
    setFlag(false);
    lc.prices.book.EUR = { "prescription-refills": 55 };
    const { socket } = await openChat("Germany");
    await lc.call(socket, "chat:option", { key: "refill" });
    assert.ok((await lastMessage(socket)).text.startsWith("Prescription refills are $60."));
    socket.close();
  });

  test("a service with no price: the card says the price is shown at booking, with no amount", async () => {
    delete lc.prices.book.USD["prescription-refills"];
    const { socket } = await openChat("United States");
    await lc.call(socket, "chat:option", { key: "refill" });
    const last = await lastMessage(socket);
    assert.equal(priceMode.hasAmount(last.text), false, last.text);
    assert.ok(last.text.startsWith(priceMode.PRICE_AT_BOOKING));
    socket.close();
  });

  test("the AI gets the visitor's price list in their currency", async () => {
    lc.prices.book.EUR = { "general-consultation": 39 };
    const { socket } = await openChat("France");
    modelSays("A General consultation is €39.");
    const last = await ask(socket);
    assert.equal(lc.ai.calls[0].prices.currency, "EUR");
    assert.deepEqual(lc.ai.calls[0].prices.items.map((i) => i.text), ["€39"]);
    assert.equal(last.text, "A General consultation is €39.");
    socket.close();
  });

  test("AI: a listed price passes unchanged", async () => {
    const { socket } = await openChat("United States");
    modelSays("A General consultation is $49.");
    assert.equal((await ask(socket)).text, "A General consultation is $49.");
    socket.close();
  });

  test("AI: an amount that is not a current price is blocked, the rest of the reply stays, and the booking page is the link", async () => {
    const { socket } = await openChat("United States");
    modelSays("A General consultation is $29. You can book it any time.");
    const last = await ask(socket);
    assert.equal(last.text.includes("$29"), false, last.text);
    assert.ok(last.text.includes(priceMode.PRICE_AT_BOOKING));
    assert.ok(last.text.includes("You can book it any time."));
    assert.deepEqual((last.links || []).map((l) => l.url), ["/appointment-booking"]);
    socket.close();
  });

  test("AI: a dollar amount to a EUR visitor is blocked even when the number matches a USD price", async () => {
    lc.prices.book.EUR = { "general-consultation": 39 };
    const { socket } = await openChat("France");
    modelSays("A General consultation is $49.");
    const last = await ask(socket);
    assert.equal(last.text.includes("$49"), false, last.text);
    assert.ok(last.text.includes(priceMode.PRICE_AT_BOOKING));
    socket.close();
  });

  test("AI: a service with no price is not quoted - the booking page is offered", async () => {
    delete lc.prices.book.USD["fit-to-fly"];
    const { socket } = await openChat("United States");
    modelSays("A Fit to fly certificate is $69.");
    const last = await ask(socket, "how much is fit to fly?");
    assert.equal(priceMode.hasAmount(last.text), false, last.text);
    assert.ok(last.text.includes(priceMode.PRICE_AT_BOOKING));
    assert.deepEqual((last.links || []).map((l) => l.url), ["/appointment-booking"]);
    assert.ok(!lc.ai.calls[0].prices.items.some((i) => i.key === "fit-to-fly"), "it is not in the prompt's list either");
    socket.close();
  });

  test("a price question never links the Pricing blog: the booking page replaces it", async () => {
    const { socket } = await openChat("United States");
    modelSays("Our prices are shown when you book.", { links: [{ title: "Pricing", url: "/telemedicine-cost-usa" }] });
    const last = await ask(socket, "what are your prices?");
    assert.ok(!(last.links || []).some((l) => l.url === "/telemedicine-cost-usa"), JSON.stringify(last.links));
    assert.deepEqual((last.links || []).map((l) => l.url), ["/appointment-booking"]);
    socket.close();
  });

  test("an older stored quick-option reply with a typed price is replaced by the live price", async () => {
    const { OLD_DEFAULT_QUICK_REPLIES } = require("../services/liveChat/settingsDefaults");
    await lc.models.LcSettings.updateOne(
      { key: "default" },
      { $set: { "quickOptions.$[o].reply": OLD_DEFAULT_QUICK_REPLIES.refill } },
      { arrayFilters: [{ "o.key": "refill" }] },
    ).catch(() => {});
    const { socket } = await openChat("United States");
    lc.prices.book.USD["prescription-refills"] = 64;
    await lc.call(socket, "chat:option", { key: "refill" });
    const last = await lastMessage(socket);
    assert.ok(!last.text.includes("$60"), last.text);
    socket.close();
  });

  test("the admin Prices card is read only: GET /prices lists each AI service with its price per currency; there is no write route", async () => {
    lc.prices.book.EUR = { "fit-to-fly": 63 };
    const res = await lc.rest("GET", "/prices", { user: AGENT_A });
    assert.equal(res.status, 200);
    const fit = res.body.services.find((x) => x.key === "fit-to-fly");
    assert.deepEqual([fit.source, fit.ref, fit.prices.USD.text, fit.prices.EUR.text], ["service", "fit-to-fly", "$69", "€63"]);
    assert.equal(res.body.services.length, 8);
    assert.equal((await lc.rest("PUT", "/prices", { user: AGENT_A, body: {} })).status, 404);
    assert.equal((await lc.rest("POST", "/prices", { user: AGENT_A, body: {} })).status, 404);
  });
});
