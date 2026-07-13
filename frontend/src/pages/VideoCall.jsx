import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import "./videocall.css";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useDoctorAuth } from "../context/DoctorAuthContext";
import { uploadFileDirectToS3 } from "../utils/directUpload";
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
  FiFileText,
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
          <textarea className="hc-vc__rx-input hc-vc__rx-textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Diet, rest, special instructions..." rows={2} />

          <label className="hc-vc__rx-label">Follow-up Date</label>
          <input className="hc-vc__rx-input" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />

          <div className="hc-vc__rx-modal-foot">
            <button type="button" className="hc-vc__rx-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="hc-vc__rx-btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Issue Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const FALLBACK_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
];

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isTurnUrl = (url) => /^turns?:/i.test(String(url || ""));

const normalizeIceUrls = (urls) => Array.isArray(urls) ? urls : parseCsv(urls);

const validateIceServers = (iceServers) => {
  if (!Array.isArray(iceServers) || iceServers.length === 0) {
    return "No ICE servers are configured.";
  }

  for (const server of iceServers) {
    const urls = normalizeIceUrls(server?.urls);
    if (!urls.length) return "An ICE server is missing urls.";

    for (const url of urls) {
      if (isTurnUrl(url)) {
        if (!server.username || !server.credential) {
          return "TURN servers require username and credential.";
        }
      }
    }
  }

  return "";
};

const hasTurnServer = (iceServers) =>
  Array.isArray(iceServers) &&
  iceServers.some((server) => normalizeIceUrls(server?.urls).some(isTurnUrl));

const buildIceServerConfig = () => {
  const jsonConfig = import.meta.env.VITE_RTC_ICE_SERVERS_JSON;
  if (jsonConfig) {
    try {
      const parsed = JSON.parse(jsonConfig);
      const iceServers = sanitizeIceServers(Array.isArray(parsed) ? parsed : parsed?.iceServers);
      if (Array.isArray(iceServers) && iceServers.length) {
        const error = validateIceServers(iceServers);
        if (import.meta.env.PROD && !hasTurnServer(iceServers)) {
          console.warn(
            "No TURN server configured. Same-network calls may work, but calls across strict NATs can fail."
          );
        }
        return {
          config: {
            iceServers,
            iceCandidatePoolSize: Number(import.meta.env.VITE_RTC_ICE_CANDIDATE_POOL_SIZE || 10),
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
          },
          error,
        };
      }
      console.warn("VITE_RTC_ICE_SERVERS_JSON did not contain iceServers.");
    } catch (err) {
      return {
        config: null,
        error: `Invalid VITE_RTC_ICE_SERVERS_JSON: ${err.message}`,
      };
    }
  }

  const stunUrls = parseCsv(import.meta.env.VITE_RTC_STUN_URLS);
  const turnUrls = parseCsv(import.meta.env.VITE_RTC_TURN_URLS);
  const turnUsername = import.meta.env.VITE_RTC_TURN_USERNAME || "";
  const turnCredential = import.meta.env.VITE_RTC_TURN_CREDENTIAL || "";

  const iceServers = [
    ...(stunUrls.length ? stunUrls : FALLBACK_STUN_URLS).map((urls) => ({ urls })),
  ];

  if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  } else if (turnUrls.length) {
    console.warn("VITE_RTC_TURN_URLS is set, but TURN username/credential is missing. Continuing with STUN-only ICE.");
  }

  const error = validateIceServers(iceServers);
  if (import.meta.env.PROD && !hasTurnServer(iceServers)) {
    console.warn(
      "No TURN server configured. Same-network calls may work, but calls across strict NATs can fail."
    );
  }

  return {
    config: {
      iceServers,
      iceCandidatePoolSize: Number(import.meta.env.VITE_RTC_ICE_CANDIDATE_POOL_SIZE || 10),
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    },
    error,
  };
};

const RTC_SETUP = buildIceServerConfig();
const RTC_CONFIG = RTC_SETUP.config;
const RTC_CONFIG_ERROR = RTC_SETUP.error;

const getIceCandidateType = (candidate = "") => {
  if (candidate.includes(" typ host")) return "host (local)";
  if (candidate.includes(" typ srflx")) return "srflx (STUN)";
  if (candidate.includes(" typ relay")) return "relay (TURN)";
  if (candidate.includes(" typ prflx")) return "prflx";
  return "unknown";
};

const describeIceCandidate = (candidate = "") => {
  const value = String(candidate || "");
  const addressMatch = value.match(/(?:^| )(?:raddr )?([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-z0-9-]+\.local)(?: |$)/i);
  const protocolMatch = value.match(/ (udp|tcp) /i);
  return {
    type: getIceCandidateType(value),
    protocol: protocolMatch?.[1]?.toLowerCase() || "unknown",
    address: addressMatch?.[1] || "",
  };
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
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: "user",
  },
};

const BITRATE_PROFILE = {
  cameraVideo: Number(import.meta.env.VITE_RTC_CAMERA_BITRATE || 1_200_000),
  screenShareVideo: Number(import.meta.env.VITE_RTC_SCREEN_BITRATE || 2_000_000),
  voiceAudio: Number(import.meta.env.VITE_RTC_AUDIO_BITRATE || 64_000),
};

const ICE_RESTART_DELAY_MS = Number(import.meta.env.VITE_RTC_ICE_RESTART_DELAY_MS || 2500);
const CONNECTION_FAIL_TIMEOUT_MS = Number(import.meta.env.VITE_RTC_CONNECT_TIMEOUT_MS || 15000);
const ICE_MAX_RECOVERY_ATTEMPTS = Number(import.meta.env.VITE_RTC_ICE_MAX_RECOVERY_ATTEMPTS || 4);
const ICE_RECOVERY_COOLDOWN_MS = Number(import.meta.env.VITE_RTC_ICE_RECOVERY_COOLDOWN_MS || 30000);

const mediaErrorMessage = (err) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Your browser blocked camera/microphone access because this page isn't loaded over a secure (HTTPS) connection.";
  }
  switch (err?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera/microphone permission was denied. Click the camera icon in the address bar and allow access, then retry.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your camera or microphone is already in use by another app. Close it and retry.";
    default:
      return "Camera or microphone access failed. Check browser permissions and reload.";
  }
};

