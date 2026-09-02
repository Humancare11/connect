import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import partnerApi from "../../api/partnerApi";
import {
  STATUS_META,
  STATUS_PIPELINE,
  URGENCY_META,
  SERVICE_META,
  statusLabel,
  formatMoney,
} from "./caseConstants";
import "./partner.css";

export default function PartnerCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const caseQ = useQuery({
    queryKey: ["partner", "case", id],
    queryFn: () => partnerApi.getCase(id),
    refetchInterval: 20000,
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["partner", "case", id] });
    queryClient.invalidateQueries({ queryKey: ["partner", "cases"] });
    queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
  };

  const sendMsg = useMutation({
    mutationFn: () => partnerApi.addMessage(id, message),
    onSuccess: () => {
      setMessage("");
      invalidate();
    },
    onError: (err) => setActionError(err.response?.data?.msg || "Could not send message."),
  });

  const cancel = useMutation({
    mutationFn: () => partnerApi.cancelCase(id),
    onSuccess: invalidate,
    onError: (err) => setActionError(err.response?.data?.msg || "Could not cancel the case."),
  });

  if (caseQ.isLoading) return <div className="pt-page pt-empty">Loading case…</div>;
  if (caseQ.isError) {
    return (
      <div className="pt-page pt-empty">
        Case not found.{" "}
        <Link to="/partner-dashboard/cases" style={{ color: "#0369a1" }}>
          Back to All Cases
        </Link>
      </div>
    );
  }

  const c = caseQ.data;
  const activeIdx = STATUS_PIPELINE.indexOf(c.status);
  const sm = STATUS_META[c.status] || { bg: "#e2e8f0", text: "#334155" };

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div>
          <button
            className="pt-btn pt-btn-ghost"
            style={{ marginBottom: 10 }}
            onClick={() => navigate("/partner-dashboard/cases")}
          >
            ← All Cases
          </button>
          <h1 className="pt-page-title">
            {c.caseNumber}{" "}
            <span className="pt-badge" style={{ background: sm.bg, color: sm.text, marginLeft: 8 }}>
              {statusLabel(c.status)}
            </span>
          </h1>
          <p className="pt-page-sub">
            {SERVICE_META[c.serviceType]?.label || c.serviceType} ·{" "}
            <span style={{ color: URGENCY_META[c.urgency]?.color }}>
              {URGENCY_META[c.urgency]?.label || c.urgency}
            </span>
          </p>
        </div>
        {c.status === "submitted" && (
          <button
            className="pt-btn pt-btn-danger"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel case"}
          </button>
        )}
      </div>

      {actionError && <div className="pt-error">{actionError}</div>}

      {c.status !== "cancelled" && (
        <div className="pt-card">
          <div className="pt-pipeline">
            {STATUS_PIPELINE.map((st, i) => {
              const on = i <= activeIdx;
              return (
                <div key={st} style={{ display: "flex", alignItems: "center", flex: i < STATUS_PIPELINE.length - 1 ? 1 : "0 0 auto" }}>
                  <div className="pt-pipe-node">
                    <div className={`pt-pipe-circle${on ? " on" : ""}`}>{on ? "✓" : i + 1}</div>
                    <span className={on ? "on" : ""}>{statusLabel(st)}</span>
                  </div>
                  {i < STATUS_PIPELINE.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        margin: "0 4px 18px",
                        background: i < activeIdx ? "#0ea5e9" : "#e2e8f0",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 16 }} className="pt-detail-cols">
        <div>
          <div className="pt-card">
            <p className="pt-card-title">Patient</p>
            <Row label="Name" value={c.patient?.name} />
            <Row label="Date of birth" value={c.patient?.dob} />
            <Row label="Gender" value={c.patient?.gender} />
            <Row label="Phone" value={c.patient?.phone} />
            <Row label="Language" value={c.patient?.language} />
            <Row label="Policy / insurance ID" value={c.patient?.policyId} />
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "#f8fafc",
                borderRadius: 8,
                borderLeft: "2px solid #0ea5e9",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b" }}>Chief complaint</div>
              <div style={{ fontSize: 13 }}>{c.patient?.complaint || "—"}</div>
            </div>
          </div>

          <div className="pt-card">
            <p className="pt-card-title">Location</p>
            <Row label="Country" value={c.location?.country} />
            <Row label="State / Province" value={c.location?.state} />
            {c.location?.pharmacyAddress && <Row label="Pharmacy" value={c.location.pharmacyAddress} />}
            {c.location?.clinicName && <Row label="Clinic" value={c.location.clinicName} />}
            {c.location?.address && <Row label="Address" value={c.location.address} />}
          </div>

          {c.assignedDoctorName && (
            <div className="pt-card">
              <p className="pt-card-title">Assigned physician</p>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.assignedDoctorName}</div>
              {c.videoLink && (
                <a
                  href={c.videoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="pt-btn"
                  style={{ marginTop: 10 }}
                >
                  Join consultation
                </a>
              )}
            </div>
          )}

          {typeof c.amountCents === "number" && (
            <div className="pt-card">
              <p className="pt-card-title">Billing</p>
              <Row label="Amount" value={formatMoney(c.amountCents, c.currency)} />
              <Row label="Status" value={c.status === "invoiced" ? "Invoiced" : "Pending invoice"} />
            </div>
          )}
        </div>

        <div className="pt-card" style={{ display: "flex", flexDirection: "column" }}>
          <p className="pt-card-title">Case messages</p>
          <div className="pt-chat">
            {(c.messages || []).map((m) => (
              <div
                key={m._id}
                className={`pt-msg${m.authorRole === "partner" ? " mine" : ""}${
                  m.authorRole === "system" ? " system" : ""
                }`}
              >
                {m.authorRole !== "system" && (
                  <div className="pt-msg-meta">
                    {m.authorName} · {new Date(m.createdAt).toLocaleString()}
                  </div>
                )}
                <div className="pt-msg-bubble">{m.body}</div>
              </div>
            ))}
          </div>
          {c.status !== "cancelled" && (
            <form
              className="pt-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (message.trim()) sendMsg.mutate();
              }}
            >
              <input
                placeholder="Type a message…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button type="submit" className="pt-btn" disabled={sendMsg.isPending || !message.trim()}>
                Send
              </button>
            </form>
          )}
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
