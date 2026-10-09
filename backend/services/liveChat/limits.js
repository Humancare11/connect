// Abuse limits for live chat. The limits themselves come from the brief:
//   - max 1,000 characters per patient message
//   - max 6 messages per minute per visitor
//   - max 30 AI replies per chat (settings.handoffRules.maxAiRepliesPerChat)
//   - max 5 new chats per IP per day
//   - max 300 output tokens per AI reply (enforced in aiService / the provider call)
//   - daily AI spend cap (settings.dailySpendCapUsd, default $3) -> AI unavailable fallback, live chat keeps working
//
// Counters that must survive a restart (new chats per IP, AI spend, AI replies per chat) are read from MongoDB;
// the per-minute message limiter is in memory.

// Sliding-window limiter keyed by an arbitrary string (visitor id). Prunes itself so it cannot grow forever.
function createWindowLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map(); // key -> timestamps[]
  let lastPrune = now();

  function prune(t) {
    if (t - lastPrune < windowMs) return;
    lastPrune = t;
    for (const [key, list] of hits) {
      if (!list.length || t - list[list.length - 1] >= windowMs) hits.delete(key);
    }
  }

  return {
    // True when the action is allowed (and counted), false when the visitor is over the limit.
    allow(key) {
      const t = now();
      prune(t);
      const list = (hits.get(key) || []).filter((stamp) => t - stamp < windowMs);
      if (list.length >= max) {
        hits.set(key, list);
        return false;
      }
      list.push(t);
      hits.set(key, list);
      return true;
    },
    retryAfterMs(key) {
      const list = hits.get(key) || [];
      return list.length ? Math.max(0, windowMs - (now() - list[0])) : 0;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

// Normalises a patient message. Returns { ok: true, text } or { ok: false, error }.
function checkMessageText(value, maxChars = 1000) {
  const text = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (!text) return { ok: false, error: "empty_message" };
  if ([...text].length > maxChars) return { ok: false, error: "message_too_long" };
  return { ok: true, text };
}

// Date key (YYYY-MM-DD) in the support time zone, so "today" matches the team's day, not UTC.
function dayKey(date = new Date(), timeZone = "America/New_York") {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function createLimits({ models, readLimits, now = () => Date.now() }) {
  const limits = readLimits();
  const messageLimiter = createWindowLimiter({ windowMs: 60_000, max: limits.messagesPerMinute, now });

  return {
    limits,
    messageLimiter,

    checkMessageText: (value) => checkMessageText(value, limits.maxMessageChars),

    // Per visitor: max 6 messages per minute.
    allowMessage: (visitorId) => messageLimiter.allow(visitorId),

    // Per IP: max 5 new chats in the last 24 hours.
    async canStartChat(ip) {
      if (!ip) return true;
      const since = new Date(now() - 24 * 60 * 60 * 1000);
      const count = await models.LcConversation.countDocuments({ ip, startedAt: { $gte: since } });
      return count < limits.chatsPerIpPerDay;
    },

    // Per chat: max N AI replies (settings.handoffRules.maxAiRepliesPerChat, default 30).
    aiRepliesLeft(conversation, settings) {
      const max = settings?.handoffRules?.maxAiRepliesPerChat ?? 30;
      return (conversation.aiReplyCount || 0) < max;
    },

    // Daily AI spend. Returns the amount spent today and whether the cap has been reached.
    async spendStatus(settings) {
      const cap = Number(settings?.dailySpendCapUsd ?? 3);
      const day = dayKey(new Date(now()), settings?.supportHours?.timezone);
      const row = await models.LcAiUsage.findOne({ day }).select("costUsd").lean();
      const spent = row?.costUsd || 0;
      return { day, spent, cap, capReached: spent >= cap };
    },

    async recordUsage(settings, usage) {
      const day = dayKey(new Date(now()), settings?.supportHours?.timezone);
      await models.LcAiUsage.updateOne(
        { day },
        {
          $inc: {
            requests: 1,
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            costUsd: usage.costUsd || 0,
          },
        },
        { upsert: true }
      );
      const cap = Number(settings?.dailySpendCapUsd ?? 3);
      const row = await models.LcAiUsage.findOne({ day }).select("costUsd capReachedAt").lean();
      if (row && row.costUsd >= cap && !row.capReachedAt) {
        await models.LcAiUsage.updateOne({ day, capReachedAt: null }, { $set: { capReachedAt: new Date(now()) } });
      }
    },
  };
}

module.exports = { createLimits, createWindowLimiter, checkMessageText, dayKey };
