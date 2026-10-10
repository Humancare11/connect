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
const { DEFAULT_SETTINGS } = require("./settingsDefaults");
const { tooShortToTell, looksEnglish } = require("./languageHints");

const DEFAULT_NO_AGENT_TEXT = DEFAULT_SETTINGS.offlineMessage;

const ID_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MESSAGE_PAGE = 200;
const OFF_TOPIC_REMINDER_AT = 3; // consecutive off-topic messages before the patient is reminded of the button
const OFF_TOPIC_REMINDER = 'If you need a person, you can tap "Talk to live agent" at any time.';
const UNANSWERED_HANDOFF_AT = 2; // consecutive "could not answer" replies before the chat goes to an agent

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

// Overnight shifts, "always on" and labels live in supportHours.js (shared with the Team page).
const { isWithinSupportHours } = require("./supportHours");

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
  emitToTrackers = () => {}, // the visitor's tracking sockets (used for the "an agent wrote to you" bubble)
  announce = () => {}, // tells agents a conversation changed (agentService builds the list row)
  followUp = null, // offline follow-up email ({ send(conv) })
  abuse = null, // abuse alerts ({ noteChat, noteDailyLimit })
  sitePages = require("./sitePages").createSitePages(), // the pages the AI may link to (allowlist)
  detectLanguage = null, // (conv, text) => Promise: one small model call when no AI turn has found the language
  leaveGraceMs = 30_000, // a visitor with no connection for this long has left
  now = () => Date.now(),
  log = () => {},
}) {
  const { LcVisitor, LcConversation, LcMessage, LcPageVisit, LcFile } = models;
  let detector = detectLanguage;
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
    const enc = {
      name: encryptLiveChatText(values.name),
      email: encryptLiveChatText(values.email),
      phone: encryptLiveChatText(values.phone),
    };
    await LcVisitor.findOneAndUpdate(
      { visitorId: id },
      {
        $set: {
          ...enc,
          emailHash: hashLiveChatEmail(values.email),
          lastSeenAt: stamp,
          lastIp: ip || "",
        },
        $setOnInsert: { firstSeenAt: stamp },
      },
      { upsert: true }
    );
    // A chat an admin started (invite) has no contact yet: the visitor's details now belong to it.
    await LcConversation.updateMany(
      { visitorId: id, mode: { $ne: "archived" }, "contact.email.cipherText": "" },
      { $set: { contact: enc } }
    );
    const record = presence.get(id);
    if (record) presence.update(id, { name: values.name });
    return { ok: true, visitorId: id, firstName: firstNameOf(values.name) };
  }

  const loadVisitor = (visitorId) => LcVisitor.findOne({ visitorId }).lean();
  const hasContact = (visitor) => Boolean(visitor?.email?.cipherText && visitor?.name?.cipherText);

  // ── Serialisation (what the widget may see) ──────────────────────────────────

  // { fileId -> { id, name, mime, size } } for the file messages in a list of message rows.
  async function filesMeta(rows) {
    const ids = rows.map((m) => m.fileId).filter(Boolean);
    if (!ids.length || !LcFile) return new Map();
    const docs = await LcFile.find({ _id: { $in: ids } }).lean();
    return new Map(docs.map((d) => [String(d._id), { id: String(d._id), name: decryptLiveChatText(d.name), mime: d.mimeType, size: d.size }]));
  }

  async function serialize(conv, settings) {
    const rows = await LcMessage.find({ conversationId: conv.conversationId, sender: { $ne: "note" }, internal: { $ne: true } })
      .sort({ createdAt: 1 })
      .limit(MESSAGE_PAGE)
      .lean();
    const files = await filesMeta(rows);
    const messages = rows.map((m) => ({
      id: String(m._id),
      sender: m.sender,
      text: decryptLiveChatText(m.text),
      at: m.createdAt,
      ...(m.sender === "agent" ? { agentName: m.agentName || conv.agentName || "" } : {}),
      ...(m.links?.length ? { links: m.links.map((l) => ({ title: l.title, url: l.url })) } : {}),
      ...(m.fileId && files.get(String(m.fileId)) ? { file: { name: files.get(String(m.fileId)).name, mime: files.get(String(m.fileId)).mime, size: files.get(String(m.fileId)).size } } : {}),
    }));
    const canRequestAgent = conv.mode === "ai";
    // A patient with an agent (or waiting for one) can hand the chat back to the AI, unless the AI is switched off.
    const canSwitchToAi = (conv.mode === "live" || conv.mode === "queue") && settings.aiMode !== "ai_off";
    return {
      conversationId: conv.conversationId,
      mode: conv.mode,
      canRequestAgent,
      canSwitchToAi,
      optionsUsed: Boolean(conv.optionsUsed),
      options:
        conv.mode === "ai" && !conv.optionsUsed
          ? (settings.quickOptions || []).map((o) => ({ key: o.key, label: o.label, icon: o.icon }))
          : [],
      offline: Boolean(conv.offlineRequested),
      aiUnavailable: aiUnavailableNow(),
      agent: conv.mode === "live" && conv.agentName ? { name: conv.agentName } : null,
      rating: conv.rating?.stars ? { stars: conv.rating.stars } : null,
      canRate: conv.mode === "archived" && conv.closedReason === "resolved" && !conv.rating?.stars,
      messages,
    };
  }

  async function addMessage(conv, sender, text, extra = {}) {
    const { file, sourceText, ...stored } = extra; // `file` is display info; only fileId is stored
    // sourceText: the admin's English text of a translated reply. Stored encrypted, shown to admins only.
    const doc = await LcMessage.create({
      conversationId: conv.conversationId,
      sender,
      text: encryptLiveChatText(text),
      ...(sourceText ? { sourceText: encryptLiveChatText(sourceText) } : {}),
      ...stored,
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
      ...(stored.links?.length ? { links: stored.links } : {}),
      ...(file ? { file } : {}),
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
      message: { ...message, internal: Boolean(extra.internal), ...(sourceText ? { sourceText } : {}) },
    });
    return message;
  }

  // The patient's language, kept on the chat for the admin side only (never part of what a patient receives).
  async function setLanguage(conv, language, { source = "ai" } = {}) {
    if (!language?.code) return;
    const updated = await LcConversation.findOneAndUpdate(
      { _id: conv._id, "language.code": { $ne: language.code } },
      { $set: { language: { code: language.code, name: language.name || language.code, detectedAt: new Date(now()), source } } },
      { returnDocument: "after" }
    );
    if (updated) announce(updated); // badge in every admin's list
  }

  // From the AI reply: the first detection is accepted; a different language later only when the patient's latest
  // message is long enough to be sure ("clearly switches").
  async function noteLanguage(conv, language, patientText) {
    if (!language?.code) return;
    const stored = conv.language?.code || "";
    if (stored === language.code) return;
    if (stored && tooShortToTell(patientText || "")) return;
    await setLanguage(conv, language, { source: "ai" });
  }

  async function pushState(conv) {
    const fresh = await LcConversation.findById(conv._id).lean();
    emitToVisitor(conv.visitorId, "chat:state", await serialize(fresh, await loadSettings()));
  }

  function setActivity(visitorId, conv) {
    const activity =
      conv.mode === "ai" ? "ai" : conv.mode === "queue" ? "waiting" : conv.mode === "live" ? (conv.invited ? "invited" : "chatting") : "browsing";
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
    let conv = await findOpen(visitorId);
    if (!conv) conv = await reopenIfLeft(visitorId, visitor); // back within 24 h of leaving: the chat continues
    let conversation = conv ? await serialize(conv.toObject(), settings) : null;
    if (!conversation) {
      // A chat that was just resolved and not rated yet stays reachable, so the patient can rate after moving on.
      const rateable = await LcConversation.findOne({
        visitorId,
        mode: "archived",
        closedReason: "resolved",
        "rating.stars": null,
        closedAt: { $gte: new Date(now() - 24 * 3_600_000) },
      }).sort({ closedAt: -1 });
      if (rateable) conversation = await serialize(rateable.toObject(), settings);
    }
    return { ok: true, needContact: false, firstName: firstNameOf(decryptLiveChatText(visitor.name)), conversation };
  }

  // A visitor who left (tab closed, 30 s) and comes back within 24 hours continues the same chat: an AI chat goes
  // back to the AI; a chat that had an agent goes back to the Queue (the agent may have moved on).
  async function reopenIfLeft(visitorId, visitor) {
    const doc = await LcConversation.findOne({
      visitorId,
      mode: "archived",
      closedReason: "patient_left",
      leftAt: { $gte: new Date(now() - 24 * 3_600_000) },
    }).sort({ leftAt: -1 });
    if (!doc) return null;
    const settings = await loadSettings();
    const target = doc.modeBeforeLeft === "ai" ? "ai" : "queue";
    const available = teamAvailable(settings);
    const set = { mode: target, closedReason: "", closedAt: null, leftAt: null, modeBeforeLeft: "" };
    if (target === "queue") Object.assign(set, { assigneeId: null, agentName: "", queuedAt: new Date(now()), offlineRequested: !available });
    const won = await LcConversation.findOneAndUpdate(
      { _id: doc._id, mode: "archived", closedReason: "patient_left" },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!won) return findOpen(visitorId); // someone else reopened it first
    const first = firstNameOf(decryptLiveChatText(visitor.name));
    const welcome =
      target === "ai"
        ? `Welcome back, ${first}!`
        : available
          ? `Welcome back, ${first}! We're reconnecting you with an agent.`
          : `Welcome back, ${first}! ${noAgentText(won, settings)}`;
    await addMessage(won, "system", welcome);
    setActivity(visitorId, won);
    emitToAgents("chat:reopened", { conversationId: won.conversationId, visitorId, everLive: Boolean(won.everLive), name: first, mode: target });
    if (target === "queue") {
      emitToAgents("queue:new", { conversationId: won.conversationId, visitorId, name: first, everLive: true, offline: !available, reason: "returned" });
    }
    announce(won);
    return won;
  }

  // ── Visitor left ─────────────────────────────────────────────────────────────

  // About 30 s after the last connection of a visitor (tracker or chat) closes, an open chat is archived as
  // "patient left". A request left while the team was offline stays in the Queue: the patient asked for an email.
  async function visitorLeft(visitorId) {
    const open = await findOpen(visitorId);
    if (!open || open.offlineRequested) return;
    await withLock(open.conversationId, async () => {
      const current = await LcConversation.findById(open._id);
      if (!current || current.mode === "archived" || current.offlineRequested) return;
      const stamp = new Date(now());
      const archived = await LcConversation.findOneAndUpdate(
        { _id: current._id, mode: { $ne: "archived" } },
        { $set: { modeBeforeLeft: current.mode, mode: "archived", closedReason: "patient_left", leftAt: stamp, closedAt: stamp } },
        { returnDocument: "after" }
      );
      if (!archived) return;
      await addMessage(archived, "system", "Patient left the website", { internal: true });
      announce(archived);
    });
  }

  // Counts a visitor's open connections (tracker and chat sockets together). Returns a function to call when one
  // closes. When the last one has been closed for leaveGraceMs, visitorLeft() runs; a reconnect in time cancels it.
  const connections = new Map();
  const leaveTimers = new Map();
  function trackConnection(visitorId) {
    clearTimeout(leaveTimers.get(visitorId));
    leaveTimers.delete(visitorId);
    connections.set(visitorId, (connections.get(visitorId) || 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (connections.get(visitorId) || 1) - 1;
      if (remaining > 0) {
        connections.set(visitorId, remaining);
        return;
      }
      connections.delete(visitorId);
      const timer = setTimeout(() => {
        leaveTimers.delete(visitorId);
        if (!connections.has(visitorId)) visitorLeft(visitorId).catch(() => {});
      }, leaveGraceMs);
      timer.unref?.();
      leaveTimers.set(visitorId, timer);
    };
  }

  // ── Rating ───────────────────────────────────────────────────────────────────

  // The patient rates a chat that was just resolved: 1-5 stars, once.
  async function rate(visitorId, rawStars) {
    const stars = Number(rawStars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "invalid_rating" };
    const conv = await LcConversation.findOne({
      visitorId,
      mode: "archived",
      closedReason: "resolved",
      "rating.stars": null,
      closedAt: { $gte: new Date(now() - 24 * 3_600_000) },
    }).sort({ closedAt: -1 });
    if (!conv) return { ok: false, error: "nothing_to_rate" };
    const rated = await LcConversation.findOneAndUpdate(
      { _id: conv._id, "rating.stars": null },
      { $set: { rating: { stars, ratedAt: new Date(now()) } } },
      { returnDocument: "after" }
    );
    if (!rated) return { ok: false, error: "already_rated" };
    await addMessage(rated, "system", `Patient rated the chat ${stars}★`, { internal: true });
    announce(rated);
    await pushState(rated);
    return { ok: true };
  }

  // ── Invites (an admin started a chat with a visitor who has not opened the widget) ──

  async function pendingInvite(visitorId) {
    const conv = await findOpen(visitorId);
    if (!conv || !conv.invited || conv.patientMessageCount > 0) return null;
    const hasAgentMessage = await LcMessage.exists({ conversationId: conv.conversationId, sender: "agent" });
    // Only the agent's name goes to the bubble. The text is shown after the visitor has filled in the contact form.
    return hasAgentMessage ? { conversationId: conv.conversationId, agentName: conv.agentName } : null;
  }

  const findOpenConversation = (visitorId) => findOpen(visitorId);

  async function startConversation(visitorId, context = {}) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { ok: false, error: "contact_required" };
    const settings = await loadSettings();
    const existing = await findOpen(visitorId);
    if (existing) return { ok: true, conversation: await serialize(existing.toObject(), settings) };

    if (!(await limits.canStartChat(context.ip))) {
      abuse?.noteDailyLimit(context.ip); // one alert per IP per day
      return { ok: false, error: "chat_limit" };
    }

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
    abuse?.noteChat({ ip: conv.ip, visitorId, conversationId: conv.conversationId }).catch(() => {});
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
      if (conv.invited) {
        await LcConversation.updateOne({ _id: conv._id }, { $set: { invited: false } });
        conv.invited = false;
        setActivity(conv.visitorId, conv);
        announce(await LcConversation.findById(conv._id)); // the "Invited" tag disappears on every admin's screen
      }
      return conv;
    });
    if (!saved) return { ok: false, error: "no_conversation" };

    // ...the AI turn is NOT: the model can take seconds, and an admin's "Take over" must never wait for it. AI
    // turns of one chat run one after another (their own lock key); every change an AI turn makes re-checks that
    // the chat is still an AI chat (see `ifStillAi`).
    if (saved.mode === "ai") await withLock(`ai:${saved.conversationId}`, () => aiTurn(saved, loaded.visitor));
    // No language yet (AI off, cap reached, or straight to an agent): one small call on a clearly non-English message.
    if (detector && !saved.language?.code && !tooShortToTell(text.text) && !looksEnglish(text.text)) {
      detector(saved, text.text).catch(() => {});
    }
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
      return ifStillAi((current) => requestAgent(current, { first, settings, reason: "ai_off" }));
    }

    if (!limits.aiRepliesLeft(conv, settings)) {
      return ifStillAi(async (current) => {
        await addMessage(current, "ai", "I've reached my limit for this chat. Let me connect you with a live agent who can help further.");
        return requestAgent(await LcConversation.findById(current._id), { first, settings, reason: "ai_limit" });
      });
    }

    const spend = await limits.spendStatus(settings);
    if (spend.capReached) openBreaker("spend_cap");
    if (aiUnavailableNow()) return ifStillAi((current) => aiFallback(current, { first, settings }));

    emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: true });
    let result;
    let lastPatientText = "";
    try {
      const history = (await recentHistory(conv)).map((m) => ({ role: m.sender, text: m.text }));
      // Pages that fit what the patient just wrote; the model may only point at these.
      const lastPatient = history.filter((m) => m.role === "patient").slice(-2).map((m) => m.text).join(" ");
      lastPatientText = history.filter((m) => m.role === "patient").at(-1)?.text || "";
      // How many questions in a row the AI already missed: the prompt differs between the first and the second miss.
      const streakRow = await LcConversation.findById(conv._id).select("unansweredStreak").lean();
      result = await ai.generateReply({
        settings,
        history,
        pages: sitePages.candidatesFor(lastPatient).map((p) => ({ title: p.title, url: p.url })),
        unansweredStreak: streakRow?.unansweredStreak || 0,
      });
    } catch {
      result = { ok: false, kind: "api_error" };
    }
    emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: false });

    if (result.usage) await recordUsage(conv, settings, result.usage); // the tokens were spent either way
    if (!result.ok) openBreaker(result.kind);

    // An admin may have taken the chat over while the model was thinking: such a reply is never posted.
    return ifStillAi(async (current) => {
      if (!result.ok) return aiFallback(current, { first, settings });
      // Streaks of consecutive off-topic messages and consecutive "could not answer" replies.
      const offTopicStreak = result.offTopic ? (current.offTopicStreak || 0) + 1 : 0;
      const unansweredStreak = result.handoffReason === "unanswered" ? (current.unansweredStreak || 0) + 1 : 0;
      const update = { $inc: { aiReplyCount: 1 }, $set: { offTopicStreak, unansweredStreak } };
      if (!current.topic && result.topic) update.$set.topic = result.topic;
      await LcConversation.updateOne({ _id: current._id }, update);
      await noteLanguage(current, result.language, lastPatientText);
      // Only pages on the server's own list reach the patient (an invented url is dropped).
      const links = sitePages.filterLinks(result.links);
      // Off-topic never hands over; from the third in a row the patient is reminded of the button.
      const reply =
        result.offTopic && offTopicStreak >= OFF_TOPIC_REMINDER_AT ? `${result.reply} ${OFF_TOPIC_REMINDER}` : result.reply;
      await addMessage(current, "ai", reply, links.length ? { links } : {});
      // One "not sure" is not enough: "unanswered" hands over on the second miss in a row.
      const due = result.handoffReason === "unanswered" ? unansweredStreak >= UNANSWERED_HANDOFF_AT : true;
      if (result.handoff && !result.offTopic && due && handoffAllowed(settings, result.handoffReason)) {
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
    // File messages are left out: their text is the file name, which can reveal health information.
    const rows = await LcMessage.find({ conversationId: conv.conversationId, sender: { $in: ["patient", "ai", "agent"] }, fileId: null })
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

  // The team counts as offline according to the "offline rule" in the AI settings.
  function teamAvailable(settings) {
    const inHours = isWithinSupportHours(settings, new Date(now()));
    const agentOnline = agents.availableCount() > 0;
    switch (settings?.offlineRule) {
      case "no_agent":
        return agentOnline;
      case "hours":
        return inHours;
      default:
        return inHours && agentOnline;
    }
  }

  // The AI may ask for a hand-over only with a valid reason; the settings decide which are allowed. An emergency always is.
  function handoffAllowed(settings, reason) {
    const rules = settings?.handoffRules || {};
    if (reason === "emergency") return true;
    if (reason === "unanswered") return rules.onUnsure !== false;
    if (reason === "account_issue") return rules.onAccountOrPayment !== false;
    if (reason === "explicit_request") return rules.onPatientRequest !== false;
    if (reason === "technical_issue") return rules.onTechnicalIssue !== false;
    if (reason === "complaint") return rules.onComplaint !== false;
    return false; // "none" or anything unknown never reaches an agent
  }

  // What the patient reads when no agent can take the chat right now: a thank-you with their own first name and
  // email, never a word about the team being offline. (The two older default texts are replaced on the fly.)
  const LEGACY_NO_AGENT_TEXTS = new Set([
    "Our team is offline right now. Leave your request and we'll reply to your email as soon as we're back.",
    "Our team is offline right now. We've saved your request and will reply by email.",
  ]);
  function noAgentText(conv, settings) {
    const first = firstNameOf(decryptLiveChatText(conv?.contact?.name));
    const email = decryptLiveChatText(conv?.contact?.email);
    let template = String(settings?.offlineMessage || "");
    if (!template || LEGACY_NO_AGENT_TEXTS.has(template)) template = DEFAULT_NO_AGENT_TEXT;
    return template.replace(/\{\s*first\s*name\s*\}/gi, first).replace(/\{\s*email\s*\}/gi, email || "your email");
  }

  async function requestAgent(conv, { first, settings, reason } = {}) {
    if (conv.mode === "queue" || conv.mode === "live") return { ok: true };
    const cfg = settings || (await loadSettings());
    const available = teamAvailable(cfg);
    const name = first || "there";
    await LcConversation.updateOne(
      { _id: conv._id },
      {
        $set: {
          mode: "queue",
          everLive: true,
          offlineRequested: !available,
          queuedAt: new Date(now()),
          handoffReason: reason || "explicit_request", // shown to admins; the header button counts as a request
          offTopicStreak: 0,
          unansweredStreak: 0,
        },
      }
    );
    const fresh = await LcConversation.findById(conv._id);
    if (available) {
      await addMessage(fresh, "ai", `Thanks, ${name}! Connecting you to our team now. You can keep typing your question here.`);
    } else {
      await addMessage(fresh, "ai", noAgentText(fresh, cfg));
    }
    setActivity(conv.visitorId, fresh);
    // The team is offline: one follow-up email goes to the patient (no health details; never blocks the chat).
    if (!available && followUp) followUp.send(fresh).catch(() => {});
    emitToAgents("queue:new", {
      conversationId: conv.conversationId,
      visitorId: conv.visitorId,
      name,
      everLive: true,
      offline: !available,
      reason: reason || "explicit_request",
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

  // Header button "Switch to AI": the chat goes back to the AI at once. A chat that was ever live stays in Live agent
  // chats (group "Back with the AI"); the agent holding it sees a team-only line and the AI carries on.
  async function switchToAi(visitorId) {
    const loaded = await loadOpenForMessage(visitorId);
    if (loaded.error) return { ok: false, error: loaded.error };
    return withLock(loaded.conv.conversationId, async () => {
      const conv = await LcConversation.findById(loaded.conv._id);
      if (!conv || (conv.mode !== "live" && conv.mode !== "queue")) return { ok: false, error: "not_available" };
      const settings = await loadSettings();
      if (settings.aiMode === "ai_off") return { ok: false, error: "ai_off" };
      if (!limits.allowMessage(visitorId)) return { ok: false, error: "rate_limited" };
      const previous = { assigneeId: conv.assigneeId, agentName: conv.agentName };
      const switched = await LcConversation.findOneAndUpdate(
        { _id: conv._id, mode: { $in: ["live", "queue"] } },
        { $set: { mode: "ai", assigneeId: null, agentName: "", offlineRequested: false, invited: false } },
        { returnDocument: "after" }
      );
      if (!switched) return { ok: false, error: "not_available" };
      await addMessage(switched, "system", "Patient switched to the AI assistant", { internal: true });
      await addMessage(switched, "system", "You're now chatting with Humancare AI. You can ask for a live agent at any time.");
      setActivity(switched.visitorId, switched);
      if (previous.assigneeId) emitToAgents("chat:handed-back", { conversationId: switched.conversationId, agentName: previous.agentName || "" });
      announce(switched);
      await pushState(switched);
      return { ok: true };
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
        const link = option.link ? sitePages.linkFor(option.link) : null;
        await addMessage(fresh, "ai", option.reply, link ? { links: [link] } : {});
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
    switchToAi,
    noAgentText,
    relayTyping,
    // used by the agent side (agentService) and the socket layer
    withLock,
    findOpenConversation,
    trackConnection,
    visitorLeft,
    rate,
    pendingInvite,
    filesMeta,
    backfillPages,
    sendFollowUp: (conv) => (followUp ? followUp.send(conv) : Promise.resolve({ sent: false, reason: "disabled" })),
    toTrackers: (visitorId, event, payload) => emitToTrackers(visitorId, event, payload),
    shutdown() {
      for (const timer of leaveTimers.values()) clearTimeout(timer);
      leaveTimers.clear();
      connections.clear();
    },
    addMessage,
    setLanguage,
    setLanguageDetector: (fn) => {
      detector = fn;
    },
    toObjectId: (id) => new (require("mongoose").Types.ObjectId)(String(id)),
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