const getConsultationMediaStream = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
  } catch (firstErr) {
    console.warn("High-quality media failed, trying basic constraints:", firstErr.name);
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (secondErr) {
      console.warn("Basic video+audio failed, trying separate devices:", secondErr.name);
      const partialStream = new MediaStream();
      let lastErr = secondErr;

      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: MEDIA_CONSTRAINTS.video,
        });
        videoOnly.getTracks().forEach((track) => partialStream.addTrack(track));
      } catch (videoErr) {
        console.warn("Video-only media failed:", videoErr.name);
        lastErr = videoErr;
      }

      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: MEDIA_CONSTRAINTS.audio,
          video: false,
        });
        audioOnly.getTracks().forEach((track) => partialStream.addTrack(track));
      } catch (audioErr) {
        console.warn("Audio-only media failed:", audioErr.name);
        lastErr = audioErr;
      }

      if (partialStream.getTracks().length > 0) {
        return partialStream;
      }

      throw lastErr;
    }
  }
};

const getDeviceCheckSummary = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return {
      camera: "unknown",
      microphone: "unknown",
      speaker: "unknown",
      labelsAvailable: false,
    };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      camera: devices.some((device) => device.kind === "videoinput") ? "available" : "missing",
      microphone: devices.some((device) => device.kind === "audioinput") ? "available" : "missing",
      speaker: devices.some((device) => device.kind === "audiooutput") ? "available" : "unknown",
      labelsAvailable: devices.some((device) => Boolean(device.label)),
    };
  } catch {
    return {
      camera: "unknown",
      microphone: "unknown",
      speaker: "unknown",
      labelsAvailable: false,
    };
  }
};

const canUseScreenShare = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getDisplayMedia);

const isIPhoneSafari = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPod/.test(navigator.userAgent || "") &&
  /Safari/.test(navigator.userAgent || "") &&
  !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent || "");

const playVideoElement = async (videoEl) => {
  if (!videoEl) return true;
  try {
    const playResult = videoEl.play?.();
    if (playResult && typeof playResult.then === "function") {
      await playResult;
    }
    return true;
  } catch (err) {
    console.warn("Video playback was blocked:", err?.message || err);
    return false;
  }
};

const setTrackHint = (track, hint) => {
  if (!track || !("contentHint" in track)) return;
  try {
    track.contentHint = hint;
  } catch (_) { }
};

const getSenderForKind = (pc, kind) => {
  if (!pc) return null;
  return (
    pc.getSenders?.().find((sender) => sender.track?.kind === kind) ||
    pc.getTransceivers?.().find((transceiver) => transceiver.receiver?.track?.kind === kind)?.sender ||
    null
  );
};

const hasTransceiverForKind = (pc, kind) =>
  Boolean(
    pc?.getTransceivers?.().some((transceiver) =>
      transceiver.sender?.track?.kind === kind ||
      transceiver.receiver?.track?.kind === kind
    )
  );

