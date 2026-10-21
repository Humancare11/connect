import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import { getSearchAnalytics } from "../../api/searchAnalyticsApi";
import { useAdmin } from "../../context/AdminContext";
import Button from "../../components/ui/Button";
import "./AdminOverview.css";

// A count is only shown when the API really returned a number. While loading, and when the request fails, the
// card shows a dash and the page says what went wrong: "0" must always mean "the platform has none".
const asCount = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
const DASH = "—";
const show = (value) => (value === null || value === undefined ? DASH : value.toLocaleString());

function describeFailure(err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403) return "Your admin session was not accepted (HTTP " + status + "). Sign out and sign in again.";
  if (status) return "The server answered with an error (HTTP " + status + ").";
  return "The server could not be reached (network error, or the request was blocked).";
}

// Every destination on this page. Each one is an existing route in App.jsx; the "?" ones are filters the target page
// really reads from the URL (AdminAppointments `?tab=`, ManageUsers `?q=` / `?filter=`). Tickets, Partner Cases,
// Doctors and Search Analytics keep their filters in component state, so they are linked unfiltered.
const DASHBOARD_PATHS = {
  users: "/admin-dashboard/manage-users",
  usersDeletionRequests: "/admin-dashboard/manage-users?filter=deletion_requests",
  deletionHistory: "/admin-dashboard/deletion-requests",
  ourDoctors: "/admin-dashboard/our-doctors",
  manageDoctors: "/admin-dashboard/manage-doctors",
  appointments: "/admin-dashboard/appointments",
  tickets: "/admin-dashboard/tickets",
  searchAnalytics: "/admin-dashboard/search-analytics",
  partnerCases: "/admin-dashboard/partner-cases",
};
const P = DASHBOARD_PATHS;

const APPOINTMENT_STATUSES = [
  ["upcoming", "Upcoming"],
  ["assigned", "Assigned"],
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["complete", "Complete"],
  ["cancelled", "Cancelled"],
];

const PARTNER_STATUSES = [
  ["submitted", "Submitted"],
  ["assigned", "Assigned"],
  ["in-progress", "In progress"],
  ["completed", "Completed"],
  ["invoiced", "Invoiced"],
  ["cancelled", "Cancelled"],
];

// One independent request per section: a failure in one never blanks the others. `parse` turns the response into
// the section's data and throws if the reply is not in the expected shape.
function useSection(fetcher, parse, tick) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, error: "", loading: true }));
    fetcher()
      .then((res) => {
        if (!active) return;
        setState({ data: parse(res), error: "", loading: false });
      })
      .catch((err) => {
        if (!active) return;
        setState({ data: null, error: err?.shape ? err.message : describeFailure(err), loading: false });
      });
    return () => {
      active = false;
    };
    // fetcher/parse are module-level constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

const shapeError = (message) => Object.assign(new Error(message), { shape: true });

const fetchStats = () => api.get("/api/admin/stats");
const parseStats = (r) => {
  const d = r.data || {};
  const totals = {
    totalUsers: asCount(d.totalUsers),
    totalDoctors: asCount(d.totalDoctors),
    totalAppointments: asCount(d.totalAppointments),
  };
  if (Object.values(totals).some((v) => v === null)) throw shapeError("The server's reply did not contain the platform totals.");
  const byStatus = d.appointmentsByStatus && typeof d.appointmentsByStatus === "object" ? d.appointmentsByStatus : null;
  return {
    ...totals,
    pendingDeletionRequests: asCount(d.pendingAccountDeletionRequests),
    pendingDoctorApprovals: asCount(d.pendingDoctorApprovals),
    openDoctorTickets: asCount(d.openTickets?.doctor),
    openPatientTickets: asCount(d.openTickets?.patient),
    appointmentsByStatus: byStatus
      ? Object.fromEntries(APPOINTMENT_STATUSES.map(([key]) => [key, asCount(byStatus[key])]))
      : null,
  };
};

const fetchWorkflow = () => api.get("/api/admin/doctor-workflow-stats");
const parseWorkflow = (r) => ({
  profileUpdateRequests: asCount(r.data?.profileUpdateRequests),
  profileDeleteRequests: asCount(r.data?.profileDeleteRequests),
});

const fetchPartner = () => api.get("/api/admin/partner-cases/stats");
const parsePartner = (r) => {
  if (!r.data || typeof r.data !== "object") throw shapeError("The server's reply did not contain the case counts.");
  return Object.fromEntries(PARTNER_STATUSES.map(([key]) => [key, asCount(r.data[key])]));
};

