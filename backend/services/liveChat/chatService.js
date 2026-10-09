// Live-chat conversation logic (visitor side): contact registration, starting a chat, patient messages, the quick
// options, the AI turn, and the move to the live-agent queue.
//
// Rules enforced here (docs/live-chat-brief.md, docs/live-chat-plan.md):
//   - no chat without a registered contact (the transport also requires a chat token),
//   - message text is encrypted with the live-chat key and never logged,
//   - the server decides on handoff from the AI's structured output,
//   - any AI failure (quota, cap, bad output, outage) shows the "AI unavailable" fallback and keeps live chat usable,
//   - notes (sender "note") never reach the patient.
const crypto = require("crypto");
const { encryptLiveChatText, decryptLiveChatText, hashLiveChatEmail } = require("../../utils/liveChat/crypto");
const { newVisitorId } = require("./chatToken");

const ID_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MESSAGE_PAGE = 200;

const newConversationId = () =>
  "HC" + Array.from({ length: 8 }, () => ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)]).join("");

// ── Contact validation ─────────────────────────────────────────────────────────

function validateContact({ name, email, phone } = {}) {
  const errors = {};
  const cleanName = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (cleanName.length < 2 || cleanName.length > 80 || !/\p{L}/u.test(cleanName)) {
    errors.name = "Please enter your full name.";
  }
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
    errors.email = "Please enter a valid email address.";
  }
  let cleanPhone = "";
  if (typeof phone === "string" && phone.trim()) {
    const compact = phone.replace(/[\s().-]/g, "");
    if (/^\+?\d{7,15}$/.test(compact)) cleanPhone = compact.startsWith("+") ? compact : `+${compact}`;
    else errors.phone = "Phone must be 7-15 digits including the country code, e.g. +1 302 303 9993.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, values: { name: cleanName, email: cleanEmail, phone: cleanPhone } };
}

const firstNameOf = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

// ── Support hours ──────────────────────────────────────────────────────────────

function isWithinSupportHours(settings, date = new Date()) {
  const hours = settings?.supportHours;
  if (!hours?.days?.length) return true;
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: hours.timezone || "America/New_York",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
  } catch {
    return true;
  }
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const day = get("weekday").toLowerCase();
  const hm = `${get("hour")}:${get("minute")}`;
  const config = hours.days.find((d) => d.day === day);
  if (!config || !config.enabled) return false;
  return hm >= config.open && hm < config.close;
}

