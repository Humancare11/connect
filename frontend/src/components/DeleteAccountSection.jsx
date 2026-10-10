import { useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import DeleteAccountModal from "./DeleteAccountModal";

const DANGER = "#c0392b";
const DANGER_BG = "#fcedec";
const FONT = "'Plus Jakarta Sans', sans-serif";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

/**
 * "Delete account" card at the bottom of Profile Settings.
 *
 * The state comes from the user's `deletionRequestStatus` (returned by
 * /api/auth/me and login):
 *   none / approved → button that opens the confirmation modal
 *   pending         → "Deletion requested" banner + Cancel request
 *   rejected        → "declined" notice + button to ask again
 */
export default function DeleteAccountSection() {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;
  const status = user.deletionRequestStatus || "none";
  const pending = status === "pending";
  const requestedOn = formatDate(user.deletionRequestedAt);

  const handleSubmitted = (serverUser, { alreadyPending } = {}) => {
    // Prefer the server's copy; if the request already existed (e.g. made from
    // the app) just mark it pending so the banner shows.
    updateUser(
      serverUser
        ? { ...user, ...serverUser }
        : { ...user, deletionRequestStatus: alreadyPending ? "pending" : user.deletionRequestStatus },
    );
  };

  const cancelRequest = async () => {
    if (cancelling) return;
    setCancelling(true);
    setError("");
    try {
      const res = await api.post("/api/auth/account-delete-request/cancel", null, { authRole: "user" });
      updateUser({ ...user, ...(res.data?.user || { deletionRequestStatus: "none", deletionRequestedAt: null }) });
    } catch (err) {
      if (!err?.response) {
        setError("We couldn't reach the server. Check your connection and try again.");
      } else if (err.response.status === 400) {
        // Nothing pending any more (an admin already decided) — refresh the view.
        try {
          const me = await api.get("/api/auth/me", { authRole: "user" });
          updateUser(me.data.user);
        } catch { /* keep what we have */ }
        setError(err.response.data?.msg || "There is no pending request to cancel.");
      } else {
        setError(err.response.data?.msg || "Unable to cancel your request right now. Please try again.");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section
      aria-labelledby="delete-account-heading"
      style={{
        marginTop: "24px", borderRadius: "22px", padding: "24px 28px", boxSizing: "border-box",
        background: "rgba(255,255,255,0.60)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${DANGER}40`, fontFamily: FONT,
      }}
    >
      <h2 id="delete-account-heading" style={{ fontSize: "17px", fontWeight: 700, color: DANGER, margin: "0 0 6px" }}>
        Delete account
      </h2>
      <p style={{ fontSize: "13px", color: "#6b7ca3", lineHeight: 1.55, margin: "0 0 16px" }}>
        Request permanent deletion of your account and personal data. Our team reviews every request — it is not instant.
      </p>

      {pending ? (
        <div role="status" style={{ background: DANGER_BG, borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: DANGER, margin: "0 0 4px" }}>
            Deletion requested{requestedOn ? ` on ${requestedOn}` : ""}
          </p>
          <p style={{ fontSize: 13, color: "#6b7ca3", lineHeight: 1.5, margin: "0 0 12px" }}>
            Our team will review your request and email you once it has been processed. Your account stays active until then.
          </p>
          <button
            type="button"
            onClick={cancelRequest}
            disabled={cancelling}
            style={{ padding: "10px 20px", borderRadius: 12, border: `1.5px solid ${DANGER}`, background: "#fff", color: DANGER, fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.7 : 1 }}
          >
            {cancelling ? "Cancelling…" : "Cancel request"}
          </button>
        </div>
      ) : (
        <>
          {status === "rejected" && (
            <p role="status" style={{ background: "#eaedf9", color: "#0b0443", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>
              Your previous deletion request was declined, so your account is unchanged. You can submit a new request if you still want to delete it.
            </p>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ padding: "11px 24px", borderRadius: 12, border: `1.5px solid ${DANGER}`, background: "#fff", color: DANGER, fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
          >
            {status === "rejected" ? "Request account deletion again" : "Delete my account"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: DANGER, margin: "12px 0 0" }}>
          {error}
        </p>
      )}

      {open && (
        <DeleteAccountModal
          onClose={() => setOpen(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </section>
  );
}