const ensureMediaTransceivers = (pc, { audio = true, video = true } = {}) => {
  if (!pc?.addTransceiver || pc.signalingState === "closed") return;
  if (audio && !hasTransceiverForKind(pc, "audio")) {
    pc.addTransceiver("audio", { direction: "sendrecv" });
  }
  if (video && !hasTransceiverForKind(pc, "video")) {
    pc.addTransceiver("video", { direction: "sendrecv" });
  }
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
  const isMutedRef = useRef(false);
  const isCamOffRef = useRef(false);
  const peerJoinedRef = useRef(false);
  const chatOpenRef = useRef(false);
  const completedRef = useRef(false);
  const isSwappedRef = useRef(false);
  const callTimerRef = useRef(null);
  const iceRestartTimerRef = useRef(null);
  const connectionFailTimerRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const joinedSocketIdRef = useRef("");
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const ignoreOfferResetTimerRef = useRef(null);
  const settingRemoteAnswerPendingRef = useRef(false);
  const restartRequestInFlightRef = useRef(false);
  const iceRecoveryAttemptsRef = useRef(0);
  const lastIceRecoveryAtRef = useRef(0);
  const pageUnloadingRef = useRef(false);
  const screenSharingRef = useRef(false);
  const screenShareStartInProgressRef = useRef(false);
  const screenShareStopInProgressRef = useRef(false);
  const socketAuthRefreshedRef = useRef(false);

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
  const [camErrorReason, setCamErrorReason] = useState("");
  const [deviceCheck, setDeviceCheck] = useState({
    status: "idle",
    camera: "unknown",
    microphone: "unknown",
    speaker: "unknown",
    labelsAvailable: false,
  });
  const [retryingMedia, setRetryingMedia] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [peerLeft, setPeerLeft] = useState(false);
  const [endCallConfirm, setEndCallConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const pendingLeaveRef = useRef(null);

  // ── Chat state ────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Doctor notes state ────────────────────────────────────────────
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [notesSavedAt, setNotesSavedAt] = useState(null);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const lastSavedNoteRef = useRef({ content: "" });

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
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isCamOffRef.current = isCamOff; }, [isCamOff]);
  useEffect(() => { peerJoinedRef.current = peerJoined; }, [peerJoined]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { isSwappedRef.current = isSwapped; }, [isSwapped]);
  useEffect(() => { screenSharingRef.current = isScreenSharing; }, [isScreenSharing]);

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

  useEffect(() => {
    if (!isDoctor || !appointmentId || !appt?._id) return;

    let cancelled = false;
    setNotesLoading(true);
    setNotesError("");
    setNotesLoaded(false);

    api
      .get(`/api/notes/appointment/${appointmentId}`)
      .then((res) => {
        if (cancelled) return;
        const note = res.data?.note;
        const content = note?.content || "";
        setNoteContent(content);
        setNotesSavedAt(note?.updatedAt || null);
        lastSavedNoteRef.current = { content };
        setNotesLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setNotesError(err.response?.data?.msg || "Could not load consultation notes.");
        setNotesLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDoctor, appointmentId, appt?._id]);

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

  // ── Reliable cleanup: stop tracks + notify peers ───
  const performCleanup = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    clearInterval(callTimerRef.current);
    clearTimeout(iceRestartTimerRef.current);
    clearTimeout(connectionFailTimerRef.current);
    clearTimeout(ignoreOfferResetTimerRef.current);
    socket.emit("leave-appointment-room", { appointmentId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    screenStreamRef.current = null;
    pcRef.current?.close();
    pendingRemoteCandidatesRef.current = [];
    joinedSocketIdRef.current = "";
    peerJoinedRef.current = false;
    ignoreOfferRef.current = false;
    restartRequestInFlightRef.current = false;
    screenSharingRef.current = false;
    screenShareStartInProgressRef.current = false;
    screenShareStopInProgressRef.current = false;
    socketAuthRefreshedRef.current = false;
  }, [appointmentId]);

  const canJoinConsultation = useMemo(() => {
    return appt?.status === "confirmed" || (appt?.status === "assigned" && appt?.doctorId);
  }, [appt]);

  const showInlineMessage = useCallback((message, duration = 4000) => {
    setInlineError(message);
    window.setTimeout(() => setInlineError(""), duration);
  }, []);

  const logVideoEvent = useCallback((event, details = {}) => {
    const payload = {
      appointmentId,
      event,
      role: isDoctor ? "doctor" : "user",
      timestamp: new Date().toISOString(),
      details,
    };

    if (import.meta.env.DEV) {
      console.info("[video-call]", payload);
    } else {
      console.info("[video-call]", event, details);
    }

    if (socket.connected && appointmentId) {
      socket.emit("video-telemetry", payload);
    }
  }, [appointmentId, isDoctor]);

  const emitOnlineAndJoinRoom = useCallback(() => {
    if (!socket.connected || !isReadyRef.current) return false;
    if (joinedSocketIdRef.current === socket.id) return true;

    joinedSocketIdRef.current = socket.id || "";
    setConnectionState((prev) => (prev === "connected" ? prev : "connecting"));

    const activeUserId = isDoctor ? doctorId : userId;
    if (activeUserId) {
      socket.emit("user-online", {
        userId: activeUserId,
        role: isDoctor ? "doctor" : "user",
      });
    }

    socket.emit("join-appointment-room", {
      appointmentId,
      userId: activeUserId,
      role: isDoctor ? "doctor" : "user",
    });
    logVideoEvent("appointment_room_join_requested", { socketId: socket.id });
    return true;
  }, [appointmentId, doctorId, isDoctor, logVideoEvent, userId]);

  // ── Block / intercept browser back button during confirmed call ───
  useEffect(() => {
    if (!canJoinConsultation) return;

    window.history.pushState(null, "", window.location.href);

    const handlePopstate = () => {
      window.history.pushState(null, "", window.location.href);
      pendingLeaveRef.current = isDoctor ? "/doctor-dashboard" : "/user/dashboard";
      setLeaveConfirm(true);
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [canJoinConsultation, navigate, isDoctor, performCleanup]);

  // ── Tab close / reload → allow socket reconnect recovery ──────────
  useEffect(() => {
    if (!canJoinConsultation) return;

    pageUnloadingRef.current = false;
    const handleBeforeUnload = () => {
      pageUnloadingRef.current = true;
    };
    const handlePageShow = () => {
      pageUnloadingRef.current = false;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [canJoinConsultation]);

  // ── Assign stream to a video element ──────────────────────────────
  const playAssignedVideos = useCallback(async () => {
    const remoteVideo = isSwappedRef.current ? pipVideoRef.current : mainVideoRef.current;
    const mainOk = await playVideoElement(mainVideoRef.current);
    const pipOk = await playVideoElement(pipVideoRef.current);
    const remoteOk = remoteVideo === pipVideoRef.current ? pipOk : mainOk;
    setPlaybackBlocked(Boolean(remoteVideo?.srcObject) && !remoteVideo.muted && !remoteOk);
  }, []);

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
    void playAssignedVideos();
  }, [playAssignedVideos]);

  const attachLocalMediaStream = useCallback(async (stream, pc) => {
    if (!stream || !pc || pc.signalingState === "closed") return false;

    const previousStream = localStreamRef.current;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !isCamOffRef.current;
      setTrackHint(track, "detail");
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMutedRef.current;
      setTrackHint(track, "speech");
    });

    localStreamRef.current = stream;
    if (pipVideoRef.current) pipVideoRef.current.srcObject = stream;

    ensureMediaTransceivers(pc, {
      audio: stream.getAudioTracks().length === 0,
      video: stream.getVideoTracks().length === 0,
    });

    const senderTuning = stream.getTracks().map((track) => {
      const sender = getSenderForKind(pc, track.kind);
      const activeSender = sender || pc.addTrack(track, stream);
      const replace = sender ? sender.replaceTrack(track) : Promise.resolve();
      return replace.then(() => tuneSenderQuality(
        activeSender,
        track.kind === "video"
          ? { maxBitrate: BITRATE_PROFILE.cameraVideo, maxFramerate: 30, maintainResolution: true }
          : { maxBitrate: BITRATE_PROFILE.voiceAudio }
      ));
    });

    await Promise.allSettled(senderTuning);

    if (previousStream && previousStream !== stream) {
      previousStream.getTracks().forEach((track) => track.stop());
    }

    assignStreams(isSwappedRef.current);
    return true;
  }, [assignStreams]);

  // ── Main WebRTC + Socket setup ────────────────────────────────────
  useEffect(() => {
    if (!canJoinConsultation) return;
    if (RTC_CONFIG_ERROR || !RTC_CONFIG) {
      setApptError(`Video consultation is not configured: ${RTC_CONFIG_ERROR}`);
      return;
    }

    let mounted = true;
    completedRef.current = false;
    pendingRemoteCandidatesRef.current = [];
    ignoreOfferRef.current = false;
    settingRemoteAnswerPendingRef.current = false;
    clearTimeout(iceRestartTimerRef.current);
    clearTimeout(ignoreOfferResetTimerRef.current);
    let resolveLocalReady = () => { };
    const localReadyPromise = new Promise((resolve) => {
      resolveLocalReady = resolve;
    });

    if (pcRef.current && pcRef.current.signalingState !== "closed") {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    console.info("WebRTC peer connection created", {
      iceServers: RTC_CONFIG.iceServers.map((server) => ({
        urls: server.urls,
        hasUsername: Boolean(server.username),
      })),
    });

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (mainVideoRef.current) mainVideoRef.current.srcObject = remoteStream;
    const isPolitePeer = isDoctor;

    const resetIgnoredOffer = () => {
      clearTimeout(ignoreOfferResetTimerRef.current);
      ignoreOfferResetTimerRef.current = null;
      ignoreOfferRef.current = false;
    };

    const markIgnoredOffer = () => {
      ignoreOfferRef.current = true;
      clearTimeout(ignoreOfferResetTimerRef.current);
      ignoreOfferResetTimerRef.current = window.setTimeout(() => {
        ignoreOfferRef.current = false;
        ignoreOfferResetTimerRef.current = null;
      }, ICE_RESTART_DELAY_MS * 2);
    };

    const flushPendingIceCandidates = async () => {
      if (!pc.remoteDescription) return;
      const pending = pendingRemoteCandidatesRef.current.splice(0);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("Queued ICE candidate rejected:", err.message);
        }
      }
    };

    const createAndSendOffer = async ({ iceRestart = false } = {}) => {
      if (!mounted || pc.signalingState === "closed" || makingOfferRef.current) return false;
      if (!isReadyRef.current) return false;
      if (pc.signalingState !== "stable") {
        console.info("Skipping offer because signaling state is", pc.signalingState);
        return false;
      }
      try {
        makingOfferRef.current = true;
        resetIgnoredOffer();
        const offer = await pc.createOffer({
          iceRestart,
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        if (!mounted || pc.signalingState === "closed") return false;
        await pc.setLocalDescription(offer);
        socket.emit("video-offer", { appointmentId, offer: pc.localDescription });
        if (iceRestart) logVideoEvent("ice_restart_offer_sent", { signalingState: pc.signalingState });
        return true;
      } catch (err) {
        console.error(iceRestart ? "ICE restart offer failed:" : "Offer failed:", err);
        if (iceRestart) logVideoEvent("ice_restart_offer_failed", { message: err.message });
        return false;
      } finally {
        makingOfferRef.current = false;
      }
    };

    const startConnectionWatchdog = () => {
      clearTimeout(connectionFailTimerRef.current);
      connectionFailTimerRef.current = setTimeout(() => {
        if (!mounted || pc.signalingState === "closed") return;
        if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
        console.warn("Connection establishment timed out; requesting ICE recovery.");
        scheduleIceRestart();
      }, CONNECTION_FAIL_TIMEOUT_MS);
    };

    const requestPeerIceRestart = () => {
      if (restartRequestInFlightRef.current) return;
      restartRequestInFlightRef.current = true;
      socket.emit("ice-restart-request", { appointmentId });
      logVideoEvent("ice_restart_requested_from_peer", {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      window.setTimeout(() => {
        restartRequestInFlightRef.current = false;
      }, ICE_RESTART_DELAY_MS * 2);
    };

    const scheduleIceRestart = () => {
      if (!mounted || iceRestartTimerRef.current) return;
      iceRestartTimerRef.current = setTimeout(async () => {
        iceRestartTimerRef.current = null;
        if (!mounted || pc.signalingState === "closed") return;
        if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;

        const now = Date.now();
        if (now - lastIceRecoveryAtRef.current > ICE_RECOVERY_COOLDOWN_MS) {
          iceRecoveryAttemptsRef.current = 0;
        }
        lastIceRecoveryAtRef.current = now;

        if (iceRecoveryAttemptsRef.current >= ICE_MAX_RECOVERY_ATTEMPTS) {
          logVideoEvent("ice_recovery_exhausted", {
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            attempts: iceRecoveryAttemptsRef.current,
          });
          requestPeerIceRestart();
          return;
        }

        iceRecoveryAttemptsRef.current += 1;
        logVideoEvent("ice_recovery_attempt", {
          attempts: iceRecoveryAttemptsRef.current,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        });

        if (isDoctor) {
          requestPeerIceRestart();
          return;
        }
        console.log("Restarting ICE...");
        await createAndSendOffer({ iceRestart: true });
      }, ICE_RESTART_DELAY_MS);
    };

    // Get local media after a lightweight device check.
    (async () => {
      try {
        setDeviceCheck((prev) => ({ ...prev, status: "checking" }));
        const summary = await getDeviceCheckSummary();
        if (!mounted) return;
        setDeviceCheck({ ...summary, status: "checking" });
        logVideoEvent("device_check", summary);

        const stream = await getConsultationMediaStream();
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

        await attachLocalMediaStream(stream, pc);

        if (mounted) {
          setIsReady(true);
          isReadyRef.current = true;
          setCamError(false);
          setCamErrorReason("");
          setDeviceCheck((prev) => ({ ...prev, status: "ready" }));
          logVideoEvent("media_ready", {
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
          });
          if (socket.connected) joinRoom();
          if (!isDoctor && peerJoinedRef.current) {
            window.setTimeout(() => {
              if (!mounted || pc.signalingState === "closed") return;
              if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
              void createAndSendOffer({ iceRestart: inCallRef.current });
            }, 300);
          }
        }
        resolveLocalReady(true);

      } catch (err) {
        console.error("All media attempts failed:", err.name, err.message);
        logVideoEvent("media_permission_failed", { name: err.name, message: err.message });
        if (mounted) {
          ensureMediaTransceivers(pc);
          localStreamRef.current = new MediaStream();
          assignStreams(isSwappedRef.current);
          setIsReady(true);
          isReadyRef.current = true;
          setCamError(true);
          setCamErrorReason(mediaErrorMessage(err));
          setDeviceCheck((prev) => ({ ...prev, status: "failed" }));
          if (socket.connected) joinRoom();
          if (!isDoctor && peerJoinedRef.current) {
            window.setTimeout(() => {
              if (!mounted || pc.signalingState === "closed") return;
              if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
              void createAndSendOffer({ iceRestart: inCallRef.current });
            }, 300);
          }
        }
        resolveLocalReady(true);
      }
    })();

    pc.ontrack = (event) => {
      const incomingTracks = event.streams?.length
        ? event.streams.flatMap((stream) => stream.getTracks())
        : [event.track].filter(Boolean);

      incomingTracks.forEach((track) => {
        if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track);
      });

      if (mounted) {
        logVideoEvent("remote_track_received", {
          tracks: incomingTracks.map((track) => ({
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          })),
          streamCount: event.streams?.length || 0,
        });
        assignStreams(isSwappedRef.current);
        void playAssignedVideos();
        setIsRemoteConnected(true);
        setPeerLeft(false);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const candidateInfo = describeIceCandidate(e.candidate.candidate);
        console.log("ICE candidate gathered:", candidateInfo);
        logVideoEvent("ice_candidate_gathered", candidateInfo);
        socket.emit("ice-candidate", { appointmentId, candidate: e.candidate });
      } else {
        console.log("ICE gathering complete");
        logVideoEvent("ice_gathering_complete", {});
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (!mounted) return;
      if (s === "connected") {
        clearTimeout(iceRestartTimerRef.current);
        clearTimeout(connectionFailTimerRef.current);
        iceRestartTimerRef.current = null;
        restartRequestInFlightRef.current = false;
        iceRecoveryAttemptsRef.current = 0;
        setConnectionState("connected");
        setIsRemoteConnected(true);
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } else if (s === "connecting") {
        setConnectionState("connecting");
        startConnectionWatchdog();
      } else if (s === "disconnected" || s === "failed") {
        logVideoEvent("peer_connection_unhealthy", { state: s, iceConnectionState: pc.iceConnectionState });
        setConnectionState("disconnected");
        setIsRemoteConnected(false);
        scheduleIceRestart();
      }
    };

    // Fallback for browsers where onconnectionstatechange fires late or not at all
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("ICE connection state:", s);
      if (!mounted) return;
      if (s === "connected" || s === "completed") {
        clearTimeout(iceRestartTimerRef.current);
        clearTimeout(connectionFailTimerRef.current);
        iceRestartTimerRef.current = null;
        restartRequestInFlightRef.current = false;
        iceRecoveryAttemptsRef.current = 0;
        setConnectionState("connected");
        setIsRemoteConnected(true);
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } else if (s === "checking") {
        if (!inCallRef.current) setConnectionState("connecting");
        startConnectionWatchdog();
      } else if (s === "failed") {
        console.warn("ICE connection failed - connection may not work properly");
        logVideoEvent("ice_connection_failed", { state: s, connectionState: pc.connectionState });
        setConnectionState("disconnected");
        setIsRemoteConnected(false);
        console.log("Attempting ICE recovery...");
        scheduleIceRestart();
      } else if (s === "disconnected") {
        console.warn("ICE connection disconnected");
        logVideoEvent("ice_connection_disconnected", { state: s, connectionState: pc.connectionState });
        setConnectionState("connecting");
        scheduleIceRestart();
      }
    };

    // Socket handlers
    const handleOffer = async ({ offer }) => {
      if (!offer || !mounted) return;
      try {
        setConnectionState("connecting");
        const readyForOffer =
          !makingOfferRef.current &&
          (pc.signalingState === "stable" || settingRemoteAnswerPendingRef.current);
        const offerCollision = !readyForOffer;

        const shouldIgnoreOffer = !isPolitePeer && offerCollision;
        if (shouldIgnoreOffer) {
          markIgnoredOffer();
        } else {
          resetIgnoredOffer();
        }
        if (shouldIgnoreOffer) {
          console.info("Ignoring colliding offer from peer.");
          return;
        }

        if (offerCollision && pc.signalingState === "have-local-offer") {
          console.info("Rolling back local offer to accept peer offer.");
          await pc.setLocalDescription({ type: "rollback" });
        } else if (offerCollision) {
          console.info("Ignoring offer while negotiation is already in progress.");
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        resetIgnoredOffer();
        await flushPendingIceCandidates();
        // Now wait for local tracks so the answer includes our video/audio.
        const localReady = await localReadyPromise;
        if (!mounted) return;
        if (!localReady) {
          setCamError(true);
          setCamErrorReason("Allow camera or microphone access, then retry to join the consultation.");
          return;
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("video-answer", { appointmentId, answer: pc.localDescription });
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } catch (err) { console.error("Offer error:", err); }
    };

    const handleAnswer = async ({ answer }) => {
      if (!answer || !mounted) return;
      try {
        if (pc.signalingState !== "have-local-offer") {
          console.info("Ignoring stale answer while signaling state is", pc.signalingState);
          return;
        }
        settingRemoteAnswerPendingRef.current = true;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        resetIgnoredOffer();
        await flushPendingIceCandidates();
        if (!inCallRef.current) { setInCall(true); inCallRef.current = true; }
      } catch (err) { console.error("Answer error:", err); }
      finally { settingRemoteAnswerPendingRef.current = false; }
    };

    const handleIce = async ({ candidate }) => {
      if (!candidate || !mounted) return;
      const candidateInfo = describeIceCandidate(candidate.candidate);
      logVideoEvent("ice_candidate_received", candidateInfo);
      if (!pc.remoteDescription) {
        if (ignoreOfferRef.current) {
          console.info("Dropping ICE candidate for ignored colliding offer.");
          return;
        }
        pendingRemoteCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (ignoreOfferRef.current) {
          console.info("Ignoring ICE candidate rejected after offer collision:", err.message);
          return;
        }
        console.warn("ICE candidate rejected:", err.message);
      }
    };

    const handleIceRestartRequest = async () => {
      if (!mounted || isDoctor || !isReadyRef.current) return;
      console.info("Peer requested ICE restart.");
      logVideoEvent("ice_restart_request_received", {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      await createAndSendOffer({ iceRestart: true });
    };

    const handlePeerJoined = () => {
      if (mounted) {
        peerJoinedRef.current = true;
        setPeerJoined(true);
        setPeerLeft(false);
        if (isReadyRef.current && !inCallRef.current) startConnectionWatchdog();
        if (!isDoctor && isReadyRef.current) {
          window.setTimeout(() => {
            if (!mounted || pc.signalingState === "closed") return;
            if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
            void createAndSendOffer({ iceRestart: inCallRef.current });
          }, 300);
        }
      }
    };

    const handleParticipantLeft = () => {
      if (mounted) {
        peerJoinedRef.current = false;
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
      if (["complete", "completed"].includes(status) && !isDoctor) {
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
    socket.on("ice-restart-request", handleIceRestartRequest);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("participant-left", handleParticipantLeft);
    socket.on("appointment-message", handleChatMessage);
    socket.on("appointment-chat-history", handleChatHistory);
    socket.on("appointment-updated", handleApptUpdated);
    socket.on("new-prescription", handleNewPrescription);
    socket.on("room-access-denied", handleRoomDenied);

    const joinRoom = () => {
      emitOnlineAndJoinRoom();
    };

    const handleSocketDisconnect = () => {
      joinedSocketIdRef.current = "";
      if (!mounted) return;
      logVideoEvent("socket_disconnected_during_call", { inCall: inCallRef.current });
      setConnectionState("disconnected");
      setIsRemoteConnected(false);
    };

    const handleSocketReconnect = () => {
      if (!mounted) return;
      joinedSocketIdRef.current = "";
      joinRoom();
      logVideoEvent("socket_reconnected_during_call", {
        inCall: inCallRef.current,
        role: isDoctor ? "doctor" : "user",
      });
      if (isDoctor) {
        window.setTimeout(() => {
          if (!mounted || !socket.connected || pc.signalingState === "closed") return;
          if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
          requestPeerIceRestart();
        }, 500);
        return;
      }
      if (!isDoctor && isReadyRef.current) {
        window.setTimeout(() => {
          if (!mounted || !socket.connected || pc.signalingState === "closed") return;
          if (pc.connectionState === "connected" || pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") return;
          void createAndSendOffer({ iceRestart: inCallRef.current });
        }, 500);
      }
    };

    if (socket.connected && !socketAuthRefreshedRef.current) {
      socketAuthRefreshedRef.current = true;
      socket.disconnect();
      socket.connect();
    } else if (socket.connected) {
      joinRoom();
    } else {
      socketAuthRefreshedRef.current = true;
      socket.connect();
    }
    socket.on("connect", joinRoom);
    socket.on("disconnect", handleSocketDisconnect);
    socket.io.on("reconnect", handleSocketReconnect);

    return () => {
      mounted = false;
      resolveLocalReady(false);
      clearTimeout(iceRestartTimerRef.current);
      clearTimeout(connectionFailTimerRef.current);
      clearTimeout(ignoreOfferResetTimerRef.current);
      iceRestartTimerRef.current = null;
      ignoreOfferResetTimerRef.current = null;
      restartRequestInFlightRef.current = false;
      if (joinedSocketIdRef.current && socket.connected && !pageUnloadingRef.current) {
        socket.emit("leave-appointment-room", { appointmentId });
      }
      socket.off("connect", joinRoom);
      socket.off("disconnect", handleSocketDisconnect);
      socket.io.off("reconnect", handleSocketReconnect);
      socket.off("video-offer", handleOffer);
      socket.off("video-answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("ice-restart-request", handleIceRestartRequest);
      socket.off("peer-joined", handlePeerJoined);
      socket.off("participant-left", handleParticipantLeft);
      socket.off("appointment-message", handleChatMessage);
      socket.off("appointment-chat-history", handleChatHistory);
      socket.off("appointment-updated", handleApptUpdated);
      socket.off("new-prescription", handleNewPrescription);
      socket.off("room-access-denied", handleRoomDenied);
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      screenStreamRef.current = null;
      pendingRemoteCandidatesRef.current = [];
      joinedSocketIdRef.current = "";
      peerJoinedRef.current = false;
      ignoreOfferRef.current = false;
      screenSharingRef.current = false;
      screenShareStartInProgressRef.current = false;
      screenShareStopInProgressRef.current = false;
      clearInterval(callTimerRef.current);
    };
  }, [appt, canJoinConsultation, appointmentId, assignStreams, playAssignedVideos, isDoctor, attachLocalMediaStream, emitOnlineAndJoinRoom, logVideoEvent]);

  // ── Call timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (inCall) {
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
    }
    return () => clearInterval(callTimerRef.current);
  }, [inCall]);

  // ── Session keep-alive: a live call has no mouse/keyboard activity and
  // no other API traffic, so the inactivity timer (client + server) and the
  // short-lived access token can expire mid-consultation, forcing a logout
  // that gets misread as "Access Denied" and auto-completes the session.
  // Refresh on a cadence well under both timeouts to keep the session alive
  // for as long as the call is actually in progress.
  useEffect(() => {
    if (!inCall) return;
    const heartbeat = setInterval(() => {
      api.post("/api/auth/refresh").catch(() => { });
    }, 4 * 60 * 1000);
    return () => clearInterval(heartbeat);
  }, [inCall]);

  // ── Controls ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setIsMuted(next);
  }, []);

  const toggleCamera = useCallback(() => {
    const next = !isCamOffRef.current;
    isCamOffRef.current = next;
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setIsCamOff(next);
  }, []);

  const getVideoSender = useCallback((pc) => {
    return getSenderForKind(pc, "video");
  }, []);

  const restoreCameraAfterScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    const sender = getVideoSender(pc);

    if (camTrack) {
      setTrackHint(camTrack, "detail");
    }

    if (sender) {
      await sender.replaceTrack(camTrack);
      if (camTrack) {
        await tuneSenderQuality(sender, {
          maxBitrate: BITRATE_PROFILE.cameraVideo,
          maxFramerate: 30,
          maintainResolution: true,
        });
      }
    }

    assignStreams(isSwappedRef.current);
  }, [assignStreams, getVideoSender]);

  const stopScreenShare = useCallback(async ({ stopTracks = true } = {}) => {
    if (screenShareStopInProgressRef.current) return;
    screenShareStopInProgressRef.current = true;

    const screenStream = screenStreamRef.current;
    screenStreamRef.current = null;

    try {
      if (screenStream) {
        screenStream.getTracks().forEach((track) => {
          track.onended = null;
          if (stopTracks && track.readyState !== "ended") track.stop();
        });
      }
      await restoreCameraAfterScreenShare();
      logVideoEvent("screen_share_stopped", { stopTracks });
    } catch (err) {
      console.error("Camera restore after screen share failed:", err);
      logVideoEvent("screen_share_restore_failed", { message: err.message });
      showInlineMessage("Screen sharing stopped, but camera could not be restored. Toggle the camera or rejoin the call.");
    } finally {
      screenSharingRef.current = false;
      setIsScreenSharing(false);
      screenShareStartInProgressRef.current = false;
      screenShareStopInProgressRef.current = false;
    }
  }, [logVideoEvent, restoreCameraAfterScreenShare, showInlineMessage]);

  const startScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || screenSharingRef.current || screenShareStartInProgressRef.current || screenShareStopInProgressRef.current) return;

    if (!canUseScreenShare()) {
      showInlineMessage("Screen sharing is not supported on this browser or device.");
      return;
    }

    const sender = getVideoSender(pc);
    if (!sender) {
      showInlineMessage("Screen sharing requires an active video sender. Enable camera first, then try again.");
      return;
    }

    let screen = null;
    screenShareStartInProgressRef.current = true;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screen.getVideoTracks()[0];
      if (!screenTrack) {
        screen.getTracks().forEach((track) => track.stop());
        showInlineMessage("No screen video track was shared by the browser.");
        return;
      }
      setTrackHint(screenTrack, "detail");
      await sender.replaceTrack(screenTrack);
      await tuneSenderQuality(sender, {
        maxBitrate: BITRATE_PROFILE.screenShareVideo,
        maxFramerate: 30,
        maintainResolution: true,
      });

      screenStreamRef.current = screen;
      screenSharingRef.current = true;
      setIsScreenSharing(true);
      if (pipVideoRef.current) pipVideoRef.current.srcObject = screen;
      logVideoEvent("screen_share_started", {
        displaySurface: screenTrack.getSettings?.().displaySurface || "unknown",
      });

      screenTrack.onended = () => {
        void stopScreenShare({ stopTracks: false });
      };
    } catch (err) {
      screen?.getTracks().forEach((track) => {
        track.onended = null;
        if (track.readyState !== "ended") track.stop();
      });
      try {
        await restoreCameraAfterScreenShare();
      } catch (restoreErr) {
        console.error("Camera restore after failed screen share start failed:", restoreErr);
      }
      if (err.name !== "NotAllowedError") {
        console.error("Screen share error:", err);
        logVideoEvent("screen_share_failed", { name: err.name, message: err.message });
        showInlineMessage("Screen sharing could not be started on this device.");
      }
    } finally {
      screenShareStartInProgressRef.current = false;
    }
  }, [getVideoSender, logVideoEvent, restoreCameraAfterScreenShare, showInlineMessage, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (screenSharingRef.current) {
      void stopScreenShare();
      return;
    }
    void startScreenShare();
  }, [startScreenShare, stopScreenShare]);

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

  useEffect(() => {
    if (isSelfViewMinimized) return;

    const frameId = requestAnimationFrame(() => {
      if (!pipVideoRef.current) return;

      if (isScreenSharing && !isSwapped && screenStreamRef.current) {
        pipVideoRef.current.srcObject = screenStreamRef.current;
      } else {
        assignStreams(isSwapped);
      }

      pipVideoRef.current.play?.().catch(() => { });
    });

    return () => cancelAnimationFrame(frameId);
  }, [isSelfViewMinimized, isScreenSharing, isSwapped, assignStreams]);

  const toggleFullscreen = useCallback(async () => {
    const pageEl = pageRef.current;
    if (!pageEl) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (pageEl.requestFullscreen) {
        await pageEl.requestFullscreen();
      } else if (isIPhoneSafari()) {
        showInlineMessage("Full screen is not available for this call layout on iPhone Safari.");
      } else {
        showInlineMessage("Full screen is not supported by this browser.");
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
      logVideoEvent("fullscreen_failed", { message: err.message });
      showInlineMessage("Full screen could not be started on this device.");
    }
  }, [logVideoEvent, showInlineMessage]);

  const leaveCall = useCallback(() => {
    if (completing) return;
    setEndCallConfirm(false);
    performCleanup();
    navigate(isDoctor ? "/doctor-dashboard/patients" : "/user/dashboard", { replace: true });
  }, [completing, isDoctor, performCleanup, navigate]);

  const completeAppointment = useCallback(async () => {
    if (!isDoctor || completing) return;
    setEndCallConfirm(false);
    setCompleting(true);
    try {
      if (["assigned", "confirmed"].includes(appt?.status)) {
        await api.put(`/api/appointments/${appointmentId}/complete`);
      }
      performCleanup();
      navigate("/doctor-dashboard/patients", { replace: true });
    } catch (err) {
      setCompleting(false);
      setInlineError(err.response?.data?.msg || "Failed to complete appointment. Please try again.");
      setTimeout(() => setInlineError(""), 5000);
    }
  }, [completing, isDoctor, appt?.status, appointmentId, performCleanup, navigate]);

  const retryMediaPermissions = useCallback(async () => {
    if (retryingMedia) return;
    const pc = pcRef.current;
    if (!pc || pc.signalingState === "closed") {
      setCamError(true);
      setCamErrorReason("The call connection is no longer active. Rejoin the consultation and try again.");
      return;
    }

    setRetryingMedia(true);
    setCamError(false);
    setDeviceCheck((prev) => ({ ...prev, status: "checking" }));

    try {
      const summary = await getDeviceCheckSummary();
      setDeviceCheck({ ...summary, status: "checking" });
      logVideoEvent("media_retry_started", summary);

      const stream = await getConsultationMediaStream();
      await attachLocalMediaStream(stream, pc);

      setIsReady(true);
      isReadyRef.current = true;
      setCamError(false);
      setCamErrorReason("");
      setDeviceCheck((prev) => ({ ...prev, status: "ready" }));
      logVideoEvent("media_retry_succeeded", {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      emitOnlineAndJoinRoom();

      if (pc.signalingState === "have-remote-offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("video-answer", { appointmentId, answer: pc.localDescription });
      }
    } catch (err) {
      setCamError(true);
      setCamErrorReason(mediaErrorMessage(err));
      setDeviceCheck((prev) => ({ ...prev, status: "failed" }));
      logVideoEvent("media_retry_failed", { name: err.name, message: err.message });
    } finally {
      setRetryingMedia(false);
    }
  }, [appointmentId, attachLocalMediaStream, emitOnlineAndJoinRoom, logVideoEvent, retryingMedia]);

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
      if (!prev) setNotesOpen(false);
      if (!prev) setUnreadCount(0);
      chatOpenRef.current = !prev;
      return !prev;
    });
  }, []);

  const saveNotes = useCallback(async ({ manual = false } = {}) => {
    if (!isDoctor || !appointmentId || !notesLoaded) return;

    const next = {
      content: noteContent,
    };
    const previous = lastSavedNoteRef.current;
    if (!manual && previous.content === next.content) return;

    setNotesSaving(true);
    setNotesError("");
    try {
      const res = await api.put(`/api/notes/appointment/${appointmentId}`, next);
      const saved = res.data?.note;
      setNotesSavedAt(saved?.updatedAt || new Date().toISOString());
      lastSavedNoteRef.current = next;
    } catch (err) {
      setNotesError(err.response?.data?.msg || "Could not save notes.");
    } finally {
      setNotesSaving(false);
    }
  }, [isDoctor, appointmentId, notesLoaded, noteContent]);

  useEffect(() => {
    if (!isDoctor || !notesLoaded) return;

    const previous = lastSavedNoteRef.current;
    if (previous.content === noteContent) return;

    const timer = setTimeout(() => {
      saveNotes();
    }, 1200);

    return () => clearTimeout(timer);
  }, [isDoctor, notesLoaded, noteContent, saveNotes]);

  const toggleNotes = useCallback(() => {
    setNotesOpen((prev) => {
      const next = !prev;
      if (next) setChatOpen(false);
      return next;
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
      const uploaded = await uploadFileDirectToS3(file);
      socket.emit("appointment-message", {
        appointmentId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: "",
        fileUrl: uploaded.key,
        fileName: uploaded.name ?? file.name,
        fileType: uploaded.type ?? file.type,
      });
    } catch (err) {
      setInlineError(err.response?.data?.msg || err.message || "File upload failed.");
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
        <p>Loading appointment...</p>
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

  if (!canJoinConsultation && ["pending", "requested", "upcoming", "assigned"].includes(appt?.status)) {
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

  if (["complete", "completed"].includes(appt?.status) || appt?.status === "cancelled") {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">
          {["complete", "completed"].includes(appt.status) ? <FiCheckCircle /> : <FiX />}
        </div>
        <h2>Appointment {["complete", "completed"].includes(appt.status) ? "Complete" : "Cancelled"}</h2>
        <p>This appointment is no longer active.</p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  // ── PiP position style ────────────────────────────────────────────
  const pipStyle = pipPos.x !== null
    ? { position: "fixed", left: `${pipPos.x}px`, top: `${pipPos.y}px`, right: "auto", bottom: "auto" }
    : {};
  const screenShareSupported = canUseScreenShare();

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
              {isDoctor ? "Leave or Complete?" : "Leave Call?"}
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8" }}>
              {isDoctor
                ? "Leave only exits the video call. Complete Appointment will mark the consultation complete."
                : "You will leave the video call. The doctor will be notified."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setEndCallConfirm(false)}
                style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >Stay</button>
              <button
                onClick={leaveCall}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >Leave Call</button>
              {isDoctor && (
                <button
                  onClick={completeAppointment}
                  disabled={completing}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: completing ? "not-allowed" : "pointer", opacity: completing ? 0.7 : 1 }}
                >{completing ? "Completing..." : "Complete Appointment"}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {deviceCheck.status !== "idle" && deviceCheck.status !== "ready" && (
        <div style={{
          position: "fixed", top: inlineError ? 72 : 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: deviceCheck.status === "failed" ? "#fef2f2" : "#eff6ff",
          border: `1px solid ${deviceCheck.status === "failed" ? "#fca5a5" : "#93c5fd"}`,
          color: deviceCheck.status === "failed" ? "#dc2626" : "#1d4ed8",
          borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {deviceCheck.status === "checking" ? <FiRefreshCw /> : <FiAlertTriangle />}
          {deviceCheck.status === "checking"
            ? "Checking camera and microphone..."
            : "Device check failed. Review browser permissions and retry."}
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
                  performCleanup();
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
            <p className="hc-vc__completed-sub">Redirecting to your dashboard...</p>
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
      <div className={`hc-vc__body ${chatOpen || notesOpen ? "hc-vc__body--chat" : ""}`}>

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
                  {peerJoined ? "Establishing secure connection..." : `Waiting for ${isDoctor ? "patient" : "doctor"}...`}
                </p>
                <p className="hc-vc__waiting-sub">
                  {peerJoined
                    ? "Both participants are ready. Video starting soon."
                    : "Share the appointment link with the other person to begin."}
                </p>
              </div>
            )}

            {playbackBlocked && (
              <button
                type="button"
                className="hc-vc__playback-unblock"
                onClick={() => void playAssignedVideos()}
              >
                Tap to resume audio/video
              </button>
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
              {isDoctor ? "Patient" : "Doctor"} joined - connecting...
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
                placeholder="Type a message..."
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

        {/* ── Doctor notes panel ────────────────────────────────── */}
        {notesOpen && isDoctor && (
          <div className="hc-vc__notes">
            <div className="hc-vc__notes-head">
              <div className="hc-vc__notes-head-left">
                <span className="hc-vc__notes-icon"><FiFileText /></span>
                <span className="hc-vc__notes-title">Consultation Notes</span>
              </div>
              <button className="hc-vc__notes-close-btn" onClick={toggleNotes}><FiX /></button>
            </div>

            <div className="hc-vc__notes-meta">
              <span>{otherParty?.name || "Patient"}</span>
              <span>{notesSaving ? "Saving..." : notesSavedAt ? `Saved ${fmtTime(notesSavedAt)}` : "Not saved yet"}</span>
            </div>

            {notesError && (
              <div className="hc-vc__notes-error">
                <FiAlertTriangle /> {notesError}
              </div>
            )}

            <textarea
              className="hc-vc__notes-textarea"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={notesLoading ? "Loading notes..." : "Write consultation observations, assessment, plan, and follow-up notes..."}
              disabled={notesLoading}
              maxLength={20000}
            />

            <div className="hc-vc__notes-foot">
              <span>{noteContent.length}/20000</span>
              <button
                className="hc-vc__notes-save"
                onClick={() => saveNotes({ manual: true })}
                disabled={notesLoading || notesSaving}
              >
                {notesSaving ? <FiRefreshCw /> : <FiCheckCircle />}
                <span>{notesSaving ? "Saving" : "Save"}</span>
              </button>
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
            disabled={!isReady || (!isScreenSharing && !screenShareSupported)}
            title={
              !screenShareSupported
                ? "Screen sharing is not supported on this browser"
                : isScreenSharing
                  ? "Stop sharing"
                  : "Share screen"
            }
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

          {isDoctor && (
            <button
              className={`hc-vc__btn ${notesOpen ? "hc-vc__btn--notes-on" : ""}`}
              onClick={toggleNotes}
              title="Consultation notes"
            >
              <span className="hc-vc__btn-icon"><FiFileText /></span>
              <span className="hc-vc__btn-label">Notes</span>
            </button>
          )}



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
            title={isDoctor ? "Leave or complete appointment" : "Leave call"}
          >
            <span className="hc-vc__btn-icon">{completing ? <FiRefreshCw /> : <FiPhoneOff />}</span>
            <span className="hc-vc__btn-label">{completing ? "Completing..." : "Leave Call"}</span>
          </button>
        </div>
      </div>
      {/* Cam error banner */}
      {camError && (
        <div className="hc-vc__error-bar">
          <FiAlertTriangle /> {camErrorReason || "Camera or microphone access denied. Check browser permissions and retry."}
          <button
            onClick={retryMediaPermissions}
            disabled={retryingMedia}
            style={{
              marginLeft: 12, padding: "4px 12px", borderRadius: 6,
              background: "#fff", color: "#dc2626", border: "none",
              fontWeight: 700, cursor: retryingMedia ? "not-allowed" : "pointer",
              opacity: retryingMedia ? 0.7 : 1,
            }}
          >
            {retryingMedia ? "Retrying..." : "Retry"}
          </button>
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