function validTimeZone(value) {
  const zone = typeof value === "string" ? value.slice(0, 64) : "";
  if (!zone) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "";
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

function createChatService({
  models,
  loadSettings,
  ai,
  limits,
  presence,
  agents,
  emitToVisitor = () => {},
  emitToAgents = () => {},
  now = () => Date.now(),
  log = () => {},
}) {
  const { LcVisitor, LcConversation, LcMessage, LcPageVisit } = models;
  const locks = new Map(); // conversationId -> promise chain, so one chat handles one turn at a time
  const breaker = { until: 0, kind: "", alerted: false };

  function withLock(key, fn) {
    const previous = locks.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    locks.set(key, next);
    next.finally(() => {
      if (locks.get(key) === next) locks.delete(key);
    }).catch(() => {});
    return next;
  }

  const aiUnavailableNow = () => breaker.until > now();

  function openBreaker(kind) {
    // Quota / bad config will not fix itself in seconds; transient failures retry sooner.
    const longLived = ["quota", "config", "not_configured", "spend_cap"].includes(kind);
    breaker.until = now() + (longLived ? 10 * 60_000 : 30_000);
    breaker.kind = kind;
    if (!breaker.alerted) {
      breaker.alerted = true; // alert admins once per outage
      emitToAgents("ai:unavailable", { kind });
      console.warn(`[livechat] AI unavailable (${kind}); patients see the fallback, live chat keeps working`);
    }
  }
  const closeBreakerIfRecovered = () => {
    if (breaker.until && breaker.until <= now()) {
      breaker.until = 0;
      breaker.alerted = false;
    }
  };

  // ── Contact ──────────────────────────────────────────────────────────────────

  async function registerContact({ visitorId, name, email, phone, ip }) {
    const check = validateContact({ name, email, phone });
    if (!check.ok) return { ok: false, errors: check.errors };
    const id = VISITOR_ID_RE.test(String(visitorId || "")) ? visitorId : newVisitorId();
    const { values } = check;
    const stamp = new Date(now());
    await LcVisitor.findOneAndUpdate(
      { visitorId: id },
      {
        $set: {
          name: encryptLiveChatText(values.name),
          email: encryptLiveChatText(values.email),
          phone: encryptLiveChatText(values.phone),
          emailHash: hashLiveChatEmail(values.email),
          "consent.privacyAcceptedAt": stamp,
          lastSeenAt: stamp,
          lastIp: ip || "",
        },
        $setOnInsert: { firstSeenAt: stamp },
      },
      { upsert: true }
    );
    const record = presence.get(id);
    if (record) presence.update(id, { name: values.name });
    return { ok: true, visitorId: id, firstName: firstNameOf(values.name) };
  }

  const loadVisitor = (visitorId) => LcVisitor.findOne({ visitorId }).lean();
  const hasContact = (visitor) => Boolean(visitor?.email?.cipherText && visitor?.name?.cipherText);

  // ── Serialisation (what the widget may see) ──────────────────────────────────

  async function serialize(conv, settings) {
    const rows = await LcMessage.find({ conversationId: conv.conversationId, sender: { $ne: "note" }, internal: { $ne: true } })
      .sort({ createdAt: 1 })
      .limit(MESSAGE_PAGE)
      .lean();
    const messages = rows.map((m) => ({
      id: String(m._id),
      sender: m.sender,
      text: decryptLiveChatText(m.text),
      at: m.createdAt,
      ...(m.sender === "agent" ? { agentName: m.agentName || conv.agentName || "" } : {}),
    }));
    const canRequestAgent = conv.mode === "ai";
    return {
      conversationId: conv.conversationId,
      mode: conv.mode,
      canRequestAgent,
      optionsUsed: Boolean(conv.optionsUsed),
      options:
        conv.mode === "ai" && !conv.optionsUsed
          ? (settings.quickOptions || []).map((o) => ({ key: o.key, label: o.label, icon: o.icon }))
          : [],
      offline: Boolean(conv.offlineRequested),
      aiUnavailable: aiUnavailableNow(),
      agent: conv.mode === "live" && conv.agentName ? { name: conv.agentName } : null,
      messages,
    };
  }

  async function addMessage(conv, sender, text, extra = {}) {
    const doc = await LcMessage.create({
      conversationId: conv.conversationId,
      sender,
      text: encryptLiveChatText(text),
      ...extra,
    });
    const update = { $set: { lastMessageAt: new Date(now()) } };
    if (sender === "patient") update.$inc = { patientMessageCount: 1 };
    await LcConversation.updateOne({ _id: conv._id }, update);
    const message = {
      id: String(doc._id),
      sender,
      text,
      at: doc.createdAt,
      ...(sender === "agent" ? { agentName: extra.agentName || conv.agentName || "" } : {}),
    };
    // Internal notes and team-only lines are for agents only; they are never sent to the patient.
    if (sender !== "note" && !extra.internal) {
      emitToVisitor(conv.visitorId, "chat:message", { conversationId: conv.conversationId, message });
    }
    emitToAgents("chat:message", {
      conversationId: conv.conversationId,
      visitorId: conv.visitorId,
      name: firstNameOf(decryptLiveChatText(conv.contact?.name)),
      everLive: Boolean(conv.everLive),
      assigneeId: conv.assigneeId ? String(conv.assigneeId) : null,
      message: { ...message, internal: Boolean(extra.internal) },
    });
    return message;
  }

  async function pushState(conv) {
    const fresh = await LcConversation.findById(conv._id).lean();
    emitToVisitor(conv.visitorId, "chat:state", await serialize(fresh, await loadSettings()));
  }

  function setActivity(visitorId, conv) {
    const activity = conv.mode === "ai" ? "ai" : conv.mode === "queue" ? "waiting" : conv.mode === "live" ? "chatting" : "browsing";
    if (!presence.get(visitorId)) return;
    presence.update(visitorId, {
      activity,
      conversationId: conv.mode === "archived" ? null : conv.conversationId,
      assignedTo: conv.mode === "live" ? conv.agentName || "Agent" : conv.mode === "ai" ? "AI agent" : null,
    });
  }

  // A visitor who has a chat open is shown with their name, activity and chat in Real-time visitors, also after a
  // page reload (the tracker reconnects and finds the open chat).
  async function syncPresenceFor(visitorId) {
    if (!presence.get(visitorId)) return;
    const conv = await findOpen(visitorId);
    if (!conv) return;
    const visitor = await loadVisitor(visitorId);
    if (hasContact(visitor) && presence.get(visitorId)) presence.update(visitorId, { name: decryptLiveChatText(visitor.name) });
    setActivity(visitorId, conv);
  }

  // Page timeline, saved ONLY for visitors who chat (visitors who never chat stay in memory). Paths carry no query.
  async function recordPageVisit(conversationId, visitorId, { path, title }) {
    const last = await LcPageVisit.findOne({ conversationId }).sort({ enteredAt: -1 });
    const t = new Date(now());
    if (last && last.path === path) {
      if (title && last.title !== title) await LcPageVisit.updateOne({ _id: last._id }, { $set: { title } });
      return;
    }
    if (last) await LcPageVisit.updateOne({ _id: last._id }, { $set: { seconds: Math.max(0, Math.round((t - last.enteredAt) / 1000)) } });
    await LcPageVisit.create({ conversationId, visitorId, path, title: title || "", enteredAt: t });
  }

  async function backfillPages(conv, pages = []) {
    if (!pages.length) return;
    await LcPageVisit.insertMany(
      pages.map((p) => ({
        conversationId: conv.conversationId,
        visitorId: conv.visitorId,
        path: p.path,
        title: p.title || "",
        enteredAt: new Date(p.enteredAt),
        seconds: p.seconds || 0,
      }))
    );
  }

  // "Visits" = separate sessions: a return after 30 quiet minutes counts as a new visit.
  async function touchVisitor(visitorId) {
    const t = new Date(now());
    await LcVisitor.updateOne(
      { visitorId, lastSeenAt: { $lt: new Date(t.getTime() - 30 * 60_000) } },
      { $inc: { visits: 1 }, $set: { lastSeenAt: t } }
    );
    await LcVisitor.updateOne({ visitorId }, { $set: { lastSeenAt: t } });
  }

  // ── Resume / start ───────────────────────────────────────────────────────────

  const findOpen = (visitorId) =>
    LcConversation.findOne({ visitorId, mode: { $ne: "archived" } }).sort({ startedAt: -1 });

  async function resume(visitorId) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { ok: true, needContact: true };
    await touchVisitor(visitorId);
    const settings = await loadSettings();
    const conv = await findOpen(visitorId);
    return {
      ok: true,
      needContact: false,
      firstName: firstNameOf(decryptLiveChatText(visitor.name)),
      conversation: conv ? await serialize(conv.toObject(), settings) : null,
    };
  }

  async function startConversation(visitorId, context = {}) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { ok: false, error: "contact_required" };
    const settings = await loadSettings();
    const existing = await findOpen(visitorId);
    if (existing) return { ok: true, conversation: await serialize(existing.toObject(), settings) };

    if (!(await limits.canStartChat(context.ip))) return { ok: false, error: "chat_limit" };

    const record = presence.get(visitorId);
    const conv = await LcConversation.create({
      conversationId: newConversationId(),
      visitorId,
      mode: "ai",
      ip: context.ip || record?.ip || "",
      geo: {
        city: record?.geo?.city || context.geo?.city || "",
        state: record?.geo?.state || context.geo?.state || "",
        country: record?.geo?.country || context.geo?.country || "",
      },
      device: {
        type: record?.device || context.device?.type || "",
        os: record?.os || context.device?.os || "",
        browser: record?.browser || context.device?.browser || "",
      },
      source: record?.source || context.source || "",
      referrer: record?.referrer || context.referrer || "",
      timeZone: validTimeZone(context.timeZone),
      cookieChoice: ["accepted", "declined", "unknown"].includes(context.cookieChoice) ? context.cookieChoice : "unknown",
      startedPage: { path: record?.page?.path || context.page?.path || "", title: record?.page?.title || context.page?.title || "" },
      contact: { name: visitor.name, email: visitor.email, phone: visitor.phone },
    });
    await LcVisitor.updateOne({ visitorId }, { $inc: { chatCount: 1 } });
    await touchVisitor(visitorId);
    await backfillPages(conv, record?.pages);

    const first = firstNameOf(decryptLiveChatText(visitor.name));
    const greeting = String(settings.greeting || "").replace(/\{\s*first\s*name\s*\}/gi, first);
    await addMessage(conv, "ai", greeting);
    setActivity(visitorId, conv);
    emitToAgents("chat:new", { conversationId: conv.conversationId, visitorId, mode: "ai", everLive: false, name: first });
    const fresh = await LcConversation.findById(conv._id).lean();
    return { ok: true, conversation: await serialize(fresh, settings) };
  }

  // ── Patient messages ─────────────────────────────────────────────────────────

  async function loadOpenForMessage(visitorId) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { error: "contact_required" };
    const conv = await findOpen(visitorId);
    if (!conv) return { error: "no_conversation" };
    return { visitor, conv };
  }

  async function sendMessage(visitorId, rawText) {
    const text = limits.checkMessageText(rawText);
    if (!text.ok) return { ok: false, error: text.error };
    const loaded = await loadOpenForMessage(visitorId);
    if (loaded.error) return { ok: false, error: loaded.error };
    if (!limits.allowMessage(visitorId)) return { ok: false, error: "rate_limited" };

    // Saving the patient's message is a short step under the chat's lock...
    const saved = await withLock(loaded.conv.conversationId, async () => {
      const conv = await LcConversation.findById(loaded.conv._id);
      if (!conv || conv.mode === "archived") return null;
      await addMessage(conv, "patient", text.text);
      return conv;
    });
    if (!saved) return { ok: false, error: "no_conversation" };

    // ...the AI turn is NOT: the model can take seconds, and an admin's "Take over" must never wait for it. AI
    // turns of one chat run one after another (their own lock key); every change an AI turn makes re-checks that
    // the chat is still an AI chat (see `ifStillAi`).
    if (saved.mode === "ai") await withLock(`ai:${saved.conversationId}`, () => aiTurn(saved, loaded.visitor));
    return { ok: true };
  }

  async function aiTurn(conv, visitor) {
    const settings = await loadSettings();
    const first = firstNameOf(decryptLiveChatText(visitor.name));
    closeBreakerIfRecovered();

    // Runs `fn` under the chat's lock, but only if no admin has taken the chat over (or closed it) in the meantime.
    const ifStillAi = (fn) =>
      withLock(conv.conversationId, async () => {
        const current = await LcConversation.findById(conv._id);
        if (!current || current.mode !== "ai") return undefined;
        return fn(current);
      });

    // Admin chose "AI off", or "AI only when no agent is available" and someone is.
    if (settings.aiMode === "ai_off" || (settings.aiMode === "ai_when_no_agent" && agents.availableCount() > 0)) {
      return ifStillAi((current) => requestAgent(current, { first, settings }));
    }

    if (!limits.aiRepliesLeft(conv, settings)) {
      return ifStillAi(async (current) => {
        await addMessage(current, "ai", "I've reached my limit for this chat. Let me connect you with a live agent who can help further.");
        return requestAgent(await LcConversation.findById(current._id), { first, settings });
      });
    }

    const spend = await limits.spendStatus(settings);
    if (spend.capReached) openBreaker("spend_cap");
    if (aiUnavailableNow()) return ifStillAi((current) => aiFallback(current, { first, settings }));

    emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: true });
    let result;
    try {
      const history = (await recentHistory(conv)).map((m) => ({ role: m.sender, text: m.text }));
      result = await ai.generateReply({ settings, history });
    } catch {
      result = { ok: false, kind: "api_error" };
    }
    emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: false });

    if (result.usage) await recordUsage(conv, settings, result.usage); // the tokens were spent either way
    if (!result.ok) openBreaker(result.kind);

    // An admin may have taken the chat over while the model was thinking: such a reply is never posted.
    return ifStillAi(async (current) => {
      if (!result.ok) return aiFallback(current, { first, settings });
      const update = { $inc: { aiReplyCount: 1 } };
      if (!current.topic && result.topic) update.$set = { topic: result.topic };
      await LcConversation.updateOne({ _id: current._id }, update);
      await addMessage(current, "ai", result.reply);
      if (result.handoff) {
        await requestAgent(await LcConversation.findById(current._id), { first, settings, reason: result.handoffReason });
      }
      return undefined;
    });
  }

  async function recordUsage(conv, settings, usage) {
    await LcConversation.updateOne(
      { _id: conv._id },
      { $inc: { "tokens.input": usage.inputTokens || 0, "tokens.output": usage.outputTokens || 0 } }
    );
    await limits.recordUsage(settings, usage);
  }

  async function recentHistory(conv) {
    const rows = await LcMessage.find({ conversationId: conv.conversationId, sender: { $in: ["patient", "ai", "agent"] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return rows.reverse().map((m) => ({ sender: m.sender, text: decryptLiveChatText(m.text) }));
  }

  // "Our AI assistant is unavailable..." then hand the patient to the team (queue, or saved request if offline).
  async function aiFallback(conv, { first, settings }) {
    if (!conv.aiNoticeShown) {
      await LcConversation.updateOne({ _id: conv._id }, { $set: { aiNoticeShown: true } });
      await addMessage(conv, "system", settings.unavailableMessage);
    }
    const fresh = await LcConversation.findById(conv._id);
    return requestAgent(fresh, { first, settings, reason: "ai_unavailable" });
  }

  // ── Live agent ───────────────────────────────────────────────────────────────

  function teamAvailable(settings) {
    return isWithinSupportHours(settings, new Date(now())) && agents.availableCount() > 0;
  }

  async function requestAgent(conv, { first, settings, reason } = {}) {
    if (conv.mode === "queue" || conv.mode === "live") return { ok: true };
    const cfg = settings || (await loadSettings());
    const available = teamAvailable(cfg);
    const name = first || "there";
    await LcConversation.updateOne(
      { _id: conv._id },
      { $set: { mode: "queue", everLive: true, offlineRequested: !available, queuedAt: new Date(now()) } }
    );
    const fresh = await LcConversation.findById(conv._id);
    if (available) {
      await addMessage(fresh, "ai", `Thanks, ${name}! Connecting you with a live agent now. You can keep typing your question here.`);
    } else {
      await addMessage(fresh, "ai", cfg.offlineMessage || "Our team is offline right now. We've saved your request and will reply by email.");
    }
    setActivity(conv.visitorId, fresh);
    emitToAgents("queue:new", {
      conversationId: conv.conversationId,
      visitorId: conv.visitorId,
      name,
      everLive: true,
      offline: !available,
      reason: reason || "patient_request",
    });
    await pushState(fresh);
    return { ok: true };
  }

  // Header button.
  async function talkToAgent(visitorId) {
    const loaded = await loadOpenForMessage(visitorId);
    if (loaded.error) return { ok: false, error: loaded.error };
    return withLock(loaded.conv.conversationId, async () => {
      const conv = await LcConversation.findById(loaded.conv._id);
      if (conv.mode !== "ai") return { ok: false, error: "not_available" };
      if (!limits.allowMessage(visitorId)) return { ok: false, error: "rate_limited" };
      const settings = await loadSettings();
      const live = (settings.quickOptions || []).find((o) => o.key === "live");
      await addMessage(conv, "patient", live?.label || "Talk to a live agent");
      return requestAgent(await LcConversation.findById(conv._id), {
        first: firstNameOf(decryptLiveChatText(loaded.visitor.name)),
        settings,
      });
    });
  }

  // Quick option card: its label becomes the patient's message; the cards then disappear for good.
  async function pickOption(visitorId, key) {
    const loaded = await loadOpenForMessage(visitorId);
    if (loaded.error) return { ok: false, error: loaded.error };
    const settings = await loadSettings();
    const option = (settings.quickOptions || []).find((o) => o.key === key);
    if (!option) return { ok: false, error: "unknown_option" };

    return withLock(loaded.conv.conversationId, async () => {
      const conv = await LcConversation.findById(loaded.conv._id);
      if (conv.optionsUsed) return { ok: false, error: "options_used" };
      if (!limits.allowMessage(visitorId)) return { ok: false, error: "rate_limited" };

      await LcConversation.updateOne({ _id: conv._id }, { $set: { optionsUsed: true, ...(key !== "live" ? { topic: key } : {}) } });
      await addMessage(conv, "patient", option.label);
      const fresh = await LcConversation.findById(conv._id);

      if (key === "live") {
        await requestAgent(fresh, { first: firstNameOf(decryptLiveChatText(loaded.visitor.name)), settings });
      } else if (fresh.mode === "ai" && option.reply) {
        await addMessage(fresh, "ai", option.reply);
        await pushState(fresh);
      } else {
        await pushState(fresh);
      }
      return { ok: true };
    });
  }

  // Typing indicator for agents: a boolean only, never any text.
  function relayTyping(visitorId, typing) {
    emitToAgents("chat:typing", { visitorId, typing: typing === true });
  }

  return {
    registerContact,
    resume,
    startConversation,
    sendMessage,
    pickOption,
    talkToAgent,
    relayTyping,
    // used by the agent side (agentService) and the socket layer
    withLock,
    addMessage,
    pushState,
    setActivity,
    syncPresenceFor,
    recordPageVisit,
    serialize,
    loadVisitor,
    hasContact,
    recentHistory,
    recordUsage,
    toVisitor: (visitorId, event, payload) => emitToVisitor(visitorId, event, payload),
    toAgents: (event, payload) => emitToAgents(event, payload),
    // exposed for tests
    aiBreaker: breaker,
    teamAvailable,
  };
}

module.exports = { createChatService, validateContact, isWithinSupportHours, firstNameOf, newConversationId, validTimeZone, VISITOR_ID_RE };
