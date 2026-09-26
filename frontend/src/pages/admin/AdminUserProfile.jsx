import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Country } from "country-state-city";
import api from "../../api";
import UserConsultationList from "./UserConsultationList";
import {
  approveUserDeletion,
  deleteUserAccount,
  mergeUpdatedUser,
  rejectUserDeletion,
} from "./userAdminActions";
import "./ManageUsers.css";
import "./AdminUserProfile.css";

const LIST_PATH = "/admin-dashboard/manage-users";
const NOT_PROVIDED = "Not provided";

function getCountryName(isoCode) {
  if (!isoCode) return "";
  const country = Country.getCountryByCode(isoCode);
  return country?.name || isoCode;
}

function formatPatientId(value) {
  if (value === undefined || value === null || value === "") return "";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 99999) {
    return String(numeric).padStart(5, "0");
  }
  return String(value);
}

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

// How the account was created. The API resolves this for older accounts too
// (see backend utils/signupMethod.js); "" means it can't be told.
const SIGNUP_METHOD_LABELS = {
  email: "Email",
  google: "Google",
  email_google: "Email + Google",
};

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

function BackLink({ search }) {
  return (
    <Link className="mu-back-btn" to={{ pathname: LIST_PATH, search }} state={{ restoreScroll: true }}>
      <span aria-hidden="true">←</span> Back to Manage Users
    </Link>
  );
}

function ProfileSkeleton({ search }) {
  return (
    <div className="mu-page" aria-busy="true">
      <div className="mu-page-bar">
        <BackLink search={search} />
      </div>
      <div className="mu-skeleton mu-skeleton--hero" />
      <div className="mu-grid">
        <div className="mu-skeleton mu-skeleton--card" />
        <div className="mu-skeleton mu-skeleton--card" />
      </div>
    </div>
  );
}

function ProfileMessage({ title, text, search, onRetry }) {
  return (
    <div className="mu-page">
      <div className="mu-page-bar">
        <BackLink search={search} />
      </div>
      <div className="mu-page-message">
        <h3>{title}</h3>
        <p>{text}</p>
        {onRetry && (
          <button type="button" className="mu-load-more" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function UserProfile({ id }) {
  const location = useLocation();
  const navigate = useNavigate();
  // The list's query string (search / filter), passed along when opening this
  // page so "Back" can restore it. Empty for a direct link or a refresh.
  const listSearch = location.state?.from || "";

  const [load, setLoad] = useState({ status: "loading", user: null });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stats, setStats] = useState({ status: "loading", data: null });
  const [statsAttempt, setStatsAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  // The user is loaded by id (not taken from the list), so a direct link or a
  // refresh works.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/admin/users/${id}`)
      .then((res) => {
        if (cancelled) return;
        // This page is for patient accounts only.
        if (res.data?.role !== "user") setLoad({ status: "notfound", user: null });
        else setLoad({ status: "ready", user: res.data });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("user profile load failed:", err);
        setLoad({ status: err?.response?.status === 404 ? "notfound" : "error", user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadAttempt]);

  // Consultation counts are calculated by the API on demand (both booking
  // collections) rather than stored on the user.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/admin/users/${id}/consultation-summary`)
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
  }, [id, statsAttempt]);

  const showToast = (message, ok = true) => {
    setToast({ msg: message, ok });
    setTimeout(() => setToast(null), 4000);
  };

  if (load.status === "loading") return <ProfileSkeleton search={listSearch} />;
  if (load.status === "notfound") {
    return (
      <ProfileMessage
        title="User not found"
        text="This account doesn't exist or was deleted."
        search={listSearch}
      />
    );
  }
  if (load.status === "error") {
    return (
      <ProfileMessage
        title="Couldn't load this user"
        text="Something went wrong while loading the profile."
        search={listSearch}
        onRetry={() => {
          setLoad({ status: "loading", user: null });
          setLoadAttempt((n) => n + 1);
        }}
      />
    );
  }

  const user = load.user;
  const hasPendingDeletion = user.deletionRequestStatus === "pending";
  const patientId = formatPatientId(user.patientId);
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

  // After the account is gone there's nothing left to show: go back to the list
  // (with its search / filter and scroll position) and report the result there.
  const backToListWithToast = (message) =>
    navigate({ pathname: LIST_PATH, search: listSearch }, { state: { toast: message, restoreScroll: true } });

  const handleDelete = async () => {
    const result = await deleteUserAccount(user._id, user.name);
    if (!result.done) return;
    if (result.ok) backToListWithToast(result.message);
    else showToast(result.message, false);
  };

  const handleApprove = async () => {
    const result = await approveUserDeletion(user._id, user.name);
    if (!result.done) return;
    if (result.ok) backToListWithToast(result.message);
    else showToast(result.message, false);
  };

  const handleReject = async () => {
    const result = await rejectUserDeletion(user._id, user.name);
    if (!result.done) return;
    if (result.ok) setLoad((prev) => ({ ...prev, user: mergeUpdatedUser(prev.user, result.user) }));
    showToast(result.message, result.ok);
  };

  return (
    <div className="mu-page">
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      <div className="mu-page-bar">
        <BackLink search={listSearch} />
        <div className="mu-page-actions">
          {hasPendingDeletion ? (
            <>
              <button className="adp-btn adp-btn--reject" onClick={handleReject}>
                Reject Deletion
              </button>
              <button className="adp-btn adp-btn--approve" onClick={handleApprove}>
                Approve Deletion
              </button>
            </>
          ) : (
            <button className="adp-btn adp-btn--reject" onClick={handleDelete}>
              Delete User
            </button>
          )}
        </div>
      </div>

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
          <ConsultationStats
            state={stats}
            onRetry={() => {
              setStats({ status: "loading", data: null });
              setStatsAttempt((n) => n + 1);
            }}
          />
          <div className="mu-subheading">All consultations</div>
          <UserConsultationList userId={user._id} />
        </Section>

        <Section title="Account Information" className="mu-span-2">
          <div className="mu-fields">
            <Field label="Member Since" value={formatDate(user.createdAt)} />
            <Field label="Signed Up With" value={SIGNUP_METHOD_LABELS[user.signupMethod] || "Unknown"} />
            <Field label="Registered Via" value={formatRegisteredVia(user)} />
            <Field label="Registration IP" value={user.registrationIp} mono />
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
  );
}

// Keyed by id so opening a different user always starts from a clean state.
export default function AdminUserProfile() {
  const { id } = useParams();
  return <UserProfile key={id} id={id} />;
}
