const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { startChatServer, sleep, AGENT_A, AGENT_B, SUPER_S } = require("./helpers/liveChatServer");
const { buildSystemPrompt } = require("../services/liveChat/aiService");
const { DEFAULT_SETTINGS } = require("../services/liveChat/settingsDefaults");

const oid = (id) => new mongoose.Types.ObjectId(id);

describe("live chat: AI agent settings, canned replies, display names", () => {
  let lc;
  before(async () => {
    // a long settings cache on purpose: a save must still apply at once
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      mount: { settingsCacheMs: 60_000 },
    });
    await mongoose.connection.db.collection("users").insertMany([
      { _id: oid(AGENT_A), name: "Sam Carter", role: "admin", email: "sam@example.com" },
      { _id: oid(AGENT_B), name: "Maya Lopez", role: "admin", email: "maya@example.com" },
      { _id: oid(SUPER_S), name: "Super Admin", role: "superadmin", email: "super@example.com" },
      { _id: oid("64b000000000000000000e01"), name: "Pat Patient", role: "user", email: "pat@example.com" },
    ]);
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const S = { user: SUPER_S, role: "superadmin" };
  const current = async () => (await rest("GET", "/settings", S)).body.settings;
  const save = (patch, who = S) => rest("PUT", "/settings", { ...who, body: patch });
  const audit = async () => (await rest("GET", "/settings/audit", A)).body.entries;

  async function openChat(extra = {}) {
    const contact = await lc.submitContact(extra);
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, id: started.conversation.conversationId, started: started.conversation };
  }
  const state = async (socket) => (await lc.call(socket, "chat:resume")).conversation;

  describe("who can do what", () => {
    test("admin and superadmin read settings and the change log; only the superadmin saves", async () => {
      assert.equal((await rest("GET", "/settings", A)).status, 200);
      assert.equal((await rest("GET", "/settings", A)).body.canEdit, false);
      assert.equal((await rest("GET", "/settings", S)).body.canEdit, true);
      assert.equal((await rest("GET", "/settings/audit", A)).status, 200);

      const denied = await save({ greeting: "Hacked greeting" }, A);
      assert.equal(denied.status, 403);
      assert.notEqual((await current()).greeting, "Hacked greeting");
      assert.equal((await save({ greeting: "Hi {firstName}! Welcome." })).status, 200);
    });

    test("everyone else is refused on every new route", async () => {
      const calls = [
        ["GET", "/settings"], ["PUT", "/settings", { greeting: "x" }], ["GET", "/settings/audit"], ["GET", "/canned-replies?all=1"],
        ["POST", "/canned-replies", { title: "t", text: "t" }], ["PUT", "/canned-replies/64b0000000000000000000ff", { title: "t" }],
        ["DELETE", "/canned-replies/64b0000000000000000000ff"], ["GET", "/team"], ["PUT", `/team/${AGENT_A}/display-name`, { displayName: "x" }],
        ["GET", "/reports"],
      ];
      for (const role of ["employeeadmin", "paymentadmin", "doctor", "user", "partner"]) {
        for (const [method, path, body] of calls) {
          assert.equal((await rest(method, path, { role, body })).status, 403, `${role} ${method} ${path}`);
        }
      }
      for (const [method, path, body] of calls) {
        const res = await fetch(`${lc.url}/api/admin/livechat${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        assert.equal(res.status, 401, `anonymous ${method} ${path}`);
      }
    });

    test("an admin cannot save canned replies either", async () => {
      assert.equal((await rest("POST", "/canned-replies", { ...A, body: { title: "x", text: "y" } })).status, 403);
    });
  });

  describe("changes apply at once, without a restart", () => {
    test("a new greeting is used by the very next chat", async () => {
      await save({ greeting: "Welcome {firstName}, this is the NEW greeting." });
      const chat = await openChat({ name: "Sophia Martinez" });
      assert.equal(chat.started.messages[0].text, "Welcome Sophia, this is the NEW greeting.");
      chat.socket.close();
    });

    test("quick options and their replies are edited from settings and used straight away", async () => {
      const before = (await current()).quickOptions;
      const edited = before.map((o) => (o.key === "sick_notes" ? { ...o, label: "Doctor's Notes", reply: "Sick notes are $49. NEW REPLY." } : o));
      edited.push({ key: "insurance", label: "Insurance questions", icon: "document", reply: "No insurance is needed." });
      assert.equal((await save({ quickOptions: edited })).status, 200);

      const chat = await openChat();
      const labels = chat.started.options.map((o) => o.label);
      assert.ok(labels.includes("Doctor's Notes") && labels.includes("Insurance questions"));
      assert.equal(labels.includes("Sick Notes"), false);
      await lc.call(chat.socket, "chat:option", { key: "sick_notes" });
      const messages = (await state(chat.socket)).messages;
      assert.equal(messages.at(-2).text, "Doctor's Notes");
      assert.equal(messages.at(-1).text, "Sick notes are $49. NEW REPLY.");
      await save({ quickOptions: before });
      chat.socket.close();
    });

    test("prices and business facts reach the AI prompt", async () => {
      await save({ prices: [{ name: "General consultation", price: 59 }, { name: "Fit to fly", price: 79 }], businessFacts: "We are closed on Christmas Day." });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "How much?" });
      const prompt = buildSystemPrompt(await current());
      assert.ok(prompt.includes("General consultation: $59") && prompt.includes("closed on Christmas Day"));
      assert.equal(prompt.includes("Prescription refills: $60"), false);
      await save({ prices: DEFAULT_SETTINGS.prices, businessFacts: "" });
      chat.socket.close();
    });

    test("AI mode 'AI off': the patient goes straight to the team and the AI is not called", async () => {
      await save({ aiMode: "ai_off" });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "Hello" });
      assert.equal(lc.ai.calls.length, 0);
      assert.equal((await state(chat.socket)).mode, "queue");
      await save({ aiMode: "ai_first" });
      chat.socket.close();
    });

    test("the daily AI cap is used straight away", async () => {
      await save({ dailySpendCapUsd: 0 });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "Price?" });
      assert.equal(lc.ai.calls.length, 0, "a cap of 0 stops the AI");
      assert.match((await state(chat.socket)).messages.at(-1).text, /Connecting you to our team now/);
      await save({ dailySpendCapUsd: 3 });
      lc.livechat.chat.aiBreaker.until = 0;
      lc.livechat.chat.aiBreaker.alerted = false;
      chat.socket.close();
    });

    test("the agent-offline grace period is read from the settings when an agent leaves", async () => {
      await save({ handoffRules: { ...(await current()).handoffRules, agentOfflineGraceSeconds: 7 } });
      assert.equal((await current()).handoffRules.agentOfflineGraceSeconds, 7);
      await save({ handoffRules: { ...(await current()).handoffRules, agentOfflineGraceSeconds: 120 } });
    });
  });

  describe("follow-up time", () => {
    test("the minutes before the email notice: default 1, 1 to 30, whole numbers", async () => {
      assert.equal((await current()).followUpMinutes, 1);
      assert.equal((await save({ followUpMinutes: 5 })).status, 200);
      assert.equal((await current()).followUpMinutes, 5);
      for (const bad of [0, 31, 1.5, "2", -1]) {
        const res = await save({ followUpMinutes: bad });
        assert.equal(res.status, 400, String(bad));
        assert.ok(res.body.errors.followUpMinutes);
      }
      await save({ followUpMinutes: 1 });
    });

    test("a chat entering the Queue is due after the saved number of minutes", async () => {
      await save({ followUpMinutes: 3 });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:agent");
      const row = await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean();
      const minutes = (new Date(row.followUpDueAt).getTime() - new Date(row.queuedAt).getTime()) / 60000;
      assert.ok(Math.abs(minutes - 3) < 0.1, `due after ${minutes} minutes`);
      chat.socket.close();
      await save({ followUpMinutes: 1 });
    });

    test("support hours, time zones and the offline rule no longer exist; an old stored mode reads as AI first", async () => {
      const cur = await current();
      assert.equal(cur.supportHours, undefined);
      assert.equal(cur.offlineRule, undefined);
      assert.equal(cur.offlineMessage, undefined);
      // an older document still carrying the removed fields loads, and ai_when_no_agent reads as ai_first
      await lc.models.LcSettings.collection.updateOne(
        { key: "default" },
        { $set: { aiMode: "ai_when_no_agent", offlineRule: "hours", offlineMessage: "old", supportHours: { timezone: "Asia/Kolkata", days: [] } } }
      );
      const old = await current();
      assert.equal(old.aiMode, "ai_first");
      assert.equal(old.supportHours, undefined);
      assert.equal((await save({ aiMode: "ai_when_no_agent" })).status, 400, "the mode can no longer be chosen");
      await lc.models.LcSettings.collection.updateOne({ key: "default" }, { $set: { aiMode: "ai_first" }, $unset: { offlineRule: "", offlineMessage: "", supportHours: "" } });
    });
  });

  describe("AI-unavailable message", () => {
    const OLD = "Our AI assistant is unavailable right now. Talk to a live agent or leave a message and we'll email you.";
    const NEW = 'Our AI assistant is unavailable right now. Tap "Talk to live agent" and our team will help you.';
    const seed = () => require("../services/liveChat").seedLiveChatDefaults({ LIVECHAT_ENABLED: "true", NODE_ENV: "test" });

    test("the default is the new text; an older default is upgraded; an edited text is left alone", async () => {
      assert.equal(DEFAULT_SETTINGS.unavailableMessage, NEW);
      await lc.models.LcSettings.collection.updateOne({ key: "default" }, { $set: { unavailableMessage: OLD } });
      await seed();
      assert.equal((await current()).unavailableMessage, NEW);
      await lc.models.LcSettings.collection.updateOne({ key: "default" }, { $set: { unavailableMessage: "Custom text from an admin." } });
      await seed();
      assert.equal((await current()).unavailableMessage, "Custom text from an admin.");
      await lc.models.LcSettings.collection.updateOne({ key: "default" }, { $set: { unavailableMessage: NEW } });
    });
  });

  describe("handoff rules", () => {
    const aiHandoff = (reason) => ({
      ok: true, reply: "A live agent can help.", handoff: true, handoffReason: reason, topic: "other",
      usage: { inputTokens: 500, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 },
    });
    // "unanswered" hands over only on the second miss in a row, so it is asked twice.
    async function modeAfterHandoff(reason) {
      const times = reason === "unanswered" ? 2 : 1;
      const chat = await openChat();
      for (let i = 0; i < times; i += 1) {
        lc.ai.queue.push(aiHandoff(reason));
        await lc.call(chat.socket, "chat:message", { text: `question ${i}` });
      }
      const mode = (await state(chat.socket)).mode;
      chat.socket.close();
      return mode;
    }
    const setRules = async (patch) => save({ handoffRules: { ...(await current()).handoffRules, ...patch } });
    const ALL_ON = { onUnsure: true, onAccountOrPayment: true, onPatientRequest: true, onTechnicalIssue: true, onComplaint: true };

    test("each reason can be switched off; an emergency always hands off", async () => {
      for (const reason of ["unanswered", "account_issue", "explicit_request", "technical_issue", "complaint"]) {
        assert.equal(await modeAfterHandoff(reason), "queue", reason);
      }
      assert.equal(await modeAfterHandoff("none"), "ai", "no reason, no hand-over");

      const toggles = { unanswered: "onUnsure", account_issue: "onAccountOrPayment", explicit_request: "onPatientRequest", technical_issue: "onTechnicalIssue", complaint: "onComplaint" };
      for (const [reason, key] of Object.entries(toggles)) {
        await setRules({ ...ALL_ON, [key]: false });
        assert.equal(await modeAfterHandoff(reason), "ai", `${reason} no longer hands over`);
        const other = reason === "account_issue" ? "complaint" : "account_issue";
        assert.equal(await modeAfterHandoff(other), "queue", "the others are unchanged");
      }
      await setRules(Object.fromEntries(Object.keys(ALL_ON).map((k) => [k, false])));
      assert.equal(await modeAfterHandoff("emergency"), "queue", "an emergency always reaches an agent");
      await setRules(ALL_ON);
    });

    test("the AI prompt follows the toggles", () => {
      const all = { ...DEFAULT_SETTINGS.handoffRules };
      const text = (rules) => buildSystemPrompt({ ...DEFAULT_SETTINGS, handoffRules: rules }).split("\n").find((l) => l.startsWith("Allowed reasons"));
      for (const reason of ["explicit_request", "account_issue", "technical_issue", "emergency", "complaint", "unanswered"]) {
        assert.match(text(all), new RegExp(`"${reason}"`));
      }
      assert.doesNotMatch(text({ ...all, onUnsure: false }), /"unanswered"/);
      assert.doesNotMatch(text({ ...all, onAccountOrPayment: false }), /"account_issue"/);
      assert.doesNotMatch(text({ ...all, onTechnicalIssue: false }), /"technical_issue"/);
      assert.doesNotMatch(text({ ...all, onComplaint: false }), /"complaint"/);
      assert.match(text({ ...all, onUnsure: false, onAccountOrPayment: false, onPatientRequest: false, onTechnicalIssue: false, onComplaint: false }), /"emergency"/);
    });

    test("max AI replies per chat is used by the next chat", async () => {
      await setRules({ maxAiRepliesPerChat: 1 });
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "one" });
      await lc.call(chat.socket, "chat:message", { text: "two" });
      assert.equal(lc.ai.calls.length, 1);
      assert.equal((await state(chat.socket)).mode, "queue");
      await setRules({ maxAiRepliesPerChat: 30 });
      chat.socket.close();
    });
  });

  describe("validation: nothing is saved unless everything is valid", () => {
    const base = async () => current();
    const bad = [
      ["a wrong AI mode", { aiMode: "chaos" }, "aiMode"],
      ["a follow-up time of 0 minutes", { followUpMinutes: 0 }, "followUpMinutes"],
      ["an empty greeting", { greeting: "   " }, "greeting"],
      ["a greeting over 600 characters", { greeting: "x".repeat(601) }, "greeting"],
      ["an agent name over 40 characters", { agentDisplayName: "x".repeat(41) }, "agentDisplayName"],
      ["business facts over 8,000 characters", { businessFacts: "x".repeat(8001) }, "businessFacts"],
      ["a negative daily cap", { dailySpendCapUsd: -1 }, "dailySpendCapUsd"],
      ["a daily cap that is not a number", { dailySpendCapUsd: "lots" }, "dailySpendCapUsd"],
      ["an empty AI-unavailable message", { unavailableMessage: "" }, "unavailableMessage"],
    ];
    for (const [name, patch, field] of bad) {
      test(`refuses ${name}`, async () => {
        const before = await base();
        const res = await save(patch);
        assert.equal(res.status, 400);
        assert.ok(res.body.errors[field], JSON.stringify(res.body));
        assert.deepEqual(await current(), before, "nothing changed");
      });
    }

    test("refuses bad handoff rules", async () => {
      const rules = (await base()).handoffRules;
      assert.ok((await save({ handoffRules: { ...rules, maxAiRepliesPerChat: 0 } })).body.errors["handoffRules.maxAiRepliesPerChat"]);
      assert.ok((await save({ handoffRules: { ...rules, maxAiRepliesPerChat: 201 } })).body.errors["handoffRules.maxAiRepliesPerChat"]);
      assert.ok((await save({ handoffRules: { ...rules, agentOfflineGraceSeconds: 3601 } })).body.errors["handoffRules.agentOfflineGraceSeconds"]);
      assert.ok((await save({ handoffRules: { ...rules, agentOfflineGraceSeconds: -1 } })).body.errors["handoffRules.agentOfflineGraceSeconds"]);
      assert.ok((await save({ handoffRules: { ...rules, onUnsure: "yes" } })).body.errors["handoffRules.onUnsure"]);
    });

    test("refuses bad quick options and prices", async () => {
      const options = (await base()).quickOptions;
      assert.ok((await save({ quickOptions: [] })).body.errors.quickOptions);
      assert.ok((await save({ quickOptions: Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, label: "x", icon: "dots", reply: "y" })) })).body.errors.quickOptions);
      assert.ok((await save({ quickOptions: [options[0], options[0]] })).body.errors["quickOptions.1.key"], "duplicate key");
      assert.ok((await save({ quickOptions: [{ ...options[0], key: "Bad Key!" }] })).body.errors["quickOptions.0.key"]);
      assert.ok((await save({ quickOptions: [{ ...options[0], icon: "skull" }] })).body.errors["quickOptions.0.icon"]);
      assert.ok((await save({ quickOptions: [{ ...options[0], reply: "" }] })).body.errors["quickOptions.0.reply"]);
      assert.ok((await save({ quickOptions: [{ ...options[0], label: "x".repeat(81) }] })).body.errors["quickOptions.0.label"]);
      assert.ok((await save({ prices: [{ name: "Visit", price: -5 }] })).body.errors["prices.0.price"]);
      assert.ok((await save({ prices: [{ name: "", price: 5 }] })).body.errors["prices.0.name"]);
      assert.ok((await save({ prices: Array.from({ length: 31 }, (_, i) => ({ name: `s${i}`, price: 1 })) })).body.errors.prices);
    });

    test("multi-line business facts keep their line breaks", async () => {
      await save({ businessFacts: "Line one\r\nLine two\n\nLine four\u0007" });
      assert.equal((await current()).businessFacts, "Line one\nLine two\n\nLine four");
      await save({ businessFacts: "" });
    });

    test("one bad field refuses the whole save", async () => {
      const before = await base();
      const res = await save({ greeting: "A fine new greeting", dailySpendCapUsd: -5 });
      assert.equal(res.status, 400);
      assert.equal((await current()).greeting, before.greeting, "the valid field was not saved either");
    });

    test("unknown fields are ignored, and a non-object body is refused", async () => {
      const before = await base();
      const res = await save({ greeting: before.greeting, key: "other", _id: "x", updatedBy: "y", isAdmin: true });
      assert.equal(res.status, 200);
      assert.equal(res.body.changed, 0);
      assert.equal((await current()).key, "default");
      const none = await rest("PUT", "/settings", { ...S, body: [] });
      assert.equal(none.status, 400);
    });
  });

  describe("change log", () => {
    test("every save is logged: who, when, what, before and after", async () => {
      const before = await audit();
      const t0 = Date.now();
      const res = await save({ aiMode: "ai_off", greeting: "Hello {firstName}, logged greeting." });
      assert.equal(res.body.changed, 2);
      const entries = await audit();
      assert.equal(entries.length, before.length + 1);
      const entry = entries[0];
      assert.deepEqual([entry.actor.name, entry.actor.role, entry.actor.id], ["Super Admin", "superadmin", SUPER_S]);
      assert.ok(Math.abs(new Date(entry.at).getTime() - t0) < 5000);
      const aiMode = entry.changes.find((c) => c.field === "aiMode");
      assert.deepEqual([aiMode.before, aiMode.after], ["ai_first", "ai_off"]);
      assert.equal(entry.changes.find((c) => c.field === "greeting").after, "Hello {firstName}, logged greeting.");
      await save({ aiMode: "ai_first" });
    });

    test("nested settings are logged field by field", async () => {
      const cur = await current();
      await save({ handoffRules: { ...cur.handoffRules, maxAiRepliesPerChat: 12 }, followUpMinutes: 4 });
      const entry = (await audit())[0];
      const fields = entry.changes.map((c) => c.field).sort();
      assert.deepEqual(fields, ["followUpMinutes", "handoffRules.maxAiRepliesPerChat"]);
      assert.deepEqual([entry.changes.find((c) => c.field === "followUpMinutes").before, entry.changes.find((c) => c.field === "followUpMinutes").after], ["1", "4"]);
      await save({ handoffRules: cur.handoffRules, followUpMinutes: cur.followUpMinutes });
    });

    test("a save that changes nothing is not logged; long values are shortened", async () => {
      const cur = await current();
      const count = (await audit()).length;
      assert.equal((await save({ greeting: cur.greeting })).body.changed, 0);
      assert.equal((await audit()).length, count);

      await save({ businessFacts: "F".repeat(5000) });
      const change = (await audit())[0].changes.find((c) => c.field === "businessFacts");
      assert.ok(change.after.length < 450 && change.after.includes("5000 characters"));
      await save({ businessFacts: "" });
    });

    test("the log is newest first and open to admins (read only)", async () => {
      await save({ agentDisplayName: "Alex" });
      await save({ agentDisplayName: "Sam" });
      const entries = (await rest("GET", "/settings/audit?limit=2", A)).body.entries;
      assert.equal(entries.length, 2);
      assert.equal(entries[0].changes[0].after, "Sam");
      assert.equal(entries[1].changes[0].after, "Alex");
    });
  });

  describe("canned replies", () => {
    test("a superadmin adds, edits and deletes; chats see only active replies; every change is logged", async () => {
      const created = await rest("POST", "/canned-replies", { ...S, body: { title: "Closing", text: "Is there anything else I can help with, {agentName}?" } });
      assert.equal(created.status, 200);
      const id = created.body.reply.id;

      const inChat = (await rest("GET", "/canned-replies", A)).body;
      assert.ok(inChat.replies.some((r) => r.title === "Closing"));
      assert.equal(inChat.agentName, "Sam", "falls back to the default agent name from the settings");
      assert.equal((await rest("PUT", `/canned-replies/${id}`, { ...S, body: { text: "Anything else we can help with?", active: false } })).status, 200);
      assert.equal((await rest("GET", "/canned-replies", A)).body.replies.some((r) => r.title === "Closing"), false, "inactive replies are not offered in chats");
      const all = (await rest("GET", "/canned-replies?all=1", A)).body.replies;
      assert.equal(all.find((r) => r.id === id).active, false);

      assert.equal((await rest("DELETE", `/canned-replies/${id}`, S)).status, 200);
      assert.equal((await rest("GET", "/canned-replies?all=1", A)).body.replies.some((r) => r.id === id), false);
      assert.equal((await rest("DELETE", `/canned-replies/${id}`, S)).status, 404);

      const fields = (await audit()).slice(0, 4).flatMap((e) => e.changes.map((c) => c.field));
      assert.ok(fields.includes("cannedReply.added") && fields.includes("cannedReply.deleted"));
      assert.ok(fields.some((f) => f.startsWith("cannedReply.Closing.")));
    });

    test("validation", async () => {
      for (const body of [{ title: "", text: "x" }, { title: "x", text: "" }, { title: "x".repeat(81), text: "x" }, { title: "x", text: "x".repeat(1001) }]) {
        assert.equal((await rest("POST", "/canned-replies", { ...S, body })).status, 400);
      }
      assert.equal((await rest("PUT", "/canned-replies/not-an-id", { ...S, body: { title: "x" } })).status, 404);
      const list = (await rest("GET", "/canned-replies?all=1", S)).body.replies;
      assert.equal((await rest("PUT", `/canned-replies/${list[0].id}`, { ...S, body: { active: "yes" } })).status, 400);
    });
  });

  describe("agent display names", () => {
    const rename = (userId, displayName, who) => rest("PUT", `/team/${userId}/display-name`, { ...who, body: { displayName } });
    const profile = (id) => lc.models.LcAgentProfile.findOne({ userId: id }).lean();

    test("an agent changes their own name; the change is logged", async () => {
      const res = await rename(AGENT_A, "Sammy", A);
      assert.deepEqual([res.status, res.body.displayName], [200, "Sammy"]);
      assert.equal((await profile(AGENT_A)).displayName, "Sammy");
      const change = (await audit())[0].changes[0];
      assert.deepEqual([change.field, change.after], ["agentDisplayName.Sam Carter", "Sammy"]);
    });

    test("an admin cannot rename someone else; a superadmin can rename anyone", async () => {
      const denied = await rename(AGENT_B, "Not Maya", A);
      assert.deepEqual([denied.status, denied.body.error], [403, "own_name_only"]);
      assert.equal(await profile(AGENT_B), null);
      assert.equal((await rename(AGENT_B, "Maya L.", S)).status, 200);
      assert.equal((await profile(AGENT_B)).displayName, "Maya L.");
    });

    test("only admins and superadmins have display names; names are validated", async () => {
      assert.equal((await rename("64b000000000000000000e01", "Pat", S)).status, 404, "a patient account is not an agent");
      assert.equal((await rename("64b000000000000000000eee", "Ghost", S)).status, 404);
      assert.equal((await rename("not-an-id", "x", S)).status, 404);
      for (const name of ["", "   ", "x".repeat(41)]) assert.equal((await rename(AGENT_A, name, A)).status, 400);
      assert.equal((await rename(AGENT_A, "Sam\u0000\u0007 C", A)).body.displayName, "Sam C", "control characters are removed");
      await rename(AGENT_A, "Sam", A);
    });
  });
});
