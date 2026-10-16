const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, dayKey, AGENT_A, SUPER_S } = require("./helpers/liveChatServer");

describe("live chat: patient context fields, custom fields and the AI summary", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[SUPER_S] = "Super";
  });
  after(async () => {
    await lc.close();
  });

  const NAME = "Emma Wilson";
  const EMAIL = "emma.wilson@example.org";
  const PHONE = "+1 512 555 0142";
  const A = { user: AGENT_A };
  const S = { user: SUPER_S, role: "superadmin" };
  const rest = (...args) => lc.rest(...args);

  async function openChat() {
    const contact = await lc.submitContact({ name: NAME, email: EMAIL, phone: PHONE });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home", tz: "UTC", cookies: "accepted" });
    return { socket, id: started.conversation.conversationId, visitorId: contact.visitorId };
  }
  // The agent speaks first, so the chat is with a person and the AI is not called.
  async function liveChat() {
    const chat = await openChat();
    await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: `Hi ${NAME}, I can call you on ${PHONE}.` } });
    return chat;
  }

  describe("custom fields (AI agent settings)", () => {
    test("only a Super Admin saves them: text fields, at most 10, unique names, logged", async () => {
      const fields = [{ key: "insurer", label: "Insurer" }, { key: "policy_no", label: "Policy number" }];
      assert.equal((await rest("PUT", "/settings", { ...A, body: { customFields: fields } })).status, 403);

      const saved = await rest("PUT", "/settings", { ...S, body: { customFields: fields } });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.deepEqual((await rest("GET", "/settings", A)).body.settings.customFields, fields);

      const audit = (await rest("GET", "/settings/audit", S)).body.entries[0];
      assert.ok(audit.changes.some((c) => c.field === "customFields"));

      const eleven = Array.from({ length: 11 }, (_, i) => ({ key: `f${i}`, label: `Field ${i}` }));
      assert.equal((await rest("PUT", "/settings", { ...S, body: { customFields: eleven } })).status, 400);
      assert.equal((await rest("PUT", "/settings", { ...S, body: { customFields: [{ key: "a", label: "Same" }, { key: "b", label: "same" }] } })).status, 400);
      assert.equal((await rest("PUT", "/settings", { ...S, body: { customFields: [{ key: "followUpDate", label: "Mine" }] } })).status, 400, "built-in names are reserved");
      assert.equal((await rest("PUT", "/settings", { ...S, body: { customFields: [{ key: "Bad Key!", label: "Mine" }] } })).status, 400);
      assert.equal((await rest("PUT", "/settings", { ...S, body: { customFields: [{ key: "x", label: "" }] } })).status, 400);
      assert.deepEqual((await rest("GET", "/settings", A)).body.settings.customFields, fields, "a failed save changes nothing");
    });
  });

  describe("patient context", () => {
    test("saved encrypted, shown in the visitor panel and the chat panel, partial updates keep the rest", async () => {
      const chat = await liveChat();
      const put = await rest("PUT", `/visitors/${chat.visitorId}/context`, {
        ...A,
        body: { followUpDate: "2026-11-03", preferredLanguage: "German", contactPreference: "Phone, mornings", reasonForContact: "Refill question", custom: { insurer: "Allianz" } },
      });
      assert.equal(put.status, 200, JSON.stringify(put.body));
      assert.equal(put.body.fields.followUpDate, "2026-11-03");
      assert.equal(put.body.fields.custom.insurer, "Allianz");

      const raw = JSON.stringify(await lc.models.LcVisitor.findOne({ visitorId: chat.visitorId }).lean());
      for (const plain of ["2026-11-03", "German", "Phone, mornings", "Refill question", "Allianz"]) assert.equal(raw.includes(plain), false, `"${plain}" must be stored encrypted`);

      const panel = (await rest("GET", `/visitors/${chat.visitorId}/panel`, A)).body.panel;
      assert.equal(panel.fields.preferredLanguage, "German");
      assert.deepEqual(panel.fieldDefs.map((d) => d.key), ["insurer", "policy_no"]);
      const detail = (await rest("GET", `/conversations/${chat.id}`, A)).body.panel;
      assert.equal(detail.fields.reasonForContact, "Refill question");
      assert.equal(detail.fields.custom.insurer, "Allianz");

      const partial = await rest("PUT", `/visitors/${chat.visitorId}/context`, { ...A, body: { preferredLanguage: "", custom: { policy_no: "P-77" } } });
      assert.equal(partial.status, 200);
      assert.equal(partial.body.fields.preferredLanguage, "", "cleared");
      assert.equal(partial.body.fields.reasonForContact, "Refill question", "untouched fields stay");
      assert.deepEqual(partial.body.fields.custom, { insurer: "Allianz", policy_no: "P-77" });
      chat.socket.close();
    });

    test("bad input is refused: dates, unknown custom fields, too long, wrong role, unknown visitor", async () => {
      const chat = await liveChat();
      const put = (body, opts = A) => rest("PUT", `/visitors/${chat.visitorId}/context`, { ...opts, body });
      assert.equal((await put({ followUpDate: "tomorrow" })).status, 400);
      assert.equal((await put({ followUpDate: "2026-02-31" })).status, 400);
      assert.equal((await put({ custom: { nothing: "x" } })).status, 400);
      assert.equal((await put({ reasonForContact: "x".repeat(201) })).status, 400);
      assert.equal((await put({ reasonForContact: "x" }, { user: "u1", role: "user" })).status, 403);
      assert.equal((await rest("PUT", "/visitors/visitor-ffffffffffffffff/context", { ...A, body: { reasonForContact: "x" } })).status, 404);
      assert.equal((await put({ followUpDate: "" })).status, 200, "an empty date clears it");
      chat.socket.close();
    });
  });

  describe("Tell me about this patient", () => {
    test("summarises the chat text only: no name, email, phone, notes or ids reach the model; nothing is saved; it counts toward the AI usage", async () => {
      const chat = await liveChat();
      await lc.call(chat.socket, "chat:message", { text: `I am ${NAME}, my email is ${EMAIL}, call ${PHONE} about my refill.` });
      await rest("POST", `/conversations/${chat.id}/notes`, { ...A, body: { text: "SECRET-NOTE-TEXT" } });
      lc.ai.summaryCalls.length = 0;
      const messagesBefore = await lc.models.LcMessage.countDocuments({ conversationId: chat.id });
      const usageBefore = JSON.stringify(await lc.models.LcAiUsage.find().lean());

      const res = await rest("POST", `/conversations/${chat.id}/summary`, A);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.ok(res.body.summary);
      assert.equal(lc.ai.summaryCalls.length, 1);
      const sent = JSON.stringify(lc.ai.summaryCalls[0]);
      for (const secret of ["Emma", "Wilson", EMAIL, "512 555 0142", "SECRET-NOTE-TEXT", chat.visitorId, chat.id]) assert.equal(sent.includes(secret), false, `"${secret}" must not be sent`);
      assert.ok(sent.includes("[name]") && sent.includes("refill"), "the meaning is kept");
      assert.equal(await lc.models.LcMessage.countDocuments({ conversationId: chat.id }), messagesBefore, "the summary is not saved as a message");
      assert.equal(JSON.stringify(await lc.models.LcAiUsage.find().lean()) === usageBefore, false, "counted in the daily usage");

      const viaVisitor = await rest("POST", `/visitors/${chat.visitorId}/summary`, A);
      assert.equal(viaVisitor.status, 200);
      chat.socket.close();
    });

    test("a visitor with no chat has nothing to summarise; the daily cap and the roles are respected; an AI failure is a clear 503", async () => {
      const chat = await liveChat();
      const tracker = await lc.visitor();
      await new Promise((r) => setTimeout(r, 100));
      assert.equal((await rest("POST", "/visitors/visitor-0123456789abcdef/summary", A)).status, 409);
      tracker.close();

      assert.equal((await rest("POST", `/conversations/${chat.id}/summary`, { user: "u1", role: "user" })).status, 403);
      assert.equal((await rest("POST", "/conversations/HCNOSUCH01/summary", A)).status, 404);

      lc.ai.summaryOverride = async () => ({ ok: false, kind: "api_error" });
      const down = await rest("POST", `/conversations/${chat.id}/summary`, A);
      assert.equal(down.status, 503);
      assert.equal(down.body.error, "ai_unavailable");
      lc.ai.summaryOverride = null;

      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 999 } }, { upsert: true });
      lc.ai.summaryCalls.length = 0;
      const capped = await rest("POST", `/conversations/${chat.id}/summary`, A);
      assert.equal(capped.status, 503);
      assert.equal(lc.ai.summaryCalls.length, 0, "no model call once the cap is reached");
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 0 } });
      chat.socket.close();
    });
  });
});
