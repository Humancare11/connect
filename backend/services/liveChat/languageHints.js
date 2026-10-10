// Small, model-free helpers for translation: "is this clearly English / too short to tell", the language record
// kept on a conversation, and protection of URLs, prices and emails so a translation cannot change them.

const EN_WORDS = new Set(
  "the and is are was were to of in it that for with you your my have has had do does can could what how when why where this these those not but i am im need please help would should like want get any there about from they we be will if at on an or so just also me us our their know think need take make going good thanks thank hello hi yes".split(" ")
);

const letterCount = (text) => (String(text).match(/\p{L}/gu) || []).length;
const tokensOf = (text) => String(text).toLowerCase().match(/[\p{L}']+/gu) || [];

// Too little text to say which language it is.
function tooShortToTell(text) {
  return letterCount(text) < 12 || tokensOf(text).length < 3;
}

// Clearly English: enough common English words. Used to skip model calls, never to decide it is NOT English.
function looksEnglish(text) {
  const tokens = tokensOf(text);
  if (tokens.length < 3) return false;
  const hits = tokens.filter((t) => EN_WORDS.has(t)).length;
  return hits >= 2 && hits / tokens.length >= 0.3;
}

// { code: "de", name: "German" } from whatever the model returned, or null ("und", junk, missing).
function normalizeLanguage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = String(raw.code || "").trim().toLowerCase().split(/[-_]/)[0];
  const name = String(raw.name || "").replace(/\s+/g, " ").trim();
  if (!/^[a-z]{2,3}$/.test(code) || code === "und" || code === "xx") return null;
  if (!name || name.length > 40 || !/^[\p{L} ()'-]+$/u.test(name)) return null;
  return { code, name };
}

// URLs, site paths, prices and email addresses are swapped for tokens before translation and put back after.
const PROTECT_RE = /(https?:\/\/[^\s)]+|www\.[^\s)]+|\/[a-z0-9][a-z0-9\-/&]*[a-z0-9]|[A-Z]{1,3}\$\s?\d[\d.,]*|\$\s?\d[\d.,]*|\d[\d.,]*\s?(?:USD|EUR|GBP)|[\w.+-]+@[\w-]+\.[\w.-]+)/g;

function protect(text) {
  const tokens = [];
  const out = String(text).replace(PROTECT_RE, (match) => {
    tokens.push(match);
    return `⟦${tokens.length}⟧`;
  });
  return { text: out, tokens };
}

// Returns the restored text, or null when the model dropped or invented a token (the result cannot be trusted).
function restore(text, tokens) {
  const seen = new Set();
  let broken = false;
  const out = String(text).replace(/⟦\s*(\d+)\s*⟧/g, (_, n) => {
    const index = Number(n) - 1;
    if (!tokens[index] || seen.has(index)) {
      broken = true;
      return "";
    }
    seen.add(index);
    return tokens[index];
  });
  if (broken || seen.size !== tokens.length) return null;
  return out;
}

module.exports = { tooShortToTell, looksEnglish, normalizeLanguage, protect, restore };
