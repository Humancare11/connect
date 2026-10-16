// Signed token that proves a visitor submitted the contact form. Without a valid token every chat event is
// refused ("no chat before the form"). Kept in the visitor's localStorage so returning visitors skip the form.
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const TOKEN_TYPE = "lc-visitor";
const TOKEN_TTL = "90d";

// Domain-separated from the login JWTs: a chat token can never be used as a session and vice versa.
function secret(env = process.env) {
  const base = env.JWT_SECRET || "dev-livechat-token";
  return crypto.createHash("sha256").update(`${base}:livechat-visitor-token`).digest();
}

function newVisitorId() {
  return crypto.randomUUID();
}

function signChatToken(visitorId, env = process.env) {
  return jwt.sign({ typ: TOKEN_TYPE, vid: visitorId }, secret(env), { expiresIn: TOKEN_TTL, algorithm: "HS256" });
}

// Returns the visitorId for a valid token, otherwise null. Never throws.
function verifyChatToken(token, env = process.env) {
  if (!token || typeof token !== "string" || token.length > 600) return null;
  try {
    const decoded = jwt.verify(token, secret(env), { algorithms: ["HS256"] });
    if (decoded.typ !== TOKEN_TYPE || typeof decoded.vid !== "string") return null;
    return decoded.vid;
  } catch {
    return null;
  }
}

module.exports = { signChatToken, verifyChatToken, newVisitorId };
