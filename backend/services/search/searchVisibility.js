// Who may appear in global discovery search (conditions and services).
//
// Two independent flags on HealthcareCondition:
//   isActive     - available in booking (/api/appointment-tree). Unchanged.
//   isSearchable - available in global discovery search (PR 8.1).
//
// Rules (the parent specialty/category must additionally be valid and active;
// that hierarchy check lives in searchCatalog.js):
//   isSearchable === true   searchable. A record that is NOT active (search-only
//                           content) must also have a stored route that is a
//                           verified discovery page; an active record keeps the
//                           pre-PR8.1 fallback to its specialty page.
//   isSearchable === false  never searchable, even if active (explicit opt-out).
//   isSearchable unset      legacy record created before the flag existed:
//                           searchable only while active, exactly as before.
// Plain data in, boolean out: no I/O, so the migration planner and tests
// share the exact rule the catalog uses.

const { CONDITION_DISCOVERY_ROUTES } = require("./discoveryRoutes");

const hasVerifiedRoute = (route) => typeof route === "string" && CONDITION_DISCOVERY_ROUTES.has(route);

function isConditionSearchable(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.isSearchable === true) return raw.isActive === true || hasVerifiedRoute(raw.route);
  if (raw.isSearchable === false) return false;
  return raw.isActive === true;
}

module.exports = { isConditionSearchable, hasVerifiedRoute };
