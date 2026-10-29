import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./AdminEntries.css";
import RetryButton from "../../components/ui/RetryButton";
import { useToast } from "../../components/ui/Toast";
import EntriesSummary from "./entries/EntriesSummary";
import EntriesTable from "./entries/EntriesTable";
import ManualSheet from "./entries/ManualSheet";
import HistoryDialog from "./entries/HistoryDialog";
import MonthPicker from "./entries/MonthPicker";
import ManualEntryModal from "./entries/ManualEntryModal";
import DeleteManualModal from "./entries/DeleteManualModal";
import useEntries from "./entries/useEntries";
import { exportEntriesCsv } from "./entries/entriesApi";
import {
  PAGE_SIZE, TAB_LABELS, TAB_ORDER, downloadName, monthFromParam, pageFromParam, rangeText, tabFromParam, usdTotals, viewFromParam, viewToParams,
} from "./entries/entriesFormat";

const SEARCH_DELAY_MS = 300;

// Appointment entries, in two views: "Auto entries" (bookings made on the website or app: the green columns are typed by an admin and
// save as they go) and "Manual entries" (cases added by hand, shown like the team's Excel sheet with inline edit and History).
// Admin and super admin only (the server enforces it too); the money boxes are for a super admin only, and the server sends them to
// nobody else. The view, tab, month and page live in the URL; the search text does not.
export default function AdminEntries() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = viewFromParam(searchParams.get("view"));
  const tab = tabFromParam(searchParams.get("tab"));
  const month = monthFromParam(searchParams.get("month"));
  const page = pageFromParam(searchParams.get("page"));

  const [searchText, setSearchText] = useState("");
  const [q, setQ] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const entries = useEntries({ view, tab, month, q, page });
  const { data, loading, error, reload } = entries;
  // The answer on screen may still be the other view's while the new one loads: don't draw it with the wrong table.
  const ready = Boolean(data) && data.view === view;
  const rows = ready ? data.items : [];
  const firstLoad = !ready && loading;

  const [modal, setModal] = useState(null); // { type: "add" } | { type: "delete", row } | { type: "history", row }
  const [exporting, setExporting] = useState(false);

  // The view as the address says it is. `latest` also remembers a change made a moment ago whose render has not happened yet, so two
  // quick changes (pick a month, then a tab) keep each other instead of the second one undoing the first.
  const latest = useRef({ view, tab, month, page });
  latest.current = { view, tab, month, page };
  const setParams = (next) => {
    latest.current = { ...latest.current, ...next };
    setSearchParams(viewToParams(latest.current));
  };

  const onSearch = (event) => {
    const value = event.target.value;
    setSearchText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setQ(value.trim()), SEARCH_DELAY_MS);
    if (page > 1) setParams({ page: 1 });
  };

  // A failed save also says why in a toast (the cell itself only shows "Couldn't save").
  const save = useCallback(
    async (row, field, value) => {
      const result = await entries.save(row, field, value);
      if (!result.ok) toast.error(result.msg);
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries.save, toast],
  );

  // Rows can disappear while you are on a later page (deleted, or moved to another tab by a save): go back to the last page that exists.
  useEffect(() => {
    if (!loading && ready && rows.length === 0 && data.total > 0 && page > 1) setParams({ page: Math.max(1, data.totalPages || 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  // A new manual entry lives in the Manual view: go there to see it.
  const onAdded = (item) => {
    entries.putRow(item);
    setModal(null);
    toast.success("Manual entry added");
    if (view !== "manual") setParams({ view: "manual", tab: "all", page: 1 });
    else entries.refresh();
  };

  // A row saved in the sheet (inline edit): swap it in, say what happened, and refresh the counts and boxes.
  const onRowSaved = (item, message) => {
    entries.putRow(item);
    if (message) toast.success(message);
    entries.refresh();
  };

  const onDeleted = () => {
    setModal(null);
    toast.success("Manual entry deleted");
    entries.refresh();
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await exportEntriesCsv({ view, tab, ...(month ? { month } : {}), ...(q ? { q } : {}) });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName(res.headers?.["content-disposition"]);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const count = res.headers?.["x-export-rows"] || "";
      toast.success(
        res.headers?.["x-export-truncated"] === "true"
          ? `Exported the first ${count} rows (the list is longer than one file holds).`
          : `Exported ${count} row${count === "1" ? "" : "s"}`,
      );
    } catch (err) {
      // The error body of a blob request is a blob too, so say something plain.
      toast.error(err.response?.status === 400 ? "Couldn’t export with those filters." : "Couldn’t export the entries. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const counts = ready ? data.counts : null;
  const views = data?.views;
  const switchView = (next) => {
    if (next !== view) {
      setSearchText("");
      setQ("");
      setParams({ view: next, tab: "all", page: 1 });
    }
  };

  return (
    <div className="en-page">
      <section className="en-card">
        <div className="en-head">
          <div className="vsw" role="tablist" aria-label="Entry type">
            <button type="button" role="tab" aria-selected={view === "auto"} className={view === "auto" ? "on" : ""} onClick={() => switchView("auto")}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h16v16H4z" />
                <path d="M4 9h16M9 9v11" />
              </svg>
              Auto entries<i>{views ? views.auto : "–"}</i>
            </button>
            <button type="button" role="tab" aria-selected={view === "manual"} className={view === "manual" ? "on" : ""} onClick={() => switchView("manual")}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16z" />
                <path d="M13 7l4 4" />
              </svg>
              Manual entries<i>{views ? views.manual : "–"}</i>
            </button>
          </div>
          {ready && <EntriesSummary view={view} summary={data.summary} busy={loading} />}
        </div>

        <div className="en-bar">
          <div className="en-tabs" role="tablist" aria-label="Payout status">
            {TAB_ORDER.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`en-tab${tab === key ? " is-on" : ""}`} onClick={() => setParams({ tab: key, page: 1 })}>
                {TAB_LABELS[key]}
                <i>{counts ? counts[key] : "–"}</i>
              </button>
            ))}
          </div>
          <MonthPicker month={month} withEntries={ready ? data.months || [] : []} onChange={(value) => setParams({ month: value, page: 1 })} />
          <label className="en-search" aria-label="Search entries">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder={view === "auto" ? "Search patient, doctor, ID, country" : "Search case, company, patient, provider"}
              value={searchText}
              maxLength={100}
              onChange={onSearch}
            />
          </label>
          {view === "manual" && (
            <button type="button" className="en-btn en-btn--primary" onClick={() => setModal({ type: "add" })}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add manual entry
            </button>
          )}
          <button type="button" className="en-btn" onClick={exportCsv} disabled={exporting}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {view === "auto" && (
          <div className="en-legend">
            <span>
              <i className="en-legend-auto" />
              Filled in automatically from the booking
            </span>
            <span>
              <i className="en-legend-edit" />
              You type here (saves as you go)
            </span>
          </div>
        )}

        {firstLoad ? (
          <div className="en-state">
            <div className="en-spinner" />
            <p>Loading entries…</p>
          </div>
        ) : error && !ready ? (
          <div className="en-state">
            <h3>Could not load the entries</h3>
            <p>{error}</p>
            <RetryButton onRetry={reload} />
          </div>
        ) : ready && rows.length === 0 && !loading ? (
          <div className="en-state">
            <h3>{view === "manual" ? "No manual entries match this view" : "No entries match this view"}</h3>
            <p>{q ? "Nothing matches your search." : view === "manual" ? "Try another tab or month, or use Add manual entry." : "Try another tab or month."}</p>
          </div>
        ) : ready ? (
          <div className={loading ? "en-loading" : undefined} aria-busy={loading}>
            {error && (
              <div className="en-error" role="alert">
                {error} <RetryButton onRetry={reload} />
              </div>
            )}
            {view === "manual" ? (
              <ManualSheet
                rows={rows}
                page={page}
                totals={usdTotals(data.totals)}
                onRowSaved={onRowSaved}
                onDelete={(row) => setModal({ type: "delete", row })}
                onHistory={(row) => setModal({ type: "history", row })}
              />
            ) : (
              <EntriesTable rows={rows} page={page} totals={data.totals} save={save} />
            )}
            <Pager page={page} totalPages={data.totalPages || 1} shown={rows.length} total={data.total || 0} onPage={(next) => setParams({ page: next })} />
          </div>
        ) : (
          <div className="en-state">
            <div className="en-spinner" />
            <p>Loading entries…</p>
          </div>
        )}
      </section>

      {modal?.type === "add" && <ManualEntryModal onSaved={(item) => onAdded(item)} onClose={() => setModal(null)} />}
      {modal?.type === "delete" && <DeleteManualModal row={modal.row} onDeleted={onDeleted} onClose={() => setModal(null)} />}
      {modal?.type === "history" && <HistoryDialog row={modal.row} onClose={() => setModal(null)} />}
    </div>
  );
}

function Pager({ page, totalPages, shown, total, onPage }) {
  if (!total) return null;
  return (
    <div className="en-foot">
      <span>{rangeText(page, shown, total, PAGE_SIZE)}</span>
      {totalPages > 1 && (
        <span className="en-pager">
          <button type="button" className="en-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button type="button" className="en-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next
          </button>
        </span>
      )}
    </div>
  );
}
