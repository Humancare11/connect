import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./AdminEntries.css";
import RetryButton from "../../components/ui/RetryButton";
import { useToast } from "../../components/ui/Toast";
import EntriesSummary from "./entries/EntriesSummary";
import EntriesTable from "./entries/EntriesTable";
import ManualEntryModal from "./entries/ManualEntryModal";
import DeleteManualModal from "./entries/DeleteManualModal";
import useEntries from "./entries/useEntries";
import { exportEntriesCsv } from "./entries/entriesApi";
import {
  PAGE_SIZE, TAB_LABELS, TAB_ORDER, doctorFromParam, downloadName, formatMonth, monthFromParam, pageFromParam, rangeText, tabFromParam, viewToParams,
} from "./entries/entriesFormat";

const SEARCH_DELAY_MS = 300;

// Appointment entries: the doctor-payout record. One row per booking (and per manual entry); the green columns are typed by an
// admin and saved as they go. Admin and super admin only (the server enforces it too). The tab, Doctor, Month and page live in
// the URL; the search text does not.
export default function AdminEntries() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get("tab"));
  const doctor = doctorFromParam(searchParams.get("doctor"));
  const month = monthFromParam(searchParams.get("month"));
  const page = pageFromParam(searchParams.get("page"));

  const [searchText, setSearchText] = useState("");
  const [q, setQ] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const entries = useEntries({ tab, doctor, month, q, page });
  const { data, loading, error, reload } = entries;
  const rows = data?.items || [];
  const firstLoad = loading && !data;

  const [modal, setModal] = useState(null); // { type: "add" } | { type: "edit", row } | { type: "delete", row }
  const [exporting, setExporting] = useState(false);

  // The view as the address says it is. `latest` also remembers a change made a moment ago whose render has not happened yet, so two
  // quick changes (pick a doctor, then a month) keep each other instead of the second one undoing the first.
  const latest = useRef({ tab, doctor, month, page });
  latest.current = { tab, doctor, month, page };
  const setView = (next) => {
    latest.current = { ...latest.current, ...next };
    setSearchParams(viewToParams(latest.current));
  };

  const onSearch = (event) => {
    const value = event.target.value;
    setSearchText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setQ(value.trim()), SEARCH_DELAY_MS);
    if (page > 1) setView({ page: 1 });
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
    if (!loading && data && rows.length === 0 && data.total > 0 && page > 1) setView({ page: Math.max(1, data.totalPages || 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  const onManualSaved = (item, meta = {}) => {
    entries.putRow(item);
    if (meta.conflict) {
      entries.refresh();
      return;
    }
    setModal(null);
    toast.success(meta.added ? "Manual entry added" : meta.noop ? "Nothing changed" : "Manual entry updated");
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
      const res = await exportEntriesCsv({ tab, ...(doctor ? { doctor } : {}), ...(month ? { month } : {}), ...(q ? { q } : {}) });
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

  const counts = data?.counts;
  return (
    <div className="en-page">
      <section className="en-card">
        <div className="en-head">
          <p>The doctor fee and payout record for every booking. The green columns are yours to fill in; they save as you go.</p>
          <EntriesSummary summary={data?.summary} busy={loading} />
        </div>

        <div className="en-bar">
          <div className="en-tabs" role="tablist" aria-label="Paid status">
            {TAB_ORDER.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`en-tab${tab === key ? " is-on" : ""}`} onClick={() => setView({ tab: key, page: 1 })}>
                {TAB_LABELS[key]}
                <i>{counts ? counts[key] : "–"}</i>
              </button>
            ))}
          </div>
          <label className="en-fsel">
            Doctor
            <select value={doctor} onChange={(event) => setView({ doctor: event.target.value, page: 1 })} aria-label="Doctor">
              <option value="">All doctors</option>
              {(data?.doctors || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              {doctor && !(data?.doctors || []).some((d) => d.id === doctor) && <option value={doctor}>Selected doctor</option>}
            </select>
          </label>
          <label className="en-fsel">
            Month
            <select value={month} onChange={(event) => setView({ month: event.target.value, page: 1 })} aria-label="Month">
              <option value="">All months</option>
              {(data?.months || []).map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
              {month && !(data?.months || []).includes(month) && <option value={month}>{formatMonth(month)}</option>}
            </select>
          </label>
          <label className="en-search" aria-label="Search entries">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input placeholder="Search patient, doctor, ID, country" value={searchText} maxLength={100} onChange={onSearch} />
          </label>
          <button type="button" className="en-btn en-btn--primary" onClick={() => setModal({ type: "add" })}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add manual entry
          </button>
          <button type="button" className="en-btn" onClick={exportCsv} disabled={exporting}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

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

        {firstLoad ? (
          <div className="en-state">
            <div className="en-spinner" />
            <p>Loading entries…</p>
          </div>
        ) : error && !data ? (
          <div className="en-state">
            <h3>Could not load the entries</h3>
            <p>{error}</p>
            <RetryButton onRetry={reload} />
          </div>
        ) : rows.length === 0 && !loading ? (
          <div className="en-state">
            <h3>No entries match this view</h3>
            <p>{q ? "Nothing matches your search." : "Try another tab, doctor or month."}</p>
          </div>
        ) : (
          <div className={loading ? "en-loading" : undefined} aria-busy={loading}>
            {error && (
              <div className="en-error" role="alert">
                {error} <RetryButton onRetry={reload} />
              </div>
            )}
            <EntriesTable
              rows={rows}
              page={page}
              totals={data?.totals}
              save={save}
              onEdit={(row) => setModal({ type: "edit", row })}
              onDelete={(row) => setModal({ type: "delete", row })}
            />
            <Pager page={page} totalPages={data?.totalPages || 1} shown={rows.length} total={data?.total || 0} onPage={(next) => setView({ page: next })} />
          </div>
        )}
      </section>

      {modal?.type === "add" && <ManualEntryModal onSaved={onManualSaved} onClose={() => setModal(null)} />}
      {modal?.type === "edit" && <ManualEntryModal row={modal.row} onSaved={onManualSaved} onClose={() => setModal(null)} />}
      {modal?.type === "delete" && <DeleteManualModal row={modal.row} onDeleted={onDeleted} onClose={() => setModal(null)} />}
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
