import { useCallback, useEffect, useState } from "react";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import { hub } from "./liveChatHub";

// Live Chat > AI Review (Super Admin, or an admin the Super Admin has allowed): chats the safety layer flagged as
// medical. A reviewer opens the transcript and marks it OK or Issue with a note. Every review is a new row in an
// append-only log: nothing here edits or deletes one.
const BASE = "/api/admin/livechat";
const REASONS = {
  reply_blocked: "Reply blocked",
  emergency_keyword: "Emergency keyword",
  model_emergency: "AI said emergency",
  model_medical: "Medical question",
};
const ERRORS = {
  invalid_outcome: "Choose OK or Issue.",
  note_required: "Add a few words about the issue.",
  note_too_long: "The note is too long (1000 characters at most).",
  reviewer_only: "You do not have access to AI Review.",
  not_found: "This chat is no longer available.",
};
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "–");
const day = (iso) => (iso ? new Date(iso).toLocaleDateString() : "–");
const reasonText = (reasons) => (reasons?.length ? reasons.map((r) => REASONS[r] || r).join(", ") : "–");
const statusText = (review) =>
  review?.status === "reviewed" ? (review.lastOutcome === "issue" ? "Reviewed: Issue" : "Reviewed: OK") : "Unreviewed";
const errorOf = (err, fallback) => ERRORS[err?.response?.data?.error] || fallback;

