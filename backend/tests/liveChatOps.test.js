const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer, sleep, dayKey, AGENT_A, AGENT_B } = require("./helpers/liveChatServer");

const UNAVAILABLE = "Our AI assistant is unavailable right now. Talk to a live agent or leave a message and we'll email you.";

async function waitFor(fn, ms = 4000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

describe("live chat: rating, offline mode + email, AI outage, agent offline, visitor left, invites", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100", LIVECHAT_UPLOADS_PER_10_MIN: "50" },
    });
    lc.agentNames[AGENT_A] = "Sam";
    lc.agentNames[AGENT_B] = "Maya";
  });
  after(async () => {
    await lc.close();
  });
  beforeEach(() => {
    lc.ai.calls.length = 0;
    lc.ai.queue.length = 0;
    lc.emails.length = 0;
    lc.failures.mail = false;
    const breaker = lc.livechat.chat.aiBreaker;
    breaker.until = 0;
    breaker.alerted = false;
  });

  const rest = (...args) => lc.rest(...args);
  const A = { user: AGENT_A };
  const B = { user: AGENT_B };
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const texts = (state) => state.messages.map((m) => m.text);
  const convOf = (id) => lc.models.LcConversation.findOne({ conversationId: id }).lean();
  const rowIn = async (view, id) => (await rest("GET", `/conversations?view=${view}`)).body.conversations.find((c) => c.conversationId === id);

  async function openChat(extra = {}, socketAuth = {}) {
    const contact = await lc.submitContact(extra);
    const socket = await lc.chatSocket(contact.token, socketAuth);
    const started = await lc.call(socket, "chat:start", { tz: "America/Chicago" });
    return { socket, contact, token: contact.token, id: started.conversation.conversationId, visitorId: contact.visitorId };
  }

  // A signed-in agent who is online (so the team counts as available).
  const sockets = [];
  async function agentOnline(userId, role = "admin") {
    const token = `tok-${userId}`;
    lc.identities[token] = { id: userId, role };
    const socket = await lc.agent(token);
    await socket.snapshotPromise;
    await lc.call(socket, "agent:status", { online: true });
    sockets.push(socket);
    return { socket, token };
  }
  const setGrace = (seconds) => lc.setSettings({ "handoffRules.agentOfflineGraceSeconds": seconds });

  // ── Rating ────────────────────────────────────────────────────────────────────

  describe("rating after Resolve", () => {
    async function resolvedChat() {
      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      await rest("POST", `/conversations/${chat.id}/resolve`, A);
      return chat;
    }

    test("the patient rates 1-5 stars once; admins see it; the team-only line stays hidden from the patient", async () => {
      const chat = await resolvedChat();
      const state = await stateOf(chat.socket);
      assert.deepEqual([state.mode, state.canRate, state.rating], ["archived", true, null]);

      const res = await lc.call(chat.socket, "chat:rate", { stars: 4 });
      assert.deepEqual(res, { ok: true });

      const conv = await convOf(chat.id);
      assert.equal(conv.rating.stars, 4);
      assert.ok(conv.rating.ratedAt);
      assert.equal((await rowIn("live", chat.id)).rating, 4);
      const detail = (await rest("GET", `/conversations/${chat.id}`, B)).body;
      assert.equal(detail.panel.info.rating.stars, 4);
      assert.ok(detail.messages.some((m) => m.internal && m.text === "Patient rated the chat 4★"));

      const patient = await lc.call(chat.socket, "chat:resume");
      assert.equal(patient.conversation, null, "a rated chat is done; the widget offers a new chat");
      chat.socket.close();
    });

    test("only once, and only 1 to 5", async () => {
      const chat = await resolvedChat();
      for (const bad of [0, 6, -1, 2.5, "abc", null, undefined, {}]) {
        const res = await lc.call(chat.socket, "chat:rate", { stars: bad });
        assert.deepEqual([res.ok, res.error], [false, "invalid_rating"], String(bad));
      }
      assert.equal((await lc.call(chat.socket, "chat:rate", { stars: 5 })).ok, true);
      const again = await lc.call(chat.socket, "chat:rate", { stars: 1 });
      assert.deepEqual([again.ok, again.error], [false, "nothing_to_rate"]);
      assert.equal((await convOf(chat.id)).rating.stars, 5, "the first rating stands");
      chat.socket.close();
    });

    test("a chat that is still open, or was resolved more than a day ago, cannot be rated", async () => {
      const open = await openChat();
      assert.equal((await lc.call(open.socket, "chat:rate", { stars: 5 })).error, "nothing_to_rate");

      const old = await resolvedChat();
      await lc.models.LcConversation.updateOne({ conversationId: old.id }, { $set: { closedAt: new Date(Date.now() - 25 * 3600_000) } });
      assert.equal((await lc.call(old.socket, "chat:rate", { stars: 5 })).error, "nothing_to_rate");
      open.socket.close();
      old.socket.close();
    });

    test("the patient can still rate after moving to another page (a new connection)", async () => {
      const chat = await resolvedChat();
      chat.socket.close();
      const later = await lc.chatSocket(chat.token);
      const state = await stateOf(later);
      assert.equal(state.canRate, true);
      assert.equal((await lc.call(later, "chat:rate", { stars: 3 })).ok, true);
      later.close();
    });

    test("a visitor cannot rate someone else's chat", async () => {
      const mine = await resolvedChat();
      const other = await openChat();
      assert.equal((await lc.call(other.socket, "chat:rate", { stars: 1 })).error, "nothing_to_rate");
      assert.equal((await convOf(mine.id)).rating.stars, null);
      mine.socket.close();
      other.socket.close();
    });
  });

  // ── Offline mode and the follow-up email ──────────────────────────────────────

  describe("offline mode and the follow-up email", () => {
    test("no agent online: the patient is told, the request is saved, ONE email goes to their own address", async () => {
      const chat = await openChat({ name: "Priya Raman", email: "priya@example.com" });
      await lc.call(chat.socket, "chat:message", { text: "I need a sick note for my back pain" });
      await lc.call(chat.socket, "chat:agent");

      const state = await stateOf(chat.socket);
      assert.deepEqual([state.mode, state.offline], ["queue", true]);
      assert.equal(state.messages.at(-1).text, "Thanks, Priya! We've received your question and details. Our team will get back to you at priya@example.com shortly.");

      assert.ok(await waitFor(() => lc.emails.length === 1), "one email was sent");
      const mail = lc.emails[0];
      assert.equal(mail.to, "priya@example.com");
      assert.equal(mail.subject, "We received your message – Humancare Connect");
      assert.ok(mail.body.startsWith("Hi Priya,"));
      assert.ok(mail.body.includes(`reference ${chat.id}`));
      assert.equal((await convOf(chat.id)).followUp.status, "sent");

      // asking again, or another trigger, never sends a second email for this chat
      await lc.call(chat.socket, "chat:message", { text: "hello?" });
      await sleep(150);
      assert.equal(lc.emails.length, 1);
      chat.socket.close();
    });

    test("the email contains NO health details: no message text, topic, option label or file name", async () => {
      const chat = await openChat({ name: "Priya Raman", email: "priya2@example.com" });
      await lc.call(chat.socket, "chat:option", { key: "sick_notes" }); // topic: Sick Notes
      await lc.call(chat.socket, "chat:message", { text: "Persistent migraine and I take sumatriptan" });
      await lc.call(chat.socket, "chat:agent");
      await waitFor(() => lc.emails.length === 1);
      const body = `${lc.emails[0].subject}\n${lc.emails[0].body}`.toLowerCase();
      for (const forbidden of ["migraine", "sumatriptan", "sick note", "prescription", "consultation", "second opinion", "medical advice", "refill", "topic"]) {
        assert.equal(body.includes(forbidden), false, forbidden);
      }
      assert.ok(body.includes("don't include medical details"));
      chat.socket.close();
    });

    test("the email never mentions support hours or the team being offline, whatever the settings say", async () => {
      const settings = await lc.models.LcSettings.findOne({ key: "default" }).lean();
      const original = settings.supportHours;
      const day = (name, enabled, open, close) => ({ day: name, enabled, open, close });
      try {
        await lc.setSettings({
          supportHours: {
            timezone: "America/Chicago",
            days: [
              day("sunday", false, "08:00", "22:00"), day("monday", true, "09:00", "17:00"), day("tuesday", true, "09:00", "17:00"),
              day("wednesday", true, "09:00", "17:00"), day("thursday", true, "09:00", "17:00"), day("friday", true, "09:00", "17:00"),
              day("saturday", true, "10:00", "14:00"),
            ],
          },
        });
        // closed right now or not, nobody is online, so this is an offline request
        const chat = await openChat({ email: "hours1@example.com" });
        await lc.call(chat.socket, "chat:agent");
        await waitFor(() => lc.emails.length === 1);
        const noHours = (body) => {
          assert.doesNotMatch(body, /\d{1,2}:\d{2}/, "no opening hours");
          assert.doesNotMatch(body, /offline|support hours|every day/i);
          assert.ok(body.includes("We received your message") && body.includes("will get back to you soon"));
        };
        noHours(lc.emails[0].body);

        lc.emails.length = 0;
        await lc.setSettings({ supportHours: { timezone: "Asia/Kolkata", days: original.days.map((d) => ({ ...d, open: "06:30", close: "20:15", enabled: true })) } });
        const second = await openChat({ email: "hours2@example.com" });
        await lc.call(second.socket, "chat:agent");
        await waitFor(() => lc.emails.length === 1);
        noHours(lc.emails[0].body);
        chat.socket.close();
        second.socket.close();
      } finally {
        await lc.setSettings({ supportHours: original });
      }
    });

    test("outside support hours counts as offline even with an agent online", async () => {
      const settings = await lc.models.LcSettings.findOne({ key: "default" }).lean();
      const original = settings.supportHours;
      const { socket } = await agentOnline(AGENT_A);
      try {
        await lc.setSettings({ supportHours: { ...original, days: original.days.map((d) => ({ ...d, enabled: false })) } });
        const chat = await openChat({ email: "closed@example.com" });
        await lc.call(chat.socket, "chat:agent");
        assert.equal((await stateOf(chat.socket)).offline, true);
        assert.ok(await waitFor(() => lc.emails.length === 1));
        chat.socket.close();
      } finally {
        await lc.setSettings({ supportHours: original });
        socket.close();
      }
    });

    test("with an agent online and inside hours there is no email", async () => {
      const { socket } = await agentOnline(AGENT_A);
      const chat = await openChat({ email: "open@example.com" });
      await lc.call(chat.socket, "chat:agent");
      assert.equal((await stateOf(chat.socket)).offline, false);
      await sleep(200);
      assert.equal(lc.emails.length, 0);
      chat.socket.close();
      socket.close();
    });

    test("a failing mail server never breaks the chat, and its error (with the address) is not logged", async () => {
      lc.failures.mail = true;
      const logged = [];
      const original = console.error;
      console.error = (...args) => logged.push(args.join(" "));
      try {
        const chat = await openChat({ email: "fail@example.com" });
        const res = await lc.call(chat.socket, "chat:agent");
        assert.equal(res.ok, true);
        assert.equal((await stateOf(chat.socket)).mode, "queue");
        assert.ok(await waitFor(async () => (await convOf(chat.id)).followUp.status === "failed"));
        assert.equal(logged.join("\n").includes("fail@example.com"), false);
        assert.ok(logged.some((l) => l.includes("follow-up email failed")));
        chat.socket.close();
      } finally {
        console.error = original;
      }
    });

    test("two triggers at the same moment still send one email", async () => {
      const chat = await openChat({ email: "double@example.com" });
      const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id });
      const results = await Promise.all([lc.livechat.followUp.send(conv), lc.livechat.followUp.send(conv)]);
      assert.deepEqual(results.map((r) => r.sent).sort(), [false, true]);
      assert.equal(lc.emails.length, 1);
      chat.socket.close();
    });

    test("a chat without an email address is skipped", async () => {
      const chat = await openChat();
      await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { "contact.email": { cipherText: "", iv: "", authTag: "", keyVersion: "" } } });
      const conv = await lc.models.LcConversation.findOne({ conversationId: chat.id });
      assert.deepEqual(await lc.livechat.followUp.send(conv), { sent: false, reason: "no_email" });
      assert.equal(lc.emails.length, 0);
      chat.socket.close();
    });
  });

  // ── AI unavailable ────────────────────────────────────────────────────────────

  describe("AI unavailable", () => {
    const KINDS = ["quota", "config", "not_configured", "timeout", "unavailable", "rate_limited", "incomplete", "invalid", "api_error"];

    test("every kind of model failure shows the same friendly notice, never an error, and alerts admins ONCE", async () => {
      const admin = await lc.agent("admin-token");
      await admin.snapshotPromise;
      for (const kind of KINDS) {
        const breaker = lc.livechat.chat.aiBreaker;
        breaker.until = 0;
        breaker.alerted = false;
        admin.events.length = 0;
        lc.ai.queue.push({ ok: false, kind });

        const first = await openChat();
        const res = await lc.call(first.socket, "chat:message", { text: "Can I get a refill?" });
        assert.equal(res.ok, true, `${kind}: the patient gets no error`);
        const state = await stateOf(first.socket);
        assert.ok(texts(state).includes(UNAVAILABLE), kind);
        assert.equal(state.aiUnavailable, true, kind);
        assert.equal(state.mode, "queue", `${kind}: live chat / leave-a-message keeps working`);
        assert.equal(JSON.stringify(state).toLowerCase().match(/quota|openai|api key|exception|stack|timeout|rate.?limit/), null, kind);

        // a second and third patient during the same outage: no model call, no further alert
        const calls = lc.ai.calls.length;
        const second = await openChat();
        await lc.call(second.socket, "chat:message", { text: "hello" });
        await lc.call(second.socket, "chat:message", { text: "anyone?" });
        assert.equal(lc.ai.calls.length, calls, `${kind}: the model is not called again during the outage`);
        await sleep(80);
        const alerts = admin.events.filter(([e]) => e === "ai:unavailable");
        assert.equal(alerts.length, 1, `${kind}: exactly one admin alert`);
        assert.equal(alerts[0][1].kind, kind);
        first.socket.close();
        second.socket.close();
      }
      admin.close();
    });

    test("daily spend cap reached: same notice, no model call, one alert, live chat still works", async () => {
      const admin = await lc.agent("admin-token");
      await admin.snapshotPromise;
      await lc.models.LcAiUsage.updateOne({ day: dayKey() }, { $set: { costUsd: 99 } }, { upsert: true });
      const online = await agentOnline(AGENT_A);

      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "What is the price?" });
      assert.equal(lc.ai.calls.length, 0);
      const state = await stateOf(chat.socket);
      assert.ok(texts(state).includes(UNAVAILABLE));
      assert.equal(state.mode, "queue");
      const other = await openChat();
      await lc.call(other.socket, "chat:message", { text: "hi" });
      await sleep(80);
      const alerts = admin.events.filter(([e, p]) => e === "ai:unavailable" && p.kind === "spend_cap");
      assert.equal(alerts.length, 1);

      // an agent takes the chat and talks to the patient normally
      assert.equal((await rest("POST", `/conversations/${chat.id}/messages`, { ...A, body: { text: "Hi, Sam here." } })).status, 200);
      await lc.call(chat.socket, "chat:message", { text: "Thanks Sam" });
      assert.equal(lc.ai.calls.length, 0, "the patient talks to the agent, not the AI");
      assert.ok(texts(await stateOf(chat.socket)).includes("Hi, Sam here."));

      await lc.models.LcAiUsage.deleteMany({});
      chat.socket.close();
      other.socket.close();
      admin.close();
      online.socket.close();
    });

    test("when the outage is over a new chat gets AI answers again", async () => {
      lc.ai.queue.push({ ok: false, kind: "quota" });
      const down = await openChat();
      await lc.call(down.socket, "chat:message", { text: "hello" });
      lc.livechat.chat.aiBreaker.until = 0; // credits topped up / outage over
      lc.livechat.chat.aiBreaker.alerted = false;
      const fresh = await openChat();
      await lc.call(fresh.socket, "chat:message", { text: "How much is a consultation?" });
      const state = await stateOf(fresh.socket);
      assert.equal(state.mode, "ai");
      assert.ok(texts(state).includes("A general consultation is $49."));
      assert.equal(state.aiUnavailable, false);
      down.socket.close();
      fresh.socket.close();
    });
  });

  // ── Agent goes offline ────────────────────────────────────────────────────────

  describe("agent goes offline or logs out", () => {
    async function liveChatHeldBy(userId, extra = {}) {
      const chat = await openChat(extra);
      assert.equal((await rest("POST", `/conversations/${chat.id}/takeover`, { user: userId })).status, 200);
      return chat;
    }

    test("when Sam's last connection closes, his chat goes back to the Queue after the grace period", async () => {
      await setGrace(0.3);
      const sam = await agentOnline(AGENT_A);
      const maya = await agentOnline(AGENT_B);
      const chat = await liveChatHeldBy(AGENT_A);
      const mayaEvents = maya.socket.events;
      mayaEvents.length = 0;

      sam.socket.close();
      assert.equal((await convOf(chat.id)).mode, "live", "not at once: there is a grace period");
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "queue", 3000), "returned to the queue");

      const conv = await convOf(chat.id);
      assert.deepEqual([conv.assigneeId, conv.agentName, conv.offlineRequested], [null, "", false]);
      assert.ok(conv.queuedAt);
      const patient = await stateOf(chat.socket);
      assert.equal(patient.mode, "queue");
      assert.equal(patient.agent, null);
      assert.ok(texts(patient).includes("Your agent is no longer available. We're reconnecting you with another agent…"));
      assert.equal(texts(patient).some((t) => t.includes("went offline")), false, "the team-only line is hidden from the patient");

      const detail = (await rest("GET", `/conversations/${chat.id}`, B)).body;
      assert.ok(detail.messages.some((m) => m.internal && m.text === "Sam went offline. The chat is back in the queue."));
      assert.ok(mayaEvents.some(([e, p]) => e === "queue:new" && p.conversationId === chat.id && p.reason === "agent_offline"));
      assert.equal((await rowIn("live", chat.id)).mode, "queue");
      assert.equal(lc.emails.length, 0, "another agent is online: no email");
      chat.socket.close();
      maya.socket.close();
    });

    test("coming back in time cancels it", async () => {
      await setGrace(0.8);
      const sam = await agentOnline(AGENT_A);
      const chat = await liveChatHeldBy(AGENT_A);
      sam.socket.close();
      await sleep(200);
      const back = await agentOnline(AGENT_A);
      await sleep(1200);
      const conv = await convOf(chat.id);
      assert.deepEqual([conv.mode, String(conv.assigneeId)], ["live", AGENT_A]);
      chat.socket.close();
      back.socket.close();
    });

    test("switching to Offline starts the same countdown", async () => {
      await setGrace(0.3);
      const sam = await agentOnline(AGENT_A);
      const maya = await agentOnline(AGENT_B);
      const chat = await liveChatHeldBy(AGENT_A);
      await lc.call(sam.socket, "agent:status", { online: false });
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "queue", 3000));
      chat.socket.close();
      sam.socket.close();
      maya.socket.close();
    });

    test("a logged-out (revoked) session is noticed without any event, and the chat is requeued", async () => {
      await setGrace(0.3);
      const sam = await agentOnline(AGENT_A);
      const maya = await agentOnline(AGENT_B);
      const chat = await liveChatHeldBy(AGENT_A);
      const dropped = new Promise((resolve) => sam.socket.once("disconnect", resolve));
      delete lc.identities[sam.token]; // logout: the session no longer validates
      await dropped; // the periodic check drops the socket
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "queue", 3000));
      chat.socket.close();
      maya.socket.close();
    });

    test("nobody else online: the patient gets the thank-you text (never the word offline) and one email is sent", async () => {
      await setGrace(0.3);
      const sam = await agentOnline(AGENT_A);
      const chat = await liveChatHeldBy(AGENT_A, { email: "left-alone@example.com" });
      sam.socket.close();
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "queue", 3000));
      const conv = await convOf(chat.id);
      assert.equal(conv.offlineRequested, true);
      assert.ok(texts(await stateOf(chat.socket)).some((t) => t.includes("We've received your question and details")));
      assert.equal(texts(await stateOf(chat.socket)).some((t) => /offline/i.test(t)), false, "the patient is never told the team is offline");
      assert.ok(await waitFor(() => lc.emails.length === 1));
      assert.equal(lc.emails[0].to, "left-alone@example.com");
      chat.socket.close();
    });

    test("other agents' chats, AI chats and finished chats are left alone", async () => {
      await setGrace(0.2);
      const sam = await agentOnline(AGENT_A);
      const maya = await agentOnline(AGENT_B);
      const mine = await liveChatHeldBy(AGENT_A);
      const hers = await liveChatHeldBy(AGENT_B);
      const ai = await openChat();
      const done = await liveChatHeldBy(AGENT_A);
      await rest("POST", `/conversations/${done.id}/resolve`, A);
      sam.socket.close();
      assert.ok(await waitFor(async () => (await convOf(mine.id)).mode === "queue", 3000));
      await sleep(200);
      assert.equal((await convOf(hers.id)).mode, "live");
      assert.equal((await convOf(ai.id)).mode, "ai");
      assert.equal((await convOf(done.id)).mode, "archived");
      for (const c of [mine, hers, ai, done]) c.socket.close();
      maya.socket.close();
    });
  });

  // ── Visitor left ──────────────────────────────────────────────────────────────

  describe("visitor left", () => {
    test("about 30 s (here 0.25 s) after the last connection closes, an open chat is archived as 'patient left'", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:message", { text: "hello" });
      chat.socket.close();
      await sleep(100);
      assert.equal((await convOf(chat.id)).mode, "ai", "not yet");
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "archived", 2500));

      const conv = await convOf(chat.id);
      assert.deepEqual([conv.closedReason, conv.modeBeforeLeft], ["patient_left", "ai"]);
      assert.ok(conv.leftAt && conv.closedAt);
      const row = await rowIn("ai", chat.id);
      assert.deepEqual([row.mode, row.closedReason], ["archived", "patient_left"]);
      const detail = (await rest("GET", `/conversations/${chat.id}`)).body;
      assert.ok(detail.messages.some((m) => m.internal && m.text === "Patient left the website"));
    });

    test("reconnecting inside the grace period (a page change) keeps the chat open", async () => {
      const chat = await openChat();
      chat.socket.close();
      await sleep(80);
      const next = await lc.chatSocket(chat.token);
      await sleep(600);
      assert.equal((await convOf(chat.id)).mode, "ai");
      next.close();
    });

    test("a chat socket and a tracker count together: the visitor has left only when both are gone", async () => {
      const chat = await openChat({}, { consent: true });
      const tracker = await lc.trackerSocket(chat.visitorId);
      chat.socket.close();
      await sleep(600);
      assert.equal((await convOf(chat.id)).mode, "ai", "the tracker is still connected");
      tracker.close();
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "archived", 2500));
    });

    test("an offline request is NOT archived when the visitor leaves: they asked for an email reply", async () => {
      const chat = await openChat();
      await lc.call(chat.socket, "chat:agent"); // no agent online
      assert.equal((await convOf(chat.id)).offlineRequested, true);
      chat.socket.close();
      await sleep(700);
      assert.equal((await convOf(chat.id)).mode, "queue");
    });

    test("a returning visitor within 24 hours continues the same AI chat", async () => {
      const chat = await openChat({ name: "Emma Wilson" });
      await lc.call(chat.socket, "chat:message", { text: "How much is a refill?" });
      chat.socket.close();
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "archived", 2500));

      const back = await lc.chatSocket(chat.token);
      const resumed = await lc.call(back, "chat:resume");
      assert.equal(resumed.needContact, false, "recognised: no form");
      assert.equal(resumed.conversation.conversationId, chat.id);
      assert.equal(resumed.conversation.mode, "ai");
      assert.ok(texts(resumed.conversation).includes("How much is a refill?"), "the earlier messages are still there");
      assert.ok(texts(resumed.conversation).includes("Welcome back, Emma!"));
      const conv = await convOf(chat.id);
      assert.deepEqual([conv.closedReason, conv.leftAt, conv.modeBeforeLeft], ["", null, ""]);
      assert.equal((await rowIn("ai", chat.id)).mode, "ai");
      back.close();
    });

    test("a chat that had an agent returns to the Queue when the visitor comes back", async () => {
      const agent = await agentOnline(AGENT_B);
      const chat = await openChat({ name: "Emma Wilson" });
      await rest("POST", `/conversations/${chat.id}/takeover`, A);
      chat.socket.close();
      assert.ok(await waitFor(async () => (await convOf(chat.id)).mode === "archived", 2500));
      assert.equal((await convOf(chat.id)).modeBeforeLeft, "live");
      agent.socket.events.length = 0;

      const back = await lc.chatSocket(chat.token);
      const resumed = (await lc.call(back, "chat:resume")).conversation;
      assert.equal(resumed.mode, "queue");
      assert.equal(resumed.agent, null);
      assert.ok(texts(resumed).includes("Welcome back, Emma! We're reconnecting you with an agent."));
      const conv = await convOf(chat.id);
      assert.deepEqual([conv.assigneeId, conv.agentName], [null, ""]);
      await sleep(100);
      assert.ok(agent.socket.events.some(([e, p]) => e === "queue:new" && p.reason === "returned"));
      assert.ok(agent.socket.events.some(([e]) => e === "chat:reopened"));
      back.close();
      agent.socket.close();
    });

    test("after more than 24 hours it is not reopened; a resolved chat is never reopened", async () => {
      const stale = await openChat();
      stale.socket.close();
      assert.ok(await waitFor(async () => (await convOf(stale.id)).mode === "archived", 2500));
      await lc.models.LcConversation.updateOne({ conversationId: stale.id }, { $set: { leftAt: new Date(Date.now() - 25 * 3600_000) } });
      const back = await lc.chatSocket(stale.token);
      assert.equal((await stateOf(back)), null, "too late: nothing to continue");
      const fresh = await lc.call(back, "chat:start", {});
      assert.notEqual(fresh.conversation.conversationId, stale.id);
      assert.equal((await convOf(stale.id)).mode, "archived");

      const resolved = await openChat();
      await rest("POST", `/conversations/${resolved.id}/resolve`, A);
      resolved.socket.close();
      await sleep(600);
      const again = await lc.chatSocket(resolved.token);
      const state = await stateOf(again);
      assert.equal(state.mode, "archived", "a resolved chat stays resolved (the patient can still rate it)");
      assert.equal((await convOf(resolved.id)).closedReason, "resolved");
      back.close();
      again.close();
    });
  });

  // ── Admin-started chat with a new visitor ─────────────────────────────────────

  describe("admin-started chat with a brand-new visitor", () => {
    const newVisitor = () => `invite-visitor-${Math.random().toString(36).slice(2, 12)}`;

    test("the bubble carries only the agent's name; the text and the chat open after the contact form", async () => {
      const vid = newVisitor();
      const tracker = await lc.trackerSocket(vid);
      await waitFor(() => lc.livechat.presence.get(vid));

      const start = await rest("POST", "/conversations/start", { ...A, body: { visitorId: vid } });
      assert.equal(start.status, 200, JSON.stringify(start.body));
      assert.equal(start.body.invited, true);
      const id = start.body.conversationId;

      const record = lc.livechat.presence.get(vid);
      assert.deepEqual([record.activity, record.assignedTo], ["invited", "Sam"]);
      const row = await rowIn("live", id);
      assert.deepEqual([row.invited, row.name, row.mode, row.assignee.name], [true, "", "live", "Sam"]);
      await sleep(150);
      assert.equal(tracker.events.some(([e]) => e === "chat:invite"), false, "no bubble until the admin writes something");

      const text = "Hi! I'm Sam from Humancare. Are you looking for a prescription refill?";
      assert.equal((await rest("POST", `/conversations/${id}/messages`, { ...A, body: { text } })).status, 200);
      assert.ok(await waitFor(() => tracker.events.some(([e]) => e === "chat:invite")));
      const invite = tracker.events.find(([e]) => e === "chat:invite")[1];
      assert.deepEqual(invite, { conversationId: id, agentName: "Sam" });
      assert.equal(JSON.stringify(tracker.events).includes("prescription refill"), false, "the message text never goes to the bubble");

      // a page reload shows the bubble again
      const reloaded = await lc.trackerSocket(vid);
      assert.ok(await waitFor(() => reloaded.events.some(([e]) => e === "chat:invite")));

      // the visitor fills in the contact form (same visitor id): the chat is theirs, and now they can read it
      const contact = await lc.submitContact({ visitorId: vid, name: "Noah Davis", email: "noah@example.com" });
      assert.equal(contact.visitorId, vid);
      const chat = await lc.chatSocket(contact.token);
      const resumed = (await lc.call(chat, "chat:resume")).conversation;
      assert.equal(resumed.conversationId, id);
      assert.ok(texts(resumed).includes(text), "the text is revealed after the form");
      assert.ok(texts(resumed).includes("Sam started the chat"));
      assert.equal((await rest("GET", `/conversations/${id}`, B)).body.panel.contact.name, "Noah Davis");

      // the visitor replies: no longer "invited", and the AI does not answer an agent's chat
      lc.ai.calls.length = 0;
      await lc.call(chat, "chat:message", { text: "Yes please" });
      assert.equal((await convOf(id)).invited, false);
      assert.equal(lc.livechat.presence.get(vid).activity, "chatting");
      assert.equal(lc.ai.calls.length, 0);
      assert.equal((await rowIn("live", id)).invited, false);
      tracker.close();
      reloaded.close();
      chat.close();
    });

    test("agents are told the moment the visitor answers (the 'Invited' tag goes away everywhere)", async () => {
      const vid = newVisitor();
      const tracker = await lc.trackerSocket(vid);
      await waitFor(() => lc.livechat.presence.get(vid));
      const start = await rest("POST", "/conversations/start", { ...A, body: { visitorId: vid } });
      const id = start.body.conversationId;
      await rest("POST", `/conversations/${id}/messages`, { ...A, body: { text: "Hello!" } });
      const contact = await lc.submitContact({ visitorId: vid });
      const chat = await lc.chatSocket(contact.token);
      const admin = await lc.agent("admin-token");
      await admin.snapshotPromise;
      admin.events.length = 0;
      await lc.call(chat, "chat:message", { text: "Hi" });
      await sleep(150);
      const update = admin.events.find(([e, p]) => e === "chat:updated" && p.conversationId === id);
      assert.ok(update, "a chat:updated event reached the agents");
      assert.equal(update[1].row.invited, false);
      tracker.close();
      chat.close();
      admin.close();
    });

    test("a visitor who is not on the site cannot be started; a second Start returns the same chat", async () => {
      const none = await rest("POST", "/conversations/start", { ...A, body: { visitorId: "visitor-not-on-the-site-1234" } });
      assert.deepEqual([none.status, none.body.error], [409, "contact_required"]);

      const vid = newVisitor();
      const tracker = await lc.trackerSocket(vid);
      await waitFor(() => lc.livechat.presence.get(vid));
      const first = await rest("POST", "/conversations/start", { ...A, body: { visitorId: vid } });
      const second = await rest("POST", "/conversations/start", { ...B, body: { visitorId: vid } });
      assert.deepEqual([second.body.existing, second.body.conversationId], [true, first.body.conversationId]);
      tracker.close();
    });

    test("an invite the visitor never answers is archived as 'patient left' when they leave", async () => {
      const vid = newVisitor();
      const tracker = await lc.trackerSocket(vid);
      await waitFor(() => lc.livechat.presence.get(vid));
      const start = await rest("POST", "/conversations/start", { ...A, body: { visitorId: vid } });
      tracker.close();
      assert.ok(await waitFor(async () => (await convOf(start.body.conversationId)).mode === "archived", 2500));
      assert.equal((await convOf(start.body.conversationId)).closedReason, "patient_left");
    });

    test("a returning visitor who already has contact details is invited too (no form needed)", async () => {
      const chat = await openChat({ name: "Sophia Martinez" }, { consent: true });
      await rest("POST", `/conversations/${chat.id}/resolve`, A);
      const tracker = await lc.trackerSocket(chat.visitorId);
      const start = await rest("POST", "/conversations/start", { ...A, body: { visitorId: chat.visitorId } });
      assert.equal(start.body.invited, false, "contact details are already known");
      await rest("POST", `/conversations/${start.body.conversationId}/messages`, { ...A, body: { text: "Hello again" } });
      assert.ok(await waitFor(() => tracker.events.some(([e]) => e === "chat:invite")));
      const state = (await lc.call(chat.socket, "chat:resume")).conversation;
      assert.equal(state.conversationId, start.body.conversationId);
      assert.ok(texts(state).includes("Hello again"));
      tracker.close();
      chat.socket.close();
    });
  });
});
