const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");

describe("live chat: transcript download", () => {
  let lc;
  after(async () => {
    await lc?.close();
  });

  const download = (id, { user = AGENT_A, role = "admin" } = {}) =>
    fetch(`${lc.url}/api/admin/livechat/conversations/${id}/transcript`, { headers: { "x-test-role": role, "x-test-user": user } });

  test("plain text without internal notes, named by chat ID, not cached, and every download is logged", async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    lc.agentNames[AGENT_A] = "Sam";
    const contact = await lc.submitContact({ name: "Zelda Quimby" });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home", tz: "UTC", cookies: "accepted" });
    const id = started.conversation.conversationId;
    // The agent takes the chat first, so the patient's message goes to a person and the AI is not called.
    await lc.rest("POST", `/conversations/${id}/messages`, { user: AGENT_A, body: { text: "Hi, this is Sam." } });
    await lc.call(socket, "chat:message", { text: "I need help with my booking" });
    await lc.rest("POST", `/conversations/${id}/notes`, { user: AGENT_A, body: { text: "SECRET-NOTE-TEXT" } });

    const res = await download(id);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(res.headers.get("content-type"), /^text\/plain/);
    assert.equal(res.headers.get("content-disposition"), `attachment; filename="chat-${id}.txt"`);
    assert.ok(!res.headers.get("content-disposition").includes("Zelda"));
    const text = await res.text();
    assert.match(text, /Patient: I need help with my booking/);
    assert.match(text, /Sam: Hi, this is Sam\./);
    assert.ok(!text.includes("SECRET-NOTE-TEXT"));
    assert.ok(!text.includes("team only"));

    const stored = await lc.models.LcConversation.findOne({ conversationId: id }).lean();
    assert.equal(stored.transcriptLog.length, 1);
    assert.equal(String(stored.transcriptLog[0].userId), AGENT_A);
    await download(id, { user: AGENT_B });
    assert.equal((await lc.models.LcConversation.findOne({ conversationId: id }).lean()).transcriptLog.length, 2);

    assert.equal((await download(id, { user: "u1", role: "user" })).status, 403);
    assert.equal((await download("HCNOSUCH01")).status, 404);
    assert.equal((await download("bad id")).status, 404);
    socket.close();
  });
});
