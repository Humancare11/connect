import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { getSearchAnalytics } from "../../api/searchAnalyticsApi";
import {
  AI_STATUS_FILTERS,
  AI_UNAVAILABLE_HELP,
  TOP_TERMS_PRIVACY_HELP,
  DAILY_TERMS_PRIVACY_HELP,
  EMPTY_RESULT,
  OUTCOME_FILTERS,
  OUTCOME_HELP,
  PRIVACY_CHECK_INCOMPLETE_HELP,
  buildTermsParams,
  buildDailyTermsParams,
  deriveAnalyticsState,
  failed,
  privacyCheckIncomplete,
  succeeded,
  trendActionFor,
} from "./analyticsState";
import "./SearchAnalytics.css";

// Read-only view over /api/admin/search-analytics. The API returns aggregates
// only (privacy-filtered search terms and counts); every value below is
// rendered as plain text by React, never as HTML.

const WINDOWS = [7, 30, 90];
const PAGE_SIZE = 25;
const TABS = [
  { key: "terms", label: "Top terms" },
  { key: "daily", label: "Daily terms" },
  { key: "gaps", label: "Content gaps" },
  { key: "trend", label: "Trend" },
];
const GAP_LABELS = {
  page_missing: "Page missing",
  no_catalog_match: "No catalog match",
  alias_opportunity: "Alias opportunity",
};

// Page width (px) below which a tab's table becomes a list of cards. Each tab
// has its own number: Top terms and Content gaps have eight columns, Trend six,
// Daily terms three, so they stay tables for different amounts of space.
const CARDS_BELOW = { terms: 800, gaps: 940, trend: 680, daily: 560 };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (date) => date.toISOString().slice(0, 10);

function windowParams(days) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  return { from: dayKey(from), to: dayKey(to) };
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "-");
const pct = (rate) => (Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : "-");

function errorMessage(err) {
  const status = err?.response?.status;
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 503) return "This view could not be computed right now. Please try again shortly.";
  if (status === 401 || status === 403) return "You do not have access to this view.";
  return "Search analytics is temporarily unavailable.";
}

// Width of the page's own box, not the viewport: the admin shell reserves a
// sidebar, so the room a table gets depends on the shell as much as the screen.
function useElementWidth(ref) {
  const [width, setWidth] = useState(1200);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [ref]);

  return width;
}

function useAnalytics(path, params, enabled = true, refreshKey = 0) {
  // The result is tagged with the request it answers, so "loading" is derived
  // (no result for the current request yet) instead of set inside the effect.
  // A refresh (new refreshKey, same request) keeps the previous body on screen:
  // "refreshing" is true until the new answer, or its error, arrives.
  const [result, setResult] = useState(EMPTY_RESULT);
  const paramsKey = JSON.stringify(params);
  const id = `${path}?${paramsKey}`;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    getSearchAnalytics(path, JSON.parse(paramsKey), controller.signal)
      .then((res) => setResult(succeeded(id, res.data, refreshKey)))
      .catch((err) => {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        // A failed refresh keeps the data already shown for this same request.
        setResult((prev) => failed(prev, id, errorMessage(err), refreshKey));
      });
    return () => controller.abort();
  }, [path, paramsKey, id, enabled, refreshKey]);

  return deriveAnalyticsState(result, { id, refreshKey, enabled });
}

// Tells the page whether this tab's data is being refreshed (to disable Refresh).
function useReportBusy(busy, onBusy) {
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
}

function Notice({ loading, error }) {
  if (loading) return <p className="sa-note">Loading…</p>;
  if (error) return <p className="sa-note sa-note--error" role="alert">{error}</p>;
  return null;
}

// Shown when the API could not finish its read-time privacy check: term-level results are hidden for now.
export function PrivacyCheckNotice({ meta }) {
  return privacyCheckIncomplete(meta) ? <p className="sa-hint" role="status">{PRIVACY_CHECK_INCOMPLETE_HELP}</p> : null;
}

