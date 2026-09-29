import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

function buildPinMessage(joinLink, roleLabel, pin) {
  return `Join your video consultation as the ${roleLabel}:\n${joinLink}\n\nYour PIN: ${pin}\n(Enter this PIN when the page asks for it. Please don't share it with anyone else.)`;
}

// One role's PIN row — used both in the just-created result panel and in
// the history table's expandable "Manage PINs" panel. Kept as a small
// standalone component since regenerate has its own local confirm state
// (an "end current session too?" checkbox) that shouldn't leak between the
// two roles or between rooms.
function PinRow({ roleLabel, pin, joinLink, onCopyNotice, onRegenerate, regenerating }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopyNotice(`${label} copied.`);
    } catch {
      onCopyNotice("Could not copy — please copy manually.");
    }
  };

  return (
    <div className="dvc-pin-row">
      <div className="dvc-pin-row__head">
        <span className="dvc-pin-row__label">{roleLabel}</span>
        <span className="dvc-pin-row__value">{pin || "------"}</span>
      </div>
      <div className="dvc-pin-row__actions">
        <button
          type="button"
          className="dvc-link-btn"
          disabled={!pin}
          onClick={() => copy(pin, `${roleLabel} PIN`)}
        >
          Copy PIN
        </button>
        <button
          type="button"
          className="dvc-link-btn"
          disabled={!pin}
          onClick={() => copy(buildPinMessage(joinLink, roleLabel, pin), `${roleLabel} WhatsApp message`)}
        >
          Copy WhatsApp message
        </button>
        <button
          type="button"
          className="dvc-link-btn"
          onClick={() => setShowRegenerate((v) => !v)}
        >
          Regenerate…
        </button>
      </div>
      {showRegenerate && (
        <div className="dvc-pin-regen">
          <label className="dvc-pin-regen__checkbox">
            <input type="checkbox" checked={confirmEnd} onChange={(e) => setConfirmEnd(e.target.checked)} />
            Also end the current live session for this role (disconnects them now)
          </label>
          <div className="dvc-pin-regen__actions">
            <button
              type="button"
              className="dvc-secondary"
              disabled={regenerating}
              onClick={() => {
                if (confirmEnd && !window.confirm(`End ${roleLabel}'s current session and require the new PIN? This disconnects them immediately if they're on the call.`))
                  return;
                onRegenerate(confirmEnd);
                setShowRegenerate(false);
                setConfirmEnd(false);
              }}
            >
              {regenerating ? "Regenerating…" : "Regenerate PIN"}
            </button>
            <button type="button" className="dvc-link-btn" onClick={() => setShowRegenerate(false)}>
              Cancel
            </button>
          </div>
          <p className="dvc-pin-regen__hint">
            {confirmEnd
              ? "The old PIN stops working immediately and this role's current session is ended right away."
              : "The old PIN stops working for NEW joins, but anyone already on the call stays connected — a refresh won't kick them."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminDirectVideoConsultation() {
  const [note, setNote] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [doctorId, setDoctorId] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [createdPins, setCreatedPins] = useState(null);
  const [createdCopyNotice, setCreatedCopyNotice] = useState("");

  const [rooms, setRooms] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [closingRoomId, setClosingRoomId] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");

  const [expandedPinRoomId, setExpandedPinRoomId] = useState("");
  const [pinDataByRoom, setPinDataByRoom] = useState({});
  const [pinLoadingRoomId, setPinLoadingRoomId] = useState("");
  const [pinErrorByRoom, setPinErrorByRoom] = useState({});
  const [regeneratingKey, setRegeneratingKey] = useState("");

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
    api
      .get("/api/admin/doctors")
      .then((res) => setDoctors((res.data || []).filter((d) => d.approvalStatus === "approved")))
      .catch(() => setDoctors([]));
  }, []);

  const generateLink = async (event) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    setCreatedPins(null);
    setGenerating(true);
    try {
      const res = await api.post("/api/direct-video-room", { note, expiresInHours, doctorId: doctorId || undefined });
      setCreated(res.data?.room || null);
      if (res.data?.doctorPin && res.data?.patientPin) {
        setCreatedPins({ doctorPin: res.data.doctorPin, patientPin: res.data.patientPin });
      }
      setNote("");
      setDoctorId("");
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate the video consultation link.");
    } finally {
      setGenerating(false);
    }
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

  const togglePinPanel = async (roomId) => {
    if (expandedPinRoomId === roomId) {
      setExpandedPinRoomId("");
      return;
    }
    setExpandedPinRoomId(roomId);
    if (pinDataByRoom[roomId]) return;
    setPinLoadingRoomId(roomId);
    setPinErrorByRoom((prev) => ({ ...prev, [roomId]: "" }));
    try {
      const res = await api.get(`/api/direct-video-room/${roomId}/pins`);
      setPinDataByRoom((prev) => ({ ...prev, [roomId]: res.data }));
    } catch (err) {
      setPinErrorByRoom((prev) => ({
        ...prev,
        [roomId]: err.response?.data?.msg || "Could not load PINs.",
      }));
    } finally {
      setPinLoadingRoomId("");
    }
  };

  const regeneratePin = async (roomId, role, endCurrentSession) => {
    const key = `${roomId}:${role}`;
    setRegeneratingKey(key);
    try {
      const res = await api.post(`/api/direct-video-room/${roomId}/regenerate-pin`, { role, endCurrentSession });
      setPinDataByRoom((prev) => ({
        ...prev,
        [roomId]: { ...prev[roomId], [`${role}Pin`]: res.data.pin },
      }));
      setHistoryNotice(`${role === "doctor" ? "Doctor" : "Patient"} PIN regenerated.`);
    } catch (err) {
      setHistoryNotice(err.response?.data?.msg || "Failed to regenerate PIN.");
    } finally {
      setRegeneratingKey("");
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
            Generate a secure meeting link and share it along with two PINs — one for the Doctor,
            one for the Patient. Each PIN decides which role that person joins as. No registration
            or login needed on either side.
          </p>
        </div>
        <div className="dvc-header-metric">
          <span>Rooms generated</span>
          <strong>{rooms.length}</strong>
        </div>
      </div>

      <Link to="/admin-dashboard/direct-video-consultation/calls" className="dvc-secondary" style={{ display: "inline-block", marginBottom: 16 }}>
        View Calls &amp; Reports →
      </Link>

      <form className="dvc-card dvc-form" onSubmit={generateLink}>
        <div className="dvc-form__title">
          <h2>Generate a Secure Link</h2>
          <p>
            Share the link with both participants, along with their own PIN — the Doctor's PIN and
            the Patient's PIN are different, and each one decides which role that device joins as.
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
          <label className="dvc-field">
            <span className="dvc-field__label">Doctor (optional)</span>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">— None —</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
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
        <div className="dvc-card dvc-result dvc-result--pins">
          <div className="dvc-result__link">
            <span className="dvc-result__label">Generated video consultation link</span>
            <a href={created.joinLink} target="_blank" rel="noreferrer">
              {created.joinLink}
            </a>
            <p className="dvc-result__note">
              Expires {formatDate(created.expiresAt)}. Limited to 2 participants.
            </p>
          </div>
          {createdPins && (
            <div className="dvc-pin-panel">
              {createdCopyNotice && <span className="dvc-notice">{createdCopyNotice}</span>}
              <PinRow
                roleLabel="Doctor"
                pin={createdPins.doctorPin}
                joinLink={created.joinLink}
                onCopyNotice={(msg) => {
                  setCreatedCopyNotice(msg);
                  setTimeout(() => setCreatedCopyNotice(""), 1800);
                }}
                onRegenerate={(endCurrentSession) => regeneratePin(created.roomId, "doctor", endCurrentSession)}
                regenerating={regeneratingKey === `${created.roomId}:doctor`}
              />
              <PinRow
                roleLabel="Patient"
                pin={createdPins.patientPin}
                joinLink={created.joinLink}
                onCopyNotice={(msg) => {
                  setCreatedCopyNotice(msg);
                  setTimeout(() => setCreatedCopyNotice(""), 1800);
                }}
                onRegenerate={(endCurrentSession) => regeneratePin(created.roomId, "patient", endCurrentSession)}
                regenerating={regeneratingKey === `${created.roomId}:patient`}
              />
            </div>
          )}
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
                  <th>Doctor</th>
                  <th>Expires</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th>Link</th>
                  <th>PINs</th>
                  <th>Report</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <Fragment key={room.roomId}>
                    <tr>
                      <td>{formatDate(room.createdAt)}</td>
                      <td>{room.doctorName || "-"}</td>
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
                        {room.hasPin ? (
                          <button className="dvc-link-btn" type="button" onClick={() => togglePinPanel(room.roomId)}>
                            {expandedPinRoomId === room.roomId ? "Hide PINs" : "View PINs"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <Link className="dvc-link-btn" to={`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`}>
                          Report
                        </Link>
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
                    {expandedPinRoomId === room.roomId && (
                      <tr className="dvc-pin-panel-row">
                        <td colSpan={9}>
                          {pinLoadingRoomId === room.roomId ? (
                            <div className="dvc-empty">Loading PINs…</div>
                          ) : pinErrorByRoom[room.roomId] ? (
                            <div className="dvc-error">{pinErrorByRoom[room.roomId]}</div>
                          ) : pinDataByRoom[room.roomId] ? (
                            <div className="dvc-pin-panel">
                              <PinRow
                                roleLabel="Doctor"
                                pin={pinDataByRoom[room.roomId].doctorPin}
                                joinLink={room.joinLink}
                                onCopyNotice={(msg) => {
                                  setHistoryNotice(msg);
                                  setTimeout(() => setHistoryNotice(""), 1800);
                                }}
                                onRegenerate={(endCurrentSession) =>
                                  regeneratePin(room.roomId, "doctor", endCurrentSession)
                                }
                                regenerating={regeneratingKey === `${room.roomId}:doctor`}
                              />
                              <PinRow
                                roleLabel="Patient"
                                pin={pinDataByRoom[room.roomId].patientPin}
                                joinLink={room.joinLink}
                                onCopyNotice={(msg) => {
                                  setHistoryNotice(msg);
                                  setTimeout(() => setHistoryNotice(""), 1800);
                                }}
                                onRegenerate={(endCurrentSession) =>
                                  regeneratePin(room.roomId, "patient", endCurrentSession)
                                }
                                regenerating={regeneratingKey === `${room.roomId}:patient`}
                              />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
