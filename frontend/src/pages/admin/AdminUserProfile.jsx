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

// One label / value row of an information card.
function Row({ label, value, mono }) {
  return (
    <div className="mu-row">
      <div className="mu-row-label">{label}</div>
      <div className={`mu-row-value${value ? "" : " mu-row-value--empty"}${mono && value ? " mu-mono" : ""}`}>
        {value || NOT_PROVIDED}
      </div>
    </div>
  );
}

function Section({ title, className = "", children }) {
  return (
    <section className={`mu-section ${className}`}>
      <div className="mu-section-title">
        <span>{title}</span>
      </div>
      {children}
    </section>
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
      </div>

      {/* Header card */}
      <div className="mu-hero">
        <div className="mu-avatar">{initials}</div>
        <div className="mu-hero-info">
          <div className="mu-hero-name">{user.name || NOT_PROVIDED}</div>
          <div className="mu-hero-sub">User ID - {patientId || NOT_PROVIDED}</div>
          {hasPendingDeletion && (
            <div className="mu-hero-notice">
              Deletion requested{user.deletionRequestedAt ? ` on ${formatDate(user.deletionRequestedAt)}` : ""}
              {user.deletionReason ? ` — “${user.deletionReason}”` : ""}
            </div>
          )}
        </div>
        <div className="mu-hero-actions">
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

      <div className="mu-grid mu-grid--profile">
        <Section title="Personal Information" className="mu-area-personal">
          <Row label="Email ID" value={user.email} />
          <Row label="Phone No." value={user.mobile} />
          <Row label="DOB" value={user.dob} />
          <Row label="Gender" value={user.gender} />
          <Row label="State" value={user.state} />
          <Row label="Country" value={getCountryName(user.country)} />
          <Row label="IP" value={user.registrationIp} mono />
        </Section>

        <Section title="Consultations Info" className="mu-area-consults">
          <UserConsultationList userId={user._id} />
        </Section>

        <Section title="A/C Information" className="mu-area-account">
          <Row label="Sign up with" value={SIGNUP_METHOD_LABELS[user.signupMethod] || "Unknown"} />
          <Row label="Registered via" value={formatRegisteredVia(user)} />
        </Section>
      </div>
    </div>
  );
}

// Keyed by id so opening a different user always starts from a clean state.
export default function AdminUserProfile() {
  const { id } = useParams();
  return <UserProfile key={id} id={id} />;
}
