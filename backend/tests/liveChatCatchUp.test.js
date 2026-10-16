// Catch-up for abandoned chats (a restart or deploy loses the in-memory "patient left" timer, and chats from before
// the inactivity timer have no due time):
//   - "inactive": last visible message is from the AI or an admin and older than the inactivity minutes;
//   - "patient left": nobody connected and the persisted leave time has passed.
// Never the Queue, a connected patient, or an admin-held chat where the patient wrote last. Idempotent.
// Also: the "Language not detected" hint is only for chats whose language is really unknown.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startChatServer, sleep, AGENT_A } = require("./helpers/liveChatServer");
const { encryptLiveChatText, decryptLiveChatText } = require("../utils/liveChat/crypto");

const MIN = 60_000;
const ID_CHARS = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const newId = () => "HC" + Array.from({ length: 8 }, () => ID_CHARS[crypto.randomInt(ID_CHARS.length)]).join("");

async function waitFor(fn, ms = 3000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

describe("live chat: catch-up for abandoned chats", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      // background jobs stay quiet: these tests call the sweeps themselves
      mount: { followUpJobMs: 3_600_000, graceMs: 600_000, dailySweepStartDelayMs: 3_600_000 },
    });
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(async () => {
    await lc.setSettings({ inactiveMinutes: 10 });
  });

  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const sweep = () => lc.livechat.chat.runAbandonedSweep();
  const ago = (ms) => new Date(Date.now() - ms);

  // A chat created directly (no socket: nobody is connected) with its last visible message.
  async function seed({ mode = "ai", last = "ai", lastAt = ago(30 * MIN), inactiveDueAt = null, leaveDueAt = null } = {}) {
    const id = newId();
    await lc.models.LcConversation.create({
      conversationId: id,
      visitorId: `v${crypto.randomBytes(12).toString("hex")}`,
      mode,
      everLive: mode !== "ai",
      assigneeId: mode === "live" ? AGENT_A : null,
      agentName: mode === "live" ? "Sam" : "",
      lastMessageAt: lastAt,
      startedAt: new Date(lastAt.getTime() - 5 * MIN),
      inactiveDueAt,
      leaveDueAt,
    });
    await lc.models.LcMessage.create({ conversationId: id, sender: last, text: encryptLiveChatText("hello"), createdAt: lastAt });
    return id;
  }
  const systemLines = async (id) =>
    (await lc.models.LcMessage.find({ conversationId: id, sender: "system" }).lean()).map((m) => decryptLiveChatText(m.text));

  describe("inactive", () => {
    test("a chat from before the inactivity timer (no due time) with an old AI or admin message is archived as inactive, once", async () => {
      const ai = await seed({ mode: "ai", last: "ai" });
      const live = await seed({ mode: "live", last: "agent" });
      const first = await sweep();
      assert.ok(first.inactive >= 2);
      for (const id of [ai, live]) {
        const c = await convOf(id);
        assert.equal(c.mode, "archived", id);
        assert.equal(c.closedReason, "inactive");
        assert.equal((await systemLines(id)).length, 1);
      }
      const second = await sweep();
      assert.equal(second.inactive, 0, "idempotent");
      assert.equal((await systemLines(ai)).length, 1, "one closing line");
    });

    test("recent chats, a patient message last, the Queue and connected patients are left alone", async () => {
      const recent = await seed({ mode: "ai", last: "ai", lastAt: ago(2 * MIN) });
      const waiting = await seed({ mode: "live", last: "patient" });
      const queued = await seed({ mode: "queue", last: "ai" });
      const contact = await lc.submitContact({ name: "Still Here" });
      const socket = await lc.chatSocket(contact.token);
      const started = await lc.call(socket, "chat:start", {});
      const connected = started.conversation.conversationId;
      await lc.models.LcConversation.updateOne({ conversationId: connected }, { $set: { lastMessageAt: ago(30 * MIN) } });

      await sweep();
      assert.equal((await convOf(recent)).mode, "ai");
      assert.equal((await convOf(waiting)).mode, "live");
      assert.equal((await convOf(queued)).mode, "queue");
      assert.equal((await convOf(connected)).mode, "ai");
      socket.close();
    });
  });

  describe("patient left", () => {
    test("a passed leave time (from an older version) no longer archives anything", async () => {
      const id = await seed({ mode: "ai", last: "patient", lastAt: ago(5 * MIN), leaveDueAt: ago(2 * MIN) });
      const out = await sweep();
      assert.equal(out.left, 0);
      const c = await convOf(id);
      assert.deepEqual([c.mode, c.closedReason], ["ai", ""]);
    });

    test("no persisted leave time and nobody connected (restart): the chat stays open and no leave time is made up", async () => {
      const id = await seed({ mode: "ai", last: "patient", lastAt: ago(5 * MIN) });
      await sweep();
      await sweep();
      const c = await convOf(id);
      assert.deepEqual([c.mode, c.leaveDueAt], ["ai", null]);
    });

    test("the Queue, an admin-held chat with the patient waiting, and a connected patient are never archived as left", async () => {
      const queued = await seed({ mode: "queue", last: "patient", leaveDueAt: ago(MIN) });
      const waiting = await seed({ mode: "live", last: "patient", leaveDueAt: ago(MIN) });
      const contact = await lc.submitContact({ name: "Back Again" });
      const socket = await lc.chatSocket(contact.token);
      const started = await lc.call(socket, "chat:start", {});
      const connected = started.conversation.conversationId;
      await lc.models.LcConversation.updateOne({ conversationId: connected }, { $set: { leaveDueAt: ago(MIN) } });
      await sweep();
      assert.equal((await convOf(queued)).mode, "queue");
      assert.equal((await convOf(waiting)).mode, "live");
      assert.equal((await convOf(connected)).mode, "ai");
      socket.close();
    });
  });

  describe("restarts and dropped connections", () => {
    test("closing the last connection stores no leave time, and a sweep after a restart leaves the chat open", async () => {
      const contact = await lc.submitContact({ name: "Persist Me" });
      const socket = await lc.chatSocket(contact.token);
      const started = await lc.call(socket, "chat:start", {});
      const id = started.conversation.conversationId;

      socket.close();
      await sleep(700);
      assert.equal((await convOf(id)).leaveDueAt, null, "nothing is stored about the visitor leaving");
      await sweep();
      assert.equal((await convOf(id)).mode, "ai");

      const again = await lc.chatSocket(contact.token);
      const resumed = await lc.call(again, "chat:resume");
      assert.equal(resumed.conversation.conversationId, id);
      again.close();
    });
  });

  describe("the Language not detected hint", () => {
    const AGENT = { user: AGENT_A };
    async function chatWith(text, language) {
      const contact = await lc.submitContact({ name: "Lang Test" });
      const socket = await lc.chatSocket(contact.token);
      const started = await lc.call(socket, "chat:start", {});
      const id = started.conversation.conversationId;
      await lc.models.LcMessage.create({ conversationId: id, sender: "patient", text: encryptLiveChatText(text) });
      if (language) await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { language: { code: language, name: language } } });
      socket.close();
      return id;
    }
    const detail = async (id) => (await lc.rest("GET", `/conversations/${id}?archive=1`, AGENT)).body.conversation;

    test("never for English text, short greetings, or an English chat that stored 'en'", async () => {
      lc.ai.detectOverride = async () => ({ ok: false, kind: "unavailable" }); // a detection that cannot help
      try {
        assert.equal((await detail(await chatWith("hi"))).languageUnknown, false);
        assert.equal((await detail(await chatWith("I need documents signed for a trip"))).languageUnknown, false);
        assert.equal((await detail(await chatWith("Ich brauche ein Rezept für meine Medikamente", "en"))).languageUnknown, false, "a stored language, even English, means known");
      } finally {
        lc.ai.detectOverride = null;
      }
    });

    test("only for non-English-looking text whose language is still unknown", async () => {
      lc.ai.detectOverride = async () => ({ ok: false, kind: "unavailable" });
      try {
        const id = await chatWith("Ich brauche ein Rezept für meine Medikamente, können Sie helfen?");
        const c = await detail(id);
        assert.equal(c.language, null);
        assert.equal(c.languageUnknown, true);
      } finally {
        lc.ai.detectOverride = null;
      }
    });
  });
});
