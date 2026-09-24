import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import socket from "../socket";
import api from "../api";
import {
  RTC_CONFIG,
  RTC_CONFIG_ERROR,
  sanitizeIceServers,
  validateIceServers,
  hasTurnServer,
} from "../utils/rtcIceConfig";
import "./videocall.css";
import "./directvideocall.css";
import HumancareLogo from "../assets/VideoCallingImage.png";
import { retryDebugLog, retryDebugPollInboundVideoStats } from "../utils/retryDebug";
import { extractDtlsFingerprint } from "../utils/webrtcSdp";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiPhoneOff,
  FiMessageSquare,
  FiSend,
  FiX,
  FiAlertTriangle,
  FiUser,
  FiClock,
  FiWifi,
  FiMaximize,
  FiMaximize2,
  FiMinimize,
  FiMinimize2,
  FiRefreshCw,
} from "react-icons/fi";

const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: "user",
  },
};

const mediaErrorMessage = (err) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Your browser blocked camera/microphone access because this page isn't loaded over a secure (HTTPS) connection.";
  }
  switch (err?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera/microphone permission was denied. You can still join without them, or allow access and retry.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera or microphone was found on this device. You can still join without them.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your camera or microphone is already in use by another app. Close it and retry.";
    default:
      return "Camera or microphone access failed. You can still join without them.";
  }
};

async function getCallMediaStream() {
  try {
    return await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: true,
      });
    } catch (secondErr) {
      const partialStream = new MediaStream();
      let lastErr = secondErr;
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: MEDIA_CONSTRAINTS.video,
        });
        videoOnly.getTracks().forEach((track) => partialStream.addTrack(track));
      } catch (videoErr) {
        lastErr = videoErr;
      }
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: MEDIA_CONSTRAINTS.audio,
          video: false,
        });
        audioOnly.getTracks().forEach((track) => partialStream.addTrack(track));
      } catch (audioErr) {
        lastErr = audioErr;
      }
      if (partialStream.getTracks().length > 0) return partialStream;
      throw lastErr;
    }
  }
}

const ROOM_ERROR_MESSAGES = {
  not_found: "This meeting link is invalid.",
  expired: "This meeting link has expired.",
  closed: "This meeting has ended.",
  full: "This meeting already has two participants.",
  invalid: "This meeting link is invalid.",
  server_error: "Something went wrong while checking this link. Please try again.",
};

const NAME_STORAGE_KEY = "dvc-guest-name";

function getOrCreateGuestId(roomId) {
  const key = `dvc-guest-id-${roomId}`;
  let id = "";
  try {
    id = sessionStorage.getItem(key) || "";
  } catch {
    id = "";
  }
  if (!id) {
    id = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      sessionStorage.setItem(key, id);
    } catch {
      // Storage unavailable (private mode, etc.) — fine, id just won't persist across a refresh.
    }
  }
  return id;
}

