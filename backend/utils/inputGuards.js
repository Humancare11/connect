// ONE shared place for "is this client-supplied value safe to put in a database query?".
//
// Why it exists: Mongoose passes an OBJECT or ARRAY straight through as a query filter. A browser (or an attacker) that sends
// `{ "$gte": "<my id>" }` or `["<id1>", "<id2>"]` where an id is expected turns `findById(id)` / `find({ appointmentId })` into a
// query for MANY documents. Real clients only ever send a 24-character id string. So every id that arrives from outside is
// reduced to that string here, and anything else is refused.
//
// Used by:
//   - utils/socketInputGuard.js   every Socket.IO event (ids, chat fields, direct-room fields)
//   - middleware/rejectOperatorInput.js   every HTTP request body / query string
// Nothing here ever logs the rejected value (it may be an attack payload or personal data): only the event/route, the field NAME
// and the JavaScript type.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
// Direct (link) rooms use a random hex id, but the format is not a Mongo ObjectId: accept a plain, safe token only.
const ROOM_TOKEN_RE = /^[A-Za-z0-9_-]{6,128}$/;

// The id as a string, or null when the value is not exactly a 24-hex-character string (objects, arrays, numbers, "$..." all give null).
function asObjectIdString(value) {
  return typeof value === "string" && OBJECT_ID_RE.test(value) ? value : null;
}

function asRoomToken(value) {
  return typeof value === "string" && ROOM_TOKEN_RE.test(value) ? value : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// "string" | "array" | "object" | "number" | "null" ...: the only thing about a rejected value that may be logged.
function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// True when a key that starts with "$" appears anywhere inside the value (the way MongoDB operators such as $ne, $gt, $where
// are written). Bounded depth and size, so a hostile body cannot make the scan expensive.
function hasOperatorKey(value, { maxDepth = 12, maxNodes = 50000 } = {}) {
  let nodes = 0;
  const walk = (v, depth) => {
    if (v === null || typeof v !== "object") return false;
    if (depth > maxDepth) return true; // absurdly deep: treat as hostile
    if (++nodes > maxNodes) return true;
    if (Array.isArray(v)) {
      for (const item of v) if (walk(item, depth + 1)) return true;
      return false;
    }
    for (const key of Object.keys(v)) {
      if (key.charCodeAt(0) === 36 /* $ */) return true;
      if (walk(v[key], depth + 1)) return true;
    }
    return false;
  };
  return walk(value, 0);
}

// A top-level field that is an id by name ("id", "_id", "appointmentId", "doctorId", ...). These must never be an object or an array.
// Names like "doctorIds" / "ids" (lists on purpose) are not ids by this rule.
function isIdFieldName(name) {
  return name === "id" || name === "_id" || /[a-z0-9]Id$/.test(name);
}

// First top-level id-like field of a plain object whose value is an object or array (null is fine), or null.
function findNonScalarIdField(obj) {
  if (!isPlainObject(obj)) return null;
  for (const key of Object.keys(obj)) {
    if (!isIdFieldName(key)) continue;
    const v = obj[key];
    if (v !== null && typeof v === "object") return { field: key, type: typeName(v) };
  }
  return null;
}

module.exports = {
  OBJECT_ID_RE,
  ROOM_TOKEN_RE,
  asObjectIdString,
  asRoomToken,
  isPlainObject,
  typeName,
  hasOperatorKey,
  isIdFieldName,
  findNonScalarIdField,
};
