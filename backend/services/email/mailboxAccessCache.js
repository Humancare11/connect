// Short in-memory cache of "which mailboxes may this admin use", so a list or counts request does
// not pay one database round trip for it every time.
//
// OFF unless EMAIL_MAILBOX_CACHE_MS is set to a positive number of milliseconds (30000 is a good
// value). Any change made through the Super Admin Mail IDs API clears it at once; a change made
// directly in the database is seen after at most that many milliseconds. One PM2 process (fork
// mode), so one cache is the whole picture.
const entries = new Map();

const ttlMs = (env = process.env) => {
  const n = Number(env.EMAIL_MAILBOX_CACHE_MS);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

async function cachedMailboxes(adminId, load, { env = process.env, now = Date.now() } = {}) {
  const ttl = ttlMs(env);
  if (!ttl) return load();
  const key = String(adminId);
  const hit = entries.get(key);
  if (hit && now - hit.at < ttl) return hit.value;
  const value = await load();
  entries.set(key, { at: now, value });
  return value;
}

const clearMailboxCache = () => entries.clear();

module.exports = { cachedMailboxes, clearMailboxCache, ttlMs };
