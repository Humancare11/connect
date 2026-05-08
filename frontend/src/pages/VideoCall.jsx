import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import "./videocall.css";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useDoctorAuth } from "../context/DoctorAuthContext";

const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

// ── helpers ────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const humanSize = (bytes) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function VideoCall() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  // ── Identity ───────────────────────────────────────────────────
  const { doctor } = useDoctorAuth();
  const { user } = useAuth();
  const isDoctor = !!doctor;
  const currentUser = useMemo(() => {
    if (doctor) return { id: doctor._id || doctor.id || "doctor", name: doctor.name || "Doctor" };
    return { id: user?._id || "user", name: user?.name || "Patient" };
  }, [doctor, user]);

  // ── Appointment state ──────────────────────────────────────────
  const [appt, setAppt]           = useState(null);
  const [apptLoading, setApptLoading] = useState(true);
  const [apptError, setApptError] = useState("");

  // ── WebRTC refs ────────────────────────────────────────────────
  const localVideoRef    = useRef(null);
  const remoteVideoRef   = useRef(null);
  const pcRef            = useRef(null);
  const localStreamRef   = useRef(null);
  const screenStreamRef  = useRef(null);
  const callTimerRef     = useRef(null);
  const inCallRef        = useRef(false);
  const isReadyRef       = useRef(false);
  const chatOpenRef      = useRef(false);

  // ── Call state ─────────────────────────────────────────────────
  const [isReady, setIsReady]                     = useState(false);
  const [inCall, setInCall]                       = useState(false);
  const [isMuted, setIsMuted]                     = useState(false);
  const [isCamOff, setIsCamOff]                   = useState(false);
  const [isScreenSharing, setIsScreenSharing]     = useState(false);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [callDuration, setCallDuration]           = useState(0);
  const [camError, setCamError]                   = useState(false);
  const [connectionState, setConnectionState]     = useState("idle");
  const [peerJoined, setPeerJoined]               = useState(false);
  const [completing, setCompleting]               = useState(false);

  // ── Chat state ─────────────────────────────────────────────────
  const [chatOpen, setChatOpen]       = useState(false);
  const [messages, setMessages]       = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef   = useRef(null);

  // Keep stable refs in sync
  useEffect(() => { inCallRef.current   = inCall;   }, [inCall]);
  useEffect(() => { isReadyRef.current  = isReady;  }, [isReady]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 1. Fetch appointment (gate + info panel) ───────────────────
  useEffect(() => {
    if (!appointmentId) {
      setApptError("You must be logged in to join a call.");
      setApptLoading(false);
      return;
    }
    api.get(`/api/appointments/${appointmentId}`)
      .then((res) => setAppt(res.data))
      .catch((err) => {
        const msg = err.response?.data?.msg || "Could not load appointment.";
        setApptError(msg);
      })
      .finally(() => setApptLoading(false));
  }, [appointmentId]);

  // ── 2. WebRTC + Socket (only when appointment is confirmed) ────
  useEffect(() => {
    if (!appt || appt.status !== "confirmed") return;

    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        setIsReady(true);
        isReadyRef.current = true;
      } catch (err) {
        console.error("Camera/mic error:", err);
        setCamError(true);
      }
    };
    setup();

    const remoteStream = new MediaStream();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      setIsRemoteConnected(true);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { appointmentId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected")                            setConnectionState("connected");
      else if (s === "disconnected" || s === "failed")  setConnectionState("disconnected");
      else if (s === "connecting")                      setConnectionState("connecting");
    };

    const handleOffer = async ({ offer }) => {
      if (!offer) return;
      setConnectionState("connecting");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("video-answer", { appointmentId, answer });
      setInCall(true); inCallRef.current = true;
    };
    const handleAnswer = async ({ answer }) => {
      if (!answer) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setInCall(true); inCallRef.current = true;
    };
    const handleIce = async ({ candidate }) => {
      if (!candidate) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { console.error("ICE error:", err); }
    };
    const handleParticipantLeft = () => {
      setIsRemoteConnected(false);
      setConnectionState("disconnected");
      setPeerJoined(false);
    };
    const handlePeerJoined = () => setPeerJoined(true);
    const handleChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!chatOpenRef.current) setUnreadCount((c) => c + 1);
    };

    socket.on("video-offer",        handleOffer);
    socket.on("video-answer",       handleAnswer);
    socket.on("ice-candidate",      handleIce);
    socket.on("participant-left",   handleParticipantLeft);
    socket.on("peer-joined",        handlePeerJoined);
    socket.on("appointment-message", handleChatMessage);

    if (!socket.connected) socket.connect();
    socket.emit("join-appointment-room", { appointmentId });

    return () => {
      socket.emit("leave-appointment-room", { appointmentId });
      socket.off("video-offer",        handleOffer);
      socket.off("video-answer",       handleAnswer);
      socket.off("ice-candidate",      handleIce);
      socket.off("participant-left",   handleParticipantLeft);
      socket.off("peer-joined",        handlePeerJoined);
      socket.off("appointment-message", handleChatMessage);
      pc.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(callTimerRef.current);
    };
  }, [appt, appointmentId]);

  // ── Auto-start: patient sends offer when both sides ready ──────
  useEffect(() => {
    if (!peerJoined || !isReady || inCall || isDoctor) return;
    (async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        setConnectionState("connecting");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("video-offer", { appointmentId, offer });
        setInCall(true); inCallRef.current = true;
      } catch (err) { console.error("Auto-start error:", err); }
    })();
  }, [peerJoined, isReady, inCall, isDoctor, appointmentId]);

  // ── Call timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (inCall) {
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [inCall]);

  const fmtDuration = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Controls ───────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !isReadyRef.current || inCallRef.current) return;
    setConnectionState("connecting");
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("video-offer", { appointmentId, offer });
      setInCall(true); inCallRef.current = true;
    } catch (err) { console.error("Start call error:", err); }
  }, [appointmentId]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((p) => !p);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsCamOff((p) => !p);
  }, []);

  const endCall = useCallback(() => {
    socket.emit("leave-appointment-room", { appointmentId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    navigate(-1);
  }, [appointmentId, navigate]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Revert to camera
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(camTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);
        if (localVideoRef.current) {
          const mixed = new MediaStream([screenTrack, ...(localStreamRef.current?.getAudioTracks() || [])]);
          localVideoRef.current.srcObject = mixed;
        }
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        if (err.name !== "NotAllowedError") console.error("Screen share error:", err);
      }
    }
  }, [isScreenSharing]);

  const completeConsultation = useCallback(async () => {
    if (!isDoctor || completing) return;
    setCompleting(true);
    try {
      await api.put(`/api/appointments/${appointmentId}/complete`, {});
      socket.emit("leave-appointment-room", { appointmentId });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      navigate("/doctor-dashboard/patients");
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to complete consultation.");
      setCompleting(false);
    }
  }, [isDoctor, completing, appointmentId, navigate]);

  // ── Chat ───────────────────────────────────────────────────────
  const toggleChat = useCallback(() => {
    setChatOpen((prev) => { if (!prev) setUnreadCount(0); return !prev; });
  }, []);

  const sendTextMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    socket.emit("appointment-message", {
      appointmentId,
      senderId:   currentUser.id,
      senderName: currentUser.name,
      text,
    });
    setChatInput("");
  }, [chatInput, appointmentId, currentUser]);

  const handleChatKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
  };

  // File upload → send as chat message
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be picked again

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Maximum size is 10 MB.");
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Send file URL as a chat message through socket
      socket.emit("appointment-message", {
        appointmentId,
        senderId:   currentUser.id,
        senderName: currentUser.name,
        text: "",
        fileUrl:  res.data.url,
        fileName: res.data.name,
        fileType: res.data.type,
      });
    } catch (err) {
      alert(err.response?.data?.msg || "File upload failed.");
    } finally {
      setUploadingFile(false);
    }
  }, [appointmentId, currentUser, authToken]);

  // ── Derived appointment display values ─────────────────────────
  const otherParty = useMemo(() => {
    if (!appt) return null;
    if (isDoctor) {
      return {
        label:   "Patient",
        name:    appt.patientId?.name || "Unknown Patient",
        sub:     appt.problem ? `📝 ${appt.problem}` : "No problem noted",
        avatar:  appt.patientId?.name?.[0]?.toUpperCase() || "P",
        color:   "#3b82f6",
      };
    }
    return {
      label:   "Doctor",
      name:    `Dr. ${appt.doctorId?.name || "Unknown"}`,
      sub:     appt.doctorId?.email || "",
      avatar:  appt.doctorId?.name?.[0]?.toUpperCase() || "D",
      color:   "#19c9a3",
    };
  }, [appt, isDoctor]);

  // ── Loading / error / gate screens ────────────────────────────
  if (apptLoading) {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-spinner" />
        <p>Loading appointment…</p>
      </div>
    );
  }

  if (apptError) {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">⚠️</div>
        <h2>Access Denied</h2>
        <p>{apptError}</p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (appt && appt.status === "pending") {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">⏳</div>
        <h2>Appointment Pending</h2>
        <p>
          {isDoctor
            ? "Confirm this appointment from your dashboard before starting the video call."
            : "Your appointment is awaiting the doctor's confirmation. You'll be able to join once it's confirmed."}
        </p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (appt && (appt.status === "completed" || appt.status === "cancelled")) {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">{appt.status === "completed" ? "✅" : "❌"}</div>
        <h2>Appointment {appt.status === "completed" ? "Completed" : "Cancelled"}</h2>
        <p>This appointment is no longer active.</p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  // ── Main call UI (only for confirmed appointments) ─────────────
  return (
    <div className="hc-vc__page">

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="hc-vc__topbar">
        <div className="hc-vc__topbar-left">
          <div className="hc-vc__logo-dot" />
          <span className="hc-vc__logo-text">HumaniCare</span>
          <span className="hc-vc__topbar-divider">|</span>
          <span className="hc-vc__room-label">Video Consultation</span>
        </div>
        <div className="hc-vc__topbar-center">
          {inCall && (
            <div className="hc-vc__timer">
              <span className="hc-vc__timer-dot" />
              {fmtDuration(callDuration)}
            </div>
          )}
        </div>
        <div className="hc-vc__topbar-right">
          <div className={`hc-vc__status-pill hc-vc__status-pill--${connectionState}`}>
            <span className="hc-vc__status-dot" />
            {connectionState === "idle"         && "Waiting"}
            {connectionState === "connecting"   && "Connecting…"}
            {connectionState === "connected"    && "Connected"}
            {connectionState === "disconnected" && "Disconnected"}
          </div>
        </div>
      </div>

      {/* ── Appointment Info Bar ────────────────────────────────── */}
      {otherParty && (
        <div className="hc-vc__infobar">
          <div className="hc-vc__infobar-avatar" style={{ background: `${otherParty.color}22`, color: otherParty.color }}>
            {otherParty.avatar}
          </div>
          <div className="hc-vc__infobar-details">
            <span className="hc-vc__infobar-label">{otherParty.label}</span>
            <span className="hc-vc__infobar-name">{otherParty.name}</span>
            {otherParty.sub && <span className="hc-vc__infobar-sub">{otherParty.sub}</span>}
          </div>
          <div className="hc-vc__infobar-meta">
            <span>📅 {formatDate(appt.date)}</span>
            <span>🕐 {appt.time}</span>
            <span className="hc-vc__infobar-role-badge hc-vc__infobar-role-badge--confirmed">
              ✅ Confirmed
            </span>
          </div>
        </div>
      )}

      {/* ── Body = Stage + Chat ──────────────────────────────────── */}
      <div className={`hc-vc__body ${chatOpen ? "hc-vc__body--chat-open" : ""}`}>

        {/* Stage */}
        <div className="hc-vc__stage-area">
          <div className={`hc-vc__remote-wrap ${!isRemoteConnected ? "hc-vc__remote-wrap--empty" : ""}`}>
            <video ref={remoteVideoRef} autoPlay playsInline className="hc-vc__video hc-vc__video--remote" />
            {!isRemoteConnected && (
              <div className="hc-vc__waiting-overlay">
                <div className="hc-vc__waiting-avatar">{isDoctor ? "🧑‍💼" : "👨‍⚕️"}</div>
                <p className="hc-vc__waiting-title">
                  {peerJoined ? "Establishing connection…" : `Waiting for ${isDoctor ? "patient" : "doctor"}…`}
                </p>
                <p className="hc-vc__waiting-sub">
                  {peerJoined
                    ? "The other participant has joined. Setting up video…"
                    : "The other person will appear here once they join"}
                </p>
              </div>
            )}
          </div>

          {/* PiP */}
          <div className={`hc-vc__pip ${isCamOff ? "hc-vc__pip--cam-off" : ""}`}>
            <video ref={localVideoRef} autoPlay muted playsInline className="hc-vc__video hc-vc__video--local" />
            {isCamOff && (
              <div className="hc-vc__cam-off-overlay">
                <span>📷</span><p>Camera Off</p>
              </div>
            )}
            <div className="hc-vc__pip-label">You{isDoctor ? " (Doctor)" : " (Patient)"}</div>
          </div>

          {peerJoined && !isRemoteConnected && (
            <div className="hc-vc__join-toast">
              <span className="hc-vc__join-toast-dot" />
              {isDoctor ? "Patient" : "Doctor"} has joined · connecting…
            </div>
          )}
        </div>

        {/* ── Chat Panel ───────────────────────────────────────── */}
        {chatOpen && (
          <div className="hc-vc__chat-panel">
            <div className="hc-vc__chat-header">
              <div className="hc-vc__chat-header-left">
                <span className="hc-vc__chat-header-icon">💬</span>
                <span className="hc-vc__chat-header-title">In-Call Chat</span>
              </div>
              <button className="hc-vc__chat-close" onClick={toggleChat}>✕</button>
            </div>

            <div className="hc-vc__chat-msgs">
              {messages.length === 0 && (
                <div className="hc-vc__chat-empty">
                  <span>💬</span>
                  <p>No messages yet.</p>
                  <p>You can share text and files here.</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div key={i} className={`hc-vc__msg ${isMine ? "hc-vc__msg--mine" : "hc-vc__msg--theirs"}`}>
                    {!isMine && <div className="hc-vc__msg-name">{msg.senderName}</div>}

                    {/* File message */}
                    {msg.fileUrl ? (
                      <div className="hc-vc__msg-bubble hc-vc__msg-file">
                        {msg.fileType?.startsWith("image/") ? (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="hc-vc__msg-img-wrap">
                            <img src={msg.fileUrl} alt={msg.fileName} className="hc-vc__msg-img" />
                            <span className="hc-vc__msg-img-caption">{msg.fileName}</span>
                          </a>
                        ) : (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" download={msg.fileName}
                            className="hc-vc__msg-file-link">
                            <span className="hc-vc__msg-file-icon">
                              {msg.fileType?.includes("pdf") ? "📄" :
                               msg.fileType?.includes("word") || msg.fileType?.includes("doc") ? "📝" :
                               msg.fileType?.includes("sheet") || msg.fileType?.includes("excel") ? "📊" : "📎"}
                            </span>
                            <span className="hc-vc__msg-file-name">{msg.fileName}</span>
                            <span className="hc-vc__msg-file-dl">⬇ Download</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="hc-vc__msg-bubble">{msg.text}</div>
                    )}

                    <div className="hc-vc__msg-time">{formatTime(msg.createdAt)}</div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="hc-vc__chat-footer">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              {/* Attachment button */}
              <button
                className="hc-vc__chat-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title="Share a file"
              >
                {uploadingFile ? <span className="hc-vc__attach-spinner" /> : "📎"}
              </button>
              <input
                className="hc-vc__chat-input"
                type="text"
                placeholder="Type a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                maxLength={500}
                autoComplete="off"
              />
              <button
                className="hc-vc__chat-send"
                onClick={sendTextMessage}
                disabled={!chatInput.trim()}
                title="Send"
              >
                ➤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="hc-vc__controls">
        <div className="hc-vc__controls-inner">

          <button className={`hc-vc__ctrl-btn ${isMuted ? "hc-vc__ctrl-btn--active" : ""}`}
            onClick={toggleMute} disabled={!isReady}>
            <span className="hc-vc__ctrl-icon">{isMuted ? "🔇" : "🎙️"}</span>
            <span className="hc-vc__ctrl-label">{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          <button className={`hc-vc__ctrl-btn ${isCamOff ? "hc-vc__ctrl-btn--active" : ""}`}
            onClick={toggleCamera} disabled={!isReady}>
            <span className="hc-vc__ctrl-icon">{isCamOff ? "📷" : "📹"}</span>
            <span className="hc-vc__ctrl-label">{isCamOff ? "Cam On" : "Cam Off"}</span>
          </button>

          <button
            className={`hc-vc__ctrl-btn ${isScreenSharing ? "hc-vc__ctrl-btn--screen-on" : ""}`}
            onClick={toggleScreenShare}
            disabled={!isReady}
            title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
          >
            <span className="hc-vc__ctrl-icon">🖥️</span>
            <span className="hc-vc__ctrl-label">{isScreenSharing ? "Stop Share" : "Share"}</span>
          </button>

          <button
            className={`hc-vc__ctrl-btn hc-vc__ctrl-btn--chat ${chatOpen ? "hc-vc__ctrl-btn--chat-open" : ""}`}
            onClick={toggleChat}>
            <span className="hc-vc__ctrl-icon">💬</span>
            <span className="hc-vc__ctrl-label">
              Chat{unreadCount > 0 && !chatOpen ? ` (${unreadCount})` : ""}
            </span>
            {unreadCount > 0 && !chatOpen && (
              <span className="hc-vc__unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

          {/* Patient sees Start Call button; doctor auto-answers */}
          {!inCall ? (
            <button className="hc-vc__ctrl-btn hc-vc__ctrl-btn--start"
              onClick={startCall} disabled={!isReady || camError}>
              <span className="hc-vc__ctrl-icon">📞</span>
              <span className="hc-vc__ctrl-label">
                {camError ? "No Camera" : isReady ? "Start Call" : "Loading…"}
              </span>
            </button>
          ) : (
            <div className="hc-vc__incall-badge">
              <span className="hc-vc__incall-dot" />
              In Call
            </div>
          )}

          <button className="hc-vc__ctrl-btn hc-vc__ctrl-btn--end" onClick={endCall}>
            <span className="hc-vc__ctrl-icon">📵</span>
            <span className="hc-vc__ctrl-label">End</span>
          </button>

          {isDoctor && (
            <button
              className="hc-vc__ctrl-btn hc-vc__ctrl-btn--complete"
              onClick={completeConsultation}
              disabled={completing}
              title="Mark consultation as complete and go to My Patients"
            >
              <span className="hc-vc__ctrl-icon">{completing ? "⏳" : "✅"}</span>
              <span className="hc-vc__ctrl-label">{completing ? "Saving…" : "Complete"}</span>
            </button>
          )}

          <button className="hc-vc__ctrl-btn hc-vc__ctrl-btn--back" onClick={() => navigate(-1)}>
            <span className="hc-vc__ctrl-icon">←</span>
            <span className="hc-vc__ctrl-label">Back</span>
          </button>
        </div>
      </div>

      {camError && (
        <div className="hc-vc__error-banner">
          ⚠️ Could not access camera or microphone. Please check your browser permissions and reload.
        </div>
      )}
    </div>
  );
}
