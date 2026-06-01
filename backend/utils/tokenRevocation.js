const RevokedToken = require("../models/RevokedToken");
const Session = require("../models/Session");
const REFRESH_TOKEN_MS = 8 * 60 * 60 * 1000;

async function revokeSession(sessionId, reason = "manual") {
  if (!sessionId) return;
  const session = await Session.findByIdAndUpdate(sessionId, { revokedAt: new Date() }, { new: true });
  if (!session) return;
  await RevokedToken.updateOne(
    { sessionId: String(session._id), userId: session.userId },
    {
      sessionId: String(session._id),
      userId: session.userId,
      role: session.role,
      reason,
      revokedAt: new Date(),
      expiresAt: session.expiresAt || new Date(Date.now() + REFRESH_TOKEN_MS),
    },
    { upsert: true }
  );
}

async function revokeUserSessions(userId, reason = "manual") {
  if (!userId) return 0;
  const sessions = await Session.find({ userId: String(userId), revokedAt: null });
  await Promise.all(sessions.map((session) => revokeSession(session._id, reason)));
  return sessions.length;
}

module.exports = { revokeSession, revokeUserSessions };