function Pager({ pagination, onPage }) {
  if (!pagination || pagination.total <= pagination.limit) return null;
  const { limit, offset, total, hasMore } = pagination;
  return (
    <div className="sa-pager">
      <button type="button" className="sa-btn" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>
        Previous
      </button>
      <span>
        {fmt(offset + 1)}–{fmt(Math.min(offset + limit, total))} of {fmt(total)}
      </span>
      <button type="button" className="sa-btn" disabled={!hasMore} onClick={() => onPage(offset + limit)}>
        Next
      </button>
    </div>
  );
}

function TermsTab({ range, onSelectTerm, refreshKey, onBusy, width }) {
  const [outcome, setOutcome] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [sort, setSort] = useState("count");
  const [offset, setOffset] = useState(0);
  const params = buildTermsParams({ range, sort, limit: PAGE_SIZE, offset, outcome, aiStatus });
  const { loading, refreshing, error, body } = useAnalytics("/terms", params, true, refreshKey);
  useReportBusy(refreshing, onBusy);
  const items = body?.data?.items || [];
  const cards = width < CARDS_BELOW.terms;

  return (
    <>
      <div className="sa-filters">
        <label>
          Outcome
          <select value={outcome} aria-describedby="sa-outcome-help" onChange={(e) => { setOutcome(e.target.value); setOffset(0); }}>
            {OUTCOME_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          AI status
          <select value={aiStatus} onChange={(e) => { setAiStatus(e.target.value); setOffset(0); }}>
            {AI_STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => { setSort(e.target.value); setOffset(0); }}>
            <option value="count">Most searched</option>
            <option value="recent">Most recent</option>
          </select>
        </label>
      </div>
      <p className="sa-hint" id="sa-outcome-help">{OUTCOME_HELP}</p>
      {aiStatus === "unavailable" && <p className="sa-hint" role="status">{AI_UNAVAILABLE_HELP}</p>}
      <p className="sa-hint"><strong>Privacy protection:</strong> {TOP_TERMS_PRIVACY_HELP}</p>
      <Notice loading={loading} error={error} />
      <PrivacyCheckNotice meta={body?.meta} />
      {!loading && (!error || body) && (
        <>
          <div className={`sa-table-wrap${cards ? " sa-table-wrap--cards" : ""}`}>
            <table className={`sa-table sa-table--terms${cards ? " sa-table--cards" : ""}`}>
              <thead>
                <tr>
                  <th>Search term</th><th>Searches</th><th>Page found</th><th>Fallback</th><th>No results</th><th>Last seen</th><th>Coverage</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.termKey}>
                    <td className="sa-term" data-label="Search term">{row.term}</td>
                    <td data-label="Searches">{fmt(row.interactions)}</td>
                    <td data-label="Page found">{fmt(row.outcomes.dedicatedPageFound)}</td>
                    <td data-label="Fallback">{fmt(row.outcomes.fallbackOnly)}</td>
                    <td data-label="No results">{fmt(row.outcomes.noResults)}</td>
                    <td className="sa-date" data-label="Last seen">{row.lastSeen || "-"}</td>
                    <td data-label="Coverage">{GAP_LABELS[row.coverage] || (row.coverage ? row.coverage.replace(/_/g, " ") : "-")}</td>
                    <td className="sa-act">
                      {(() => {
                        const trend = trendActionFor(row);
                        return trend.available
                          ? <button type="button" className="sa-link" onClick={() => onSelectTerm(row.termKey, row.term)}>{trend.label}</button>
                          : <><span className="sa-trend-none" title={trend.title}>{trend.label}</span><span className="sa-trend-why">{trend.title}</span></>;
                      })()}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !privacyCheckIncomplete(body?.meta) && <tr className="sa-empty-row"><td colSpan={8} className="sa-empty">No search terms for this period yet. A term appears after at least 3 searches.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager pagination={body?.data?.pagination} onPage={setOffset} />
        </>
      )}
    </>
  );
}