const fetchSearch = () => getSearchAnalytics("/summary");
const parseSearch = (r) => {
  const d = r.data?.data;
  const interactions = asCount(d?.interactions);
  if (interactions === null) throw shapeError("The server's reply did not contain the search summary.");
  return {
    interactions,
    found: asCount(d.outcomes?.dedicatedPageFound),
    fallback: asCount(d.outcomes?.fallbackOnly),
    none: asCount(d.outcomes?.noResults),
    days: asCount(r.data?.window?.days),
    collectionOff: r.data?.meta?.collectionEnabled === false,
  };
};

function Metric({ to, label, value, tone }) {
  return (
    <Link to={to} className={`adx-metric${tone ? ` adx-metric--${tone}` : ""}`}>
      <span className="adx-metric-value">{show(value)}</span>
      <span className="adx-metric-label">{label}</span>
    </Link>
  );
}

function SectionCard({ title, linkTo, linkLabel, children, section }) {
  const headingId = `adx-h-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="adx-card" aria-labelledby={headingId}>
      <header className="adx-card-head">
        <h2 id={headingId} className="adx-card-title">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="adx-link">
            {linkLabel}
          </Link>
        )}
      </header>
      {section?.error ? (
        <div className="adx-section-error" role="alert">
          <span>{section.error}</span>
          <Button variant="secondary" size="sm" loading={section.loading} onClick={section.reload}>
            Try again
          </Button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Bar({ label, value, max }) {
  const pct = value === null || !max ? 0 : Math.round((value / max) * 100);
  return (
    <div className="adx-bar">
      <div className="adx-bar-row">
        <span className="adx-bar-label">{label}</span>
        <span className="adx-bar-value">{show(value)}</span>
      </div>
      <div className="adx-bar-track" aria-hidden="true">
        <div className="adx-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const { admin: user } = useAdmin();
  const [tick, setTick] = useState(0); // bumped by Refresh
  const [userQuery, setUserQuery] = useState("");

  const stats = useSection(fetchStats, parseStats, tick);
  const workflow = useSection(fetchWorkflow, parseWorkflow, tick);
  const partner = useSection(fetchPartner, parsePartner, tick);
  const search = useSection(fetchSearch, parseSearch, tick);

  const s = stats.data;
  const w = workflow.data;
  const refreshing = stats.loading || workflow.loading || partner.loading || search.loading;

  const openTickets =
    s && s.openDoctorTickets !== null && s.openPatientTickets !== null ? s.openDoctorTickets + s.openPatientTickets : null;

  const summary = [
    { label: "Total Users", value: s?.totalUsers, to: P.users, tone: "blue" },
    { label: "Approved Doctors", value: s?.totalDoctors, to: P.ourDoctors, tone: "green" },
    { label: "Total Appointments", value: s?.totalAppointments, to: P.appointments, tone: "amber" },
    { label: "Open Tickets", value: openTickets, to: P.tickets, tone: "red" },
  ];

  // Only real, loaded, non-zero counts are listed.
  const attention = [
    { n: s?.pendingDeletionRequests, text: "account deletion requests waiting", to: P.usersDeletionRequests },
    { n: s?.pendingDoctorApprovals, text: "doctor enrollments awaiting approval", to: P.manageDoctors },
    { n: w?.profileUpdateRequests, text: "doctor profile update requests", to: P.manageDoctors },
    { n: w?.profileDeleteRequests, text: "doctor profile deletion requests", to: P.manageDoctors },
    { n: openTickets, text: "open support tickets", to: P.tickets },
  ].filter((item) => item.n !== null && item.n !== undefined && item.n > 0);
  const attentionKnown = Boolean(s) && Boolean(w);

  const submitUserSearch = (event) => {
    event.preventDefault();
    const q = userQuery.trim();
    if (!q) return;
    navigate(`${P.users}?q=${encodeURIComponent(q)}`);
  };

  const apptMax = s?.appointmentsByStatus ? Math.max(0, ...Object.values(s.appointmentsByStatus).map((v) => v || 0)) : 0;
  const searchMax = search.data ? Math.max(search.data.found || 0, search.data.fallback || 0, search.data.none || 0) : 0;

  return (
    <div className="adx-page">
      <div className="adx-header">
        <div className="adx-heading">
          <span className="adx-eyebrow">Humancare Admin</span>
          <h1 className="adx-title">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="adx-sub">Here's an overview of the platform.</p>
        </div>
        <div className="adx-tools">
          <form className="adx-search" role="search" onSubmit={submitUserSearch}>
            <label htmlFor="adx-user-search" className="adx-sr-only">Find a user by name or email</label>
            <input
              id="adx-user-search"
              type="search"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Find a user…"
              autoComplete="off"
            />
            <button type="submit" className="adx-btn" disabled={!userQuery.trim()}>Search users</button>
          </form>
          <button type="button" className="adx-btn adx-btn--ghost" onClick={() => setTick((n) => n + 1)} disabled={refreshing} aria-busy={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {stats.error && (
        <div className="adx-load-error" role="alert">
          <div>
            <strong>Couldn't load the platform totals.</strong> {stats.error}
          </div>
          <Button variant="secondary" size="sm" loading={stats.loading} onClick={stats.reload}>
            Try again
          </Button>
        </div>
      )}

      <div className="adx-summary" aria-busy={stats.loading}>
        {summary.map((c) => (
          <Link key={c.label} to={c.to} className={`adx-stat adx-stat--${c.tone}`}>
            <span className="adx-stat-label">{c.label}</span>
            <span className="adx-stat-value">{show(c.value)}</span>
          </Link>
        ))}
      </div>

      {attentionKnown && (
        <section className={`adx-attention${attention.length ? "" : " adx-attention--clear"}`} aria-label="Needs attention">
          <strong className="adx-attention-title">{attention.length ? "Needs attention" : "Nothing needs attention right now"}</strong>
          {attention.length > 0 && (
            <ul className="adx-attention-list">
              {attention.map((item) => (
                <li key={item.text}>
                  <Link to={item.to} className="adx-attention-link">
                    <span className="adx-attention-count">{item.n.toLocaleString()}</span> {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="adx-grid-2">
        <SectionCard title="Our Doctors" linkTo={P.ourDoctors} linkLabel="View Our Doctors">
          <div className="adx-metrics">
            <Metric to={P.ourDoctors} label="Approved doctors" value={s?.totalDoctors} />
            <Metric to={P.manageDoctors} label="Awaiting approval" value={s?.pendingDoctorApprovals} tone="amber" />
            <Metric to={P.manageDoctors} label="Profile update requests" value={w?.profileUpdateRequests} />
            <Metric to={P.manageDoctors} label="Profile deletion requests" value={w?.profileDeleteRequests} />
          </div>
          <Link to={P.manageDoctors} className="adx-link adx-link--block">Manage Doctors</Link>
        </SectionCard>

        <SectionCard title="Manage Users" linkTo={P.users} linkLabel="View Manage Users">
          <div className="adx-metrics">
            <Metric to={P.users} label="Total users" value={s?.totalUsers} />
            <Metric to={P.usersDeletionRequests} label="Deletion requests pending" value={s?.pendingDeletionRequests} tone="amber" />
          </div>
          <Link to={P.deletionHistory} className="adx-link adx-link--block">Deletion history</Link>
        </SectionCard>
      </div>

      <SectionCard title="Appointments" linkTo={`${P.appointments}?tab=all`} linkLabel="View all appointments">
        {s && !s.appointmentsByStatus ? (
          <p className="adx-muted">Appointment status counts are not available from the server.</p>
        ) : (
          <div className="adx-status-grid">
            {APPOINTMENT_STATUSES.map(([key, label]) => (
              <Link key={key} to={`${P.appointments}?tab=${key}`} className="adx-status">
                <span className="adx-status-value">{show(s?.appointmentsByStatus?.[key])}</span>
                <span className="adx-status-label">{label}</span>
                <span className="adx-status-meter" aria-hidden="true">
                  <span style={{ width: `${apptMax && s?.appointmentsByStatus?.[key] ? Math.round((s.appointmentsByStatus[key] / apptMax) * 100) : 0}%` }} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="adx-grid-2">
        <SectionCard title="Search Analytics" linkTo={P.searchAnalytics} linkLabel="View Search Analytics" section={search}>
          {search.loading && !search.data ? (
            <p className="adx-muted">Loading…</p>
          ) : (
            <>
              <p className="adx-muted">
                {show(search.data?.interactions)} searches{search.data?.days ? ` in the last ${search.data.days} days` : ""}
                {search.data?.collectionOff ? " (collection is currently off)" : ""}
              </p>
              <Bar label="Dedicated page found" value={search.data?.found ?? null} max={searchMax} />
              <Bar label="Fallback only" value={search.data?.fallback ?? null} max={searchMax} />
              <Bar label="No results" value={search.data?.none ?? null} max={searchMax} />
            </>
          )}
        </SectionCard>

        <SectionCard title="Support Tickets" linkTo={P.tickets} linkLabel="View Support Tickets">
          <div className="adx-metrics">
            <Metric to={P.tickets} label="Open patient tickets" value={s?.openPatientTickets} tone="red" />
            <Metric to={P.tickets} label="Open doctor tickets" value={s?.openDoctorTickets} tone="red" />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Partner Cases" linkTo={P.partnerCases} linkLabel="View Partner Cases" section={partner}>
        <div className="adx-status-grid">
          {PARTNER_STATUSES.map(([key, label]) => (
            <Link key={key} to={P.partnerCases} className="adx-status">
              <span className="adx-status-value">{show(partner.data?.[key])}</span>
              <span className="adx-status-label">{label}</span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
