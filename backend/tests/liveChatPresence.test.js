const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const { MemoryPresenceStore } = require("../services/liveChat/presence");
const { classifySource, cleanPath, isTrackablePath } = require("../services/liveChat/visitorNamespace");
const { startLiveChatServer, once, sleep, VISITOR_ID } = require("./helpers/liveChatServer");

describe("presence store: 30 second grace period", () => {
  test("a visitor is removed 30 s after their last socket disconnects", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const changes = [];
    const expired = [];
    const store = new MemoryPresenceStore({
      onChange: (type, record) => changes.push([type, record.visitorId]),
      onExpire: (record) => expired.push(record.visitorId),
    });
    store.attach("v1", "s1", { ip: "1.1.1.1" });
    store.detach("v1", "s1");

    t.mock.timers.tick(29_999);
    assert.ok(store.get("v1"), "still listed just before 30 s");
    assert.deepEqual(expired, []);

    t.mock.timers.tick(1);
    assert.equal(store.get("v1"), null, "gone at 30 s");
    assert.deepEqual(expired, ["v1"]);
    assert.deepEqual(changes.at(-1), ["remove", "v1"]);
    assert.equal(store.size, 0);
  });

  test("reconnecting inside the grace period keeps the visitor", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const expired = [];
    const store = new MemoryPresenceStore({ onExpire: (record) => expired.push(record.visitorId) });
    store.attach("v1", "s1");
    store.detach("v1", "s1");
    t.mock.timers.tick(20_000);
    store.attach("v1", "s2"); // page change / network blip
    t.mock.timers.tick(60_000);
    assert.ok(store.get("v1"));
    assert.deepEqual(expired, []);
  });

  test("a second tab keeps the visitor listed until the last one closes", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const store = new MemoryPresenceStore();
    store.attach("v1", "tab1");
    store.attach("v1", "tab2");
    store.detach("v1", "tab1");
    t.mock.timers.tick(60_000);
    assert.ok(store.get("v1"), "tab2 is still open");
    store.detach("v1", "tab2");
    t.mock.timers.tick(30_000);
    assert.equal(store.get("v1"), null);
  });

  test("page changes build a timeline with time on each page", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const store = new MemoryPresenceStore();
    store.attach("v1", "s1");
    store.setPage("v1", { path: "/", title: "Home" });
    t.mock.timers.tick(60_000);
    store.setPage("v1", { path: "/book-appointment", title: "Book Appointment" });
    const record = store.get("v1");
    assert.equal(record.page.path, "/book-appointment");
    assert.equal(record.pages.length, 2);
    assert.equal(record.pages[0].seconds, 60);
  });

  test("clear() cancels every pending removal", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const expired = [];
    const store = new MemoryPresenceStore({ onExpire: (record) => expired.push(record.visitorId) });
    store.attach("v1", "s1");
    store.detach("v1", "s1");
    store.clear();
    t.mock.timers.tick(60_000);
    assert.deepEqual(expired, []);
  });
});

describe("tracker input handling", () => {
  test("only the path is kept, never the query string or hash", () => {
    assert.equal(cleanPath("/book-appointment?token=abc&name=Jo#step2"), "/book-appointment");
    assert.equal(cleanPath("javascript:alert(1)"), "");
    assert.equal(cleanPath("/has space"), "");
  });

  test("login, payment, video-call and admin areas are never tracked", () => {
    for (const path of ["/admin-dashboard", "/superadmin-dashboard", "/payment-admin/payment-links", "/login",
      "/doctor-dashboard/x", "/video-call/abc", "/pay/xyz", "/user/profile", "/partner-login", "/employee-login"]) {
      assert.equal(isTrackablePath(path), false, path);
    }
    for (const path of ["/", "/book-appointment", "/services-and-prices", "/blog/something"]) {
      assert.equal(isTrackablePath(path), true, path);
    }
  });

  test("referrers are reduced to a source label", () => {
    assert.deepEqual(classifySource("https://www.google.com/search?q=x"), { source: "Google search", referrer: "google.com" });
    assert.deepEqual(classifySource("https://humancareconnect.co/home"), { source: "Direct", referrer: "" });
    assert.deepEqual(classifySource(""), { source: "Direct", referrer: "" });
    assert.equal(classifySource("https://l.instagram.com/?u=1").source, "Instagram");
  });
});

describe("presence over the sockets", () => {
  let lc;
  after(async () => {
    await lc?.close();
  });

  test("a visitor appears for agents with location, then is removed after the grace period", async () => {
    lc = await startLiveChatServer(); // grace period 250 ms in tests
    const agent = await lc.agent();
    await agent.snapshotPromise;

    const deltas = [];
    agent.on("visitors:delta", (delta) => deltas.push(delta));

    const visitor = await lc.visitor({ referrer: "https://www.google.com/" });
    visitor.emit("visitor:page", { path: "/book-appointment?x=1", title: "Book Appointment" });
    await sleep(120);

    const seen = lc.livechat.presence.get(VISITOR_ID);
    assert.equal(seen.page.path, "/book-appointment");
    assert.equal(seen.source, "Google search");
    assert.equal(seen.geo.city, "Austin");
    assert.ok(deltas.some((d) => d.type === "upsert" && d.visitor.visitorId === VISITOR_ID));

    visitor.close();
    await sleep(100);
    assert.ok(lc.livechat.presence.get(VISITOR_ID), "still listed during the grace period");

    await sleep(300);
    assert.equal(lc.livechat.presence.get(VISITOR_ID), null);
    assert.ok(deltas.some((d) => d.type === "remove" && d.visitorId === VISITOR_ID));
  });

  test("an untracked page is ignored and an oversized event is dropped", async () => {
    const visitor = await lc.visitor();
    visitor.emit("visitor:page", { path: "/admin-dashboard", title: "Admin" });
    visitor.emit("visitor:page", { path: "/", title: "x".repeat(5000) });
    await sleep(120);
    assert.equal(lc.livechat.presence.get(VISITOR_ID).page, null);
    visitor.close();
  });

  test("blocked IPs cannot connect", async () => {
    const blocked = await startLiveChatServer({ mount: { isIpBlocked: async () => true } });
    await assert.rejects(blocked.visitor(), { message: "blocked" });
    await blocked.close();
  });
});
