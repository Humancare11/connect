// Live-chat conversation logic for agents (admin + superadmin): lists, the conversation with its patient panel,
// replying, internal notes, take over / hand back / resolve, tags, contact edits, unread counts, canned replies,
// "Suggest a reply" and admin-started chats with a known contact.
//
// Rules enforced here (docs/live-chat-brief.md, docs/live-chat-plan.md):
//   - a chat is held by ONE agent: taking over is a single conditional update, so when two admins act at once only
//     one wins and the other gets a 409 naming the winner; only the assignee replies, others can read and add notes;
//   - a superadmin may take over a chat another agent holds (the previous agent is told); admins may not;
//   - internal notes and team-only lines never reach the patient (chat.addMessage keeps them off the visitor room);
//   - everything is done under the chat's lock, so an agent action and an AI turn never interleave.
// Errors are thrown as AgentError (status + code) and mapped to JSON by routes/adminLiveChat.js.
const net = require("net");
const mongoose = require("mongoose");
const { encryptLiveChatText, decryptLiveChatText, hashLiveChatEmail, searchKeysOf } = require("../../utils/liveChat/crypto");
const { validateContact, newConversationId, firstNameOf } = require("./chatService");
const { aiNameOf } = require("./settingsDefaults");
const { createWindowLimiter } = require("./limits");
const { createTranslationService, publicLanguage } = require("./translationService");
const { scrubContact, tooShortToDetect, looksEnglish } = require("./languageHints");

class AgentError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const CONVERSATION_ID_RE = /^HC[A-Z0-9]{8}$/;
const LIST_LIMIT = 200;
const { istTodayStart } = require("./istDay");
const MAX_AGENT_TEXT = 2000;
const MAX_TAGS = 10;

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function cleanText(value) {
  const text = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (!text) throw new AgentError(400, "empty_message");
  if ([...text].length > MAX_AGENT_TEXT) throw new AgentError(400, "message_too_long");
  return text;
}

