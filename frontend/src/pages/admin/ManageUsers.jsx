import { useEffect, useState } from "react";
import { Country } from "country-state-city";
import api from "../../api";
import "./ManageUsers.css";

function getCountryName(isoCode) {
  if (!isoCode) return "";
  const country = Country.getCountryByCode(isoCode);
  return country?.name || isoCode;
}

function formatPatientId(value) {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 99999) {
    return String(numeric).padStart(5, "0");
  }
  return String(value);
}

const NOT_PROVIDED = "Not provided";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
};

// "Web · Chrome on Windows" / "App · Android" / "Unknown" (accounts created
// before this was recorded). An app guessed from its HTTP client rather than
// declared by the app itself is flagged "(inferred)".
function formatRegisteredVia(user) {
  const platform = user.registrationPlatform;
  const subType = user.registrationSubType;
  if (platform === "web") return `Web · ${subType || "Browser unknown"}`;
  if (platform === "app") {
    const os = { android: "Android", ios: "iOS" }[subType] || "Platform unknown";
    const version = user.registrationAppVersion ? ` · v${user.registrationAppVersion}` : "";
    const inferred = user.registrationPlatformSource === "inferred" ? " (inferred)" : "";
    return `App · ${os}${version}${inferred}`;
  }
  return "Unknown";
}

function Field({ label, value, mono }) {
  return (
    <div className="mu-field">
      <div className="mu-field-label">{label}</div>
      <div className={`mu-field-value${value ? "" : " mu-field-value--empty"}${mono ? " mu-mono" : ""}`}>
        {value || NOT_PROVIDED}
      </div>
    </div>
  );
}

