const jwt = require("jsonwebtoken");

// A browser can hold several logins at once (e.g. a doctor cookie and a different patient's cookie). verifyToken picks ONE
// identity for the whole request, which may not be the one that belongs to the appointment. For the call-transcript routes the
// right identity is "the one that is a participant of THIS appointment", the same rule the call room uses. This helper collects
// every valid patient / doctor identity of the request and returns the first that the access check accepts.
//
// Security: identities only ever come from verified, session-checked tokens in the request. The optional `hint` (the role the
// screen says it is acting as) only changes the ORDER in which identities are tried; it can never add or invent an identity.

const PARTICIPANT_COOKIES = [
  ["userToken", "user"],
  ["doctorToken", "doctor"],
];

async function collectParticipantIdentities(req, validate) {
  const out = [];
  const seen = new Set();
  const add = (decoded) => {
    if (!decoded || (decoded.role !== "user" && decoded.role !== "doctor") || !decoded.id) return;
    const key = `${decoded.role}:${decoded.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ userId: String(decoded.id), role: decoded.role, decoded });
  };

  add(req.user); // already verified by the route's auth middleware
  for (const [cookie, role] of PARTICIPANT_COOKIES) {
    const token = req.cookies?.[cookie];
    if (!token) continue;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== role) continue;
      if (!(await validate(decoded))) continue;
      add(decoded);
    } catch {
      // invalid / expired cookie: ignore
    }
  }
  return out;
}

// Returns { identity, access } where access is the first allowed result; if none is allowed, the most informative denial
// (anything but not_participant wins over not_participant); identity null when the request has no patient / doctor identity.
async function resolveParticipantAccess(req, appointmentId, decide, { validate, hint } = {}) {
  const validator = validate || require("../middleware/verifyToken").validateDecodedSession;
  let identities = await collectParticipantIdentities(req, validator);
  const wanted = hint === "doctor" || hint === "patient" || hint === "user" ? (hint === "doctor" ? "doctor" : "user") : null;
  if (wanted) identities = [...identities.filter((i) => i.role === wanted), ...identities.filter((i) => i.role !== wanted)];
  if (identities.length === 0) return { identity: null, access: null };

  let best = null;
  for (const identity of identities) {
    const access = await decide({ userId: identity.userId, role: identity.role }, appointmentId);
    if (access.allowed) return { identity, access };
    if (!best || (best.access.reason === "not_participant" && access.reason !== "not_participant")) best = { identity, access };
  }
  return best;
}

function hintFrom(req) {
  const raw = req.query?.as ?? req.body?.as;
  return typeof raw === "string" ? raw : undefined;
}

module.exports = { collectParticipantIdentities, resolveParticipantAccess, hintFrom };
