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
const { encryptLiveChatText, decryptLiveChatText, hashLiveChatEmail, searchKeysOf } = require("../../utils/liveChat/crypto");
const { newVisitorId } = require("./chatToken");
const { aiNameOf, withAiName } = require("./settingsDefaults");
const { tooShortToTell, tooShortToDetect, looksEnglish, scrubContact } = require("./languageHints");
const safety = require("./safety");

// Shown the moment a chat goes to the team, whoever is or is not at their desk.
const CONNECTING_TEXT = (name) => `Thanks, ${name}! Connecting you to our team now. You can keep typing your question here.`;
// Shown when no admin has replied after followUpMinutes; the generic follow-up email goes with it.
const EMAIL_NOTICE_TEXT = (email) => `Our team will connect with you by email at ${email || "your email address"} shortly.`;
const FOLLOW_UP_JOB_MS = 15_000; // how often due follow-ups are looked for
const INACTIVE_JOB_LIMIT = 25;
// A device keeps showing (and can continue) its last chat for this long after the chat's last message. Server data is
// kept for the retention period regardless; this only limits what a returning browser is shown.
const DEVICE_WINDOW_MS = 30 * 24 * 3_600_000;
const { istDayKey, istDayStart } = require("./istDay");
const DAILY_CLOSE_TEXT = "This chat was closed at the end of the day. Send a message any time to continue.";
const SWEEP_BATCH = 100;
const INACTIVE_TEXT = (minutes) => `This chat was closed after ${minutes} minutes of inactivity. Send a message any time to continue.`;
const inactiveMinutesOf = (settings) => Math.min(60, Math.max(5, Math.round(Number(settings?.inactiveMinutes) || 10)));
const followUpMinutesOf = (settings) => Math.min(30, Math.max(1, Math.round(Number(settings?.followUpMinutes) || 1)));

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
  followUp = null, // the generic follow-up email ({ send(conv) })
  abuse = null, // abuse alerts ({ noteChat, noteDailyLimit })
  sitePages = require("./sitePages").createSitePages(), // the pages the AI may link to (allowlist)
  detectLanguage = null, // (conv, text) => Promise: one small model call when no AI turn has found the language
  leaveGraceMs = 30_000, // a visitor with no connection for this long has left
  now = () => Date.now(),
  log = () => {},
  aiDeadlineMs = 25_000, // the longest a patient waits for the model before the fallback goes out
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

  function openBreaker(kind, reason = "") {
    // Quota / bad config will not fix itself in seconds; transient failures retry sooner.
    const longLived = ["quota", "config", "not_configured", "spend_cap"].includes(kind);
    breaker.until = now() + (longLived ? 10 * 60_000 : 30_000);
    breaker.kind = kind;
    if (!breaker.alerted) {
      breaker.alerted = true; // alert admins once per outage
      emitToAgents("ai:unavailable", { kind });
      console.warn(`[livechat] AI unavailable (${kind}${reason ? `: ${reason}` : ""}); patients see the fallback, live chat keeps working`);
    }
  }
  const closeBreakerIfRecovered = () => {
    if (breaker.until && breaker.until <= now()) {
      breaker.until = 0;
      breaker.alerted = false;
    }
  };

  // ── Contact ──────────────────────────────────────────────────────────────────

  async function registerContact({ visitorId, name, email, phone, ip, consent = null }) {
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
          // The AI notice shown above "Start chat" (only passed while the Super Admin setting is on).
          ...(consent ? { "consent.aiNoticeAcceptedAt": stamp, "consent.policyVersion": consent.policyVersion } : {}),
        },
        $setOnInsert: { firstSeenAt: stamp },
      },
      { upsert: true }
    );
    // A chat an admin started (invite) has no contact yet: the visitor's details now belong to it.
    await LcConversation.updateMany(
      { visitorId: id, mode: { $nin: ["archived", "trashed"] }, "contact.email.cipherText": "" },
      { $set: { contact: enc, searchKeys: searchKeysOf(values.email, values.phone) } }
    );
    // Accepting the notice again (e.g. after a new policy version) is recorded on the chat that is still open.
    if (consent) {
      await LcConversation.updateMany(
        { visitorId: id, mode: { $nin: ["archived", "trashed"] } },
        { $set: { "consent.aiNoticeAcceptedAt": stamp, "consent.policyVersion": consent.policyVersion } }
      );
    }
    const record = presence.get(id);
    if (record) presence.update(id, { name: values.name, email: values.email });
    return { ok: true, visitorId: id, firstName: firstNameOf(values.name) };
  }

  const loadVisitor = (visitorId) => LcVisitor.findOne({ visitorId }).lean();
  const hasContact = (visitor) => Boolean(visitor?.email?.cipherText && visitor?.name?.cipherText);
  // While "Show AI notice" is on, a visitor must have accepted the current policy version before chatting. One who has
  // not (new visitor, or a new policy version) is sent back to the contact form, whose Start chat records the acceptance.
  const policyVersionOf = (settings) => String(settings?.policyVersion || "v1");
  const noticeAccepted = (visitor, settings) =>
    !settings?.showAiNotice ||
    Boolean(visitor?.consent?.aiNoticeAcceptedAt && visitor.consent.policyVersion === policyVersionOf(settings));

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
      ...(m.fileId && files.get(String(m.fileId))
        ? {
            file: {
              name: files.get(String(m.fileId)).name,
              mime: files.get(String(m.fileId)).mime,
              size: files.get(String(m.fileId)).size,
              // the patient can open only the files the team sent them
              ...(m.sender === "agent" ? { id: files.get(String(m.fileId)).id } : {}),
            },
          }
        : {}),
    }));
    // Archived quietly from the Queue (no admin replied in time): the patient is never shown a closed chat. They still
    // see the normal Queue view, and writing puts the chat back in the Queue.
    const quiet = conv.mode === "archived" && conv.closedReason === "inactive" && conv.modeBeforeLeft === "queue";
    if (quiet) conv = { ...conv, mode: "queue", closedReason: "" };
    const canRequestAgent = conv.mode === "ai";
    // A patient with an agent (or waiting for one) can hand the chat back to the AI, unless the AI is switched off.
    const canSwitchToAi = (conv.mode === "live" || conv.mode === "queue") && settings.aiMode !== "ai_off";
    return {
      conversationId: conv.conversationId,
      mode: conv.mode,
      canRequestAgent,
      canSwitchToAi,
      aiName: aiNameOf(settings),
      optionsUsed: Boolean(conv.optionsUsed),
      options:
        conv.mode === "ai" && !conv.optionsUsed
          ? (settings.quickOptions || []).map((o) => ({ key: o.key, label: o.label, icon: o.icon }))
          : [],
      emailFollowUp: Boolean(conv.offlineRequested || conv.followUpNoticeAt), // "we will email you" was shown
      aiUnavailable: aiUnavailableNow(),
      agent: conv.mode === "live" && conv.agentName ? { name: conv.agentName } : null,
      rating: conv.rating?.stars ? { stars: conv.rating.stars } : null,
      canRate: conv.mode === "archived" && conv.closedReason === "resolved" && !conv.rating?.stars,
      // A closed chat (inactive, resolved, ended ...) never dead-ends: the patient can write again and the same chat
      // continues. Only a blocked visitor cannot.
      canContinue: conv.mode === "archived" && conv.closedReason !== "blocked",
      closedReason: conv.mode === "archived" ? conv.closedReason || "" : "",
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
    // Whatever the patient does first (types, attaches a file, asks for an agent, picks a card), the cards are gone for good.
    if (sender === "patient") {
      update.$inc = { patientMessageCount: 1 };
      update.$set.optionsUsed = true;
      if (conv.mode !== "queue") update.$set.inactiveDueAt = null; // the patient wrote: the timer is cancelled (not in the Queue)
    }
    await LcConversation.updateOne({ _id: conv._id }, update);
    // A visible AI or admin message (re)starts the inactivity timer, but only while the chat is with the AI or an
    // agent: a chat in the Queue (the patient is waiting for us) is never auto-archived.
    if ((sender === "ai" || sender === "agent") && !extra.internal) {
      const minutes = inactiveMinutesOf(await loadSettings());
      await LcConversation.updateOne(
        { _id: conv._id, mode: { $in: ["ai", "live"] } },
        { $set: { inactiveDueAt: new Date(now() + minutes * 60_000) } }
      );
    }
    if (sender === "patient" && !conv.optionsUsed) await pushState(conv); // the patient's cards disappear at once
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
    if (hasContact(visitor) && presence.get(visitorId)) presence.update(visitorId, { name: decryptLiveChatText(visitor.name), email: decryptLiveChatText(visitor.email) });
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
    LcConversation.findOne({ visitorId, mode: { $nin: ["archived", "trashed"] } }).sort({ startedAt: -1 });

  async function resume(visitorId) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { ok: true, needContact: true };
    const settings = await loadSettings();
    if (!noticeAccepted(visitor, settings)) return { ok: true, needContact: true };
    await touchVisitor(visitorId);
    let conv = await retireIfStale(await findOpen(visitorId), visitor);
    // No open chat: the device shows its latest closed chat (history included) while it is inside the device window.
    // Writing in it reopens the same thread (findOrReopen).
    if (!conv) conv = await findContinuable(visitorId, visitor);
    const conversation = conv ? await serialize(conv.toObject ? conv.toObject() : conv, settings) : null;
    return { ok: true, needContact: false, firstName: firstNameOf(decryptLiveChatText(visitor.name)), conversation };
  }

  // The oldest moment a device may still show a chat from: 30 days back, or the last "clear this chat from this device".
  function deviceSince(visitor) {
    const limit = now() - DEVICE_WINDOW_MS;
    const cleared = visitor?.deviceClearedAt ? new Date(visitor.deviceClearedAt).getTime() : 0;
    return new Date(Math.max(limit, cleared));
  }

  // The visitor's latest closed chat that this device may still show or continue. A blocked chat stays closed.
  function findContinuable(visitorId, visitor) {
    return LcConversation.findOne({
      visitorId,
      mode: "archived",
      closedReason: { $ne: "blocked" },
      lastMessageAt: { $gt: deviceSince(visitor) },
    }).sort({ lastMessageAt: -1 });
  }

  // An open chat nobody has written in for longer than the device window is closed quietly, so the device starts fresh.
  async function retireIfStale(conv, visitor) {
    if (!conv || conv.lastMessageAt > deviceSince(visitor)) return conv;
    await LcConversation.updateOne(
      { _id: conv._id, mode: { $in: ["ai", "live", "queue"] } },
      { $set: { modeBeforeLeft: conv.mode, mode: "archived", closedReason: "inactive", closedAt: new Date(now()), inactiveDueAt: null, leaveDueAt: null } }
    );
    return null;
  }

  // A closed chat continues when the patient writes (or sends a file): the same conversation reopens. A chat that had an
  // agent (or was waiting for one) goes back to the Queue; one that never had an agent goes back to the AI.
  async function reopenArchived(visitorId, visitor) {
    const doc = await findContinuable(visitorId, visitor);
    if (!doc) return null;
    const settings = await loadSettings();
    const target = doc.everLive || doc.modeBeforeLeft === "queue" || doc.modeBeforeLeft === "live" ? "queue" : "ai";
    // A Queue chat that was archived quietly (the patient was never told it closed): no "welcome back" line.
    const quiet = doc.modeBeforeLeft === "queue" && doc.closedReason === "inactive";
    const set = { mode: target, closedReason: "", closedAt: null, leftAt: null, modeBeforeLeft: "", inactiveDueAt: null, leaveDueAt: null };
    if (target === "queue") {
      Object.assign(set, {
        assigneeId: null,
        agentName: "",
        queuedAt: new Date(now()),
        followUpDueAt: followUpDueFor(doc, settings),
        inactiveDueAt: new Date(now() + inactiveMinutesOf(settings) * 60_000),
      });
    }
    const won = await LcConversation.findOneAndUpdate(
      { _id: doc._id, mode: "archived", closedReason: { $ne: "blocked" } },
      { $set: set },
      { returnDocument: "after" }
    );
    if (!won) return findOpen(visitorId); // someone else reopened it first
    const first = firstNameOf(decryptLiveChatText(visitor.name));
    const welcome =
      target === "ai" ? `Welcome back, ${first}!` : `Welcome back, ${first}! We're reconnecting you with our team.`;
    if (!quiet) await addMessage(won, "system", welcome);
    setActivity(visitorId, won);
    emitToAgents("chat:reopened", { conversationId: won.conversationId, visitorId, everLive: Boolean(won.everLive), name: first, mode: target });
    if (target === "queue") {
      emitToAgents("queue:new", { conversationId: won.conversationId, visitorId, name: first, everLive: true, reason: "returned" });
    }
    announce(won);
    return won;
  }

  // The patient ends the chat from the widget (X, "End chat"). The chat is archived as "patient_ended" (the admin lists
  // show it in Archive temp); it is not deleted and the patient can still write in it. clear: this device also forgets
  // the chat (the next resume shows nothing older than now).
  async function endChat(visitorId, { clear = false } = {}) {
    const open = await findOpen(visitorId);
    if (open) {
      await withLock(open.conversationId, async () => {
        const current = await LcConversation.findById(open._id);
        if (!current || current.mode === "archived") return;
        const stamp = new Date(now());
        const archived = await LcConversation.findOneAndUpdate(
          { _id: current._id, mode: { $in: ["ai", "live", "queue"] } },
          { $set: { modeBeforeLeft: current.mode, mode: "archived", closedReason: "patient_ended", closedAt: stamp, inactiveDueAt: null, leaveDueAt: null } },
          { returnDocument: "after" }
        );
        if (!archived) return;
        await addMessage(archived, "system", "Patient ended the chat", { internal: true });
        setActivity(visitorId, archived);
        announce(archived);
        await pushState(archived); // every open tab of this patient shows the ended chat
      });
    }
    if (clear) await LcVisitor.updateOne({ visitorId }, { $set: { deviceClearedAt: new Date(now()) } });
    return { ok: true };
  }

  // ── Presence (never closes a chat) ─────────────────────────────────────────────────────────────

  // Counts a visitor's open connections (tracker and chat sockets together). Returns a function to call when one
  // closes. Leaving the site, hiding the tab, locking the phone, a dropped socket or a restart NEVER closes a chat: the
  // grace period below only keeps the visitor counted as "on the site" for a moment after a drop.
  const connections = new Map();
  const leaveTimers = new Map();
  // On the site right now: a tracked visit, an open chat connection, or one that dropped less than the grace period ago.
  const isConnected = (visitorId) => Boolean(presence.get(visitorId)) || connections.has(visitorId) || leaveTimers.has(visitorId);
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
      const timer = setTimeout(() => leaveTimers.delete(visitorId), leaveGraceMs);
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
  // The patient's file upload: an Inactive chat they could continue (found without reopening it), and the reopen
  // itself, which the upload asks for only after the file passed validation.
  const findReopenable = async (visitorId) => findContinuable(visitorId, await loadVisitor(visitorId));

  async function startConversation(visitorId, context = {}) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { ok: false, error: "contact_required" };
    const settings = await loadSettings();
    if (!noticeAccepted(visitor, settings)) return { ok: false, error: "contact_required" };
    const existing = await retireIfStale(await findOpen(visitorId), visitor);
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
      searchKeys: searchKeysOf(decryptLiveChatText(visitor.email), decryptLiveChatText(visitor.phone)),
      // The AI-notice acceptance recorded when the visitor pressed Start chat.
      ...(visitor.consent?.aiNoticeAcceptedAt
        ? { consent: { aiNoticeAcceptedAt: visitor.consent.aiNoticeAcceptedAt, policyVersion: visitor.consent.policyVersion || "" } }
        : {}),
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

  // The patient writes (or sends a file) to a closed chat (inactive, resolved, ended ...): the same conversation reopens.
  async function findOrReopen(visitorId) {
    const open = await findOpen(visitorId);
    if (open) return open;
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return null;
    const reopened = await reopenArchived(visitorId, visitor);
    if (reopened) await pushState(reopened); // the widget leaves its "closed" view at once
    return reopened;
  }

  async function loadOpenForMessage(visitorId, { reopen = false } = {}) {
    const visitor = await loadVisitor(visitorId);
    if (!hasContact(visitor)) return { error: "contact_required" };
    const conv = reopen ? await findOrReopen(visitorId) : await findOpen(visitorId);
    if (!conv) return { error: "no_conversation" };
    return { visitor, conv };
  }

  async function sendMessage(visitorId, rawText) {
    const text = limits.checkMessageText(rawText);
    if (!text.ok) return { ok: false, error: text.error };
    const loaded = await loadOpenForMessage(visitorId, { reopen: true });
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

    // ...the AI turn is NOT: the model can take seconds, and neither the patient's acknowledgement nor an admin's
    // "Take over" may wait for it. The turn runs in the background (`aiDone`, which never rejects); only one runs per
    // chat at a time (see `runAiTurn`); every change a turn makes re-checks that the chat is still an AI chat
    // (see `ifStillAi`).
    const aiDone = (async () => {
      if (saved.mode === "ai") await runAiTurn(saved, loaded.visitor, text.text);
      // No language yet (AI off, cap reached, or straight to an agent): one small call on a clearly non-English message.
      if (detector && !saved.language?.code && !tooShortToDetect(text.text) && !looksEnglish(text.text)) {
        await detector(saved, text.text).catch(() => {});
      }
    })().catch((err) => {
      console.error(`[livechat] ai turn failed: ${err?.name || "Error"}`); // never the message: it could carry patient text
    });
    inFlight.add(aiDone);
    aiDone.finally(() => inFlight.delete(aiDone));
    return { ok: true, aiDone };
  }

  // One AI turn per chat at a time. A message that arrives while a turn runs does not start another: when the running
  // turn ends, exactly one more turn runs, and it sees every message that came in meanwhile.
  const aiRuns = new Map(); // conversationId -> { again, texts, promise }
  const inFlight = new Set(); // every running aiDone (tests wait for them)
  function runAiTurn(conv, visitor, text) {
    const key = conv.conversationId;
    const running = aiRuns.get(key);
    if (running) {
      running.again = true;
      running.texts.push(text);
      return running.promise;
    }
    const run = { again: false, texts: [], promise: null };
    run.promise = (async () => {
      try {
        let current = conv;
        let patientText = text;
        for (;;) {
          await aiTurn(current, visitor, patientText);
          if (!run.again) return;
          patientText = run.texts.join(" ");
          run.again = false;
          run.texts = [];
          current = await LcConversation.findById(conv._id);
          if (!current || current.mode !== "ai") return;
        }
      } finally {
        aiRuns.delete(key);
      }
    })();
    aiRuns.set(key, run);
    return run.promise;
  }

  // The language a fixed safety string is sent in: the model's own answer when it gave one, else a guess from the text.
  const safetyLanguage = (language, patientText) => {
    const code = language?.code;
    return !code || code === "und" ? safety.guessLanguage(patientText) : safety.langKey(code);
  };

  // Marks a chat for the AI Review page and makes it unreviewed again. reasons: reply_blocked | emergency_keyword |
  // model_emergency | model_medical.
  async function markMedical(conv, reasons) {
    const list = [...new Set(reasons)].filter(Boolean);
    if (!list.length) return;
    const stamp = new Date(now());
    await LcConversation.updateOne(
      { _id: conv._id },
      { $set: { "flags.medical": true, "flags.lastAt": stamp, "review.status": "unreviewed" }, $addToSet: { "flags.reasons": { $each: list } } }
    );
    await LcConversation.updateOne({ _id: conv._id, "flags.firstAt": null }, { $set: { "flags.firstAt": stamp } });
  }

  // A fixed, model-free reply: the safe "can't give medical advice" text with the booking page button. Used when the
  // reply filter blocks a model reply, or the model stayed over the length limit.
  async function sendSafeReply(current, { patientText, blockedReply = "", language, blocked = false }) {
    const medication = safety.isMedicationText(patientText) || safety.isMedicationText(blockedReply);
    const text = safety.fixedText(medication ? "fallbackMedication" : "fallback", safetyLanguage(language, patientText));
    // The page that fits what the patient wrote (from the server's lay-word map and list) above the booking card.
    const settings = await loadSettings();
    const links = sitePages.arrange([], { allowContent: settings.aiMayLinkConditionPages !== false, medical: true, hintText: patientText });
    await addMessage(current, "ai", text, { ...(links.length ? { links } : {}), ...(blocked ? { safetyBlocked: true } : {}) });
  }

  // Whatever goes wrong inside a turn (an error, a hung model), the patient is never left with nothing: the typing
  // indicator goes off and the "AI unavailable" fallback goes out, unless a reply was already posted.
  async function aiTurn(conv, visitor, patientText = "") {
    const turn = { posted: false };
    try {
      return await aiTurnSteps(conv, visitor, patientText, turn);
    } catch (err) {
      console.error(`[livechat] ai turn failed: ${err?.name || "Error"}`);
      emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: false });
      if (turn.posted) return undefined;
      try {
        const settings = await loadSettings();
        const current = await LcConversation.findById(conv._id);
        if (current?.mode !== "ai") return undefined;
        return await aiFallback(current, { first: firstNameOf(decryptLiveChatText(visitor.name)), settings });
      } catch {
        try {
          const current = await LcConversation.findById(conv._id);
          if (current?.mode === "ai") await addMessage(current, "system", "Our assistant is unavailable right now. Please try again in a moment.");
        } catch {
          /* nothing more can be done */
        }
        return undefined;
      }
    }
  }

  async function aiTurnSteps(conv, visitor, patientText, turn) {
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

    // The patient describes an emergency: the server itself sends the fixed 911 message and hands over to the Queue.
    // The model is not asked, so this holds whatever it would have said.
    const emergency = safety.detectEmergency(patientText);
    if (emergency) {
      return ifStillAi(async (current) => {
        await markMedical(current, ["emergency_keyword"]); // also when it is a false alarm: the AI Review page shows those
        await addMessage(current, "ai", safety.fixedText("emergency", emergency.language));
        turn.posted = true;
        return requestAgent(await LcConversation.findById(current._id), { first, settings, reason: "emergency", language: emergency.language });
      });
    }

    // Admin chose "AI off": new chats go straight to the Queue.
    if (settings.aiMode === "ai_off") {
      return ifStillAi((current) => requestAgent(current, { first, settings, reason: "ai_off" }));
    }

    if (!limits.aiRepliesLeft(conv, settings)) {
      return ifStillAi(async (current) => {
        await addMessage(current, "ai", "I've reached my limit for this chat. Let me connect you with a live agent who can help further.");
        turn.posted = true;
        return requestAgent(await LcConversation.findById(current._id), { first, settings, reason: "ai_limit" });
      });
    }

    const spend = await limits.spendStatus(settings);
    if (spend.capReached) openBreaker("spend_cap");
    if (aiUnavailableNow()) {
      return ifStillAi(async (current) => {
        await aiFallback(current, { first, settings });
        turn.posted = true;
      });
    }

    emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: true });
    let result;
    let lastPatientText = "";
    let hintText = "";
    const linkConditions = settings.aiMayLinkConditionPages !== false;
    try {
      await sitePages.refresh(); // the live page list (cached for 10 minutes)
      const rawHistory = (await recentHistory(conv)).map((m) => ({ role: m.sender, text: m.text }));
      // The model never sees the patient's name, email or phone (the stored chat and what the patient sees are unchanged).
      const contact = { name: decryptLiveChatText(visitor.name), email: decryptLiveChatText(visitor.email), phone: decryptLiveChatText(visitor.phone) };
      const history = rawHistory.map((m) => ({ ...m, text: scrubContact(m.text, contact, (kind) => `[${kind}]`) }));
      // Pages that fit what the patient just wrote; the model may only point at these.
      lastPatientText = rawHistory.filter((m) => m.role === "patient").at(-1)?.text || "";
      hintText = lastPatientText; // the latest patient message only: an older topic must not add a page
      // How many questions in a row the AI already missed: the prompt differs between the first and the second miss.
      const streakRow = await LcConversation.findById(conv._id).select("unansweredStreak").lean();
      let timer;
      const deadline = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, kind: "timeout" }), aiDeadlineMs);
        timer.unref?.();
      });
      try {
        result = await Promise.race([
          ai.generateReply({
            settings,
            history,
            // Every page title (no content), so the model can pick the best match; the lay-word map adds a hint.
            pages: sitePages.pagesForPrompt({ allowContent: linkConditions }),
            pageHint: linkConditions ? sitePages.hintFor(lastPatientText).map((p) => p.title) : [],
            unansweredStreak: streakRow?.unansweredStreak || 0,
          }),
          deadline,
        ]);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      result = { ok: false, kind: "api_error" };
    }
    emitToVisitor(conv.visitorId, "chat:typing", { from: "ai", typing: false });

    if (result.usage) await recordUsage(conv, settings, result.usage); // the tokens were spent either way
    if (!result.ok && result.kind !== "too_long") openBreaker(result.kind, result.reason); // too long is the model's habit, not an outage

    // An admin may have taken the chat over while the model was thinking: such a reply is never posted.
    return ifStillAi(async (current) => {
      if (!result.ok && result.kind === "too_long") {
        // Still over 200 characters after the retry: the safe reply goes out instead.
        await LcConversation.updateOne({ _id: current._id }, { $inc: { aiReplyCount: 1 } });
        await sendSafeReply(current, { patientText: lastPatientText });
        turn.posted = true;
        return undefined;
      }
      if (!result.ok) {
        await aiFallback(current, { first, settings });
        turn.posted = true;
        return undefined;
      }
      // Streaks of consecutive off-topic messages and consecutive "could not answer" replies.
      const offTopicStreak = result.offTopic ? (current.offTopicStreak || 0) + 1 : 0;
      const unansweredStreak = result.handoffReason === "unanswered" ? (current.unansweredStreak || 0) + 1 : 0;
      const update = { $inc: { aiReplyCount: 1 }, $set: { offTopicStreak, unansweredStreak } };
      if (!current.topic && result.topic) update.$set.topic = result.topic;
      await LcConversation.updateOne({ _id: current._id }, update);
      await noteLanguage(current, result.language, lastPatientText);
      // Only pages on the server's own list reach the patient (an invented url is dropped).
      const links = sitePages.arrange(result.links, { allowContent: linkConditions, medical: result.topic === "medical", hintText });
      // The reply check: advice-like wording never reaches the patient, whatever the model was told.
      const verdict = safety.checkReply(result.reply);
      await markMedical(current, [
        verdict.blocked && "reply_blocked",
        result.handoffReason === "emergency" && "model_emergency",
        result.topic === "medical" && "model_medical",
      ]);
      if (verdict.blocked) {
        if (result.handoffReason === "emergency") {
          await addMessage(current, "ai", safety.fixedText("emergency", safetyLanguage(result.language, lastPatientText)), { safetyBlocked: true });
        } else {
          await sendSafeReply(current, { patientText: lastPatientText, blockedReply: result.reply, language: result.language, blocked: true });
        }
        turn.posted = true;
      } else {
        // Off-topic never hands over; from the third in a row the patient is reminded of the button.
        const reply =
          result.offTopic && offTopicStreak >= OFF_TOPIC_REMINDER_AT ? `${result.reply} ${OFF_TOPIC_REMINDER}` : result.reply;
        await addMessage(current, "ai", reply, links.length ? { links } : {});
        turn.posted = true;
      }
      // One "not sure" is not enough: "unanswered" hands over on the second miss in a row.
      const due = result.handoffReason === "unanswered" ? unansweredStreak >= UNANSWERED_HANDOFF_AT : true;
      if (result.handoff && !result.offTopic && due && handoffAllowed(settings, result.handoffReason)) {
        await requestAgent(await LcConversation.findById(current._id), {
          first,
          settings,
          reason: result.handoffReason,
          language: safetyLanguage(result.language, lastPatientText),
        });
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

  async function recentHistory(conv, limit = 10) {
    // File messages are left out: their text is the file name, which can reveal health information.
    const rows = await LcMessage.find({ conversationId: conv.conversationId, sender: { $in: ["patient", "ai", "agent"] }, fileId: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return rows.reverse().map((m) => ({ sender: m.sender, text: decryptLiveChatText(m.text) }));
  }

  // "{aiName} is unavailable..." then hand the patient to the team (queue, or saved request if offline).
  async function aiFallback(conv, { first, settings }) {
    if (!conv.aiNoticeShown) {
      await LcConversation.updateOne({ _id: conv._id }, { $set: { aiNoticeShown: true } });
      await addMessage(conv, "system", withAiName(settings.unavailableMessage, settings));
    }
    const fresh = await LcConversation.findById(conv._id);
    return requestAgent(fresh, { first, settings, reason: "ai_unavailable" });
  }

  // ── Live agent ───────────────────────────────────────────────────────────────

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

  // When the follow-up email notice is due for a chat that enters the Queue now. Nothing is scheduled when the notice
  // or the email was already given for this chat (at most once per chat).
  function followUpDueFor(conv, settings) {
    if (conv?.followUpNoticeAt || (conv?.followUp?.status && conv.followUp.status !== "")) return null;
    return new Date(now() + followUpMinutesOf(settings) * 60_000);
  }

  // Every hand-over ends here: the chat goes to the Queue and the patient is told it is being connected. There is no
  // availability check. If nobody replies within followUpMinutes, runFollowUpDue() tells the patient an email follows.
  async function requestAgent(conv, { first, settings, reason, language } = {}) {
    if (conv.mode === "queue" || conv.mode === "live") return { ok: true };
    const cfg = settings || (await loadSettings());
    const name = first || "there";
    await LcConversation.updateOne(
      { _id: conv._id },
      {
        $set: {
          mode: "queue",
          everLive: true,
          queuedAt: new Date(now()),
          followUpDueAt: followUpDueFor(conv, cfg),
          // The Queue timer: no admin reply within the inactivity minutes moves the chat to Archive temp. Patient
          // messages do not extend it; only an admin reply or joining ends it.
          inactiveDueAt: new Date(now() + inactiveMinutesOf(cfg) * 60_000),
          handoffReason: reason || "explicit_request", // shown to admins; the header button counts as a request
          offTopicStreak: 0,
          unansweredStreak: 0,
        },
      }
    );
    const fresh = await LcConversation.findById(conv._id);
    // After the 911 message the patient gets a short fixed line, not the "keep typing your question" one.
    await addMessage(fresh, "ai", reason === "emergency" ? safety.fixedText("teamNotified", language) : CONNECTING_TEXT(name));
    setActivity(conv.visitorId, fresh);
    emitToAgents("queue:new", {
      conversationId: conv.conversationId,
      visitorId: conv.visitorId,
      name,
      everLive: true,
      reason: reason || "explicit_request",
    });
    await pushState(fresh);
    return { ok: true };
  }

  // The follow-up step. For every chat still in the Queue whose due time has passed: tell the patient an email
  // follows, mark the chat "Email follow-up" and send the generic email (once per chat). Safe to run from several
  // places at once: each chat is claimed with one atomic update.
  async function runFollowUpDue({ limit = 25 } = {}) {
    const stamp = new Date(now());
    const due = await LcConversation.find({ mode: "queue", followUpDueAt: { $ne: null, $lte: stamp }, followUpNoticeAt: null })
      .select("_id conversationId")
      .limit(limit)
      .lean();
    let handled = 0;
    for (const row of due) {
      const claimed = await LcConversation.findOneAndUpdate(
        { _id: row._id, mode: "queue", followUpDueAt: { $ne: null, $lte: stamp }, followUpNoticeAt: null },
        { $set: { followUpNoticeAt: stamp, followUpDueAt: null, offlineRequested: true } },
        { returnDocument: "after" }
      );
      if (!claimed) continue; // an admin took it, the patient went back to the AI, or another run got it first
      try {
        await withLock(claimed.conversationId, async () => {
          const email = decryptLiveChatText(claimed.contact?.email);
          await addMessage(claimed, "ai", EMAIL_NOTICE_TEXT(email));
          setActivity(claimed.visitorId, claimed);
          announce(claimed);
          await pushState(claimed);
        });
        if (followUp) await followUp.send(claimed).catch(() => {});
        announce(await LcConversation.findById(claimed._id)); // the email status may have changed (sent / failed)
        handled += 1;
      } catch (err) {
        log({ event: "follow_up_failed", conversationId: claimed.conversationId, message: err?.message });
      }
    }
    return handled;
  }

  // The inactivity step. For every AI, live or Queue chat whose due time has passed:
  //   - AI / live: the patient has been silent since the last AI or admin message. Archived as "Inactive" and the
  //     patient is told ("closed after N minutes").
  //   - Queue: no admin has replied for the inactivity minutes (patient messages do not count). Archived as "Inactive"
  //     with modeBeforeLeft "queue", QUIETLY: no closing line and the patient's widget stays as it is (they were told
  //     an email follows). A patient message later puts the chat back in the Queue. The email follow-up fires first
  //     as before (a chat whose follow-up is still pending waits for it).
  // Each chat is claimed with one atomic update, so running from several places at once is safe.
  async function runInactiveDue({ limit = INACTIVE_JOB_LIMIT } = {}) {
    const stamp = new Date(now());
    const due = await LcConversation.find({ mode: { $in: ["ai", "live", "queue"] }, inactiveDueAt: { $ne: null, $lte: stamp } })
      .select("_id conversationId")
      .limit(limit)
      .lean();
    let handled = 0;
    for (const row of due) {
      try {
        const done = await withLock(row.conversationId, async () => {
          const current = await LcConversation.findById(row._id);
          if (!current || !["ai", "live", "queue"].includes(current.mode) || !current.inactiveDueAt || current.inactiveDueAt > stamp) return false;
          if (current.mode === "queue") {
            if (current.followUpDueAt && !current.followUpNoticeAt) return false; // the email follow-up goes first
            const archived = await archiveQuietly(current, stamp, { filter: { inactiveDueAt: { $ne: null, $lte: stamp } } });
            return Boolean(archived);
          }
          const last = await LcMessage.findOne({
            conversationId: current.conversationId,
            sender: { $in: ["patient", "ai", "agent"] },
            internal: { $ne: true },
          })
            .sort({ createdAt: -1 })
            .select("sender")
            .lean();
          if (!last || last.sender === "patient") {
            await LcConversation.updateOne({ _id: current._id }, { $set: { inactiveDueAt: null } }); // we owe a reply
            return false;
          }
          const archived = await LcConversation.findOneAndUpdate(
            { _id: current._id, mode: { $in: ["ai", "live"] }, inactiveDueAt: { $ne: null, $lte: stamp } },
            { $set: { modeBeforeLeft: current.mode, mode: "archived", closedReason: "inactive", closedAt: stamp, inactiveDueAt: null } },
            { returnDocument: "after" }
          );
          if (!archived) return false;
          await addMessage(archived, "system", INACTIVE_TEXT(inactiveMinutesOf(await loadSettings())));
          setActivity(archived.visitorId, archived);
          announce(archived);
          await pushState(archived);
          return true;
        });
        if (done) handled += 1;
      } catch (err) {
        log({ event: "inactive_close_failed", conversationId: row.conversationId, message: err?.message });
      }
    }
    return handled;
  }

  // A Queue chat that goes to Archive temp without telling the patient: no closing line, no widget change (the
  // patient's view keeps the normal composer; see `serialize`). Used by the inactivity job, the catch-up and the
  // midnight sweep. Must run inside withLock. `filter` adds conditions to the atomic claim.
  async function archiveQuietly(current, stamp, { filter = {} } = {}) {
    const archived = await LcConversation.findOneAndUpdate(
      { _id: current._id, mode: "queue", ...filter },
      { $set: { modeBeforeLeft: "queue", mode: "archived", closedReason: "inactive", closedAt: stamp, inactiveDueAt: null, leaveDueAt: null } },
      { returnDocument: "after" }
    );
    if (!archived) return null;
    setActivity(archived.visitorId, archived);
    announce(archived); // admins: the chat moves from the Queue to Archive temp
    return archived;
  }

  // Catch-up for chats whose in-memory timers were lost (a restart or deploy) or that predate the inactivity timer.
  // Idempotent: each chat is claimed with one atomic update. Never touches the Queue, a chat whose patient is
  // connected, or an admin-held chat where the patient wrote last (they are waiting for an answer).
  //   1. "Inactive": no inactivity due time, the last visible message is from the AI or an admin and is older than
  //      the inactivity minutes.
  //   (A patient who left the site, hid the tab or lost the connection is NOT a reason to close a chat.)
  async function runAbandonedSweep({ limit = 100 } = {}) {
    const stamp = new Date(now());
    const minutes = inactiveMinutesOf(await loadSettings());
    const cutoff = new Date(now() - minutes * 60_000);
    let archivedInactive = 0;

    const lastVisible = (conversationId) =>
      LcMessage.findOne({ conversationId, sender: { $in: ["patient", "ai", "agent"] }, internal: { $ne: true } })
        .sort({ createdAt: -1 })
        .select("sender")
        .lean();

    // 1. inactive
    const stale = await LcConversation.find({ mode: { $in: ["ai", "live"] }, inactiveDueAt: null, lastMessageAt: { $lt: cutoff } })
      .select("_id conversationId visitorId")
      .limit(limit)
      .lean();
    for (const row of stale) {
      if (isConnected(row.visitorId)) continue;
      try {
        const done = await withLock(row.conversationId, async () => {
          const current = await LcConversation.findById(row._id);
          if (!current || !["ai", "live"].includes(current.mode) || current.inactiveDueAt || current.lastMessageAt >= cutoff) return false;
          if (isConnected(current.visitorId)) return false;
          const last = await lastVisible(current.conversationId);
          if (!last || last.sender === "patient") return false; // the patient is waiting, or nothing was said
          const archived = await LcConversation.findOneAndUpdate(
            { _id: current._id, mode: { $in: ["ai", "live"] }, lastMessageAt: { $lt: cutoff } },
            { $set: { modeBeforeLeft: current.mode, mode: "archived", closedReason: "inactive", closedAt: stamp, inactiveDueAt: null, leaveDueAt: null } },
            { returnDocument: "after" }
          );
          if (!archived) return false;
          await addMessage(archived, "system", INACTIVE_TEXT(minutes));
          setActivity(archived.visitorId, archived);
          announce(archived);
          await pushState(archived);
          return true;
        });
        if (done) archivedInactive += 1;
      } catch (err) {
        log({ event: "abandoned_inactive_failed", conversationId: row.conversationId, message: err?.message });
      }
    }

    // 1b. Queue chats with no admin reply for the inactivity minutes and no timer (queued before the Queue timer
    // existed): archived quietly, like the timer would have. A connected patient does not matter here.
    const waiting = await LcConversation.find({ mode: "queue", inactiveDueAt: null, queuedAt: { $lt: cutoff } })
      .select("_id conversationId followUpDueAt followUpNoticeAt")
      .limit(limit)
      .lean();
    for (const row of waiting) {
      if (row.followUpDueAt && !row.followUpNoticeAt) continue; // the email follow-up goes first
      try {
        const done = await withLock(row.conversationId, async () => {
          const current = await LcConversation.findById(row._id);
          if (!current || current.mode !== "queue" || current.inactiveDueAt || !current.queuedAt || current.queuedAt >= cutoff) return false;
          if (current.followUpDueAt && !current.followUpNoticeAt) return false;
          return Boolean(await archiveQuietly(current, stamp, { filter: { inactiveDueAt: null, queuedAt: { $lt: cutoff } } }));
        });
        if (done) archivedInactive += 1;
      } catch (err) {
        log({ event: "abandoned_queue_failed", conversationId: row.conversationId, message: err?.message });
      }
    }

    return { inactive: archivedInactive, left: 0 }; // a patient who left the site never closes a chat
  }

  // The midnight (India time) cleanup. Archives, as "inactive" (so the patient can continue within 24 h), every chat
  // with no message today that is not active:
  //   - mode "ai" (AI chats and "Back with the AI"): archived unless the patient is connected on the site;
  //   - mode "live" (an admin holds it): archived only when the patient is not waiting, i.e. the last visible message
  //     is from an admin or the AI. The patient's message last means it stays.
  // The Queue and any chat whose patient is connected are never touched. Runs from the follow-up job every tick; the
  // day is recorded once a sweep completes, so a restart (or a server that was down at midnight) catches up, and
  // running it twice is harmless: every chat is claimed with one atomic update.
  async function runDailySweep({ at, force = false } = {}) {
    const atMs = at ? new Date(at).getTime() : now();
    const today = istDayKey(atMs);
    const start = istDayStart(today);
    const { LcSettings } = models;
    const doc = await LcSettings.getSettings();
    if (!force && (doc.lastDailySweepDay || "") >= today) return { skipped: true, archived: 0, kept: 0 };

    let archived = 0;
    const kept = new Set();
    for (let batch = 0; batch < 200; batch += 1) {
      const rows = await LcConversation.find({ mode: { $in: ["ai", "live", "queue"] }, lastMessageAt: { $lt: start }, _id: { $nin: [...kept] } })
        .select("_id conversationId")
        .limit(SWEEP_BATCH)
        .lean();
      if (!rows.length) break;
      for (const row of rows) {
        try {
          const done = await withLock(row.conversationId, async () => {
            const current = await LcConversation.findById(row._id);
            if (!current || !["ai", "live", "queue"].includes(current.mode) || current.lastMessageAt >= start) return false;
            if (isConnected(current.visitorId)) return false; // the patient is on the site (tracking or chat connection)
            if (current.mode === "queue") {
              if (current.followUpDueAt && !current.followUpNoticeAt) return false; // the email follow-up goes first
              return Boolean(await archiveQuietly(current, new Date(atMs), { filter: { lastMessageAt: { $lt: start } } }));
            }
            if (current.mode === "live") {
              const last = await LcMessage.findOne({
                conversationId: current.conversationId,
                sender: { $in: ["patient", "ai", "agent"] },
                internal: { $ne: true },
              })
                .sort({ createdAt: -1 })
                .select("sender")
                .lean();
              if (last?.sender === "patient") return false; // the patient is waiting for an answer
            }
            const stamp = new Date(atMs);
            const closed = await LcConversation.findOneAndUpdate(
              { _id: current._id, mode: current.mode, lastMessageAt: { $lt: start } },
              {
                $set: {
                  modeBeforeLeft: current.mode,
                  mode: "archived",
                  closedReason: "inactive",
                  closedAt: stamp,
                  inactiveDueAt: null,
                  followUpDueAt: null,
                },
              },
              { returnDocument: "after" }
            );
            if (!closed) return false;
            await addMessage(closed, "system", DAILY_CLOSE_TEXT);
            setActivity(closed.visitorId, closed);
            announce(closed);
            await pushState(closed);
            return true;
          });
          if (done) archived += 1;
          else kept.add(row._id);
        } catch (err) {
          kept.add(row._id);
          log({ event: "daily_sweep_failed", conversationId: row.conversationId, message: err?.message });
        }
      }
    }
    await LcSettings.updateOne({ key: "default" }, { $set: { lastDailySweepDay: today } });
    return { skipped: false, archived, kept: kept.size };
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
        { $set: { mode: "ai", assigneeId: null, agentName: "", offlineRequested: false, followUpDueAt: null, invited: false } },
        { returnDocument: "after" }
      );
      if (!switched) return { ok: false, error: "not_available" };
      await addMessage(switched, "system", "Patient switched to the AI assistant", { internal: true });
      await addMessage(switched, "system", `You're now chatting with ${aiNameOf(await loadSettings())}. You can ask for a live agent at any time.`);
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
    runFollowUpDue,
    runInactiveDue,
    runDailySweep,
    runAbandonedSweep,
    followUpDueFor,
    followUpJobMs: FOLLOW_UP_JOB_MS,
    relayTyping,
    // used by the agent side (agentService) and the socket layer
    withLock,
    findOpenConversation,
    findReopenable,
    reopenInactive: findOrReopen,
    trackConnection,
    isConnected,
    endChat,
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
    whenAiIdle: async () => {
      while (inFlight.size) await Promise.all([...inFlight]);
    },
  };
}

module.exports = { createChatService, validateContact, firstNameOf, newConversationId, validTimeZone, VISITOR_ID_RE };
