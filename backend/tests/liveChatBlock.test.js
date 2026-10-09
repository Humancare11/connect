const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, FILES, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");

async function waitFor(fn, ms = 3000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

// The test server trusts X-Forwarded-For (like production behind a proxy), so each test can be a different IP.
const from = (ip) => ({ "x-forwarded-for": ip });

describe("live chat: IP block and abuse alerts", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      // Real block store (no stub), real abuse thresholds. The daily limit is set per test below.
      mount: { isIpBlocked: undefined },
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100", LIVECHAT_UPLOADS_PER_10_MIN: "50", LIVECHAT_ABUSE_CHATS_PER_HOUR: "3" },
    });
    lc.agentNames[AGENT_A] = "Sam";
  });
  after(async () => {
    await lc.close();
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();

  async function openChat(ip, extra = {}) {
    const contact = await lc.submitContact(extra, from(ip));
    assert.equal(contact.status, 200, JSON.stringify(contact));
    const socket = await lc.chatSocket(contact.token, {}, from(ip));
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, id: started.conversation?.conversationId, visitorId: contact.visitorId, started };
  }
  async function agent() {
    const socket = await lc.agent("admin-token");
    await socket.snapshotPromise;
    return socket;
  }

  describe("blocking", () => {
    test("Block IP on a chat: its chat is closed, its sockets dropped, and it cannot come back", async () => {
      const ip = "203.0.113.10";
      const chat = await openChat(ip);
      const dropped = new Promise((resolve) => chat.socket.once("disconnect", resolve));

      const res = await rest("POST", `/conversations/${chat.id}/block-ip`, { ...A, body: { reason: "spam links" } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual([res.body.ip, res.body.closed], [ip, 1]);
      await dropped;

      const conv = await convOf(chat.id);
      assert.deepEqual([conv.mode, conv.closedReason], ["archived", "blocked"]);
      const detail = (await rest("GET", `/conversations/${chat.id}`)).body;
      assert.ok(detail.messages.some((m) => m.internal && m.text === "IP blocked by Sam"));

      // new connections, the contact form and uploads are all refused for that IP
      await assert.rejects(lc.chatSocket(chat.token, {}, from(ip)), { message: "blocked" });
      await assert.rejects(lc.trackerSocket("tracker-blocked-0123456789", from(ip)), { message: "blocked" });
      const form = await lc.submitContact({}, from(ip));
      assert.equal(form.status, 403);
      const upload = await lc.upload(chat.token, { name: "a.pdf", buffer: FILES.pdf }, from(ip));
      assert.equal(upload.status, 403);
    });

    test("other IPs are not affected", async () => {
      const bad = "203.0.113.11";
      const good = "198.51.100.20";
      const abusive = await openChat(bad);
      const fine = await openChat(good);
      await rest("POST", `/conversations/${abusive.id}/block-ip`, { ...A, body: {} });
      assert.equal((await lc.call(fine.socket, "chat:message", { text: "hello" })).ok, true);
      assert.equal((await convOf(fine.id)).mode, "ai");
      fine.socket.close();
    });

    test("Block on a visitor row uses that visitor's IP and removes them from the list", async () => {
      const ip = "203.0.113.12";
      const vid = "row-block-visitor-0123456789";
      const tracker = await lc.trackerSocket(vid, from(ip));
      await waitFor(() => lc.livechat.presence.get(vid));
      assert.equal(lc.livechat.presence.get(vid).ip, ip);

      const dropped = new Promise((resolve) => tracker.once("disconnect", resolve));
      const res = await rest("POST", `/visitors/${vid}/block-ip`, { ...A, body: { reason: "bot" } });
      assert.deepEqual([res.status, res.body.ip], [200, ip]);
      await dropped;
      assert.equal(lc.livechat.presence.get(vid), null);
      await assert.rejects(lc.trackerSocket(vid, from(ip)), { message: "blocked" });
    });

    test("the Blocked IPs list, and Unblock lets the IP back in", async () => {
      const ip = "203.0.113.13";
      const chat = await openChat(ip);
      await rest("POST", `/conversations/${chat.id}/block-ip`, { ...A, body: { reason: "abusive language" } });
      await assert.rejects(lc.trackerSocket("unblock-check-visitor-0123", from(ip)), { message: "blocked" });

      const listed = (await rest("GET", "/blocked-ips")).body.blocked;
      const entry = listed.find((b) => b.ip === ip);
      assert.ok(entry);
      assert.equal(entry.reason, "abusive language");
      assert.equal(entry.blockedBy, AGENT_A);

      assert.equal((await rest("DELETE", `/blocked-ips/${entry.id}`, A)).status, 200);
      assert.equal((await rest("GET", "/blocked-ips")).body.blocked.some((b) => b.ip === ip), false);
      const back = await lc.trackerSocket("unblock-check-visitor-0123", from(ip));
      assert.ok(back.connected, "after unblocking, the IP can connect again (no stale cache)");
      back.close();
      assert.equal((await rest("DELETE", `/blocked-ips/${entry.id}`, A)).status, 404);
    });

    test("blocking the same IP twice is harmless; a chat with no usable IP cannot be blocked", async () => {
      const ip = "203.0.113.14";
      const chat = await openChat(ip);
      assert.equal((await rest("POST", `/conversations/${chat.id}/block-ip`, A)).status, 200);
      assert.equal((await rest("POST", `/conversations/${chat.id}/block-ip`, A)).status, 200);
      assert.equal((await rest("GET", "/blocked-ips")).body.blocked.filter((b) => b.ip === ip).length, 1);

      const noIp = await openChat("198.51.100.21");
      await lc.models.LcConversation.updateOne({ conversationId: noIp.id }, { $set: { ip: "" } });
      const res = await rest("POST", `/conversations/${noIp.id}/block-ip`, A);
      assert.deepEqual([res.status, res.body.error], [400, "no_ip"]);
      assert.equal((await rest("POST", `/visitors/not-there-visitor-0123456789/block-ip`, A)).status, 400);
      assert.equal((await rest("POST", `/visitors/bad/block-ip`, A)).status, 404);
      noIp.socket.close();
    });

    test("only admin and superadmin can block, list or unblock", async () => {
      const chat = await openChat("203.0.113.15");
      for (const role of ["employeeadmin", "paymentadmin", "doctor", "user", "partner"]) {
        assert.equal((await rest("POST", `/conversations/${chat.id}/block-ip`, { role })).status, 403, role);
        assert.equal((await rest("POST", `/visitors/${chat.visitorId}/block-ip`, { role })).status, 403, role);
        assert.equal((await rest("GET", "/blocked-ips", { role })).status, 403, role);
        assert.equal((await rest("DELETE", "/blocked-ips/64b0000000000000000000ff", { role })).status, 403, role);
      }
      assert.equal((await rest("POST", `/conversations/${chat.id}/block-ip`, { role: "superadmin", user: AGENT_B })).status, 200);
      chat.socket.close();
    });
  });

  describe("abuse alerts", () => {
    test("one alert when an IP starts 3 chats within an hour; not again for the same IP", async () => {
      const ip = "203.0.113.30";
      const admin = await agent();
      admin.events.length = 0;
      const chats = [];
      for (let i = 0; i < 4; i += 1) {
        const chat = await openChat(ip);
        chats.push(chat);
        await rest("POST", `/conversations/${chat.id}/resolve`, A); // so the next chat can start
        await sleep(40);
      }
      await sleep(100);
      const alerts = admin.events.filter(([e]) => e === "abuse:alert");
      assert.equal(alerts.length, 1, "exactly one alert");
      assert.deepEqual([alerts[0][1].reason, alerts[0][1].window, alerts[0][1].ip, alerts[0][1].count], ["many_chats", "hour", ip, 3]);
      assert.match(alerts[0][1].conversationId, /^HC/);
      assert.equal(JSON.stringify(alerts[0][1]).toLowerCase().includes("emma"), false, "no patient details in the alert");
      chats.forEach((c) => c.socket.close());
      admin.close();
    });

    test("fewer chats do not raise an alert, and other IPs are counted separately", async () => {
      const admin = await agent();
      admin.events.length = 0;
      for (const ip of ["203.0.113.31", "203.0.113.32", "203.0.113.33"]) {
        const chat = await openChat(ip);
        chat.socket.close();
      }
      await sleep(100);
      assert.equal(admin.events.filter(([e]) => e === "abuse:alert").length, 0);
      admin.close();
    });

    test("the same visitor starting many chats raises an alert too", async () => {
      const ip = "203.0.113.34";
      const admin = await agent();
      admin.events.length = 0;
      const first = await openChat(ip);
      first.socket.close();
      let conversation = first;
      for (let i = 0; i < 3; i += 1) {
        await rest("POST", `/conversations/${conversation.id}/resolve`, A);
        const socket = await lc.chatSocket(first.token, {}, from(ip));
        const started = await lc.call(socket, "chat:start", {});
        conversation = { id: started.conversation.conversationId, socket };
      }
      await sleep(100);
      assert.equal(admin.events.filter(([e]) => e === "abuse:alert").length, 1);
      conversation.socket.close();
      admin.close();
    });

    test("hitting the daily new-chat limit raises one alert for that IP", async () => {
      const ip = "203.0.113.40";
      const limits = lc.livechat.limits.limits;
      const admin = await agent();
      admin.events.length = 0;
      limits.chatsPerIpPerDay = 2;
      try {
        const sockets = [];
        for (let i = 0; i < 2; i += 1) sockets.push((await openChat(ip)).socket);
        const refused = [];
        for (let i = 0; i < 3; i += 1) {
          const contact = await lc.submitContact({}, from(ip));
          const socket = await lc.chatSocket(contact.token, {}, from(ip));
          refused.push(await lc.call(socket, "chat:start", {}));
          sockets.push(socket);
        }
        assert.deepEqual(refused.map((r) => r.error), ["chat_limit", "chat_limit", "chat_limit"]);
        await sleep(100);
        const daily = admin.events.filter(([e, p]) => e === "abuse:alert" && p.reason === "daily_limit");
        assert.equal(daily.length, 1, "one alert, however many refusals");
        assert.equal(daily[0][1].ip, ip);
        sockets.forEach((s) => s.close());
      } finally {
        limits.chatsPerIpPerDay = 1000;
        admin.close();
      }
    });

    test("an admin can react to an alert by blocking the IP from the chat it names", async () => {
      const ip = "203.0.113.50";
      const admin = await agent();
      admin.events.length = 0;
      const chats = [];
      for (let i = 0; i < 3; i += 1) {
        const chat = await openChat(ip);
        chats.push(chat);
        await rest("POST", `/conversations/${chat.id}/resolve`, A);
      }
      await sleep(100);
      const alert = admin.events.find(([e]) => e === "abuse:alert")[1];
      const res = await rest("POST", `/conversations/${alert.conversationId}/block-ip`, { ...A, body: { reason: "alert" } });
      assert.equal(res.body.ip, ip);
      await assert.rejects(lc.chatSocket(chats[0].token, {}, from(ip)), { message: "blocked" });
      chats.forEach((c) => c.socket.close());
      admin.close();
    });
  });
});
