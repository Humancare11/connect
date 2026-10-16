const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, dayKey, FILES, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");

describe("live chat: composer (Suggest redaction, reply translation, sending a file)", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100", LIVECHAT_UPLOADS_PER_10_MIN: "20", LIVECHAT_MAX_FILES_PER_CHAT: "10" },
    });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[AGENT_B] = "Maya";
  });
  after(async () => {
    await lc.close();
  });

  const NAME = "Emma Wilson";
  const EMAIL = "emma.wilson@example.org";
  const PHONE = "+1 512 555 0142";
  const rest = (...args) => lc.rest(...args);

  async function openChat() {
    const contact = await lc.submitContact({ name: NAME, email: EMAIL, phone: PHONE });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home", tz: "UTC", cookies: "accepted" });
    return { socket, token: contact.token, id: started.conversation.conversationId, visitorId: contact.visitorId };
  }
  // The agent speaks first, so the chat is with a person and the AI is not involved.
  async function liveChat(user = AGENT_A) {
    const chat = await openChat();
    const hi = await rest("POST", `/conversations/${chat.id}/messages`, { user, body: { text: `Hi ${NAME}, this is your agent. I can call you on ${PHONE}.` } });
    assert.equal(hi.status, 200, JSON.stringify(hi.body));
    return chat;
  }

  describe("Suggest a reply: no patient name, email or phone reaches the model", () => {
    test("the history sent to the model is redacted; the draft comes back; it counts toward the AI usage", async () => {
      const chat = await liveChat();
      await lc.call(chat.socket, "chat:message", { text: `I am ${NAME}, write to ${EMAIL} or call ${PHONE}. Also my cousin's number is 0044 20 7946 0958.` });
      lc.ai.suggestCalls.length = 0;
      const usageBefore = await lc.models.LcAiUsage.find().lean();
      const res = await rest("POST", `/conversations/${chat.id}/suggest`, { user: AGENT_A });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.ok(res.body.reply);

      assert.equal(lc.ai.suggestCalls.length, 1);
      const sent = JSON.stringify(lc.ai.suggestCalls[0]);
      for (const secret of ["Emma", "Wilson", EMAIL, "512 555 0142", "7946 0958", chat.visitorId, chat.id]) {
        assert.equal(sent.includes(secret), false, `"${secret}" must not be sent to the model`);
      }
      assert.ok(sent.includes("[name]") && sent.includes("[email]") && sent.includes("[phone]"), "placeholders keep the meaning");
      assert.ok(sent.includes("your agent"), "the rest of the text is kept");
      const usageAfter = await lc.models.LcAiUsage.find().lean();
      assert.notDeepEqual(usageAfter, usageBefore, "the suggestion is recorded in the daily AI usage");
      chat.socket.close();
    });

    test("it stops at the daily AI cap", async () => {
      const chat = await liveChat();
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 999 } }, { upsert: true });
      const res = await rest("POST", `/conversations/${chat.id}/suggest`, { user: AGENT_A });
      assert.equal(res.status, 503);
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 0 } });
      chat.socket.close();
    });
  });

  describe("reply translation: into the patient's language only", () => {
    const setGerman = (id) => lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { language: { code: "de", name: "German" } } });

    test("on a German chat the draft is translated to German; the patient's name and email are protected and put back; nothing is sent", async () => {
      const chat = await liveChat();
      await setGerman(chat.id);
      lc.ai.translateCalls.length = 0;
      const before = await lc.models.LcMessage.countDocuments({ conversationId: chat.id });
      const usageBefore = JSON.stringify(await lc.models.LcAiUsage.find().lean());
      const res = await rest("POST", `/conversations/${chat.id}/translate-reply`, {
        user: AGENT_A,
        body: { text: `Dear ${NAME}, a doctor can see you at 6 PM. Mail ${EMAIL}.` },
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(lc.ai.translateCalls[0].target, "German");
      const sent = JSON.stringify(lc.ai.translateCalls);
      for (const secret of ["Emma", "Wilson", EMAIL]) assert.equal(sent.includes(secret), false, `"${secret}" must not be sent to the model`);
      assert.ok(res.body.text.includes(NAME) && res.body.text.includes(EMAIL), "put back after translation");
      assert.equal(await lc.models.LcMessage.countDocuments({ conversationId: chat.id }), before, "nothing was sent or saved");
      assert.notEqual(JSON.stringify(await lc.models.LcAiUsage.find().lean()), usageBefore, "counted in the daily AI usage");
      chat.socket.close();
    });

    test("an English chat has nothing to translate to, whatever the request says; the daily cap is respected", async () => {
      const chat = await liveChat();
      const plain = await rest("POST", `/conversations/${chat.id}/translate-reply`, { user: AGENT_A, body: { text: "Hello" } });
      assert.equal(plain.status, 409);
      const withTarget = await rest("POST", `/conversations/${chat.id}/translate-reply`, { user: AGENT_A, body: { text: "Hello", target: "de" } });
      assert.equal(withTarget.status, 409, "a target language is not accepted any more");

      await setGerman(chat.id);
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 999 } }, { upsert: true });
      lc.ai.translateCalls.length = 0;
      const capped = await rest("POST", `/conversations/${chat.id}/translate-reply`, { user: AGENT_A, body: { text: "Hello" } });
      assert.equal(capped.status, 503);
      assert.equal(lc.ai.translateCalls.length, 0, "no model call once the cap is reached");
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 0 } });
      chat.socket.close();
    });
  });

  describe("sending a file to the patient", () => {
    const sendFile = (id, { user = AGENT_A, role = "admin", name = "Care plan.pdf", buffer = FILES.pdf } = {}) => {
      const form = new FormData();
      form.append("file", new Blob([buffer]), name);
      return fetch(`${lc.url}/api/admin/livechat/conversations/${id}/files`, { method: "POST", headers: { "x-test-role": role, "x-test-user": user }, body: form }).then(
        async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) })
      );
    };
    const patientLink = (token, fileId) =>
      fetch(`${lc.url}/api/livechat/files/${fileId}/url`, { headers: { authorization: `Bearer ${token}` } }).then(async (res) => ({
        status: res.status,
        cache: res.headers.get("cache-control"),
        body: await res.json().catch(() => ({})),
      }));

    test("the file is stored, shows in the chat for both sides, and the patient opens it by a short link", async () => {
      const chat = await liveChat();
      const sent = await sendFile(chat.id);
      assert.equal(sent.status, 200, JSON.stringify(sent.body));
      assert.equal(sent.body.message.sender, "agent");
      assert.equal(sent.body.message.file.name, "Care plan.pdf");
      const keys = [...lc.store.keys()].filter((k) => k.startsWith(`livechat/${chat.id}/`));
      assert.equal(keys.length, 1);
      // Same storage rules as a patient upload: a random key with no file name in it, no name in the S3 object, and
      // the name encrypted in the database.
      assert.match(keys[0], /^livechat\/HC[A-Z0-9]{8}\/[0-9a-f-]{36}\.pdf$/);
      assert.deepEqual(Object.keys(lc.store.get(keys[0])).sort(), ["buffer", "contentType"], "the object carries no file name");
      assert.ok(!JSON.stringify(lc.store.get(keys[0]).contentType).includes("Care plan"));
      const doc = await lc.models.LcFile.findOne({ conversationId: chat.id, sender: "agent" }).lean();
      assert.equal(doc.s3Key, keys[0]);
      assert.ok(doc.name.cipherText, "the file name is stored encrypted");
      assert.ok(!JSON.stringify(doc).includes("Care plan"), "no plain-text file name in the database");
      const uploadedPatient = await lc.upload(chat.token, { name: "Care plan.pdf", buffer: FILES.pdf });
      assert.equal(uploadedPatient.status, 200);
      const patientDoc = await lc.models.LcFile.findOne({ conversationId: chat.id, sender: "patient" }).lean();
      assert.match(patientDoc.s3Key, /^livechat\/HC[A-Z0-9]{8}\/[0-9a-f-]{36}\.pdf$/, "patient keys look exactly the same");
      assert.deepEqual(Object.keys(doc.name).sort(), Object.keys(patientDoc.name).sort(), "same encrypted-field shape");

      const state = (await lc.call(chat.socket, "chat:resume")).conversation;
      const fileMessage = state.messages.find((m) => m.file);
      assert.equal(fileMessage.sender, "agent");
      assert.equal(fileMessage.agentName, "Sam");
      assert.ok(fileMessage.file.id, "the patient gets the id of a file the team sent");

      const link = await patientLink(chat.token, fileMessage.file.id);
      assert.equal(link.status, 200, JSON.stringify(link.body));
      assert.equal(link.cache, "no-store");
      assert.ok(link.body.url);
      const stored = await lc.models.LcFile.findById(fileMessage.file.id).lean();
      assert.equal(stored.sender, "agent");
      assert.equal(stored.patientAccessLog.length, 1);

      const detail = (await rest("GET", `/conversations/${chat.id}`, { user: AGENT_A })).body;
      assert.ok(detail.messages.find((m) => m.file).file.id, "admins can open it too");
      chat.socket.close();
    });

    test("another visitor, a bad token and a patient's own upload cannot use the patient link", async () => {
      const chat = await liveChat();
      const other = await liveChat(AGENT_B);
      const sent = await sendFile(chat.id);
      const fileId = sent.body.message.file.id;
      assert.equal((await patientLink(other.token, fileId)).status, 404);
      const refused = await patientLink("not-a-token", fileId);
      assert.equal(refused.status, 401);
      assert.equal(refused.cache, "no-store", "errors are not cached either");
      const missing = await patientLink(chat.token, "64b000000000000000000fff");
      assert.equal(missing.status, 404);
      assert.equal(missing.cache, "no-store");
      const own = await lc.upload(chat.token, { name: "Mine.pdf", buffer: FILES.pdf });
      assert.equal(own.status, 200);
      const ownFile = await lc.models.LcFile.findOne({ conversationId: chat.id, sender: "patient" }).lean();
      assert.equal((await patientLink(chat.token, String(ownFile._id))).status, 404, "only files the team sent");
      chat.socket.close();
      other.socket.close();
    });

    test("only pdf, jpg and png; only the assignee; not on a closed chat; admins only", async () => {
      const chat = await liveChat();
      assert.equal((await sendFile(chat.id, { name: "run.pdf", buffer: FILES.exe })).status, 400);
      assert.equal((await sendFile(chat.id, { name: "page.html", buffer: FILES.html })).status, 400);
      assert.equal((await sendFile(chat.id, { user: AGENT_B })).status, 409, "Maya cannot send into Sam's chat");
      assert.equal((await sendFile(chat.id, { user: "u1", role: "user" })).status, 403);
      assert.equal((await sendFile("HCNOSUCH01")).status, 404);
      await rest("POST", `/conversations/${chat.id}/resolve`, { user: AGENT_A });
      assert.equal((await sendFile(chat.id)).status, 409);
      chat.socket.close();
    });

    test("sending a file to a chat with the AI takes it over, like a reply", async () => {
      const chat = await openChat();
      const sent = await sendFile(chat.id);
      assert.equal(sent.status, 200, JSON.stringify(sent.body));
      const row = (await rest("GET", "/conversations?view=live", { user: AGENT_A })).body.conversations.find((c) => c.conversationId === chat.id);
      assert.equal(row.mode, "live");
      assert.equal(row.assignee.id, AGENT_A);
      chat.socket.close();
    });
  });
});
