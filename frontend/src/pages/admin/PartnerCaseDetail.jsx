import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import adminPartnerApi from "../../api/adminPartnerApi";
import {
  STATUS_META,
  URGENCY_META,
  SERVICE_META,
  statusLabel,
  formatMoney,
} from "../partner/caseConstants";
import "./PartnerCaseDetail.css";
 
const NEXT_STATUS = {
  submitted: ["assigned", "cancelled"],
  assigned: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: ["invoiced"],
  invoiced: [],
  cancelled: [],
};

// System notices that just echo the status pipeline — hidden from the chat
// thread so it reads as a conversation, not an audit log.
const HIDDEN_SYSTEM_MESSAGES = new Set([
  "Case submitted.",
  'Status updated to "assigned".',
  'Status updated to "in-progress".',
  'Status updated to "completed".',
  'Status updated to "invoiced".',
]);

const chatMessages = (messages) =>
  (messages || []).filter(
    (m) => !(m.authorRole === "system" && HIDDEN_SYSTEM_MESSAGES.has(m.body)),
  );
 
export default function AdminPartnerCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [err, setErr] = useState("");
  const [message, setMessage] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef(null);
 
  const caseQ = useQuery({
    queryKey: ["admin", "partner-case", id],
    queryFn: () => adminPartnerApi.getCase(id),
    retry: false,
    onSuccess: (d) => {
      if (!notesDirty) setNotes(d.adminNotes || "");
    },
  });
  const doctorsQ = useQuery({ queryKey: ["admin", "approved-doctors"], queryFn: adminPartnerApi.listDoctors });
 
  const messageCount = chatMessages(caseQ.data?.messages).length;
  useEffect(() => {
    if (!chatOpen) return;
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messageCount, chatOpen]);
 
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "partner-case", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "partner-cases"] });
  };
  const onErr = (e) => setErr(e.response?.data?.msg || "Action failed.");
 
  const mStatus = useMutation({ mutationFn: (s) => adminPartnerApi.setStatus(id, s), onSuccess: invalidate, onError: onErr });
  const mAssign = useMutation({
    mutationFn: () => adminPartnerApi.assign(id, doctorId, videoLink),
    onSuccess: () => {
      setDoctorId("");
      setVideoLink("");
      invalidate();
    },
    onError: onErr,
  });
  const mBilling = useMutation({
    mutationFn: () => adminPartnerApi.setBilling(id, Math.round(Number(amount) * 100), c?.currency || "usd"),
    onSuccess: () => {
      setAmount("");
      invalidate();
    },
    onError: onErr,
  });
  const mNotes = useMutation({
    mutationFn: () => adminPartnerApi.setNotes(id, notes),
    onSuccess: () => {
      setNotesDirty(false);
      invalidate();
    },
    onError: onErr,
  });
  const mMsg = useMutation({
    mutationFn: () => adminPartnerApi.addMessage(id, message),
    onSuccess: () => {
      setMessage("");
      invalidate();
    },
    onError: onErr,
  });
 
  if (caseQ.isLoading)
    return (
      <div className="pt-page pt-empty" style={{ maxWidth: "100%" }}>
        Loading…
      </div>
    );
  if (caseQ.isError)
    return (
      <div className="pt-page pt-empty" style={{ maxWidth: "100%" }}>
        Case not found.
      </div>
    );
 
  const c = caseQ.data;
  const sm = STATUS_META[c.status] || { bg: "#e2e8f0", text: "#334155" };
  const transitions = NEXT_STATUS[c.status] || [];
 
  return (
    <div className="pt-page" style={{ maxWidth: "100%" }}>
      <div className="pt-page-head">
        <div>
          <button
            className="pt-btn pt-btn-ghost"
            style={{ marginBottom: 10 }}
            onClick={() => navigate("/admin-dashboard/partner-cases")}
          >
            ← Partners Cases
          </button>
          <h1 className="pt-page-title">
            {c.caseNumber}{" "}
            <span className="pt-badge" style={{ background: sm.bg, color: sm.text, marginLeft: 8 }}>
              {statusLabel(c.status)}
            </span>
          </h1>
          <p className="pt-page-sub">
            {c.partner?.companyName} ({c.partner?.partnerCode}) ·{" "}
            {SERVICE_META[c.serviceType]?.label || c.serviceType} ·{" "}
            <span style={{ color: URGENCY_META[c.urgency]?.color }}>
              {URGENCY_META[c.urgency]?.label || c.urgency}
            </span>
          </p>
        </div>
      </div>
 
      {err && <div className="pt-error">{err}</div>}
 
      <div className="pt-detail-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className="pt-card">
            <p className="pt-card-title">Patient</p>
            <Row label="Name" value={c.patient?.name} />
            <Row label="DOB" value={c.patient?.dob} />
            <Row label="Gender" value={c.patient?.gender} />
            <Row label="Phone" value={c.patient?.phone} />
            <Row label="Language" value={c.patient?.language} />
            {c.patient?.policyId && <Row label="Policy ID" value={c.patient.policyId} />}
            <div className="pt-highlight-box">
              <div className="pt-highlight-label">Chief complaint</div>
              <div className="pt-highlight-value">{c.patient?.complaint || "—"}</div>
            </div>
          </div>
 
          <div className="pt-card">
            <p className="pt-card-title">Location</p>
            <Row label="Country" value={c.location?.country} />
            <Row label="State" value={c.location?.state} />
            {c.location?.postalCode && <Row label="Pincode / ZIP" value={c.location.postalCode} />}
            {c.location?.pharmacyAddress && <Row label="Pharmacy" value={c.location.pharmacyAddress} />}
            {c.location?.clinicName && <Row label="Clinic" value={c.location.clinicName} />}
            {c.location?.address && <Row label="Address" value={c.location.address} />}
          </div>
 
          <div className="pt-card">
            <p className="pt-card-title">Status history</p>
            {(c.statusHistory || []).length === 0 ? (
              <span className="pt-hint">No history yet.</span>
            ) : (
              <div className="pt-history-list">
                {(c.statusHistory || []).map((h, i) => (
                  <div key={i} className="pt-history-item">
                    <span className="pt-history-dot" />
                    <span className="pt-history-status">{statusLabel(h.status)}</span>
                    <span>· {new Date(h.at).toLocaleString()}</span>
                    {h.byName ? <span>· {h.byName}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
 
        <div>
          <div className="pt-card">
            <p className="pt-card-title">Manage</p>
 
            <div className="pt-field">
              <label>Advance status</label>
              <div className="pt-manage-actions">
                {transitions.length === 0 && <span className="pt-hint">No further transitions.</span>}
                {transitions.map((s) => (
                  <button
                    key={s}
                    className="pt-btn pt-btn-ghost"
                    disabled={mStatus.isPending}
                    onClick={() => mStatus.mutate(s)}
                  >
                    → {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
 
            <div className="pt-field">
              <label>Assign doctor</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Select a doctor…</option>
                {(doctorsQ.data || [])
                  .filter((e) => e.doctorId?._id)
                  .map((e) => (
                    <option key={e._id} value={e.doctorId._id}>
                      {(e.firstName || e.doctorId?.name || "") + " " + (e.surname || "")} — {e.specialization || "General"}
                    </option>
                  ))}
              </select>
            </div>
            {c.serviceType === "teleconsultation" && (
              <div className="pt-field">
                <label>Video link (optional)</label>
                <input value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://…" />
              </div>
            )}
            <button
              className="pt-btn"
              disabled={!doctorId || mAssign.isPending}
              onClick={() => mAssign.mutate()}
            >
              {mAssign.isPending ? "Assigning…" : "Assign"}
            </button>
            {c.assignedDoctor?.name && (
              <p className="pt-hint">
                Currently: <strong>{c.assignedDoctor.name}</strong>
              </p>
            )}
          </div>
 
          <div className="pt-card">
            <p className="pt-card-title">Billing</p>
            <Row label="Current amount" value={formatMoney(c.amountCents, c.currency)} />
            <div className="pt-field" style={{ marginTop: 8 }}>
              <label>Set amount ({(c.currency || "usd").toUpperCase()})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 120.00"
              />
            </div>
            <button
              className="pt-btn"
              disabled={amount === "" || mBilling.isPending}
              onClick={() => mBilling.mutate()}
            >
              {mBilling.isPending ? "Saving…" : "Save amount"}
            </button>
          </div>
 
          <div className="pt-card">
            <p className="pt-card-title">Internal notes (not visible to partner)</p>
            <div className="pt-field">
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesDirty(true);
                }}
              />
            </div>
            <button className="pt-btn" disabled={!notesDirty || mNotes.isPending} onClick={() => mNotes.mutate()}>
              {mNotes.isPending ? "Saving…" : "Save notes"}
            </button>
          </div>
 
        </div>
      </div>

      {!chatOpen && (
        <button
          type="button"
          className="pt-chat-fab"
          onClick={() => setChatOpen(true)}
          aria-label="Open messages"
        >
          <ChatIcon />
          Messages
          {messageCount > 0 && <span className="pt-chat-fab__count">{messageCount}</span>}
        </button>
      )}

      {chatOpen && (
        <>
          <div className="pt-chat-overlay" onClick={() => setChatOpen(false)} />
          <aside className="pt-chat-drawer" role="dialog" aria-label="Case messages">
            <div className="pt-chat-drawer__head">
              <p className="pt-chat-drawer__title">Messages</p>
              <button
                type="button"
                className="pt-chat-drawer__close"
                onClick={() => setChatOpen(false)}
                aria-label="Close messages"
              >
                ×
              </button>
            </div>
            <div className="pt-chat">
              {chatMessages(c.messages).length === 0 ? (
                <div className="pt-chat-empty">
                  <span className="pt-chat-empty__icon" aria-hidden="true">💬</span>
                  No messages yet. Replies you send here are visible to the partner.
                </div>
              ) : (
                chatMessages(c.messages).map((m) => (
                  <div
                    key={m._id}
                    className={`pt-msg${m.authorRole === "admin" ? " mine" : ""}${
                      m.authorRole === "system" ? " system" : ""
                    }`}
                  >
                    {m.authorRole !== "system" && (
                      <div className="pt-msg-meta">
                        <span className="pt-msg-author">
                          {m.authorName} ({m.authorRole})
                        </span>
                        <span className="pt-msg-time">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="pt-msg-bubble">{m.body}</div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="pt-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (message.trim()) mMsg.mutate();
              }}
            >
              <input
                placeholder="Reply to the partner…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="submit" className="pt-btn" disabled={mMsg.isPending || !message.trim()}>
                {mMsg.isPending ? "Sending…" : "Send"}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
 
function Row({ label, value }) {
  return (
    <div className="pt-row">
      <span className="pt-row-label">{label}</span>
      <span className="pt-row-value">{value || "—"}</span>
    </div>
  );
}
 