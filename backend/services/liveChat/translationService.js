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
const { encryptLiveChatText, decryptLiveChatText, decryptLiveChatOrEmpty } = require("../../utils/liveChat/crypto");
const { createWindowLimiter } = require("./limits");
const { looksEnglish, tooShortToDetect, protect, restore, contactLiterals, scrubContact } = require("./languageHints");

const CHUNK_ITEMS = 20;
const CHUNK_CHARS = 8000;
const MAX_MESSAGES = 300;
const MAX_REPLY_CHARS = 2000;
const MAX_DETECT_TRIES = 2;
const OPEN_DETECT_MIN_GAP_MS = 20_000; // one detection per chat at most this often
const OPEN_DETECT_AUTO_TRIES = 3; // automatic tries per chat (the "Detect language" link is not limited by this)
const OPEN_DETECT_LOOKBACK = 4; // latest patient messages looked at

function createTranslationService({ models, ai, limits, loadSettings, chat, fail, now = () => Date.now(), perMinute = 30 }) {
  const { LcMessage, LcConversation } = models;
  const limiter = createWindowLimiter({ windowMs: 60_000, max: perMinute, now });
  const detectTries = new Map(); // conversationId -> attempts without a result
  const openDetect = new Map(); // conversationId -> { at, auto }

  const unavailable = (kind) => fail(503, "translation_unavailable", kind ? { kind } : {});

  async function spendOk(settings) {
    return !(await limits.spendStatus(settings)).capReached;
  }

  // Patient, AI and agent messages, and system lines the patient can see (never internal ones).
  const translatable = (m) =>
    ["patient", "ai", "agent", "system"].includes(m.sender) && !m.internal && !m.fileId && Boolean(m.text?.cipherText);

  const cachedEnglish = (m) => (m.translations || []).find((t) => t.lang === "en");

  async function saveTranslation(message, entry) {
    await LcMessage.updateOne(
      { _id: message._id, "translations.lang": { $ne: entry.lang } },
      { $push: { translations: { lang: entry.lang, v: 2, same: Boolean(entry.same), from: entry.from || "", fromName: entry.fromName || "", text: encryptLiveChatText(entry.text || "") } } }
    );
  }

  // English view. ids optional: only those messages (a new patient message arriving while English is selected).
  // Every patient, AI and agent message (and patient-visible system line) that is not already English is translated,
  // whatever the script: text typed in Latin letters can be Marathi or Hindi too. Results are cached encrypted.
  async function translateMessages(actor, conv, ids) {
    if (!limiter.allow(String(actor.id))) throw fail(429, "rate_limited");
    const filter = { conversationId: conv.conversationId, sender: { $in: ["patient", "ai", "agent", "system"] }, internal: { $ne: true }, fileId: null };
    if (Array.isArray(ids) && ids.length) filter._id = { $in: ids.slice(0, MAX_MESSAGES) };
    const rows = (await LcMessage.find(filter).sort({ createdAt: 1 }).limit(MAX_MESSAGES)).filter(translatable);
    // The chat's language (a name only, no patient data) helps the model with text typed in Latin letters.
    const hint = conv.language?.code && conv.language.code !== "en" ? conv.language.name || conv.language.code : "";

    const out = {};
    const failed = [];
    const todo = [];
    for (const m of rows) {
      let cached = cachedEnglish(m);
      const text = decryptLiveChatOrEmpty(m.text);
      // An older "already English" answer on a non-English chat is checked again once (entries made before the
      // romanized-text rules have no version 2).
      if (cached?.same && (cached.v || 1) < 2 && hint && text.trim() && !looksEnglish(text)) {
        await LcMessage.updateOne({ _id: m._id }, { $pull: { translations: { lang: "en" } } });
        cached = null;
      }
      if (cached) {
        if (!cached.same) out[String(m._id)] = { text: decryptLiveChatOrEmpty(cached.text), from: cached.from, fromName: cached.fromName };
        continue;
      }
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
      const literals = contactLiterals(await contactOf(conv));
      const idOf = (g) => String(g.message._id);

      // One model call for some messages. If the answer is cut off, the messages are split in two and each half is
      // tried again, so one long message cannot leave the whole chat untranslated.
      async function run(items, options, depth = 0) {
        if (!(await spendOk(settings))) throw unavailable("spend_cap");
        const result = await ai.translateBatch({ items: items.map((g) => ({ id: idOf(g), text: g.safe })), target: "English", hint, ...options });
        if (result.usage) await chat.recordUsage(conv, settings, result.usage);
        if (result.ok) return result;
        if (result.kind === "incomplete" && items.length > 1 && depth < 3) {
          const mid = Math.ceil(items.length / 2);
          const first = await run(items.slice(0, mid), options, depth + 1);
          const second = await run(items.slice(mid), options, depth + 1);
          if (!first.ok && !second.ok) return first;
          return { ok: true, items: [...(first.ok ? first.items : []), ...(second.ok ? second.items : [])] };
        }
        return result;
      }

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
        const guarded = chunk.map((item) => {
          const p = protect(item.text, literals);
          return { ...item, safe: p.text, tokens: p.tokens };
        });
        const result = await run(guarded, {});
        if (!result.ok) throw unavailable(result.kind);
        const byId = new Map(result.items.map((r) => [r.id, r]));

        // "English" for text that is not clearly English (the model named another language, or this chat has one and
        // the text is no obvious English) is asked again, telling the model it was not recognised as English.
        const suspect = guarded.filter((g) => {
          const r = byId.get(idOf(g));
          return r?.english && ((r.code && r.code !== "en") || (hint && g.message.sender !== "system" && !looksEnglish(g.text)));
        });
        if (suspect.length) {
          const again = await run(suspect, { force: true });
          if (again.ok) for (const r of again.items) byId.set(r.id, r);
        }

        for (const g of guarded) {
          const id = idOf(g);
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
            failed.push(id); // the model changed a link / price / name: do not show or cache it
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

  // The patient's name, email and phone are held back from the model (swapped for tokens and put back after).
  async function contactOf(conv) {
    const visitor = await chat.loadVisitor(conv.visitorId);
    const pick = (field) => decryptLiveChatOrEmpty(visitor?.[field]?.cipherText ? visitor[field] : conv.contact?.[field]);
    return { name: pick("name"), email: pick("email"), phone: pick("phone") };
  }

  // What a language-detection call may carry: the patient's name (whole and parts), email and phone are swapped for
  // [name] / [email] / [phone] first, then links and prices become placeholders. No OpenAI call gets contact details.
  async function guardForDetect(conv, text) {
    const contact = await contactOf(conv);
    return protect(scrubContact(text, contact, (kind) => `[${kind}]`), contactLiterals(contact)).text;
  }

  // Always into the patient's language (the chat's detected language); an English chat has nothing to translate to.
  async function translateReply(actor, conv, rawText) {
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) throw fail(400, "empty_message");
    if ([...text].length > MAX_REPLY_CHARS) throw fail(400, "message_too_long");
    const language = conv.language;
    if (!language?.code || language.code === "en") throw fail(409, "no_language");
    if (!limiter.allow(String(actor.id))) throw fail(429, "rate_limited");
    const settings = await loadSettings();
    if (!(await spendOk(settings))) throw unavailable("spend_cap");
    const guarded = protect(text, contactLiterals(await contactOf(conv)));
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
      if (!text || tooShortToDetect(text) || looksEnglish(text)) return;
      const tries = detectTries.get(conv.conversationId) || 0;
      if (tries >= MAX_DETECT_TRIES) return;
      const settings = await loadSettings();
      if (!(await spendOk(settings))) return;
      detectTries.set(conv.conversationId, tries + 1);
      const result = await ai.detectLanguage({ text: await guardForDetect(conv, text) });
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

  // Detection when an admin opens a chat that has patient text but no language (the first detection may have been
  // skipped by the daily cap, failed, or found nothing). Bounded: the daily cap is respected, English-looking and
  // too-short text is never sent, one call per chat per 20 s, 3 automatic tries per chat. `manual` is the admin's
  // "Detect language" link: it skips the automatic try limit only. The patient's name, email and phone are removed
  // before anything is sent. Returns { ok, language, reason } with reason one of
  // "", "english", "no_text", "cap", "failed", "busy".
  async function detectOnOpen(conv, { manual = false } = {}) {
    if (conv.language?.code && conv.language.code !== "en") return { ok: true, language: publicLanguage(conv.language), reason: "" };
    const seen = openDetect.get(conv.conversationId) || { at: 0, auto: 0 };
    if (!manual && seen.auto >= OPEN_DETECT_AUTO_TRIES) return { ok: false, language: null, reason: "busy" };
    if (now() - seen.at < OPEN_DETECT_MIN_GAP_MS) return { ok: false, language: null, reason: "busy" };

    const rows = await LcMessage.find({ conversationId: conv.conversationId, sender: "patient", internal: { $ne: true }, fileId: null })
      .sort({ createdAt: -1 })
      .limit(OPEN_DETECT_LOOKBACK)
      .select("text")
      .lean();
    const texts = rows.map((r) => decryptLiveChatOrEmpty(r.text)).filter((t) => t.trim());
    if (!texts.length) return { ok: false, language: null, reason: "no_text" };
    const candidate = texts.find((t) => !tooShortToDetect(t) && !looksEnglish(t));
    if (!candidate) return { ok: true, language: null, reason: texts.some((t) => looksEnglish(t)) ? "english" : "no_text" };

    const settings = await loadSettings();
    if (!(await spendOk(settings))) return { ok: false, language: null, reason: "cap" };
    openDetect.set(conv.conversationId, { at: now(), auto: seen.auto + (manual ? 0 : 1) });
    try {
      const result = await ai.detectLanguage({ text: await guardForDetect(conv, candidate) });
      if (result.usage) await chat.recordUsage(conv, settings, result.usage);
      if (!result.ok || !result.language) return { ok: false, language: null, reason: "failed" };
      const fresh = await LcConversation.findById(conv._id).select("language").lean();
      if (!fresh?.language?.code) await chat.setLanguage(conv, result.language, { source: "detect" });
      const language = publicLanguage(fresh?.language?.code ? fresh.language : result.language);
      return { ok: true, language, reason: language ? "" : "english" };
    } catch {
      return { ok: false, language: null, reason: "failed" };
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

  return { translateMessages, translateReply, detectFor, detectOnOpen, viewOf, setView, limiter };
}

// What the admin lists show: nothing for English or unknown.
function publicLanguage(language) {
  if (!language?.code || language.code === "en") return null;
  return { code: language.code, name: language.name || language.code };
}

module.exports = { createTranslationService, publicLanguage };
