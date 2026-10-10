// Translation for admins (AI chats and Live agent chats). Admin side only: nothing here is ever sent to a patient.
//
//   translateMessages  English view: translates the non-English messages of a chat, caches each on the message
//   translateReply     the admin's English reply -> the patient's language (never sent automatically)
//   detectFor          one small model call to find the patient's language when no AI turn has done so
//   viewOf / setView   the English / original choice per admin per chat
//
// Rules: only message text goes to the model (never a name, email, phone or chat id); links, prices and email
// addresses are protected; results are cached on the message (encrypted); every call counts toward the daily
// cap and is refused once it is reached; requests are rate-limited per admin; internal notes and team-only lines
// are never translated.
const { encryptLiveChatText, decryptLiveChatText } = require("../../utils/liveChat/crypto");
const { createWindowLimiter } = require("./limits");
const { looksEnglish, tooShortToTell, protect, restore } = require("./languageHints");

const CHUNK_ITEMS = 20;
const CHUNK_CHARS = 8000;
const MAX_MESSAGES = 300;
const MAX_REPLY_CHARS = 2000;
const MAX_DETECT_TRIES = 2;

function createTranslationService({ models, ai, limits, loadSettings, chat, fail, now = () => Date.now(), perMinute = 30 }) {
  const { LcMessage, LcConversation } = models;
  const limiter = createWindowLimiter({ windowMs: 60_000, max: perMinute, now });
  const detectTries = new Map(); // conversationId -> attempts without a result

  const unavailable = (kind) => fail(503, "translation_unavailable", kind ? { kind } : {});

  async function spendOk(settings) {
    return !(await limits.spendStatus(settings)).capReached;
  }

  const translatable = (m) =>
    ["patient", "ai", "agent"].includes(m.sender) && !m.internal && !m.fileId && Boolean(m.text?.cipherText);

  const cachedEnglish = (m) => (m.translations || []).find((t) => t.lang === "en");

  async function saveTranslation(message, entry) {
    await LcMessage.updateOne(
      { _id: message._id, "translations.lang": { $ne: entry.lang } },
      { $push: { translations: { lang: entry.lang, same: Boolean(entry.same), from: entry.from || "", fromName: entry.fromName || "", text: encryptLiveChatText(entry.text || "") } } }
    );
  }

  // English view. ids optional: only those messages (a new patient message arriving while English is selected).
  async function translateMessages(actor, conv, ids) {
    if (!limiter.allow(String(actor.id))) throw fail(429, "rate_limited");
    const filter = { conversationId: conv.conversationId, sender: { $in: ["patient", "ai", "agent"] }, internal: { $ne: true }, fileId: null };
    if (Array.isArray(ids) && ids.length) filter._id = { $in: ids.slice(0, MAX_MESSAGES) };
    const rows = (await LcMessage.find(filter).sort({ createdAt: 1 }).limit(MAX_MESSAGES)).filter(translatable);

    const out = {};
    const failed = [];
    const todo = [];
    for (const m of rows) {
      const cached = cachedEnglish(m);
      if (cached) {
        if (!cached.same) out[String(m._id)] = { text: decryptLiveChatText(cached.text), from: cached.from, fromName: cached.fromName };
        continue;
      }
      const text = decryptLiveChatText(m.text);
      if (!text.trim()) continue;
      if (looksEnglish(text)) {
        await saveTranslation(m, { lang: "en", same: true }); // clearly English: no model call
        continue;
      }
      todo.push({ message: m, text });
    }

    if (todo.length) {
      const settings = await loadSettings();
      if (!(await spendOk(settings))) throw unavailable("spend_cap");
      // chunks of up to 20 messages / 8000 characters, one model call each
      const chunks = [];
      let current = [];
      let chars = 0;
      for (const item of todo) {
        if (current.length && (current.length >= CHUNK_ITEMS || chars + item.text.length > CHUNK_CHARS)) {
          chunks.push(current);
          current = [];
          chars = 0;
        }
        current.push(item);
        chars += item.text.length;
      }
      if (current.length) chunks.push(current);

      let languageSeen = null;
      for (const chunk of chunks) {
        if (!(await spendOk(settings))) throw unavailable("spend_cap");
        const guarded = chunk.map((item) => ({ ...item, ...protect(item.text) }));
        const result = await ai.translateBatch({
          items: guarded.map((g) => ({ id: String(g.message._id), text: g.text })),
          target: "English",
        });
        if (result.usage) await chat.recordUsage(conv, settings, result.usage);
        if (!result.ok) throw unavailable(result.kind);
        const byId = new Map(result.items.map((r) => [r.id, r]));
        for (const g of guarded) {
          const id = String(g.message._id);
          const r = byId.get(id);
          if (!r) {
            failed.push(id);
            continue;
          }
          if (r.english) {
            await saveTranslation(g.message, { lang: "en", same: true, from: r.code || "en", fromName: r.name || "English" });
            continue;
          }
          const text = restore(r.text, g.tokens);
          if (text === null || !text.trim()) {
            failed.push(id); // the model changed a link / price: do not show or cache it
            continue;
          }
          await saveTranslation(g.message, { lang: "en", from: r.code, fromName: r.name, text });
          out[id] = { text, from: r.code, fromName: r.name };
          if (g.message.sender === "patient" && r.code && r.code !== "en") languageSeen = { code: r.code, name: r.name };
        }
      }
      if (languageSeen && !conv.language?.code) await chat.setLanguage(conv, languageSeen, { source: "translate" });
    }
    const fresh = await LcConversation.findById(conv._id).select("language").lean();
    return { translations: out, failed, language: publicLanguage(fresh?.language) };
  }

  // The admin's text (English) -> the patient's language. Never saved, never sent.
  async function translateReply(actor, conv, rawText) {
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) throw fail(400, "empty_message");
    if ([...text].length > MAX_REPLY_CHARS) throw fail(400, "message_too_long");
    const language = conv.language;
    if (!language?.code || language.code === "en") throw fail(409, "no_language");
    if (!limiter.allow(String(actor.id))) throw fail(429, "rate_limited");
    const settings = await loadSettings();
    if (!(await spendOk(settings))) throw unavailable("spend_cap");
    const guarded = protect(text);
    const result = await ai.translateBatch({ items: [{ id: "reply", text: guarded.text }], target: language.name || language.code });
    if (result.usage) await chat.recordUsage(conv, settings, result.usage);
    if (!result.ok) throw unavailable(result.kind);
    const r = result.items.find((i) => i.id === "reply");
    const restored = r ? restore(r.english ? guarded.text : r.text, guarded.tokens) : null;
    if (restored === null || !restored.trim()) throw unavailable("invalid");
    return { text: restored, language: publicLanguage(language) };
  }

  // One small call for the first clearly non-English patient message of a chat that has no language yet.
  // Silent: any problem simply leaves the chat without a badge.
  async function detectFor(conv, text) {
    try {
      if (conv.language?.code) return;
      if (!text || tooShortToTell(text) || looksEnglish(text)) return;
      const tries = detectTries.get(conv.conversationId) || 0;
      if (tries >= MAX_DETECT_TRIES) return;
      const settings = await loadSettings();
      if (!(await spendOk(settings))) return;
      detectTries.set(conv.conversationId, tries + 1);
      const result = await ai.detectLanguage({ text: protect(text).text });
      if (result.usage) await chat.recordUsage(conv, settings, result.usage);
      if (result.ok && result.language) {
        detectTries.delete(conv.conversationId);
        const fresh = await LcConversation.findById(conv._id).select("language").lean();
        if (!fresh?.language?.code) await chat.setLanguage(conv, result.language, { source: "detect" });
      }
    } catch {
      /* no badge */
    }
  }

  const viewOf = (conv, userId) => (conv.translateViews || []).find((v) => String(v.userId) === String(userId))?.view || "original";

  async function setView(actor, conv, view) {
    if (view !== "original" && view !== "en") throw fail(400, "invalid_view");
    const userId = chat.toObjectId(actor.id);
    await LcConversation.updateOne({ _id: conv._id }, [
      {
        $set: {
          translateViews: {
            $concatArrays: [
              { $filter: { input: { $ifNull: ["$translateViews", []] }, cond: { $ne: ["$$this.userId", userId] } } },
              [{ userId, view }],
            ],
          },
        },
      },
    ], { updatePipeline: true });
    return { ok: true, view };
  }

  return { translateMessages, translateReply, detectFor, viewOf, setView, limiter };
}

// What the admin lists show: nothing for English or unknown.
function publicLanguage(language) {
  if (!language?.code || language.code === "en") return null;
  return { code: language.code, name: language.name || language.code };
}

module.exports = { createTranslationService, publicLanguage };
