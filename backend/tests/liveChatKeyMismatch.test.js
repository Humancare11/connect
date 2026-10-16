const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startChatServer, AGENT_A } = require("./helpers/liveChatServer");
const c = require("../utils/liveChat/crypto");

const KEY_A = crypto.randomBytes(32).toString("hex");
const KEY_B = crypto.randomBytes(32).toString("hex");

describe("live chat: text that cannot be decrypted never breaks a request", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });
  const A = { user: AGENT_A };
  // A message encrypted under some other key: valid shape, wrong key.
  const foreign = () => {
    const saved = process.env.LIVECHAT_ENCRYPTION_KEY;
    process.env.LIVECHAT_ENCRYPTION_KEY = KEY_B;
    try {
      return c.encryptLiveChatText("secret text from another key");
    } finally {
      if (saved === undefined) delete process.env.LIVECHAT_ENCRYPTION_KEY;
      else process.env.LIVECHAT_ENCRYPTION_KEY = saved;
    }
  };
  async function chatWithBadMessage() {
    const contact = await lc.submitContact({ name: "Key Test" });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:message", { text: "a good message" });
    await lc.models.LcMessage.create({ conversationId: id, sender: "patient", text: foreign() });
    await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { lastMessageAt: new Date(), lastActivityAt: new Date() } });
    return { socket, id };
  }

  test("the list and the chat detail answer 200 with a placeholder, and the good messages still show", async () => {
    const { socket, id } = await chatWithBadMessage();
    const logged = [];
    const original = console.error;
    console.error = (...args) => logged.push(args.join(" "));
    let list;
    let detail;
    try {
      list = await lc.rest("GET", "/conversations?view=ai", A);
      detail = await lc.rest("GET", `/conversations/${id}`, A);
    } finally {
      console.error = original;
    }
    assert.equal(list.status, 200);
    const row = list.body.conversations.find((r) => r.conversationId === id);
    assert.equal(row.preview.text, c.UNREADABLE_TEXT, "the newest message is the unreadable one");
    assert.equal(detail.status, 200);
    const texts = detail.body.messages.map((m) => m.text);
    assert.ok(texts.includes("a good message"));
    assert.ok(texts.includes(c.UNREADABLE_TEXT));
    assert.ok(!JSON.stringify(detail.body).includes("secret text"));
    const line = logged.find((l) => l.includes(`/conversations/${id}`));
    assert.ok(line && /1 undecryptable item/.test(line) && /ids: /.test(line), logged.join("|"));
    assert.ok(!line.includes("secret") && !line.includes(KEY_A) && !line.includes(KEY_B));
    socket.close();
  });

  test("the archive, search and transcript do not throw either", async () => {
    const { socket, id } = await chatWithBadMessage();
    const old = new Date(Date.now() - 3 * 86_400_000);
    await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { lastMessageAt: old, lastActivityAt: old } });
    assert.equal((await lc.rest("GET", `/archive?q=${id}`, A)).status, 200);
    const transcript = await lc.rest("GET", `/conversations/${id}/transcript`, A);
    assert.equal(transcript.status, 200);
    socket.close();
  });

  test("the AI never receives the placeholder (nor the unreadable text) as patient text", async () => {
    const { socket, id } = await chatWithBadMessage();
    lc.ai.calls.length = 0;
    await lc.call(socket, "chat:message", { text: "and what about prices?" });
    await new Promise((r) => setTimeout(r, 300));
    const seen = JSON.stringify(lc.ai.calls.map((call) => call.history || call));
    assert.ok(lc.ai.calls.length >= 1);
    assert.ok(!seen.includes("encryption key mismatch"));
    assert.ok(seen.includes("a good message"));
    socket.close();
    void id;
  });

  test("previous keys: data written under the old key reads after a rotation; new data uses the current key", () => {
    const saved = { cur: process.env.LIVECHAT_ENCRYPTION_KEY, prev: process.env.LIVECHAT_ENCRYPTION_KEY_PREVIOUS };
    try {
      process.env.LIVECHAT_ENCRYPTION_KEY = KEY_A;
      delete process.env.LIVECHAT_ENCRYPTION_KEY_PREVIOUS;
      const old = c.encryptLiveChatText("written before the rotation");

      process.env.LIVECHAT_ENCRYPTION_KEY = KEY_B;
      assert.equal(c.decryptLiveChatText(old), c.UNREADABLE_TEXT, "no previous key configured: placeholder, no throw");
      process.env.LIVECHAT_ENCRYPTION_KEY_PREVIOUS = `${crypto.randomBytes(32).toString("hex")}, ${KEY_A}`;
      assert.equal(c.decryptLiveChatText(old), "written before the rotation");

      const fresh = c.encryptLiveChatText("written after");
      assert.equal(c.tryDecryptLiveChatText(fresh, [c.activeKey()]).ok, true, "new data is written with the current key");
      assert.equal(c.decryptLiveChatOrEmpty(c.encryptLiveChatText("")), "");
      assert.equal(c.decryptLiveChatOrEmpty(foreignWith(crypto.randomBytes(32).toString("hex"))), "");
      assert.notEqual(c.keyFingerprint(Buffer.from(KEY_A, "hex")), c.keyFingerprint(Buffer.from(KEY_B, "hex")));
      assert.equal(c.keyFingerprint(Buffer.from(KEY_A, "hex")).length, 8);
    } finally {
      for (const [name, value] of [["LIVECHAT_ENCRYPTION_KEY", saved.cur], ["LIVECHAT_ENCRYPTION_KEY_PREVIOUS", saved.prev]]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    function foreignWith(key) {
      const current = process.env.LIVECHAT_ENCRYPTION_KEY;
      process.env.LIVECHAT_ENCRYPTION_KEY = key;
      try {
        return c.encryptLiveChatText("x");
      } finally {
        process.env.LIVECHAT_ENCRYPTION_KEY = current;
      }
    }
  });

  test("both chat pages together cover every chat (a chat with no everLive flag is not hidden from both)", async () => {
    const chat = await chatWithBadMessage();
    await lc.models.LcConversation.collection.updateOne({ conversationId: chat.id }, { $unset: { everLive: "" } });
    const ai = (await lc.rest("GET", "/conversations?view=ai", A)).body.conversations.map((r) => r.conversationId);
    const live = (await lc.rest("GET", "/conversations?view=live", A)).body.conversations.map((r) => r.conversationId);
    assert.ok(ai.includes(chat.id) !== live.includes(chat.id), "in exactly one list");
    assert.ok(ai.includes(chat.id));
    chat.socket.close();
  });
});
