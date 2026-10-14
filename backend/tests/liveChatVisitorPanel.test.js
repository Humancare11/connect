const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, AGENT_A } = require("./helpers/liveChatServer");

describe("live chat: Real-time visitors side panel and contact edit", () => {
  let lc;
  after(async () => {
    await lc?.close();
  });

  test("a browsing visitor has a panel; contact can be added and is encrypted; roles are enforced", async () => {
    lc = await startChatServer();
    const visitor = await lc.visitor({ referrer: "https://www.google.com/" });
    visitor.emit("visitor:page", { path: "/pricing", title: "Pricing" });
    await sleep(150);
    const id = "visitor-0123456789abcdef";

    const panel = await lc.rest("GET", `/visitors/${id}/panel`, { user: AGENT_A });
    assert.equal(panel.status, 200, JSON.stringify(panel.body));
    assert.equal(panel.body.panel.contact.email, "");
    assert.equal(panel.body.panel.counts.chats, 0);
    assert.equal(panel.body.panel.returning, false);
    assert.equal(panel.body.panel.pages[0].path, "/pricing");
    assert.equal(panel.body.panel.pages[0].current, true);
    assert.equal(panel.body.panel.visit.online, true);

    const bad = await lc.rest("PUT", `/visitors/${id}/contact`, { user: AGENT_A, body: { name: "x", email: "nope" } });
    assert.equal(bad.status, 400);

    const saved = await lc.rest("PUT", `/visitors/${id}/contact`, {
      user: AGENT_A,
      body: { name: "Lena Fischer", email: "lena@example.com", phone: "" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(lc.livechat.presence.get(id).name, "Lena Fischer");

    const stored = await lc.models.LcVisitor.findOne({ visitorId: id }).lean();
    assert.ok(stored.email.cipherText);
    assert.ok(!JSON.stringify(stored).includes("lena@example.com"));

    const again = await lc.rest("GET", `/visitors/${id}/panel`, { user: AGENT_A });
    assert.equal(again.body.panel.contact.email, "lena@example.com");

    assert.equal((await lc.rest("GET", `/visitors/${id}/panel`, { user: "u1", role: "user" })).status, 403);
    assert.equal((await lc.rest("PUT", `/visitors/${id}/contact`, { user: "u1", role: "partner", body: {} })).status, 403);
    assert.equal((await lc.rest("GET", "/visitors/not-a-visitor/panel", { user: AGENT_A })).status, 404);
    assert.equal((await lc.rest("GET", "/visitors/visitor-ffffffffffffffff/panel", { user: AGENT_A })).status, 404);
    visitor.close();
  });
});
