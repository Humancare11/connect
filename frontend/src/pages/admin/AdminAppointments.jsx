import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./AdminAppointments.css";
import RetryButton from "../../components/ui/RetryButton";
import BookingTabs from "./appointments/BookingTabs";
import BookingsTable from "./appointments/BookingsTable";
import BookingsPager from "./appointments/BookingsPager";
import BookingActionModals from "./appointments/BookingActionModals";
import useAdminBookings from "./appointments/useAdminBookings";
import BulkCancelModal from "./appointments/BulkCancelModal";
import BulkResultModal from "./appointments/BulkResultModal";
import useBookingActions from "./appointments/useBookingActions";
import useBulkActions from "./appointments/useBulkActions";
import useSelection from "./appointments/useSelection";
import { DEFAULT_TAB, PAGE_SIZE, TAB_LABELS, pageFromParam, tabFromParam } from "./appointments/bookingFormat";

const SEARCH_DELAY_MS = 300;

// Appointments and category consultations in one list. The tab, "Hide testing" and
// the page live in the URL (so a reload or a shared link keeps the view); the search
// text does not.
export default function AdminAppointments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParam(searchParams.get("tab"));
  const hideTesting = searchParams.get("hideTesting") === "1";
  const page = pageFromParam(searchParams.get("page"));

  const [searchText, setSearchText] = useState("");
  const [q, setQ] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const { data, loading, error, reload } = useAdminBookings({ status: tab, hideTesting, q, page, limit: PAGE_SIZE });
  const actions = useBookingActions({ reload });

  // Writes the view to the URL, leaving out values that are the default.
  const setView = (next) => {
    const view = { tab, hideTesting, page, ...next };
    const params = {};
    if (view.tab !== DEFAULT_TAB) params.tab = view.tab;
    if (view.hideTesting) params.hideTesting = "1";
    if (view.page > 1) params.page = String(view.page);
    setSearchParams(params);
  };

  const onSearch = (event) => {
    const value = event.target.value;
    setSearchText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setQ(value.trim()), SEARCH_DELAY_MS);
    if (page > 1) setView({ page: 1 });
  };

  const rows = data?.items || [];
  const firstLoad = loading && !data;

  // Ticked rows are of this page only: a new tab, filter, search or page starts again.
  const selection = useSelection({ rows, resetKey: `${tab}|${hideTesting}|${q}|${page}` });
  const bulk = useBulkActions({ selection, reload });

  // Bookings can disappear while you are on a later page (cancelled elsewhere, filtered
  // out): go back to the last page that exists instead of showing an empty one.
  useEffect(() => {
    if (!loading && data && rows.length === 0 && data.total > 0 && page > 1) {
      setView({ page: Math.max(1, data.totalPages || 1) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  return (
    <div className="adp-page">
      <section className="adp-card adp-bk-card">
        <div className="adp-card-header">
          <BookingTabs
            tab={tab}
            counts={data?.counts}
            hideTesting={hideTesting}
            onTab={(next) => setView({ tab: next, page: 1 })}
            onToggleHideTesting={() => setView({ hideTesting: !hideTesting, page: 1 })}
          />
          <label className="adp-search" aria-label="Search appointments">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search patient, doctor, category, booking ID..."
              value={searchText}
              maxLength={100}
              onChange={onSearch}
            />
          </label>
        </div>

        {firstLoad ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading appointments...</p>
          </div>
        ) : error && !data ? (
          <div className="adp-empty">
            <h3>Could not load appointments</h3>
            <p>{error}</p>
            <RetryButton onRetry={reload} />
          </div>
        ) : rows.length === 0 && !loading ? (
          <div className="adp-empty">
            <h3>No appointments found</h3>
            <p>{q ? "No appointments match your search." : `No ${TAB_LABELS[tab].toLowerCase()} appointments${hideTesting ? " (testing hidden)" : ""}.`}</p>
          </div>
        ) : (
          <div className={loading ? "adp-bk-loading" : undefined} aria-busy={loading}>
            {error && (
              <div className="adp-bk-error" role="alert">
                {error} <RetryButton onRetry={reload} />
              </div>
            )}
            <BookingsTable rows={rows} tab={tab} page={page} actions={actions} selection={selection} bulk={bulk} />
            <BookingsPager page={page} totalPages={data?.totalPages || 1} shown={rows.length} total={data?.total || 0} onPage={(next) => setView({ page: next })} />
          </div>
        )}
      </section>
      <BookingActionModals actions={actions} />
      {bulk.dialog?.type === "cancel" && (
        <BulkCancelModal rows={bulk.dialog.rows} submitting={bulk.busy} onSubmit={bulk.submitCancel} onClose={bulk.closeDialog} />
      )}
      {bulk.dialog?.type === "result" && <BulkResultModal result={bulk.dialog.result} onClose={bulk.closeDialog} />}
    </div>
  );
}
