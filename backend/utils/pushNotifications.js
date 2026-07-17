const { admin, getFirebaseApp } = require("../config/firebaseAdmin");
const User = require("../models/User");

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

// Sends a push notification to every device token registered for a user.
// Silently no-ops if Firebase isn't configured or the user has no tokens, and
// never throws — callers fire this alongside their existing socket.io emits
// without needing to guard the call.
async function sendPushToUser(userId, { title, body, data = {} } = {}) {
  if (!userId || !title) return;

  try {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return;

    const user = await User.findById(userId).select("fcmTokens").lean();
    const tokens = (user?.fcmTokens || [])
      .map((entry) => entry.token)
      .filter(Boolean);
    if (tokens.length === 0) return;

    const stringData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value ?? "")])
    );

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body: body || "" },
      data: stringData,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });

    const invalidTokens = [];
    response.responses.forEach((result, index) => {
      if (!result.success && INVALID_TOKEN_ERROR_CODES.has(result.error?.code)) {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length > 0) {
      await User.updateOne(
        { _id: userId },
        { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
      );
    }
  } catch (error) {
    console.error("[push] sendPushToUser failed:", error.message);
  }
}

module.exports = { sendPushToUser };