function Section({ title, hint, className = "", children }) {
  return (
    <section className={`mu-section ${className}`}>
      <div className="mu-section-title">
        <span>{title}</span>
        {hint && <span className="mu-section-hint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

const STAT_TILES = [
  { key: "total", label: "Total", tone: "total" },
  { key: "completed", label: "Completed", tone: "completed" },
  { key: "upcoming", label: "Upcoming", tone: "upcoming" },
  { key: "cancelled", label: "Cancelled", tone: "cancelled" },
];

function ConsultationStats({ state, onRetry }) {
  if (state.status === "error") {
    return (
      <div className="mu-stats-error">
        <span>Couldn't load consultation count.</span>
        <button type="button" className="mu-link-btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  const loading = state.status === "loading";
  const data = state.data || {};
  const tiles = data.other > 0 ? [...STAT_TILES, { key: "other", label: "Other", tone: "other" }] : STAT_TILES;

  return (
    <div className="mu-stats" aria-busy={loading}>
      {tiles.map((tile) => (
        <div key={tile.key} className={`mu-stat mu-stat--${tile.tone}`}>
          {loading ? (
            <span className="mu-skeleton mu-skeleton--num" />
          ) : (
            <div className="mu-stat-num">{data[tile.key] ?? 0}</div>
          )}
          <div className="mu-stat-label">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

function UserModal({ user, onClose, onDelete, onApproveDelete, onRejectDelete }) {
  const userId = user?._id;
  const [stats, setStats] = useState({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  // Consultation counts are calculated by the API on demand (both booking
  // collections) rather than stored on the user. The modal is keyed by user, so
  // it starts in the loading state for every user it is opened for.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    api
      .get(`/api/admin/users/${userId}/consultation-summary`)
      .then((res) => {
        if (!cancelled) setStats({ status: "ready", data: res.data });
      })
      .catch((err) => {
        console.error("consultation summary failed:", err);
        if (!cancelled) setStats({ status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  if (!user) return null;

  const hasPendingDeletion = user.deletionRequestStatus === "pending";
  const patientId = user.patientId ? formatPatientId(user.patientId) : "";
  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";
  const roleLabel = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User";

  const copyPatientId = async () => {
    try {
      await navigator.clipboard.writeText(patientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context / denied) — nothing to do */
    }
  };

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal mu-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">User Profile</h3>
          <button className="adp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="adp-modal-body mu-body">
          {/* Identity card */}
          <div className="mu-hero">
            <div className="mu-avatar">{initials}</div>
            <div className="mu-hero-info">
              <div className="mu-hero-name">{user.name || NOT_PROVIDED}</div>
              <div className="mu-hero-email">{user.email || NOT_PROVIDED}</div>
              <div className="mu-hero-badges">
                <span className="mu-badge">👤 {roleLabel}</span>
                {patientId && (
                  <button
                    type="button"
                    className="mu-badge mu-badge--btn"
                    onClick={copyPatientId}
                    title="Copy patient ID"
                  >
                    🆔 {patientId} · {copied ? "Copied" : "Copy"}
                  </button>
                )}
                {hasPendingDeletion && <span className="mu-badge mu-badge--warn">Deletion requested</span>}
              </div>
            </div>
          </div>

          <div className="mu-grid">
            <Section title="Personal Information">
              <div className="mu-fields">
                <Field label="Mobile" value={user.mobile} />
                <Field label="Gender" value={user.gender} />
                <Field label="Date of Birth" value={user.dob} />
              </div>
            </Section>

            <Section title="Location" hint={user.locationSource === "ip" ? "Detected from IP" : ""}>
              <div className="mu-fields">
                <Field label="Country" value={getCountryName(user.country)} />
                <Field label="State / Province" value={user.state} />
                <Field label="City" value={user.city} />
              </div>
            </Section>

            <Section title="Consultations" className="mu-span-2">
              <ConsultationStats state={stats} onRetry={() => {
                  setStats({ status: "loading", data: null });
                  setAttempt((n) => n + 1);
                }} />
            </Section>

            <Section title="Account Information" className="mu-span-2">
              <div className="mu-fields">
                <Field label="Member Since" value={formatDate(user.createdAt)} />
                <Field label="Registration IP" value={user.registrationIp} mono />
                <Field label="Registered Via" value={formatRegisteredVia(user)} />
              </div>
            </Section>

            {hasPendingDeletion && (
              <Section title="Account Deletion Request" className="mu-span-2 mu-section--warn">
                <div className="mu-fields">
                  <Field label="Reason" value={user.deletionReason || "No reason provided"} />
                  <Field label="Requested On" value={formatDate(user.deletionRequestedAt)} />
                </div>
              </Section>
            )}
          </div>
        </div>

        <div className="adp-modal-footer">
          <button className="adp-btn adp-btn--ghost" onClick={onClose}>
            Close
          </button>
          {hasPendingDeletion ? (
            <>
              <button
                className="adp-btn adp-btn--reject"
                onClick={() => onRejectDelete(user._id, user.name)}
              >
                Reject Deletion
              </button>
              <button
                className="adp-btn adp-btn--approve"
                onClick={() => onApproveDelete(user._id, user.name)}
              >
                Approve Deletion
              </button>
            </>
          ) : (
            <button
              className="adp-btn adp-btn--reject"
              onClick={() => onDelete(user._id, user.name)}
            >
              Delete User
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api
      .get("/api/admin/users")
      .then((r) => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`))
      return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setSelected(null);
      showToast("User deleted.");
    } catch {
      showToast("Failed to delete user.", false);
    }
  };

  const handleApproveDelete = async (userId, userName) => {
    if (!window.confirm(`Approve deletion request for "${userName}"? Their account will be permanently deleted.`))
      return;
    try {
      await api.put(`/api/admin/users/${userId}/delete-request/approve`, {});
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setSelected(null);
      showToast("Account deletion approved and account deleted.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Failed to approve deletion request.", false);
    }
  };

  const handleRejectDelete = async (userId, userName) => {
    if (!window.confirm(`Reject deletion request for "${userName}"?`)) return;
    try {
      const res = await api.put(`/api/admin/users/${userId}/delete-request/reject`, {});
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.data?.user || u : u)));
      setSelected((prev) => (prev?._id === userId ? res.data?.user || prev : prev));
      showToast("Deletion request rejected.");
    } catch (err) {
      showToast(err?.response?.data?.msg || "Failed to reject deletion request.", false);
    }
  };

  const deletionRequestCount = users.filter((u) => u.deletionRequestStatus === "pending").length;

  const filtered = users
    .filter((u) =>
      filter === "deletion_requests" ? u.deletionRequestStatus === "pending" : true,
    )
    .filter(
      (u) =>
        String(u.patientId || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <div>
      {toast && (
        <div
          className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}
        >
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}
      {selected && (
        <UserModal
          key={selected._id}
          user={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onApproveDelete={handleApproveDelete}
          onRejectDelete={handleRejectDelete}
        />
      )}

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Manage Users</h1>
        <p className="adp-sub">
          View and manage all registered patient accounts.
        </p>
      </div>

      <div
        className="adp-stats"
        style={{ gridTemplateColumns: "repeat(4,1fr)" }}
      >
        <div className="adp-stat adp-stat--blue">
          <div className="adp-stat-icon">👥</div>
          <div className="adp-stat-value">{users.length}</div>
          <div className="adp-stat-label">Total Users</div>
        </div>
        <div className="adp-stat adp-stat--green">
          <div className="adp-stat-icon">✅</div>
          <div className="adp-stat-value">
            {users.filter((u) => u.role === "user").length}
          </div>
          <div className="adp-stat-label">Patients</div>
        </div>
        <div className="adp-stat adp-stat--purple">
          <div className="adp-stat-icon">🗓</div>
          <div className="adp-stat-value">
            {
              users.filter((u) => {
                const d = new Date(u.createdAt);
                const now = new Date();
                return (
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear()
                );
              }).length
            }
          </div>
          <div className="adp-stat-label">Joined This Month</div>
        </div>
        <div className="adp-stat adp-stat--amber">
          <div className="adp-stat-icon">🗑️</div>
          <div className="adp-stat-value">{deletionRequestCount}</div>
          <div className="adp-stat-label">Pending Deletion Requests</div>
        </div>
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <div className="adp-tabs">
            {[
              { key: "all", label: "All Users", count: users.length },
              { key: "deletion_requests", label: "Deletion Requests", count: deletionRequestCount },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`adp-tab ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span className="adp-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="adp-search">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search by patient ID, name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">
              {filter === "deletion_requests" ? "🗑️" : "👥"}
            </div>
            <h3>No users found</h3>
            <p>
              {search
                ? "Try a different search."
                : filter === "deletion_requests"
                ? "No pending account deletion requests."
                : "No users have registered yet."}
            </p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Patient ID</th>
                  <th>Mobile</th>
                  <th>Gender</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          className="adp-avatar"
                          style={{ background: "#ede9fe", color: "#7c3aed" }}
                        >
                          {u.name
                            ? u.name
                                .split(" ")
                                .map((w) => w[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            : "U"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                        color: "#475569",
                      }}
                    >
                      {formatPatientId(u.patientId)}
                    </td>
                    <td>{u.mobile || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {u.gender || "—"}
                    </td>
                    <td>{getCountryName(u.country) || "—"}</td>
                    <td>
                      {u.deletionRequestStatus === "pending" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "#fee2e2",
                            color: "#991b1b",
                            borderRadius: 20,
                            padding: "3px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          🗑️ Deletion Requested
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="adp-btn adp-btn--view"
                          onClick={() => setSelected(u)}
                        >
                          View
                        </button>
                        {u.deletionRequestStatus === "pending" ? (
                          <>
                            <button
                              className="adp-btn adp-btn--approve"
                              onClick={() => handleApproveDelete(u._id, u.name)}
                            >
                              Approve
                            </button>
                            <button
                              className="adp-btn adp-btn--reject"
                              onClick={() => handleRejectDelete(u._id, u.name)}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            className="adp-btn adp-btn--reject"
                            onClick={() => handleDelete(u._id, u.name)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
