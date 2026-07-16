import { useEffect, useState } from "react";
import api from "../../api";
import "./AdminDirectVideoConsultation.css";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  if (status === "active") return "Active";
  if (status === "closed") return "Closed";
  if (status === "expired") return "Expired";
  return status || "-";
}

export default function AdminDirectVideoConsultation() {
  const [note, setNote] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [closingRoomId, setClosingRoomId] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");

  const fetchHistory = () => {
    setHistoryLoading(true);
    api
      .get("/api/direct-video-room")
      .then((res) => setRooms(res.data?.rooms || []))
      .catch(() => setRooms([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const generateLink = async (event) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);
    setGenerating(true);
    try {
      const res = await api.post("/api/direct-video-room", { note, expiresInHours });
      setCreated(res.data?.room || null);
      setNote("");
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate the video consultation link.");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async (link) => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const copyHistoryLink = async (link) => {
    await navigator.clipboard.writeText(link);
    setHistoryNotice("Link copied.");
    setTimeout(() => setHistoryNotice(""), 1800);
  };

  const closeRoom = async (roomId) => {
    if (!window.confirm("End this video consultation room? Anyone currently on the call will be disconnected."))
      return;
    setClosingRoomId(roomId);
    setHistoryNotice("");
    try {
      await api.post(`/api/direct-video-room/${roomId}/close`);
      setHistoryNotice("Room closed.");
      fetchHistory();
    } catch (err) {
      setHistoryNotice(err.response?.data?.msg || "Failed to close the room.");
    } finally {
      setClosingRoomId("");
      setTimeout(() => setHistoryNotice(""), 2500);
    }
  };

  return (
    <div className="dvc-page">
      <div className="dvc-header">
        <div>
          <p className="dvc-eyebrow">Admin Dashboard</p>
          <h1>Direct Video Consultation</h1>
          <p>
            Generate a secure, unique meeting link — like Google Meet. No registration, login, or
            doctor/patient selection needed: anyone with the link joins directly as a guest.
          </p>
        </div>
        <div className="dvc-header-metric">
          <span>Rooms generated</span>
          <strong>{rooms.length}</strong>
        </div>
      </div>

      <form className="dvc-card dvc-form" onSubmit={generateLink}>
        <div className="dvc-form__title">
          <h2>Generate a Secure Link</h2>
          <p>
            Share the resulting link with both participants — whoever opens it first waits for the
            other. The link itself is the only thing needed to join, so only share it with the
            intended participants.
          </p>
        </div>

        <div className="dvc-form-grid">
          <label className="dvc-field">
            <span className="dvc-field__label">Link expires in</span>
            <select value={expiresInHours} onChange={(e) => setExpiresInHours(Number(e.target.value))}>
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>72 hours</option>
            </select>
          </label>
        </div>

        <label className="dvc-field">
          <span className="dvc-field__label">Note (optional, internal only)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note to help identify this room later"
          />
        </label>

        {error && <div className="dvc-error">{error}</div>}

        <button className="dvc-primary" type="submit" disabled={generating}>
          {generating ? "Generating…" : "Generate Secure Link"}
        </button>
      </form>

      {created && (
        <div className="dvc-card dvc-result">
          <div>
            <span className="dvc-result__label">Generated video consultation link</span>
            <a href={created.joinLink} target="_blank" rel="noreferrer">
              {created.joinLink}
            </a>
            <p className="dvc-result__note">
              Expires {formatDate(created.expiresAt)}. Limited to 2 participants.
            </p>
          </div>
          <button className="dvc-secondary" type="button" onClick={() => copyLink(created.joinLink)}>
            {copied ? "Copied" : "Copy Link"}
          </button>
        </div>
      )}

      <div className="dvc-card dvc-history">
        <div className="dvc-history__head">
          <div>
            <span className="dvc-result__label">History</span>
            <h2>Generated Rooms</h2>
          </div>
          <div className="dvc-history__actions">
            {historyNotice && <span className="dvc-notice">{historyNotice}</span>}
            <button className="dvc-secondary" type="button" onClick={fetchHistory}>
              Refresh
            </button>
          </div>
        </div>

        {historyLoading ? (
          <div className="dvc-empty">Loading history…</div>
        ) : rooms.length === 0 ? (
          <div className="dvc-empty">No video consultation rooms generated yet.</div>
        ) : (
          <div className="dvc-table-wrap">
            <table className="dvc-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th>Link</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.roomId}>
                    <td>{formatDate(room.createdAt)}</td>
                    <td>{formatDate(room.expiresAt)}</td>
                    <td>{room.note || "-"}</td>
                    <td>
                      <span className={`dvc-status dvc-status--${room.status}`}>{statusLabel(room.status)}</span>
                    </td>
                    <td>
                      <button className="dvc-link-btn" type="button" onClick={() => copyHistoryLink(room.joinLink)}>
                        Copy
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="dvc-link-btn"
                        disabled={room.status !== "active" || closingRoomId === room.roomId}
                        onClick={() => closeRoom(room.roomId)}
                      >
                        {room.status === "active" ? "End" : "-"}
                      </button>
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
