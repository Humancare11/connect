const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { startChatServer, sleep, once, AGENT_A, AGENT_B, SUPER_S, ROLE_TOKENS } = require("./helpers/liveChatServer");
const { encryptLiveChatText } = require("../utils/liveChat/crypto");

describe("live chat: admin workspace (lists, take over, notes, assignment, panel)", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100" } });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[AGENT_B] = "Maya";
    lc.agentNames[SUPER_S] = "Super Admin";
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.ai.suggestions.length = 0;
    lc.ai.suggestCalls.length = 0;
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const B = { user: AGENT_B };
  const S = { user: SUPER_S, role: "superadmin" };

  // Records every event a socket receives, so tests can assert what the patient did (not) get.
  function collect(socket) {
    const events = [];
    socket.onAny((event, payload) => events.push([event, payload]));
    return events;
  }

  // A patient who completed the form and has an open AI chat.
  async function openChat(extra = {}, socketAuth = {}) {
    const contact = await lc.submitContact(extra);
    assert.equal(contact.status, 200);
    const socket = await lc.chatSocket(contact.token, socketAuth);
    const started = await lc.call(socket, "chat:start", { path: "/", title: "Home", tz: "America/Chicago", cookies: "accepted" });
    assert.equal(started.ok, true, JSON.stringify(started));
    return { socket, contact, id: started.conversation.conversationId, visitorId: contact.visitorId, events: collect(socket) };
  }
  const state = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const texts = (conv) => conv.messages.map((m) => m.text);
  const rowIn = async (view, id, opts = A) => (await rest("GET", `/conversations?view=${view}`, opts)).body.conversations.find((c) => c.conversationId === id);

  describe("AI chats vs Live agent chats", () => {
    test("an AI chat is listed under AI chats, and not under Live agent chats", async () => {
      const chat = await openChat();
      assert.ok(await rowIn("ai", chat.id));
      assert.equal(await rowIn("live", chat.id), undefined);
      const row = await rowIn("ai", chat.id);
      assert.equal(row.mode, "ai");
      assert.equal(row.name, "Emma Wilson");
      assert.equal(row.preview.sender, "ai");
      chat.socket.close();
    });

    test("an admin reply moves the chat to Live agent chats; the patient sees the agent's name", async () => {
      const chat = await openChat();
      const res = await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Hi Emma, this is Sam." } });
      assert.equal(res.status, 200, JSON.stringify(res.body));

      assert.equal(await rowIn("ai", chat.id), undefined);
      const row = await rowIn("live", chat.id);
      assert.equal(row.mode, "live");
      assert.deepEqual(row.assignee, { id: AGENT_A, name: "Sam" });
      assert.equal(row.everLive, true);

      const patient = await state(chat.socket);
      assert.equal(patient.mode, "live");
      assert.deepEqual(patient.agent, { name: "Sam" });
      assert.equal(patient.canRequestAgent, false);
      assert.ok(texts(patient).includes("Sam joined the chat"));
      const reply = patient.messages.find((m) => m.sender === "agent");
      assert.deepEqual([reply.text, reply.agentName], ["Hi Emma, this is Sam.", "Sam"]);

      const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean();
      assert.ok(conv.firstAgentReplyAt && conv.liveStartedAt);
      chat.socket.close();
    });

    test("'Take over' also moves it, and the AI stops answering", async () => {
      const chat = await openChat();
      const res = await rest("POST", `/conversations/${chat.id}/takeover`, A);
      assert.equal(res.status, 200);
      assert.equal(res.body.conversation.mode, "live");
      assert.ok(await rowIn("live", chat.id));

      lc.ai.calls.length = 0;
      await lc.call(chat.socket, "chat:message", { text: "Is anyone there?" });
      assert.equal(lc.ai.calls.length, 0, "the AI must not answer a chat an agent holds");
      chat.socket.close();
    });

    test("hand back to the AI: it answers again, and the chat stays in Live agent chats", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      const res = await rest("POST", `/conversations/${chat.id}/handback`, A);
      assert.equal(res.status, 200);
      assert.equal(res.body.conversation.mode, "ai");
      assert.equal(res.body.conversation.assignee, null);

      const row = await rowIn("live", chat.id);
      assert.ok(row, "a chat that was ever live stays under Live agent chats");
      assert.equal(await rowIn("ai", chat.id), undefined);

      const patient = await state(chat.socket);
      assert.equal(patient.canRequestAgent, true);
      assert.equal(patient.agent, null);
      assert.ok(texts(patient).includes("Handed back to the AI assistant"));

      await lc.call(chat.socket, "chat:message", { text: "How much is a consultation?" });
      assert.equal(lc.ai.calls.length, 1);
      chat.socket.close();
    });

    test("resolve archives the chat for good; it stays under Live agent chats", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Done?" } });
      const res = await rest("POST", `/conversations/${chat.id}/resolve`, A);
      assert.equal(res.status, 200);
      assert.equal((await rowIn("live", chat.id)).mode, "archived");
      assert.equal((await rowIn("live", chat.id)).closedReason, "resolved");

      const sent = await lc.call(chat.socket, "chat:message", { text: "one more thing" });
      assert.deepEqual([sent.ok, sent.error], [false, "no_conversation"]);
      const again = await rest("POST", `/conversations/${chat.id}/resolve`, A);
      assert.equal(again.body.already, true);
      const late = await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "hello?" } });
      assert.deepEqual([late.status, late.body.error], [409, "closed"]);
      chat.socket.close();
    });

    test("an AI reply that finishes after an admin took over is discarded", async () => {
      let release;
      lc.ai.queue.push(() => new Promise((resolve) => (release = () => resolve({
        ok: true, reply: "STALE AI ANSWER", handoff: false, handoffReason: "none", topic: "other",
        usage: { inputTokens: 700, cachedInputTokens: 0, outputTokens: 10, costUsd: 0.0001 },
      }))));
      const chat = await openChat();
      const pending = lc.call(chat.socket, "chat:message", { text: "question for the AI" });
      await sleep(150);
      assert.equal(lc.ai.calls.length, 1, "the AI turn is in flight");

      const takeover = rest("POST", `/conversations/${chat.id}/takeover`, A);
      await sleep(50);
      release();
      await pending;
      await takeover;
      await sleep(100);

      const patient = await state(chat.socket);
      assert.equal(texts(patient).includes("STALE AI ANSWER"), false);
      const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean();
      assert.equal(conv.mode, "live");
      assert.equal(conv.tokens.input, 700, "the tokens were still counted");
      chat.socket.close();
    });
  });

  describe("internal notes never reach the patient", () => {
    test("a note is stored and shown to admins only", async () => {
      const chat = await openChat();
      chat.events.length = 0;
      const res = await rest("POST", `/conversations/${chat.id}/notes`, { ...A, body: { text: "regular patient, be kind" } });
      assert.equal(res.status, 200);
      assert.equal(res.body.message.sender, "note");
      await sleep(150);

      assert.equal(JSON.stringify(chat.events).includes("regular patient"), false, "no event carried the note to the patient");
      const patient = await state(chat.socket);
      assert.equal(patient.messages.some((m) => m.sender === "note" || m.text.includes("regular patient")), false);

      const detail = (await rest("GET", `/conversations/${chat.id}`, B)).body;
      const note = detail.messages.find((m) => m.sender === "note");
      assert.equal(note.text, "regular patient, be kind");
      assert.equal(note.agentName, "Sam");

      const raw = await mongoose.connection.db.collection("lcmessages").find({ conversationId: chat.id }).toArray();
      assert.equal(JSON.stringify(raw).includes("regular patient"), false, "notes are encrypted at rest");
      chat.socket.close();
    });

    test("a note does not take the chat over, and is not given to the AI", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/notes`, { ...A, body: { text: "SECRET INTERNAL NOTE" } });
      assert.equal((await rowIn("ai", chat.id)).mode, "ai");
      await lc.call(chat.socket, "chat:message", { text: "hello" });
      assert.equal(JSON.stringify(lc.ai.calls[0]).includes("SECRET INTERNAL NOTE"), false);
      chat.socket.close();
    });

    test("team-only system lines (superadmin took over from Sam) are hidden from the patient", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      const res = await rest("POST", `/conversations/${chat.id}/takeover`, S);
      assert.equal(res.status, 200);
      const patient = await state(chat.socket);
      assert.equal(texts(patient).some((t) => t.includes("took over from")), false);
      assert.ok(texts(patient).includes("Super Admin joined the chat"));
      const detail = (await rest("GET", `/conversations/${chat.id}`, A)).body;
      assert.ok(detail.messages.some((m) => m.internal && m.text === "Super Admin took over from Sam"));
      chat.socket.close();
    });
  });

  describe("single assignment", () => {
    test("two admins taking over at the same moment: exactly one wins, the other is told who", async () => {
      for (let round = 0; round < 5; round += 1) {
        const chat = await openChat();
        const [a, b] = await Promise.all([rest("POST", `/conversations/${chat.id}/takeover`, A), rest("POST", `/conversations/${chat.id}/takeover`, B)]);
        const statuses = [a.status, b.status].sort();
        assert.deepEqual(statuses, [200, 409], `round ${round}`);
        const winner = a.status === 200 ? { id: AGENT_A, name: "Sam" } : { id: AGENT_B, name: "Maya" };
        const loser = a.status === 200 ? b : a;
        assert.equal(loser.body.error, "assigned");
        assert.equal(loser.body.assignee.name, winner.name);
        const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean();
        assert.equal(String(conv.assigneeId), winner.id);
        const joined = await lc.models.LcMessage.countDocuments({ conversationId: chat.id, sender: "system" });
        assert.equal(joined, 1, "one 'joined the chat' line only");
        chat.socket.close();
      }
    });

    test("two admins replying at the same moment in an AI chat: one reply is sent, the other refused", async () => {
      const chat = await openChat();
      const [a, b] = await Promise.all([
        rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "From Sam" } }),
        rest("POST", `/conversations/${chat.id}/messages`, { ...B, body: { text: "From Maya" } }),
      ]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      const sent = await lc.models.LcMessage.countDocuments({ conversationId: chat.id, sender: "agent" });
      assert.equal(sent, 1);
      const patient = await state(chat.socket);
      assert.equal(patient.messages.filter((m) => m.sender === "agent").length, 1);
      chat.socket.close();
    });

    test("only the assignee replies; others can read and add notes but not reply, hand back, resolve or take over", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);

      const reply = await rest("POST", `/conversations/${chat.id}/messages`, { ...B, body: { text: "mine now" } });
      assert.deepEqual([reply.status, reply.body.error, reply.body.assignee.name], [409, "not_assignee", "Sam"]);
      assert.equal((await rest("POST", `/conversations/${chat.id}/handback`, B)).status, 409);
      assert.equal((await rest("POST", `/conversations/${chat.id}/resolve`, B)).status, 409);
      const take = await rest("POST", `/conversations/${chat.id}/takeover`, B);
      assert.deepEqual([take.status, take.body.error], [409, "assigned"]);

      assert.equal((await rest("GET", `/conversations/${chat.id}`, B)).status, 200, "can read");
      assert.equal((await rest("POST", `/conversations/${chat.id}/notes`, { ...B, body: { text: "fyi" } })).status, 200, "can add notes");
      assert.equal((await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "still me" } })).status, 200);
      chat.socket.close();
    });

    test("taking over your own chat again is harmless", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      const again = await rest("POST", `/conversations/${chat.id}/takeover`, A);
      assert.deepEqual([again.status, again.body.already], [200, true]);
      chat.socket.close();
    });

    test("a superadmin can take over a chat another agent holds, and the previous agent is told", async () => {
      lc.identities["token-a"] = { id: AGENT_A, role: "admin" };
      const sam = await lc.agent("token-a");
      await sam.snapshotPromise;
      const taken = [];
      sam.on("chat:taken", (p) => taken.push(p));

      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Hi" } });
      const res = await rest("POST", `/conversations/${chat.id}/takeover`, S);
      assert.equal(res.status, 200);
      await sleep(150);
      assert.deepEqual(taken, [{ conversationId: chat.id, by: "Super Admin" }]);

      const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean();
      assert.equal(String(conv.assigneeId), SUPER_S);
      assert.equal((await state(chat.socket)).agent.name, "Super Admin");
      const old = await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "still here?" } });
      assert.deepEqual([old.status, old.body.error], [409, "not_assignee"]);
      chat.socket.close();
      sam.close();
    });
  });

  describe("queue", () => {
    test("a chat in the queue is taken by the first admin; the patient is no longer 'waiting'", async () => {
      const agent = await lc.onlineAgent();
      const chat = await openChat();
      await lc.call(chat.socket, "chat:agent");
      assert.equal((await rowIn("live", chat.id)).mode, "queue");

      const res = await rest("POST", `/conversations/${chat.id}/takeover`, B);
      assert.equal(res.status, 200);
      const patient = await state(chat.socket);
      assert.deepEqual([patient.mode, patient.agent.name], ["live", "Maya"]);
      assert.equal((await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean()).offlineRequested, false);
      chat.socket.close();
      agent.close();
    });
  });

  describe("access", () => {
    const protectedCalls = [
      ["GET", "/conversations?view=ai"],
      ["GET", "/conversations?view=live"],
      ["GET", "/conversations/HCAAAAAAAA"],
      ["POST", "/conversations/HCAAAAAAAA/messages", { text: "x" }],
      ["POST", "/conversations/HCAAAAAAAA/notes", { text: "x" }],
      ["POST", "/conversations/HCAAAAAAAA/takeover"],
      ["POST", "/conversations/HCAAAAAAAA/handback"],
      ["POST", "/conversations/HCAAAAAAAA/resolve"],
      ["POST", "/conversations/HCAAAAAAAA/read"],
      ["POST", "/conversations/HCAAAAAAAA/suggest"],
      ["PUT", "/conversations/HCAAAAAAAA/tags", { tags: ["a"] }],
      ["PUT", "/conversations/HCAAAAAAAA/contact", { name: "A B", email: "a@b.co" }],
      ["POST", "/conversations/start", { visitorId: "x" }],
      ["GET", "/unread"],
      ["GET", "/canned-replies"],
    ];

    test("every workspace route refuses employeeadmin, paymentadmin, doctors, patients and partners", async () => {
      for (const role of ["employeeadmin", "paymentadmin", "doctor", "user", "partner"]) {
        for (const [method, path, body] of protectedCalls) {
          const res = await rest(method, path, { role, body });
          assert.equal(res.status, 403, `${role} ${method} ${path}`);
        }
      }
    });

    test("no session is refused, and admin / superadmin reach the routes", async () => {
      const res = await fetch(`${lc.url}/api/admin/livechat/conversations?view=ai`);
      assert.equal(res.status, 401);
      assert.equal((await rest("GET", "/conversations?view=ai", A)).status, 200);
      assert.equal((await rest("GET", "/conversations?view=live", S)).status, 200);
      assert.equal((await rest("GET", "/conversations?view=nope", A)).status, 400);
      assert.equal((await rest("GET", "/conversations/not-an-id", A)).status, 404);
      assert.equal((await rest("GET", "/conversations/HCAAAAAAAA", A)).status, 404);
    });

    test("the agent typing event is refused for non-agent sockets", async () => {
      await assert.rejects(lc.agent("user-token"), { message: "forbidden" });
      assert.ok(ROLE_TOKENS["user-token"]);
    });
  });

  describe("unread", () => {
    test("counts are per admin; opening a chat clears it for that admin only", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "one" });
      await lc.call(chat.socket, "chat:message", { text: "two" });
      const before = async (who) => (await rest("GET", "/unread", who)).body;
      const baseA = (await before(A)).ai;
      const baseB = (await before(B)).ai;

      assert.equal((await rowIn("ai", chat.id, A)).unread, 2);
      await rest("GET", `/conversations/${chat.id}`, A); // A opens it
      assert.equal((await rowIn("ai", chat.id, A)).unread, 0);
      assert.equal((await rowIn("ai", chat.id, B)).unread, 2, "B has not seen it yet");
      assert.equal((await before(A)).ai, baseA - 2);
      assert.equal((await before(B)).ai, baseB);

      await lc.call(chat.socket, "chat:message", { text: "three" });
      assert.equal((await rowIn("ai", chat.id, A)).unread, 1);
      await rest("POST", `/conversations/${chat.id}/read`, A);
      assert.equal((await rowIn("ai", chat.id, A)).unread, 0);
      chat.socket.close();
    });

    test("live chats held by another agent do not count; queue entries and my own chats do", async () => {
      const agent = await lc.onlineAgent();
      const queued = await openChat();
      await lc.call(queued.socket, "chat:agent"); // "Talk to a live agent" is a patient message
      const base = (await rest("GET", "/unread", B)).body.live;
      assert.ok(base >= 1, "a queue entry is unread for everyone");

      await rest("POST", `/conversations/${queued.id}/takeover`, A);
      await rest("GET", `/conversations/${queued.id}`, A);
      await lc.call(queued.socket, "chat:message", { text: "are you there?" });
      const a = (await rest("GET", "/unread", A)).body.live;
      const b = (await rest("GET", "/unread", B)).body.live;
      assert.ok(a >= 1, "my own chat counts for me");
      assert.ok(b < base + 2, "another agent's chat does not add to B");
      queued.socket.close();
      agent.close();
    });

    test("chat:new, queue:new and chat:message events reach agents (for toasts and badges)", async () => {
      const agent = await lc.agent();
      await agent.snapshotPromise;
      const seen = collect(agent);
      const agentOnline = await lc.onlineAgent("super-token");
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "hello there" });
      await lc.call(chat.socket, "chat:agent");
      await sleep(200);
      const names = seen.map(([e]) => e);
      assert.ok(names.includes("chat:new"));
      assert.ok(names.includes("queue:new"));
      assert.ok(seen.some(([e, p]) => e === "chat:message" && p.message?.sender === "patient" && p.message.text === "hello there" && p.name === "Emma" && p.everLive === false));
      chat.socket.close();
      agent.close();
      agentOnline.close();
    });
  });

  describe("patient panel", () => {
    test("contact, location, counts, context, chat info, recent conversations", async () => {
      const first = await openChat({ name: "Sophia Martinez", email: "sophia.m@example.com", phone: "+1 305 555 0188" });
      const visitorId = first.visitorId;
      await rest("POST", `/conversations/${first.id}/messages`, { ...A, body: { text: "Hi Sophia" } });
      await rest("POST", `/conversations/${first.id}/resolve`, A);

      // a second chat for the same visitor
      const again = await lc.call(first.socket, "chat:start", { tz: "America/New_York", cookies: "declined" });
      assert.equal(again.ok, true);
      const id = again.conversation.conversationId;

      // a registered user with the same email and two tickets
      const users = mongoose.connection.db.collection("users");
      const { insertedId } = await users.insertOne({ email: "sophia.m@example.com" });
      await mongoose.connection.db.collection("usertickets").insertMany([{ createdBy: insertedId }, { createdBy: insertedId }]);

      const { body } = await rest("GET", `/conversations/${id}`, A);
      const p = body.panel;
      assert.deepEqual(p.contact, { name: "Sophia Martinez", email: "sophia.m@example.com", phone: "+13055550188" });
      assert.equal(p.counts.chats, 2);
      assert.equal(p.counts.tickets, 2);
      assert.equal(p.counts.visits, 1);
      assert.equal(p.returning, true);
      assert.equal(p.timeZone, "America/New_York");
      assert.equal(p.context.cookieChoice, "declined");
      assert.match(p.context.summary, /Patient sent 0 messages; the AI replied 0 times\. The AI is handling it\./);
      assert.equal(p.info.chatId, id);
      assert.equal(p.info.assignee, null);
      assert.equal(p.recent.length, 1);
      assert.deepEqual([p.recent[0].conversationId, p.recent[0].status], [first.id, "Resolved"]);
      assert.equal(body.conversation.visitorId, visitorId);

      // no registered user with this email -> 0 tickets
      const other = await openChat({ email: "nobody@example.com" });
      assert.equal((await rest("GET", `/conversations/${other.id}`, A)).body.panel.counts.tickets, 0);
      first.socket.close();
      other.socket.close();
    });

    test("an invalid time zone is ignored", async () => {
      const chat = await openChat();
      const contact = await lc.submitContact();
      const socket = await lc.chatSocket(contact.token);
      const res = await lc.call(socket, "chat:start", { tz: "Mars/Olympus", cookies: "whatever" });
      const conv = await lc.models.LcConversation.findOne({ conversationId: res.conversation.conversationId }).lean();
      assert.equal(conv.timeZone, "");
      assert.equal(conv.cookieChoice, "unknown");
      socket.close();
      chat.socket.close();
    });

    test("the page timeline is saved only for chatting visitors, without query strings, including pages seen before the chat", async () => {
      const contact = await lc.submitContact();
      const tracked = await lc.chatSocket(contact.token, { consent: true, visitorId: contact.visitorId });
      const pagesBefore = await lc.models.LcPageVisit.countDocuments();
      tracked.emit("visitor:page", { path: "/", title: "Home" });
      await sleep(80);
      tracked.emit("visitor:page", { path: "/book-appointment?token=SECRET#x", title: "Book Appointment" });
      await sleep(80);
      assert.equal(await lc.models.LcPageVisit.countDocuments(), pagesBefore, "nothing stored before a chat starts");

      const started = await lc.call(tracked, "chat:start", {});
      const id = started.conversation.conversationId;
      tracked.emit("visitor:page", { path: "/services-and-prices", title: "Services & Prices" });
      await sleep(150);

      const { panel } = (await rest("GET", `/conversations/${id}`, A)).body;
      assert.deepEqual(panel.pages.map((x) => x.path), ["/", "/book-appointment", "/services-and-prices"]);
      assert.equal(JSON.stringify(panel.pages).includes("SECRET"), false);
      assert.equal(panel.pages.at(-1).current, true);
      assert.equal(panel.visit.online, true);
      assert.ok(panel.visit.device && panel.visit.browser);

      // a visitor who never chats: pages stay in memory only
      const plain = await lc.visitor();
      const before = await lc.models.LcPageVisit.countDocuments();
      plain.emit("visitor:page", { path: "/about", title: "About" });
      await sleep(120);
      assert.equal(await lc.models.LcPageVisit.countDocuments(), before);
      tracked.close();
      plain.close();
    });

    test("a visitor with a chat shows in Real-time visitors with the name and the chat, also after a reload", async () => {
      const contact = await lc.submitContact();
      const first = await lc.chatSocket(contact.token, { consent: true, visitorId: contact.visitorId });
      await lc.call(first, "chat:start", {});
      assert.equal(lc.livechat.presence.get(contact.visitorId).activity, "ai");
      first.close();
      await sleep(80);

      const reloaded = await lc.chatSocket(contact.token, { consent: true, visitorId: contact.visitorId });
      await sleep(200);
      const record = lc.livechat.presence.get(contact.visitorId);
      assert.equal(record.name, "Emma Wilson");
      assert.equal(record.activity, "ai");
      assert.match(record.conversationId, /^HC/);
      reloaded.close();
    });

    test("tags: trimmed, de-duplicated, limited; invalid input refused", async () => {
      const chat = await openChat();
      const ok = await rest("PUT", `/conversations/${chat.id}/tags`, { ...A, body: { tags: [" booking ", "Booking", "refund", "", 7] } });
      assert.deepEqual(ok.body.tags, ["booking", "refund"]);
      assert.deepEqual((await rest("GET", `/conversations/${chat.id}`, B)).body.panel.tags, ["booking", "refund"]);
      assert.equal((await rest("PUT", `/conversations/${chat.id}/tags`, { ...A, body: { tags: "nope" } })).status, 400);
      const many = Array.from({ length: 11 }, (_, i) => `t${i}`);
      assert.equal((await rest("PUT", `/conversations/${chat.id}/tags`, { ...A, body: { tags: many } })).status, 400);
      chat.socket.close();
    });

    test("Qualification: an admin can correct the contact; bad values are refused", async () => {
      const chat = await openChat();
      const bad = await rest("PUT", `/conversations/${chat.id}/contact`, { ...A, body: { name: "E", email: "nope", phone: "12" } });
      assert.equal(bad.status, 400);
      assert.ok(bad.body.errors.name && bad.body.errors.email && bad.body.errors.phone);
      const ok = await rest("PUT", `/conversations/${chat.id}/contact`, { ...A, body: { name: "Emma W. Wilson", email: "emma.new@example.com", phone: "+44 20 7946 0958" } });
      assert.equal(ok.status, 200);
      const { panel, conversation } = (await rest("GET", `/conversations/${chat.id}`, B)).body;
      assert.deepEqual(panel.contact, { name: "Emma W. Wilson", email: "emma.new@example.com", phone: "+442079460958" });
      assert.equal(conversation.name, "Emma W. Wilson");
      chat.socket.close();
    });

    test("every change is pushed to agents as chat:updated", async () => {
      const agent = await lc.agent();
      await agent.snapshotPromise;
      const seen = collect(agent);
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      await rest("PUT", `/conversations/${chat.id}/tags`, { ...A, body: { tags: ["x"] } });
      await sleep(200);
      const updates = seen.filter(([e, p]) => e === "chat:updated" && p.conversationId === chat.id);
      assert.ok(updates.length >= 2);
      assert.equal(updates[0][1].row.mode, "live");
      chat.socket.close();
      agent.close();
    });
  });

  describe("canned replies and suggestions", () => {
    test("the four seeded canned replies", async () => {
      const { body } = await rest("GET", "/canned-replies", A);
      assert.equal(body.agentName, "Sam");
      assert.deepEqual(body.replies.map((r) => r.title), ["Greeting", "Slot booked", "Payment confirmed", "Prescription re-sent"]);
      assert.match(body.replies[0].text, /\{agentName\}/);
    });

    test("Suggest a reply returns a draft, logs tokens on the chat and the day", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/notes`, { ...A, body: { text: "SECRET INTERNAL NOTE" } });
      await lc.call(chat.socket, "chat:message", { text: "My refill is missing" });
      const before = (await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean()).tokens.input;
      const res = await rest("POST", `/conversations/${chat.id}/suggest`, A);
      assert.equal(res.status, 200);
      assert.equal(res.body.reply, "Thanks for waiting. Let me check that for you.");
      assert.equal(lc.ai.suggestCalls.length, 1);
      assert.equal(JSON.stringify(lc.ai.suggestCalls[0]).includes("SECRET INTERNAL NOTE"), false, "notes are not given to the model");
      const after = (await lc.models.LcConversation.findOne({ conversationId: chat.id }).lean()).tokens.input;
      assert.equal(after - before, 800);
      // a suggestion is only a draft: nothing was sent to the patient
      assert.equal((await state(chat.socket)).messages.some((m) => m.text.includes("Thanks for waiting")), false);
      chat.socket.close();
    });

    test("when the AI is unavailable the agent gets a clear 503, not a crash", async () => {
      const chat = await openChat();
      lc.ai.suggestions.push({ ok: false, kind: "quota" });
      const res = await rest("POST", `/conversations/${chat.id}/suggest`, { user: AGENT_B });
      assert.deepEqual([res.status, res.body.error], [503, "ai_unavailable"]);
      chat.socket.close();
    });

    test("suggestions are rate limited per admin and respect the daily spend cap", async () => {
      const chat = await openChat();
      const who = { user: "64b000000000000000000d04" };
      const statuses = [];
      for (let i = 0; i < 11; i += 1) statuses.push((await rest("POST", `/conversations/${chat.id}/suggest`, who)).status);
      assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
      assert.equal(statuses[10], 429);

      const { dayKey } = require("../services/liveChat/limits");
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 99 } }, { upsert: true });
      lc.ai.suggestCalls.length = 0;
      const capped = await rest("POST", `/conversations/${chat.id}/suggest`, { user: "64b000000000000000000e05" });
      assert.deepEqual([capped.status, capped.body.kind], [503, "spend_cap"]);
      assert.equal(lc.ai.suggestCalls.length, 0);
      await lc.models.LcAiUsage.deleteMany({});
      chat.socket.close();
    });
  });

  describe("typing", () => {
    test("the agent who holds the chat shows 'typing' to the patient: a boolean only", async () => {
      lc.identities["token-a"] = { id: AGENT_A, role: "admin" };
      lc.identities["token-b"] = { id: AGENT_B, role: "admin" };
      const sam = await lc.agent("token-a");
      const maya = await lc.agent("token-b");
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      chat.events.length = 0;

      sam.emit("chat:typing", { conversationId: chat.id, typing: true, text: "the patient must never see this draft" });
      maya.emit("chat:typing", { conversationId: chat.id, typing: true }); // not the assignee
      await sleep(200);
      const typing = chat.events.filter(([e]) => e === "chat:typing");
      assert.equal(typing.length, 1);
      assert.deepEqual(typing[0][1], { from: "agent", typing: true, name: "Sam" });
      assert.equal(JSON.stringify(chat.events).includes("draft"), false);
      chat.socket.close();
      sam.close();
      maya.close();
    });

    test("the patient's typing reaches agents as a boolean, never the text", async () => {
      const agent = await lc.agent();
      await agent.snapshotPromise;
      const seen = collect(agent);
      const chat = await openChat();
      chat.socket.emit("chat:typing", { typing: true, text: "my chest hurts" });
      await sleep(150);
      const typing = seen.filter(([e]) => e === "chat:typing");
      assert.equal(typing.length, 1);
      assert.equal(JSON.stringify(typing).includes("chest"), false);
      chat.socket.close();
      agent.close();
    });
  });

  describe("admin-started chat (visitor with contact details)", () => {
    test("Start chat opens a live chat held by the admin; the patient sees them join", async () => {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/resolve`, A);

      const pushed = once(chat.socket, "chat:state");
      const res = await rest("POST", "/conversations/start", { ...A, body: { visitorId: chat.visitorId } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const patient = await pushed;
      assert.deepEqual([patient.mode, patient.agent.name], ["live", "Sam"]);
      assert.ok(texts(patient).includes("Sam started the chat"));

      const row = await rowIn("live", res.body.conversationId);
      assert.equal(row.assignee.name, "Sam");
      const again = await rest("POST", "/conversations/start", { ...B, body: { visitorId: chat.visitorId } });
      assert.deepEqual([again.body.existing, again.body.conversationId], [true, res.body.conversationId]);
      chat.socket.close();
    });

    test("a visitor without contact details cannot be started (that comes with the invite flow)", async () => {
      const res = await rest("POST", "/conversations/start", { ...A, body: { visitorId: "visitor-unknown-0123456789" } });
      assert.deepEqual([res.status, res.body.error], [409, "contact_required"]);
    });
  });
});
