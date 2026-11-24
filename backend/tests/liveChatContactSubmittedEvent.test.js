const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep } = require("./helpers/liveChatServer");

describe("live chat: contact form -> contact:submitted event for the admin voice alert", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000" } });
  });
  after(async () => {
    await lc.close();
  });

  test("a saved contact form tells the agents once, with only the visitor id", async () => {
    const agent = await lc.agent();
    await agent.snapshotPromise;
    const seen = [];
    agent.onAny((event, payload) => seen.push([event, payload]));
    const contact = await lc.submitContact({});
    assert.equal(contact.status, 200);
    await sleep(200);
    const events = seen.filter(([e]) => e === "contact:submitted");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0][1], { visitorId: contact.visitorId });
    agent.close();
  });

  test("a rejected form tells nobody", async () => {
    const agent = await lc.agent();
    await agent.snapshotPromise;
    const seen = [];
    agent.onAny((event) => seen.push(event));
    const res = await lc.post("/contact", { consent: true, name: "", email: "a@b.co" });
    assert.equal(res.status, 400);
    await sleep(200);
    assert.ok(!seen.includes("contact:submitted"));
    agent.close();
  });

  test("starting a chat still emits chat:new for the AI chat (the 'AI chat started' voice)", async () => {
    const agent = await lc.agent();
    await agent.snapshotPromise;
    const seen = [];
    agent.onAny((event, payload) => seen.push([event, payload]));
    const contact = await lc.submitContact({});
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home" });
    assert.equal(started.ok, true);
    await sleep(200);
    assert.ok(seen.some(([e, p]) => e === "chat:new" && p.mode === "ai"));
    socket.close();
    agent.close();
  });
});