export default function AdminLiveReview() {
  const { admin } = useAdmin();
  const me = String(admin?._id || admin?.id || "");
  useEffect(() => hub.acquire(me), [me]);

  const [tab, setTab] = useState("chats"); // chats | log
  const [status, setStatus] = useState("unreviewed");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chats, setChats] = useState(null);
  const [log, setLog] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");

  const loadChats = useCallback(() => {
    api
      .get(`${BASE}/review`, { params: { status, ...(from ? { from } : {}), ...(to ? { to } : {}) } })
      .then(({ data }) => {
        setChats(data.chats);
        setError("");
      })
      .catch((err) => setError(errorOf(err, "Could not load the flagged chats.")));
  }, [status, from, to]);
  const loadLog = useCallback(() => {
    api
      .get(`${BASE}/review/log`)
      .then(({ data }) => {
        setLog(data.entries);
        setError("");
      })
      .catch((err) => setError(errorOf(err, "Could not load the review log.")));
  }, []);

  useEffect(() => {
    if (tab === "chats") loadChats();
    else loadLog();
  }, [tab, loadChats, loadLog]);

  const reviewed = () => {
    loadChats();
    if (tab === "log") loadLog();
  };

  return (
    <div className="lcp">
      <div className="lcp-title">
        <div>
          <div className="lcp-eyebrow">Humancare Admin · Live Chat</div>
          <h2>AI Review</h2>
        </div>
      </div>
      <p className="lcp-note">
        Chats where the AI was stopped from giving medical advice, an emergency was detected, or the topic was medical. Open one, read it, and mark it OK or
        Issue. Reviews are kept in a log that cannot be edited or deleted.
      </p>
      <div className="rv-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "chats"} className={`lcp-btn${tab === "chats" ? " lcp-btn--primary" : ""}`} onClick={() => setTab("chats")}>
          Flagged chats
        </button>
        <button type="button" role="tab" aria-selected={tab === "log"} className={`lcp-btn${tab === "log" ? " lcp-btn--primary" : ""}`} onClick={() => setTab("log")}>
          Review log
        </button>
      </div>
      {error && (
        <div className="lcp-error" role="alert">
          {error}
        </div>
      )}

      {tab === "chats" && (
        <>
          <div className="rv-filters">
            <label>
              Show
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="unreviewed">Unreviewed</option>
                <option value="reviewed">Reviewed</option>
                <option value="all">All</option>
              </select>
            </label>
            <label>
              From
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" className="lcp-btn" onClick={loadChats}>
              Refresh
            </button>
          </div>
          <div className="rv-split">
            <div className="lcp-table-wrap">
              <table className="lcp-table">
                <thead>
                  <tr>
                    <th>Flagged</th>
                    <th>Chat ID</th>
                    <th>Why</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {(chats || []).map((c) => (
                    <tr key={c.conversationId} className={`rv-row${openId === c.conversationId ? " rv-row--open" : ""}`}>
                      <td>{when(c.flags.lastAt)}</td>
                      <td>
                        <button type="button" className="rv-link lcp-mono" onClick={() => setOpenId(c.conversationId)}>
                          {c.conversationId}
                        </button>
                      </td>
                      <td>{reasonText(c.flags.reasons)}</td>
                      <td className={c.review.status === "reviewed" && c.review.lastOutcome === "issue" ? "rv-issue" : ""}>{statusText(c.review)}</td>
                    </tr>
                  ))}
                  {chats && chats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="lcp-muted" style={{ textAlign: "center", padding: 24 }}>
                        No flagged chats for this filter.
                      </td>
                    </tr>
                  )}
                  {!chats && (
                    <tr>
                      <td colSpan={4} className="lcp-muted" style={{ textAlign: "center", padding: 24 }}>
                        Loading…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {openId ? <ReviewDetail key={openId} id={openId} onReviewed={reviewed} onClose={() => setOpenId("")} /> : <div className="rv-empty lcp-muted">Open a chat to read it.</div>}
          </div>
        </>
      )}

      {tab === "log" && (
        <div className="lcp-table-wrap">
          <table className="lcp-table">
            <thead>
              <tr>
                <th>Reviewed</th>
                <th>Chat ID</th>
                <th>Chat date</th>
                <th>Why it was flagged</th>
                <th>Reviewer</th>
                <th>Outcome</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {(log || []).map((e) => (
                <tr key={e.id}>
                  <td>{when(e.at)}</td>
                  <td>
                    {e.chatAvailable ? (
                      <button
                        type="button"
                        className="rv-link lcp-mono"
                        onClick={() => {
                          setTab("chats");
                          setStatus("all");
                          setOpenId(e.conversationId);
                        }}
                      >
                        {e.conversationId}
                      </button>
                    ) : (
                      <span className="lcp-mono">{e.conversationId}</span>
                    )}
                    {!e.chatAvailable && <div className="lcp-muted">chat deleted</div>}
                  </td>
                  <td>{day(e.chatStartedAt)}</td>
                  <td>{reasonText(e.flagReasons)}</td>
                  <td>{e.reviewer.name || "–"}</td>
                  <td className={e.outcome === "issue" ? "rv-issue" : ""}>{e.outcome === "issue" ? "Issue" : "OK"}</td>
                  <td className="rv-note">{e.note || "–"}</td>
                </tr>
              ))}
              {log && log.length === 0 && (
                <tr>
                  <td colSpan={7} className="lcp-muted" style={{ textAlign: "center", padding: 24 }}>
                    No reviews yet.
                  </td>
                </tr>
              )}
              {!log && (
                <tr>
                  <td colSpan={7} className="lcp-muted" style={{ textAlign: "center", padding: 24 }}>
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReviewDetail({ id, onReviewed, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("ok");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const load = useCallback(() => {
    api
      .get(`${BASE}/review/${id}`)
      .then(({ data: body }) => {
        setData(body);
        setError("");
      })
      .catch((err) => setError(errorOf(err, "Could not load this chat.")));
  }, [id]);
  useEffect(load, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved("");
    try {
      await api.post(`${BASE}/review/${id}`, { outcome, note });
      setNote("");
      setOutcome("ok");
      setSaved("Review saved.");
      load();
      onReviewed();
    } catch (err) {
      setError(errorOf(err, "Could not save the review."));
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) {
    return (
      <div className="rv-detail">
        <div className="lcp-error" role="alert">
          {error}
        </div>
        <button type="button" className="lcp-btn" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  if (!data) return <div className="rv-detail lcp-muted">Loading…</div>;
  const { chat, messages, reviews } = data;
  return (
    <div className="rv-detail">
      <div className="rv-detail-head">
        <div>
          <b className="lcp-mono">{chat.conversationId}</b>
          <div className="lcp-muted">
            Started {when(chat.startedAt)} · {statusText(chat.review)}
          </div>
          <div className="lcp-muted">Flagged: {reasonText(chat.flags.reasons)}</div>
        </div>
        <button type="button" className="lcp-btn lcp-btn--small" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="rv-transcript" data-lenis-prevent>
        {messages.map((m) => (
          <div key={m.id} className={`rv-msg rv-msg--${m.sender}`}>
            <div className="rv-msg-meta">
              {m.sender === "patient" ? "Patient" : m.sender === "ai" ? "AI" : m.sender === "agent" ? "Agent" : "System"} · {when(m.at)}
              {m.safetyBlocked && <span className="rv-badge">Fixed safe reply</span>}
            </div>
            <div>{m.text}</div>
          </div>
        ))}
      </div>

      {reviews.length > 0 && (
        <div className="rv-history">
          <b>Reviews so far</b>
          <ul>
            {reviews.map((r) => (
              <li key={r.id}>
                <span className={r.outcome === "issue" ? "rv-issue" : ""}>{r.outcome === "issue" ? "Issue" : "OK"}</span> · {r.reviewer.name || "Reviewer"} · {when(r.at)}
                {r.note ? <div className="rv-note">{r.note}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="rv-form" onSubmit={submit}>
        <b>Your review</b>
        <div className="rv-outcomes">
          <label>
            <input type="radio" name="outcome" value="ok" checked={outcome === "ok"} onChange={() => setOutcome("ok")} /> OK
          </label>
          <label>
            <input type="radio" name="outcome" value="issue" checked={outcome === "issue"} onChange={() => setOutcome("issue")} /> Issue
          </label>
        </div>
        <textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Note" aria-label="Review note" rows={3} />
        <span className="lcp-help">Don't include patient names or health details.</span>
        {error && (
          <div className="lcp-error" role="alert">
            {error}
          </div>
        )}
        {saved && (
          <div className="lcp-muted" role="status">
            {saved}
          </div>
        )}
        <button type="submit" className="lcp-btn lcp-btn--primary" disabled={saving}>
          {saving ? "Saving…" : "Save review"}
        </button>
        <span className="lcp-help">Saving adds a new entry to the review log. Entries cannot be edited or deleted.</span>
      </form>
    </div>
  );
}
