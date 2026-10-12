// Small, controlled typo tolerance for the public search catalog (PR 10).
//
// It is a FALLBACK only: executeSearch calls it when a query returned nothing
// at all. It never runs on a query the matcher already understood, never
// touches the database, never builds a RegExp, and only ever proposes terms
// that already exist in the bounded in-memory public catalog (category,
// specialty, condition and service names and aliases). Nothing is inferred
// medically: it only repairs spelling toward a term the catalog already has,
// and the repaired query then goes through the normal matcher and ordering.
//
// Conservative by construction:
//   - a token is corrected only if it is NOT already a known word and has at
//     least MIN_TOKEN_LENGTH characters (shorter terms are never "fixed");
//   - the correction must start with the same letter;
//   - allowed edit distance grows with word length and requires a shared
//     prefix: 1 edit (4+ chars), 2 edits (6+ chars, 3-char prefix),
//     3 edits (8+ chars, 4-char prefix);
//   - the best candidate must be unique: a tie between two different terms is
//     treated as "not confident" and nothing is corrected;
//   - every unknown token of the query must be corrected, otherwise nothing is.
// If it cannot be confident it returns null and the search returns no result.

const { normalizeForMatch, tokenize } = require("./queryNormalizer");

const MIN_TOKEN_LENGTH = 4;
const MAX_LENGTH_GAP = 3;

// Optimal-string-alignment (Damerau-Levenshtein) distance, early-exit above `max`.
function editDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows.push(new Array(b.length + 1).fill(0));
    rows[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, rows[i - 2][j - 2] + 1);
      rows[i][j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

function commonPrefixLength(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

// Is `distance` an acceptable repair between a query token and a catalog term?
function acceptable(token, term, distance) {
  if (distance < 1 || token[0] !== term[0]) return false;
  const longest = Math.max(token.length, term.length);
  const prefix = commonPrefixLength(token, term);
  if (distance === 1) return token.length >= MIN_TOKEN_LENGTH;
  if (distance === 2) return longest >= 6 && prefix >= 3;
  if (distance === 3) return longest >= 8 && prefix >= 4;
  return false;
}

const vocabularies = new WeakMap(); // catalog (frozen, rebuilt on refresh) -> vocabulary

// Public taxonomy terms only (names and aliases). Blog titles count as known
// words (so they are never "corrected") but are not correction targets.
function vocabularyOf(catalog) {
  let vocabulary = vocabularies.get(catalog);
  if (vocabulary) return vocabulary;
  const targets = new Set();
  const known = new Set();
  const addTokens = (text, isTarget) => {
    for (const token of tokenize(normalizeForMatch(text))) {
      known.add(token);
      if (isTarget && token.length >= MIN_TOKEN_LENGTH && !/\d/.test(token)) targets.add(token);
    }
  };
  for (const record of [...(catalog.categories || []), ...(catalog.specialties || []), ...(catalog.conditions || [])]) {
    addTokens(record.name, true);
    for (const alias of record.aliases || []) addTokens(alias, true);
  }
  for (const blog of catalog.blogs || []) addTokens(blog.title, false);
  vocabulary = { targets: [...targets], known };
  vocabularies.set(catalog, vocabulary);
  return vocabulary;
}

// One token -> the single confident correction, or null.
function correctToken(token, vocabulary) {
  let best = Infinity;
  let winners = [];
  for (const term of vocabulary.targets) {
    if (term[0] !== token[0] || Math.abs(term.length - token.length) > MAX_LENGTH_GAP) continue; // eslint-disable-line no-continue
    const distance = editDistance(token, term, 3);
    if (!acceptable(token, term, distance)) continue; // eslint-disable-line no-continue
    if (distance < best) { best = distance; winners = [term]; } else if (distance === best) winners.push(term);
  }
  return winners.length === 1 ? winners[0] : null;
}

// normalizedQuery: the validated query. Returns the corrected query string
// (always different from the input) or null when it is not confident.
function correctQuery(catalog, normalizedQuery) {
  const vocabulary = vocabularyOf(catalog);
  const tokens = tokenize(normalizeForMatch(normalizedQuery));
  if (!tokens.length) return null;
  let changed = false;
  const fixed = [];
  for (const token of tokens) {
    const isUnknownWord = token.length >= MIN_TOKEN_LENGTH && !/\d/.test(token) && !vocabulary.known.has(token);
    if (!isUnknownWord) {
      fixed.push(token);
      continue; // eslint-disable-line no-continue
    }
    const correction = correctToken(token, vocabulary);
    if (!correction) return null; // one unrepairable word: not confident
    fixed.push(correction);
    changed = true;
  }
  return changed ? fixed.join(" ") : null;
}

module.exports = { correctQuery, correctToken, editDistance, acceptable, MIN_TOKEN_LENGTH };
