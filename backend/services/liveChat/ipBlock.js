// IP blocking and abuse alerts for live chat.
//
// Blocking: an admin blocks an IP from a chat or from the visitor list. A blocked IP cannot connect to /livechat,
// submit the contact form or upload; its open chats are closed and its sockets dropped (agentService.blockIp).
// Blocks last until an admin removes them (Blocked IPs panel on Real-time visitors).
//
// Alerts: one admin alert (event "abuse:alert") when an IP or a visitor starts unusually many chats in an hour, or
// when an IP hits the daily new-chat limit. At most one alert per IP per hour (per day for the daily limit).
const { readAbuseLimits } = require("../../utils/liveChat/config");

function createIpBlockStore({ models, now = () => Date.now() }) {
  const { LcBlockedIp } = models;
  const cache = new Map(); // ip -> { blocked, until }

  async function isBlocked(ip) {
    const hit = cache.get(ip);
    if (hit && hit.until > now()) return hit.blocked;
    let blocked = false;
    try {
      const row = await LcBlockedIp.findOne({ ip }).select("expiresAt").lean();
      blocked = Boolean(row && (!row.expiresAt || row.expiresAt > new Date(now())));
    } catch {
      blocked = false; // a lookup failure must not take the tracker down
    }
    cache.set(ip, { blocked, until: now() + 30_000 });
    return blocked;
  }

  const invalidate = (ip) => cache.delete(ip);

  async function block({ ip, reason, by }) {
    const doc = await LcBlockedIp.findOneAndUpdate(
      { ip },
      { $set: { reason: String(reason || "").slice(0, 300), blockedBy: by || null, expiresAt: null }, $setOnInsert: { ip } },
      { upsert: true, returnDocument: "after" }
    );
    invalidate(ip);
    return doc;
  }

  async function unblock(id) {
    const doc = await LcBlockedIp.findByIdAndDelete(id);
    if (doc) invalidate(doc.ip);
    return doc;
  }

  async function list() {
    const rows = await LcBlockedIp.find().sort({ createdAt: -1 }).limit(200).lean();
    return rows.map((r) => ({ id: String(r._id), ip: r.ip, reason: r.reason || "", blockedBy: r.blockedBy ? String(r.blockedBy) : null, createdAt: r.createdAt }));
  }

  return { isBlocked, invalidate, block, unblock, list };
}

function createAbuseDetector({ models, emit, env = process.env, now = () => Date.now() }) {
  const { LcConversation } = models;
  const { chatsPerHourAlert } = readAbuseLimits(env);
  const alerted = new Map(); // key -> time of the last alert

  const recently = (key, windowMs) => {
    const last = alerted.get(key);
    return last !== undefined && now() - last < windowMs;
  };
  const mark = (key) => {
    alerted.set(key, now());
    if (alerted.size > 5000) for (const [k, t] of alerted) if (now() - t > 24 * 3_600_000) alerted.delete(k);
  };

  // Called whenever a patient chat is created.
  async function noteChat({ ip, visitorId, conversationId }) {
    const since = new Date(now() - 3_600_000);
    const [byIp, byVisitor] = await Promise.all([
      ip ? LcConversation.countDocuments({ ip, startedAt: { $gte: since } }) : 0,
      LcConversation.countDocuments({ visitorId, startedAt: { $gte: since } }),
    ]);
    const key = ip ? `ip:${ip}` : `visitor:${visitorId}`;
    if (Math.max(byIp, byVisitor) >= chatsPerHourAlert && !recently(key, 3_600_000)) {
      mark(key);
      emit("abuse:alert", { reason: "many_chats", window: "hour", count: Math.max(byIp, byVisitor), ip: ip || "", visitorId, conversationId });
      return true;
    }
    return false;
  }

  // Called when a new chat is refused because the IP used up its daily limit.
  function noteDailyLimit(ip) {
    const key = `day:${ip}`;
    if (!ip || recently(key, 24 * 3_600_000)) return false;
    mark(key);
    emit("abuse:alert", { reason: "daily_limit", window: "day", ip });
    return true;
  }

  return { noteChat, noteDailyLimit };
}

module.exports = { createIpBlockStore, createAbuseDetector };
