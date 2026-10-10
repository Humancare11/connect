import { useCallback, useEffect, useState } from "react";
import { getSearchAnalytics } from "../../api/searchAnalyticsApi";
import "./SearchAnalytics.css";

// Read-only view over /api/admin/search-analytics. The API returns aggregates
// only (terms with at least the minimum interaction count); every value below is
// rendered as plain text by React, never as HTML.

const WINDOWS = [7, 30, 90];
const PAGE_SIZE = 25;
const TABS = [
  { key: "terms", label: "Top terms" },
  { key: "gaps", label: "Content gaps" },
  { key: "trend", label: "Trend" },
];
const OUTCOME_FILTERS = [
  { value: "", label: "All outcomes" },
  { value: "dedicated_page_found", label: "Dedicated page found" },
  { value: "fallback_only", label: "Fallback only" },
  { value: "no_results", label: "No results" },
];
const GAP_LABELS = {
  page_missing: "Page missing",
  no_catalog_match: "No catalog match",
  alias_opportunity: "Alias opportunity",
};

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

function useAnalytics(path, params, enabled = true) {
  // The result is tagged with the request it answers, so "loading" is derived
  // (no result for the current request yet) instead of set inside the effect.
  const [result, setResult] = useState({ id: "", error: "", body: null });
  const key = JSON.stringify(params);
  const id = `${path}?${key}`;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    getSearchAnalytics(path, JSON.parse(key), controller.signal)
      .then((res) => setResult({ id, error: "", body: res.data }))
      .catch((err) => {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        setResult({ id, error: errorMessage(err), body: null });
      });
    return () => controller.abort();
  }, [path, key, id, enabled]);

  const current = result.id === id;
  return { loading: enabled && !current, error: current ? result.error : "", body: current ? result.body : null };
}

function Notice({ loading, error }) {
  if (loading) return <p className="sa-note">Loading…</p>;
  if (error) return <p className="sa-note sa-note--error" role="alert">{error}</p>;
  return null;
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

function TermsTab({ range, onSelectTerm }) {
  const [outcome, setOutcome] = useState("");
  const [sort, setSort] = useState("count");
  const [offset, setOffset] = useState(0);
  const params = { ...range, sort, limit: PAGE_SIZE, offset, ...(outcome ? { outcome } : {}) };
  const { loading, error, body } = useAnalytics("/terms", params);
  const items = body?.data?.items || [];

  return (
    <>
      <div className="sa-filters">
        <label>
          Outcome
          <select value={outcome} onChange={(e) => { setOutcome(e.target.value); setOffset(0); }}>
            {OUTCOME_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
      <Notice loading={loading} error={error} />
      {!loading && !error && (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Search term</th><th>Searches</th><th>Page found</th><th>Fallback</th><th>No results</th><th>Last seen</th><th>Coverage</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.termKey}>
                    <td className="sa-term">{row.term}</td>
                    <td>{fmt(row.interactions)}</td>
                    <td>{fmt(row.outcomes.dedicatedPageFound)}</td>
                    <td>{fmt(row.outcomes.fallbackOnly)}</td>
                    <td>{fmt(row.outcomes.noResults)}</td>
                    <td>{row.lastSeen || "-"}</td>
                    <td>{GAP_LABELS[row.coverage] || (row.coverage ? row.coverage.replace(/_/g, " ") : "-")}</td>
                    <td><button type="button" className="sa-link" onClick={() => onSelectTerm(row.termKey, row.term)}>Trend</button></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="sa-empty">No terms meet the minimum count for this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager pagination={body?.data?.pagination} onPage={setOffset} />
        </>
      )}
    </>
  );
}

function GapsTab({ range, onSelectTerm }) {
  const [offset, setOffset] = useState(0);
  const { loading, error, body } = useAnalytics("/gaps", { ...range, limit: PAGE_SIZE, offset });
  const items = body?.data?.items || [];

  return (
    <>
      <Notice loading={loading} error={error} />
      {!loading && !error && (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Search term</th><th>Opportunity</th><th>Searches</th><th>Confirmed</th><th>Page found rate</th><th>Top result</th><th>Last seen</th><th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.termKey}>
                    <td className="sa-term">{row.term}</td>
                    <td><span className={`sa-chip sa-chip--${row.gapType}`}>{GAP_LABELS[row.gapType] || "-"}</span></td>
                    <td>{fmt(row.interactions)}</td>
                    <td>{fmt(row.confirmedInteractions)}</td>
                    <td>{pct(row.confirmedDedicatedRate)}</td>
                    <td className="sa-path">{row.topResultPath?.path || "-"}</td>
                    <td>{row.lastSeen || "-"}</td>
                    <td><button type="button" className="sa-link" onClick={() => onSelectTerm(row.termKey, row.term)}>Trend</button></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="sa-empty">No content opportunities found for this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager pagination={body?.data?.pagination} onPage={setOffset} />
        </>
      )}
    </>
  );
}