const fmtDuration = (secs) => {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const fmtTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Chat messages here have no server-issued id — array-index keys were being
// used for the message list, fine only while messages are strictly appended.
// Tag each message with a stable client-side key at the moment it enters state.
const makeMessageKey = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Tags each offer so a stale/replayed answer (e.g. a redelivered socket
// event across a reconnect) can be told apart from a genuine fresh one —
// see handleAnswer's offerId correlation, mirrored from VideoCall.jsx.
const makeOfferId = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `offer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// First line of defense against a stuck Enter key / paste-loop flooding
// chat — the server has its own rate limit (see backend/utils/socketRateLimit.js),
// this just keeps the UI itself from firing faster than a human can type.
const CHAT_SEND_COOLDOWN_MS = 300;

const CONNECTION_STATS_INTERVAL_MS = 5000;

// Reconnection tuning — mirrors VideoCall.jsx's ICE_RESTART_DELAY_MS /
// ICE_MAX_RECOVERY_ATTEMPTS / ICE_RECOVERY_COOLDOWN_MS / OFFER_ANSWER_TIMEOUT_MS
// constants, so a guest-link call self-heals from a dropped connection with
// the same resilience as an authenticated appointment call instead of only
// waiting on the peer to ask for (or perform) an ICE restart.
const ICE_RESTART_DELAY_MS = 2500;
const ICE_MAX_RECOVERY_ATTEMPTS = 4;
const ICE_RECOVERY_COOLDOWN_MS = 30000;
// How long to wait for a video-answer after sending an offer before treating
// it as lost — without this, a dropped/never-arriving answer leaves the
// offer sender stuck in "have-local-offer" forever, since nothing else ever
// rolls back a self-initiated offer. See VideoCall.jsx's identical constant.
const OFFER_ANSWER_TIMEOUT_MS = 8000;
// A stashed remote offer older than this is stale: the sender has long since
// rolled it back (its own OFFER_ANSWER_TIMEOUT_MS) and moved on, so answering
// it after a rebuild only produces an orphaned answer on their side. Mirrors
// VideoCall.jsx's PENDING_OFFER_MAX_AGE_MS.
const PENDING_OFFER_MAX_AGE_MS = 15000;
// How long a disconnected/failed connection state is given to self-heal
// (via the ICE-restart machinery above) before surfacing a manual "Retry"
// escape hatch to the user.
const RECONNECT_STALL_MS = 12000;
// After this many reconnect-stall episodes in a row without a successful
// reconnect in between, stop implying "still working on it" and offer an
// explicit way to end the call instead of retrying silently forever.
const MAX_RECONNECT_STALL_RETRIES = 3;
// How long the first WebRTC connection is given to reach "connected" before
// it's treated as stalled and the ICE-restart machinery is kicked. Without
// this, a first handshake that never completes but also never emits an
// explicit ICE "failed" (no TURN path, dropped SDP, offer glare, ICE stuck
// in "checking") leaves the call sitting on "Connecting…" forever with no
// recovery and no UI. Mirrors VideoCall.jsx's CONNECTION_FAIL_TIMEOUT_MS.
const CONNECTION_FAIL_TIMEOUT_MS = 25000;

// How much grace a freshly-built pc gets before an unhealthy state is worth
// tearing it down over. Without this, a duplicate/rapid "peer joined" signal
// (e.g. a signaling-level reconnect firing twice) can tear down and rebuild
// a pc that's only milliseconds old and still simply negotiating — never
// giving any single attempt a real chance to connect. Mirrors VideoCall
// .jsx's identical REBUILD_GRACE_MS.
const REBUILD_GRACE_MS = 3000;
// An orphaned answer (offerId mismatch, or arriving while not in
// "have-local-offer") is normal fallout from ordinary offer/answer glare in
// perfect negotiation — most resolve themselves via the collision/rollback
// logic already in handleOffer/handleAnswer. Only treat it as a sign of a
// genuinely broken session if the pc is *still* unhealthy this long after.
const ORPHANED_ANSWER_RECHECK_MS = 4000;
// Inbound-media watchdog (requestPcRebuild's "stall" trigger): how often two
// zero-growth samples in a row (see startStatsCollection) must span before
// being treated as a real stall, how long a pc may sit in "new"/"connecting"
// after negotiation before that alone counts as stalled, and how long to
// stay quiet after any automatic rebuild before evaluating stats again (a
// freshly rebuilt pc needs real time to reconnect and start flowing media,
// and re-triggering off its own still-connecting state would be the exact
// rebuild-loop this cooldown exists to prevent).
const MEDIA_STALL_NEVER_CONNECTED_MS = 10000;
const MEDIA_STALL_COOLDOWN_MS = 25000;
// Rate limit on *automatic* rebuilds only — manual Retry (forceReconnect) is
// deliberately exempt, since a person tapping the button is explicit intent,
// not a runaway loop.
const AUTO_REBUILD_MAX_COUNT = 3;
const AUTO_REBUILD_WINDOW_MS = 60000;

// Last-resort ICE config. RTC_CONFIG (built from VITE_RTC_* at build time) is
// null when VITE_RTC_ICE_SERVERS_JSON is malformed — without this guard that
// would reach `new RTCPeerConnection(null)`, i.e. host candidates only and
// LAN-only calls, with no signal. A public-STUN config still traverses most
// NATs and is a safe floor.
const STUN_ONLY_FALLBACK = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

// Short-lived TURN credentials minted by the backend for this specific room
// (see GET /api/direct-video-room/:roomId/ice-servers) — the same approach
// the appointment VideoCall page uses, kept independent since guests here
// have no authenticated identity to gate that page's endpoint on. Falls back
// to the static RTC_CONFIG (built from VITE_RTC_TURN_* at build time), then to
// public STUN, if the fetch fails or is unreachable — so a backend hiccup
// degrades rather than blocks the call.
// A momentary network blip on this one round trip shouldn't be able to
// permanently degrade the call to STUN-only — retry once with a short backoff
// before giving up, like VideoCall.jsx does. Only *request* failures are
// retried; a response that came back but doesn't validate is a persistent
// server-side config problem, so that's reported and falls straight through
// to the static fallback rather than being retried pointlessly.
const ICE_FETCH_RETRY_DELAYS_MS = [1200];

async function fetchDirectRoomIceConfig(roomId) {
  for (let attempt = 0; attempt <= ICE_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await api.get(`/api/direct-video-room/${roomId}/ice-servers`, { timeout: 6000 });
      const iceServers = sanitizeIceServers(res.data?.iceServers);
      const validationError = validateIceServers(iceServers);
      if (!validationError && iceServers.length) {
        return {
          iceServers,
          iceCandidatePoolSize: RTC_CONFIG?.iceCandidatePoolSize ?? 10,
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        };
      }
      console.error(
        "[direct-video-call] /ice-servers returned an unusable config — using static fallback:",
        validationError || "no ICE servers in response",
      );
      break;
    } catch (err) {
      const nextDelay = ICE_FETCH_RETRY_DELAYS_MS[attempt];
      if (nextDelay === undefined) {
        console.warn(
          "[direct-video-call] /ice-servers fetch failed, falling back to static config:",
          err.message,
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, nextDelay));
    }
  }
  if (!RTC_CONFIG) {
    console.error(
      "[direct-video-call] No usable build-time ICE config" +
        (RTC_CONFIG_ERROR ? ` (${RTC_CONFIG_ERROR})` : "") +
        " — falling back to public STUN only. Calls across strict NATs may fail.",
    );
    return STUN_ONLY_FALLBACK;
  }
  return RTC_CONFIG;
}

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

// Tracks a <video> element's intrinsic frame shape so the UI can switch
// object-fit from cover to contain for portrait streams (e.g. a guest
// holding a phone upright). "resize" fires whenever the underlying track's
// dimensions change (device rotation, camera renegotiation), not just once.
const watchVideoOrientation = (videoEl, onOrientationChange) => {
  if (!videoEl) return () => {};
  const update = () => {
    const { videoWidth, videoHeight } = videoEl;
    if (videoWidth && videoHeight) {
      onOrientationChange(videoHeight > videoWidth);
    }
  };
  update();
  videoEl.addEventListener("loadedmetadata", update);
  videoEl.addEventListener("resize", update);
  return () => {
    videoEl.removeEventListener("loadedmetadata", update);
    videoEl.removeEventListener("resize", update);
  };
};

// Turns raw WebRTC stats into a coarse, user-facing quality bucket. Inbound
// packet loss is derived from the DELTA between this poll and the previous
// one (not the raw cumulative counter) — using the cumulative value directly
// would mean a single lost packet early in a long call marks the connection
// "poor" for its entire remaining duration. packetsLost / packetsReceived
// come from the inbound-rtp reports (they don't exist on candidate-pair).
const deriveConnectionQuality = (diagnostics, previousSample) => {
  if (diagnostics.rtt === null) return "unknown";

  let lossRatio = 0;
  if (previousSample) {
    const deltaReceived = diagnostics.packetsReceived - previousSample.packetsReceived;
    const deltaLost = diagnostics.packetsLost - previousSample.packetsLost;
    if (deltaLost > 0 && deltaReceived + deltaLost > 0) {
      lossRatio = deltaLost / (deltaReceived + deltaLost);
    }
  }

  if (diagnostics.rtt > 400 || lossRatio > 0.08) return "poor";
  if (diagnostics.rtt > 200 || lossRatio > 0.03) return "weak";
  return "good";
};

export default function DirectVideoCall() {
  const { roomId } = useParams();
  const guestIdRef = useRef(getOrCreateGuestId(roomId));

  // stage: checking -> prejoin -> call -> ended | error
  const [stage, setStage] = useState("checking");
  const [errorInfo, setErrorInfo] = useState(null); // { code, msg }
  const [endedReason, setEndedReason] = useState("left"); // "left" | "closed"
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem(NAME_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [previewMicOn, setPreviewMicOn] = useState(true);
  const [previewCamOn, setPreviewCamOn] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [joining, setJoining] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [nameError, setNameError] = useState("");
  // Advisory only — the room's /status check reported two participants
  // already present. The socket join is still the real gate (a returning
  // guest reclaiming their own seat is admitted regardless).
  const [roomFullHint, setRoomFullHint] = useState(false);

  const [callStatus, setCallStatus] = useState("waiting"); // waiting | connecting | connected | reconnecting
  const [peerLeftNotice, setPeerLeftNotice] = useState(false);
  const [peerName, setPeerName] = useState("");
  // Guards an accidental exit (mobile back-swipe / gesture, tab close) from
  // silently dropping the call — the user has to confirm.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [duration, setDuration] = useState(0);
  const [chatSendCoolingDown, setChatSendCoolingDown] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  // ── Stage/UI extras — same visual language as the main VideoCall screen ──
  const [isSwapped, setIsSwapped] = useState(false);
  const [isSelfViewMinimized, setIsSelfViewMinimized] = useState(false);
  const [isMainVideoPortrait, setIsMainVideoPortrait] = useState(false);
  const [isPipVideoPortrait, setIsPipVideoPortrait] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("unknown");
  const [pipPos, setPipPos] = useState({ x: null, y: null });
  // True when the call has no local audio track to publish (mic denied, in
  // use by another app, or no mic on the device) — surfaced so the guest
  // isn't left believing they're audible when they aren't.
  const [localAudioMissing, setLocalAudioMissing] = useState(false);
  // In-call "retry camera/microphone" — for a guest who joined with a device
  // denied/busy and has since fixed it, without making them leave and rejoin.
  const [retryingInCallMedia, setRetryingInCallMedia] = useState(false);
  const retryingInCallMediaRef = useRef(false);
  // True when the ICE config in use has no TURN relay (backend misconfigured
  // / unreachable and we fell back to STUN-only). The call can still work on
  // permissive networks, but will fail across strict NATs — tell the guest
  // rather than letting it silently hang on "Connecting…".
  const [iceRelayWarning, setIceRelayWarning] = useState(false);

  const previewVideoRef = useRef(null);
  const nameInputRef = useRef(null);
  const mainVideoRef = useRef(null);
  const pipVideoRef = useRef(null);
  // Dedicated, always-mounted sink for the remote party's audio. Both <video>
  // elements are kept muted; remote audio plays only through this element, so
  // swapping the view or hiding the self-view (which unmounts a <video>)
  // can't cut the other person's voice. Mirrors VideoCall.jsx.
  const remoteAudioRef = useRef(null);
  const mainVideoOrientationCleanupRef = useRef(null);
  const pipVideoOrientationCleanupRef = useRef(null);
  const localStreamRef = useRef(null);
  // The in-flight getCallMediaStream() promise from the pre-join preview.
  // Step 3 (the call) awaits this so a guest who clicks "Join now" before
  // capture finishes still gets their tracks published instead of racing the
  // preview effect's teardown.
  const localMediaPromiseRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const pcRef = useRef(null);
  // Monotonic token for setupPeerConnection runs. It now awaits the ICE-server
  // fetch and local-media capture before assigning pcRef.current, so a peer
  // leave/rejoin (or forceReconnect / teardown) can happen mid-build — those
  // bump this, and the in-flight run bails at its next checkpoint instead of
  // creating a second, orphaned RTCPeerConnection.
  const pcSetupGenerationRef = useRef(0);
  // Guards requestPcRebuild against overlapping rebuilds — every automatic
  // rebuild trigger (fingerprint mismatch, InvalidAccessError, an unhealthy
  // resumed pc, an orphaned answer, a stalled media watchdog) and manual
  // Retry all serialize through it. Not diagnostic-only: this is real
  // reconnect-logic state, part of the fix for the "blank video after Retry"
  // bug (stale RTCPeerConnection rejecting a rebuilt peer's fresh offer with
  // an m-line-order InvalidAccessError) and the follow-up race conditions
  // (duplicate/over-eager rebuilds, orphaned answers, silent media stalls).
  const peerRebuildInProgressRef = useRef(false);
  // Guards cleanupCall against re-entrancy (e.g. a rapid double-click on
  // "Leave Call" firing two click events before React re-renders the button
  // away) — every individual step inside it is independently idempotent, but
  // running the whole sequence twice is still wasted work (a second,
  // no-op "leave-direct-room" emit, redundant timer clears) worth skipping
  // outright rather than relying on each step's own idempotency. Mirrors
  // VideoCall.jsx's completedRef guard on performCleanup.
  const cleanupDoneRef = useRef(false);
  // Latest mic/camera toggle state, readable from non-React code paths
  // (setupPeerConnection applying the pre-join choice to freshly-captured
  // tracks; the toggle handlers) without a stale closure.
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);
  const previewMicOnRef = useRef(true);
  const previewCamOnRef = useRef(true);
  const isInitiatorRef = useRef(false);
  // Set once the server tells us (via direct-room-joined) that this guest is
  // rejoining a room it was already in — keeps the "Reconnecting…" label
  // stable through the follow-up direct-peer-joined for the joining side too.
  const resumedSessionRef = useRef(false);
  // True only while the other participant is actually in the room. Gates the
  // reconnect machinery so a peer who has genuinely left can't leave us
  // firing ICE-restart offers / restart-requests into an empty room.
  const peerPresentRef = useRef(false);
  const isSwappedRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  // An offer that arrived before our RTCPeerConnection had finished being
  // built (setupPeerConnection awaits the ICE-server fetch). Replayed by
  // setupPeerConnection once ready, rather than left for the peer's
  // offer-answer watchdog to retry ~8s later.
  const pendingRemoteOfferRef = useRef(null);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const joinedRef = useRef(false);
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatSendCooldownTimerRef = useRef(null);
  const pageRef = useRef(null);
  const pipRef = useRef(null);
  const dragRef = useRef({ active: false, ox: 0, oy: 0, ex: 0, ey: 0 });
  const statsTimerRef = useRef(null);
  const lastStatsSampleRef = useRef(null);
  const iceConfigPromiseRef = useRef(null);

  // ── Reconnection state — mirrors VideoCall.jsx's equivalent refs ────────
  const iceRestartTimerRef = useRef(null);
  const iceRecoveryAttemptsRef = useRef(0);
  const lastIceRecoveryAtRef = useRef(0);
  const restartRequestInFlightRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  // Set on a disconnected/failed transition after the call has connected at
  // least once, and consumed the next time the connection reports healthy
  // again (whether via a real onconnectionstatechange "connected" event or
  // via resyncConnectionStateFromPeerConnection) — forces a remote-video
  // rebind for a recovery that reuses the SAME track (an ICE restart, or the
  // browser's own passive ICE self-healing), which never re-fires
  // pc.ontrack and would otherwise leave the <video> element frozen on its
  // last frame. Mirrors VideoCall.jsx's identical remoteRebindPendingRef.
  const remoteRebindPendingRef = useRef(false);
  // The DTLS fingerprint (see extractDtlsFingerprint, utils/webrtcSdp.js) of
  // the last remote offer this side successfully applied. Real
  // reconnect-logic state, not diagnostic: handleOffer's proactive rebuild
  // check compares an incoming offer's fingerprint against this to detect a
  // peer that tore down and rebuilt its RTCPeerConnection (its own Retry),
  // and requestPcRebuild resets it to null before rebuilding so
  // the replayed offer isn't mistaken for another rebuild — see both for
  // the full reasoning. Deliberately outside RETRY_DEBUG and outside
  // retryDebug.js: this must keep working even with debug logging disabled.
  const lastRemoteFingerprintRef = useRef(null);
  // Wall-clock time pcRef.current was constructed. Real reconnect-logic
  // state (not diagnostic-only, despite living alongside the debug refs
  // below): handlePeerJoined's rebuild gate uses this for REBUILD_GRACE_MS,
  // and the media-stall watchdog uses it for the "never connected" case.
  const pcCreatedAtRef = useRef(0);
  // ── requestPcRebuild support state ───────────────────────────────────
  // Timestamps of recent *automatic* rebuilds, for AUTO_REBUILD_MAX_COUNT /
  // AUTO_REBUILD_WINDOW_MS — see requestPcRebuild. Manual Retry
  // (forceReconnect) never reads or writes this.
  const autoRebuildTimestampsRef = useRef([]);
  // Debounces handleAnswer's "orphaned answer" recheck (see
  // scheduleOrphanedAnswerRecheck) — only one pending recheck at a time; a
  // newer orphaned answer reschedules rather than stacking a second timer.
  const orphanedAnswerCheckTimerRef = useRef(null);
  // Media-stall watchdog (startStatsCollection) state: previous sample to
  // diff against, how many consecutive zero-growth samples have been seen,
  // and a cooldown so a rebuild it triggers can't immediately re-trigger it
  // before the fresh pc has had real time to reconnect.
  const mediaStallSampleRef = useRef(null);
  const mediaStallConsecutiveCountRef = useRef(0);
  const mediaStallCooldownUntilRef = useRef(0);
  // TEMPORARY (RETRY_DEBUG): diagnostic-only state for the "blank video on
  // the other side after Retry" investigation — read/written only by
  // retryDebugLog call sites, never by call/reconnect logic. Mirrors
  // VideoCall.jsx's equivalent refs (added there first).
  const retryDebugPrevConnStateRef = useRef(null);
  const retryDebugPrevIceStateRef = useRef(null);
  // Fires if the (first) connection hasn't reached "connected" within
  // CONNECTION_FAIL_TIMEOUT_MS — see startConnectionWatchdog.
  const connectionFailTimerRef = useRef(null);
  const reconnectStallTimerRef = useRef(null);
  // How many times the stall banner has fired since the last successful
  // (re)connect — see MAX_RECONNECT_STALL_RETRIES.
  const reconnectStallCountRef = useRef(0);
  const pendingOfferIdRef = useRef(null);
  const offerAnswerTimeoutRef = useRef(null);
  const reconnectInProgressRef = useRef(false);
  const verifyingVisibilityRef = useRef(false);
  const setupPeerConnectionRef = useRef(() => {});
  // Cross-effect bridge to requestPcRebuild (defined inside the Step-3
  // effect, alongside setupPeerConnection) so forceReconnect — a plain
  // useCallback outside that effect — can route manual Retry through the
  // same serialized teardown/rebuild path every automatic trigger uses,
  // instead of duplicating its own. Same pattern as setupPeerConnectionRef.
  const requestPcRebuildRef = useRef(async () => {});
  // Re-arms the first-connect watchdog + stall banner from outside the Step-3
  // effect (forceReconnect), so a manual Retry that also stalls still
  // surfaces a way out instead of spinning silently.
  const armConnectWatchdogsRef = useRef(() => {});
  // Lets the browser's "online" event (registered outside the Step-3 effect,
  // below) nudge WebRTC recovery directly — covers a network path recovering
  // while the signaling socket itself never dropped (media/ICE and the
  // socket's transport are independent failure domains), instead of only
  // reacting to the next scheduled ICE-restart timer tick or socket
  // reconnect event.
  const kickIceRecoveryRef = useRef(() => {});
  // Same cross-effect invocation pattern as kickIceRecoveryRef just above —
  // assigned inside the Step-3 effect (where handleConnectedState and
  // remoteRebindPendingRef live) and invoked from the online/offline effect
  // below. Covers a network-interface change (e.g. Wi-Fi <-> mobile data)
  // that the RTCPeerConnection absorbs without ever leaving "connected":
  // connectionState==="connected" is proof the transport is healthy, not
  // proof the remote video renderer is still painting fresh frames — see
  // its assignment for the full reasoning. Mirrors VideoCall.jsx's
  // identical fix and the equivalent, already-applied fix in the Flutter
  // app's VideoCallController._handleNetworkInterfaceChanged.
  const networkRecoveryRef = useRef(() => {});
  // Guards the function above against overlapping runs (e.g. the browser
  // firing "online" again before the previous check's settle delay has
  // finished).
  const networkRecoveryInProgressRef = useRef(false);
  const [reconnectStalled, setReconnectStalled] = useState(false);
  // Drives the manual "Retry" button's disabled/label state (see
  // forceReconnect) — separate from reconnectInProgressRef (the actual
  // re-entrancy guard) so the UI can be read declaratively in JSX.
  const [manualReconnecting, setManualReconnecting] = useState(false);
  const manualReconnectCooldownTimerRef = useRef(null);
  // Releases both the re-entrancy guard and the banner/button's
  // "Reconnecting…" hold after a manual Retry. Called from whichever happens
  // first — the rebuilt connection becoming healthy (handleConnectedState) or
  // the 5s fallback timer — so a rebuild that never gets healthy can't leave
  // the button stuck disabled. Idempotent (checked against
  // reconnectInProgressRef itself), safe to call from both paths.
  const releaseManualReconnectGuard = useCallback(() => {
    if (!reconnectInProgressRef.current) return;
    reconnectInProgressRef.current = false;
    setManualReconnecting(false);
    clearTimeout(manualReconnectCooldownTimerRef.current);
    manualReconnectCooldownTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isSwappedRef.current = isSwapped;
  }, [isSwapped]);

  // Keep the toggle-state refs in step with their React state.
  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);
  useEffect(() => {
    previewMicOnRef.current = previewMicOn;
  }, [previewMicOn]);
  useEffect(() => {
    previewCamOnRef.current = previewCamOn;
  }, [previewCamOn]);

  // A fully offline device previously only surfaced indirectly, once the
  // socket/ICE timeouts eventually fired. Report it immediately via the
  // browser's own connectivity signal instead.
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      // Recovery was previously purely timer-driven from the moment a drop
      // was first detected, regardless of whether the network was actually
      // back by then — a restart attempt built/sent while still offline
      // carries no usable ICE candidates and is effectively wasted. "online"
      // is the most reliable signal that connectivity is genuinely restored,
      // so use it to kick an immediate recovery check (and reconnect the
      // socket right away rather than waiting out its backoff delay).
      if (!socket.connected) socket.connect();
      kickIceRecoveryRef.current();
      // Also give the remote-video renderer a chance to recover in case the
      // PeerConnection never actually left "connected" throughout — see
      // networkRecoveryRef's assignment for the full reasoning.
      networkRecoveryRef.current();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ── Step 1: validate the room link, no login required ─────────────────────
  useEffect(() => {
    let alive = true;
    api
      .get(`/api/direct-video-room/${roomId}/status`)
      .then((res) => {
        if (!alive) return;
        if (!res.data?.valid) {
          const reason = res.data?.reason || "not_found";
          setStage("error");
          setErrorInfo({ code: reason, msg: ROOM_ERROR_MESSAGES[reason] || ROOM_ERROR_MESSAGES.not_found });
          return;
        }
        setRoomFullHint(Boolean(res.data?.full));
        setStage("prejoin");
      })
      .catch((err) => {
        if (!alive) return;
        const reason = err.response?.status === 404 ? "not_found" : "server_error";
        setStage("error");
        setErrorInfo({ code: reason, msg: ROOM_ERROR_MESSAGES[reason] });
      });

    return () => {
      alive = false;
    };
  }, [roomId]);

  // ── Step 2: pre-join device preview ────────────────────────────────────────
  useEffect(() => {
    if (stage !== "prejoin") return;
    setPreviewError("");
    let cancelled = false;

    const mediaPromise = getCallMediaStream();
    localMediaPromiseRef.current = mediaPromise;

    mediaPromise
      .then((stream) => {
        // Keep the stream if the user has already committed to joining — the
        // call effect (Step 3) takes ownership of it from here. Only stop it
        // when the flow was genuinely abandoned (navigated away / retried
        // devices), which is the sole case where this effect tears down
        // without joinedRef being set.
        if (cancelled && !joinedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (!cancelled) {
          if (previewVideoRef.current) {
            // Belt-and-braces over the JSX `muted` prop — the preview shows
            // the local stream, so it must never route mic audio to speakers.
            previewVideoRef.current.muted = true;
            previewVideoRef.current.srcObject = stream;
          }
          setPreviewMicOn(stream.getAudioTracks().length > 0);
          setPreviewCamOn(stream.getVideoTracks().length > 0);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewError(mediaErrorMessage(err));
      });

    return () => {
      cancelled = true;
      // Only tear down the preview stream if the user actually abandoned the
      // flow (navigated away / retried devices) — not when we're moving
      // forward into the call, where Step 3 takes over this same stream.
      if (!joinedRef.current) {
        const stream = localStreamRef.current;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
        localMediaPromiseRef.current = null;
      }
    };
  }, [stage, previewAttempt]);

  const startCallTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopStatsCollection = useCallback(() => {
    clearInterval(statsTimerRef.current);
    statsTimerRef.current = null;
    lastStatsSampleRef.current = null;
    setConnectionQuality("unknown");
  }, []);

  // Media-stall watchdog, run from the same 5s tick as the existing quality
  // stats (reuses the one getStats() call — no separate polling loop). A pc
  // can report connectionState "connected" while inbound video has silently
  // stopped flowing (the production incident this fixes showed exactly
  // that: ICE "connected," zero inboundVideo bytes for 20+ seconds). Two
  // consecutive zero-growth samples (~10s) — or, for a pc that never
  // reaches "connected"/"completed" at all, MEDIA_STALL_NEVER_CONNECTED_MS
  // since it was built — triggers a full requestPcRebuild rather than just
  // an ICE restart, since by this point the existing ICE-restart machinery
  // has already had its own chance to run and the connection is still not
  // producing media.
  //
  // Safeguards:
  // - Audio bytes growing at all means the connection is genuinely alive
  //   (even if video is stalled for some other reason) — never rebuild.
  // - The remote video track reporting `muted` (best-effort proxy for "the
  //   peer turned their camera off," since this codebase has no dedicated
  //   camera-state signaling event — see toggleCam/camOnRef, which only
  //   ever sets `track.enabled` locally) skips the video check for that
  //   tick, on top of the audio check already covering the common case
  //   (the peer's mic keeps working even with their camera off).
  // - Only one side acts first: the initiator triggers after 2 consecutive
  //   stalled samples; the guest waits one more tick (3 consecutive, ~15s)
  //   so the initiator's own rebuild — and the fresh offer it sends — has
  //   time to arrive and resolve things first, without both sides
  //   rebuilding (and re-fingerprinting) at the same moment.
  // - MEDIA_STALL_COOLDOWN_MS after any watchdog-triggered rebuild, the
  //   watchdog goes quiet — a freshly rebuilt pc needs real time to
  //   reconnect and start flowing media again.
  const evaluateMediaStallWatchdog = useCallback(
    (pc, statsReport) => {
      if (Date.now() < mediaStallCooldownUntilRef.current) return;

      const pcAgeMs = pcCreatedAtRef.current ? Date.now() - pcCreatedAtRef.current : 0;
      let videoBytesReceived = null;
      let videoFramesDecoded = null;
      let audioBytesReceived = null;
      for (const report of statsReport.values()) {
        if (report.type !== "inbound-rtp" || report.isRemote) continue;
        if (report.kind === "video" || report.mediaType === "video") {
          videoBytesReceived = typeof report.bytesReceived === "number" ? report.bytesReceived : null;
          videoFramesDecoded = typeof report.framesDecoded === "number" ? report.framesDecoded : null;
        } else if (report.kind === "audio" || report.mediaType === "audio") {
          audioBytesReceived = typeof report.bytesReceived === "number" ? report.bytesReceived : null;
        }
      }

      const prev = mediaStallSampleRef.current;
      mediaStallSampleRef.current = { videoBytesReceived, videoFramesDecoded, audioBytesReceived };
      if (!prev) return; // first sample — nothing to diff against yet

      const audioGrew =
        typeof audioBytesReceived === "number" &&
        typeof prev.audioBytesReceived === "number" &&
        audioBytesReceived > prev.audioBytesReceived;
      if (audioGrew) {
        mediaStallConsecutiveCountRef.current = 0;
        return;
      }

      const remoteVideoTrack = remoteStreamRef.current?.getVideoTracks?.()[0];
      const remoteCameraLooksOff = remoteVideoTrack?.muted === true;

      const videoGrew =
        typeof videoBytesReceived === "number" &&
        typeof prev.videoBytesReceived === "number" &&
        (videoBytesReceived > prev.videoBytesReceived ||
          (typeof videoFramesDecoded === "number" &&
            typeof prev.videoFramesDecoded === "number" &&
            videoFramesDecoded > prev.videoFramesDecoded));

      const neverConnected =
        (pc.connectionState === "new" || pc.connectionState === "connecting") &&
        pcAgeMs > MEDIA_STALL_NEVER_CONNECTED_MS;
      const connectedButSilent = pc.connectionState === "connected" && !videoGrew && !remoteCameraLooksOff;

      const role = isInitiatorRef.current ? "initiator" : "guest";
      if (!neverConnected && !connectedButSilent) {
        mediaStallConsecutiveCountRef.current = 0;
        return;
      }

      mediaStallConsecutiveCountRef.current += 1;
      const requiredSamples = isInitiatorRef.current ? 2 : 3;
      retryDebugLog(role, roomId, "mediaStallWatchdog:sample", {
        neverConnected,
        connectedButSilent,
        remoteCameraLooksOff,
        connectionState: pc.connectionState,
        pcAgeMs,
        consecutiveCount: mediaStallConsecutiveCountRef.current,
        requiredSamples,
      });
      if (mediaStallConsecutiveCountRef.current < requiredSamples) return;

      mediaStallConsecutiveCountRef.current = 0;
      mediaStallCooldownUntilRef.current = Date.now() + MEDIA_STALL_COOLDOWN_MS;
      retryDebugLog(role, roomId, "mediaStallWatchdog:TRIGGERING_rebuild", {
        reason: neverConnected ? "never_connected" : "connected_no_inbound_media",
      });
      void requestPcRebuildRef.current(neverConnected ? "media_never_connected" : "media_stall", {});
    },
    [roomId],
  );

  const startStatsCollection = useCallback(
    (pc) => {
      stopStatsCollection();
      statsTimerRef.current = setInterval(async () => {
        if (!pc || pc.signalingState === "closed") {
          stopStatsCollection();
          return;
        }
        try {
          const stats = await pc.getStats();
          const diagnostics = { rtt: null, packetsReceived: 0, packetsLost: 0 };
          for (const report of stats.values()) {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              if (typeof report.currentRoundTripTime === "number") {
                diagnostics.rtt = Math.round(report.currentRoundTripTime * 1000);
              }
            } else if (report.type === "inbound-rtp" && !report.isRemote) {
              // Sum across the audio + video inbound streams.
              if (typeof report.packetsReceived === "number") {
                diagnostics.packetsReceived += report.packetsReceived;
              }
              if (typeof report.packetsLost === "number") {
                diagnostics.packetsLost += report.packetsLost;
              }
            }
          }
          const quality = deriveConnectionQuality(diagnostics, lastStatsSampleRef.current);
          lastStatsSampleRef.current = {
            packetsReceived: diagnostics.packetsReceived,
            packetsLost: diagnostics.packetsLost,
          };
          setConnectionQuality(quality);
          evaluateMediaStallWatchdog(pc, stats);
        } catch (err) {
          console.warn("[direct-video-call] getStats failed:", err.message);
        }
      }, CONNECTION_STATS_INTERVAL_MS);
    },
    [stopStatsCollection, evaluateMediaStallWatchdog],
  );

  // ── Assign local/remote streams to whichever <video> is in the main vs.
  // pip slot right now — kept as a single source of truth so swapping the
  // view just re-points srcObject instead of moving DOM nodes around. ──────
  const playAssignedVideos = useCallback(async () => {
    const mainOk = await playVideoElement(mainVideoRef.current);
    const pipOk = await playVideoElement(pipVideoRef.current);
    // Remote audio always plays through the dedicated (never-unmounted)
    // <audio> sink — its playback state is the one that matters for the
    // "tap to resume" prompt, since a blocked autoplay is almost always the
    // audio, not the muted video.
    const remoteAudioOk = await playVideoElement(remoteAudioRef.current);
    const remoteVideoEl = isSwappedRef.current ? pipVideoRef.current : mainVideoRef.current;
    const remoteVideoOk = remoteVideoEl === pipVideoRef.current ? pipOk : mainOk;
    const remoteHasMedia = Boolean(remoteStreamRef.current?.getTracks().length);
    setPlaybackBlocked(
      remoteHasMedia &&
        (!remoteAudioOk ||
          (Boolean(remoteVideoEl?.srcObject) && !remoteVideoOk)),
    );
  }, []);

  const assignStreams = useCallback(
    (swapped) => {
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
      // Remote audio sink is independent of which <video> slot the remote
      // stream occupies, so a swap / minimise never drops the other party's
      // voice.
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      void playAssignedVideos();
    },
    [playAssignedVideos],
  );

  const setMainVideoRef = useCallback((node) => {
    mainVideoRef.current = node;
    // Enforce muting imperatively as well as via the JSX `muted` prop — React
    // applies `muted` as a property post-mount, and the belt-and-braces set
    // here closes any window where a freshly-attached node could play the
    // local stream's audio. Remote audio plays only through remoteAudioRef.
    if (node) node.muted = true;
    mainVideoOrientationCleanupRef.current?.();
    mainVideoOrientationCleanupRef.current = node
      ? watchVideoOrientation(node, setIsMainVideoPortrait)
      : null;
  }, []);

  const setPipVideoRef = useCallback((node) => {
    pipVideoRef.current = node;
    if (node) node.muted = true;
    pipVideoOrientationCleanupRef.current?.();
    pipVideoOrientationCleanupRef.current = node
      ? watchVideoOrientation(node, setIsPipVideoPortrait)
      : null;
  }, []);

  // The pip <video> unmounts while self-view is minimized, so restoring it
  // needs its srcObject re-assigned — the node is brand new.
  useEffect(() => {
    if (isSelfViewMinimized) return;
    const frameId = requestAnimationFrame(() => {
      assignStreams(isSwappedRef.current);
    });
    return () => cancelAnimationFrame(frameId);
  }, [isSelfViewMinimized, assignStreams]);

  const cleanupCall = useCallback(() => {
    if (cleanupDoneRef.current) return;
    cleanupDoneRef.current = true;
    socket.emit("leave-direct-room", { roomId });
    clearTimeout(iceRestartTimerRef.current);
    iceRestartTimerRef.current = null;
    clearTimeout(reconnectStallTimerRef.current);
    reconnectStallTimerRef.current = null;
    clearTimeout(connectionFailTimerRef.current);
    connectionFailTimerRef.current = null;
    clearTimeout(offerAnswerTimeoutRef.current);
    offerAnswerTimeoutRef.current = null;
    clearTimeout(orphanedAnswerCheckTimerRef.current);
    orphanedAnswerCheckTimerRef.current = null;
    clearTimeout(manualReconnectCooldownTimerRef.current);
    manualReconnectCooldownTimerRef.current = null;
    pendingOfferIdRef.current = null;
    pendingRemoteOfferRef.current = null;
    pendingCandidatesRef.current = [];
    peerPresentRef.current = false;
    // Invalidate any in-flight setupPeerConnection run.
    pcSetupGenerationRef.current += 1;
    localMediaPromiseRef.current = null;
    setReconnectStalled(false);
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      pcRef.current = null;
    }
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    stopCallTimer();
    stopStatsCollection();
  }, [roomId, stopCallTimer, stopStatsCollection]);

  // ── Step 3: media + peer connection + signaling, once the guest joins ────
  useEffect(() => {
    if (stage !== "call") return;
    if (startedRef.current) return;

    // Capability check: everything below assumes RTCPeerConnection and
    // getUserMedia exist. Fail into the same "error" stage already used
    // for invalid/expired/full rooms, instead of letting `new
    // RTCPeerConnection` throw uncaught further down.
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setStage("error");
      setErrorInfo({
        code: "unsupported_browser",
        msg: "Your browser doesn't support video calls. Please use a recent version of Chrome, Edge, Firefox, or Safari.",
      });
      return;
    }

    startedRef.current = true;
    iceConfigPromiseRef.current = fetchDirectRoomIceConfig(roomId);

    const flushPendingCandidates = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      const queued = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error("[direct-video-call] queued ICE candidate failed", err);
        }
      }
    };

    const clearOfferAnswerTimeout = () => {
      clearTimeout(offerAnswerTimeoutRef.current);
      offerAnswerTimeoutRef.current = null;
    };

    // Explicit SDP rollback, feature-detected. Older Safari / in-app WebViews
    // don't implement rollback and throw here; the callers treat a false
    // return as "couldn't roll back — let the watchdog / peer retry recover"
    // rather than pushing an InvalidStateError further down.
    const safeRollback = async (pc) => {
      try {
        await pc.setLocalDescription({ type: "rollback" });
        return true;
      } catch (err) {
        console.warn(
          "[direct-video-call] SDP rollback unsupported or failed:",
          err?.message || err,
        );
        return false;
      }
    };

    // Self-heals if a specific offer never gets answered (dropped signaling
    // message, peer mid-reconnect, replayed/rejected stale answer, etc.) —
    // otherwise the RTCPeerConnection stays wedged in "have-local-offer"
    // forever, since nothing else ever rolls back our own offer. Mirrors
    // VideoCall.jsx's offerAnswerTimeoutRef watchdog.
    const armOfferAnswerTimeout = (offerId) => {
      clearOfferAnswerTimeout();
      offerAnswerTimeoutRef.current = window.setTimeout(async () => {
        offerAnswerTimeoutRef.current = null;
        const pc = pcRef.current;
        if (!mountedRef.current || !pc || pc.signalingState === "closed") return;
        if (pendingOfferIdRef.current !== offerId) return; // already resolved or superseded
        if (pc.signalingState !== "have-local-offer") {
          pendingOfferIdRef.current = null;
          return;
        }
        console.warn(
          `[direct-video-call] no answer received for offer ${offerId} within ${OFFER_ANSWER_TIMEOUT_MS}ms — rolling back to retry.`,
        );
        try {
          const rolledBack = await safeRollback(pc);
          pendingOfferIdRef.current = null;
          if (!rolledBack) {
            // Can't roll our own offer back on this browser — hand off to the
            // ICE-restart machinery, which rebuilds negotiation from a fresh
            // offer rather than depending on rollback.
            void createAndSendIceRestartOffer();
            return;
          }
          // A colliding remote offer we stashed rather than dropped (see
          // handleOffer) can now be answered from a clean "stable" state —
          // prefer that over kicking a fresh ICE-restart offer, so glare
          // recovery completes in one step instead of another full cycle.
          const stashedOffer = takeStashedOffer();
          if (stashedOffer) {
            void handleOffer(stashedOffer);
          } else {
            void createAndSendIceRestartOffer();
          }
        } catch (err) {
          pendingOfferIdRef.current = null;
          console.error("[direct-video-call] rollback after offer-answer timeout failed", err);
        }
      }, OFFER_ANSWER_TIMEOUT_MS);
    };

    // Shared by the peer-requested restart handler and scheduleIceRestart's
    // own self-heal path — both just need "create an iceRestart offer, tag
    // it, send it, and arm the answer watchdog."
    const createAndSendIceRestartOffer = async () => {
      const pc = pcRef.current;
      if (!pc || makingOfferRef.current) return;
      // setLocalDescription(offer) is only valid from "stable" — calling it
      // from e.g. "have-remote-offer" (mid-flight processing an incoming
      // offer) would throw and just waste this recovery attempt. Mirrors
      // VideoCall.jsx's createAndSendOffer guard; the next scheduleIceRestart
      // cycle (or the peer's own retry) picks this back up once stable.
      if (pc.signalingState !== "stable") return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer({ iceRestart: true });
        if (!mountedRef.current || pc.signalingState === "closed") return;
        await pc.setLocalDescription(offer);
        const offerId = makeOfferId();
        pendingOfferIdRef.current = offerId;
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(
          isInitiatorRef.current ? "initiator" : "guest",
          roomId,
          "createAndSendIceRestartOffer:offer_sent",
          {
            offerId,
            reconnectInProgress: reconnectInProgressRef.current,
            dtlsFingerprint: extractDtlsFingerprint(pc.localDescription?.sdp),
          },
        );
        socket.emit("direct-video-offer", { roomId, offer: pc.localDescription, offerId });
        armOfferAnswerTimeout(offerId);
      } catch (err) {
        console.error("[direct-video-call] ICE restart offer failed", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    // Cancels any pending scheduleOrphanedAnswerRecheck timer — the pc it
    // was watching is either about to be replaced (requestPcRebuild) or has
    // become healthy (handleConnectedState), either of which makes the
    // scheduled check moot.
    const cancelOrphanedAnswerRecheck = () => {
      clearTimeout(orphanedAnswerCheckTimerRef.current);
      orphanedAnswerCheckTimerRef.current = null;
    };

    // Single, serialized entry point for every "tear down and rebuild the
    // pc from scratch" trigger in this file: the fingerprint/InvalidAccess
    // detection below, handlePeerJoined's health-gated rebuild, the
    // orphaned-answer recheck, the media-stall watchdog, and manual Retry
    // (forceReconnect) all funnel through here instead of each duplicating
    // their own teardown — see the module-level root-cause comment on the
    // "blank video after Retry" bug this file was originally patched for;
    // every trigger below is a different way of detecting the same
    // underlying problem (this side's pc no longer matches what the peer
    // actually has).
    //
    // options.manual (forceReconnect only): bypasses the automatic-rebuild
    // rate limit, and — if another rebuild is already in flight — preempts
    // it (tears down whatever pc currently exists, including one the other
    // rebuild is still building) rather than coalescing, since a person
    // tapping Retry is explicit intent that should always take effect.
    // Automatic triggers instead coalesce: if a rebuild is already running,
    // they don't start a second one (a second rebuild would just mint yet
    // another DTLS fingerprint and make the peer rebuild AGAIN) — they only
    // update pendingRemoteOfferRef so the offer that triggered them is still
    // applied once the in-flight rebuild finishes, per its own
    // "bufferedOffer" replay.
    const requestPcRebuild = async (reason, options = {}) => {
      const { offerToReplay, manual = false } = options;
      const role = isInitiatorRef.current ? "initiator" : "guest";

      if (!manual) {
        const now = Date.now();
        autoRebuildTimestampsRef.current = autoRebuildTimestampsRef.current.filter(
          (t) => now - t < AUTO_REBUILD_WINDOW_MS,
        );
        if (autoRebuildTimestampsRef.current.length >= AUTO_REBUILD_MAX_COUNT) {
          retryDebugLog(role, roomId, "requestPcRebuild:BLOCKED_rate_limit", {
            reason,
            recentCount: autoRebuildTimestampsRef.current.length,
            windowMs: AUTO_REBUILD_WINDOW_MS,
          });
          // Stop auto-rebuilding and fall back to the existing manual-Retry
          // UI rather than looping forever — mirrors the existing stall
          // banner used elsewhere for "automatic recovery isn't working."
          if (offerToReplay && peerPresentRef.current) pendingRemoteOfferRef.current = offerToReplay;
          setReconnectStalled(true);
          return;
        }
      }

      if (peerRebuildInProgressRef.current) {
        if (!manual) {
          retryDebugLog(role, roomId, "requestPcRebuild:COALESCED", { reason });
          if (offerToReplay && peerPresentRef.current) pendingRemoteOfferRef.current = offerToReplay;
          return;
        }
        retryDebugLog(role, roomId, "requestPcRebuild:manual_preempting_in_progress_rebuild", {
          reason,
        });
      }

      peerRebuildInProgressRef.current = true;
      if (!manual) autoRebuildTimestampsRef.current.push(Date.now());
      retryDebugLog(role, roomId, "requestPcRebuild:START", { reason, manual });
      try {
        cancelOrphanedAnswerRecheck();
        // Must survive the rebuild — setupPeerConnection replays whatever is
        // stashed here once the fresh pc and its local tracks are ready (see
        // its own "bufferedOffer" replay at the end of that function). Left
        // untouched (not nulled) when there's nothing new to replay, so a
        // manual Retry preempting an in-flight automatic rebuild doesn't
        // discard whatever that rebuild had already stashed.
        if (offerToReplay) pendingRemoteOfferRef.current = offerToReplay;

        const stalePc = pcRef.current;
        if (stalePc) {
          retryDebugLog(role, roomId, "requestPcRebuild:closing_stale_pc", {
            connectionState: stalePc.connectionState,
            iceConnectionState: stalePc.iceConnectionState,
            signalingState: stalePc.signalingState,
            pcAgeMs: pcCreatedAtRef.current ? Date.now() - pcCreatedAtRef.current : null,
          });
          stalePc.onicecandidate = null;
          stalePc.ontrack = null;
          stalePc.onnegotiationneeded = null;
          stalePc.onconnectionstatechange = null;
          stalePc.oniceconnectionstatechange = null;
          stalePc.close();
        }
        pcRef.current = null;
        pendingCandidatesRef.current = [];
        pendingOfferIdRef.current = null;
        makingOfferRef.current = false;
        ignoreOfferRef.current = false;
        clearOfferAnswerTimeout();
        clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = null;
        clearTimeout(connectionFailTimerRef.current);
        connectionFailTimerRef.current = null;
        iceRecoveryAttemptsRef.current = 0;
        restartRequestInFlightRef.current = false;
        // The pc we're about to build has no prior negotiation — nothing
        // meaningful to compare a future offer's fingerprint against.
        // Clearing this (rather than leaving the old peer's fingerprint in
        // place) stops the replayed offer below from re-triggering this same
        // proactive check and looping.
        lastRemoteFingerprintRef.current = null;
        // Reset the media-stall watchdog's own sample/counter — comparing
        // the fresh pc's first stats sample against a stale one from the pc
        // that just got closed would read as a huge, meaningless delta (or
        // a false "zero growth" if it happens to land before the new pc has
        // any stats yet).
        mediaStallSampleRef.current = null;
        mediaStallConsecutiveCountRef.current = 0;
        // Invalidates any other stale in-flight setupPeerConnection() run so
        // it discards its pc instead of racing this one — mirrors
        // forceReconnect/handlePeerJoined's identical use of this token.
        // (setupPeerConnection also bumps this itself on entry; bumping here
        // too additionally invalidates anything already in flight before we
        // even start ours.)
        pcSetupGenerationRef.current += 1;

        await setupPeerConnectionRef.current();
        retryDebugLog(role, roomId, "requestPcRebuild:DONE", { reason, manual });
      } finally {
        peerRebuildInProgressRef.current = false;
      }
    };

    // Schedules a one-off recheck ~ORPHANED_ANSWER_RECHECK_MS after an
    // orphaned answer (handleAnswer's offerId-mismatch / wrong-signalingState
    // branches) — most orphaned answers are normal perfect-negotiation glare
    // fallout that resolves itself, so this deliberately does NOT rebuild
    // immediately. Only if the pc is *still* unhealthy this long after does
    // it call requestPcRebuild. Debounced to a single pending timer; the
    // check is automatically moot (and skips itself) if the pc has since
    // been replaced by any other rebuild path, or reconnected on its own —
    // see handleConnectedState's own cancelOrphanedAnswerRecheck() call.
    const scheduleOrphanedAnswerRecheck = (reason) => {
      const role = isInitiatorRef.current ? "initiator" : "guest";
      const checkPc = pcRef.current;
      const checkGeneration = pcSetupGenerationRef.current;
      cancelOrphanedAnswerRecheck();
      retryDebugLog(role, roomId, "scheduleOrphanedAnswerRecheck:armed", { reason });
      orphanedAnswerCheckTimerRef.current = window.setTimeout(() => {
        orphanedAnswerCheckTimerRef.current = null;
        if (
          !mountedRef.current ||
          pcRef.current !== checkPc ||
          pcSetupGenerationRef.current !== checkGeneration
        ) {
          retryDebugLog(role, roomId, "scheduleOrphanedAnswerRecheck:cancelled_pc_replaced", { reason });
          return;
        }
        const pc = checkPc;
        const isHealthy =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        retryDebugLog(role, roomId, "scheduleOrphanedAnswerRecheck:fired", {
          reason,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          isHealthy,
        });
        // A pc that IS healthy but silently not flowing media ("connected
        // with no inbound media") is the media-stall watchdog's own,
        // separately-cadenced concern (startStatsCollection) — not
        // re-implemented here to avoid two independent stats-based stall
        // detectors disagreeing with each other.
        if (!isHealthy) void requestPcRebuild(`orphaned_answer:${reason}`);
      }, ORPHANED_ANSWER_RECHECK_MS);
    };

    // Takes (and clears) the stashed remote offer, dropping it when stale.
    const takeStashedOffer = () => {
      const stashed = pendingRemoteOfferRef.current;
      pendingRemoteOfferRef.current = null;
      if (!stashed) return null;
      const ageMs = Date.now() - (stashed.receivedAt || Date.now());
      if (ageMs <= PENDING_OFFER_MAX_AGE_MS) return stashed;
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "stashedOffer:dropped_stale", {
        offerId: stashed.offerId || null,
        ageMs,
      });
      return null;
    };

    const handleOffer = async (incoming = {}) => {
      // Stamped once on first arrival; every stash/replay path carries it.
      const payload = incoming.receivedAt ? incoming : { ...incoming, receivedAt: Date.now() };
      const { offer, offerId: incomingOfferId } = payload;
      if (!offer) return;
      const pc = pcRef.current;
      const retryDebugRole = isInitiatorRef.current ? "initiator" : "guest";
      if (!pc) {
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(retryDebugRole, roomId, "handleOffer:no_pc_yet_stashed", {
          offerId: incomingOfferId || null,
          peerPresent: peerPresentRef.current,
        });
        // Offer beat our RTCPeerConnection into existence (setupPeerConnection
        // is async — it awaits the ICE-server config). Stash the newest one
        // *only* while we actually expect a peer; setupPeerConnection replays
        // it the moment the PC is ready, so we don't sit through
        // OFFER_ANSWER_TIMEOUT_MS waiting for the peer to retry. A stray offer
        // arriving after the peer has left (PC already torn down) is ignored.
        if (peerPresentRef.current) pendingRemoteOfferRef.current = payload;
        return;
      }
      // Computed before the collision/ignore logic below on purpose: a
      // changed DTLS fingerprint means the peer rebuilt their
      // RTCPeerConnection (their own Retry), and treating that as an
      // ordinary glare collision would drop or stash the one offer that can
      // never be satisfied by this side's stale pc — see
      // requestPcRebuild above.
      const retryDebugPcAgeMs = pcCreatedAtRef.current ? Date.now() - pcCreatedAtRef.current : null;
      const incomingFingerprint = extractDtlsFingerprint(offer?.sdp);
      const previousFingerprint = lastRemoteFingerprintRef.current;
      const peerFingerprintChanged =
        incomingFingerprint != null &&
        previousFingerprint != null &&
        incomingFingerprint !== previousFingerprint;

      const polite = !isInitiatorRef.current;
      const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
      ignoreOfferRef.current = !polite && offerCollision && !peerFingerprintChanged;

      // TEMPORARY (RETRY_DEBUG): snapshot everything relevant at the moment
      // this offer arrived, before any of it is mutated below.
      retryDebugLog(retryDebugRole, roomId, "handleOffer:arrived", {
        offerId: incomingOfferId || null,
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        pcAgeMs: retryDebugPcAgeMs,
        pcLooksFreshlyRebuilt: retryDebugPcAgeMs !== null && retryDebugPcAgeMs < 3000,
        makingOffer: makingOfferRef.current,
        offerCollision,
        isPolitePeer: polite,
        shouldIgnoreOffer: ignoreOfferRef.current,
        incomingDtlsFingerprint: incomingFingerprint,
        previousRemoteDtlsFingerprint: previousFingerprint,
        dtlsFingerprintChanged: peerFingerprintChanged,
      });

      if (peerFingerprintChanged) {
        retryDebugLog(retryDebugRole, roomId, "handleOffer:peer_rebuilt_detected_via_fingerprint", {
          offerId: incomingOfferId || null,
        });
        await requestPcRebuild("fingerprint_changed", { offerToReplay: payload });
        return;
      }

      if (ignoreOfferRef.current) {
        retryDebugLog(retryDebugRole, roomId, "handleOffer:IGNORED_collision", {
          offerId: incomingOfferId || null,
        });
        return;
      }

      try {
        if (offerCollision && pc.signalingState === "have-local-offer") {
          const rolledBack = await safeRollback(pc);
          retryDebugLog(retryDebugRole, roomId, "handleOffer:rollback_local_offer", {
            offerId: incomingOfferId || null,
            rolledBack,
          });
          // Our own outstanding offer was just discarded — any answer that
          // still shows up for it later is stale and must be rejected.
          pendingOfferIdRef.current = null;
          clearOfferAnswerTimeout();
          if (!rolledBack) {
            // Browser can't roll back; can't safely apply a remote offer over
            // our local one. Stash it (polite side) and let the peer's retry
            // drive recovery.
            if (polite && peerPresentRef.current) pendingRemoteOfferRef.current = payload;
            return;
          }
        } else if (offerCollision) {
          // Collision, but not in a rollback-able state (e.g. our own
          // createOffer is mid-flight and hasn't reached setLocalDescription
          // yet). Dropping the offer here is what let both symmetric peers
          // sit in "have-local-offer" until the 8s offer-answer watchdog:
          // the impolite peer keeps its own (winning) offer, but the polite
          // peer stashes this one so it's answered the moment our own
          // negotiation settles (see handleAnswer / armOfferAnswerTimeout).
          retryDebugLog(retryDebugRole, roomId, "handleOffer:collision_not_rollbackable_stashed", {
            offerId: incomingOfferId || null,
            signalingState: pc.signalingState,
          });
          if (polite && peerPresentRef.current) pendingRemoteOfferRef.current = payload;
          return;
        }

        // A rollback above — or an onnegotiationneeded that raced in during
        // one of the awaits — can leave signalingState somewhere that won't
        // accept a remote offer. Re-check before applying it; stash for a
        // retry rather than throwing an InvalidStateError into the void.
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
          retryDebugLog(retryDebugRole, roomId, "handleOffer:signaling_state_unacceptable_stashed", {
            offerId: incomingOfferId || null,
            signalingState: pc.signalingState,
          });
          if (polite && peerPresentRef.current) pendingRemoteOfferRef.current = payload;
          return;
        }

        try {
          await pc.setRemoteDescription(offer);
        } catch (err) {
          // Reactive fallback for the same "peer rebuilt their pc" case the
          // proactive fingerprint check above is meant to catch before we
          // ever get here — reached when there was no previous fingerprint
          // to compare against yet (e.g. the very first offer after a
          // rebuild on either side) so the proactive check couldn't fire.
          // This is the exact error confirmed in production: Chrome's
          // InvalidAccessError "the order of m-lines in subsequent offer
          // doesn't match order from previous offer/answer" when a fresh
          // peer's SDP is applied onto this side's still-open, previously
          // negotiated pc.
          const looksLikeStalePcRenegotiation =
            err?.name === "InvalidAccessError" || /m-line/i.test(err?.message || "");
          retryDebugLog(retryDebugRole, roomId, "handleOffer:setRemoteDescription:ERROR", {
            offerId: incomingOfferId || null,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
            looksLikeStalePcRenegotiation,
          });
          if (looksLikeStalePcRenegotiation) {
            retryDebugLog(retryDebugRole, roomId, "handleOffer:peer_rebuilt_detected_via_sdp_error", {
              offerId: incomingOfferId || null,
            });
            await requestPcRebuild("sdp_error", { offerToReplay: payload });
            return;
          }
          throw err;
        }
        // Real reconnect-logic state, not a log side-effect: this is what
        // the *next* offer's proactive fingerprint check (above) compares
        // against to detect a rebuilt peer. Updated on every
        // successfully-applied offer — including a replayed one after
        // requestPcRebuild runs — so an ordinary same-pc
        // ICE-restart offer never looks like a rebuild, and a genuine
        // rebuild's replayed offer is never mistaken for another rebuild
        // (see requestPcRebuild's own reset of this ref).
        lastRemoteFingerprintRef.current = incomingFingerprint;
        retryDebugLog(retryDebugRole, roomId, "handleOffer:setRemoteDescription:ok", {
          offerId: incomingOfferId || null,
        });
        await flushPendingCandidates();
        // Explicit createAnswer()/setLocalDescription(answer) rather than the
        // implicit no-arg form — the latter isn't implemented on older Safari
        // / in-app WebViews and throws there.
        let answer;
        try {
          answer = await pc.createAnswer();
        } catch (err) {
          retryDebugLog(retryDebugRole, roomId, "handleOffer:createAnswer:ERROR", {
            offerId: incomingOfferId || null,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
          });
          throw err;
        }
        try {
          await pc.setLocalDescription(answer);
        } catch (err) {
          retryDebugLog(retryDebugRole, roomId, "handleOffer:setLocalDescription:ERROR", {
            offerId: incomingOfferId || null,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
          });
          throw err;
        }
        retryDebugLog(retryDebugRole, roomId, "handleOffer:answer_sent", {
          offerId: incomingOfferId || null,
        });
        socket.emit("direct-video-answer", { roomId, answer: pc.localDescription, offerId: incomingOfferId });
        // TEMPORARY (RETRY_DEBUG): watch whether media actually starts
        // flowing on this pc after answering this offer.
        retryDebugPollInboundVideoStats(pc, retryDebugRole, roomId, "handleOffer:post_answer");
      } catch (err) {
        console.error("[direct-video-call] offer handling failed", err);
        retryDebugLog(retryDebugRole, roomId, "handleOffer:ERROR", {
          offerId: incomingOfferId || null,
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        });
        // Let the polite peer take another run at this offer from a clean
        // state instead of leaving the connection wedged until the watchdog.
        if (polite && peerPresentRef.current && !pendingRemoteOfferRef.current) {
          pendingRemoteOfferRef.current = payload;
        }
      }
    };

    const handleAnswer = async ({ answer, offerId: receivedOfferId } = {}) => {
      const pc = pcRef.current;
      if (!pc || !answer) return;
      const retryDebugRole = isInitiatorRef.current ? "initiator" : "guest";
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(retryDebugRole, roomId, "handleAnswer:received", {
        offerId: receivedOfferId || null,
        expectedOfferId: pendingOfferIdRef.current,
        signalingState: pc.signalingState,
        reconnectInProgress: reconnectInProgressRef.current,
      });
      if (pc.signalingState !== "have-local-offer") {
        // Orphaned answer — we're not (or no longer) waiting for one on
        // this pc. Normal fallout from perfect-negotiation glare (we rolled
        // back our own offer, or already applied a colliding one) and
        // usually resolves itself; don't rebuild on the spot. Only if the
        // pc is *still* unhealthy a few seconds from now is this actually a
        // sign of a broken session — see scheduleOrphanedAnswerRecheck.
        retryDebugLog(retryDebugRole, roomId, "handleAnswer:ORPHANED_wrong_signaling_state", {
          offerId: receivedOfferId || null,
          signalingState: pc.signalingState,
        });
        scheduleOrphanedAnswerRecheck("wrong_signaling_state");
        return;
      }
      // Guards against a stale/replayed answer being applied to a newer
      // offer (e.g. a redelivered socket event across a reconnect) —
      // signalingState alone can't tell a genuine fresh answer apart from
      // that, since a replayed one arrives while we're legitimately waiting
      // for a real one. Mirrors VideoCall.jsx's pendingOfferIdRef check.
      const expectedOfferId = pendingOfferIdRef.current;
      if (!expectedOfferId || receivedOfferId !== expectedOfferId) {
        console.warn(
          `[direct-video-call] rejecting stale answer (expected ${expectedOfferId || "none"}, got ${receivedOfferId || "none"})`,
        );
        retryDebugLog(retryDebugRole, roomId, "handleAnswer:ORPHANED_offerid_mismatch", {
          offerId: receivedOfferId || null,
          expectedOfferId: expectedOfferId || null,
        });
        scheduleOrphanedAnswerRecheck("offerid_mismatch");
        return;
      }
      // Safety net for a peer that rebuilt its pc: an answer whose DTLS
      // fingerprint differs from the last one we applied from this peer comes
      // from a brand-new RTCPeerConnection (e.g. the guest retried while the
      // host kept its old pc and answered-to by the guest's new one). It can't
      // be applied to our still-open, previously negotiated pc — the
      // transport would sit "connected" with no media — so don't try; rebuild
      // instead, and the fresh pc's own offer makes the peer rebuild too.
      // Same non-null-on-both-sides rule as handleOffer's check. Mirrors
      // VideoCall.jsx's handleAnswer.
      const answerFingerprint = extractDtlsFingerprint(answer?.sdp);
      const knownRemoteFingerprint = lastRemoteFingerprintRef.current;
      if (
        answerFingerprint != null &&
        knownRemoteFingerprint != null &&
        answerFingerprint !== knownRemoteFingerprint
      ) {
        retryDebugLog(retryDebugRole, roomId, "handleAnswer:peer_rebuilt_detected_via_answer_fingerprint", {
          offerId: receivedOfferId || null,
          answerFingerprint,
          knownRemoteFingerprint,
        });
        await requestPcRebuild("answer_fingerprint_changed");
        return;
      }
      try {
        await pc.setRemoteDescription(answer);
        // Real reconnect-logic state: the NEXT offer's or answer's fingerprint
        // check compares against this. The offerer side only ever learns the
        // peer's fingerprint from answers, so it must be stored here too.
        if (answerFingerprint) lastRemoteFingerprintRef.current = answerFingerprint;
        pendingOfferIdRef.current = null;
        clearOfferAnswerTimeout();
        await flushPendingCandidates();
        // We're back to "stable"; if a colliding remote offer was stashed
        // while our own was outstanding (see handleOffer), answer it now.
        const stashedOffer = takeStashedOffer();
        if (stashedOffer) {
          void handleOffer(stashedOffer);
        }
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(retryDebugRole, roomId, "handleAnswer:applied_ok", {
          offerId: receivedOfferId || null,
        });
      } catch (err) {
        console.error("[direct-video-call] answer handling failed", err);
        retryDebugLog(retryDebugRole, roomId, "handleAnswer:ERROR", {
          offerId: receivedOfferId || null,
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        });
      }
    };

    const handleIceCandidate = async ({ candidate } = {}) => {
      if (!candidate) return;
      const pc = pcRef.current;
      // Buffer until the PC exists AND has a remote description — candidates
      // that arrive before either (during the async setupPeerConnection, or
      // ahead of the first offer/answer) were previously dropped, forcing ICE
      // to rediscover them. flushPendingCandidates drains this once the
      // remote description is set. Only buffer while a peer is expected, so a
      // straggler from a peer that already left isn't replayed onto the next
      // connection.
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        if (peerPresentRef.current) pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!ignoreOfferRef.current) console.error("[direct-video-call] addIceCandidate failed", err);
      }
    };

    const handlePeerJoined = ({ name, resumedCall } = {}) => {
      if (!mountedRef.current) return;
      peerPresentRef.current = true;
      setPeerLeftNotice(false);
      setPeerName(name || "");
      const resuming = resumedCall || resumedSessionRef.current;

      // Only a PC that's genuinely still connected is worth keeping across a
      // resume — the nudge below drives its ICE restart. A resumed session
      // whose PC is wedged (our socket reconnected outside
      // connectionStateRecovery's window, leaving the old PC stuck
      // non-connected, possibly with a non-"stable" signalingState that
      // createAndSendIceRestartOffer can't act on) won't self-heal. Tear it
      // down here so setupPeerConnection builds a clean one and negotiation
      // runs from scratch — exactly what the reloaded peer does on its side.
      const existingPc = pcRef.current;
      const existingPcHealthy =
        !!existingPc &&
        (existingPc.connectionState === "connected" ||
          existingPc.iceConnectionState === "connected" ||
          existingPc.iceConnectionState === "completed");
      // Deliberately NOT gated on `resumedCall` alone: `resumedCall` is
      // emitted on a plain Socket.IO reconnect (connectionStateRecovery, or
      // an ordinary reconnect from a returning guestId — see
      // join-direct-room in server.js) with zero knowledge of whether the
      // PEER's RTCPeerConnection was ever rebuilt. A healthy pc here almost
      // always means the signaling socket blipped while the WebRTC/ICE media
      // path (a separate transport) kept working fine — tearing it down on
      // every resumedCall regardless of health was tried and reverted: it
      // caused an unaffected, working side to visibly rebuild/blank itself
      // over the *other* side's harmless socket blip. The actual "peer
      // rebuilt their pc" case (a real Retry) is instead primarily caught by
      // handleOffer's own DTLS-fingerprint check and
      // InvalidAccessError/m-line-order catch, which observe the actual SDP
      // (ground truth) rather than inferring it from this socket-level
      // signal.
      //
      // pcAgeMs/REBUILD_GRACE_MS guards the remaining case this still needs
      // to catch: a genuinely wedged pc (closed/failed, or resumed-but-
      // unhealthy well past when it should have reconnected). Without the
      // grace window, a duplicate/rapid peer-joined signal (the exact
      // duplicate-join bug fixed alongside this) tears down and rebuilds a
      // pc that's only milliseconds old and still simply negotiating —
      // mirrors VideoCall.jsx's identical pcNeedsRebuild formula.
      const pcAgeMs = pcCreatedAtRef.current ? Date.now() - pcCreatedAtRef.current : Infinity;
      // Requires an existingPc for every branch on purpose — "no pc yet" is
      // not a rebuild, just an ordinary first build (see the plain
      // setupPeerConnection() call below), and must never consume the
      // automatic-rebuild rate limit or go through requestPcRebuild's
      // teardown machinery, which has nothing to tear down.
      const pcNeedsTeardown = Boolean(
        existingPc &&
          (existingPc.signalingState === "closed" ||
            existingPc.connectionState === "failed" ||
            (resuming && !existingPcHealthy && pcAgeMs > REBUILD_GRACE_MS)),
      );
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "handlePeerJoined", {
        resumedCall: Boolean(resumedCall),
        resuming: Boolean(resuming),
        existingPcConnectionState: existingPc?.connectionState ?? null,
        existingPcIceConnectionState: existingPc?.iceConnectionState ?? null,
        existingPcSignalingState: existingPc?.signalingState ?? null,
        existingPcHealthy,
        pcAgeMs,
        rebuildGraceMs: REBUILD_GRACE_MS,
        pcNeedsTeardown,
        branch: pcNeedsTeardown ? "REBUILD" : existingPc ? "NO_REBUILD" : "FIRST_BUILD",
        rebuildAlreadyInProgress: peerRebuildInProgressRef.current,
      });
      // Whether we're keeping a live connection decides if the renegotiation
      // nudge below applies (a fresh build negotiates on its own).
      const hadConnection = existingPcHealthy;

      setCallStatus((prev) => {
        if (prev === "connected") return prev;
        return resuming ? "reconnecting" : "connecting";
      });
      // Routed through requestPcRebuild (not a separate inline teardown) so
      // this trigger shares the same serialization, coalescing, and
      // automatic-rebuild rate limit as every other trigger — a burst of
      // duplicate peer-joined events now produces at most one in-flight
      // rebuild instead of several racing ones. The plain first-build path
      // (no existingPc) also skips calling setupPeerConnection directly
      // while a rebuild is already in flight — its own internal
      // setupPeerConnectionRef.current() call will build the pc once it
      // gets there; racing a second, independent build here would recreate
      // exactly the "several pcs built within ~1s" bug this fixes. The peer
      // connection (and therefore the initial offer + ICE gathering) is
      // only created once we know someone is actually in the room to
      // receive it — see setupPeerConnection's comment below for why
      // creating it eagerly in handleRoomJoined lost the initial offer.
      if (pcNeedsTeardown) {
        void requestPcRebuild("peer_joined_unhealthy_resume");
      } else if (!peerRebuildInProgressRef.current) {
        void setupPeerConnection();
      }

      // Surface a stalled *first* connect. Previously the connection
      // watchdog and the manual-Retry stall banner were only wired for a
      // drop *after* the call had already connected once (hasConnectedOnceRef
      // gate), so a first handshake that never completed just spun on
      // "Connecting…" forever. Arm both here — unconditionally — mirroring
      // VideoCall.jsx's handlePeerJoined. Both self-clear on a successful
      // connect and are no-ops once connected.
      startConnectionWatchdog();
      startReconnectStallWatch(resuming ? 8000 : 20000);

      // If the server says the call was already active before this
      // direct-peer-joined (the peer refreshed / reconnected rather than
      // joining fresh) and we're the side that KEPT its RTCPeerConnection,
      // none of the normal first-handshake triggers fire on our end — the
      // peer builds a brand-new PC and only its onnegotiationneeded drives
      // renegotiation, which on offer glare can leave us waiting out the
      // full OFFER_ANSWER_TIMEOUT_MS. Proactively drive recovery from our
      // side instead. Mirrors VideoCall.jsx's resumedCall handling: the
      // impolite peer (initiator) re-offers with an ICE restart; the polite
      // peer asks the initiator to. Guarded so an already-healthy connection
      // is never perturbed.
      if (resumedCall && hadConnection) {
        window.setTimeout(() => {
          const pc = pcRef.current;
          if (!mountedRef.current || !pc || pc.signalingState === "closed") return;
          if (
            pc.connectionState === "connected" ||
            pc.iceConnectionState === "connected" ||
            pc.iceConnectionState === "completed"
          )
            return;
          if (isInitiatorRef.current) {
            void createAndSendIceRestartOffer();
          } else {
            requestPeerIceRestart();
          }
        }, 500);
      }
    };

    const handleParticipantLeft = () => {
      if (!mountedRef.current) return;

      // The peer is genuinely gone — either they left deliberately, or a
      // ~15s disconnect grace already elapsed (server.js). There is nothing
      // to "reconnect" to, so fully stand down the recovery machinery
      // instead of letting the PC's own failure handlers keep firing
      // ICE-restart offers / restart-requests into an empty room and raising
      // a "Reconnecting…" banner over a call that's really just waiting.
      peerPresentRef.current = false;
      setPeerLeftNotice(true);
      setPeerName("");
      setCallStatus("waiting");

      clearReconnectStallWatch();
      clearOfferAnswerTimeout();
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
      clearTimeout(connectionFailTimerRef.current);
      connectionFailTimerRef.current = null;
      pendingOfferIdRef.current = null;
      pendingRemoteOfferRef.current = null;
      pendingCandidatesRef.current = [];
      restartRequestInFlightRef.current = false;
      iceRecoveryAttemptsRef.current = 0;
      makingOfferRef.current = false;
      ignoreOfferRef.current = false;
      // Invalidate any in-flight setup so it can't build a connection into
      // the now-empty room; the peer's rejoin starts a clean one — with a
      // freshly re-fetched ICE config so its TURN credentials aren't stale.
      pcSetupGenerationRef.current += 1;
      iceConfigPromiseRef.current = fetchDirectRoomIceConfig(roomId);
      stopStatsCollection();
      cancelOrphanedAnswerRecheck();
      // A genuinely new peer session starts fresh — stale state here would
      // otherwise compare the next pc's first stats sample against this
      // dead session's last one (a bogus "zero growth"), or treat the next
      // peer's first offer as a "changed fingerprint" rebuild trigger
      // against an identity that no longer exists.
      mediaStallSampleRef.current = null;
      mediaStallConsecutiveCountRef.current = 0;
      lastRemoteFingerprintRef.current = null;

      // Drop the now-dead peer connection. If the peer comes back,
      // handlePeerJoined -> setupPeerConnection builds a fresh one and
      // negotiation runs cleanly from scratch (a reloaded peer has a brand
      // new PC / DTLS identity anyway, so keeping the old one buys nothing).
      const pc = pcRef.current;
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onnegotiationneeded = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
        pcRef.current = null;
      }

      // Clear the peer's last frame so the stage doesn't freeze on it while
      // we wait. The local preview keeps running.
      const remoteStream = remoteStreamRef.current;
      remoteStream.getTracks().forEach((track) => {
        track.stop();
        remoteStream.removeTrack(track);
      });
      assignStreams(isSwappedRef.current);
    };

    const handleRoomClosed = () => {
      if (!mountedRef.current) return;
      setEndedReason("closed");
      cleanupCall();
      setStage("ended");
    };

    const handleDuplicateSession = () => {
      if (!mountedRef.current) return;
      cleanupCall();
      setStage("error");
      setErrorInfo({ code: "duplicate_session", msg: "This meeting was opened in another tab or window." });
    };

    const handleRoomError = ({ code, msg } = {}) => {
      if (!mountedRef.current) return;
      cleanupCall();
      setStage("error");
      setErrorInfo({ code: code || "server_error", msg: msg || ROOM_ERROR_MESSAGES.server_error });
    };

    const handleIceRestartRequest = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      )
        return;
      await createAndSendIceRestartOffer();
    };

    const clearReconnectStallWatch = () => {
      clearTimeout(reconnectStallTimerRef.current);
      reconnectStallTimerRef.current = null;
      // Every call site of this function represents either a genuine
      // reconnect success or "no longer trying to reconnect right now" —
      // either way, a future stall is a fresh episode, not a continuation
      // of whatever was happening before.
      reconnectStallCountRef.current = 0;
      setReconnectStalled(false);
    };

    const startReconnectStallWatch = (delayMs) => {
      if (reconnectStallTimerRef.current) return;
      reconnectStallTimerRef.current = setTimeout(() => {
        reconnectStallTimerRef.current = null;
        const pc = pcRef.current;
        if (!mountedRef.current || !pc || pc.signalingState === "closed") return;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        )
          return;
        reconnectStallCountRef.current += 1;
        setReconnectStalled(true);
      }, delayMs);
    };

    const requestPeerIceRestart = () => {
      if (restartRequestInFlightRef.current) return;
      restartRequestInFlightRef.current = true;
      socket.emit("direct-ice-restart-request", { roomId });
      window.setTimeout(() => {
        restartRequestInFlightRef.current = false;
      }, ICE_RESTART_DELAY_MS * 2);
    };

    // Self-heals a degraded/dropped connection instead of only waiting on
    // the peer to notice and ask for a restart (the previous behavior).
    // Mirrors VideoCall.jsx's scheduleIceRestart: capped attempts with a
    // cooldown before falling back to asking the peer, and — like
    // VideoCall.jsx's isDoctor/isPolitePeer split — only the "impolite"
    // side (the room initiator here) ever self-initiates the actual
    // restart offer, so both sides don't race to renegotiate at once.
    const scheduleIceRestart = () => {
      if (!mountedRef.current || !peerPresentRef.current || iceRestartTimerRef.current) return;
      iceRestartTimerRef.current = setTimeout(async () => {
        iceRestartTimerRef.current = null;
        const pc = pcRef.current;
        if (!mountedRef.current || !peerPresentRef.current || !pc || pc.signalingState === "closed") return;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        )
          return;

        // A fully offline device can't gather real ICE candidates or have an
        // offer delivered — taking the action now would just burn a
        // recovery attempt on dead air and hand the peer an SDP built with
        // no usable candidates. Skip the action but still loop below, so
        // recovery resumes the moment connectivity is actually back instead
        // of waiting on a connectionstatechange transition that a
        // connection stuck in "disconnected" may never fire again.
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          const now = Date.now();
          if (now - lastIceRecoveryAtRef.current > ICE_RECOVERY_COOLDOWN_MS) {
            iceRecoveryAttemptsRef.current = 0;
          }
          lastIceRecoveryAtRef.current = now;

          if (iceRecoveryAttemptsRef.current >= ICE_MAX_RECOVERY_ATTEMPTS) {
            requestPeerIceRestart();
          } else {
            iceRecoveryAttemptsRef.current += 1;
            if (isInitiatorRef.current) {
              await createAndSendIceRestartOffer();
            } else {
              requestPeerIceRestart();
            }
          }
        }

        // Still unhealthy (or skipped because we're offline) — keep the
        // retry loop alive on the same cadence instead of relying on
        // another state-change event to re-enter this function.
        scheduleIceRestart();
      }, ICE_RESTART_DELAY_MS);
    };

    // First-connect / recovery watchdog: if a peer is present but the PC
    // hasn't reached a connected state within CONNECTION_FAIL_TIMEOUT_MS,
    // kick the ICE-restart machinery. Covers ICE stalling in "checking" (or
    // signaling being silently dropped) without ever emitting an explicit
    // "failed" — which previously left the call on "Connecting…" with no
    // recovery. Mirrors VideoCall.jsx's startConnectionWatchdog.
    const startConnectionWatchdog = () => {
      clearTimeout(connectionFailTimerRef.current);
      connectionFailTimerRef.current = setTimeout(() => {
        connectionFailTimerRef.current = null;
        const pc = pcRef.current;
        if (
          !mountedRef.current ||
          !peerPresentRef.current ||
          !pc ||
          pc.signalingState === "closed"
        )
          return;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        )
          return;
        console.warn(
          "[direct-video-call] connection establishment timed out — requesting ICE recovery.",
        );
        scheduleIceRestart();
      }, CONNECTION_FAIL_TIMEOUT_MS);
    };

    armConnectWatchdogsRef.current = () => {
      startConnectionWatchdog();
      startReconnectStallWatch(hasConnectedOnceRef.current ? 8000 : 20000);
    };

    // Reused by both the remote-track onunmute handler (in pc.ontrack below)
    // and handleConnectedState's post-recovery check below it — forces the
    // remote <video>/<audio> elements to treat remoteStreamRef.current as a
    // genuine source change even though the object reference and its tracks
    // may be unchanged. Plain srcObject reassignment to an already-assigned
    // MediaStream reference can be a no-op in some browsers, leaving video
    // frozen on its last frame even after the underlying track resumes
    // producing frames. Mirrors the same "rebuild as a new MediaStream
    // object" fix already applied in VideoCall.jsx's pc.ontrack.
    const refreshRemoteStreamBinding = () => {
      remoteStreamRef.current = new MediaStream(remoteStreamRef.current.getTracks());
      assignStreams(isSwappedRef.current);
    };

    // Shared by onconnectionstatechange and oniceconnectionstatechange (the
    // latter a fallback for browsers where the former fires late or not at
    // all) so a genuine "connected" transition is handled identically
    // regardless of which callback fires it.
    const handleConnectedState = () => {
      // TEMPORARY (RETRY_DEBUG)
      const retryDebugPc = pcRef.current;
      retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "handleConnectedState:called", {
        connectionState: retryDebugPc?.connectionState ?? null,
        iceConnectionState: retryDebugPc?.iceConnectionState ?? null,
        remoteRebindPending: remoteRebindPendingRef.current,
        hasConnectedOnce: hasConnectedOnceRef.current,
      });
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
      clearTimeout(connectionFailTimerRef.current);
      connectionFailTimerRef.current = null;
      iceRecoveryAttemptsRef.current = 0;
      restartRequestInFlightRef.current = false;
      clearReconnectStallWatch();
      // A pending orphaned-answer recheck (handleAnswer) is moot once the pc
      // is actually healthy again.
      cancelOrphanedAnswerRecheck();
      // The rebuilt connection is up — end a manual Retry's banner/button hold.
      releaseManualReconnectGuard();
      hasConnectedOnceRef.current = true;
      peerPresentRef.current = true;
      // The "resuming an earlier session" story ends once we're connected —
      // any later peer-join is a fresh negotiation and should read as such.
      resumedSessionRef.current = false;
      if (!mountedRef.current) return;
      setCallStatus("connected");
      setPeerLeftNotice(false);
      startCallTimer();
      const pc = pcRef.current;
      if (pc) startStatsCollection(pc);
      if (remoteRebindPendingRef.current) {
        remoteRebindPendingRef.current = false;
        refreshRemoteStreamBinding();
      }
    };

    // A Socket.IO (signaling) reconnect is a different transport than the
    // already-established WebRTC/ICE media path — if the peer connection
    // itself was never affected by the blip (a common case: the signaling
    // socket times out through a proxy while the UDP/TURN media path
    // survives untouched), neither onconnectionstatechange nor
    // oniceconnectionstatechange ever fires again (no real state transition
    // happened), so nothing would otherwise clear a "reconnecting" UI state
    // set elsewhere — permanently stranding the UI over a call that's
    // actually still working. Called after every (re)join to resync
    // immediately from the peer connection's actual current state instead
    // of waiting on an event that may never come. Safe to call even when
    // nothing changed — handleConnectedState only resets state/timers to
    // the same values and restarts stats polling, and creates no offers.
    // Mirrors VideoCall.jsx's resyncConnectionStateFromPeerConnection.
    const resyncConnectionStateFromPeerConnection = () => {
      const pc = pcRef.current;
      if (!mountedRef.current || !pc || pc.signalingState === "closed") return;
      const isConnected =
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed";
      if (isConnected) handleConnectedState();
    };

    // Assigned to networkRecoveryRef so the online/offline effect below can
    // invoke it — same cross-effect pattern kickIceRecoveryRef already uses.
    // The browser's "online" event typically fires much faster than
    // WebRTC's own ICE consent-check can notice a dead transport (that can
    // take 20-30s+), so this can run well before — or entirely instead of —
    // any onconnectionstatechange/oniceconnectionstatechange transition.
    // Gives the existing ICE stack a short, fixed settle window (the same
    // ICE_RESTART_DELAY_MS scheduleIceRestart already uses — no new timing
    // constant introduced) to either genuinely fail (in which case the
    // untouched connection-state handlers and scheduleIceRestart's own
    // timer already own recovery from there) or silently self-heal; only
    // once neither of those is going to trigger a rebind on its own does
    // this proactively run the exact same rebind handleConnectedState()
    // already trusts for the analogous "recovered, same track" case.
    // Idempotent and race-safe: remoteRebindPendingRef is the single shared
    // signal armed just below — if a genuine disconnect/reconnect cycle
    // beats this to it, handleConnectedState() will already have cleared
    // the flag by the time this checks it, and this becomes a no-op.
    networkRecoveryRef.current = () => {
      if (networkRecoveryInProgressRef.current) return;
      if (!mountedRef.current || reconnectInProgressRef.current) return;
      const pc = pcRef.current;
      if (
        !pc ||
        pc.signalingState === "closed" ||
        !hasConnectedOnceRef.current
      )
        return;
      // Arm the same rebind flag the disconnected/failed branches below
      // use — see this function's doc comment for why "online" can fire
      // before remoteRebindPendingRef has otherwise been armed.
      remoteRebindPendingRef.current = true;
      networkRecoveryInProgressRef.current = true;
      window.setTimeout(() => {
        networkRecoveryInProgressRef.current = false;
        const currentPc = pcRef.current;
        if (
          !mountedRef.current ||
          currentPc !== pc ||
          pc.signalingState === "closed"
        )
          return;
        const stillConnected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        if (!stillConnected) return; // unhealthy — existing handlers/scheduleIceRestart own recovery from here
        if (!remoteRebindPendingRef.current) return; // already consumed by a real reconnect in the meantime
        handleConnectedState();
      }, ICE_RESTART_DELAY_MS);
    };

    const handleChatMessage = ({ senderName, text, createdAt } = {}) => {
      if (!mountedRef.current || !text) return;
      setMessages((prev) => [
        ...prev,
        { senderName, text, createdAt, mine: false, _localKey: makeMessageKey() },
      ]);
    };

    // Guarantees local mic/camera media exists before the connection is
    // built. The pre-join preview normally captured it already (fast path:
    // returns immediately). This also covers the guest clicking "Join now"
    // before capture finished, and a transient capture failure that has
    // since cleared. The pre-join mic/camera choices are applied to any
    // freshly-captured tracks. Returns the stream, or null when the device
    // genuinely can't/won't provide media — the call then proceeds
    // receive-only rather than not connecting at all.
    const ensureLocalMedia = async () => {
      if (!localStreamRef.current) {
        let stream = null;
        try {
          stream = (await localMediaPromiseRef.current) || null;
        } catch {
          stream = null;
        }
        if (!mountedRef.current) {
          stream?.getTracks().forEach((track) => track.stop());
          return null;
        }
        if (!stream && !localStreamRef.current) {
          try {
            stream = await getCallMediaStream();
          } catch (err) {
            console.warn(
              "[direct-video-call] proceeding without local media:",
              err?.message || err,
            );
            stream = null;
          }
          if (!mountedRef.current) {
            stream?.getTracks().forEach((track) => track.stop());
            return null;
          }
        }

        // A concurrent path already adopted a stream — keep that one.
        if (localStreamRef.current) {
          if (stream && stream !== localStreamRef.current) {
            stream.getTracks().forEach((track) => track.stop());
          }
        } else if (stream) {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = micOnRef.current;
          });
          stream.getVideoTracks().forEach((track) => {
            track.enabled = camOnRef.current;
          });
          localStreamRef.current = stream;
          assignStreams(isSwappedRef.current);
        }
      }

      const stream = localStreamRef.current;
      setLocalAudioMissing((stream?.getAudioTracks().length ?? 0) === 0);
      return stream;
    };

    // Called from handlePeerJoined, never from handleRoomJoined directly:
    // creating the RTCPeerConnection immediately on joining used to add
    // tracks before anyone else was in the room, which fires
    // onnegotiationneeded (and starts ICE gathering) into a socket room with
    // nobody listening — the resulting offer and early ICE candidates were
    // silently dropped, and the peer that made it never re-sent them, so the
    // call got permanently stuck at "connecting" whenever the first guest
    // joined even a moment before the second. Waiting for confirmation that
    // a peer is actually present (self-emitted immediately by the server if
    // one was already there, or on their later join) guarantees the offer
    // always has a listener. pcRef.current + the setup-generation token guard
    // against handlePeerJoined firing more than once (e.g. a peer briefly
    // reconnecting) racing two builds.
    const setupPeerConnection = async () => {
      if (pcRef.current) return;
      const generation = (pcSetupGenerationRef.current += 1);
      // True once this run has been superseded (a newer setup, a teardown, a
      // peer-left, an unmount) or a connection already exists.
      const isStale = () =>
        !mountedRef.current ||
        pcRef.current ||
        pcSetupGenerationRef.current !== generation ||
        !peerPresentRef.current;

      // fetchDirectRoomIceConfig never resolves to null, but keep a floor here
      // too so a rejected promise can't reach `new RTCPeerConnection(null)`.
      const iceConfig = (await iceConfigPromiseRef.current) || RTC_CONFIG || STUN_ONLY_FALLBACK;
      if (isStale()) return;

      // Warn (once we're actually building the connection) if the config we
      // ended up with has no TURN relay — on a deployed build that means the
      // backend's /ice-servers is misconfigured or unreachable and we fell
      // back to STUN-only, which fails across strict NATs.
      if (mountedRef.current) {
        setIceRelayWarning(
          import.meta.env.PROD && !hasTurnServer(iceConfig?.iceServers),
        );
      }

      // Make sure our audio/video is captured before the peer connection is
      // created, so a guest who joined faster than getUserMedia resolved is
      // never left publishing nothing. Fast path when the preview already
      // captured it.
      const stream = await ensureLocalMedia();
      if (isStale()) return;

      let pc;
      try {
        pc = new RTCPeerConnection(iceConfig);
      } catch (err) {
        console.error("[direct-video-call] RTCPeerConnection construction failed:", err);
        handleRoomError({
          code: "server_error",
          msg: "Could not start the video call on this browser or device.",
        });
        return;
      }
      // Nothing above awaited between isStale() and here, but guard the
      // handoff anyway so a superseded run can't publish its pc.
      if (isStale()) {
        pc.close();
        return;
      }
      pcRef.current = pc;
      pcCreatedAtRef.current = Date.now();
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "setupPeerConnection:new_pc_created", {
        reconnectInProgress: reconnectInProgressRef.current,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("direct-ice-candidate", { roomId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = remoteStreamRef.current;
        const incomingTracks = event.streams?.[0]
          ? event.streams[0].getTracks()
          : [event.track].filter(Boolean);

        // Set when this event actually swaps out a previously-live track for
        // a given kind (as opposed to a first-time add) — see the
        // trackWasReplaced branch below for why that case needs more than an
        // in-place mutation of remoteStreamRef.current. Mirrors VideoCall.jsx's
        // identical trackWasReplaced detection in its own pc.ontrack.
        let trackWasReplaced = false;

        incomingTracks.forEach((track) => {
          const staleTracksOfKind = remoteStream
            .getTracks()
            .filter((existing) => existing.kind === track.kind && existing.id !== track.id);
          if (staleTracksOfKind.length > 0) trackWasReplaced = true;
          staleTracksOfKind.forEach((stale) => remoteStream.removeTrack(stale));
          if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track);

          // A receiver's track fires "mute" when RTP stops arriving for that
          // specific SSRC (e.g. the sender's encoder hiccups, or a transient
          // bandwidth squeeze starves video while audio keeps flowing)
          // without any change to the overall connection/ICE state — none
          // of the reconnection machinery above is reachable from that, so
          // without an explicit listener the <video> element is left frozen
          // on its last frame indefinitely even though audio (no comparable
          // per-frame pipeline to freeze) recovers on its own. Reassigning
          // this on every ontrack firing for this track is safe/idempotent —
          // a plain property assignment, not an accumulating listener list.
          // Mirrors the identical fix in VideoCall.jsx's pc.ontrack.
          track.onunmute = () => {
            if (!mountedRef.current) return;
            refreshRemoteStreamBinding();
          };
        });

        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "pc.ontrack", {
          trackWasReplaced,
          tracks: incomingTracks.map((track) => ({
            kind: track.kind,
            id: track.id,
            readyState: track.readyState,
            muted: track.muted,
            enabled: track.enabled,
          })),
          streamCount: event.streams?.length || 0,
          attachTarget: isSwappedRef.current ? "pipVideoRef(remote)" : "mainVideoRef(remote)",
        });

        if (trackWasReplaced) {
          // The remote peer recreated their whole RTCPeerConnection (e.g. a
          // page refresh) while this side's pc stayed alive — the new track
          // has a different id but was just added into the SAME MediaStream
          // object above (remoteStreamRef.current is otherwise only ever
          // mutated in place, never reassigned), so the plain srcObject
          // reassignment assignStreams() does can be a no-op in some
          // browsers, leaving video frozen on the old track's last frame.
          // refreshRemoteStreamBinding() forces a genuine source change —
          // same fix VideoCall.jsx's own trackWasReplaced branch applies —
          // and already calls assignStreams() itself, so it replaces the
          // plain call below rather than running alongside it.
          refreshRemoteStreamBinding();
        } else {
          assignStreams(isSwappedRef.current);
        }
      };

      pc.onnegotiationneeded = async () => {
        // Only one setLocalDescription(offer) may be in flight per side for
        // perfect-negotiation glare handling to work. Bail if we're already
        // negotiating (our own offer in flight) or mid-processing a remote
        // one — otherwise an implicit offer from here can race an in-flight
        // handleOffer and leave both peers stuck in "have-local-offer".
        if (
          pc.signalingState !== "stable" ||
          makingOfferRef.current ||
          ignoreOfferRef.current
        )
          return;
        try {
          makingOfferRef.current = true;
          // Explicit createOffer()/setLocalDescription(offer) — the implicit
          // no-arg form isn't supported on older Safari / in-app WebViews.
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable") return; // a remote offer raced in
          await pc.setLocalDescription(offer);
          const offerId = makeOfferId();
          pendingOfferIdRef.current = offerId;
          // TEMPORARY (RETRY_DEBUG)
          retryDebugLog(
            isInitiatorRef.current ? "initiator" : "guest",
            roomId,
            "onnegotiationneeded:offer_sent",
            {
              offerId,
              reconnectInProgress: reconnectInProgressRef.current,
              dtlsFingerprint: extractDtlsFingerprint(pc.localDescription?.sdp),
            },
          );
          socket.emit("direct-video-offer", { roomId, offer: pc.localDescription, offerId });
          armOfferAnswerTimeout(offerId);
        } catch (err) {
          console.error("[direct-video-call] negotiationneeded failed", err);
        } finally {
          makingOfferRef.current = false;
        }
      };

      pc.onconnectionstatechange = () => {
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "onconnectionstatechange", {
          oldState: retryDebugPrevConnStateRef.current,
          newState: pc.connectionState,
        });
        retryDebugPrevConnStateRef.current = pc.connectionState;
        if (!mountedRef.current) return;
        if (pc.connectionState === "connected") {
          handleConnectedState();
        } else if (
          (pc.connectionState === "disconnected" || pc.connectionState === "failed") &&
          peerPresentRef.current
        ) {
          setCallStatus("reconnecting");
          stopStatsCollection();
          if (hasConnectedOnceRef.current) remoteRebindPendingRef.current = true;
          scheduleIceRestart();
          if (hasConnectedOnceRef.current) startReconnectStallWatch(RECONNECT_STALL_MS);
        } else if (pc.connectionState === "connecting" && peerPresentRef.current) {
          startConnectionWatchdog();
        }
      };

      // Fallback for browsers/platforms where onconnectionstatechange fires
      // late or not at all — same reasoning as VideoCall.jsx's pairing of
      // the two handlers.
      pc.oniceconnectionstatechange = () => {
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "oniceconnectionstatechange", {
          oldState: retryDebugPrevIceStateRef.current,
          newState: pc.iceConnectionState,
        });
        retryDebugPrevIceStateRef.current = pc.iceConnectionState;
        if (!mountedRef.current) return;
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          handleConnectedState();
        } else if (
          (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") &&
          peerPresentRef.current
        ) {
          setCallStatus("reconnecting");
          stopStatsCollection();
          if (hasConnectedOnceRef.current) remoteRebindPendingRef.current = true;
          scheduleIceRestart();
          if (hasConnectedOnceRef.current) startReconnectStallWatch(RECONNECT_STALL_MS);
        } else if (pc.iceConnectionState === "checking" && peerPresentRef.current) {
          startConnectionWatchdog();
        }
      };

      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
          // TEMPORARY (RETRY_DEBUG)
          retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "setupPeerConnection:track_added", {
            kind: track.kind,
            id: track.id,
          });
        });
      }

      // If this side has no camera and/or mic to publish (both permissions
      // denied, no devices, or device busy), add a recv-only transceiver for
      // the missing kind(s). Without at least one transceiver this side
      // never fires onnegotiationneeded — and if *both* peers are media-less
      // no offer is ever created and the call hangs on "Connecting…".
      // recv-only keeps us receiving the other participant. A fresh PC has
      // no transceivers yet, and addTrack above already covers the kinds we
      // do have, so this can't produce a duplicate m-section.
      const localAudioCount = stream ? stream.getAudioTracks().length : 0;
      const localVideoCount = stream ? stream.getVideoTracks().length : 0;
      try {
        if (localAudioCount === 0) pc.addTransceiver("audio", { direction: "recvonly" });
        if (localVideoCount === 0) pc.addTransceiver("video", { direction: "recvonly" });
      } catch (err) {
        console.warn("[direct-video-call] addTransceiver fallback failed", err);
      }

      // Replay an offer that landed while this PC was still being built — see
      // pendingRemoteOfferRef. Any ICE candidates buffered alongside it are
      // drained by flushPendingCandidates() inside handleOffer once the
      // remote description is set.
      const bufferedOffer = takeStashedOffer();
      if (bufferedOffer) {
        void handleOffer(bufferedOffer);
      }
    };
    setupPeerConnectionRef.current = setupPeerConnection;
    requestPcRebuildRef.current = requestPcRebuild;

    // See kickIceRecoveryRef's declaration — invoked directly from the
    // browser's "online" event so a network path recovering while the
    // socket itself never dropped still gets a prompt recovery check.
    kickIceRecoveryRef.current = () => {
      const pc = pcRef.current;
      if (
        !mountedRef.current ||
        !peerPresentRef.current ||
        !pc ||
        pc.signalingState === "closed"
      )
        return;
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      )
        return;
      scheduleIceRestart();
    };

    const handleRoomJoined = ({ isInitiator, resumedCall } = {}) => {
      if (!mountedRef.current) return;
      isInitiatorRef.current = !!isInitiator;
      if (resumedCall) resumedSessionRef.current = true;
      // A resume (the server recognised this guest from an earlier session in
      // this room) means media was likely already flowing before we
      // reloaded — show "reconnecting" rather than "connecting"/"waiting" so
      // the two ends aren't left displaying contradictory states while the
      // connection re-establishes. A fresh join keeps the original behaviour.
      setCallStatus((prev) => {
        if (prev === "connected") return prev;
        if (resumedCall) return "reconnecting";
        return isInitiator ? "connecting" : "waiting";
      });
      // Peer connection setup is deferred to handlePeerJoined — see the
      // comment on setupPeerConnection for why.
    };

    const joinRoom = () => {
      socket.emit("join-direct-room", { roomId, guestId: guestIdRef.current, name: guestName });
      resyncConnectionStateFromPeerConnection();
    };

    // Socket.IO v4 event order on a reconnect: the Manager's "reconnect"
    // fires as soon as the Engine.IO transport opens — BEFORE the namespace
    // CONNECT handshake completes and therefore before the socket's own
    // "connect" event. socket.on("connect", joinRoom) below already re-emits
    // join-direct-room for this reconnect (including when
    // connectionStateRecovery restores the session). An emit made from THIS
    // handler happens while socket.connected is still false, so socket.io
    // buffers it and flushes it just before the "connect" handlers run —
    // which then emit a second time. That double emit was the source of the
    // duplicate join confirmed in production (two join-direct-room calls
    // ~200ms apart, two direct-peer-joined broadcasts), so this handler no
    // longer joins itself. It only does its own follow-up: if our own
    // PeerConnection still looks unhealthy a beat after the reconnect,
    // proactively drive recovery instead of only waiting on a
    // connectionstatechange transition. Mirrors VideoCall.jsx's
    // handleSocketReconnect.
    const handleSocketReconnect = () => {
      if (!mountedRef.current) return;
      window.setTimeout(() => {
        const pc = pcRef.current;
        if (
          !mountedRef.current ||
          !peerPresentRef.current ||
          !socket.connected ||
          !pc ||
          pc.signalingState === "closed"
        )
          return;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        )
          return;
        if (isInitiatorRef.current) {
          void createAndSendIceRestartOffer();
        } else {
          requestPeerIceRestart();
        }
      }, 500);
    };

    const sampleInboundBytes = async (pc) => {
      try {
        const stats = await pc.getStats();
        for (const report of stats.values()) {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            if (typeof report.bytesReceived === "number") return report.bytesReceived;
          }
        }
      } catch {
        // Unknown, not stalled — see handleVisibilityChange's null handling.
      }
      return null;
    };

    // A browser tab can be throttled or fully frozen while hidden (most
    // aggressively on mobile Safari/Chrome), which can silently kill the
    // underlying connection without pc.onconnectionstatechange ever getting
    // a chance to run — so pc.connectionState can still read "connected"
    // purely because nothing updated it since the freeze. Take two
    // inbound-bytes samples ~1.5s apart on the already-selected candidate
    // pair on resume, and only force a restart if there's zero growth — a
    // connected call should always show some growth from RTP/RTCP
    // keepalives even during silence/camera-off. Mirrors VideoCall.jsx's
    // identical guard.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible" || !mountedRef.current) return;
      // The local self-view (pip) can be suspended by the browser/OS while
      // the tab/app is backgrounded — common on mobile — even though the
      // underlying camera track and its WebRTC transmission to the peer
      // keep running unaffected (a separate pipeline from the local
      // preview's decode/render). Replay it explicitly on return instead of
      // leaving it stuck on a frozen/black frame. Independent of
      // socket/remote-connection state below, since it's a purely local
      // media-element concern — does not touch or gate the existing
      // remote-connection recovery check that follows.
      void playAssignedVideos();
      if (!socket.connected) {
        socket.connect();
        return;
      }
      if (verifyingVisibilityRef.current) return;
      verifyingVisibilityRef.current = true;
      try {
        const pc = pcRef.current;
        if (!pc || pc.signalingState === "closed") return;
        const isConnected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        if (!isConnected) return; // already unhealthy — the normal state-change handlers own this

        const before = await sampleInboundBytes(pc);
        if (!mountedRef.current || pcRef.current !== pc) return;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        if (!mountedRef.current || pcRef.current !== pc) return;
        const stillConnected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        if (!stillConnected) return; // a real state-change callback already took over

        const after = await sampleInboundBytes(pc);
        if (!mountedRef.current || pcRef.current !== pc) return;
        if (before === null || after === null || after > before) return;

        console.warn(
          '[direct-video-call] tab resumed with a stale "connected" state — no inbound media progress, forcing recovery.',
        );
        if (!isInitiatorRef.current) {
          requestPeerIceRestart();
        } else {
          void createAndSendIceRestartOffer();
        }
      } finally {
        verifyingVisibilityRef.current = false;
      }
    };

    socket.on("connect", joinRoom);
    socket.io.on("reconnect", handleSocketReconnect);
    socket.on("direct-room-joined", handleRoomJoined);
    socket.on("direct-room-error", handleRoomError);
    socket.on("direct-peer-joined", handlePeerJoined);
    socket.on("direct-participant-left", handleParticipantLeft);
    socket.on("direct-room-closed", handleRoomClosed);
    socket.on("direct-duplicate-session", handleDuplicateSession);
    socket.on("direct-video-offer", handleOffer);
    socket.on("direct-video-answer", handleAnswer);
    socket.on("direct-ice-candidate", handleIceCandidate);
    socket.on("direct-ice-restart-request", handleIceRestartRequest);
    socket.on("direct-room-message", handleChatMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    assignStreams(isSwappedRef.current);

    if (socket.connected) joinRoom();
    else socket.connect();

    return () => {
      // Allow this effect's setup to run again if `stage` ever re-enters
      // "call" later (e.g. a future rejoin-after-error flow) — everything
      // below already tears down cleanly, so there's nothing unsafe about
      // running setup again after this cleanup completes.
      startedRef.current = false;
      socket.off("connect", joinRoom);
      socket.io.off("reconnect", handleSocketReconnect);
      socket.off("direct-room-joined", handleRoomJoined);
      socket.off("direct-room-error", handleRoomError);
      socket.off("direct-peer-joined", handlePeerJoined);
      socket.off("direct-participant-left", handleParticipantLeft);
      socket.off("direct-room-closed", handleRoomClosed);
      socket.off("direct-duplicate-session", handleDuplicateSession);
      socket.off("direct-video-offer", handleOffer);
      socket.off("direct-video-answer", handleAnswer);
      socket.off("direct-ice-candidate", handleIceCandidate);
      socket.off("direct-ice-restart-request", handleIceRestartRequest);
      socket.off("direct-room-message", handleChatMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cleanupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, roomId]);

  const retryPreview = useCallback(() => {
    setPreviewAttempt((n) => n + 1);
  }, []);

  // Track state is flipped from a ref and committed with a plain setState —
  // the enable/disable of the MediaStreamTrack is a side effect and must not
  // live inside a setState updater (React can invoke those more than once).
  const togglePreviewMic = useCallback(() => {
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (audioTracks.length === 0) return;
    const next = !previewMicOnRef.current;
    audioTracks.forEach((track) => {
      track.enabled = next;
    });
    previewMicOnRef.current = next;
    setPreviewMicOn(next);
  }, []);

  const togglePreviewCam = useCallback(() => {
    const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (videoTracks.length === 0) return;
    const next = !previewCamOnRef.current;
    videoTracks.forEach((track) => {
      track.enabled = next;
    });
    previewCamOnRef.current = next;
    setPreviewCamOn(next);
  }, []);

  const joinMeeting = useCallback(
    (event) => {
      event.preventDefault();
      if (joining) return;

      const trimmedName = guestName.trim().slice(0, 60);
      if (!trimmedName) {
        // Previously a blank/whitespace name silently became "Guest" with no
        // feedback — ask for one (they can still type "Guest" explicitly).
        setNameError(
          'Please enter your name so the other participant knows who joined (or type "Guest").',
        );
        setGuestName("");
        nameInputRef.current?.focus();
        return;
      }

      setNameError("");
      setJoining(true);
      setGuestName(trimmedName);
      try {
        localStorage.setItem(NAME_STORAGE_KEY, trimmedName);
      } catch {
        // Storage unavailable — non-fatal, just won't be remembered next time.
      }
      // Carry the pre-join choices into the call, refs included so
      // setupPeerConnection reads the right value without waiting for a
      // re-render.
      micOnRef.current = previewMicOn;
      camOnRef.current = previewCamOn;
      setMicOn(previewMicOn);
      setCamOn(previewCamOn);
      joinedRef.current = true;
      setStage("call");
    },
    [joining, guestName, previewMicOn, previewCamOn],
  );

  // Side effect (enabling/disabling the track) is kept out of the setState
  // updater; state is derived from a ref so rapid toggles stay consistent.
  const toggleMic = useCallback(() => {
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    // Nothing to toggle if the mic was never granted / captured — leave the
    // button showing "muted" rather than flipping to a misleading "live".
    if (audioTracks.length === 0) return;
    const next = !micOnRef.current;
    audioTracks.forEach((track) => {
      track.enabled = next;
    });
    micOnRef.current = next;
    setMicOn(next);
  }, []);

  const toggleCam = useCallback(() => {
    const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (videoTracks.length === 0) return;
    const next = !camOnRef.current;
    videoTracks.forEach((track) => {
      track.enabled = next;
    });
    camOnRef.current = next;
    setCamOn(next);
  }, []);

  // Re-attempt getUserMedia mid-call and publish whatever new tracks it
  // returns onto the live connection — for a guest who joined with the mic
  // (or camera) denied / busy and has since granted access or freed the
  // device, so they don't have to leave and rejoin. replaceTrack on an
  // existing sender needs no renegotiation; addTrack for a kind we weren't
  // sending triggers the normal onnegotiationneeded path.
  const retryInCallMedia = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === "closed" || retryingInCallMediaRef.current) return;
    retryingInCallMediaRef.current = true;
    setRetryingInCallMedia(true);
    try {
      const fresh = await getCallMediaStream();
      if (!mountedRef.current || pcRef.current !== pc || pc.signalingState === "closed") {
        fresh.getTracks().forEach((track) => track.stop());
        return;
      }
      const base = localStreamRef.current || new MediaStream();
      fresh.getTracks().forEach((track) => {
        track.enabled = track.kind === "audio" ? micOnRef.current : camOnRef.current;
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          const previous = sender.track;
          sender.replaceTrack(track).catch((err) =>
            console.warn("[direct-video-call] replaceTrack during retry failed", err),
          );
          if (previous && previous !== track) {
            previous.stop();
            base.removeTrack(previous);
          }
        } else {
          pc.addTrack(track, base);
        }
        if (!base.getTrackById(track.id)) base.addTrack(track);
      });
      localStreamRef.current = base;
      setLocalAudioMissing(base.getAudioTracks().length === 0);
      assignStreams(isSwappedRef.current);
    } catch (err) {
      console.warn(
        "[direct-video-call] in-call media retry failed:",
        err?.message || err,
      );
    } finally {
      retryingInCallMediaRef.current = false;
      if (mountedRef.current) setRetryingInCallMedia(false);
    }
  }, [assignStreams]);

  const toggleSwap = useCallback(() => {
    const next = !isSwappedRef.current;
    // Update the ref synchronously (as toggleMic/toggleCam do) so a rapid
    // double-tap resolves to the right end state, and re-point the
    // <video>/<audio> sinks now rather than from inside a setState updater.
    isSwappedRef.current = next;
    setIsSwapped(next);
    assignStreams(next);
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
      } else if (pageEl.requestFullscreen) {
        await pageEl.requestFullscreen();
      }
    } catch (err) {
      console.error("[direct-video-call] Fullscreen toggle failed:", err);
    }
  }, []);

  const leaveCall = useCallback(() => {
    setLeaveConfirmOpen(false);
    cleanupCall();
    setStage("ended");
  }, [cleanupCall]);

  // Every path that would drop the call — the "Leave Call" button, a mobile
  // back-swipe/gesture, the hardware back button — routes through here so the
  // user gets one confirmation instead of the call ending silently.
  const requestLeave = useCallback(() => {
    setLeaveConfirmOpen(true);
  }, []);

  const cancelLeave = useCallback(() => {
    setLeaveConfirmOpen(false);
  }, []);

  // ── Intercept back navigation / tab close while in the call ──────────────
  // The appointment VideoCall screen already guards this; the Direct call
  // screen previously did not, so a back-swipe on mobile (a common way to
  // dismiss a panel) unmounted the page and ended the call with no warning.
  useEffect(() => {
    if (stage !== "call") return;

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      // Re-push so a second back press is needed to actually leave, and
      // surface the confirmation.
      window.history.pushState(null, "", window.location.href);
      setLeaveConfirmOpen(true);
    };
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stage]);

  // Manual escape hatch when automatic ICE-restart recovery is taking too
  // long: tears down and rebuilds just the RTCPeerConnection (not the
  // socket room membership, which the existing connect/join flow already
  // owns) and lets renegotiation happen the same way it does on first
  // connect. Mirrors VideoCall.jsx's forceReconnect.
  const forceReconnect = useCallback(() => {
    if (reconnectInProgressRef.current) return;
    // TEMPORARY (RETRY_DEBUG)
    retryDebugLog(isInitiatorRef.current ? "initiator" : "guest", roomId, "forceReconnect:TAPPED", {
      pcConnectionState: pcRef.current?.connectionState ?? null,
      pcIceConnectionState: pcRef.current?.iceConnectionState ?? null,
    });
    reconnectInProgressRef.current = true;
    setManualReconnecting(true);
    setReconnectStalled(false);
    clearTimeout(reconnectStallTimerRef.current);
    reconnectStallTimerRef.current = null;
    // Re-fetch ICE servers so the rebuilt connection gets fresh TURN
    // credentials — the ones from page load may have expired on a long call,
    // and a transient /ice-servers failure at load may since have cleared.
    iceConfigPromiseRef.current = fetchDirectRoomIceConfig(roomId);
    setCallStatus("connecting");

    // Keep a safety net under the forced rebuild: if this attempt also
    // stalls, the watchdog kicks ICE recovery and the stall banner comes
    // back rather than the user staring at a silent "connecting" again.
    armConnectWatchdogsRef.current();

    // Held (button disabled, banner kept up showing "Reconnecting…") until
    // the rebuilt connection is healthy (handleConnectedState calls
    // releaseManualReconnectGuard) or 5s pass, whichever comes first — NOT
    // merely until the rebuild call returns, which is well before the new
    // connection actually works.
    manualReconnectCooldownTimerRef.current = window.setTimeout(releaseManualReconnectGuard, 5000);

    if (socket.connected) {
      // The actual teardown/rebuild is delegated to requestPcRebuild
      // (manual: true) — it bypasses the automatic-rebuild rate limit and,
      // if an automatic rebuild happens to already be in flight, preempts
      // it rather than coalescing, since a person tapping Retry is explicit
      // intent that should always take effect. Also clears
      // iceRestartTimerRef/connectionFailTimerRef/iceRecoveryAttemptsRef as
      // part of its own teardown, so those don't need repeating here.
      void requestPcRebuildRef.current("manual_retry", { manual: true });
    } else {
      socket.connect();
      releaseManualReconnectGuard();
    }
  }, [roomId, releaseManualReconnectGuard]);

  const sendChatMessage = useCallback(
    (event) => {
      event.preventDefault();
      if (chatSendCooldownTimerRef.current) return;
      const text = chatText.trim();
      if (!text) return;
      socket.emit("direct-room-message", { roomId, text });
      setMessages((prev) => [
        ...prev,
        {
          senderName: guestName || "You",
          text,
          createdAt: new Date().toISOString(),
          mine: true,
          _localKey: makeMessageKey(),
        },
      ]);
      setChatText("");
      setChatSendCoolingDown(true);
      chatSendCooldownTimerRef.current = window.setTimeout(() => {
        chatSendCooldownTimerRef.current = null;
        setChatSendCoolingDown(false);
      }, CHAT_SEND_COOLDOWN_MS);
    },
    [chatText, roomId, guestName],
  );

  useEffect(() => () => window.clearTimeout(chatSendCooldownTimerRef.current), []);

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

  // ── Render: terminal / setup states ────────────────────────────────────────
  if (stage === "checking") {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-spinner" />
        <p>Checking your meeting link...</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">
          <FiAlertTriangle />
        </div>
        <h2>Can't join this meeting</h2>
        <p>{errorInfo?.msg}</p>
        <Link to="/" className="hc-vc__gate-btn">
          Return Home
        </Link>
      </div>
    );
  }

  if (stage === "ended") {
    return (
      <div className="hc-vc__gate">
        <h2>Call ended</h2>
        <p>
          {endedReason === "closed"
            ? "This meeting was ended by the host."
            : "You have left the meeting."}
        </p>
        <Link to="/" className="hc-vc__gate-btn">
          Return Home
        </Link>
      </div>
    );
  }

  if (stage === "prejoin") {
    return (
      <div className="dvcall-page dvcall-page--center">
        <div className="dvcall-prejoin-card">
          <h2>Ready to join?</h2>
          {roomFullHint && (
            <p className="dvcall-prejoin-form__error" role="status">
              This meeting looks full (two participants already joined). You can
              still try — you&apos;ll be let back in if one of them is you.
            </p>
          )}
          <div className="dvcall-prejoin-preview">
            <video ref={previewVideoRef} autoPlay playsInline muted />
            {previewError && (
              <div className="dvcall-prejoin-preview__error">
                <FiAlertTriangle />
                <span>{previewError}</span>
              </div>
            )}
            <div className="dvcall-prejoin-preview__controls">
              <button
                type="button"
                className={`dvcall-ctrl ${!previewMicOn ? "dvcall-ctrl--off" : ""}`}
                onClick={togglePreviewMic}
              >
                {previewMicOn ? <FiMic /> : <FiMicOff />}
              </button>
              <button
                type="button"
                className={`dvcall-ctrl ${!previewCamOn ? "dvcall-ctrl--off" : ""}`}
                onClick={togglePreviewCam}
              >
                {previewCamOn ? <FiVideo /> : <FiVideoOff />}
              </button>
            </div>
          </div>

          {previewError && (
            <button type="button" className="dvcall-btn-secondary" onClick={retryPreview}>
              Retry Camera/Mic
            </button>
          )}

          <form className="dvcall-prejoin-form" onSubmit={joinMeeting}>
            <input
              ref={nameInputRef}
              type="text"
              value={guestName}
              maxLength={60}
              placeholder="Your name"
              aria-label="Your name"
              aria-invalid={nameError ? "true" : undefined}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (nameError) setNameError("");
              }}
              autoFocus
            />
            {nameError && (
              <p className="dvcall-prejoin-form__error" role="alert">
                {nameError}
              </p>
            )}
            <button type="submit" className="dvcall-btn-primary" disabled={joining}>
              {joining ? "Joining…" : "Join now"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const waitingForPeer = callStatus === "waiting";
  const connecting = callStatus === "connecting";
  const reconnecting = callStatus === "reconnecting";
  const connected = callStatus === "connected";

  const pipStyle =
    pipPos.x !== null
      ? {
          position: "fixed",
          left: `${pipPos.x}px`,
          top: `${pipPos.y}px`,
          right: "auto",
          bottom: "auto",
        }
      : {};

  return (
    <div className="hc-vc__page" ref={pageRef}>
      <div className="hc-vc__ctrlbar-meta">
        <div className="hc-vc__meta-left">
          <div className="hc-vc__logo-mark">
            <img src={HumancareLogo} alt="Humancare Connect" className="hc-vc__logo-img" />
          </div>
        </div>

        <div className="hc-vc__meta-party">
          <span className="hc-vc__meta-party-icon">
            <FiUser />
          </span>
          <div className="hc-vc__meta-party-text">
            <span className="hc-vc__infobar-label">Participant</span>
            <span className="hc-vc__infobar-name">{peerName || "Guest"}</span>
          </div>
        </div>
      </div>

      {isOffline && (
        <div className="hc-vc__offline-banner">
          <FiAlertTriangle /> You're offline. Reconnecting once your internet is back.
        </div>
      )}

      {iceRelayWarning && !isOffline && (
        <div className="hc-vc__offline-banner hc-vc__relay-warning">
          <FiAlertTriangle /> Connection relay unavailable — this call may not
          connect on some networks.
        </div>
      )}

      <div className={`hc-vc__body ${chatOpen ? "hc-vc__body--chat" : ""}`}>
        <div className="hc-vc__stage">
          <div className="hc-vc__main-wrap">
            <video
              ref={setMainVideoRef}
              autoPlay
              playsInline
              muted
              className={`hc-vc__main-video${isSwapped ? " hc-vc__video--local" : ""}${isMainVideoPortrait ? " hc-vc__main-video--portrait" : ""}`}
            />

            {localAudioMissing && (
              <div className="hc-vc__local-audio-notice">
                <FiMicOff />
                <span>
                  Your microphone isn&apos;t available — the other participant
                  can&apos;t hear you. Check permissions or close any app using
                  the mic.
                </span>
                <button
                  type="button"
                  className="hc-vc__local-audio-retry"
                  onClick={retryInCallMedia}
                  disabled={retryingInCallMedia}
                >
                  {retryingInCallMedia ? "Retrying…" : "Retry"}
                </button>
              </div>
            )}

            {!connected && (
              <div className="hc-vc__waiting">
                <div className="hc-vc__waiting-ring">
                  <div className="hc-vc__waiting-avatar-wrap">
                    <span className="hc-vc__waiting-icon">
                      <FiUser />
                    </span>
                  </div>
                </div>
                <p className="hc-vc__waiting-title">
                  {waitingForPeer && "Waiting for the other participant to join..."}
                  {connecting && `Connecting${peerName ? ` to ${peerName}` : ""}...`}
                  {reconnecting && "Reconnecting..."}
                </p>
                <p className="hc-vc__waiting-sub">
                  {waitingForPeer && "Share the meeting link with the other person to begin."}
                  {connecting && "Both participants are ready. Video starting soon."}
                  {reconnecting && "Restoring your connection to the call."}
                </p>
              </div>
            )}

            {/* Also kept up while a manual Retry is being held
                (manualReconnecting): the tap itself clears reconnectStalled,
                which used to make the banner — and its "Reconnecting…"
                button — vanish the instant it was pressed. */}
            {(reconnectStalled || manualReconnecting) && (
              <div className="hc-vc__reconnect-stalled-notice">
                <span>
                  <FiAlertTriangle />
                </span>
                <span>
                  {manualReconnecting
                    ? "Reconnecting to the call…"
                    : reconnectStallCountRef.current >= MAX_RECONNECT_STALL_RETRIES
                      ? "Still unable to reconnect. You can keep trying or end the call."
                      : "Reconnection is taking longer than expected."}
                </span>
                <button
                  type="button"
                  className="hc-vc__rx-btn-primary"
                  onClick={forceReconnect}
                  disabled={manualReconnecting}
                >
                  {manualReconnecting ? "Reconnecting…" : "Retry"}
                </button>
                {reconnectStallCountRef.current >= MAX_RECONNECT_STALL_RETRIES && (
                  <button type="button" className="hc-vc__rx-btn-ghost" onClick={leaveCall}>
                    End Call
                  </button>
                )}
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

            {peerLeftNotice && !connected && (
              <div className="hc-vc__peer-left-notice">
                <span>
                  <FiPhoneOff />
                </span>
                <span>The other participant left the meeting.</span>
              </div>
            )}
          </div>

          {!isSelfViewMinimized && (
            <div
              ref={pipRef}
              className={`hc-vc__pip ${!camOn && !isSwapped ? "hc-vc__pip--cam-off" : ""}`}
              style={pipStyle}
              onPointerDown={handlePipPointerDown}
              onPointerMove={handlePipPointerMove}
              onPointerUp={handlePipPointerUp}
            >
              <video
                ref={setPipVideoRef}
                autoPlay
                playsInline
                muted
                className={`hc-vc__pip-video${!isSwapped ? " hc-vc__video--local" : ""}${isPipVideoPortrait ? " hc-vc__pip-video--portrait" : ""}`}
              />

              {!camOn && !isSwapped && (
                <div className="hc-vc__pip-cam-off">
                  <span>
                    <FiVideoOff />
                  </span>
                </div>
              )}
              <button
                className="hc-vc__pip-min-btn"
                onClick={toggleSelfView}
                title="Minimize self view"
                aria-label="Minimize self view"
              >
                <FiMinimize2 />
              </button>

              <button
                className="hc-vc__pip-swap-btn"
                onClick={toggleSwap}
                title="Swap view"
                aria-label="Swap view"
              >
                <FiRefreshCw />
              </button>
            </div>
          )}

          {isSelfViewMinimized && (
            <button
              className="hc-vc__pip-restore-btn"
              onClick={toggleSelfView}
              title="Show self view"
              aria-label="Show self view"
            >
              <FiMaximize2 />
              <span>Self View</span>
            </button>
          )}

          {/* Remote audio output — always mounted, never inside a
              conditionally-rendered block. Both <video> elements are muted;
              the remote party's audio plays only through this element, so
              swapping views or hiding the self-view can't cut it. Kept
              rendered-but-invisible rather than display:none — some engines
              (older mobile Safari) won't start playback on a display:none
              media element. */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </div>

        {chatOpen && (
          <div className="hc-vc__chat">
            <div className="hc-vc__chat-head">
              <div className="hc-vc__chat-head-left">
                <span className="hc-vc__chat-icon">
                  <FiMessageSquare />
                </span>
                <span className="hc-vc__chat-title">In-call Chat</span>
              </div>
              <button
                className="hc-vc__chat-close-btn"
                onClick={() => setChatOpen(false)}
                title="Close chat"
                aria-label="Close chat"
              >
                <FiX />
              </button>
            </div>

            <div className="hc-vc__chat-body">
              {messages.length === 0 && (
                <div className="hc-vc__chat-empty">
                  <span>
                    <FiMessageSquare />
                  </span>
                  <p>No messages yet.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={msg._localKey ?? i}
                  className={`hc-vc__msg ${msg.mine ? "hc-vc__msg--mine" : "hc-vc__msg--theirs"}`}
                >
                  {!msg.mine && <div className="hc-vc__msg-name">{msg.senderName}</div>}
                  <div className="hc-vc__msg-bubble">{msg.text}</div>
                  <div className="hc-vc__msg-time">{fmtTime(msg.createdAt)}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form className="hc-vc__chat-foot" onSubmit={sendChatMessage}>
              <input
                className="hc-vc__chat-input"
                type="text"
                placeholder="Type a message..."
                value={chatText}
                maxLength={2000}
                onChange={(e) => setChatText(e.target.value)}
                autoComplete="off"
              />
              <button
                className="hc-vc__chat-send"
                type="submit"
                disabled={!chatText.trim() || chatSendCoolingDown}
                title="Send"
                aria-label="Send message"
              >
                <FiSend />
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="hc-vc__ctrlbar">
        <div className="hc-vc__ctrlbar-inner">
          <button
            className={`hc-vc__btn ${!micOn ? "hc-vc__btn--danger" : ""}`}
            onClick={toggleMic}
            title={micOn ? "Mute microphone" : "Unmute"}
          >
            <span className="hc-vc__btn-icon">{micOn ? <FiMic /> : <FiMicOff />}</span>
            <span className="hc-vc__btn-label">{micOn ? "Mute" : "Unmute"}</span>
          </button>

          <button
            className={`hc-vc__btn ${!camOn ? "hc-vc__btn--danger" : ""}`}
            onClick={toggleCam}
            title={camOn ? "Turn camera off" : "Turn camera on"}
          >
            <span className="hc-vc__btn-icon">{camOn ? <FiVideo /> : <FiVideoOff />}</span>
            <span className="hc-vc__btn-label">{camOn ? "Cam Off" : "Cam On"}</span>
          </button>

          {connected && (
            <div className="hc-vc__timer">
              <FiClock />
              <span>{fmtDuration(duration)}</span>
            </div>
          )}
          {connected && (
            <div className="hc-vc__live-pill">
              <span className="hc-vc__live-dot" />
              Live
            </div>
          )}
          {connected && connectionQuality !== "unknown" && (
            <div
              className={`hc-vc__quality-pill hc-vc__quality-pill--${connectionQuality}`}
              title={
                connectionQuality === "poor"
                  ? "Poor connection — the call may drop"
                  : connectionQuality === "weak"
                    ? "Unstable connection — video quality may drop"
                    : "Good connection"
              }
            >
              <FiWifi />
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
            <span className="hc-vc__btn-icon">
              {isSelfViewMinimized ? <FiMaximize2 /> : <FiMinimize2 />}
            </span>
            <span className="hc-vc__btn-label">{isSelfViewMinimized ? "Show Me" : "Hide Me"}</span>
          </button>

          <button
            className={`hc-vc__btn ${chatOpen ? "hc-vc__btn--chat-on" : ""}`}
            onClick={() => setChatOpen((v) => !v)}
            title="Chat"
          >
            <span className="hc-vc__btn-icon">
              <FiMessageSquare />
            </span>
            <span className="hc-vc__btn-label">Chat</span>
          </button>

          <button
            className="hc-vc__btn hc-vc__btn--end"
            onClick={requestLeave}
            title="Leave call"
          >
            <span className="hc-vc__btn-icon">
              <FiPhoneOff />
            </span>
            <span className="hc-vc__btn-label">Leave Call</span>
          </button>
        </div>
      </div>

      {leaveConfirmOpen && (
        <div className="hc-vc__confirm-overlay" onClick={cancelLeave}>
          <div
            className="hc-vc__confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dvcall-leave-title"
          >
            <div className="hc-vc__confirm-icon">⚠</div>
            <h3 className="hc-vc__confirm-title" id="dvcall-leave-title">
              Leave this meeting?
            </h3>
            <p className="hc-vc__confirm-text">
              You'll be disconnected from the call. You can rejoin with the same
              link while the meeting is still active.
            </p>
            <div className="hc-vc__confirm-actions">
              <button
                type="button"
                className="hc-vc__confirm-btn"
                onClick={cancelLeave}
                autoFocus
              >
                Stay
              </button>
              <button
                type="button"
                className="hc-vc__confirm-btn hc-vc__confirm-btn--danger"
                onClick={leaveCall}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
