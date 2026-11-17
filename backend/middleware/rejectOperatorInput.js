const { hasOperatorKey, findNonScalarIdField } = require("../utils/inputGuards");

// Express middleware, mounted once right after the body parsers (see server.js).
//
// Refuses a request whose JSON body or query string
//   (a) contains a MongoDB operator key (anything named "$..." at any depth, e.g. {"email": {"$gt": ""}}), or
//   (b) has a top-level id field ("id", "_id", "...Id") that is an object or an array (Mongoose would turn that into a query for
//       many documents).
// Every normal request is untouched: real clients send plain strings and numbers there, and path parameters (/:id) are always
// strings. The answer is the same short 400 the app already uses for bad input, and ONE log line with the method, the route
// (no query string, no body) and the field name. The rejected value is never logged.
function rejectOperatorInput(req, res, next) {
  const method = req.method;
  let reason = null;
  let field = null;
  if (hasOperatorKey(req.query) || hasOperatorKey(req.body)) {
    reason = "operator_key";
  } else {
    const bad = findNonScalarIdField(req.query) || findNonScalarIdField(req.body);
    if (bad) { reason = "id_not_scalar"; field = `${bad.field}:${bad.type}`; }
  }
  if (reason) {
    const route = String(req.originalUrl || req.url || "").split("?")[0].slice(0, 120);
    console.warn("[security] request input rejected", { method, route, reason, field });
    return res.status(400).json({ msg: reason === "id_not_scalar" ? "Invalid id." : "Invalid request." });
  }
  return next();
}

module.exports = { rejectOperatorInput };
