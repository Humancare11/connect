const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, dayKey, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");
const { tooShortToTell, looksEnglish, protect, restore, normalizeLanguage } = require("../services/liveChat/languageHints");

const GERMAN = { code: "de", name: "German" };
const aiReply = (extra = {}) => ({
  ok: true,
  reply: "Eine Allgemeinberatung kostet 49 Dollar.",
  handoff: false,
  handoffReason: "none",
  topic: "pricing",
  links: [],
  language: GERMAN,
  usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 40, costUsd: 0.0001 },
  ...extra,
});

async function waitFor(fn, ms = 3000, step = 40) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

describe("language helpers", () => {
  test("clearly English and too-short texts are recognised without a model", () => {
    assert.equal(looksEnglish("I need a doctor to help with my cough please"), true);
    assert.equal(looksEnglish("Ich brauche einen Arzt für meinen Husten bitte"), false);
    assert.equal(looksEnglish("Necesito ayuda con mi receta"), false);
    assert.equal(tooShortToTell("Hallo"), true);
    assert.equal(tooShortToTell("ok"), true);
    assert.equal(tooShortToTell("Ich brauche einen Arzt"), false);
  });
  test("language records are validated", () => {
    assert.deepEqual(normalizeLanguage({ code: "DE", name: "German" }), GERMAN);
    assert.deepEqual(normalizeLanguage({ code: "pt-BR", name: "Portuguese" }), { code: "pt", name: "Portuguese" });
    for (const bad of [null, {}, { code: "und", name: "Unknown" }, { code: "de" }, { code: "german", name: "German" }, { code: "de", name: "<script>" }]) {
      assert.equal(normalizeLanguage(bad), null);
    }
  });
  test("links, prices and emails are protected and come back exactly; a lost token makes the result unusable", () => {
    const original = "Siehe https://humancareconnect.co/doctors-note, Preis $49.00 oder schreiben Sie a.b@example.com und /appointment-booking";
    const p = protect(original);
    assert.doesNotMatch(p.text, /humancareconnect|\$49|@example|appointment-booking/);
    assert.equal(restore(p.text, p.tokens), original);
    assert.equal(restore("nothing left", p.tokens), null);
    assert.equal(restore(p.text + " ⟦99⟧", p.tokens), null);
  });
});

