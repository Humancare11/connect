import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import "./videocall.css";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useDoctorAuth } from "../context/DoctorAuthContext";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMaximize,
  FiMaximize2,
  FiMessageSquare,
  FiMic,
  FiMicOff,
  FiMinimize,
  FiMinimize2,
  FiMonitor,
  FiPaperclip,
  FiPhoneOff,
  FiRefreshCw,
  FiSend,
  FiUser,
  FiVideo,
  FiVideoOff,
  FiX,
} from "react-icons/fi";
import { FaCapsules } from "react-icons/fa";

// ── In-call prescription modal (doctor only) ──────────────────────────────────
const EMPTY_MED = { name: "", dosage: "", frequency: "", duration: "" };

function InCallPrescriptionModal({ appt, onClose, onSaved }) {
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState([{ ...EMPTY_MED }]);
  const [instructions, setInstructions] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setMed = (i, k, v) =>
    setMedicines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [k]: v };
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    if (!diagnosis.trim()) { setError("Diagnosis is required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/medical/prescriptions", {
        appointmentId: appt._id,
        patientId: appt.patientId?._id || appt.patientId,
        diagnosis,
        medicines: medicines.filter((m) => m.name.trim()),
        instructions,
        followUpDate,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to save prescription.");
      setSaving(false);
    }
  };

  return (
    <div className="hc-vc__rx-overlay" onClick={onClose}>
      <div className="hc-vc__rx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hc-vc__rx-modal-head">
          <span className="hc-vc__rx-modal-icon">💊</span>
          <h3>Issue Prescription</h3>
          <button className="hc-vc__rx-modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="hc-vc__rx-modal-body" onSubmit={submit}>
          {error && <div className="hc-vc__rx-error">{error}</div>}

          <label className="hc-vc__rx-label">Diagnosis *</label>
          <input
            className="hc-vc__rx-input"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute viral pharyngitis"
            autoFocus
          />

          <label className="hc-vc__rx-label">Medicines</label>
          {medicines.map((med, i) => (
            <div key={i} className="hc-vc__rx-med-row">
              <input className="hc-vc__rx-input hc-vc__rx-med-name" value={med.name} onChange={(e) => setMed(i, "name", e.target.value)} placeholder="Medicine" />
              <input className="hc-vc__rx-input hc-vc__rx-med-sm" value={med.dosage} onChange={(e) => setMed(i, "dosage", e.target.value)} placeholder="Dosage" />
              <input className="hc-vc__rx-input hc-vc__rx-med-sm" value={med.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} placeholder="Frequency" />
              <input className="hc-vc__rx-input hc-vc__rx-med-sm" value={med.duration} onChange={(e) => setMed(i, "duration", e.target.value)} placeholder="Duration" />
              {medicines.length > 1 && (
                <button type="button" className="hc-vc__rx-med-remove" onClick={() => setMedicines((p) => p.filter((_, idx) => idx !== i))}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="hc-vc__rx-add-med" onClick={() => setMedicines((p) => [...p, { ...EMPTY_MED }])}>
            + Add Medicine
          </button>

          <label className="hc-vc__rx-label">Instructions</label>
          <textarea className="hc-vc__rx-input hc-vc__rx-textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Diet, rest, special instructions…" rows={2} />

          <label className="hc-vc__rx-label">Follow-up Date</label>
          <input className="hc-vc__rx-input" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />

          <div className="hc-vc__rx-modal-foot">
            <button type="button" className="hc-vc__rx-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="hc-vc__rx-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Issue Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 16 },
  },
  video: {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: "user",
  },
};

const BITRATE_PROFILE = {
  cameraVideo: 2_500_000,
  screenShareVideo: 4_000_000,
  voiceAudio: 128_000,
};

const setTrackHint = (track, hint) => {
  if (!track || !("contentHint" in track)) return;
  try {
    track.contentHint = hint;
  } catch (_) { }
};

const tuneSenderQuality = async (
  sender,
  { maxBitrate, maxFramerate, maintainResolution = false } = {}
) => {
  if (!sender?.track || !sender.getParameters || !sender.setParameters) return;
  try {
    const params = sender.getParameters();
    if (!params) return;
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }

    const encoding = params.encodings[0];
    if (typeof maxBitrate === "number") encoding.maxBitrate = maxBitrate;
    if (typeof maxFramerate === "number") encoding.maxFramerate = maxFramerate;
    if (maintainResolution) {
      params.degradationPreference = "maintain-resolution";
      if (typeof encoding.scaleResolutionDownBy !== "number") {
        encoding.scaleResolutionDownBy = 1;
      }
    }

    await sender.setParameters(params);
  } catch (_) { }
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const fmtTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const fmtDuration = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

export default function VideoCall() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const { doctor, loading: doctorLoading } = useDoctorAuth();
  const { user, loading: userLoading } = useAuth();
  const doctorId = doctor?._id || doctor?.id || "";
  const userId = user?._id || "";

  // ── Appointment ──────────────────────────────────────────────────
  const [appt, setAppt] = useState(null);
  const [apptLoading, setApptLoading] = useState(true);
  const [apptError, setApptError] = useState("");
  const [activeRole, setActiveRole] = useState("");

  const apptDoctorId = appt?.doctorId?._id || appt?.doctorId || "";
  const apptPatientId = appt?.patientId?._id || appt?.patientId || "";

  const isDoctor = useMemo(() => {
    if (activeRole) return activeRole === "doctor";
    if (doctorId && apptDoctorId && String(doctorId) === String(apptDoctorId)) return true;
    if (userId && apptPatientId && String(userId) === String(apptPatientId)) return false;
    return !!doctor && !user;
  }, [activeRole, doctorId, apptDoctorId, userId, apptPatientId, doctor, user]);

  const currentUser = useMemo(() => {
    if (isDoctor) {
      return {
        id: doctorId || "doctor",
        name: doctor?.name || "Doctor",
      };
    }
    return {
      id: userId || "user",
      name: user?.name || "Patient",
    };
  }, [isDoctor, doctorId, doctor, userId, user]);

  // ── Video elements: mainVideoRef = full stage, pipVideoRef = thumbnail ─
  const mainVideoRef = useRef(null);
  const pipVideoRef = useRef(null);
  const pageRef = useRef(null);

  // ── Stream refs ───────────────────────────────────────────────────
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcRef = useRef(null);

  // ── Stable state refs ─────────────────────────────────────────────
  const inCallRef = useRef(false);
  const isReadyRef = useRef(false);
  const chatOpenRef = useRef(false);
  const completedRef = useRef(false);
  const isSwappedRef = useRef(false);
  const callTimerRef = useRef(null);

  // ── Call state ────────────────────────────────────────────────────
  const [isReady, setIsReady] = useState(false);
  const [peerJoined, setPeerJoined] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isSelfViewMinimized, setIsSelfViewMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [camError, setCamError] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [peerLeft, setPeerLeft] = useState(false);
  const [endCallConfirm, setEndCallConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const pendingLeaveRef = useRef(null);

  // ── Chat state ────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── PiP drag ──────────────────────────────────────────────────────
  const [pipPos, setPipPos] = useState({ x: null, y: null });
  const pipRef = useRef(null);
  const dragRef = useRef({ active: false, ox: 0, oy: 0, ex: 0, ey: 0 });

  // ── Completion + prescription notifications ───────────────────────
  const [showCompletedOverlay, setShowCompletedOverlay] = useState(false);
  const [prescriptionNotif, setPrescriptionNotif] = useState(null);
  const [showRxModal, setShowRxModal] = useState(false);
  const [rxSavedToast, setRxSavedToast] = useState(false);

  // ── Sync refs ─────────────────────────────────────────────────────
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);
  useEffect(() => { isReadyRef.current = isReady; }, [isReady]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { isSwappedRef.current = isSwapped; }, [isSwapped]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Auto-scroll chat — runs on new messages AND when panel opens
  useEffect(() => {
    if (!chatOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // ── Fetch appointment ─────────────────────────────────────────────
  // Wait for auth contexts so we know the caller's role, then hit a
  // role-specific endpoint. The backend access check is participant-ID
  // based (not role-based), so it always works as long as the right
  // identity is decoded from the token.
  useEffect(() => {
    if (doctorLoading || userLoading) return;
    let cancelled = false;

    if (!appointmentId) {
      setApptError("No appointment ID found.");
      setApptLoading(false);
      return;
    }

    const errMsg = (err) =>
      err?.response?.data?.msg ||
      err?.response?.data?.message ||
      "Could not load appointment.";

    setApptLoading(true);
    setApptError("");
    setActiveRole("");

    (async () => {
      let lastError = null;

      // Prefer patient ownership when user session exists.
      if (user) {
        try {
          const res = await api.get(`/api/appointments/patient/${appointmentId}`);
          if (cancelled) return;
          setAppt(res.data);
          setActiveRole("user");
          setApptLoading(false);
          return;
        } catch (err) {
          lastError = err;
        }
      }

      // Fallback to doctor ownership.
      if (doctor) {
        try {
          const res = await api.get(`/api/appointments/doctor/${appointmentId}`);
          if (cancelled) return;
          setAppt(res.data);
          setActiveRole("doctor");
          setApptLoading(false);
          return;
        } catch (err) {
          lastError = err;
        }
      }

      if (cancelled) return;
      if (!user && !doctor) {
        setApptError("Please login to access this appointment.");
      } else {
        setApptError(errMsg(lastError));
      }
      setApptLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, doctor, user, doctorLoading, userLoading]);

  // ── Reliable cleanup: stop tracks + notify peers + optional API ───
  const performCleanup = useCallback((markComplete = false) => {
    if (completedRef.current) return;
    completedRef.current = true;

    clearInterval(callTimerRef.current);
    socket.emit("leave-appointment-room", { appointmentId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();

    if (markComplete && isDoctor) {
      const base = import.meta.env.VITE_API_URL || "";
      fetch(`${base}/api/appointments/${appointmentId}/complete`, {
        method: "PUT",
        keepalive: true,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }).catch(() => { });
    }
  }, [appointmentId, isDoctor]);

  // ── Block / intercept browser back button during confirmed call ───
  useEffect(() => {
    if (!appt || appt.status !== "confirmed") return;

    window.history.pushState(null, "", window.location.href);

    const handlePopstate = () => {
      window.history.pushState(null, "", window.location.href);
      if (!inCallRef.current) return;
      pendingLeaveRef.current = isDoctor ? "/doctor-dashboard" : "/user/dashboard";
      setLeaveConfirm(true);
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [appt, navigate, isDoctor, performCleanup]);

  // ── Tab close / reload → end call automatically ───────────────────
  useEffect(() => {
    if (!appt || appt.status !== "confirmed") return;

    const handleBeforeUnload = () => {
      performCleanup(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [appt, performCleanup]);

  // ── Assign stream to a video element ──────────────────────────────
  const assignStreams = useCallback((swapped) => {
    if (mainVideoRef.current) {
      mainVideoRef.current.srcObject = swapped
        ? localStreamRef.current
        : remoteStreamRef.current;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.srcObject = swapped
        ? remoteStreamRef.current
        : localStreamRef.current;
    }
  }, []);

  // ── Main WebRTC + Socket setup ────────────────────────────────────
  useEffect(() => {
    if (!appt || appt.status !== "confirmed") return;

    let mounted = true;
    completedRef.current = false;
    let resolveLocalReady = () => { };
    const localReadyPromise = new Promise((resolve) => {
      resolveLocalReady = resolve;
    });

    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (mainVideoRef.current) mainVideoRef.current.srcObject = remoteStream;

    // Get local media
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);

        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

        localStreamRef.current = stream;
        if (pipVideoRef.current) pipVideoRef.current.srcObject = stream;

        stream.getVideoTracks().forEach((t) => setTrackHint(t, "detail"));
        stream.getAudioTracks().forEach((t) => setTrackHint(t, "speech"));

        const senderTuning = stream.getTracks().map((track) => {
          const sender = pc.addTrack(track, stream);
          return tuneSenderQuality(
            sender,
            track.kind === "video"
              ? {
                maxBitrate: BITRATE_PROFILE.cameraVideo,
                maxFramerate: 30,
                maintainResolution: true,
              }
              : { maxBitrate: BITRATE_PROFILE.voiceAudio }
          );
        });
        await Promise.allSettled(senderTuning);

        if (mounted) { setIsReady(true); isReadyRef.current = true; }
        resolveLocalReady(true);
      } catch (err) {
        if (mounted) setCamError(true);
        resolveLocalReady(false);
      }
    })();

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track);
      });
      if (mounted) {
        assignStreams(isSwappedRef.current);
        setIsRemoteConnected(true);
        setPeerLeft(false);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { appointmentId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (!mounted) return;
      if (s === "connected") {
        setConnectionState("connected");
        setIsRemoteConnected(true);
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } else if (s === "connecting") {
        setConnectionState("connecting");
      } else if (s === "disconnected" || s === "failed") {
        setConnectionState("disconnected");
        setIsRemoteConnected(false);
      }
    };

    // Fallback for browsers where onconnectionstatechange fires late or not at all
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (!mounted) return;
      if (s === "connected" || s === "completed") {
        setConnectionState("connected");
        setIsRemoteConnected(true);
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } else if (s === "checking") {
        if (!inCallRef.current) setConnectionState("connecting");
      } else if (s === "failed") {
        setConnectionState("disconnected");
        setIsRemoteConnected(false);
      }
    };

    // Socket handlers
    const handleOffer = async ({ offer }) => {
      if (!offer || !mounted) return;
      try {
        setConnectionState("connecting");
        // Set remote description immediately so ICE gathering starts on both
        // sides in parallel, rather than waiting for local camera first.
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Now wait for local tracks so the answer includes our video/audio.
        await localReadyPromise;
        if (!mounted) return;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("video-answer", { appointmentId, answer });
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } catch (err) { console.error("Offer error:", err); }
    };

    const handleAnswer = async ({ answer }) => {
      if (!answer || !mounted) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } catch (err) { console.error("Answer error:", err); }
    };

    const handleIce = async ({ candidate }) => {
      if (!candidate || !mounted) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) { }
    };

    const handlePeerJoined = () => {
      if (mounted) { setPeerJoined(true); setPeerLeft(false); }
    };

    const handleParticipantLeft = () => {
      if (mounted) {
        setIsRemoteConnected(false);
        setConnectionState("disconnected");
        setPeerJoined(false);
        setPeerLeft(true);
      }
    };

    const handleChatMessage = (msg) => {
      if (mounted) {
        setMessages((prev) => [...prev, msg]);
        if (!chatOpenRef.current) setUnreadCount((c) => c + 1);
      }
    };
    const handleChatHistory = (payload) => {
      if (mounted && payload?.appointmentId === appointmentId) {
        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      }
    };

    const handleApptUpdated = ({ status }) => {
      if (!mounted) return;
      if (status === "completed" && !isDoctor) {
        setShowCompletedOverlay(true);
        setTimeout(() => navigate("/user/dashboard", { replace: true }), 4000);
      }
    };

    const handleNewPrescription = ({ diagnosis }) => {
      if (!mounted || isDoctor) return;
      setPrescriptionNotif({ diagnosis });
      setTimeout(() => setPrescriptionNotif(null), 10000);
    };

    const handleRoomDenied = ({ msg } = {}) => {
      if (!mounted) return;
      setApptError(msg || "Access to this call room was denied.");
    };

    socket.on("video-offer", handleOffer);
    socket.on("video-answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("participant-left", handleParticipantLeft);
    socket.on("appointment-message", handleChatMessage);
    socket.on("appointment-chat-history", handleChatHistory);
    socket.on("appointment-updated", handleApptUpdated);
    socket.on("new-prescription", handleNewPrescription);
    socket.on("room-access-denied", handleRoomDenied);

    const activeUserId = isDoctor ? doctorId : userId;
    const joinRoom = () => {
      if (activeUserId) {
        socket.emit("user-online", {
          userId: activeUserId,
          role: isDoctor ? "doctor" : "user",
        });
      }
      socket.emit("join-appointment-room", { appointmentId });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
      socket.connect();
    }

    return () => {
      mounted = false;
      resolveLocalReady(false);
      socket.off("connect", joinRoom);
      socket.off("video-offer", handleOffer);
      socket.off("video-answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("peer-joined", handlePeerJoined);
      socket.off("participant-left", handleParticipantLeft);
      socket.off("appointment-message", handleChatMessage);
      socket.off("appointment-chat-history", handleChatHistory);
      socket.off("appointment-updated", handleApptUpdated);
      socket.off("new-prescription", handleNewPrescription);
      socket.off("room-access-denied", handleRoomDenied);
      pc.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(callTimerRef.current);
    };
  }, [appt, appointmentId, assignStreams, isDoctor, doctorId, userId]);

  // ── Auto-start: patient sends offer when both sides ready ─────────
  useEffect(() => {
    if (!peerJoined || !isReady || inCall || isDoctor) return;
    const pc = pcRef.current;
    if (!pc || inCallRef.current) return;

    (async () => {
      try {
        setConnectionState("connecting");
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit("video-offer", { appointmentId, offer });
        setInCall(true);
        inCallRef.current = true;
      } catch (err) { console.error("Auto-start error:", err); }
    })();
  }, [peerJoined, isReady, inCall, isDoctor, appointmentId]);

  // ── Call timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (inCall) {
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
    }
    return () => clearInterval(callTimerRef.current);
  }, [inCall]);

  // ── Controls ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((p) => !p);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsCamOff((p) => !p);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        setTrackHint(camTrack, "detail");
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(camTrack);
          await tuneSenderQuality(sender, {
            maxBitrate: BITRATE_PROFILE.cameraVideo,
            maxFramerate: 30,
            maintainResolution: true,
          });
        }
      }
      assignStreams(isSwappedRef.current);
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        setTrackHint(screenTrack, "detail");
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(screenTrack);
          await tuneSenderQuality(sender, {
            maxBitrate: BITRATE_PROFILE.screenShareVideo,
            maxFramerate: 30,
            maintainResolution: true,
          });
        }
        // Show screen in pip (local position)
        if (pipVideoRef.current) pipVideoRef.current.srcObject = screen;
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        if (err.name !== "NotAllowedError") console.error("Screen share error:", err);
      }
    }
  }, [isScreenSharing, assignStreams]);

  const toggleSwap = useCallback(() => {
    setIsSwapped((prev) => {
      const next = !prev;
      assignStreams(next);
      return next;
    });
  }, [assignStreams]);

  const toggleSelfView = useCallback(() => {
    setIsSelfViewMinimized((prev) => !prev);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const pageEl = pageRef.current;
    if (!pageEl) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await pageEl.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  }, []);

  const endCall = useCallback(async () => {
    if (completing) return;
    setEndCallConfirm(false);
    setCompleting(true);
    try {
      if (isDoctor && appt?.status === "confirmed") {
        await api.put(`/api/appointments/${appointmentId}/complete`, {});
      }
      performCleanup(false);
      navigate(isDoctor ? "/doctor-dashboard/patients" : "/user/dashboard", { replace: true });
    } catch (err) {
      setCompleting(false);
      setInlineError(err.response?.data?.msg || "Failed to end call. Please try again.");
      setTimeout(() => setInlineError(""), 5000);
    }
  }, [completing, isDoctor, appt?.status, appointmentId, performCleanup, navigate]);

  const handleRxSaved = useCallback(() => {
    setShowRxModal(false);
    setRxSavedToast(true);
    setTimeout(() => setRxSavedToast(false), 4000);
  }, []);

  // ── PiP drag ──────────────────────────────────────────────────────
  const handlePipPointerDown = useCallback((e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    const rect = pipRef.current.getBoundingClientRect();
    dragRef.current = {
      active: true,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      ex: rect.left,
      ey: rect.top,
    };
    pipRef.current.setPointerCapture(e.pointerId);
  }, []);

  const handlePipPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const { ox, oy } = dragRef.current;
    const pip = pipRef.current;
    const w = pip?.offsetWidth ?? 200;
    const h = pip?.offsetHeight ?? 140;
    const x = Math.max(8, Math.min(e.clientX - ox, window.innerWidth - w - 8));
    const y = Math.max(8, Math.min(e.clientY - oy, window.innerHeight - h - 8));
    setPipPos({ x, y });
  }, []);

  const handlePipPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  // ── Chat ──────────────────────────────────────────────────────────
  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      if (!prev) setUnreadCount(0);
      chatOpenRef.current = !prev;
      return !prev;
    });
  }, []);

  const sendMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    socket.emit("appointment-message", {
      appointmentId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text,
    });
    setChatInput("");
  }, [chatInput, appointmentId, currentUser]);

  const handleChatKey = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      setInlineError("File too large. Max 10 MB.");
      setTimeout(() => setInlineError(""), 4000);
      return;
    }
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      socket.emit("appointment-message", {
        appointmentId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: "",
        fileUrl: res.data.url,
        fileName: res.data.name ?? file.name,
        fileType: res.data.type ?? file.type,
      });
    } catch (err) {
      setInlineError(err.response?.data?.msg || "File upload failed.");
      setTimeout(() => setInlineError(""), 4000);
    } finally {
      setUploadingFile(false);
    }
  }, [appointmentId, currentUser]);

  // ── Other party info ──────────────────────────────────────────────
  const otherParty = useMemo(() => {
    if (!appt) return null;
    if (isDoctor) return {
      label: "Patient",
      name: appt.patientId?.name || "Unknown Patient",
      sub: appt.problem || "",
      initial: appt.patientId?.name?.[0]?.toUpperCase() || "P",
      color: "#3b82f6",
    };
    return {
      label: "Doctor",
      name: `Dr. ${appt.doctorId?.name || "Unknown"}`,
      sub: appt.doctorId?.email || "",
      initial: appt.doctorId?.name?.[0]?.toUpperCase() || "D",
      color: "#19c9a3",
    };
  }, [appt, isDoctor]);

  // ── Gate screens ──────────────────────────────────────────────────
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
        <div className="hc-vc__gate-icon"><FiAlertTriangle /></div>
        <h2>Access Denied</h2>
        <p>{apptError}</p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (appt?.status === "pending") {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon"><FiClock /></div>
        <h2>Appointment Pending</h2>
        <p>
          {isDoctor
            ? "Confirm this appointment from your dashboard before starting the video call."
            : "Your appointment is awaiting the doctor's confirmation."}
        </p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (appt?.status === "completed" || appt?.status === "cancelled") {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">
          {appt.status === "completed" ? <FiCheckCircle /> : <FiX />}
        </div>
        <h2>Appointment {appt.status === "completed" ? "Completed" : "Cancelled"}</h2>
        <p>This appointment is no longer active.</p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  // ── PiP position style ────────────────────────────────────────────
  const pipStyle = pipPos.x !== null
    ? { position: "fixed", left: `${pipPos.x}px`, top: `${pipPos.y}px`, right: "auto", bottom: "auto" }
    : {};

  // ── Main call UI ──────────────────────────────────────────────────
  return (
    <div className="hc-vc__page" ref={pageRef}>

      <div className="hc-vc__ctrlbar-meta">
          <div className="hc-vc__meta-left">
            <div className="hc-vc__logo-mark">
              <div className="hc-vc__logo-dot" />
              <span className="hc-vc__logo-text">Humancare Connect</span>
            </div>

            {otherParty && (
              <div className="hc-vc__meta-party">
                <span className="hc-vc__infobar-label">{otherParty.label}</span>
                <span className="hc-vc__infobar-name">{otherParty.name}</span>
              </div>
            )}
          </div>

          <div className="hc-vc__meta-right">
            {inCall && isDoctor && (
              <div className="hc-vc__timer">
                <FiClock />
                <span>{fmtDuration(callDuration)}</span>
              </div>
            )}

            {/* <div className={`hc-vc__status-pill hc-vc__status-pill--${connectionState}`}>
              <span className="hc-vc__status-dot" />
              {connectionState === "idle" && "Waiting"}
              {connectionState === "connecting" && "Connecting..."}
              {connectionState === "connected" && "Live"}
              {connectionState === "disconnected" && "Disconnected"}
            </div> */}

            {/* <span className="hc-vc__infobar-chip"><FiCalendar /> {fmtDate(appt.date)}</span>
            <span className="hc-vc__infobar-chip"><FiClock /> {appt.time}</span>
            <span className="hc-vc__infobar-chip hc-vc__infobar-chip--green"><FiCheckCircle /> Confirmed</span> */}
          </div>
        </div>

      {/* ── Inline error toast ──────────────────────────────────── */}
      {inlineError && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, background: "#fef2f2", border: "1px solid #fca5a5",
          color: "#dc2626", borderRadius: 10, padding: "12px 20px",
          fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
        }}>
          <FiAlertTriangle /> {inlineError}
        </div>
      )}

      {/* ── End Call confirm modal ───────────────────────────────── */}
      {endCallConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.6)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setEndCallConfirm(false)}>
          <div style={{
            background: "#0d1f35", borderRadius: 16, padding: "28px 32px",
            maxWidth: 380, width: "100%", textAlign: "center",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              <FiPhoneOff style={{ color: "#ef4444" }} />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#f1f5f9" }}>
              {isDoctor ? "End Consultation?" : "Leave Call?"}
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8" }}>
              {isDoctor
                ? "This will end the call and mark the consultation as completed."
                : "You will leave the video call. The doctor will be notified."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setEndCallConfirm(false)}
                style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >Stay</button>
              <button
                onClick={endCall}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >{isDoctor ? "End & Complete" : "Leave Call"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave (back button) confirm modal ───────────────────── */}
      {leaveConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.6)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setLeaveConfirm(false)}>
          <div style={{
            background: "#0d1f35", borderRadius: 16, padding: "28px 32px",
            maxWidth: 380, width: "100%", textAlign: "center",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#f1f5f9" }}>Leave Consultation?</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8" }}>
              Leaving will end your consultation session. Are you sure?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setLeaveConfirm(false)}
                style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >Stay</button>
              <button
                onClick={() => {
                  setLeaveConfirm(false);
                  performCleanup(true);
                  navigate(pendingLeaveRef.current || "/user/dashboard", { replace: true });
                }}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Consultation completed overlay (patient) ─────────────── */}
      {showCompletedOverlay && !isDoctor && (
        <div className="hc-vc__completed-overlay">
          <div className="hc-vc__completed-card">
            <div className="hc-vc__completed-icon"><FiCheckCircle /></div>
            <h2>Consultation Completed</h2>
            <p>Your doctor has marked this session as complete.</p>
            <p className="hc-vc__completed-sub">Redirecting to your dashboard…</p>
            <div className="hc-vc__completed-spinner" />
          </div>
        </div>
      )}

      {/* ── Prescription notification banner (patient) ───────────── */}
      {/* {prescriptionNotif && !isDoctor && (
        <div className="hc-vc__rx-notif">
          <span className="hc-vc__rx-notif-icon"><FaCapsules /></span>
          <span className="hc-vc__rx-notif-text">
            Prescription issued: <strong>{prescriptionNotif.diagnosis}</strong>
          </span>
          <button
            className="hc-vc__rx-notif-view"
            onClick={() => navigate("/user/my-records")}
          >
            View
          </button>
          <button className="hc-vc__rx-notif-close" onClick={() => setPrescriptionNotif(null)}><FiX /></button>
        </div>
      )} */}

      {/* ── Rx saved toast (doctor) ──────────────────────────────── */}
      {/* {rxSavedToast && isDoctor && (
        <div className="hc-vc__rx-saved-toast">
          <FiCheckCircle /> Prescription issued successfully
        </div>
      )} */}

      {/* Main stage + chat */}
      <div className={`hc-vc__body ${chatOpen ? "hc-vc__body--chat" : ""}`}>

        {/* Stage */}
        <div className="hc-vc__stage">

          {/* Main video */}
          <div className="hc-vc__main-wrap">
            <video
              ref={mainVideoRef}
              autoPlay
              playsInline
              muted={isSwapped}
              className={`hc-vc__main-video${isSwapped ? " hc-vc__video--local" : ""}`}
            />

            {/* Waiting overlay — only when remote isn't connected and remote is in main */}
            {!isRemoteConnected && !isSwapped && (
              <div className="hc-vc__waiting">
                <div className="hc-vc__waiting-ring">
                  <div className="hc-vc__waiting-avatar-wrap">
                    <span className="hc-vc__waiting-icon"><FiUser /></span>
                  </div>
                </div>
                <p className="hc-vc__waiting-title">
                  {peerJoined ? "Establishing secure connection…" : `Waiting for ${isDoctor ? "patient" : "doctor"}…`}
                </p>
                <p className="hc-vc__waiting-sub">
                  {peerJoined
                    ? "Both participants are ready. Video starting soon."
                    : "Share the appointment link with the other person to begin."}
                </p>
              </div>
            )}

            {/* Peer left notice */}
            {peerLeft && (
              <div className="hc-vc__peer-left-notice">
                <span><FiPhoneOff /></span>
                <span>{isDoctor ? "Patient" : "Doctor"} has left the call.</span>
              </div>
            )}
          </div>

          {/* PiP — draggable local (or remote when swapped) */}
          {!isSelfViewMinimized && (
            <div
              ref={pipRef}
              className={`hc-vc__pip ${isCamOff && !isSwapped ? "hc-vc__pip--cam-off" : ""}`}
              style={pipStyle}
              onPointerDown={handlePipPointerDown}
              onPointerMove={handlePipPointerMove}
              onPointerUp={handlePipPointerUp}
            >
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted={!isSwapped}
                className={`hc-vc__pip-video${!isSwapped ? " hc-vc__video--local" : ""}`}
              />

              {isCamOff && !isSwapped && (
                <div className="hc-vc__pip-cam-off">
                  <span><FiVideoOff /></span>
                </div>
              )}

              <div className="hc-vc__pip-label">
                {isSwapped ? otherParty?.label ?? "Remote" : `You${isDoctor ? " (Doctor)" : ""}`}
              </div>

              <button className="hc-vc__pip-min-btn" onClick={toggleSelfView} title="Minimize self view">
                <FiMinimize2 />
              </button>

              {/* Expand / swap button */}
              <button className="hc-vc__pip-swap-btn" onClick={toggleSwap} title="Swap view"><FiRefreshCw /></button>
            </div>
          )}

          {isSelfViewMinimized && (
            <button className="hc-vc__pip-restore-btn" onClick={toggleSelfView} title="Show self view">
              <FiMaximize2 />
              <span>Self View</span>
            </button>
          )}

          {/* Peer joined toast */}
          {peerJoined && !isRemoteConnected && (
            <div className="hc-vc__join-toast">
              <span className="hc-vc__join-dot" />
              {isDoctor ? "Patient" : "Doctor"} joined · connecting…
            </div>
          )}
        </div>

        {/* ── Chat panel ───────────────────────────────────────── */}
        {chatOpen && (
          <div className="hc-vc__chat">
            <div className="hc-vc__chat-head">
              <div className="hc-vc__chat-head-left">
                <span className="hc-vc__chat-icon"><FiMessageSquare /></span>
                <span className="hc-vc__chat-title">In-call Chat</span>
              </div>
              <button className="hc-vc__chat-close-btn" onClick={toggleChat}><FiX /></button>
            </div>

            <div className="hc-vc__chat-body">
              {messages.length === 0 && (
                <div className="hc-vc__chat-empty">
                  <span><FiMessageSquare /></span>
                  <p>No messages yet.</p>
                  <p>Share notes or files here during the call.</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const mine = msg.senderId === currentUser.id;
                return (
                  <div key={i} className={`hc-vc__msg ${mine ? "hc-vc__msg--mine" : "hc-vc__msg--theirs"}`}>
                    {!mine && <div className="hc-vc__msg-name">{msg.senderName}</div>}

                    {msg.fileUrl ? (
                      <div className="hc-vc__msg-bubble hc-vc__msg-file">
                        {msg.fileType?.startsWith("image/") ? (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="hc-vc__msg-img-link">
                            <img src={msg.fileUrl} alt={msg.fileName} className="hc-vc__msg-img" />
                            <span className="hc-vc__msg-img-name">{msg.fileName}</span>
                          </a>
                        ) : (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" download={msg.fileName} className="hc-vc__msg-file-row">
                            <span className="hc-vc__msg-file-icon">
                              {msg.fileType?.includes("pdf") ? "📄"
                                : msg.fileType?.includes("word") || msg.fileType?.includes("doc") ? "📝"
                                  : msg.fileType?.includes("sheet") || msg.fileType?.includes("excel") ? "📊"
                                    : "📎"}
                            </span>
                            <span className="hc-vc__msg-file-name">{msg.fileName}</span>
                            <span className="hc-vc__msg-file-dl">↓</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="hc-vc__msg-bubble">{msg.text}</div>
                    )}

                    <div className="hc-vc__msg-time">{fmtTime(msg.createdAt)}</div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="hc-vc__chat-foot">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                className="hc-vc__chat-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title="Attach file"
              >
                {uploadingFile ? <span className="hc-vc__attach-spin" /> : <FiPaperclip />}
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
                onClick={sendMessage}
                disabled={!chatInput.trim()}
                title="Send"
              ><FiSend /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls bar ─────────────────────────────────────────── */}
      <div className="hc-vc__ctrlbar">
        

        <div className="hc-vc__ctrlbar-inner">
          <button
            className={`hc-vc__btn ${isMuted ? "hc-vc__btn--danger" : ""}`}
            onClick={toggleMute}
            disabled={!isReady}
            title={isMuted ? "Unmute" : "Mute microphone"}
          >
            <span className="hc-vc__btn-icon">{isMuted ? <FiMicOff /> : <FiMic />}</span>
            <span className="hc-vc__btn-label">{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            className={`hc-vc__btn ${isCamOff ? "hc-vc__btn--danger" : ""}`}
            onClick={toggleCamera}
            disabled={!isReady}
            title={isCamOff ? "Turn camera on" : "Turn camera off"}
          >
            <span className="hc-vc__btn-icon">{isCamOff ? <FiVideoOff /> : <FiVideo />}</span>
            <span className="hc-vc__btn-label">{isCamOff ? "Cam On" : "Cam Off"}</span>
          </button>

          <button
            className={`hc-vc__btn ${isScreenSharing ? "hc-vc__btn--active" : ""}`}
            onClick={toggleScreenShare}
            disabled={!isReady}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <span className="hc-vc__btn-icon"><FiMonitor /></span>
            <span className="hc-vc__btn-label">{isScreenSharing ? "Stop" : "Share"}</span>
          </button>
 {inCall && (
            <div className="hc-vc__live-pill">
              <span className="hc-vc__live-dot" />
              Live
            </div>
          )}
          <button
            className={`hc-vc__btn ${isFullscreen ? "hc-vc__btn--active" : ""}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            <span className="hc-vc__btn-icon">{isFullscreen ? <FiMinimize /> : <FiMaximize />}</span>
            <span className="hc-vc__btn-label">{isFullscreen ? "Exit" : "Full"}</span>
          </button>

          <button
            className={`hc-vc__btn ${isSelfViewMinimized ? "hc-vc__btn--active" : ""}`}
            onClick={toggleSelfView}
            title={isSelfViewMinimized ? "Show self view" : "Minimize self view"}
          >
            <span className="hc-vc__btn-icon">{isSelfViewMinimized ? <FiMaximize2 /> : <FiMinimize2 />}</span>
            <span className="hc-vc__btn-label">{isSelfViewMinimized ? "Show Me" : "Hide Me"}</span>
          </button>

          <button
            className={`hc-vc__btn ${chatOpen ? "hc-vc__btn--chat-on" : ""}`}
            onClick={toggleChat}
            title="Chat"
          >
            <span className="hc-vc__btn-icon"><FiMessageSquare /></span>
            <span className="hc-vc__btn-label">Chat</span>
            {unreadCount > 0 && !chatOpen && (
              <span className="hc-vc__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

         

          {/* {isDoctor && (
            <button
              className="hc-vc__btn hc-vc__btn--rx"
              onClick={() => setShowRxModal(true)}
              title="Issue prescription"
            >
              <span className="hc-vc__btn-icon"><FaCapsules /></span>
              <span className="hc-vc__btn-label">Rx</span>
            </button>
          )} */}

          <button
            className="hc-vc__btn hc-vc__btn--end"
            onClick={() => setEndCallConfirm(true)}
            disabled={completing}
            title={isDoctor ? "End call and complete consultation" : "End call"}
          >
            <span className="hc-vc__btn-icon">{completing ? <FiRefreshCw /> : <FiPhoneOff />}</span>
            <span className="hc-vc__btn-label">{completing ? "Ending..." : "End Call"}</span>
          </button>
        </div>
      </div>
      {/* Cam error banner */}
      {camError && (
        <div className="hc-vc__error-bar">
          <FiAlertTriangle /> Camera or microphone access denied. Check browser permissions and reload.
        </div>
      )}

      {/* In-call prescription modal (doctor only) */}
      {showRxModal && isDoctor && appt && (
        <InCallPrescriptionModal
          appt={appt}
          onClose={() => setShowRxModal(false)}
          onSaved={handleRxSaved}
        />
      )}
    </div>
  );
}
