const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, AGENT_A, sleep } = require("./helpers/liveChatServer");
const { bucketOf, ACTIVE_WINDOW_MS, LIVECHAT_DAY_ZONE } = require("../services/liveChat/buckets");
const { istTodayStart } = require("../services/liveChat/istDay");

// Admin lists: Active (activity in the last 10 minutes) -> Recent (quiet, still today in India time) -> Archive page
// (before today). Computed from the last message every time; nothing is written and nothing is deleted.
describe("live chat: Active / Recent / Archive buckets (pure rules)", () => {
  const NOW = Date.parse("2026-10-16T09:00:00Z"); // 14:30 IST
  const at = (msAgo) => new Date(NOW - msAgo);
  const MIN = 60_000;

  test("one config constant names the day zone", () => {
    assert.equal(LIVECHAT_DAY_ZONE, "Asia/Kolkata");
    assert.equal(ACTIVE_WINDOW_MS, 10 * MIN);
  });

  test("9m59s is active, 10m01s is recent", () => {
    assert.equal(bucketOf({ mode: "ai", lastActivityAt: at(9 * MIN + 59_000) }, NOW), "active");
    assert.equal(bucketOf({ mode: "ai", lastActivityAt: at(10 * MIN) }, NOW), "recent");
    assert.equal(bucketOf({ mode: "ai", lastActivityAt: at(10 * MIN + 1000) }, NOW), "recent");
  });

  test("from the next calendar day (after IST midnight) it is archive", () => {
    const start = istTodayStart(NOW).getTime();
    assert.equal(bucketOf({ mode: "ai", lastActivityAt: new Date(start + 1000) }, NOW), "recent");
    assert.equal(bucketOf({ mode: "ai", lastActivityAt: new Date(start - 1000) }, NOW), "archive");
    // the same chat a few seconds after midnight India time
    const justAfterMidnight = start + 86_400_000 + 5000;
    assert.equal(bucketOf({ mode: "ai", lastActivityAt: new Date(start + 3_600_000) }, justAfterMidnight), "archive");
  });

  test("AI and agent chats, in any mode, follow the same timeline (resolved / ended just show a badge)", () => {
    for (const mode of ["ai", "live", "archived"]) {
      assert.equal(bucketOf({ mode, closedReason: "patient_ended", lastActivityAt: at(2 * MIN) }, NOW), "active", mode);
      assert.equal(bucketOf({ mode, closedReason: "resolved", lastActivityAt: at(30 * MIN) }, NOW), "recent", mode);
      assert.equal(bucketOf({ mode, closedReason: "inactive", lastActivityAt: at(3 * 86_400_000) }, NOW), "archive", mode);
    }
  });

  test("a chat without lastActivityAt (older data) uses lastMessageAt; a waiting Queue chat stays active; Trash is separate", () => {
    assert.equal(bucketOf({ mode: "ai", lastMessageAt: at(MIN) }, NOW), "active");
    assert.equal(bucketOf({ mode: "ai", lastMessageAt: at(5 * 86_400_000) }, NOW), "archive");
    assert.equal(bucketOf({ mode: "queue", lastActivityAt: at(40 * MIN) }, NOW), "active");
    assert.equal(bucketOf({ mode: "trashed", lastActivityAt: at(MIN) }, NOW), "trashed");
  });
});