describe("live chat: translation for admins", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[AGENT_B] = "Maya";
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(async () => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.ai.translateCalls.length = 0;
    lc.ai.detectCalls.length = 0;
    lc.ai.translateOverride = null;
    lc.ai.detectOverride = null;
    await lc.models.LcAiUsage.deleteMany({});
    await lc.setSettings({ aiMode: "ai_first", dailySpendCapUsd: 3 });
  });

  const rest = (...args) => lc.rest(...args);
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const detailOf = async (id, user = AGENT_A) => (await rest("GET", `/conversations/${id}`, { user })).body;
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const NAME = "Hans Müller";
  const EMAIL = "hans.mueller@example.com";
  const PHONE = "+4915112345678";

  async function openChat(extra = {}) {
    const contact = await lc.submitContact({ name: NAME, email: EMAIL, phone: PHONE, ...extra });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, id: started.conversation.conversationId };
  }
  const say = (chat, text) => lc.call(chat.socket, "chat:message", { text });
  const messageIds = async (id) => (await detailOf(id)).messages;

  // ── detection and badge ──────────────────────────────────────────────────────

  test("the AI reply sets the language; the admin list shows it; English chats have no badge; the patient sees none of it", async () => {
    const german = await openChat();
    lc.ai.queue.push(aiReply());
    await say(german, "Ich brauche eine Beratung für meinen Husten, was kostet das?");
    const conv = await convOf(german.id);
    assert.deepEqual([conv.language.code, conv.language.name], ["de", "German"]);

    const english = await openChat({ name: "Emma Wilson", email: "emma.w@example.com" });
    lc.ai.queue.push(aiReply({ reply: "A consultation is $49.", language: { code: "en", name: "English" } }));
    await say(english, "How much is a consultation for a cough?");

    const rows = (await rest("GET", "/conversations?view=ai")).body.conversations;
    assert.deepEqual(rows.find((r) => r.conversationId === german.id).language, GERMAN);
    assert.equal(rows.find((r) => r.conversationId === english.id).language, null);
    assert.deepEqual((await detailOf(german.id)).conversation.language, GERMAN);

    const patientView = JSON.stringify(await stateOf(german.socket));
    assert.equal(/German|language|translation|sourceText/i.test(patientView), false, "nothing of this reaches the patient");
    german.socket.close();
    english.socket.close();
  });

  test("a clear switch of language updates it; a short message does not", async () => {
    const chat = await openChat();
    lc.ai.queue.push(aiReply());
    await say(chat, "Ich brauche eine Beratung für meinen Husten, was kostet das?");
    lc.ai.queue.push(aiReply({ language: { code: "fr", name: "French" } }));
    await say(chat, "ok merci"); // too short to tell
    assert.equal((await convOf(chat.id)).language.code, "de");
    lc.ai.queue.push(aiReply({ language: { code: "es", name: "Spanish" } }));
    await say(chat, "Ahora quiero hablar en español porque es más fácil para mí");
    const conv = await convOf(chat.id);
    assert.deepEqual([conv.language.code, conv.language.name], ["es", "Spanish"]);
    lc.ai.queue.push(aiReply({ language: { code: "en", name: "English" } }));
    await say(chat, "Actually let me write in English, it is easier for me");
    assert.equal((await rest("GET", "/conversations?view=ai")).body.conversations.find((r) => r.conversationId === chat.id).language, null);
    chat.socket.close();
  });

  test("no AI turn (AI off): one small detection call on a clearly non-English message, counted toward the cap", async () => {
    await lc.setSettings({ aiMode: "ai_off" });
    const chat = await openChat();
    await say(chat, "Hallo"); // too short to tell
    await say(chat, "I would like some help with my prescription please"); // clearly English
    assert.equal(lc.ai.detectCalls.length, 0);
    await say(chat, "Ich brauche ein Rezept für meine Medikamente, können Sie helfen?");
    assert.ok(await waitFor(async () => (await convOf(chat.id)).language?.code === "de"), "badge set");
    assert.equal(lc.ai.detectCalls.length, 1);
    const sent = JSON.stringify(lc.ai.detectCalls[0]);
    for (const secret of [NAME, "Hans", "Müller", EMAIL, PHONE, chat.id]) assert.equal(sent.includes(secret), false, `not sent: ${secret}`);
    assert.ok((await lc.models.LcAiUsage.findOne({ day: dayKey() }).lean()).costUsd > 0, "cost counted");
    await say(chat, "Noch eine Frage zu meinem Rezept bitte"); // language known: no second call
    await sleep(100);
    assert.equal(lc.ai.detectCalls.length, 1);
    chat.socket.close();
  });

  test("detection falls back to no badge when the AI is unavailable or the cap is reached", async () => {
    await lc.setSettings({ aiMode: "ai_off" });
    lc.ai.detectOverride = async () => ({ ok: false, kind: "unavailable" });
    const a = await openChat();
    await say(a, "Ich brauche ein Rezept für meine Medikamente, können Sie helfen?");
    await sleep(200);
    assert.equal((await convOf(a.id)).language.code || "", "");

    lc.ai.detectOverride = null;
    await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 99 } }, { upsert: true });
    const before = lc.ai.detectCalls.length;
    const b = await openChat();
    await say(b, "Ich brauche ein Rezept für meine Medikamente, können Sie helfen?");
    await sleep(200);
    assert.equal(lc.ai.detectCalls.length, before, "no call at all once the cap is reached");
    assert.equal((await convOf(b.id)).language.code || "", "");
    a.socket.close();
    b.socket.close();
  });

  // ── English view ─────────────────────────────────────────────────────────────

  async function germanChat() {
    const chat = await openChat();
    lc.ai.queue.push(aiReply(), aiReply({ reply: "Natürlich, das machen wir gerne." }));
    await say(chat, "Ich brauche eine Beratung für meinen Husten, was kostet das?");
    await say(chat, "I also have a question in English please about my cough"); // clearly English: no model call
    await rest("POST", `/conversations/${chat.id}/notes`, { user: AGENT_A, body: { text: "Intern: Patient klingt besorgt" } });
    lc.ai.translateCalls.length = 0;
    lc.ai.detectCalls.length = 0;
    return chat;
  }

  test("English view translates every non-English message once, skips English / notes / system lines, and caches", async () => {
    const chat = await germanChat();
    const res = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const all = await messageIds(chat.id);
    const german = all.filter((m) => m.sender === "patient" && m.text.startsWith("Ich brauche"));
    const aiGerman = all.filter((m) => m.sender === "ai" && /^(Eine Allgemein|Natürlich)/.test(m.text));
    assert.equal(german.length, 1);
    assert.equal(aiGerman.length, 2);
    for (const m of [...german, ...aiGerman]) assert.equal(res.body.translations[m.id].text, `EN: ${m.text}`);
    assert.equal(res.body.translations[german[0].id].fromName, "German");
    assert.equal(Object.keys(res.body.translations).length, 3, "the English message, the greeting, notes and system lines are not translated");

    // what the model saw: only message text, never the note or contact details
    const sent = JSON.stringify(lc.ai.translateCalls);
    assert.equal(lc.ai.translateCalls.length, 1, "one batched call");
    assert.equal(sent.includes("Intern: Patient"), false, "internal note never translated");
    assert.equal(sent.includes("I also have a question"), false, "clearly English text not sent");
    for (const secret of [NAME, "Hans", EMAIL, PHONE, chat.id]) assert.equal(sent.includes(secret), false, `not sent: ${secret}`);
    assert.equal(lc.ai.translateCalls[0].target, "English");

    // cached on the message, encrypted like the text
    const raw = await lc.models.LcMessage.findOne({ _id: german[0].id }).lean();
    assert.equal(raw.translations.length, 1);
    assert.ok(raw.translations[0].text.cipherText);
    assert.equal(JSON.stringify(raw.translations[0]).includes("EN: Ich brauche"), false, "not in plain text");

    // a second request translates nothing new; the chat detail carries the cached translation
    const again = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    assert.equal(lc.ai.translateCalls.length, 1, "no new model call");
    assert.deepEqual(again.body.translations, res.body.translations);
    const detail = await detailOf(chat.id);
    assert.equal(detail.messages.find((m) => m.id === german[0].id).translation.text, `EN: ${german[0].text}`);
    assert.ok(detail.messages.filter((m) => m.internal).every((m) => !m.translation));
    chat.socket.close();
  });

  test("a new patient message is translated on arrival (only that message is sent)", async () => {
    const chat = await germanChat();
    await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    lc.ai.translateCalls.length = 0;
    lc.ai.queue.push(aiReply({ reply: "Gerne helfen wir Ihnen." }));
    await say(chat, "Wann kann ich einen Termin bekommen, am besten morgen?");
    const all = await messageIds(chat.id);
    const newest = all.filter((m) => m.sender === "patient").at(-1);
    const res = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: { messageIds: [newest.id] } });
    assert.equal(res.body.translations[newest.id].text, `EN: ${newest.text}`);
    assert.equal(lc.ai.translateCalls.length, 1);
    assert.deepEqual(lc.ai.translateCalls[0].items.map((i) => i.id), [newest.id]);
    chat.socket.close();
  });

  test("links and prices survive translation; a result that changes them is not shown or cached", async () => {
    const chat = await openChat();
    lc.ai.queue.push(aiReply({ reply: "Danke." }));
    await say(chat, "Ich möchte https://humancareconnect.co/doctors-note nutzen für $49 bitte");
    lc.ai.translateCalls.length = 0;
    const ok = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    const sent = JSON.stringify(lc.ai.translateCalls);
    assert.doesNotMatch(sent, /humancareconnect|\$49/, "the model never sees the link or price");
    const patientMsg = (await messageIds(chat.id)).find((m) => m.text.startsWith("Ich möchte"));
    assert.match(ok.body.translations[patientMsg.id].text, /^EN: Ich möchte https:\/\/humancareconnect\.co\/doctors-note nutzen für \$49 bitte$/);

    // a different chat where the model drops the placeholders
    const other = await openChat({ name: "Karl Beck", email: "karl@example.com" });
    lc.ai.queue.push(aiReply({ reply: "Danke." }));
    await say(other, "Ich möchte https://humancareconnect.co/doctors-note nutzen für $49 bitte");
    lc.ai.translateOverride = async (input) => ({
      ok: true,
      usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, costUsd: 0 },
      items: input.items.map((i) => ({ id: i.id, code: "de", name: "German", english: false, text: "I want to use the page for 49" })),
    });
    const bad = await rest("POST", `/conversations/${other.id}/translate`, { user: AGENT_A, body: {} });
    assert.equal(bad.status, 200);
    const target = (await messageIds(other.id)).find((m) => m.text.startsWith("Ich möchte"));
    assert.equal(bad.body.translations[target.id], undefined);
    assert.ok(bad.body.failed.includes(target.id));
    assert.equal((await lc.models.LcMessage.findOne({ _id: target.id }).lean()).translations.length, 0, "not cached");
    chat.socket.close();
    other.socket.close();
  });

  // ── reply translation ────────────────────────────────────────────────────────

  test("translate-reply returns the patient-language text and never sends anything", async () => {
    const chat = await germanChat();
    const before = (await messageIds(chat.id)).length;
    lc.ai.translateCalls.length = 0;
    const res = await rest("POST", `/conversations/${chat.id}/translate-reply`, { user: AGENT_A, body: { text: "Yes, a doctor can see you today at 6 PM." } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.text, "DE: Yes, a doctor can see you today at 6 PM.");
    assert.deepEqual(res.body.language, GERMAN);
    assert.equal(lc.ai.translateCalls[0].target, "German");
    assert.equal((await messageIds(chat.id)).length, before, "nothing was sent or saved");
    const state = await stateOf(chat.socket);
    assert.equal(state.messages.some((m) => m.text.includes("DE:")), false, "the patient received nothing");
    const sent = JSON.stringify(lc.ai.translateCalls);
    for (const secret of [NAME, "Hans", EMAIL, PHONE, chat.id]) assert.equal(sent.includes(secret), false);
    chat.socket.close();
  });

  test("an English chat has nothing to translate to (409)", async () => {
    const chat = await openChat({ name: "Emma Wilson", email: "emma.en@example.com" });
    const res = await rest("POST", `/conversations/${chat.id}/translate-reply`, { user: AGENT_A, body: { text: "Hello" } });
    assert.equal(res.status, 409);
    chat.socket.close();
  });

  test("sending a translated reply stores both texts; admins see the English source, the patient only the translation", async () => {
    const chat = await germanChat();
    const sent = await rest("POST", `/conversations/${chat.id}/messages`, {
      user: AGENT_A,
      body: { text: "Ja, heute um 18 Uhr ist ein Termin frei.", sourceText: "Yes, there is a slot today at 6 PM." },
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.message.sourceText, "Yes, there is a slot today at 6 PM.");
    const raw = await lc.models.LcMessage.findOne({ _id: sent.body.message.id }).lean();
    assert.ok(raw.text.cipherText && raw.sourceText.cipherText, "both stored, both encrypted");
    assert.equal(JSON.stringify(raw).includes("slot today"), false);
    const detail = await detailOf(chat.id);
    const row = detail.messages.find((m) => m.id === sent.body.message.id);
    assert.equal(row.text, "Ja, heute um 18 Uhr ist ein Termin frei.");
    assert.equal(row.sourceText, "Yes, there is a slot today at 6 PM.");
    const patient = JSON.stringify(await stateOf(chat.socket));
    assert.ok(patient.includes("heute um 18 Uhr"));
    assert.equal(patient.includes("slot today"), false, "the English source never reaches the patient");
    assert.equal(patient.includes("sourceText"), false);
    chat.socket.close();
  });

  test("internal notes are never translated and never get a source text", async () => {
    const chat = await germanChat();
    const note = (await messageIds(chat.id)).find((m) => m.internal || m.text.startsWith("Intern:"));
    const res = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: { messageIds: [note.id] } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.translations, {});
    assert.equal(lc.ai.translateCalls.length, 0);
    const added = await rest("POST", `/conversations/${chat.id}/notes`, { user: AGENT_A, body: { text: "Note two", sourceText: "x" } });
    const raw = await lc.models.LcMessage.findOne({ _id: added.body.message.id }).lean();
    assert.equal(raw.sourceText?.cipherText || "", "");
    chat.socket.close();
  });

  // ── fallback, cap, rate limit, view choice ──────────────────────────────────

  test("AI unavailable or cap reached: 'translation unavailable', nothing else breaks, the admin can still send", async () => {
    const chat = await germanChat();
    lc.ai.translateOverride = async () => ({ ok: false, kind: "unavailable" });
    const down = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    assert.equal(down.status, 503);
    assert.equal(down.body.error, "translation_unavailable");
    const downReply = await rest("POST", `/conversations/${chat.id}/translate-reply`, { user: AGENT_A, body: { text: "Hello" } });
    assert.equal(downReply.status, 503);
    assert.equal((await detailOf(chat.id)).messages.length > 0, true, "the chat still loads");
    const manual = await rest("POST", `/conversations/${chat.id}/messages`, { user: AGENT_A, body: { text: "Guten Tag, hier ist Sam." } });
    assert.equal(manual.status, 200);

    lc.ai.translateOverride = null;
    const calls = lc.ai.translateCalls.length;
    await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 99 } }, { upsert: true });
    const capped = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    assert.equal(capped.status, 503);
    assert.equal(lc.ai.translateCalls.length, calls, "no model call once the cap is reached");
    chat.socket.close();
  });

  test("translation cost counts toward the daily total", async () => {
    const chat = await germanChat();
    await lc.models.LcAiUsage.deleteMany({});
    await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    const row = await lc.models.LcAiUsage.findOne({ day: dayKey() }).lean();
    assert.ok(row.costUsd > 0 && row.requests >= 1);
    chat.socket.close();
  });

  test("requests are rate-limited per admin", async () => {
    const chat = await germanChat();
    let limited = 0;
    for (let i = 0; i < 34; i += 1) {
      const res = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_B, body: {} });
      if (res.status === 429) limited += 1;
    }
    assert.ok(limited >= 3, `limited ${limited}`);
    const other = await rest("POST", `/conversations/${chat.id}/translate`, { user: AGENT_A, body: {} });
    assert.notEqual(other.status, 429, "another admin is not affected");
    chat.socket.close();
  });

  test("the English / original choice is stored per admin per chat", async () => {
    const chat = await germanChat();
    assert.equal((await detailOf(chat.id, AGENT_A)).view, "original");
    assert.equal((await rest("PUT", `/conversations/${chat.id}/view`, { user: AGENT_A, body: { view: "en" } })).status, 200);
    assert.equal((await detailOf(chat.id, AGENT_A)).view, "en");
    assert.equal((await detailOf(chat.id, AGENT_B)).view, "original");
    assert.equal((await rest("PUT", `/conversations/${chat.id}/view`, { user: AGENT_B, body: { view: "en" } })).status, 200);
    assert.equal((await rest("PUT", `/conversations/${chat.id}/view`, { user: AGENT_A, body: { view: "original" } })).status, 200);
    assert.equal((await detailOf(chat.id, AGENT_A)).view, "original");
    assert.equal((await detailOf(chat.id, AGENT_B)).view, "en");
    assert.equal((await rest("PUT", `/conversations/${chat.id}/view`, { user: AGENT_A, body: { view: "klingon" } })).status, 400);
    const conv = await convOf(chat.id);
    assert.equal(conv.translateViews.length, 2);
    chat.socket.close();
  });

  test("only agents can use any of it", async () => {
    const chat = await germanChat();
    for (const [method, path, body] of [
      ["POST", `/conversations/${chat.id}/translate`, {}],
      ["POST", `/conversations/${chat.id}/translate-reply`, { text: "Hi" }],
      ["PUT", `/conversations/${chat.id}/view`, { view: "en" }],
    ]) {
      const res = await rest(method, path, { user: AGENT_A, role: "user", body });
      assert.ok([401, 403].includes(res.status), `${path} -> ${res.status}`);
    }
    chat.socket.close();
  });
});