function DailyTermsTab({ range, refreshKey, onBusy, width }) {
  const [outcome, setOutcome] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [day, setDay] = useState("");
  const [offset, setOffset] = useState(0);
  const params = buildDailyTermsParams({ range, day, limit: PAGE_SIZE, offset, outcome, aiStatus });
  const { loading, refreshing, error, body } = useAnalytics("/daily-terms", params, true, refreshKey);
  useReportBusy(refreshing, onBusy);
  const items = body?.data?.items || [];
  const other = body?.data?.other || [];
  const cards = width < CARDS_BELOW.daily;

  return (
    <>
      <div className="sa-filters">
        <label>
          Date (UTC)
          <input type="date" value={day} min={range.from} max={range.to} onChange={(e) => { setDay(e.target.value); setOffset(0); }} />
        </label>
        <label>
          Outcome
          <select value={outcome} onChange={(e) => { setOutcome(e.target.value); setOffset(0); }}>
            {OUTCOME_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          AI status
          <select value={aiStatus} onChange={(e) => { setAiStatus(e.target.value); setOffset(0); }}>
            {AI_STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {day && <button type="button" className="sa-link" onClick={() => { setDay(""); setOffset(0); }}>All days in window</button>}
      </div>
      <p className="sa-hint"><strong>Privacy protection:</strong> {DAILY_TERMS_PRIVACY_HELP}</p>
      <Notice loading={loading} error={error} />
      <PrivacyCheckNotice meta={body?.meta} />
      {!loading && (!error || body) && (
        <>
          <div className={`sa-table-wrap${cards ? " sa-table-wrap--cards" : ""}`}>
            <table className={`sa-table sa-table--daily${cards ? " sa-table--cards" : ""}`}>
              <caption className="sa-sr">Search terms by UTC date</caption>
              <thead>
                <tr><th scope="col">Date (UTC)</th><th scope="col">Search term</th><th scope="col">Interactions</th></tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={`${row.day}|${row.term}`}>
                    <td className="sa-date" data-label="Date (UTC)">{row.day}</td>
                    <td className="sa-term" data-label="Search term">{row.term}</td>
                    <td data-label="Interactions">{fmt(row.interactions)}</td>
                  </tr>
                ))}
                {items.length === 0 && !privacyCheckIncomplete(body?.meta) && <tr className="sa-empty-row"><td colSpan={3} className="sa-empty">No listed terms for this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager pagination={body?.data?.pagination} onPage={setOffset} />
          {other.length > 0 && (
            <div className="sa-table-wrap sa-other">
              <table className="sa-table sa-table--other">
                <caption className="sa-sr">Searches not listed individually, by UTC date</caption>
                <thead>
                  <tr><th scope="col">Date (UTC)</th><th scope="col">Other (not shown as terms)</th></tr>
                </thead>
                <tbody>
                  {other.map((row) => (
                    <tr key={row.day}><td className="sa-date">{row.day}</td><td>{fmt(row.interactions)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function GapsTab({ range, onSelectTerm, refreshKey, onBusy, width }) {
  const [offset, setOffset] = useState(0);
  const { loading, refreshing, error, body } = useAnalytics("/gaps", { ...range, limit: PAGE_SIZE, offset }, true, refreshKey);
  useReportBusy(refreshing, onBusy);
  const items = body?.data?.items || [];
  const cards = width < CARDS_BELOW.gaps;

  return (
    <>
      <Notice loading={loading} error={error} />
      <PrivacyCheckNotice meta={body?.meta} />
      {!loading && (!error || body) && (
        <>
          <div className={`sa-table-wrap${cards ? " sa-table-wrap--cards" : ""}`}>
            <table className={`sa-table sa-table--gaps${cards ? " sa-table--cards" : ""}`}>
              <thead>
                <tr>
                  <th>Search term</th><th>Opportunity</th><th>Searches</th><th>Confirmed</th><th>Page found rate</th><th>Top result</th><th>Last seen</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.termKey}>
                    <td className="sa-term" data-label="Search term">{row.term}</td>
                    <td className="sa-chipcell" data-label="Opportunity"><span className={`sa-chip sa-chip--${row.gapType}`}>{GAP_LABELS[row.gapType] || "-"}</span></td>
                    <td data-label="Searches">{fmt(row.interactions)}</td>
                    <td data-label="Confirmed">{fmt(row.confirmedInteractions)}</td>
                    <td data-label="Page found rate">{pct(row.confirmedDedicatedRate)}</td>
                    <td className="sa-path" data-label="Top result">{row.topResultPath?.path || "-"}</td>
                    <td className="sa-date" data-label="Last seen">{row.lastSeen || "-"}</td>
                    <td className="sa-act"><button type="button" className="sa-link" onClick={() => onSelectTerm(row.termKey, row.term)}>Trend</button></td>
                  </tr>
                ))}
                {items.length === 0 && !privacyCheckIncomplete(body?.meta) && <tr className="sa-empty-row"><td colSpan={8} className="sa-empty">No content opportunities found for this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager pagination={body?.data?.pagination} onPage={setOffset} />
        </>
      )}
    </>
  );
}

function TrendTab({ range, term, onClear, refreshKey, onBusy, width }) {
  const params = { ...range, ...(term ? { termKey: term.key } : {}) };
  const { loading, refreshing, error, body } = useAnalytics("/trend", params, true, refreshKey);
  useReportBusy(refreshing, onBusy);
  const points = body?.data?.points || [];
  const max = Math.max(1, ...points.map((p) => p.interactions));
  const cards = width < CARDS_BELOW.trend;

  return (
    <>
      <p className="sa-note">
        {term ? <>Showing: <strong>{term.label}</strong> </> : "Showing: all searches "}
        {term && <button type="button" className="sa-link" onClick={onClear}>Show all</button>}
      </p>
      <Notice loading={loading} error={error} />
      {!loading && (!error || body) && (
        <div className={`sa-table-wrap${cards ? " sa-table-wrap--cards" : ""}`}>
          <table className={`sa-table sa-table--trend${cards ? " sa-table--cards" : ""}`}>
            <thead>
              <tr><th>Day</th><th>Searches</th><th /><th>Page found</th><th>Fallback</th><th>No results</th></tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <td className="sa-day" data-label="Day"><span className="sa-date">{p.day}</span>{p.final ? "" : " (in progress)"}</td>
                  <td data-label="Searches">{fmt(p.interactions)}</td>
                  <td className="sa-bar-cell"><span className="sa-bar" style={{ width: `${(p.interactions / max) * 100}%` }} /></td>
                  <td data-label="Page found">{fmt(p.dedicatedPageFound)}</td>
                  <td data-label="Fallback">{fmt(p.fallbackOnly)}</td>
                  <td data-label="No results">{fmt(p.noResults)}</td>
                </tr>
              ))}
              {points.length === 0 && <tr className="sa-empty-row"><td colSpan={6} className="sa-empty">No trend data for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function SearchAnalytics() {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState("terms");
  const [term, setTerm] = useState(null);
  const [range, setRange] = useState(() => windowParams(30));
  const [refreshKey, setRefreshKey] = useState(0);
  const [tabBusy, setTabBusy] = useState(false);
  const pageRef = useRef(null);
  const tabRefs = useRef({});
  const width = useElementWidth(pageRef);

  const changeWindow = useCallback((next) => {
    setDays(next);
    setRange(windowParams(next));
  }, []);
  const selectTerm = useCallback((key, label) => {
    setTerm({ key, label });
    setTab("trend");
  }, []);

  // Refresh refetches the summary and the open tab with the same filters; tabs
  // that are not open fetch fresh data when they are opened.
  const refresh = useCallback(() => {
    setRange(windowParams(days)); // keeps the selected window, moves "today" forward
    setRefreshKey((n) => n + 1);
  }, [days]);

  // Arrow keys / Home / End move between tabs (tablist keyboard pattern).
  const onTabKeyDown = (event) => {
    const index = TABS.findIndex((t) => t.key === tab);
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  const summary = useAnalytics("/summary", range, true, refreshKey);
  const refreshing = summary.refreshing || tabBusy;
  const totals = summary.body?.data;

  return (
    <div className="sa-page" ref={pageRef}>
      <div className="sa-header">
        <span className="sa-eyebrow">Content opportunities</span>
        <h1 className="sa-title">Search Analytics</h1>
        <p className="sa-sub">
          Aggregated, privacy-filtered patient search activity. A search term appears only after at least 3 searches; searches the privacy filters reject are never recorded or shown.
        </p>
      </div>

      {summary.body?.meta && summary.body.meta.collectionEnabled === false && (
        <p className="sa-banner">Search analytics collection is currently switched off. Figures reflect data collected earlier.</p>
      )}

      <div className="sa-window" role="group" aria-label="Time window">
        {WINDOWS.map((d) => (
          <button key={d} type="button" className={`sa-btn${d === days ? " sa-btn--active" : ""}`} aria-pressed={d === days} onClick={() => changeWindow(d)}>
            Last {d} days
          </button>
        ))}
        <button
          type="button"
          className="sa-btn sa-refresh"
          onClick={refresh}
          disabled={refreshing}
          aria-busy={refreshing}
          aria-label="Refresh search analytics data"
          title="Refresh search analytics data"
        >
          <FiRefreshCw className={refreshing ? "sa-spin" : ""} aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <Notice loading={summary.loading} error={summary.error} />
      <PrivacyCheckNotice meta={summary.body?.meta} />
      {totals && (
        <div className="sa-stats">
          <div className="sa-stat sa-stat--blue"><span className="sa-stat-value">{fmt(totals.interactions)}</span><span className="sa-stat-label">Searches</span></div>
          <div className="sa-stat sa-stat--green"><span className="sa-stat-value">{fmt(totals.outcomes.dedicatedPageFound)}</span><span className="sa-stat-label">Page found</span></div>
          <div className="sa-stat sa-stat--amber"><span className="sa-stat-value">{fmt(totals.outcomes.fallbackOnly)}</span><span className="sa-stat-label">Fallback only</span></div>
          <div className="sa-stat"><span className="sa-stat-value">{fmt(totals.outcomes.noResults)}</span><span className="sa-stat-label">No results</span></div>
          <div className="sa-stat"><span className="sa-stat-value">{fmt(totals.gaps.pageMissing + totals.gaps.noCatalogMatch + totals.gaps.aliasOpportunity)}</span><span className="sa-stat-label">Content gaps</span></div>
        </div>
      )}

      <div className="sa-tabs" role="tablist" aria-label="Search analytics views" onKeyDown={onTabKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.key}
            ref={(el) => { tabRefs.current[t.key] = el; }}
            type="button"
            role="tab"
            id={`sa-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="sa-panel"
            tabIndex={tab === t.key ? 0 : -1}
            className={`sa-tab${tab === t.key ? " sa-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="sa-panel" id="sa-panel" role="tabpanel" aria-labelledby={`sa-tab-${tab}`}>
        {tab === "terms" && <TermsTab range={range} onSelectTerm={selectTerm} refreshKey={refreshKey} onBusy={setTabBusy} width={width} />}
        {tab === "daily" && <DailyTermsTab range={range} refreshKey={refreshKey} onBusy={setTabBusy} width={width} />}
        {tab === "gaps" && <GapsTab range={range} onSelectTerm={selectTerm} refreshKey={refreshKey} onBusy={setTabBusy} width={width} />}
        {tab === "trend" && <TrendTab range={range} term={term} onClear={() => setTerm(null)} refreshKey={refreshKey} onBusy={setTabBusy} width={width} />}
      </section>
    </div>
  );
}
