const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, AGENT_A } = require("./helpers/liveChatServer");

// Patient-side "Switch to AI" / "Talk to live agent", and the no-offline wording.
describe("live chat: switching between the AI and a live agent", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    lc.agentNames[AGENT_A] = "Sam";
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.emails.length = 0;
  });

  const rest = (...args) => lc.rest(...args);
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  async function openChat(extra = {}) {
    const contact = await lc.submitContact(extra);
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, id: started.conversation.conversationId };
  }
  const takeOver = async (id) => assert.equal((await rest("POST", `/conversations/${id}/takeover`, { user: AGENT_A })).status, 200);

  test("with the AI: Talk to live agent is offered, Switch to AI is not (also with no agent online)", async () => {
    const chat = await openChat();
    const state = await stateOf(chat.socket);
    assert.equal(state.mode, "ai");
    assert.equal(state.canRequestAgent, true);
    assert.equal(state.canSwitchToAi, false);
    chat.socket.close();
  });

  test("with a live agent: Switch to AI hands the chat back at once; the AI answers and the patient can go back to an agent", async () => {
    const chat = await openChat({ name: "Nora Quinn", email: "nora@example.com" });
    await takeOver(chat.id);
    let state = await stateOf(chat.socket);
    assert.deepEqual([state.mode, state.canSwitchToAi, state.canRequestAgent], ["live", true, false]);

    const res = await lc.call(chat.socket, "chat:switch-ai");
    assert.equal(res.ok, true, JSON.stringify(res));
    state = await stateOf(chat.socket);
    assert.deepEqual([state.mode, state.canRequestAgent, state.canSwitchToAi, state.agent], ["ai", true, false, null]);
    assert.ok(state.messages.some((m) => m.sender === "system" && m.text.includes("chatting with Humancare AI")));
    assert.equal(state.messages.some((m) => m.text === "Patient switched to the AI assistant"), false, "the team line is not for the patient");

    // the agent's side: a team-only system line, the chat is no longer assigned
    const conv = await convOf(chat.id);
    assert.deepEqual([conv.mode, conv.assigneeId, conv.agentName, conv.everLive], ["ai", null, "", true]);
    const detail = (await rest("GET", `/conversations/${chat.id}`, { user: AGENT_A })).body;
    assert.ok(detail.messages.some((m) => m.internal && m.text === "Patient switched to the AI assistant"));

    // a chat that was ever live stays in Live agent chats ("Back with the AI"), NOT in AI chats
    const live = (await rest("GET", "/conversations?view=live")).body.conversations.find((c) => c.conversationId === chat.id);
    const ai = (await rest("GET", "/conversations?view=ai")).body.conversations.find((c) => c.conversationId === chat.id);
    assert.equal(live?.mode, "ai");
    assert.equal(ai, undefined);

    // the AI carries on
    await lc.call(chat.socket, "chat:message", { text: "How much is a consultation?" });
    assert.equal(lc.ai.calls.length, 1);
    assert.equal((await stateOf(chat.socket)).messages.at(-1).sender, "ai");

    // and the patient can ask for a live agent again later
    await lc.call(chat.socket, "chat:agent");
    state = await stateOf(chat.socket);
    assert.equal(state.mode, "queue");
    assert.equal(state.canSwitchToAi, true, "waiting for an agent: can still go back to the AI");
    chat.socket.close();
  });

  test("Switch to AI is hidden and refused when the AI is switched off", async () => {
    const chat = await openChat();
    await takeOver(chat.id);
    await lc.setSettings({ aiMode: "ai_off" });
    try {
      assert.equal((await stateOf(chat.socket)).canSwitchToAi, false);
      const res = await lc.call(chat.socket, "chat:switch-ai");
      assert.equal(res.ok, false);
      assert.equal((await convOf(chat.id)).mode, "live");
    } finally {
      await lc.setSettings({ aiMode: "ai_first" });
    }
    chat.socket.close();
  });

  test("Switch to AI does nothing in an AI chat or an ended chat", async () => {
    const chat = await openChat();
    assert.equal((await lc.call(chat.socket, "chat:switch-ai")).ok, false);
    await takeOver(chat.id);
    assert.equal((await rest("POST", `/conversations/${chat.id}/resolve`, { user: AGENT_A })).status, 200);
    const after = await lc.call(chat.socket, "chat:switch-ai");
    assert.equal(after.ok, false);
    chat.socket.close();
  });

  test("no agent available: the patient gets the thank-you text with their name and email, one email goes out, nothing says offline", async () => {
    const chat = await openChat({ name: "Priya Raman", email: "priya.raman@example.com" });
    await lc.call(chat.socket, "chat:agent");
    const state = await stateOf(chat.socket);
    assert.equal(state.mode, "queue");
    const reply = state.messages.at(-1).text;
    assert.equal(reply, "Thanks, Priya! We've received your question and details. Our team will get back to you at priya.raman@example.com shortly.");
    for (let i = 0; i < 20 && lc.emails.length < 1; i += 1) await sleep(50);
    assert.equal(lc.emails.length, 1);
    for (const text of [...state.messages.map((m) => m.text), lc.emails[0].subject, lc.emails[0].body]) {
      assert.doesNotMatch(text, /offline|Connecting you|support hours/i);
    }
    // the admin still sees the request in the Queue
    const row = (await rest("GET", "/conversations?view=live")).body.conversations.find((c) => c.name === "Priya Raman");
    assert.equal(row.mode, "queue");
    chat.socket.close();
  });

  test("an older saved 'team is offline' text is never shown to a patient", async () => {
    await lc.setSettings({ offlineMessage: "Our team is offline right now. Leave your request and we'll reply to your email as soon as we're back." });
    try {
      const chat = await openChat({ name: "Old Text", email: "old@example.com" });
      await lc.call(chat.socket, "chat:agent");
      const reply = (await stateOf(chat.socket)).messages.at(-1).text;
      assert.doesNotMatch(reply, /offline/i);
      assert.match(reply, /old@example\.com/);
      chat.socket.close();
    } finally {
      await lc.setSettings({ offlineMessage: "Thanks, {firstName}! We've received your question and details. Our team will get back to you at {email} shortly." });
    }
  });
});
