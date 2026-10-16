// Archive temp (the chat lists keep chats archived today, India time) and the Archive page: every archived chat with
// date / type / reason filters, search over encrypted contact data (blind indexes + in-memory decrypt) and paging.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A, SUPER_S } = require("./helpers/liveChatServer");
const { hashLiveChatEmail, hashLiveChatPhone } = require("../utils/liveChat/crypto");
const { backfillSearchKeys, main: backfillMain } = require("../scripts/backfillLiveChatSearchKeys");
const { decryptLiveChatText, searchKeysOf } = require("../utils/liveChat/crypto");

const HOUR = 3_600_000;

describe("live chat: Archive temp and the Archive page", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" },
      mount: { followUpJobMs: 60_000, graceMs: 600_000 },
    });
  });
  after(async () => {
    await lc.close();
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();

  // A real chat (contact, start, one patient message), then archived directly with the wanted shape.
  async function archived({ name = "Emma Wilson", email, phone = "", city = "", ip, reason = "resolved", live = false, closedAt = new Date(), assignee = "" } = {}) {
    const contact = await lc.submitContact({ name, ...(email ? { email } : {}), phone });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:message", { text: "hello" });
    socket.close();
    const set = {
      mode: "archived",
      closedReason: reason,
      closedAt,
      everLive: live,
      startedAt: new Date(closedAt.getTime() - 20 * 60_000),
      lastMessageAt: closedAt,
      ...(city ? { "geo.city": city } : {}),
      ...(ip ? { ip } : {}),
      ...(assignee ? { agentName: assignee } : {}),
    };
    await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: set });
    return id;
  }
  const archive = async (query = {}, who = A) => {
    const qs = new URLSearchParams(query).toString();
    const res = await rest("GET", `/archive${qs ? `?${qs}` : ""}`, who);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };
  const idsOf = (body) => body.rows.map((r) => r.conversationId);

  describe("Archive temp: the chat lists", () => {
    test("archived chats stay in the lists for the rest of the IST day only, newest closed first, in both views", async () => {
      const { istTodayStart } = require("../services/liveChat/istDay");
      const start = istTodayStart(Date.now()).getTime(); // midnight India time
      const fresh = await archived({ closedAt: new Date(start + 1_000) });
      const fresher = await archived({ closedAt: new Date(start + 2_000) });
      const old = await archived({ closedAt: new Date(start - 1_000) }); // a second before IST midnight
      const freshLive = await archived({ closedAt: new Date(start + 3_000), live: true });
      const oldLive = await archived({ closedAt: new Date(start - 30 * HOUR), live: true });

      const ai = (await rest("GET", "/conversations?view=ai", A)).body.conversations;
      const aiIds = ai.map((c) => c.conversationId);
      assert.ok(aiIds.includes(fresh) && aiIds.includes(fresher));
      assert.ok(!aiIds.includes(old), "archived before IST midnight: only on the Archive page");
      assert.ok(!aiIds.includes(freshLive), "live chats are not in the AI list");
      const archivedAi = ai.filter((c) => c.mode === "archived");
      const times = archivedAi.map((c) => new Date(c.closedAt || c.lastMessageAt).getTime());
      assert.deepEqual(times, [...times].sort((a, b) => b - a), "newest first");

      const live = (await rest("GET", "/conversations?view=live", A)).body.conversations.map((c) => c.conversationId);
      assert.ok(live.includes(freshLive));
      assert.ok(!live.includes(oldLive));

      // ...but the Archive page has all of them
      const all = idsOf(await archive({ from: "2000-01-01" }));
      for (const id of [fresh, fresher, old, freshLive, oldLive]) assert.ok(all.includes(id), id);
    });
  });

  describe("Archive page: filters", () => {
    test("date range uses the archived date in New York time; the boundaries are inclusive", async () => {
      const inRange = await archived({ closedAt: new Date("2026-03-10T15:00:00Z") }); // 11:00 in New York
      const lastMinute = await archived({ closedAt: new Date("2026-03-11T03:59:00Z") }); // 11:59 pm on the 10th
      const nextDay = await archived({ closedAt: new Date("2026-03-11T04:01:00Z") }); // 00:01 on the 11th
      const before = await archived({ closedAt: new Date("2026-03-09T12:00:00Z") });
      const ids = idsOf(await archive({ from: "2026-03-10", to: "2026-03-10" }));
      assert.ok(ids.includes(inRange) && ids.includes(lastMinute));
      assert.ok(!ids.includes(nextDay) && !ids.includes(before));
      const bad = await rest("GET", "/archive?from=2026-02-30", A);
      assert.equal(bad.status, 400);
      assert.equal((await rest("GET", "/archive?from=2026-03-12&to=2026-03-10", A)).status, 400);
    });

    test("type: AI / Live agent / All", async () => {
      const day = new Date("2026-04-02T15:00:00Z");
      const ai = await archived({ closedAt: day });
      const live = await archived({ closedAt: day, live: true });
      const range = { from: "2026-04-02", to: "2026-04-02" };
      assert.deepEqual(idsOf(await archive({ ...range, type: "ai" })), [ai]);
      assert.deepEqual(idsOf(await archive({ ...range, type: "live" })), [live]);
      assert.equal((await archive({ ...range, type: "all" })).total, 2);
      assert.equal((await rest("GET", "/archive?type=nope", A)).status, 400);
    });

    test("reason: Inactive / Left / Resolved / Blocked / All, and the row shows it", async () => {
      const day = new Date("2026-05-02T15:00:00Z");
      const made = {};
      for (const reason of ["inactive", "patient_left", "resolved", "blocked"]) made[reason] = await archived({ closedAt: day, reason, live: reason === "resolved", assignee: reason === "resolved" ? "Sam" : "" });
      const range = { from: "2026-05-02", to: "2026-05-02" };
      for (const [reason, id] of Object.entries(made)) {
        const body = await archive({ ...range, reason });
        assert.deepEqual(idsOf(body), [id], reason);
        assert.equal(body.rows[0].reason, reason);
      }
      const all = await archive({ ...range, reason: "all" });
      assert.equal(all.total, 4);
      const resolved = all.rows.find((r) => r.conversationId === made.resolved);
      assert.deepEqual([resolved.type, resolved.assignee, resolved.messages > 0], ["live", "Sam", true]);
      assert.ok(resolved.name && resolved.email && resolved.startedAt && resolved.closedAt);
    });
  });

  describe("Archive page: search", () => {
    let ids;
    before(async () => {
      const day = new Date("2026-06-15T15:00:00Z");
      ids = {
        priya: await archived({ name: "Priya Raman", email: "priya.raman@example.com", phone: "+13023039993", city: "Austin", ip: "203.0.113.7", closedAt: day }),
        priyanka: await archived({ name: "Priyanka Shah", email: "priyanka@sample.org", phone: "+442071838750", city: "Boston", ip: "198.51.100.9", closedAt: day }),
        other: await archived({ name: "John Carter", email: "john@example.com", phone: "+14155550123", city: "Denver", ip: "192.0.2.44", closedAt: day }),
      };
    });
    const range = { from: "2026-06-15", to: "2026-06-15" };

    test("exact email (case-insensitive)", async () => {
      assert.deepEqual(idsOf(await archive({ q: "Priya.Raman@Example.com" })), [ids.priya], "found with no date range at all");
      assert.deepEqual(idsOf(await archive({ q: "john@example.com", ...range })), [ids.other]);
    });

    test("exact phone, however it is typed", async () => {
      for (const q of ["+13023039993", "+1 302-303-9993", "(302) 303 9993 ".replace("(302)", "1 (302)")]) {
        assert.deepEqual(idsOf(await archive({ q })), [ids.priya], q);
      }
    });

    test("partial name, partial email and partial phone (inside the date range)", async () => {
      assert.deepEqual(new Set(idsOf(await archive({ q: "priy", ...range }))), new Set([ids.priya, ids.priyanka]));
      assert.deepEqual(idsOf(await archive({ q: "RAMAN", ...range })), [ids.priya]);
      assert.deepEqual(idsOf(await archive({ q: "sample.org", ...range })), [ids.priyanka]);
      assert.deepEqual(idsOf(await archive({ q: "207183", ...range })), [ids.priyanka]);
    });

    test("chat ID (full or prefix), IP and city", async () => {
      assert.deepEqual(idsOf(await archive({ q: ids.other.toLowerCase() })), [ids.other]);
      assert.ok(idsOf(await archive({ q: ids.other.slice(0, 6) })).includes(ids.other));
      assert.deepEqual(idsOf(await archive({ q: "203.0.113.7" })), [ids.priya]);
      assert.deepEqual(idsOf(await archive({ q: "Bost", ...range })), [ids.priyanka]);
    });

    test("no match gives an empty page; a search without a range looks at the last 30 days only", async () => {
      assert.equal((await archive({ q: "zzzzqqqq", ...range })).total, 0);
      // "priy" with no range: the chats above are from June 2026, outside the default window
      const body = await archive({ q: "priy" });
      assert.ok(body.appliedRange && body.appliedRange.from && body.appliedRange.to, "the window that was used is reported");
      assert.ok(!idsOf(body).includes(ids.priya));
    });

    test("the stored search keys are hashes: no readable email, phone or name anywhere in them", async () => {
      const c = await convOf(ids.priya);
      assert.equal(c.searchKeys.emailHash, hashLiveChatEmail("priya.raman@example.com"));
      assert.equal(c.searchKeys.phoneHash, hashLiveChatPhone("+13023039993"));
      const dump = JSON.stringify(c.searchKeys);
      for (const secret of ["priya", "raman", "example.com", "3023039993"]) assert.ok(!dump.toLowerCase().includes(secret), secret);
      assert.match(c.searchKeys.emailHash, /^[0-9a-f]{64}$/);
    });
  });

  describe("Archive page: paging", () => {
    test("50 per page, newest archived first, total and pages reported", async () => {
      const base = new Date("2026-07-20T12:00:00Z").getTime();
      const docs = [];
      for (let i = 0; i < 120; i += 1) {
        docs.push({
          conversationId: `HCPG${String(i).padStart(5, "0")}`.slice(0, 10),
          visitorId: `visitor-paging-${String(i).padStart(8, "0")}`,
          mode: "archived",
          closedReason: "inactive",
          closedAt: new Date(base + i * 60_000),
          startedAt: new Date(base + i * 60_000 - 600_000),
        });
      }
      await lc.models.LcConversation.insertMany(docs);
      const range = { from: "2026-07-20", to: "2026-07-20", reason: "inactive" };
      const p1 = await archive({ ...range, page: "1" });
      const p2 = await archive({ ...range, page: "2" });
      const p3 = await archive({ ...range, page: "3" });
      assert.deepEqual([p1.total, p1.pages, p1.pageSize, p1.rows.length, p2.rows.length, p3.rows.length], [120, 3, 50, 50, 50, 20]);
      assert.equal(p1.rows[0].conversationId, "HCPG00119");
      assert.equal(p3.rows.at(-1).conversationId, "HCPG00000");
      const times = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => new Date(r.closedAt).getTime());
      assert.deepEqual(times, [...times].sort((a, b) => b - a));
      assert.equal(new Set([...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.conversationId)).size, 120, "no chat twice, none missing");
    });
  });

  describe("read only", () => {
    test("opening a chat from the Archive does not mark it read; the normal view does", async () => {
      const id = await archived({ closedAt: new Date("2026-08-01T12:00:00Z") });
      const unreadOf = async () => (await rest("GET", `/conversations?view=ai`, A)).body.conversations.find((c) => c.conversationId === id)?.unread;
      await lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { closedAt: new Date() } }); // visible in the list
      const before = await unreadOf();
      assert.ok(before > 0);
      assert.equal((await rest("GET", `/conversations/${id}?archive=1`, A)).status, 200);
      assert.equal(await unreadOf(), before, "still unread after looking from the Archive");
      assert.equal((await rest("GET", `/conversations/${id}`, A)).status, 200);
      assert.equal(await unreadOf(), 0);
      // the transcript download works for an archived chat
      const t = await fetch(`${lc.url}/api/admin/livechat/conversations/${id}/transcript`, { headers: { "x-test-role": "admin", "x-test-user": AGENT_A } });
      assert.equal(t.status, 200);
      assert.match(await t.text(), /hello/);
    });
  });

  describe("permissions", () => {
    const status = async (role) => (await fetch(`${lc.url}/api/admin/livechat/archive`, { headers: role ? { "x-test-role": role } : {} })).status;
    test("admin and superadmin read it; everyone else is refused; no session is 401", async () => {
      assert.equal(await status("admin"), 200);
      assert.equal(await status("superadmin"), 200);
      for (const role of ["employeeadmin", "paymentadmin", "doctor", "user", "partner"]) assert.equal(await status(role), 403, role);
      assert.equal(await status(), 401);
      assert.equal((await rest("GET", "/archive", { user: SUPER_S, role: "superadmin" })).status, 200);
    });
  });

  describe("the backfill script", () => {
    test("dry run changes nothing and prints only counts; apply is idempotent; production needs the flag", async () => {
      const LcConversation = lc.models.LcConversation;
      const id = await archived({ name: "Backfill Person", email: "bf@example.com", phone: "+15551230000" });
      await LcConversation.updateOne({ conversationId: id }, { $set: { searchKeys: { emailHash: "", phoneHash: "" } } });
      const deps = { LcConversation, decryptLiveChatText, searchKeysOf };

      const dry = await backfillSearchKeys({ ...deps, apply: false });
      assert.ok(dry.toUpdate >= 1);
      assert.equal(dry.updated, 0);
      assert.equal((await convOf(id)).searchKeys.emailHash, "", "dry run wrote nothing");

      const applied = await backfillSearchKeys({ ...deps, apply: true });
      assert.ok(applied.updated >= 1);
      assert.equal((await convOf(id)).searchKeys.emailHash, hashLiveChatEmail("bf@example.com"));
      const again = await backfillSearchKeys({ ...deps, apply: true });
      assert.deepEqual([again.toUpdate, again.updated], [0, 0], "a second run has nothing to do");
      for (const value of Object.values(applied)) assert.equal(typeof value, "number", "counts only");

      assert.equal(await backfillMain([], { NODE_ENV: "production" }), 2, "refuses production without the flag");
    });
  });
});