function createAgentService({
  models,
  chat,
  loadSettings,
  ai,
  limits,
  presence,
  agentStore,
  agents = { isAvailable: () => true }, // who is online right now (index.js passes the registry)
  ipBlock = null, // block / unblock store
  files = null, // file service (an agent sending a file to the patient)
  disconnectIp = () => {}, // drops the visitor sockets of an IP
  emitToAgent = () => {},
  now = () => Date.now(),
}) {
  const { LcVisitor, LcConversation, LcMessage, LcPageVisit, LcCannedReply } = models;
  const suggestLimiter = createWindowLimiter({ windowMs: 60_000, max: 10, now });
  const summaryLimiter = createWindowLimiter({ windowMs: 60_000, max: 10, now });
  // Translation for admins (English view, reply translation, language detection). Admin side only.
  const translation = createTranslationService({
    models,
    ai,
    limits,
    loadSettings,
    chat,
    now,
    fail: (status, code, extra) => new AgentError(status, code, extra),
  });
  chat.setLanguageDetector((conv, text) => translation.detectFor(conv, text));

  async function displayNameOf(userId, settings) {
    const name = agentStore.displayName ? await agentStore.displayName(String(userId)) : "";
    return name || settings.agentDisplayName || "Agent";
  }

  async function load(conversationId) {
    if (!CONVERSATION_ID_RE.test(String(conversationId))) throw new AgentError(404, "not_found");
    const conv = await LcConversation.findOne({ conversationId });
    if (!conv || conv.mode === "trashed") throw new AgentError(404, "not_found"); // Trash is reached only through the trash service
    return conv;
  }

  const unreadFor = (conv, userId) => {
    const seen = (conv.reads || []).find((r) => sameId(r.userId, userId));
    return Math.max(0, (conv.patientMessageCount || 0) - (seen?.count || 0));
  };

  const contactOf = (source) => ({
    name: decryptLiveChatText(source?.name),
    email: decryptLiveChatText(source?.email),
    phone: decryptLiveChatText(source?.phone),
  });

  // Archived by inactivity from the Queue, today (India time): can be joined or replied to from Archive temp.
  function isJoinable(conv) {
    return Boolean(
      conv.mode === "archived" &&
        conv.closedReason === "inactive" &&
        conv.modeBeforeLeft === "queue" &&
        conv.closedAt &&
        new Date(conv.closedAt).getTime() >= istTodayStart(now()).getTime()
    );
  }

  // One row of a chat list (also pushed as chat:updated). `last` is the latest visible message, if known.
  function rowOf(conv, { userId, last } = {}) {
    const contact = contactOf(conv.contact);
    return {
      conversationId: conv.conversationId,
      visitorId: conv.visitorId,
      mode: conv.mode,
      everLive: Boolean(conv.everLive),
      assignee: conv.assigneeId ? { id: String(conv.assigneeId), name: conv.agentName || "Agent" } : null,
      name: contact.name,
      email: contact.email,
      ip: conv.ip,
      city: conv.geo?.city || "",
      state: conv.geo?.state || "",
      country: conv.geo?.country || "",
      topic: conv.topic || "",
      handoffReason: conv.handoffReason || "",
      language: publicLanguage(conv.language), // badge for non-English chats (admin side only)
      // The patient was told an email follows (the notice is due after followUpMinutes without an admin reply).
      emailFollowUp: Boolean(conv.offlineRequested || conv.followUpNoticeAt),
      emailStatus: conv.followUp?.status || "", // "", sending, sent, failed, skipped
      closedReason: conv.closedReason || "",
      closedAt: conv.closedAt || null,
      // A Queue chat archived by inactivity today (IST): an admin can still join or reply from Archive temp.
      joinable: isJoinable(conv),
      startedAt: conv.startedAt,
      lastMessageAt: conv.lastMessageAt,
      queuedAt: conv.queuedAt,
      unread: userId ? unreadFor(conv, userId) : 0,
      online: Boolean(presence.get(conv.visitorId)),
      invited: Boolean(conv.invited),
      rating: conv.rating?.stars || null,
      preview: last || null,
    };
  }

  // Tells every agent that a conversation changed (list row, header, badges).
  function announce(conv) {
    chat.toAgents("chat:updated", { conversationId: conv.conversationId, row: rowOf(conv) });
  }

  async function lastMessages(ids) {
    if (!ids.length) return new Map();
    const rows = await LcMessage.aggregate([
      { $match: { conversationId: { $in: ids }, sender: { $in: ["patient", "ai", "agent"] } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", sender: { $first: "$sender" }, text: { $first: "$text" }, at: { $first: "$createdAt" } } },
    ]);
    return new Map(rows.map((r) => [r._id, { sender: r.sender, text: decryptLiveChatText(r.text).slice(0, 120), at: r.at }]));
  }

  // "ai": chats that were never live. "live": chats that were ever live (queue, mine, others, handed back, archived).
  async function list(actor, view) {
    // "Archive temp": archived chats stay in the lists for 24 hours (the time a patient can still reopen one); the
    // Archive page has the rest. The newest-closed archived chats come first within their group.
    const since = istTodayStart(now()); // chats archived today (India time); at midnight the group empties
    const filter = {
      everLive: view === "live",
      mode: { $ne: "trashed" },
      $or: [{ mode: { $ne: "archived" } }, { closedAt: { $gte: since } }],
    };
    const convs = await LcConversation.find(filter).sort({ lastMessageAt: -1 }).limit(LIST_LIMIT);
    const lasts = await lastMessages(convs.map((c) => c.conversationId));
    return convs.map((c) => rowOf(c, { userId: actor.id, last: lasts.get(c.conversationId) }));
  }

  async function ticketCount(email) {
    if (!email) return 0;
    const User = require("../../models/User");
    const user = await User.findOne({ email: email.toLowerCase() }).select("_id").lean();
    if (!user) return 0;
    const Ticket = require("../../models/Ticket");
    const UserTicket = require("../../models/UserTicket");
    const [a, b] = await Promise.all([
      Ticket.countDocuments({ createdBy: user._id }),
      UserTicket.countDocuments({ createdBy: user._id }),
    ]);
    return a + b;
  }

  async function markReadDoc(conv, userId) {
    // Replace this admin's marker with the current count (aggregation-pipeline update, atomic).
    await LcConversation.updateOne({ _id: conv._id }, [
      {
        $set: {
          reads: {
            $concatArrays: [
              { $filter: { input: { $ifNull: ["$reads", []] }, cond: { $ne: ["$$this.userId", oid(userId)] } } },
              [{ userId: oid(userId), count: "$patientMessageCount" }],
            ],
          },
        },
      },
    ], { updatePipeline: true });
  }

  function summaryOf(conv, messages) {
    const patient = messages.filter((m) => m.sender === "patient").length;
    // the first AI message is the greeting, not a reply
    const aiReplies = Math.max(0, messages.filter((m) => m.sender === "ai").length - 1);
    const state =
      conv.mode === "queue"
        ? conv.offlineRequested || conv.followUpNoticeAt
          ? "Waiting for an agent. The patient was told an email follows."
          : "Waiting for an agent."
        : conv.mode === "live"
          ? `${conv.agentName || "An agent"} is handling it.`
          : conv.mode === "archived"
            ? "This chat has ended."
            : "The AI is handling it.";
    return `Patient sent ${patient} message${patient === 1 ? "" : "s"}; the AI replied ${aiReplies} time${aiReplies === 1 ? "" : "s"}. ${state}`;
  }

  // English translation already cached on a message (nothing is translated just by opening a chat).
  function cachedTranslation(m) {
    const t = (m.translations || []).find((x) => x.lang === "en");
    if (!t || t.same) return {};
    return { translation: { text: decryptLiveChatText(t.text), from: t.from, fromName: t.fromName } };
  }

  // The conversation plus everything the patient panel shows. Opening a chat marks it read for this admin.
  async function detail(actor, conversationId, { markRead: markAsRead = true } = {}) {
    const conv = await load(conversationId);
    if (markAsRead) await markReadDoc(conv, actor.id); // the Archive page only looks: it leaves unread counts alone
    if (!conv.language?.code) {
      // No language yet: one bounded detection (daily cap respected), waited for at most 4 s so the controls show at once.
      const found = await Promise.race([
        translation.detectOnOpen(conv).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000).unref?.()),
      ]);
      if (found?.language) conv.language = { code: found.language.code, name: found.language.name, detectedAt: new Date(now()) };
    }
    const [rows, visitor, chats, pages, others] = await Promise.all([
      LcMessage.find({ conversationId }).sort({ createdAt: 1 }).limit(500).lean(),
      chat.loadVisitor(conv.visitorId),
      LcConversation.countDocuments({ visitorId: conv.visitorId, mode: { $ne: "trashed" } }),
      LcPageVisit.find({ conversationId }).sort({ enteredAt: 1 }).lean(),
      LcConversation.find({ visitorId: conv.visitorId, conversationId: { $ne: conversationId }, mode: { $ne: "trashed" } })
        .sort({ startedAt: -1 })
        .limit(5)
        .lean(),
    ]);
    const files = await chat.filesMeta(rows);
    // Whether the composer should offer "Detect language": no language stored at all (an English chat stores "en"),
    // and a recent patient message that is clearly not English and long enough to tell.
    const languageUnknown =
      !conv.language?.code &&
      rows
        .filter((m) => m.sender === "patient" && !m.internal && !m.fileId)
        .slice(-4)
        .some((m) => {
          const text = decryptLiveChatText(m.text);
          return text.trim() && !tooShortToDetect(text) && !looksEnglish(text);
        });
    const messages = rows.map((m) => ({
      id: String(m._id),
      sender: m.sender,
      text: decryptLiveChatText(m.text),
      at: m.createdAt,
      agentName: m.agentName || "",
      internal: Boolean(m.internal),
      ...(m.fileId && files.get(String(m.fileId)) ? { file: files.get(String(m.fileId)) } : {}),
      ...(m.sourceText?.cipherText ? { sourceText: decryptLiveChatText(m.sourceText) } : {}),
      ...cachedTranslation(m),
    }));
    const contact = contactOf(visitor && chat.hasContact(visitor) ? visitor : conv.contact);
    const live = presence.get(conv.visitorId);
    const t = now();
    const timeline = pages.map((p, i) => ({
      path: p.path,
      title: p.title,
      enteredAt: p.enteredAt,
      // the page the visitor is on right now keeps counting
      seconds: i === pages.length - 1 && live && conv.mode !== "archived" ? Math.round((t - new Date(p.enteredAt)) / 1000) : p.seconds,
      current: i === pages.length - 1 && Boolean(live),
    }));
    const visits = visitor?.visits || 1;
    const settingsForFields = await loadSettings();
    return {
      aiName: aiNameOf(settingsForFields),
      conversation: { ...rowOf(conv, { userId: actor.id }), languageUnknown },
      view: translation.viewOf(conv, actor.id),
      messages,
      panel: {
        contact,
        location: { city: conv.geo?.city || "", state: conv.geo?.state || "", country: conv.geo?.country || "" },
        timeZone: conv.timeZone || "",
        counts: { chats, tickets: await ticketCount(contact.email), visits },
        returning: visits > 1 || chats > 1,
        context: {
          topic: conv.topic || "",
          source: conv.source || "",
          cookieChoice: conv.cookieChoice || "unknown",
          summary: summaryOf(conv, messages),
        },
        info: {
          assignee: conv.assigneeId ? { id: String(conv.assigneeId), name: conv.agentName || "Agent" } : null,
          chatId: conv.conversationId,
          rating: conv.rating?.stars ? { stars: conv.rating.stars, ratedAt: conv.rating.ratedAt } : null,
          startedAt: conv.startedAt,
          liveStartedAt: conv.liveStartedAt,
          closedAt: conv.closedAt,
          startedPage: conv.startedPage || { path: "", title: "" },
          // The AI notice the patient accepted when they started the chat (only while "Show AI notice" is on).
          aiNotice: conv.consent?.aiNoticeAcceptedAt ? { acceptedAt: conv.consent.aiNoticeAcceptedAt, policyVersion: conv.consent.policyVersion || "" } : null,
          // Flagged for the AI Review page, and where the review stands.
          safety: conv.flags?.medical
            ? {
                reasons: conv.flags.reasons || [],
                reviewStatus: conv.review?.status || "unreviewed",
                reviewOutcome: conv.review?.lastOutcome || "",
                reviewedAt: conv.review?.lastAt || null,
              }
            : null,
        },
        tags: conv.tags || [],
        fields: contextFieldsOf(visitor, settingsForFields),
        fieldDefs: settingsForFields.customFields || [],
        recent: others.map((o) => ({
          conversationId: o.conversationId,
          topic: o.topic || "",
          startedAt: o.startedAt,
          status: o.mode === "archived" ? (o.everLive ? "Resolved" : "Solved by AI") : "Open",
        })),
        pages: timeline,
        visit: {
          device: conv.device?.type || "",
          os: conv.device?.os || "",
          browser: conv.device?.browser || "",
          referrer: conv.referrer || "",
          joinedAt: live?.joinedAt || conv.startedAt,
          online: Boolean(live),
          ip: conv.ip,
        },
      },
    };
  }

  async function markRead(actor, conversationId) {
    const conv = await load(conversationId);
    await markReadDoc(conv, actor.id);
    return { ok: true };
  }

  // Unread messages for this admin: AI chats, and live agent chats that concern them (queue, their own chats,
  // chats handed back to the AI). Chats another agent is holding do not count.
  async function unread(actor) {
    const convs = await LcConversation.find({ mode: { $nin: ["archived", "trashed"] }, patientMessageCount: { $gt: 0 } })
      .select("everLive mode assigneeId patientMessageCount reads")
      .lean();
    const out = { ai: 0, live: 0 };
    for (const c of convs) {
      const n = unreadFor(c, actor.id);
      if (!n) continue;
      if (!c.everLive) out.ai += n;
      else if (c.mode === "queue" || c.mode === "ai" || sameId(c.assigneeId, actor.id)) out.live += n;
    }
    return out;
  }

  // ── Assignment ────────────────────────────────────────────────────────────────

  async function updated(conv, extra) {
    const fresh = await LcConversation.findById(conv._id);
    chat.setActivity(fresh.visitorId, fresh);
    await chat.pushState(fresh);
    chat.toAgents("chat:updated", { conversationId: fresh.conversationId, row: rowOf(fresh), ...extra });
    return fresh;
  }

  const inactiveDueFor = (settings) =>
    new Date(now() + Math.min(60, Math.max(5, Math.round(Number(settings?.inactiveMinutes) || 10))) * 60_000);

  // Must run inside chat.withLock(conversationId).
  async function takeOverLocked(actor, conv, settings) {
    const me = String(actor.id);
    if (conv.mode === "archived") {
      if (!isJoinable(conv)) throw new AgentError(409, "closed");
      // Joining reopens the chat as a live chat assigned to this admin.
      const name = await displayNameOf(me, settings);
      const joined = await LcConversation.findOneAndUpdate(
        { _id: conv._id, mode: "archived", closedReason: "inactive", modeBeforeLeft: "queue" },
        {
          $set: {
            mode: "live",
            assigneeId: oid(me),
            agentName: name,
            everLive: true,
            closedReason: "",
            closedAt: null,
            leftAt: null,
            modeBeforeLeft: "",
            offlineRequested: false,
            followUpDueAt: null,
            leaveDueAt: null,
            inactiveDueAt: inactiveDueFor(settings),
            liveStartedAt: conv.liveStartedAt || new Date(now()),
          },
        },
        { returnDocument: "after" }
      );
      if (!joined) throw new AgentError(409, "closed");
      await chat.addMessage(joined, "system", `${name} joined the chat`);
      return { conv: joined };
    }
    const name = await displayNameOf(me, settings);

    if (conv.mode === "live") {
      if (sameId(conv.assigneeId, me)) return { conv, already: true };
      if (actor.role !== "superadmin") {
        throw new AgentError(409, "assigned", { assignee: { name: conv.agentName || "another agent" } });
      }
      // A superadmin takes the chat over from the agent who holds it.
      const previous = { id: String(conv.assigneeId), name: conv.agentName || "another agent" };
      const taken = await LcConversation.findOneAndUpdate(
        { _id: conv._id, mode: "live", assigneeId: conv.assigneeId },
        { $set: { assigneeId: oid(me), agentName: name, inactiveDueAt: inactiveDueFor(settings) } },
        { returnDocument: "after" }
      );
      if (!taken) throw new AgentError(409, "assigned", { assignee: { name: "another agent" } });
      await chat.addMessage(taken, "system", `${name} took over from ${previous.name}`, { internal: true });
      await chat.addMessage(taken, "system", `${name} joined the chat`);
      emitToAgent(previous.id, "chat:taken", { conversationId: conv.conversationId, by: name });
      return { conv: taken, tookOverFrom: previous };
    }

    // AI chat or queue entry nobody holds: the first admin wins.
    const won = await LcConversation.findOneAndUpdate(
      { _id: conv._id, mode: { $in: ["ai", "queue"] }, assigneeId: null },
      {
        $set: {
          mode: "live",
          assigneeId: oid(me),
          agentName: name,
          everLive: true,
          offlineRequested: false,
          followUpDueAt: null,
          inactiveDueAt: inactiveDueFor(settings), // joining counts like an admin message for the inactivity timer
          liveStartedAt: conv.liveStartedAt || new Date(now()),
        },
      },
      { returnDocument: "after" }
    );
    if (!won) {
      const fresh = await LcConversation.findById(conv._id).lean();
      if (fresh?.mode === "archived") throw new AgentError(409, "closed");
      throw new AgentError(409, "assigned", { assignee: { name: fresh?.agentName || "another agent" } });
    }
    await chat.addMessage(won, "system", `${name} joined the chat`);
    return { conv: won };
  }

  async function takeOver(actor, conversationId) {
    await load(conversationId);
    return chat.withLock(conversationId, async () => {
      const conv = await load(conversationId);
      const settings = await loadSettings();
      const result = await takeOverLocked(actor, conv, settings);
      const fresh = await updated(result.conv);
      return { ok: true, already: Boolean(result.already), conversation: rowOf(fresh, { userId: actor.id }) };
    });
  }

  // Reply to the patient. In an AI chat or the queue this takes the chat over first (same atomic step).
  async function sendMessage(actor, conversationId, rawText, rawSource) {
    const text = cleanText(rawText);
    // The admin's own English text of a translated reply (optional); stored next to what the patient receives.
    const sourceText = typeof rawSource === "string" && rawSource.trim() ? cleanText(rawSource) : "";
    await load(conversationId);
    return chat.withLock(conversationId, async () => {
      let conv = await load(conversationId);
      const settings = await loadSettings();
      if (conv.mode === "archived" && !isJoinable(conv)) throw new AgentError(409, "closed");
      const me = String(actor.id);
      if (conv.mode === "live" && !sameId(conv.assigneeId, me)) {
        throw new AgentError(409, "not_assignee", { assignee: { name: conv.agentName || "another agent" } });
      }
      if (conv.mode !== "live") conv = (await takeOverLocked(actor, conv, settings)).conv;
      const name = conv.agentName || (await displayNameOf(me, settings));
      const message = await chat.addMessage(conv, "agent", text, { agentId: oid(me), agentName: name, ...(sourceText ? { sourceText } : {}) });
      await LcConversation.updateOne({ _id: conv._id, firstAgentReplyAt: null }, { $set: { firstAgentReplyAt: new Date(now()) } });
      // A chat the admin started: until the visitor replies, show the bubble above their launcher. The bubble carries
      // only the agent's name; the text is revealed after the contact form (the visitor id alone must not unlock it).
      if (conv.invited && !conv.patientMessageCount) {
        chat.toTrackers(conv.visitorId, "chat:invite", { conversationId: conv.conversationId, agentName: name });
      }
      const fresh = await updated(conv);
      return { ok: true, message: { ...message, ...(sourceText ? { sourceText } : {}) }, conversation: rowOf(fresh, { userId: actor.id }) };
    });
  }

  // An agent sends a file (pdf, jpg or png) to the patient. Same rules as a reply: only the assignee, and sending takes
  // over a chat that is with the AI or in the Queue. The chat shows the file name; the patient opens it by a short link.
  async function sendFile(actor, conversationId, file) {
    if (!files) throw new AgentError(503, "files_unavailable");
    await load(conversationId);
    return chat.withLock(conversationId, async () => {
      let conv = await load(conversationId);
      const settings = await loadSettings();
      if (conv.mode === "archived" && !isJoinable(conv)) throw new AgentError(409, "closed");
      const me = String(actor.id);
      if (conv.mode === "live" && !sameId(conv.assigneeId, me)) {
        throw new AgentError(409, "not_assignee", { assignee: { name: conv.agentName || "another agent" } });
      }
      const { doc, meta } = await files.storeForAgent({ conv, actor, file });
      if (conv.mode !== "live") conv = (await takeOverLocked(actor, conv, settings)).conv;
      const name = conv.agentName || (await displayNameOf(me, settings));
      const message = await chat.addMessage(conv, "agent", meta.name, { agentId: oid(me), agentName: name, fileId: doc._id, file: meta });
      await LcConversation.updateOne({ _id: conv._id, firstAgentReplyAt: null }, { $set: { firstAgentReplyAt: new Date(now()) } });
      const fresh = await updated(conv);
      return { ok: true, message, conversation: rowOf(fresh, { userId: actor.id }) };
    });
  }

  async function handBack(actor, conversationId) {
    await load(conversationId);
    return chat.withLock(conversationId, async () => {
      const conv = await load(conversationId);
      if (conv.mode !== "live") throw new AgentError(409, "not_live");
      if (!sameId(conv.assigneeId, actor.id) && actor.role !== "superadmin") {
        throw new AgentError(409, "not_assignee", { assignee: { name: conv.agentName || "another agent" } });
      }
      const handed = await LcConversation.findOneAndUpdate(
        { _id: conv._id, mode: "live" },
        { $set: { mode: "ai", assigneeId: null, agentName: "" } },
        { returnDocument: "after" }
      );
      if (!handed) throw new AgentError(409, "not_live");
      await chat.addMessage(handed, "system", "Handed back to the AI assistant");
      const fresh = await updated(handed);
      return { ok: true, conversation: rowOf(fresh, { userId: actor.id }) };
    });
  }

  async function resolve(actor, conversationId) {
    await load(conversationId);
    return chat.withLock(conversationId, async () => {
      const conv = await load(conversationId);
      if (conv.mode === "archived") return { ok: true, already: true, conversation: rowOf(conv, { userId: actor.id }) };
      if (conv.mode === "live" && !sameId(conv.assigneeId, actor.id) && actor.role !== "superadmin") {
        throw new AgentError(409, "not_assignee", { assignee: { name: conv.agentName || "another agent" } });
      }
      const closed = await LcConversation.findOneAndUpdate(
        { _id: conv._id, mode: { $nin: ["archived", "trashed"] } },
        { $set: { mode: "archived", closedReason: "resolved", closedAt: new Date(now()) } },
        { returnDocument: "after" }
      );
      if (!closed) return { ok: true, already: true };
      await chat.addMessage(closed, "system", "Chat resolved");
      const fresh = await updated(closed);
      return { ok: true, conversation: rowOf(fresh, { userId: actor.id }) };
    });
  }

  // Any admin can leave a note on any chat; it is stored as sender "note" and never sent to the patient.
  async function addNote(actor, conversationId, rawText) {
    const text = cleanText(rawText);
    const conv = await load(conversationId);
    const settings = await loadSettings();
    const name = await displayNameOf(actor.id, settings);
    const message = await chat.addMessage(conv, "note", text, { agentId: oid(actor.id), agentName: name });
    return { ok: true, message: { ...message, internal: true } };
  }

  // ── Patient panel edits ───────────────────────────────────────────────────────

  async function setTags(actor, conversationId, rawTags) {
    if (!Array.isArray(rawTags)) throw new AgentError(400, "invalid_tags");
    const tags = [];
    for (const raw of rawTags) {
      const tag = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 40) : "";
      if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    }
    if (tags.length > MAX_TAGS) throw new AgentError(400, "too_many_tags");
    const conv = await load(conversationId);
    await LcConversation.updateOne({ _id: conv._id }, { $set: { tags } });
    const fresh = await LcConversation.findById(conv._id);
    chat.toAgents("chat:updated", { conversationId, row: rowOf(fresh) });
    return { ok: true, tags };
  }

  async function updateContact(actor, conversationId, body) {
    const check = validateContact(body || {});
    if (!check.ok) throw new AgentError(400, "invalid_contact", { errors: check.errors });
    const { values } = check;
    const conv = await load(conversationId);
    const enc = {
      name: encryptLiveChatText(values.name),
      email: encryptLiveChatText(values.email),
      phone: encryptLiveChatText(values.phone),
    };
    await LcVisitor.updateOne(
      { visitorId: conv.visitorId },
      { $set: { ...enc, emailHash: hashLiveChatEmail(values.email) }, $setOnInsert: { firstSeenAt: new Date(now()) } },
      { upsert: true }
    );
    await LcConversation.updateMany({ visitorId: conv.visitorId, mode: { $nin: ["archived", "trashed"] } }, { $set: { contact: enc, searchKeys: searchKeysOf(values.email, values.phone) } });
    if (presence.get(conv.visitorId)) presence.update(conv.visitorId, { name: values.name, email: values.email });
    const fresh = await LcConversation.findById(conv._id);
    chat.toAgents("chat:updated", { conversationId, row: rowOf(fresh) });
    return { ok: true, contact: values };
  }

  // Time zone of a visitor who has not started a chat: the first zone of their country (good enough for "their time").
  function zoneOfCountry(code) {
    if (!/^[A-Z]{2}$/.test(code || "")) return "";
    try {
      const { Country } = require("country-state-city");
      return Country.getCountryByCode(code)?.timezones?.[0]?.zoneName || "";
    } catch {
      return "";
    }
  }

  // ── Patient context (follow-up date, preferred language, ..., custom fields) ───

  const CONTEXT_TEXT_MAX = 200;
  const CONTEXT_FIELDS = ["preferredLanguage", "contactPreference", "reasonForContact"];

  // What is stored for a patient, decrypted, with the custom fields keyed by their field key.
  function contextFieldsOf(visitor, settings) {
    const ctx = visitor?.context || {};
    const custom = {};
    for (const def of settings?.customFields || []) {
      const entry = (ctx.custom || []).find((c) => c.key === def.key);
      custom[def.key] = entry ? decryptLiveChatText(entry.value) : "";
    }
    return {
      followUpDate: decryptLiveChatText(ctx.followUpDate),
      preferredLanguage: decryptLiveChatText(ctx.preferredLanguage),
      contactPreference: decryptLiveChatText(ctx.contactPreference),
      reasonForContact: decryptLiveChatText(ctx.reasonForContact),
      custom,
    };
  }

  // eslint-disable-next-line no-control-regex
  const cleanLine = (value) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

  // Saves some of a patient's context fields (a partial update). Every value is free text from the team, so it is
  // length-limited and stored encrypted; custom fields must be ones a Super Admin defined.
  async function updateContext(actor, visitorId, body) {
    const id = String(visitorId || "");
    if (!presence.get(id) && !(await chat.loadVisitor(id))) throw new AgentError(404, "not_found");
    const input = body && typeof body === "object" ? body : {};
    const settings = await loadSettings();
    const set = {};
    const errors = {};
    if (Object.prototype.hasOwnProperty.call(input, "followUpDate")) {
      const date = cleanLine(input.followUpDate);
      const valid = date === "" || (/^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date));
      if (valid) set["context.followUpDate"] = encryptLiveChatText(date);
      else errors.followUpDate = "Enter a valid date.";
    }
    for (const field of CONTEXT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
      const value = cleanLine(input[field]);
      if ([...value].length > CONTEXT_TEXT_MAX) errors[field] = `Up to ${CONTEXT_TEXT_MAX} characters.`;
      else set[`context.${field}`] = encryptLiveChatText(value);
    }
    if (input.custom && typeof input.custom === "object") {
      const defs = new Set((settings.customFields || []).map((d) => d.key));
      const existing = await chat.loadVisitor(id);
      const merged = new Map((existing?.context?.custom || []).map((c) => [c.key, decryptLiveChatText(c.value)]));
      for (const [key, raw] of Object.entries(input.custom)) {
        if (!defs.has(key)) {
          errors[`custom.${key}`] = "Unknown field.";
          continue;
        }
        const value = cleanLine(raw);
        if ([...value].length > CONTEXT_TEXT_MAX) errors[`custom.${key}`] = `Up to ${CONTEXT_TEXT_MAX} characters.`;
        else if (value) merged.set(key, value);
        else merged.delete(key);
      }
      set["context.custom"] = [...merged].filter(([key]) => defs.has(key)).map(([key, value]) => ({ key, value: encryptLiveChatText(value) }));
    }
    if (Object.keys(errors).length) throw new AgentError(400, "invalid_context", { errors });
    if (Object.keys(set).length) {
      await LcVisitor.updateOne({ visitorId: id }, { $set: set, $setOnInsert: { firstSeenAt: new Date(now()) } }, { upsert: true });
    }
    return { ok: true, fields: contextFieldsOf(await chat.loadVisitor(id), settings) };
  }

  // ── "Tell me about this patient" ──────────────────────────────────────────────

  // A short AI summary of the chat, made when asked and not saved. Only the chat text goes to the model, with the
  // patient's name, email and phone replaced first; it counts toward the daily AI cap like every other AI call.
  async function summarizeConversation(actor, conv) {
    if (!summaryLimiter.allow(String(actor.id))) throw new AgentError(429, "rate_limited");
    const settings = await loadSettings();
    if ((await limits.spendStatus(settings)).capReached) throw new AgentError(503, "ai_unavailable", { kind: "spend_cap" });
    const visitor = await chat.loadVisitor(conv.visitorId);
    const contact = contactOf(visitor && chat.hasContact(visitor) ? visitor : conv.contact);
    const history = (await chat.recentHistory(conv, 30)).map((m) => ({ role: m.sender, text: scrubContact(m.text, contact, (kind) => `[${kind}]`) }));
    if (!history.length) throw new AgentError(409, "no_content");
    const result = await ai.summarizeChat({ history });
    if (result.usage) await chat.recordUsage(conv, settings, result.usage);
    if (!result.ok) throw new AgentError(503, "ai_unavailable", { kind: result.kind });
    return { ok: true, summary: result.summary };
  }

  async function summarize(actor, conversationId) {
    return summarizeConversation(actor, await load(conversationId));
  }

  // From Real-time visitors: the visitor's latest chat. A visitor with no chat has nothing to summarize.
  async function summarizeVisitor(actor, visitorId) {
    const conv = await LcConversation.findOne({ visitorId: String(visitorId || ""), mode: { $ne: "trashed" } }).sort({ startedAt: -1 });
    if (!conv) throw new AgentError(409, "no_chat");
    return summarizeConversation(actor, conv);
  }

  // The right-hand panel of Real-time visitors: works for a visitor who is only browsing (memory) or who has a record.
  async function visitorPanel(actor, visitorId) {
    const id = String(visitorId || "");
    const record = presence.get(id);
    const visitor = await chat.loadVisitor(id);
    if (!record && !visitor) throw new AgentError(404, "not_found");
    const contact = contactOf(visitor);
    const [chats, recent, tickets] = await Promise.all([
      LcConversation.countDocuments({ visitorId: id, mode: { $ne: "trashed" } }),
      LcConversation.find({ visitorId: id, mode: { $ne: "trashed" } }).sort({ startedAt: -1 }).limit(5).lean(),
      ticketCount(contact.email),
    ]);
    const visits = visitor?.visits || 1;
    const panelSettings = await loadSettings();
    const geo = record?.geo || visitor?.geo || {};
    const t = now();
    const pages = (record?.pages || []).map((p, i, all) => ({
      path: p.path,
      title: p.title,
      enteredAt: p.enteredAt,
      seconds: i === all.length - 1 ? Math.round((t - p.enteredAt) / 1000) : p.seconds,
      current: i === all.length - 1,
    }));
    return {
      ok: true,
      panel: {
        visitorId: id,
        contact,
        fields: contextFieldsOf(visitor, panelSettings),
        fieldDefs: panelSettings.customFields || [],
        location: { city: geo.city || "", state: geo.state || "", country: geo.country || "", countryCode: geo.countryCode || "" },
        timeZone: zoneOfCountry(geo.countryCode),
        counts: { chats, tickets, visits },
        returning: visits > 1 || chats > 1,
        pages,
        recent: recent.map((o) => ({
          conversationId: o.conversationId,
          topic: o.topic || "",
          startedAt: o.startedAt,
          status: o.mode === "archived" ? (o.everLive ? "Resolved" : "Solved by AI") : "Open",
        })),
        visit: {
          online: Boolean(record),
          device: record?.device || visitor?.device?.type || "",
          os: record?.os || visitor?.device?.os || "",
          browser: record?.browser || visitor?.device?.browser || "",
          referrer: record?.referrer || "",
          joinedAt: record?.joinedAt || null,
          ip: record?.ip || visitor?.lastIp || "",
        },
      },
      serverTime: t,
    };
  }

  // Saves contact details for a visitor who may not have a chat yet (the pencil on Real-time visitors).
  async function updateVisitorContact(actor, visitorId, body) {
    const id = String(visitorId || "");
    if (!presence.get(id) && !(await chat.loadVisitor(id))) throw new AgentError(404, "not_found");
    const check = validateContact(body || {});
    if (!check.ok) throw new AgentError(400, "invalid_contact", { errors: check.errors });
    const { values } = check;
    const enc = {
      name: encryptLiveChatText(values.name),
      email: encryptLiveChatText(values.email),
      phone: encryptLiveChatText(values.phone),
    };
    await LcVisitor.updateOne(
      { visitorId: id },
      { $set: { ...enc, emailHash: hashLiveChatEmail(values.email) }, $setOnInsert: { firstSeenAt: new Date(now()) } },
      { upsert: true }
    );
    await LcConversation.updateMany({ visitorId: id, mode: { $nin: ["archived", "trashed"] } }, { $set: { contact: enc, searchKeys: searchKeysOf(values.email, values.phone) } });
    if (presence.get(id)) presence.update(id, { name: values.name, email: values.email });
    return { ok: true, contact: values };
  }

  // ── Transcript download ───────────────────────────────────────────────────────

  // The chat as plain text for the admin to keep. Internal notes and team-only lines are NOT included. The file name
  // is the chat ID only (never a patient name). Every download is recorded on the chat (who, when).
  async function transcript(actor, conversationId) {
    const conv = await load(conversationId);
    const settings = await loadSettings();
    const rows = await LcMessage.find({ conversationId, sender: { $ne: "note" }, internal: { $ne: true } })
      .sort({ createdAt: 1 })
      .limit(2000)
      .lean();
    const files = await chat.filesMeta(rows);
    const stamp = (d) => new Date(d).toISOString().replace("T", " ").slice(0, 19);
    const lines = rows.map((m) => {
      const who = m.sender === "patient" ? "Patient" : m.sender === "ai" ? aiNameOf(settings) : m.sender === "agent" ? m.agentName || "Agent" : "System";
      const file = m.fileId && files.get(String(m.fileId));
      const body = file ? `[File: ${file.name}]` : decryptLiveChatText(m.text);
      return `[${stamp(m.createdAt)} UTC] ${who}: ${body}`;
    });
    await LcConversation.updateOne(
      { _id: conv._id },
      { $push: { transcriptLog: { $each: [{ userId: oid(actor.id), at: new Date(now()) }], $slice: -50 } } }
    );
    const text = [
      `Humancare live chat ${conv.conversationId}`,
      `Started: ${stamp(conv.startedAt)} UTC`,
      conv.closedAt ? `Closed: ${stamp(conv.closedAt)} UTC` : "Status: open",
      "",
      ...lines,
      "",
    ].join("\n");
    return { filename: `chat-${conv.conversationId}.txt`, text };
  }

  // ── Canned replies, suggestions ───────────────────────────────────────────────

  // Canned replies plus this agent's display name, which replaces {agentName} when a reply is inserted.
  async function canned(actor) {
    const rows = await LcCannedReply.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
    const settings = await loadSettings();
    return {
      agentName: await displayNameOf(actor.id, settings),
      replies: rows.map((r) => ({ id: String(r._id), title: r.title, text: r.text })),
    };
  }

  // ── Translation (admin side only) ─────────────────────────────────────────────

  async function translate(actor, conversationId, ids) {
    const conv = await load(conversationId);
    const clean = Array.isArray(ids) ? ids.filter((id) => /^[a-f0-9]{24}$/i.test(String(id))).slice(0, 300) : [];
    return { ok: true, ...(await translation.translateMessages(actor, conv, clean)) };
  }

  // The composer's "Detect language" link. Returns the language (or why none was found).
  async function detectLanguage(actor, conversationId) {
    const conv = await load(conversationId);
    if (!translation.limiter.allow(String(actor.id))) throw new AgentError(429, "rate_limited");
    const found = await translation.detectOnOpen(conv, { manual: true });
    return { ok: true, language: found.language, reason: found.reason };
  }

  async function translateReply(actor, conversationId, text) {
    const conv = await load(conversationId);
    return { ok: true, ...(await translation.translateReply(actor, conv, text)) };
  }

  async function setTranslateView(actor, conversationId, view) {
    const conv = await load(conversationId);
    return translation.setView(actor, conv, view);
  }

  async function suggest(actor, conversationId) {
    if (!suggestLimiter.allow(String(actor.id))) throw new AgentError(429, "rate_limited");
    const conv = await load(conversationId);
    const settings = await loadSettings();
    if ((await limits.spendStatus(settings)).capReached) throw new AgentError(503, "ai_unavailable", { kind: "spend_cap" });
    // The patient's name, email and phone never go to the model: they are replaced in the chat text first.
    const visitor = await chat.loadVisitor(conv.visitorId);
    const contact = contactOf(visitor && chat.hasContact(visitor) ? visitor : conv.contact);
    const history = (await chat.recentHistory(conv)).map((m) => ({ role: m.sender, text: scrubContact(m.text, contact, (kind) => `[${kind}]`) }));
    const result = await ai.suggestReply({ settings, history, agentName: conv.agentName || (await displayNameOf(actor.id, settings)) });
    if (result.usage) await chat.recordUsage(conv, settings, result.usage);
    if (!result.ok) throw new AgentError(503, "ai_unavailable", { kind: result.kind });
    return { ok: true, reply: result.reply };
  }

  // ── Admin-started chat with a visitor who already has contact details ────────

  async function startChat(actor, visitorId) {
    const id = String(visitorId || "");
    const visitor = await chat.loadVisitor(id);
    const known = chat.hasContact(visitor);
    const record = presence.get(id);
    // Someone who is not on the website (or not tracked) cannot be invited: there is no way to reach them.
    if (!known && !record) throw new AgentError(409, "contact_required");
    const open = await LcConversation.findOne({ visitorId: id, mode: { $nin: ["archived", "trashed"] } });
    if (open) return { ok: true, existing: true, conversationId: open.conversationId };

    const settings = await loadSettings();
    const name = await displayNameOf(actor.id, settings);
    const conv = await LcConversation.create({
      conversationId: newConversationId(),
      visitorId: id,
      mode: "live",
      everLive: true,
      invited: true, // until the visitor replies
      assigneeId: oid(actor.id),
      agentName: name,
      liveStartedAt: new Date(now()),
      ip: record?.ip || visitor?.lastIp || "",
      geo: { city: record?.geo?.city || "", state: record?.geo?.state || "", country: record?.geo?.country || "" },
      device: { type: record?.device || "", os: record?.os || "", browser: record?.browser || "" },
      source: record?.source || "",
      referrer: record?.referrer || "",
      startedPage: { path: record?.page?.path || "", title: record?.page?.title || "" },
      ...(known
        ? {
            contact: { name: visitor.name, email: visitor.email, phone: visitor.phone },
            searchKeys: searchKeysOf(decryptLiveChatText(visitor.email), decryptLiveChatText(visitor.phone)),
          }
        : {}),
    });
    if (known) await LcVisitor.updateOne({ visitorId: id }, { $inc: { chatCount: 1 } });
    await chat.backfillPages(conv, record?.pages);
    await chat.addMessage(conv, "system", `${name} started the chat`);
    const fresh = await updated(conv);
    chat.toAgents("chat:new", { conversationId: conv.conversationId, visitorId: id, mode: "live", everLive: true, name });
    return { ok: true, conversationId: fresh.conversationId, invited: !known };
  }

  // ── Blocking abusive visitors ─────────────────────────────────────────────────

  // Blocks the IP of a chat or of a visitor on the list: no new connections, form posts or uploads from it; its open
  // chats are closed and its sockets dropped. Lasts until an admin unblocks it.
  async function blockIp(actor, { conversationId, visitorId, reason }) {
    let ip = "";
    if (conversationId) ip = (await load(conversationId)).ip;
    else if (visitorId) {
      ip = presence.get(String(visitorId))?.ip || (await LcVisitor.findOne({ visitorId: String(visitorId) }).select("lastIp").lean())?.lastIp || "";
    }
    if (!ip || !net.isIP(ip)) throw new AgentError(400, "no_ip");
    const settings = await loadSettings();
    const name = await displayNameOf(actor.id, settings);
    await ipBlock.block({ ip, reason, by: oid(actor.id) });

    let closed = 0;
    const open = await LcConversation.find({ ip, mode: { $nin: ["archived", "trashed"] } });
    for (const conv of open) {
      await chat.withLock(conv.conversationId, async () => {
        const archived = await LcConversation.findOneAndUpdate(
          { _id: conv._id, mode: { $nin: ["archived", "trashed"] } },
          { $set: { mode: "archived", closedReason: "blocked", closedAt: new Date(now()) } },
          { returnDocument: "after" }
        );
        if (!archived) return;
        closed += 1;
        await chat.addMessage(archived, "system", `IP blocked by ${name}`, { internal: true });
        announce(archived);
      });
    }
    for (const record of presence.list()) if (record.ip === ip) presence.remove(record.visitorId);
    disconnectIp(ip);
    return { ok: true, ip, closed };
  }

  const blockedIps = async () => ({ ok: true, blocked: await ipBlock.list() });

  async function unblockIp(actor, id) {
    if (!mongoose.isValidObjectId(id)) throw new AgentError(404, "not_found");
    const removed = await ipBlock.unblock(id);
    if (!removed) throw new AgentError(404, "not_found");
    return { ok: true };
  }

  // ── An agent goes offline or logs out ─────────────────────────────────────────

  // Their open chats go back to the Queue after a grace period (LcSettings handoffRules.agentOfflineGraceSeconds,
  // default 120 s). Coming back in time cancels it.
  const pendingRequeue = new Map(); // userId -> { token, timer }

  function agentBack(userId) {
    const pending = pendingRequeue.get(userId);
    if (pending) clearTimeout(pending.timer);
    pendingRequeue.delete(userId);
  }

  async function agentGone(userId) {
    agentBack(userId);
    const token = Symbol("requeue");
    pendingRequeue.set(userId, { token, timer: null });
    let seconds = 120;
    try {
      const settings = await loadSettings();
      seconds = Number(settings.handoffRules?.agentOfflineGraceSeconds ?? 120);
    } catch {
      /* keep the default */
    }
    const pending = pendingRequeue.get(userId);
    if (!pending || pending.token !== token) return; // they came back while the settings loaded
    pending.timer = setTimeout(() => {
      pendingRequeue.delete(userId);
      if (!agents.isAvailable(userId)) requeueAgentChats(userId).catch(() => {});
    }, Math.max(0, seconds) * 1000);
    pending.timer.unref?.();
  }

  async function requeueAgentChats(userId) {
    const held = await LcConversation.find({ mode: "live", assigneeId: oid(userId) });
    let count = 0;
    for (const conv of held) {
      await chat.withLock(conv.conversationId, async () => {
        const current = await LcConversation.findById(conv._id);
        if (!current || current.mode !== "live" || !sameId(current.assigneeId, userId)) return;
        if (agents.isAvailable(userId)) return; // back just in time
        const settings = await loadSettings();
        const previousName = current.agentName || "The agent";
        // Back in the Queue: the follow-up step applies again, unless the email notice was already given for this chat.
        const queued = await LcConversation.findOneAndUpdate(
          { _id: current._id, mode: "live", assigneeId: current.assigneeId },
          { $set: { mode: "queue", assigneeId: null, agentName: "", queuedAt: new Date(now()), followUpDueAt: chat.followUpDueFor(current, settings), inactiveDueAt: null } },
          { returnDocument: "after" }
        );
        if (!queued) return;
        count += 1;
        await chat.addMessage(queued, "system", "Your agent was disconnected. We're reconnecting you with our team now.");
        await chat.addMessage(queued, "system", `${previousName} went offline. The chat is back in the queue.`, { internal: true });
        chat.setActivity(queued.visitorId, queued);
        await chat.pushState(queued);
        announce(queued);
        chat.toAgents("queue:new", {
          conversationId: queued.conversationId,
          visitorId: queued.visitorId,
          name: firstNameOf(decryptLiveChatText(queued.contact?.name)),
          everLive: true,
          reason: "agent_offline",
        });
      });
    }
    return count;
  }

  function shutdown() {
    for (const pending of pendingRequeue.values()) clearTimeout(pending.timer);
    pendingRequeue.clear();
  }

  // Typing indicator towards the patient: only the agent who holds the chat, a boolean only.
  async function relayTyping(actor, conversationId, typing) {
    if (!CONVERSATION_ID_RE.test(String(conversationId))) return;
    const conv = await LcConversation.findOne({ conversationId }).select("visitorId mode assigneeId agentName").lean();
    if (!conv || conv.mode !== "live" || !sameId(conv.assigneeId, actor.id)) return;
    chat.toVisitor(conv.visitorId, "chat:typing", { from: "agent", typing: typing === true, name: conv.agentName });
  }

  return {
    list,
    detail,
    markRead,
    unread,
    takeOver,
    sendMessage,
    sendFile,
    handBack,
    resolve,
    addNote,
    setTags,
    updateContact,
    visitorPanel,
    updateContext,
    summarize,
    summarizeVisitor,
    transcript,
    updateVisitorContact,
    canned,
    suggest,
    translate,
    translateReply,
    detectLanguage,
    setTranslateView,
    startChat,
    relayTyping,
    blockIp,
    blockedIps,
    unblockIp,
    agentGone,
    agentBack,
    requeueAgentChats,
    announce,
    rowOf,
    shutdown,
  };
}

module.exports = { createAgentService, AgentError, CONVERSATION_ID_RE };
