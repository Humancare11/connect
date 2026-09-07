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
import "../partner/partner.css";

const NEXT_STATUS = {
  submitted: ["assigned", "cancelled"],
  assigned: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: ["invoiced"],
  invoiced: [],
  cancelled: [],
};

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

  const messageCount = caseQ.data?.messages?.length ?? 0;
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messageCount]);

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

  if (caseQ.isLoading) return <div className="pt-page pt-empty">Loading…</div>;
  if (caseQ.isError) return <div className="pt-page pt-empty">Case not found.</div>;

  const c = caseQ.data;
  const sm = STATUS_META[c.status] || { bg: "#e2e8f0", text: "#334155" };
  const transitions = NEXT_STATUS[c.status] || [];

  return (
    <div className="pt-page">
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className="pt-card">
            <p className="pt-card-title">Patient</p>
            <Row label="Name" value={c.patient?.name} />
            <Row label="DOB" value={c.patient?.dob} />
            <Row label="Gender" value={c.patient?.gender} />
            <Row label="Phone" value={c.patient?.phone} />
            <Row label="Language" value={c.patient?.language} />
            <Row label="Policy ID" value={c.patient?.policyId} />
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>Chief complaint</div>
              <div style={{ fontSize: 13 }}>{c.patient?.complaint || "—"}</div>
            </div>
          </div>

          <div className="pt-card">
            <p className="pt-card-title">Location</p>
            <Row label="Country" value={c.location?.country} />
            <Row label="State" value={c.location?.state} />
            {c.location?.pharmacyAddress && <Row label="Pharmacy" value={c.location.pharmacyAddress} />}
            {c.location?.clinicName && <Row label="Clinic" value={c.location.clinicName} />}
            {c.location?.address && <Row label="Address" value={c.location.address} />}
          </div>

          <div className="pt-card">
            <p className="pt-card-title">Status history</p>
            {(c.statusHistory || []).map((h, i) => (
              <div key={i} style={{ fontSize: 12, color: "#475569", padding: "3px 0" }}>
                {statusLabel(h.status)} · {new Date(h.at).toLocaleString()}
                {h.byName ? ` · ${h.byName}` : ""}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="pt-card">
            <p className="pt-card-title">Manage</p>

            <div className="pt-field">
              <label>Advance status</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {transitions.length === 0 && (
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>No further transitions.</span>
                )}
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
            <div className="pt-field">
              <label>Video link (optional)</label>
              <input value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://…" />
            </div>
            <button
              className="pt-btn"
              disabled={!doctorId || mAssign.isPending}
              onClick={() => mAssign.mutate()}
            >
              {mAssign.isPending ? "Assigning…" : "Assign"}
            </button>
            {c.assignedDoctor?.name && (
              <p style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>
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
            <textarea
              className="pt-field"
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 9 }}
              rows={4}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
            />
            <button className="pt-btn" disabled={!notesDirty || mNotes.isPending} onClick={() => mNotes.mutate()}>
              {mNotes.isPending ? "Saving…" : "Save notes"}
            </button>
          </div>

          <div className="pt-card pt-chat-card">
            <p className="pt-card-title">Messages</p>
            <div className="pt-chat">
              {(c.messages || []).length === 0 ? (
                <div className="pt-chat-empty">
                  No messages yet. Replies you send here are visible to the partner.
                </div>
              ) : (
                (c.messages || []).map((m) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}