function TrendTab({ range, term, onClear }) {
  const params = { ...range, ...(term ? { termKey: term.key } : {}) };
  const { loading, error, body } = useAnalytics("/trend", params);
  const points = body?.data?.points || [];
  const max = Math.max(1, ...points.map((p) => p.interactions));

  return (
    <>
      <p className="sa-note">
        {term ? <>Showing: <strong>{term.label}</strong> </> : "Showing: all searches "}
        {term && <button type="button" className="sa-link" onClick={onClear}>Show all</button>}
      </p>
      <Notice loading={loading} error={error} />
      {!loading && !error && (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr><th>Day</th><th>Searches</th><th /><th>Page found</th><th>Fallback</th><th>No results</th></tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day}>
                  <td>{p.day}{p.final ? "" : " (in progress)"}</td>
                  <td>{fmt(p.interactions)}</td>
                  <td className="sa-bar-cell"><span className="sa-bar" style={{ width: `${(p.interactions / max) * 100}%` }} /></td>
                  <td>{fmt(p.dedicatedPageFound)}</td>
                  <td>{fmt(p.fallbackOnly)}</td>
                  <td>{fmt(p.noResults)}</td>
                </tr>
              ))}
              {points.length === 0 && <tr><td colSpan={6} className="sa-empty">No trend data for this period.</td></tr>}
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

  const changeWindow = useCallback((next) => {
    setDays(next);
    setRange(windowParams(next));
  }, []);
  const selectTerm = useCallback((key, label) => {
    setTerm({ key, label });
    setTab("trend");
  }, []);

  const summary = useAnalytics("/summary", range);
  const totals = summary.body?.data;

  return (
    <div className="sa-page">
      <div className="adp-header">
        <span className="adp-eyebrow">Content opportunities</span>
        <h1 className="adp-title">Search Analytics</h1>
        <p className="adp-sub">
          Aggregated, privacy-filtered patient search activity. Terms with fewer than {summary.body?.meta?.kThreshold ?? 3} searches are never shown.
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
      </div>

      <Notice loading={summary.loading} error={summary.error} />
      {totals && (
        <div className="adp-stats">
          <div className="adp-stat adp-stat--blue"><span className="adp-stat-value">{fmt(totals.interactions)}</span><span className="adp-stat-label">Searches</span></div>
          <div className="adp-stat adp-stat--green"><span className="adp-stat-value">{fmt(totals.outcomes.dedicatedPageFound)}</span><span className="adp-stat-label">Page found</span></div>
          <div className="adp-stat adp-stat--amber"><span className="adp-stat-value">{fmt(totals.outcomes.fallbackOnly)}</span><span className="adp-stat-label">Fallback only</span></div>
          <div className="adp-stat"><span className="adp-stat-value">{fmt(totals.outcomes.noResults)}</span><span className="adp-stat-label">No results</span></div>
          <div className="adp-stat"><span className="adp-stat-value">{fmt(totals.gaps.pageMissing + totals.gaps.noCatalogMatch + totals.gaps.aliasOpportunity)}</span><span className="adp-stat-label">Content gaps</span></div>
        </div>
      )}

      <div className="sa-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`sa-tab${tab === t.key ? " sa-tab--active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <section className="sa-panel">
        {tab === "terms" && <TermsTab range={range} onSelectTerm={selectTerm} />}
        {tab === "gaps" && <GapsTab range={range} onSelectTerm={selectTerm} />}
        {tab === "trend" && <TrendTab range={range} term={term} onClear={() => setTerm(null)} />}
      </section>
    </div>
  );
}
