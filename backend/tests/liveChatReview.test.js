const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { startChatServer, AGENT_A, AGENT_B, SUPER_S } = require("./helpers/liveChatServer");
const { decryptLiveChatText } = require("../utils/liveChat/crypto");
const { istDayKey, DAY_MS } = require("../services/liveChat/istDay");
const { purgeConversations } = require("../services/liveChat/retention");
const safety = require("../services/liveChat/safety");
const LcReviewLog = require("../models/LcReviewLog");

const oid = (id) => new mongoose.Types.ObjectId(id);
const USAGE = { inputTokens: 900, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 };
const modelReply = (reply, over = {}) => ({
  ok: true, reply, handoff: false, handoffReason: "none", offTopic: false, topic: "other", links: [],
  language: { code: "en", name: "English" }, usage: USAGE, ...over,
});

describe("live chat: AI notice record, medical flags, AI Review", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    await mongoose.connection.db.collection("users").insertMany([
      { _id: oid(AGENT_A), name: "Sam Carter", role: "admin", email: "sam@example.com" },
      { _id: oid(AGENT_B), name: "Maya Lopez", role: "admin", email: "maya@example.com" },
      { _id: oid(SUPER_S), name: "Super Admin", role: "superadmin", email: "super@example.com" },
    ]);
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(async () => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    await lc.setSettings({ showAiNotice: false, policyVersion: "v1" });
  });

  const A = { user: AGENT_A }; // a plain agent
  const B = { user: AGENT_B }; // becomes a reviewer
  const S = { user: SUPER_S, role: "superadmin" };
  const rest = (...args) => lc.rest(...args);

  async function openChat(extra = {}, startExtra = {}) {
    const contact = await lc.submitContact(extra);
    assert.equal(contact.status, 200, JSON.stringify(contact));
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home", ...startExtra });
    return { socket, id: started.conversation?.conversationId, visitorId: contact.visitorId, token: contact.token };
  }
  const say = (chat, text) => lc.call(chat.socket, "chat:message", { text });
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();

  describe("D: AI notice record (no checkbox), behind the Super Admin setting", () => {
    test("off (default): /config says so, the form needs no flag and nothing is recorded", async () => {
      const config = await (await fetch(`${lc.url}/api/livechat/config`)).json();
      assert.equal(config.showAiNotice, false);
      assert.equal(config.policyVersion, "v1");
      const chat = await openChat();
      assert.equal((await convOf(chat.id)).consent.aiNoticeAcceptedAt, null);
      assert.equal((await lc.models.LcVisitor.findOne({ visitorId: chat.visitorId }).lean()).consent.aiNoticeAcceptedAt, null);
      chat.socket.close();
    });

    test("on: /contact without the flag is refused with a clear 'refresh the page' error and creates nothing", async () => {
      await lc.setSettings({ showAiNotice: true });
      const before = await lc.models.LcVisitor.countDocuments();
      const res = await lc.submitContact({ name: "Old Widget", email: "old.widget@example.com" });
      assert.equal(res.status, 400);
      assert.equal(res.error, "refresh_required");
      assert.match(res.errors.form, /refresh the page/i);
      assert.equal(res.token, undefined);
      assert.equal(await lc.models.LcVisitor.countDocuments(), before);
      // anything but exactly true is refused too
      assert.equal((await lc.submitContact({ aiNoticeAccepted: "true" })).status, 400);
      assert.equal((await lc.submitContact({ aiNoticeAccepted: 1 })).status, 400);
    });

    test("on: Start chat with the flag records time and policy version on the visitor, the chat, and the admin details", async () => {
      await lc.setSettings({ showAiNotice: true, policyVersion: "v7" });
      const before = Date.now();
      const chat = await openChat({ aiNoticeAccepted: true });
      const conv = await convOf(chat.id);
      assert.equal(conv.consent.policyVersion, "v7");
      assert.ok(new Date(conv.consent.aiNoticeAcceptedAt).getTime() >= before - 2000);
      const visitor = await lc.models.LcVisitor.findOne({ visitorId: chat.visitorId }).lean();
      assert.equal(visitor.consent.policyVersion, "v7");
      const detail = (await rest("GET", `/conversations/${chat.id}`, A)).body;
      assert.equal(detail.panel.info.aiNotice.policyVersion, "v7");
      assert.ok(detail.panel.info.aiNotice.acceptedAt);
      chat.socket.close();
    });

    test("default policy version is v1 when none was set", async () => {
      await lc.models.LcSettings.updateOne({ key: "default" }, { $unset: { policyVersion: 1 } });
      await lc.setSettings({ showAiNotice: true });
      const chat = await openChat({ aiNoticeAccepted: true });
      assert.equal((await convOf(chat.id)).consent.policyVersion, "v1");
      chat.socket.close();
    });

    test("a returning visitor who has not accepted (or accepted an older version) is sent back to the form", async () => {
      const chat = await openChat(); // accepted nothing: the notice was off
      await lc.setSettings({ showAiNotice: true, policyVersion: "v2" });
      const resumed = await lc.call(chat.socket, "chat:resume");
      assert.equal(resumed.needContact, true);
      // submitting the form again (same visitor) with the flag records the acceptance and the chat continues
      const again = await lc.submitContact({ visitorId: chat.visitorId, aiNoticeAccepted: true });
      assert.equal(again.status, 200);
      const socket = await lc.chatSocket(again.token);
      const resumedAgain = await lc.call(socket, "chat:resume");
      assert.equal(resumedAgain.needContact, false);
      assert.equal(resumedAgain.conversation.conversationId, chat.id);
      assert.equal((await convOf(chat.id)).consent.policyVersion, "v2");
      // a new policy version asks again
      await lc.setSettings({ policyVersion: "v3" });
      assert.equal((await lc.call(socket, "chat:resume")).needContact, true);
      chat.socket.close();
      socket.close();
    });

    test("only a Super Admin changes the two settings; the change is logged", async () => {
      assert.equal((await rest("PUT", "/settings", { ...A, body: { showAiNotice: true } })).status, 403);
      assert.equal((await rest("PUT", "/settings", { ...S, body: { showAiNotice: "yes" } })).status, 400);
      assert.equal((await rest("PUT", "/settings", { ...S, body: { policyVersion: "has spaces" } })).status, 400);
      assert.equal((await rest("PUT", "/settings", { ...S, body: { showAiNotice: true, policyVersion: "v9" } })).body.changed, 2);
      const entry = (await rest("GET", "/settings/audit", A)).body.entries[0];
      assert.deepEqual(entry.changes.map((c) => [c.field, c.after]).sort(), [["policyVersion", "v9"], ["showAiNotice", "true"]]);
      assert.equal((await rest("GET", "/settings", A)).body.settings.showAiNotice, true);
    });
  });

  describe("E: medical flags", () => {
    const flagsOf = async (chat) => (await convOf(chat.id)).flags;

    test("a normal price question is not flagged", async () => {
      const chat = await openChat();
      await say(chat, "How much is a consultation?");
      const conv = await convOf(chat.id);
      assert.equal(conv.flags.medical, false);
      assert.equal(conv.review.status, "");
      chat.socket.close();
    });

    test("the emergency detector flags with reason emergency_keyword, also for a false alarm", async () => {
      const chat = await openChat();
      await say(chat, "I have chest pain");
      const conv = await convOf(chat.id);
      assert.equal(conv.flags.medical, true);
      assert.deepEqual(conv.flags.reasons, ["emergency_keyword"]);
      assert.equal(conv.review.status, "unreviewed");
      assert.ok(conv.flags.firstAt && conv.flags.lastAt);
      chat.socket.close();
    });

    test("a blocked reply flags with reply_blocked; a medical topic with model_medical; a model emergency with model_emergency", async () => {
      lc.ai.queue.push(modelReply("You may have a migraine.", { topic: "medical" }));
      const a = await openChat();
      await say(a, "my head hurts");
      assert.deepEqual((await flagsOf(a)).reasons.sort(), ["model_medical", "reply_blocked"]);

      lc.ai.queue.push(modelReply("I can't give medical advice. A licensed Humancare Connect doctor can help you.", { topic: "medical" }));
      const b = await openChat();
      await say(b, "what causes migraines");
      assert.deepEqual((await flagsOf(b)).reasons, ["model_medical"]);

      lc.ai.queue.push(modelReply("Please call 911 now.", { handoff: true, handoffReason: "emergency" }));
      const c = await openChat();
      await say(c, "my arm feels strange");
      assert.deepEqual((await flagsOf(c)).reasons, ["model_emergency"]);
      for (const chat of [a, b, c]) chat.socket.close();
    });

    test("a 'too long' fallback alone does not flag the chat", async () => {
      lc.ai.queue.push({ ok: false, kind: "too_long", usage: USAGE });
      const chat = await openChat();
      await say(chat, "tell me about your services");
      assert.equal((await flagsOf(chat)).medical, false);
      chat.socket.close();
    });
  });

  describe("E: AI Review page (access)", () => {
    test("a plain agent is refused; Super Admin and an allowed admin get in", async () => {
      assert.equal((await rest("GET", "/review/access", A)).body.canReview, false);
      assert.equal((await rest("GET", "/review", A)).status, 403);
      assert.equal((await rest("GET", "/review/log", A)).status, 403);
      assert.equal((await rest("GET", "/review/HCABCDEFGH", A)).status, 403);
      assert.equal((await rest("POST", "/review/HCABCDEFGH", { ...A, body: { outcome: "ok" } })).status, 403);

      assert.equal((await rest("GET", "/review/access", S)).body.canReview, true);
      assert.equal((await rest("GET", "/review", S)).status, 200);

      // only a Super Admin grants it, only to an admin, and it is logged
      assert.equal((await rest("PUT", `/team/${AGENT_B}/reviewer`, { ...A, body: { enabled: true } })).status, 403);
      assert.equal((await rest("PUT", `/team/${AGENT_B}/reviewer`, { ...S, body: { enabled: "yes" } })).status, 400);
      assert.equal((await rest("PUT", `/team/${SUPER_S}/reviewer`, { ...S, body: { enabled: true } })).status, 404);
      assert.equal((await rest("PUT", `/team/${AGENT_B}/reviewer`, { ...S, body: { enabled: true } })).status, 200);
      assert.equal((await rest("GET", "/review/access", B)).body.canReview, true);
      assert.equal((await rest("GET", "/review", B)).status, 200);
      const team = (await rest("GET", "/team", B)).body.agents;
      assert.equal(team.find((r) => r.userId === AGENT_B).reviewer, true);
      assert.equal(team.find((r) => r.userId === AGENT_A).reviewer, false);
      const entry = (await rest("GET", "/settings/audit", S)).body.entries[0];
      assert.equal(entry.changes[0].field, "aiReviewer.Maya Lopez");
      assert.deepEqual([entry.changes[0].before, entry.changes[0].after], ["not allowed", "allowed"]);
      // the reviewer permission is not a role: it does not give the other Super Admin powers
      assert.equal((await rest("PUT", "/settings", { ...B, body: { showAiNotice: true } })).status, 403);

      // and it can be taken away again
      assert.equal((await rest("PUT", `/team/${AGENT_B}/reviewer`, { ...S, body: { enabled: false } })).status, 200);
      assert.equal((await rest("GET", "/review", B)).status, 403);
      await rest("PUT", `/team/${AGENT_B}/reviewer`, { ...S, body: { enabled: true } });
    });
  });

  describe("E: AI Review page (list, transcript, review log)", () => {
    let flagged;
    let clean;
    before(async () => {
      lc.ai.queue.push(modelReply("You may have a migraine.", { topic: "medical" }));
      flagged = await openChat({ name: "Priya Shah" });
      await say(flagged, "my head hurts a lot");
      await rest("POST", `/conversations/${flagged.id}/notes`, { ...S, body: { text: "internal note text" } });
      clean = await openChat();
      await say(clean, "How much is a consultation?");
    });
    after(() => {
      flagged.socket.close();
      clean.socket.close();
    });

    test("lists only flagged chats, newest first, with Unreviewed / Reviewed / All and a date filter", async () => {
      const second = await openChat();
      await say(second, "I want to kill myself");
      const unreviewed = (await rest("GET", "/review?status=unreviewed", B)).body.chats.map((c) => c.conversationId);
      assert.ok(unreviewed.includes(flagged.id) && unreviewed.includes(second.id));
      assert.equal(unreviewed.includes(clean.id), false);
      assert.ok(unreviewed.indexOf(second.id) < unreviewed.indexOf(flagged.id), "newest first");

      const today = istDayKey(Date.now());
      const yesterday = istDayKey(Date.now() - DAY_MS);
      assert.ok((await rest("GET", `/review?status=all&from=${today}&to=${today}`, B)).body.chats.some((c) => c.conversationId === flagged.id));
      assert.equal((await rest("GET", `/review?status=all&to=${yesterday}`, B)).body.chats.some((c) => c.conversationId === flagged.id), false);
      assert.equal((await rest("GET", `/review?status=all&from=${istDayKey(Date.now() + DAY_MS)}`, B)).body.chats.length, 0);
      second.socket.close();
    });

    test("the transcript has the patient's and AI's messages (marked when a fixed safe reply), never internal notes", async () => {
      const detail = (await rest("GET", `/review/${flagged.id}`, B)).body;
      assert.equal(detail.chat.flags.medical, true);
      const texts = detail.messages.map((m) => m.text).join("\n");
      assert.ok(texts.includes("my head hurts a lot"));
      assert.equal(texts.includes("internal note text"), false);
      assert.ok(detail.messages.some((m) => m.sender === "ai" && m.safetyBlocked && m.text === safety.FIXED_TEXT.fallback.en));
      assert.equal(detail.messages.some((m) => /migraine/.test(m.text)), false); // the model's blocked text was never stored
      // a chat that is not flagged, or does not exist, is not reachable here
      assert.equal((await rest("GET", `/review/${clean.id}`, B)).status, 404);
      assert.equal((await rest("GET", "/review/HCNOTEXIST", B)).status, 404);
    });

    test("a review appends a log row, marks the chat reviewed, and shows on the chat details", async () => {
      assert.equal((await rest("POST", `/review/${flagged.id}`, { ...B, body: { outcome: "maybe" } })).status, 400);
      assert.equal((await rest("POST", `/review/${flagged.id}`, { ...B, body: { outcome: "issue", note: "  " } })).body.error, "note_required");
      assert.equal((await rest("POST", `/review/${flagged.id}`, { ...B, body: { outcome: "ok", note: "x".repeat(1001) } })).body.error, "note_too_long");
      assert.equal((await LcReviewLog.countDocuments({ conversationId: flagged.id })), 0);

      const ok = await rest("POST", `/review/${flagged.id}`, { ...B, body: { outcome: "ok", note: "Refusal was fine." } });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.entry.outcome, "ok");
      assert.equal(ok.body.entry.reviewer.name, "Maya Lopez");
      assert.equal(ok.body.entry.conversationId, flagged.id);

      const reviewed = (await rest("GET", "/review?status=reviewed", S)).body.chats.find((c) => c.conversationId === flagged.id);
      assert.equal(reviewed.review.status, "reviewed");
      assert.equal(reviewed.review.lastOutcome, "ok");
      assert.equal((await rest("GET", "/review?status=unreviewed", S)).body.chats.some((c) => c.conversationId === flagged.id), false);

      const issue = await rest("POST", `/review/${flagged.id}`, { ...S, body: { outcome: "issue", note: "Link should not be shown." } });
      assert.equal(issue.status, 200);
      const detail = (await rest("GET", `/review/${flagged.id}`, B)).body;
      assert.deepEqual(detail.reviews.map((r) => r.outcome), ["issue", "ok"]); // newest first, both kept
      assert.equal(detail.chat.review.count, 2);
      assert.equal(detail.chat.review.lastOutcome, "issue");

      // review status on the chat details (visible to every agent)
      const info = (await rest("GET", `/conversations/${flagged.id}`, A)).body.panel.info;
      assert.equal(info.safety.reviewStatus, "reviewed");
      assert.equal(info.safety.reviewOutcome, "issue");
      assert.deepEqual(info.safety.reasons.sort(), ["model_medical", "reply_blocked"]);
      assert.equal((await rest("GET", `/conversations/${clean.id}`, A)).body.panel.info.safety, null);

      // the note is stored encrypted
      const row = await LcReviewLog.findOne({ conversationId: flagged.id, outcome: "ok" }).lean();
      assert.notEqual(row.note.cipherText, "Refusal was fine.");
      assert.equal(decryptLiveChatText(row.note), "Refusal was fine.");
    });

    test("a new flag after a review makes the chat unreviewed again", async () => {
      lc.ai.queue.push(modelReply("Take 400 mg of ibuprofen.", { topic: "medical" }));
      await say(flagged, "what should I take?");
      const row = (await rest("GET", "/review?status=unreviewed", S)).body.chats.find((c) => c.conversationId === flagged.id);
      assert.ok(row, "back in Unreviewed");
      assert.equal(row.review.count, 2); // the earlier reviews are still counted
    });

    test("the log is append-only: no edit or delete route, and the model refuses updates and deletes", async () => {
      const entry = (await LcReviewLog.findOne({ conversationId: flagged.id }).lean());
      for (const method of ["PUT", "PATCH", "DELETE"]) {
        const res = await rest(method, `/review/${flagged.id}`, { ...S, body: { outcome: "ok" } });
        assert.equal(res.status, 404, method);
        assert.equal((await rest(method, `/review/log/${entry._id}`, { ...S, body: {} })).status, 404, method);
      }

      await assert.rejects(LcReviewLog.updateOne({ _id: entry._id }, { $set: { outcome: "ok" } }), /append-only/);
      await assert.rejects(LcReviewLog.deleteOne({ _id: entry._id }), /append-only/);
      await assert.rejects(LcReviewLog.deleteMany({}), /append-only/);
      await assert.rejects(LcReviewLog.findOneAndUpdate({ _id: entry._id }, { $set: { note: null } }), /append-only/);
      const doc = await LcReviewLog.findById(entry._id);
      doc.outcome = doc.outcome === "ok" ? "issue" : "ok";
      await assert.rejects(doc.save(), /append-only/);
      await assert.rejects(doc.deleteOne(), /append-only/);
      assert.equal(await LcReviewLog.countDocuments({ _id: entry._id }), 1);
    });

    test("the log outlives the chat: a retention / Trash purge deletes the chat, the log row still names it", async () => {
      lc.ai.queue.push(modelReply("You probably have an infection.", { topic: "medical" }));
      const doomed = await openChat();
      await say(doomed, "my throat is sore");
      const startedAt = (await convOf(doomed.id)).startedAt;
      await rest("POST", `/review/${doomed.id}`, { ...S, body: { outcome: "ok", note: "Fine." } });

      const out = await purgeConversations([doomed.id]);
      assert.deepEqual(out.deletedIds, [doomed.id]);
      assert.equal(await convOf(doomed.id), null);
      assert.equal((await rest("GET", `/review/${doomed.id}`, S)).status, 404);

      const entries = (await rest("GET", "/review/log", S)).body.entries;
      const kept = entries.find((e) => e.conversationId === doomed.id);
      assert.ok(kept, "the log row survived");
      assert.equal(kept.chatAvailable, false);
      assert.equal(new Date(kept.chatStartedAt).getTime(), new Date(startedAt).getTime());
      assert.deepEqual(kept.flagReasons.sort(), ["model_medical", "reply_blocked"]);
      assert.equal(kept.note, "Fine.");
      assert.equal(entries.find((e) => e.conversationId === flagged.id).chatAvailable, true);
      doomed.socket.close();
    });
  });
});