describe("live chat: the admin lists and the Archive page use the buckets", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
  });
  after(async () => {
    await lc.close();
  });
  const A = { user: AGENT_A };
  const MIN = 60_000;
  const DAY = 86_400_000;
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  async function openChat({ live = false } = {}) {
    const contact = await lc.submitContact({ name: "Bucket Test" });
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    const id = started.conversation.conversationId;
    await lc.call(socket, "chat:message", { text: "hello" });
    if (live) await lc.rest("POST", `/conversations/${id}/takeover`, A);
    return { socket, id, token: contact.token };
  }
  const setActivity = (id, date, extra = {}) =>
    lc.models.LcConversation.updateOne({ conversationId: id }, { $set: { lastMessageAt: date, lastActivityAt: date, ...extra } });
  const listRow = async (view, id) => (await lc.rest("GET", `/conversations?view=${view}`, A)).body.conversations.find((c) => c.conversationId === id);
  const archiveIds = async () => (await lc.rest("GET", "/archive?from=2000-01-01", A)).body.rows.map((r) => r.conversationId);

  for (const [kind, live, view] of [["AI chat", false, "ai"], ["agent chat", true, "live"]]) {
    test(`${kind}: active at 9m59s even with the visitor offline, recent at 10m01s, archive the next day`, async () => {
      const chat = await openChat({ live });
      chat.socket.close();
      await sleep(400); // the visitor is offline now: that is only a badge

      await setActivity(chat.id, new Date(Date.now() - (9 * MIN + 59_000)));
      let row = await listRow(view, chat.id);
      assert.deepEqual([row?.bucket, row?.online], ["active", false]);

      await setActivity(chat.id, new Date(Date.now() - (10 * MIN + 1000)));
      row = await listRow(view, chat.id);
      assert.equal(row?.bucket, "recent", "still listed, openable");
      const detail = await lc.rest("GET", `/conversations/${chat.id}`, A);
      assert.equal(detail.status, 200);
      assert.ok(detail.body.messages.length > 0, "full history");
      assert.ok(!(await archiveIds()).includes(chat.id), "not on the Archive page yet");

      await setActivity(chat.id, new Date(istTodayStart(Date.now()).getTime() - 1000));
      assert.equal(await listRow(view, chat.id), undefined, "gone from the chat lists");
      assert.ok((await archiveIds()).includes(chat.id), "on the Archive page");
      const opened = await lc.rest("GET", `/conversations/${chat.id}?archive=1`, A);
      assert.equal(opened.status, 200);
    });
  }

  test("a resolved chat and a chat ended by the patient follow the same timeline", async () => {
    const resolved = await openChat({ live: true });
    await lc.rest("POST", `/conversations/${resolved.id}/resolve`, A);
    assert.equal((await listRow("live", resolved.id)).bucket, "active", "just now: active, with its status");
    await setActivity(resolved.id, new Date(Date.now() - 30 * MIN));
    assert.equal((await listRow("live", resolved.id)).bucket, "recent");

    const ended = await openChat();
    await lc.call(ended.socket, "chat:end", { clear: false });
    const row = await listRow("ai", ended.id);
    assert.deepEqual([row.bucket, row.closedReason], ["active", "patient_ended"]);
    await setActivity(ended.id, new Date(Date.now() - 3 * DAY));
    assert.ok((await archiveIds()).includes(ended.id));
    resolved.socket.close();
    ended.socket.close();
  });

  test("a returning patient: an Archive-page chat goes back to Active with the same history when they write", async () => {
    const chat = await openChat();
    await setActivity(chat.id, new Date(Date.now() - 3 * DAY), { mode: "archived", closedReason: "inactive", modeBeforeLeft: "ai", closedAt: new Date(Date.now() - 3 * DAY) });
    assert.ok((await archiveIds()).includes(chat.id));
    assert.equal(await listRow("ai", chat.id), undefined);

    const sent = await lc.call(chat.socket, "chat:message", { text: "I am back" });
    assert.equal(sent.ok, true);
    const row = await listRow("ai", chat.id);
    assert.deepEqual([row.bucket, row.mode], ["active", "ai"]);
    assert.ok(!(await archiveIds()).includes(chat.id));
    const detail = (await lc.rest("GET", `/conversations/${chat.id}`, A)).body;
    assert.deepEqual(detail.messages.filter((m) => m.sender === "patient").map((m) => m.text), ["hello", "I am back"]);
    chat.socket.close();
  });

  test("notes and system lines do not move a chat back to Active", async () => {
    const chat = await openChat({ live: true });
    await setActivity(chat.id, new Date(Date.now() - 30 * MIN));
    await lc.rest("POST", `/conversations/${chat.id}/notes`, { ...A, body: { text: "internal note" } }).catch(() => {});
    assert.equal((await listRow("live", chat.id)).bucket, "recent");
    chat.socket.close();
  });

  test("nothing is deleted automatically: every sweep and job leaves all chats and messages in place", async () => {
    const chat = await openChat();
    await setActivity(chat.id, new Date(Date.now() - 400 * DAY), { mode: "archived", closedReason: "inactive", closedAt: new Date(Date.now() - 400 * DAY) });
    const before = [await lc.models.LcConversation.countDocuments({}), await lc.models.LcMessage.countDocuments({})];
    await lc.livechat.chat.runInactiveDue();
    await lc.livechat.chat.runAbandonedSweep();
    await lc.livechat.chat.runDailySweep({ force: true });
    await lc.livechat.chat.runFollowUpDue();
    await lc.call(chat.socket, "chat:end", { clear: true }); // "clear from this device" deletes nothing on the server
    const after = [await lc.models.LcConversation.countDocuments({}), await lc.models.LcMessage.countDocuments({})];
    assert.equal(after[0], before[0], "no chat removed");
    assert.ok(after[1] >= before[1], "no message removed (jobs may add a closing line)");
    assert.ok(await convOf(chat.id));
    chat.socket.close();
  });
});
