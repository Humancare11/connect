// Pure state rules behind SearchAnalytics' data hook (no React, no I/O).
//
// A stored result is { id, error, body, key }: the request it answers, its
// error text, its body, and the refresh counter it was fetched under.

// Filter options for the Top terms tab. Values are the backend's exact enums
// (services/searchAnalytics/constants.js OUTCOMES / AI_STATUSES). "" means "all":
// the parameter is then left out of the request.
export const OUTCOME_FILTERS = Object.freeze([
  { value: "", label: "All outcomes" },
  { value: "dedicated_page_found", label: "Dedicated page found" },
  { value: "fallback_only", label: "Fallback page only" },
  { value: "no_results", label: "No results" },
]);

export const AI_STATUS_FILTERS = Object.freeze([
  { value: "", label: "All AI statuses" },
  { value: "used", label: "AI used" },
  { value: "not_needed", label: "AI not needed" },
  { value: "not_requested", label: "AI not requested" },
  { value: "no_match", label: "AI returned no matching results" },
  { value: "unavailable", label: "AI unavailable or skipped" },
]);

export const OUTCOME_HELP =
  "Shows searches where no relevant dedicated page was found. This does not mean the AI service failed.";
export const TOP_TERMS_PRIVACY_HELP =
  "Search terms appear here only after at least 3 searches within a single UTC day; searches on different days are not combined. A lower-volume term is still recorded and counted in the Searches total above, but is left out of this table.";
export const DAILY_TERMS_PRIVACY_HELP =
  "Dates are UTC days. A term is listed when it exactly matches a medical catalog name or alias (even if searched once), or when it was searched at least 3 times that UTC day. Other free-text searches are never listed individually; they are only counted as \"Other\" for the day.";
export const AI_UNAVAILABLE_HELP ="Combines AI failures and skipped AI requests; it does not distinguish between them.";

// Query for GET /terms. outcome / aiStatus are sent only when a specific value
// is selected.
export function buildTermsParams({ range, sort, limit, offset, outcome = "", aiStatus = "" }) {
  return { ...range, sort, limit, offset, ...(outcome ? { outcome } : {}), ...(aiStatus ? { aiStatus } : {}) };
}

// Query for GET /daily-terms. "day" (YYYY-MM-DD) narrows the report to one UTC day,
// but only when it lies inside the selected window; otherwise the window is used.
// outcome / aiStatus are sent only when a specific value is selected.
export function buildDailyTermsParams({ range, day = "", limit, offset, outcome = "", aiStatus = "" }) {
  const inWindow = Boolean(day) && day >= range.from && day <= range.to;
  return {
    ...(inWindow ? { from: day, to: day } : range),
    limit,
    offset,
    ...(outcome ? { outcome } : {}),
    ...(aiStatus ? { aiStatus } : {}),
  };
}

export const EMPTY_RESULT = Object.freeze({ id: "", error: "", body: null, key: 0 });

// What the page shows for the current request `id` and refresh counter.
//  - loading:    no answer for this request yet (first load / filters changed).
//  - refreshing: same request, a newer refresh is still in flight; the previous
//                body stays visible.
//  - error:      shown only for the latest refresh attempt.
export function deriveAnalyticsState(result, { id, refreshKey, enabled }) {
  const current = result.id === id;
  return {
    loading: enabled && !current,
    refreshing: enabled && current && result.key !== refreshKey,
    error: current && result.key === refreshKey ? result.error : "",
    body: current ? result.body : null,
  };
}

export const succeeded = (id, body, refreshKey) => ({ id, error: "", body, key: refreshKey });

// A failed refresh keeps the data already shown for this same request.
export const failed = (prev, id, message, refreshKey) => ({
  id,
  error: message,
  body: prev.id === id ? prev.body : null,
  key: refreshKey,
});
