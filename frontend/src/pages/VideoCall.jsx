import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import socket, { setSocketAuthRole } from "../socket";
import "./videocall.css";
import HumancareLogo from "../assets/VideoCallingImage.png";
import api, { getUserAuthToken } from "../api";
import { useAuth } from "../context/AuthContext";
import { useDoctorAuth } from "../context/DoctorAuthContext";
import { uploadFileDirectToS3 } from "../utils/directUpload";
import createLogger from "../utils/logger";
import {
  retryDebugLog,
  retryDebugExtractFingerprint,
  retryDebugPollInboundVideoStats,
} from "../utils/retryDebug";
import { extractDtlsFingerprint, extractSdpDirections } from "../utils/webrtcSdp";
import { MEDIA_ACQUIRE_TIMEOUT_MS, mediaAcquireTimedOut } from "../utils/mediaTimeout";
import { ensureLocalTracksSentInAnswer } from "../utils/webrtcTransceivers";
import {
  FiAlertTriangle,
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
  FiWifi,
  FiX,
} from "react-icons/fi";

const logger = createLogger("video-call");

// [RETRY-DEBUG] Logs the negotiated direction of each m-section of the local
// ANSWER right after createAnswer(), and warns when any is not sendrecv while
// we hold a live local track of that kind. A receive-only answer with local
// media available is the silent one-way-call failure this guards against
// (the answer was built before local tracks were attached to the pc).
function logLocalAnswerDirections(role, appointmentId, answerSdp, localStream, source) {
  const directions = extractSdpDirections(answerSdp);
  const hasLiveLocal = (kind) =>
    Boolean(
      localStream &&
        localStream
          .getTracks()
          .some((t) => t.kind === kind && t.readyState !== "ended"),
    );
  const notSendrecv = directions.filter((d) => {
    const [kind, dir] = d.split(":");
    return hasLiveLocal(kind) && dir !== "sendrecv";
  });
  retryDebugLog(role, appointmentId, "answer:local_directions", {
    source,
    directions,
    localAudio: hasLiveLocal("audio"),
    localVideo: hasLiveLocal("video"),
  });
  if (notSendrecv.length > 0) {
    logger.warn("Local answer is not sendrecv although local tracks exist:", notSendrecv);
    retryDebugLog(role, appointmentId, "answer:WARN_not_sendrecv_with_local_tracks", {
      source,
      notSendrecv,
    });
  }
}

// ── In-call prescription modal (doctor only) ──────────────────────────────────
const EMPTY_MED = { name: "", dosage: "", frequency: "", duration: "" };

// Which role (doctor/patient) this tab is using for a given appointment is
// normally known upfront — both entry points (DoctorAppointments' "Join" and
// the patient's "Join Consultation") pass it via router state. But router
// state doesn't survive every reload path (a fresh tab restore after a
// mobile OS discards a backgrounded page, a bookmarked/shared link, opening
// the URL directly) — and without it, the role used to be *guessed* from
// which of the two independent auth checks (doctor vs. patient) happened to
// resolve truthy. If a browser also holds a leftover, still-valid session
// for the other role (common when testing both sides of a call from one
// browser), that guess can pick the wrong one. Persisting the role actually
// confirmed by a successful appointment fetch removes the need to guess on
// a later reload for the same appointment.
function loadPersistedRole(appointmentId) {
  try {
    const role = sessionStorage.getItem(`hc-vc-role-${appointmentId}`);
    return role === "doctor" || role === "user" ? role : "";
  } catch {
    return "";
  }
}

function persistRole(appointmentId, role) {
  try {
    sessionStorage.setItem(`hc-vc-role-${appointmentId}`, role);
  } catch {
    // Storage unavailable (private mode, etc.) — just falls back to the
    // ordinary role-detection attempts on the next reload.
  }
}

// A network blip or an accidental modal close mid-call previously lost
// whatever the doctor had already typed, with no way to recover it — the
// modal's fields always started blank on every open. Persist an in-progress
// draft to sessionStorage, keyed per appointment, so reopening the modal
// (or retrying after a failed save) restores exactly what was there.
const RX_DRAFT_PREFIX = "hc-vc-rx-draft-";
const MAX_RX_DRAFTS = 20;

// Safety net for a long-lived tab where the doctor opens (and abandons) the
// prescription modal for many different appointments without saving —
// caps how many stale drafts can accumulate in sessionStorage. Keeps
// `keepKey` (the draft currently being written) untouched.
function pruneOldPrescriptionDrafts(keepKey) {
  try {
    const entries = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(RX_DRAFT_PREFIX) || key === keepKey) continue;
      let savedAt = 0;
      try {
        savedAt = JSON.parse(sessionStorage.getItem(key) || "null")?._savedAt || 0;
      } catch {
        // Corrupt entry — treat as oldest so it's pruned first.
      }
      entries.push({ key, savedAt });
    }
    if (entries.length < MAX_RX_DRAFTS) return;
    entries.sort((a, b) => a.savedAt - b.savedAt);
    entries
      .slice(0, entries.length - MAX_RX_DRAFTS + 1)
      .forEach((entry) => sessionStorage.removeItem(entry.key));
  } catch {
    // Storage unavailable — nothing to prune.
  }
}

function loadPrescriptionDraft(appointmentId) {
  try {
    const key = `${RX_DRAFT_PREFIX}${appointmentId}`;
    pruneOldPrescriptionDrafts(key);
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function InCallPrescriptionModal({ appt, onClose, onSaved }) {
  const appointmentId = appt?._id || "unknown";
  const [draft] = useState(() => loadPrescriptionDraft(appointmentId));
  const [diagnosis, setDiagnosis] = useState(draft?.diagnosis || "");
  const [medicines, setMedicines] = useState(
    Array.isArray(draft?.medicines) && draft.medicines.length
      ? draft.medicines
      : [{ ...EMPTY_MED }],
  );
  const [instructions, setInstructions] = useState(draft?.instructions || "");
  const [followUpDate, setFollowUpDate] = useState(draft?.followUpDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const key = `${RX_DRAFT_PREFIX}${appointmentId}`;
    const payload = JSON.stringify({
      diagnosis,
      medicines,
      instructions,
      followUpDate,
      _savedAt: Date.now(),
    });
    try {
      sessionStorage.setItem(key, payload);
    } catch (err) {
      if (err?.name === "QuotaExceededError") {
        // Extremely unlikely (drafts are tiny), but if a long session has
        // piled up many abandoned drafts, prune and retry once instead of
        // silently losing this one.
        pruneOldPrescriptionDrafts(key);
        try {
          sessionStorage.setItem(key, payload);
        } catch {
          // Still failing — draft just won't survive a remount.
        }
      }
      // Other errors (storage unavailable in private mode, etc.) — draft
      // just won't survive a remount, same as before.
    }
  }, [appointmentId, diagnosis, medicines, instructions, followUpDate]);

  const setMed = (i, k, v) =>
    setMedicines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [k]: v };
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      setError("Diagnosis is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(
        "/api/medical/prescriptions",
        {
          appointmentId: appt._id,
          patientId: appt.patientId?._id || appt.patientId,
          diagnosis,
          medicines: medicines.filter((m) => m.name.trim()),
          instructions,
          followUpDate,
        },
        {
          authRole: "doctor",
        },
      );
      try {
        sessionStorage.removeItem(`hc-vc-rx-draft-${appointmentId}`);
      } catch {
        // Non-fatal — worst case a stale draft lingers for this tab's session.
      }
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
          <button
            className="hc-vc__rx-modal-close"
            onClick={onClose}
            aria-label="Close prescription form"
          >
            ✕
          </button>
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
              <input
                className="hc-vc__rx-input hc-vc__rx-med-name"
                value={med.name}
                onChange={(e) => setMed(i, "name", e.target.value)}
                placeholder="Medicine"
              />
              <input
                className="hc-vc__rx-input hc-vc__rx-med-sm"
                value={med.dosage}
                onChange={(e) => setMed(i, "dosage", e.target.value)}
                placeholder="Dosage"
              />
              <input
                className="hc-vc__rx-input hc-vc__rx-med-sm"
                value={med.frequency}
                onChange={(e) => setMed(i, "frequency", e.target.value)}
                placeholder="Frequency"
              />
              <input
                className="hc-vc__rx-input hc-vc__rx-med-sm"
                value={med.duration}
                onChange={(e) => setMed(i, "duration", e.target.value)}
                placeholder="Duration"
              />
              {medicines.length > 1 && (
                <button
                  type="button"
                  className="hc-vc__rx-med-remove"
                  onClick={() =>
                    setMedicines((p) => p.filter((_, idx) => idx !== i))
                  }
                  aria-label={`Remove medicine ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="hc-vc__rx-add-med"
            onClick={() => setMedicines((p) => [...p, { ...EMPTY_MED }])}
          >
            + Add Medicine
          </button>

          <label className="hc-vc__rx-label">Instructions</label>
          <textarea
            className="hc-vc__rx-input hc-vc__rx-textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Diet, rest, special instructions..."
            rows={2}
          />

          <label className="hc-vc__rx-label">Follow-up Date</label>
          <input
            className="hc-vc__rx-input"
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />

          <div className="hc-vc__rx-modal-foot">
            <button
              type="button"
              className="hc-vc__rx-btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="hc-vc__rx-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Issue Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ICE server config: fetched from the backend, not baked in at build time ──
// TURN credentials used to live in VITE_* env vars, which Vite inlines
// directly into the public JS bundle — anyone opening devtools on the site
// could read the permanent TURN username/password and use the relay
// indefinitely. The backend now mints a short-lived, per-request TURN
// credential (coturn's "TURN REST API" convention) behind an authenticated
// endpoint (see GET /api/rtc/ice-servers) instead, so nothing long-lived ever
// reaches the client. These helpers just validate what came back.
const isTurnUrl = (url) => /^turns?:/i.test(String(url || ""));

const normalizeIceUrls = (urls) =>
  Array.isArray(urls) ? urls : [urls].filter(Boolean);

const sanitizeIceServers = (iceServers) =>
  Array.isArray(iceServers)
    ? iceServers.filter(
        (server) =>
          server &&
          typeof server === "object" &&
          normalizeIceUrls(server.urls).length > 0,
      )
    : [];

const validateIceServers = (iceServers) => {
  if (!iceServers.length) return "No ICE servers were returned by the server.";

  for (const server of iceServers) {
    const urls = normalizeIceUrls(server.urls);
    for (const url of urls) {
      if (isTurnUrl(url) && (!server.username || !server.credential)) {
        return "A TURN server is missing its credential.";
      }
    }
  }

  return "";
};

const getIceCandidateType = (candidate = "") => {
  if (candidate.includes(" typ host")) return "host (local)";
  if (candidate.includes(" typ srflx")) return "srflx (STUN)";
  if (candidate.includes(" typ relay")) return "relay (TURN)";
  if (candidate.includes(" typ prflx")) return "prflx";
  return "unknown";
};

const describeIceCandidate = (candidate = "") => {
  const value = String(candidate || "");
  const addressMatch = value.match(
    /(?:^| )(?:raddr )?([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-z0-9-]+\.local)(?: |$)/i,
  );
  const protocolMatch = value.match(/ (udp|tcp) /i);
  return {
    type: getIceCandidateType(value),
    protocol: protocolMatch?.[1]?.toLowerCase() || "unknown",
    address: addressMatch?.[1] || "",
  };
};

// Turns the stats already gathered by startStatsCollection into a coarse,
// user-facing quality bucket. Inbound packet loss is derived from the DELTA
// between this poll and the previous one (not the raw cumulative counter) —
// using the cumulative value directly would mean a single lost packet early
// in a long call marks the connection "poor" for its entire remaining
// duration. packetsLost / packetsReceived come from the inbound-rtp reports
// (they don't exist on candidate-pair).
const deriveConnectionQuality = (diagnostics, previousSample) => {
  if (diagnostics.rtt === null) return "unknown";

  let lossRatio = 0;
  if (previousSample) {
    const deltaReceived =
      diagnostics.packetsReceived - previousSample.packetsReceived;
    const deltaLost = diagnostics.packetsLost - previousSample.packetsLost;
    if (deltaLost > 0 && deltaReceived + deltaLost > 0) {
      lossRatio = deltaLost / (deltaReceived + deltaLost);
    }
  }

  if (diagnostics.rtt > 400 || lossRatio > 0.08) return "poor";
  if (diagnostics.rtt > 200 || lossRatio > 0.03) return "weak";
  return "good";
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
  screenShareVideo: Number(
    import.meta.env.VITE_RTC_SCREEN_BITRATE || 2_000_000,
  ),
  voiceAudio: Number(import.meta.env.VITE_RTC_AUDIO_BITRATE || 64_000),
};

const ICE_RESTART_DELAY_MS = Number(
  import.meta.env.VITE_RTC_ICE_RESTART_DELAY_MS || 2500,
);
const CONNECTION_FAIL_TIMEOUT_MS = Number(
  import.meta.env.VITE_RTC_CONNECT_TIMEOUT_MS || 25000,
);
const ICE_MAX_RECOVERY_ATTEMPTS = Number(
  import.meta.env.VITE_RTC_ICE_MAX_RECOVERY_ATTEMPTS || 4,
);
const ICE_RECOVERY_COOLDOWN_MS = Number(
  import.meta.env.VITE_RTC_ICE_RECOVERY_COOLDOWN_MS || 30000,
);
// How long we wait for a video-answer after sending an offer before treating
// it as lost. Without this, a dropped/never-arriving answer (very likely
// exactly during a network switch or a peer's page reload) leaves the offer
// sender permanently stuck in "have-local-offer" — every later
// renegotiation attempt (peer-joined, ICE restart, socket reconnect) all
// funnel through createAndSendOffer, which refuses to run unless
// signalingState is "stable". Nothing else in the app ever rolls back a
// self-initiated offer, so without this timeout that stuck state is
// permanent until the page is reloaded.
const OFFER_ANSWER_TIMEOUT_MS = Number(
  import.meta.env.VITE_RTC_OFFER_ANSWER_TIMEOUT_MS || 8000,
);
// How long a freshly (re)built RTCPeerConnection is protected from being
// torn down again by handlePeerJoined's resumedCall-triggered rebuild check
// (see that check's own comment for why it has to exist at all). Rejoining
// the room — which every (re)build's own effect setup does — makes the
// server echo "peer-joined" straight back to the same socket whenever a
// peer is present, carrying resumedCall:true; that echo arrives well before
// a brand-new pc has any realistic chance to negotiate (the doctor never
// self-initiates an offer, and the patient's own offer waits on a fresh
// getUserMedia() call first). Without this grace window, that echo alone
// re-satisfies "resumed but not yet healthy" and tears the pc down again
// before it ever gets a chance to connect — an unbounded rebuild cascade.
// Long enough to cover a normal offer/answer + ICE round trip; the existing
// connection watchdog / reconnect-stall / ICE-restart machinery remains the
// safety net for a pc that's still unhealthy after this window elapses.
const REBUILD_GRACE_MS = Number(
  import.meta.env.VITE_RTC_REBUILD_GRACE_MS || 5000,
);
const STATS_INTERVAL_MS = Number(
  import.meta.env.VITE_RTC_STATS_INTERVAL_MS || 30000,
);
// ── Rebuild coordination (requestPcRebuild) ──────────────────────────────
// An orphaned answer (offerId mismatch, or arriving while not in
// "have-local-offer") is normal fallout from ordinary offer/answer glare in
// perfect negotiation — most resolve themselves. Only treat it as a broken
// session if the pc is *still* unhealthy this long after.
const ORPHANED_ANSWER_RECHECK_MS = 4000;
// Inbound-media watchdog cadence. Deliberately separate from
// STATS_INTERVAL_MS (30s quality telemetry, which also only starts once the
// pc is already connected) — the watchdog must run from pc creation to cover
// a pc that never connects, and needs a tight enough tick to act in ~10s.
const MEDIA_WATCHDOG_INTERVAL_MS = 5000;
// A pc stuck in "new"/"connecting" this long (with a peer present and local
// media ready) is treated as stalled even though no state-change event fired.
const MEDIA_STALL_NEVER_CONNECTED_MS = 10000;
// Quiet period after a watchdog-triggered rebuild — a fresh pc needs real
// time to reconnect and start flowing media, and re-triggering off its own
// still-connecting state would be exactly the rebuild loop this prevents.
const MEDIA_STALL_COOLDOWN_MS = 25000;
// Rate limit on *automatic* rebuilds only. Manual Retry is exempt: a person
// tapping the button is explicit intent, not a runaway loop.
const AUTO_REBUILD_MAX_COUNT = 3;
const AUTO_REBUILD_WINDOW_MS = 60000;
// How long a rebuild request waits for the effect to actually re-run before
// the "rebuild in progress" flag is force-cleared (covers the effect
// early-returning, e.g. session ended or ICE config unavailable).
const REBUILD_IN_PROGRESS_SAFETY_MS = 5000;
// A stashed offer (the one that revealed a stale pc) is only worth replaying
// onto the rebuilt pc if it's still fresh — the peer re-offers on its own
// answer timeout otherwise.
const PENDING_OFFER_MAX_AGE_MS = 15000;
// Doctor-side automatic rebuilds first ask the patient to rebuild too, then
// wait this long for its fresh offer before rebuilding alone (covers a
// client that doesn't know the "request-peer-rebuild" event).
const PEER_REBUILD_WAIT_MS = 6000;
// The manual Retry button stays disabled/"Reconnecting…" until the new
// connection is healthy or this long passes, whichever comes first.
const MANUAL_RECONNECT_HOLD_MS = 5000;
// Announced in join-appointment-room (see emitOnlineAndJoinRoom). Keep in
// sync with what the client actually implements.
const WEB_CLIENT_CAPABILITIES = { peerRebuild: true };
// Doctor-side downgrade for a peer that lacks peerRebuild (an older mobile
// build): instead of rebuilding the doctor's pc — which that peer could not
// follow, since it can't apply an answer carrying a new DTLS fingerprint —
// the doctor asks it for an ICE restart and rechecks after this long (enough
// for the 5s media watchdog to take at least two samples on the restarted pc).
const OLD_PEER_ICE_RESTART_RECHECK_MS = 10000;
// After this many reconnect-stall episodes in a row without a successful
// reconnect in between, the automatic ICE-restart machinery is clearly not
// going to resolve this on its own — stop presenting the stall banner as a
// "still working on it, hang tight" message and offer an explicit way out
// instead of retrying silently forever.
const MAX_RECONNECT_STALL_RETRIES = 3;

// How many consecutive failed token-refresh heartbeat attempts (a single
// attempt fires every 4 minutes — see the heartbeat effect) are tolerated
// silently before treating the session as no longer authenticatable, when
// each failure was itself ambiguous (a network blip, a transient 5xx — not
// a definitive "this refresh token is invalid" rejection, which is acted on
// immediately regardless of this count). Keeps a single dropped request
// from tearing down an otherwise-healthy call, while still bounding how
// long the app silently retries a session that may genuinely be dead.
const AUTH_REFRESH_FAILURE_THRESHOLD = 2;

// First line of defense against a stuck Enter key / paste-loop flooding
// chat — the server has its own rate limit (see backend/utils/socketRateLimit.js),
// this just keeps the UI itself from firing faster than a human can type.
const CHAT_SEND_COOLDOWN_MS = 300;

// logVideoEvent silently dropped telemetry whenever the socket was
// disconnected — exactly the events most useful for debugging what
// happened around a disconnect. Cap how many get queued for replay on
// reconnect so a long outage can't grow this without bound.
const TELEMETRY_QUEUE_MAX = 50;

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

// getDisplayMedia failures were previously collapsed into one generic
// message regardless of cause. NotAllowedError/AbortError both mean "the
// user dismissed the picker" (browsers differ on which they throw) and are
// handled separately at the call site — this only needs to cover genuine
// runtime failures.
const screenShareErrorMessage = (err) => {
  switch (err?.name) {
    case "NotReadableError":
    case "TrackStartError":
      return "Your screen could not be captured — another app may be blocking screen capture. Close it and try again.";
    case "NotFoundError":
      return "No screen or window was available to share.";
    case "TypeError":
      return "Screen sharing isn't supported with the current browser configuration.";
    default:
      return "Screen sharing could not be started on this device.";
  }
};

const getConsultationMediaStream = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
  } catch (firstErr) {
    logger.warn(
      "High-quality media failed, trying basic constraints:",
      firstErr.name,
    );
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
      logger.warn(
        "Basic video+audio failed, trying separate devices:",
        secondErr.name,
      );
      const partialStream = new MediaStream();
      let lastErr = secondErr;

      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: MEDIA_CONSTRAINTS.video,
        });
        videoOnly.getTracks().forEach((track) => partialStream.addTrack(track));
      } catch (videoErr) {
        logger.warn("Video-only media failed:", videoErr.name);
        lastErr = videoErr;
      }

      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: MEDIA_CONSTRAINTS.audio,
          video: false,
        });
        audioOnly.getTracks().forEach((track) => partialStream.addTrack(track));
      } catch (audioErr) {
        logger.warn("Audio-only media failed:", audioErr.name);
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
      camera: devices.some((device) => device.kind === "videoinput")
        ? "available"
        : "missing",
      microphone: devices.some((device) => device.kind === "audioinput")
        ? "available"
        : "missing",
      speaker: devices.some((device) => device.kind === "audiooutput")
        ? "available"
        : "unknown",
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
    logger.warn("Video playback was blocked:", err?.message || err);
    return false;
  }
};

// Tracks a <video> element's intrinsic frame shape so the UI can switch
// object-fit from cover to contain for portrait streams (e.g. a mobile
// patient held upright). Cover-fitting a portrait stream into this app's
// landscape stage forces a large scale-up to span the width, which crops
// most of the frame's height and reads as an excessive zoom. "resize"
// fires on the video element whenever the underlying track's dimensions
// change (device rotation, camera renegotiation), not just on first load.
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

const setTrackHint = (track, hint) => {
  if (!track || !("contentHint" in track)) return;
  try {
    track.contentHint = hint;
  } catch (_) {}
};

const getSenderForKind = (pc, kind) => {
  if (!pc) return null;
  return (
    pc.getSenders?.().find((sender) => sender.track?.kind === kind) ||
    pc
      .getTransceivers?.()
      .find((transceiver) => transceiver.receiver?.track?.kind === kind)
      ?.sender ||
    null
  );
};

const hasTransceiverForKind = (pc, kind) =>
  Boolean(
    pc
      ?.getTransceivers?.()
      .some(
        (transceiver) =>
          transceiver.sender?.track?.kind === kind ||
          transceiver.receiver?.track?.kind === kind,
      ),
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
  { maxBitrate, maxFramerate, maintainResolution = false } = {},
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
  } catch (_) {}
};

// Chat messages have no server-issued id in the payload this page receives,
// so array-index keys were being used for the message list — fine while
// messages are only ever appended, but a landmine for any future reorder/
// dedupe/pagination. Tag each message with a stable client-side key at the
// moment it enters state instead.
const makeMessageKey = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Unique per created offer, echoed back in its answer — lets handleAnswer
// tell a genuine fresh answer apart from a stale/replayed one (see
// pendingOfferIdRef).
const makeOfferId = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `offer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const fmtTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const location = useLocation();

  const { doctor, loading: doctorLoading } = useDoctorAuth();
  const { user, loading: userLoading } = useAuth();
  const doctorId = doctor?._id || doctor?.id || "";
  const userId = user?._id || "";

  // ── Appointment ──────────────────────────────────────────────────
  const [appt, setAppt] = useState(null);
  const [apptLoading, setApptLoading] = useState(true);
  const [apptError, setApptError] = useState("");
  const [activeRole, setActiveRole] = useState("");
  // Flips permanently true once this tab's call session is authoritatively
  // over (denied room access, evicted/revoked, or superseded by a newer
  // session for the same appointment elsewhere) — as opposed to a merely
  // transient connection problem. A dependency of the main WebRTC effect
  // below so setting it both tears the current effect instance all the way
  // down (via its own cleanup — socket listeners, PeerConnection, local
  // tracks) AND stops it from ever creating a new PeerConnection / requesting
  // media again for this mount, even if a stray "peer-joined" still arrives
  // in the brief window before that cleanup runs.
  const [sessionEnded, setSessionEnded] = useState(false);

  // ── ICE server config (STUN + short-lived TURN credential) ────────
  const [iceConfig, setIceConfig] = useState(null);
  const [iceConfigError, setIceConfigError] = useState("");

  const apptDoctorId = appt?.doctorId?._id || appt?.doctorId || "";
  const apptPatientId = appt?.patientId?._id || appt?.patientId || "";
  const requestedRole = useMemo(() => {
    const stateRole = location.state?.role;
    const queryRole = new URLSearchParams(location.search).get("role");
    const role = String(stateRole || queryRole || "").toLowerCase();
    if (role === "doctor" || role === "user") return role;
    // Router state doesn't survive every reload path (see loadPersistedRole)
    // — fall back to whatever role this same appointment last confirmed.
    return loadPersistedRole(appointmentId);
  }, [location.search, location.state, appointmentId]);

  const isDoctor = useMemo(() => {
    if (activeRole) return activeRole === "doctor";
    if (doctorId && apptDoctorId && String(doctorId) === String(apptDoctorId))
      return true;
    if (userId && apptPatientId && String(userId) === String(apptPatientId))
      return false;
    // Only reached before the appointment has loaded (activeRole not yet
    // set). Prefer the explicit/persisted role over guessing from which of
    // the two independent auth checks happened to resolve — the doctor/user
    // truthiness guess can pick the wrong role when a browser holds a
    // leftover, still-valid session for the other role too (see
    // loadPersistedRole's comment).
    if (requestedRole) return requestedRole === "doctor";
    return !!doctor && !user;
  }, [
    activeRole,
    doctorId,
    apptDoctorId,
    userId,
    apptPatientId,
    requestedRole,
    doctor,
    user,
  ]);

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
  const remoteAudioRef = useRef(null);
  const pageRef = useRef(null);
  const mainVideoOrientationCleanupRef = useRef(null);
  const pipVideoOrientationCleanupRef = useRef(null);

  // ── Stream refs ───────────────────────────────────────────────────
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcRef = useRef(null);
  // Wall-clock time pcRef.current was constructed — see REBUILD_GRACE_MS for
  // why handlePeerJoined needs this to protect the freshly-rebuilt instance a
  // self "peer-joined" echo lands in next.
  const pcCreatedAtRef = useRef(0);
  // The DTLS fingerprint (see extractDtlsFingerprint, utils/webrtcSdp.js) of
  // the last remote offer OR answer this side successfully applied. Real
  // reconnect-logic state, not diagnostic — deliberately outside RETRY_DEBUG:
  // handleOffer compares an incoming offer against it to detect a peer that
  // rebuilt its RTCPeerConnection, and handleAnswer does the same for the
  // answer to our own offer (the patient — the sole offerer — only ever
  // learns the doctor's fingerprint from answers). Reset to null whenever we
  // rebuild ourselves or the peer leaves, so the offer replayed onto a fresh
  // pc is never mistaken for another rebuild.
  const lastRemoteFingerprintRef = useRef(null);
  // ── requestPcRebuild support state (real logic, not diagnostic) ──────
  // True from a rebuild request until the effect has re-run and finished
  // setup (or REBUILD_IN_PROGRESS_SAFETY_MS elapses) — automatic requests
  // arriving meanwhile coalesce instead of starting a second rebuild.
  const pcRebuildInProgressRef = useRef(false);
  const pcRebuildSafetyTimerRef = useRef(null);
  // Timestamps of recent automatic rebuilds that count toward
  // AUTO_REBUILD_MAX_COUNT / AUTO_REBUILD_WINDOW_MS. Manual Retry and the
  // "peer left and came back" (!existingPc) case never read/write it.
  const autoRebuildTimestampsRef = useRef([]);
  // The offer that revealed a stale pc, kept across the effect re-run
  // ({ payload, at }) and replayed onto the fresh pc once its listeners are
  // registered. Latest one wins.
  const pendingRemoteOfferRef = useRef(null);
  // Debounced one-shot recheck armed by handleAnswer's orphaned-answer
  // branches (see scheduleOrphanedAnswerRecheck).
  const orphanedAnswerCheckTimerRef = useRef(null);
  // Watchdog cooldown — persists across rebuilds (each rebuild is a new
  // effect instance, so a plain local would reset and defeat it).
  const mediaStallCooldownUntilRef = useRef(0);
  // Whether the remote peer says its camera is off (relayed "camera-state"
  // event; only the mobile client emits it today). Lets the media watchdog
  // skip the video check instead of reading a deliberately-off camera as a
  // stall.
  const remoteCamOffRef = useRef(false);
  // The other participant's announced capabilities ({ peerRebuild }), taken
  // from the "peer-joined" payload's peerCapabilities. null = unknown /
  // nobody present; a missing or malformed value reads as "not supported"
  // (an older client). Kept across our own rebuilds — the peer is unchanged —
  // and reset when the peer leaves.
  const peerCapabilitiesRef = useRef(null);
  // Doctor-only downgrade bookkeeping (see requestPcRebuild): the recheck
  // timer armed after asking an old-build patient for an ICE restart, and the
  // last time the media watchdog saw inbound audio/video grow (so the recheck
  // can tell "recovered" from "still silent" on a pc that reads connected).
  const oldPeerIceRestartTimerRef = useRef(null);
  const lastMediaGrowthAtRef = useRef(0);
  const waitingForOldPeerRef = useRef(false);
  // Doctor-only: a pending "asked the patient to rebuild, waiting for its
  // fresh offer" state — { reason, cancelOn, timerId, pc }. See
  // requestPcRebuild.
  const peerRebuildWaitRef = useRef(null);
  // Always points at the latest requestPcRebuild so timer callbacks (the
  // doctor's fallback) never call a stale closure.
  const requestPcRebuildRef = useRef(async () => "noop");
  // TEMPORARY (RETRY_DEBUG): previous connectionState/iceConnectionState so
  // the state-change handlers can log an old→new transition instead of just
  // the new value. Read/written only by retry-debug logging.
  const retryDebugPrevConnStateRef = useRef(null);
  const retryDebugPrevIceStateRef = useRef(null);

  // ── Stable state refs ─────────────────────────────────────────────
  const inCallRef = useRef(false);
  const isReadyRef = useRef(false);
  const isMutedRef = useRef(false);
  const isCamOffRef = useRef(false);
  const peerJoinedRef = useRef(false);
  const chatOpenRef = useRef(false);
  const completedRef = useRef(false);
  const completingRef = useRef(false);
  const isSwappedRef = useRef(false);
  // Guards verifyLocalPlaybackLiveness against overlapping runs (e.g. a
  // camera/mic retry firing while a previous leave/rejoin's liveness check
  // is still mid-flight).
  const localLivenessCheckRef = useRef(false);
  const callTimerRef = useRef(null);
  const iceRestartTimerRef = useRef(null);
  const connectionFailTimerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const joinedSocketIdRef = useRef("");
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const ignoreOfferResetTimerRef = useRef(null);
  // Bridges the main effect's createAndSendOffer() to callbacks defined
  // outside that effect (retryMediaPermissions). Reassigned on every effect
  // run so it always closes over the current RTCPeerConnection; its own
  // internal guards make a stale call a safe no-op.
  const createAndSendOfferRef = useRef(null);
  const settingRemoteAnswerPendingRef = useRef(false);
  // Most recent measured round-trip time (ms) from getStats(), used to widen
  // the offer-answer timeout on high-latency connections. null until the
  // first stats sample comes in (e.g. before the call has connected once).
  const lastRttMsRef = useRef(null);
  // The offerId of the most recent remote offer we accepted — echoed back
  // in our video-answer so the offerer can correlate it (see below).
  const lastReceivedOfferIdRef = useRef(null);
  // Correlates a video-answer back to the specific video-offer it's meant to
  // answer. Socket.IO's connectionStateRecovery (server.js) replays buffered
  // room events across a brief reconnect — under some timings that can
  // redeliver an already-consumed answer from an earlier negotiation. The
  // old guard (signalingState === "have-local-offer") can't tell that
  // apart from a genuine fresh answer, since a replayed answer arrives
  // while we're legitimately waiting on one. Tracking the id of the offer
  // we're actually waiting on closes that gap.
  const pendingOfferIdRef = useRef(null);
  // Fires if no answer arrives for our outstanding offer within
  // OFFER_ANSWER_TIMEOUT_MS — see createAndSendOffer for why this exists.
  const offerAnswerTimeoutRef = useRef(null);
  const restartRequestInFlightRef = useRef(false);
  const iceRecoveryAttemptsRef = useRef(0);
  const lastIceRecoveryAtRef = useRef(0);
  const pageUnloadingRef = useRef(false);
  // Consecutive failed token-refresh heartbeat attempts — see the heartbeat
  // effect and AUTH_REFRESH_FAILURE_THRESHOLD.
  const authRefreshFailureCountRef = useRef(0);
  const screenSharingRef = useRef(false);
  const screenShareStartInProgressRef = useRef(false);
  const screenShareStopInProgressRef = useRef(false);
  // Holds a still-live display-capture MediaStream across a PeerConnection
  // rebuild — set by the main effect's cleanup (only when the rebuild is a
  // reconnect, never a real leave/unmount, and screen sharing was active),
  // consumed by resumeScreenShareIfPending once the rebuilt connection is
  // healthy. Never holds a stopped/ended stream.
  const pendingScreenShareResumeRef = useRef(null);
  // Cross-effect invocation ref (same pattern as kickIceRecoveryRef/
  // networkRecoveryRef below) — assigned to resumeScreenShareIfPending
  // outside the main effect (where startScreenShare's own dependencies
  // live) and invoked from inside it, from markPeerConnectionHealthy.
  const resumeScreenShareRef = useRef(() => {});
  const socketAuthRefreshedRef = useRef(false);
  const verifyingVisibilityRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  // Set on a disconnected/failed transition after the call has connected at
  // least once, and consumed the next time the connection reports healthy
  // again (whether via a real onconnectionstatechange "connected" event or
  // via resyncConnectionStateFromPeerConnection) — forces a remote-video
  // rebind for a recovery that reuses the SAME track (an ICE restart, or the
  // browser's own passive ICE self-healing), which never re-fires
  // pc.ontrack and would otherwise leave the <video> element frozen on its
  // last frame. Mirrors VideoCallController's _remoteRebindPending in the
  // Flutter app.
  const remoteRebindPendingRef = useRef(false);
  const reconnectStallTimerRef = useRef(null);
  // How many times the stall banner has fired since the last successful
  // (re)connect — see MAX_RECONNECT_STALL_RETRIES.
  const reconnectStallCountRef = useRef(0);
  // Set just before a manual forceReconnect() tears the peer connection
  // down and rebuilds it. Lets the effect cleanup below tell "I'm
  // intentionally rebuilding my own connection" apart from "I'm actually
  // leaving the room" — otherwise the leave-room emit on teardown looks
  // identical to a real hangup and can flash "peer left" for the other party.
  const manualReconnectRef = useRef(false);
  const inlineErrorTimerRef = useRef(null);
  // Previous stats poll's packet counters, so quality can be derived from
  // the delta between polls instead of a misleading cumulative total.
  const lastStatsSampleRef = useRef(null);
  // Telemetry events queued while the socket is disconnected, replayed once
  // it reconnects — see logVideoEvent/flushTelemetryQueue below.
  const telemetryQueueRef = useRef([]);
  // True only while the other participant is actually in the room. Gates the
  // ICE-restart / recovery machinery so a peer who has genuinely left can't
  // leave us firing restart offers / restart-requests into an empty room, and
  // lets handlePeerJoined tell "peer rejoined after leaving" apart from an
  // ordinary first join. Mirrors DirectVideoCall.jsx's peerPresentRef.
  const peerPresentRef = useRef(false);
  // Lets the browser's "online" event (registered outside the main effect,
  // below) nudge WebRTC recovery directly — covers a network path
  // recovering while the signaling socket itself never dropped (media/ICE
  // and the socket's transport are independent failure domains), instead of
  // only reacting to the next scheduled ICE-restart timer tick or the
  // socket's own "reconnect" event. Mirrors DirectVideoCall.jsx.
  const kickIceRecoveryRef = useRef(() => {});
  // Same cross-effect invocation pattern as kickIceRecoveryRef just above —
  // assigned inside the main effect (where markPeerConnectionHealthy and
  // remoteRebindPendingRef live) and invoked from the separate online/offline
  // effect below. Covers a network-interface change (e.g. Wi-Fi <-> mobile
  // data) that the RTCPeerConnection absorbs without ever leaving
  // "connected": connectionState==="connected" is proof the transport is
  // healthy, not proof the remote video renderer is still painting fresh
  // frames — see its assignment for the full reasoning. Mirrors the
  // equivalent, already-applied fix in the Flutter app's
  // VideoCallController._handleNetworkInterfaceChanged.
  const networkRecoveryRef = useRef(() => {});
  // Guards the function above against overlapping runs (e.g. the browser
  // firing "online" again before the previous check's settle delay has
  // finished).
  const networkRecoveryInProgressRef = useRef(false);
  // Wall-clock time the current outstanding local offer was sent. Lets
  // createAndSendOffer detect a peer connection parked in "have-local-offer"
  // past its answer deadline and roll it back to retry, instead of skipping
  // recovery every time until the separate offer-answer watchdog fires.
  const pendingOfferSentAtRef = useRef(0);

  // ── Call state ────────────────────────────────────────────────────
  const [isReady, setIsReady] = useState(false);
  const [peerJoined, setPeerJoined] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("unknown");
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isSelfViewMinimized, setIsSelfViewMinimized] = useState(false);
  const [isMainVideoPortrait, setIsMainVideoPortrait] = useState(false);
  const [isPipVideoPortrait, setIsPipVideoPortrait] = useState(false);
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
  const [apptClosedByOther, setApptClosedByOther] = useState("");
  const [endCallConfirm, setEndCallConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [reconnectStalled, setReconnectStalled] = useState(false);
  // Doctor-only: the stall banner reads "Waiting for the other person to
  // reconnect…" instead of the generic text — set when an ICE restart was
  // requested from an older-build peer (rebuilding alone would strand it) and
  // it's still stalled after OLD_PEER_ICE_RESTART_RECHECK_MS.
  const [waitingForOldPeer, setWaitingForOldPeer] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  // Debounces the manual "Retry" button (see forceReconnect): disabled and
  // labelled "Reconnecting…" until the rebuilt connection is healthy or
  // MANUAL_RECONNECT_HOLD_MS passes, whichever comes first. The timer ref
  // doubles as the re-entrancy guard (non-null == a Retry is being held).
  const [manualReconnecting, setManualReconnecting] = useState(false);
  const manualReconnectCooldownRef = useRef(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const pendingLeaveRef = useRef(null);

  // ── Chat state ────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [chatSendCoolingDown, setChatSendCoolingDown] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatSendCooldownTimerRef = useRef(null);

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
  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    isCamOffRef.current = isCamOff;
  }, [isCamOff]);
  useEffect(() => {
    peerJoinedRef.current = peerJoined;
  }, [peerJoined]);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);
  useEffect(() => {
    isSwappedRef.current = isSwapped;
  }, [isSwapped]);
  useEffect(() => {
    screenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);
  useEffect(() => {
    completingRef.current = completing;
  }, [completing]);

  // Callback refs (rather than a mount-only effect) so the orientation
  // watcher attaches exactly when each <video> node appears — these
  // elements don't exist yet while the gate screens (loading/pending/
  // error) are showing, so a one-time effect on mainVideoRef/pipVideoRef
  // would miss them.
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // A fully offline device previously only surfaced indirectly, once the
  // socket/ICE timeouts eventually fired (many seconds later). Report it
  // immediately via the browser's own connectivity signal instead.
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
      .get(`/api/notes/appointment/${appointmentId}`, { authRole: "doctor" })
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
        setNotesError(
          err.response?.data?.msg || "Could not load consultation notes.",
        );
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

      // Always try both roles unless one was explicitly requested (router
      // state or a persisted role from a prior confirm on this appointment
      // — see loadPersistedRole). Narrowing to a single attempt based on
      // which of `doctor`/`user` happened to be truthy previously meant a
      // browser holding a leftover, still-valid session for the OTHER role
      // (e.g. one tester using both a doctor and a patient account) could
      // cause the genuine caller's own role to never even be attempted.
      // Each attempt below already skips itself when that identity isn't
      // authenticated at all, so this costs nothing extra in the normal
      // single-identity case.
      const roleAttempts =
        requestedRole === "doctor"
          ? ["doctor", "user"]
          : requestedRole === "user"
            ? ["user", "doctor"]
            : ["doctor", "user"];

      for (const role of roleAttempts) {
        if (role === "doctor" && !doctor) continue;
        if (role === "user" && !user) continue;

        try {
          const endpoint =
            role === "doctor"
              ? `/api/appointments/doctor/${appointmentId}`
              : `/api/appointments/patient/${appointmentId}`;
          const res = await api.get(endpoint, { authRole: role });
          if (cancelled) return;
          setAppt(res.data);
          setActiveRole(role);
          persistRole(appointmentId, role);
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
  }, [appointmentId, doctor, user, doctorLoading, userLoading, requestedRole]);

  // ── Fetch ICE server config once the role is known ────────────────
  // A fresh, short-lived TURN credential is minted server-side on every
  // page load — see the note above the validation helpers for why this
  // replaced a static credential baked into the build. Unlike the old
  // build-time constant, this now depends on one network round trip
  // succeeding, so a momentary blip (not a real server misconfiguration)
  // shouldn't be able to permanently block the call — retry a couple of
  // times with a short backoff before giving up. Only request failures are
  // retried; a response that came back but failed validation indicates a
  // persistent server-side config problem, not a blip, so that's reported
  // immediately instead of being retried pointlessly.
  useEffect(() => {
    if (activeRole !== "doctor" && activeRole !== "user") return;
    let cancelled = false;
    let retryTimer = null;

    const RETRY_DELAYS_MS = [1000, 2000]; // delay before the 2nd and 3rd attempts

    const attemptFetch = (attempt) => {
      api
        .get("/api/rtc/ice-servers", { authRole: activeRole })
        .then((res) => {
          if (cancelled) return;
          const iceServers = sanitizeIceServers(res.data?.iceServers);
          const error = validateIceServers(iceServers);
          if (error) {
            setIceConfigError(error);
            return;
          }
          setIceConfig({
            iceServers,
            iceCandidatePoolSize: 10,
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
          });
        })
        .catch((err) => {
          if (cancelled) return;
          const nextDelay = RETRY_DELAYS_MS[attempt - 1];
          if (nextDelay !== undefined) {
            retryTimer = window.setTimeout(() => {
              if (!cancelled) attemptFetch(attempt + 1);
            }, nextDelay);
            return;
          }
          setIceConfigError(
            err.response?.data?.msg ||
              err.message ||
              "Could not fetch video call configuration.",
          );
        });
    };

    attemptFetch(1);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [activeRole]);

  // ── Reliable cleanup: stop tracks + notify peers ───
  const performCleanup = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    clearInterval(callTimerRef.current);
    clearTimeout(iceRestartTimerRef.current);
    clearTimeout(connectionFailTimerRef.current);
    clearTimeout(ignoreOfferResetTimerRef.current);
    clearTimeout(reconnectStallTimerRef.current);
    reconnectStallTimerRef.current = null;
    clearInterval(statsTimerRef.current);
    statsTimerRef.current = null;
    socket.emit("leave-appointment-room", { appointmentId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    screenStreamRef.current = null;
    // performCleanup is always a definitive, final teardown — also stop
    // anything a preceding rebuild's cleanup preserved for a resume that
    // will now never happen (e.g. this fires — room denied, duplicate
    // session, explicit leave — while a rebuild was still in flight),
    // so the capture session can't be silently leaked indefinitely.
    if (pendingScreenShareResumeRef.current) {
      pendingScreenShareResumeRef.current.getTracks().forEach((t) => {
        t.onended = null;
        if (t.readyState !== "ended") t.stop();
      });
      pendingScreenShareResumeRef.current = null;
    }
    // Detach handlers before closing so a stray late-firing WebRTC callback
    // (ontrack/onconnectionstatechange/etc.) from this now-dead connection
    // can never run against React state after cleanup, and null the ref
    // (not just close()) so any code that reads pcRef.current afterwards —
    // e.g. a "peer-joined" that slips in before the owning effect's own
    // cleanup has run — sees "no connection" rather than a closed-but-still
    // truthy object that would otherwise look like it needs rebuilding.
    const deadPc = pcRef.current;
    if (deadPc) {
      deadPc.ontrack = null;
      deadPc.onicecandidate = null;
      deadPc.onconnectionstatechange = null;
      deadPc.oniceconnectionstatechange = null;
      try {
        deadPc.close();
      } catch {
        /* already closed */
      }
    }
    pcRef.current = null;
    peerPresentRef.current = false;
    pendingRemoteCandidatesRef.current = [];
    joinedSocketIdRef.current = "";
    peerJoinedRef.current = false;
    ignoreOfferRef.current = false;
    pendingOfferIdRef.current = null;
    lastReceivedOfferIdRef.current = null;
    clearTimeout(offerAnswerTimeoutRef.current);
    offerAnswerTimeoutRef.current = null;
    restartRequestInFlightRef.current = false;
    screenSharingRef.current = false;
    screenShareStartInProgressRef.current = false;
    screenShareStopInProgressRef.current = false;
    socketAuthRefreshedRef.current = false;
  }, [appointmentId]);

  const canJoinConsultation = useMemo(() => {
    return appt?.status === "confirmed";
  }, [appt]);

  // Where "leave this call" should send someone. Checked against the loaded
  // appointment's actual participant ids first — ground truth from the DB —
  // rather than trusting `isDoctor` alone, so a misresolved role can never
  // route a patient into the doctor dashboard (or vice versa) once the
  // appointment has loaded.
  const resolveHomePath = useCallback(() => {
    if (apptDoctorId && doctorId && String(apptDoctorId) === String(doctorId)) {
      return "/doctor-dashboard/patients";
    }
    if (apptPatientId && userId && String(apptPatientId) === String(userId)) {
      return "/user/dashboard";
    }
    return isDoctor ? "/doctor-dashboard/patients" : "/user/dashboard";
  }, [apptDoctorId, doctorId, apptPatientId, userId, isDoctor]);

  const showInlineMessage = useCallback((message, duration = 4000) => {
    // Cancel any pending clear from a previous toast so an older timer
    // can't wipe out a newer message before its own duration elapses.
    window.clearTimeout(inlineErrorTimerRef.current);
    setInlineError(message);
    inlineErrorTimerRef.current = window.setTimeout(() => {
      inlineErrorTimerRef.current = null;
      setInlineError("");
    }, duration);
  }, []);

  useEffect(() => () => window.clearTimeout(inlineErrorTimerRef.current), []);

  const flushTelemetryQueue = useCallback(() => {
    if (!socket.connected || !telemetryQueueRef.current.length) return;
    const queued = telemetryQueueRef.current.splice(0);
    queued.forEach((payload) => socket.emit("video-telemetry", payload));
  }, []);

  const logVideoEvent = useCallback(
    (event, details = {}) => {
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

      if (!appointmentId) return;

      if (socket.connected) {
        flushTelemetryQueue();
        socket.emit("video-telemetry", payload);
      } else {
        const queue = telemetryQueueRef.current;
        queue.push(payload);
        if (queue.length > TELEMETRY_QUEUE_MAX) queue.shift();
      }
    },
    [appointmentId, isDoctor, flushTelemetryQueue],
  );

  const stopStatsCollection = useCallback(() => {
    clearInterval(statsTimerRef.current);
    statsTimerRef.current = null;
    lastStatsSampleRef.current = null;
    setConnectionQuality("unknown");
  }, []);

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
          const diagnostics = {
            rtt: null,
            packetsSent: 0,
            packetsReceived: 0,
            packetsLost: 0,
            bytesSent: 0,
            bytesReceived: 0,
            localCandidateType: "unknown",
            remoteCandidateType: "unknown",
            selectedPairState: "unknown",
          };

          for (const report of stats.values()) {
            if (
              report.type === "candidate-pair" &&
              report.state === "succeeded"
            ) {
              diagnostics.selectedPairState = report.state;
              if (typeof report.currentRoundTripTime === "number") {
                diagnostics.rtt = Math.round(
                  report.currentRoundTripTime * 1000,
                );
              }
              if (typeof report.bytesSent === "number")
                diagnostics.bytesSent = report.bytesSent;
              if (typeof report.bytesReceived === "number")
                diagnostics.bytesReceived = report.bytesReceived;
              if (typeof report.packetsSent === "number")
                diagnostics.packetsSent = report.packetsSent;

              const localId = report.localCandidateId;
              const remoteId = report.remoteCandidateId;
              for (const inner of stats.values()) {
                if (inner.type === "local-candidate" && inner.id === localId) {
                  diagnostics.localCandidateType =
                    inner.candidateType || inner.type;
                }
                if (
                  inner.type === "remote-candidate" &&
                  inner.id === remoteId
                ) {
                  diagnostics.remoteCandidateType =
                    inner.candidateType || inner.type;
                }
              }
            } else if (report.type === "inbound-rtp" && !report.isRemote) {
              // packetsLost / packetsReceived live on inbound-rtp, summed
              // across the audio + video streams.
              if (typeof report.packetsReceived === "number")
                diagnostics.packetsReceived += report.packetsReceived;
              if (typeof report.packetsLost === "number")
                diagnostics.packetsLost += report.packetsLost;
            }
          }

          if (import.meta.env.DEV) console.info("[webrtc-stats]", diagnostics);
          logVideoEvent("webrtc_stats", diagnostics);
          if (typeof diagnostics.rtt === "number") {
            lastRttMsRef.current = diagnostics.rtt;
          }

          const quality = deriveConnectionQuality(
            diagnostics,
            lastStatsSampleRef.current,
          );
          lastStatsSampleRef.current = {
            packetsReceived: diagnostics.packetsReceived,
            packetsLost: diagnostics.packetsLost,
          };
          setConnectionQuality(quality);
        } catch (err) {
          logger.warn("[webrtc-stats] getStats failed:", err.message);
        }
      }, STATS_INTERVAL_MS);
    },
    [logVideoEvent, stopStatsCollection],
  );

  const emitOnlineAndJoinRoom = useCallback(() => {
    if (!socket.connected || !isReadyRef.current) return false;
    if (joinedSocketIdRef.current === socket.id) return true;

    joinedSocketIdRef.current = socket.id || "";
    setConnectionState((prev) => (prev === "connected" ? prev : "connecting"));

    const activeRole = isDoctor ? "doctor" : "user";
    const activeUserId = isDoctor ? doctorId : userId;
    // Explicit, role-scoped token on both emits — each is handled
    // independently and asynchronously on the server, so "join-appointment-room"
    // can't assume "user-online" (sent just before it) has already finished
    // resolving identity. See the server's resolveSocketIdentity for why.
    const authToken = getUserAuthToken(activeRole);
    if (activeUserId) {
      socket.emit("user-online", {
        userId: activeUserId,
        role: activeRole,
        token: authToken,
      });
    }

    socket.emit("join-appointment-room", {
      appointmentId,
      userId: activeUserId,
      role: activeRole,
      token: authToken,
      // What this client supports, relayed to the other participant in
      // "peer-joined" (as peerCapabilities). peerRebuild = handles
      // "request-peer-rebuild" AND rejects an answer whose DTLS fingerprint
      // changed (see handleAnswer) — i.e. it's safe for the other side to
      // rebuild its pc without stranding this one. A client that omits this
      // is treated as an older build that can't.
      capabilities: WEB_CLIENT_CAPABILITIES,
    });
    logVideoEvent("appointment_room_join_requested", { socketId: socket.id });
    return true;
  }, [appointmentId, doctorId, isDoctor, logVideoEvent, userId]);

  // ── Block / intercept browser back button during confirmed call ───
  // Also released once apptError is set — apptError covers every gate-screen
  // reason the call can end early (duplicate-session, access-denied/revoked,
  // cancelled, unsupported browser — see setApptError's call sites), and all
  // of them render the "Access Denied"-style gate screen below via an early
  // return. Previously this effect only depended on canJoinConsultation,
  // which stays true even after apptError fires (appointment status itself
  // doesn't change) — so the popstate listener stayed attached behind that
  // gate screen. Its "Go Back" button's navigate(-1) then triggered a
  // popstate that this still-active listener caught: it re-pushed history
  // (silently swallowing the back navigation) and opened the leaveConfirm
  // modal, whose JSX lives further down the component tree and is
  // unreachable once the gate screen's early return has already fired —
  // so the button appeared to do nothing and the user was stuck.
  useEffect(() => {
    if (!canJoinConsultation || apptError) return;

    window.history.pushState(null, "", window.location.href);

    const handlePopstate = () => {
      window.history.pushState(null, "", window.location.href);
      pendingLeaveRef.current = resolveHomePath();
      setLeaveConfirm(true);
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
    // navigate/performCleanup were listed below but never used by this
    // effect (it only sets pendingLeaveRef + opens the confirm modal; the
    // actual navigate()+performCleanup() happen later, from the confirm
    // modal's own "Leave" button) — trimmed to the dependencies this effect
    // actually reads.
  }, [canJoinConsultation, apptError, resolveHomePath]);

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
    const remoteVideo = isSwappedRef.current
      ? pipVideoRef.current
      : mainVideoRef.current;
    // Fire every element's .play() in the same synchronous tick (the array
    // literal below evaluates each playVideoElement(...) call — which itself
    // calls .play() before its first await — left to right, before
    // Promise.allSettled is even invoked) rather than awaiting them one at a
    // time. Awaiting sequentially meant only the first call's .play() ran
    // inside a user gesture's call stack (e.g. "Tap to resume audio/video");
    // by the time the second/third ran, after an await, the gesture context
    // could already have lapsed on stricter autoplay-policy browsers.
    // allSettled (not all) so one element's outcome can never prevent the
    // others' results from being read — playVideoElement already resolves to
    // true/false internally rather than rejecting, but this stays safe even
    // if that ever changes.
    const [mainResult, pipResult, remoteAudioResult] = await Promise.allSettled([
      playVideoElement(mainVideoRef.current),
      playVideoElement(pipVideoRef.current),
      playVideoElement(remoteAudioRef.current),
    ]);
    const mainOk = mainResult.status === "fulfilled" && mainResult.value;
    const pipOk = pipResult.status === "fulfilled" && pipResult.value;
    // This was previously computed and then discarded — mainVideoRef/
    // pipVideoRef are both always `muted` (autoplay-exempt on every
    // browser), so remoteAudioRef's unmuted <audio> element was the only one
    // of the three actually capable of being blocked by autoplay policy, and
    // dropping its result meant "Tap to resume audio/video" could never be
    // triggered by (or report success on) the one failure mode it exists
    // for. Mirrors DirectVideoCall.jsx's playAssignedVideos.
    const remoteAudioOk =
      remoteAudioResult.status === "fulfilled" && remoteAudioResult.value;
    const remoteOk = remoteVideo === pipVideoRef.current ? pipOk : mainOk;
    // Gate on the remote stream actually having a track — without this, the
    // banner could fire against remoteStreamRef's placeholder MediaStream
    // before any remote track has ever arrived.
    const remoteHasMedia = Boolean(remoteStreamRef.current?.getTracks().length);
    setPlaybackBlocked(
      remoteHasMedia &&
        (!remoteAudioOk || (Boolean(remoteVideo?.srcObject) && !remoteOk)),
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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      void playAssignedVideos();
    },
    [playAssignedVideos],
  );

  const attachLocalMediaStream = useCallback(
    async (stream, pc) => {
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
        const wasAdded = !sender;
        const activeSender = sender || pc.addTrack(track, stream);
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "attachLocalMediaStream:track", {
          kind: track.kind,
          id: track.id,
          action: wasAdded ? "addTrack" : "replaceTrack",
          isManualReconnect: manualReconnectRef.current,
        });
        const replace = sender ? sender.replaceTrack(track) : Promise.resolve();
        return replace.then(() =>
          tuneSenderQuality(
            activeSender,
            track.kind === "video"
              ? {
                  maxBitrate: BITRATE_PROFILE.cameraVideo,
                  maxFramerate: 30,
                  maintainResolution: true,
                }
              : { maxBitrate: BITRATE_PROFILE.voiceAudio },
          ),
        );
      });

      await Promise.allSettled(senderTuning);

      // Safety net for the one path where a remote offer was ALREADY applied
      // before our media arrived (retryMediaPermissions answering a stashed
      // offer after a permission retry): the transceivers setRemoteDescription
      // created are receive-only and replaceTrack() above doesn't change
      // that, so the answer would go out recvonly. Flip any that now carry a
      // local track to sendrecv before the answer is built. (handleOffer's
      // await-local-media-first ordering means the normal, replayed and
      // stashed offer paths never get here with a recvonly transceiver.)
      try {
        pc.getTransceivers().forEach((transceiver) => {
          if (
            transceiver.sender?.track &&
            (transceiver.direction === "recvonly" ||
              transceiver.direction === "inactive")
          ) {
            transceiver.direction = "sendrecv";
            retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "attachLocalMediaStream:direction_forced_sendrecv", {
              kind: transceiver.sender.track.kind,
            });
          }
        });
      } catch (err) {
        logger.warn("Could not adjust transceiver direction:", err?.message || err);
      }

      if (previousStream && previousStream !== stream) {
        previousStream.getTracks().forEach((track) => track.stop());
      }

      assignStreams(isSwappedRef.current);
      return true;
    },
    [assignStreams, appointmentId, isDoctor],
  );

  // A camera device reopened immediately after a previous session just
  // released it — exactly what happens on Leave -> Rejoin, since the
  // outgoing call stops the same physical device that the new call's
  // getUserMedia immediately reopens — can hand back a MediaStreamTrack
  // that reports readyState "live" and enabled before its capture pipeline
  // has actually started producing frames. The encoder feeding the
  // RTCPeerConnection catches up independently (so the remote party sees
  // video normally), but the local <video> element is left rendering
  // nothing — videoWidth/videoHeight never advance past 0 — with no error
  // ever thrown for anything in attachLocalMediaStream to catch. Verify a
  // frame actually arrived shortly after attaching and self-heal once,
  // silently, before giving up.
  const verifyLocalPlaybackLiveness = useCallback(
    async (stream, pc) => {
      if (localLivenessCheckRef.current) return;
      localLivenessCheckRef.current = true;
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        if (pc.signalingState === "closed" || localStreamRef.current !== stream) return;

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== "live" || !videoTrack.enabled) {
          return; // no local camera track to verify (audio-only, or already off)
        }

        const localVideoEl = isSwappedRef.current
          ? mainVideoRef.current
          : pipVideoRef.current;
        if (!localVideoEl || localVideoEl.videoWidth > 0) return; // already rendering fine

        logVideoEvent("local_video_frame_stall_detected", {});

        // First recovery attempt: cheap — force the element to rebind and
        // replay the SAME track rather than re-capturing the camera.
        localVideoEl.srcObject = null;
        localVideoEl.srcObject = stream;
        await playVideoElement(localVideoEl);

        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        if (pc.signalingState === "closed" || localStreamRef.current !== stream) return;
        if (localVideoEl.videoWidth > 0) return; // rebind alone fixed it

        // Rebinding didn't help — the capture pipeline itself is stuck.
        // Re-request the camera once; attachLocalMediaStream's own
        // previousStream cleanup stops the old, stuck track for us.
        logVideoEvent("local_video_recapture_attempt", {});
        const freshStream = await getConsultationMediaStream();
        if (pc.signalingState === "closed" || localStreamRef.current !== stream) {
          freshStream.getTracks().forEach((track) => track.stop());
          return;
        }
        await attachLocalMediaStream(freshStream, pc);
      } catch (err) {
        logger.warn(
          "[video-call] local playback liveness recovery failed:",
          err?.message || err,
        );
      } finally {
        localLivenessCheckRef.current = false;
      }
    },
    [attachLocalMediaStream, logVideoEvent],
  );

  // ── Rebuild coordination ──────────────────────────────────────────
  // Releases the manual "Retry" button's hold (disabled + "Reconnecting…").
  // Idempotent — called from the new connection reaching healthy
  // (markPeerConnectionHealthy) and from the MANUAL_RECONNECT_HOLD_MS
  // fallback timer, whichever comes first.
  const releaseManualReconnectGuard = useCallback(() => {
    if (!manualReconnectCooldownRef.current) return;
    window.clearTimeout(manualReconnectCooldownRef.current);
    manualReconnectCooldownRef.current = null;
    setManualReconnecting(false);
  }, []);

  // Clears the doctor's "waiting for the other person to reconnect…" banner
  // state (and the stall banner it rides on) once the connection recovers or
  // the peer leaves. Idempotent, cheap to call every watchdog tick.
  const clearWaitingForOldPeer = useCallback(() => {
    window.clearTimeout(oldPeerIceRestartTimerRef.current);
    oldPeerIceRestartTimerRef.current = null;
    if (!waitingForOldPeerRef.current) return;
    waitingForOldPeerRef.current = false;
    setWaitingForOldPeer(false);
    setReconnectStalled(false);
  }, []);

  // Cancels the doctor's "asked the patient to rebuild, waiting for its
  // fresh offer" state (see requestPcRebuild) — because the rebuild actually
  // happened another way, or the trigger condition resolved on its own.
  const cancelPeerRebuildWait = useCallback(
    (why) => {
      const wait = peerRebuildWaitRef.current;
      if (!wait) return;
      window.clearTimeout(wait.timerId);
      peerRebuildWaitRef.current = null;
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "peerRebuildWait:cancelled", {
        reason: wait.reason,
        why,
      });
    },
    [appointmentId, isDoctor],
  );

  // Single, serialized entry point for every "tear down and rebuild the pc
  // from scratch" trigger: the fingerprint / InvalidAccessError detection in
  // handleOffer, the answer-fingerprint safety net in handleAnswer,
  // handlePeerJoined's pcNeedsRebuild, the orphaned-answer recheck, the media
  // watchdog, a peer's "request-peer-rebuild", and manual Retry
  // (forceReconnect). A rebuild here is a reconnectNonce bump: the main
  // effect's cleanup closes the pc and the effect re-runs with a fresh one.
  //
  // Returns "started" | "coalesced" | "blocked" | "waiting_for_peer".
  //
  // options.manual (forceReconnect only): bypasses the automatic-rebuild rate
  // limit and is never coalesced away, even if an automatic rebuild is
  // already in flight — a person tapping Retry is explicit intent that
  // always takes effect.
  // options.offerToReplay: the peer's offer that revealed the stale pc; kept
  // in pendingRemoteOfferRef across the effect re-run and replayed onto the
  // fresh pc. Automatic requests that coalesce only update this (latest
  // wins) — a second rebuild would mint yet another DTLS fingerprint and
  // make the peer rebuild AGAIN.
  // options.countsTowardLimit=false: only for the "peer left and came back,
  // no pc exists" case — that's structural, not error recovery.
  // options.handshakeFirst / waitCancelOn (doctor only): in an appointment
  // call the patient is the sole offerer, so if the doctor rebuilds alone the
  // patient's old pc later gets an answer carrying a NEW doctor DTLS
  // fingerprint it can't apply. Automatic doctor rebuilds therefore first
  // emit "request-peer-rebuild" and wait up to PEER_REBUILD_WAIT_MS for the
  // patient's fresh offer (whose changed fingerprint makes handleOffer
  // rebuild the doctor via the normal path); if nothing arrives (e.g. a
  // client that doesn't know the event) it falls back to rebuilding alone.
  // A manual doctor Retry emits the request and rebuilds immediately.
  const requestPcRebuild = useCallback(
    async (reason, options = {}) => {
      const {
        manual = false,
        offerToReplay = null,
        countsTowardLimit = true,
        handshakeFirst = false,
        waitCancelOn = "healthy",
        skipHandshake = false,
      } = options;
      const role = isDoctor ? "doctor" : "patient";
      const log = (label, data) =>
        retryDebugLog(role, appointmentId, `requestPcRebuild:${label}`, {
          reason,
          manual,
          ...data,
        });
      const stashOffer = () => {
        if (offerToReplay) {
          pendingRemoteOfferRef.current = { payload: offerToReplay, at: Date.now() };
        }
      };

      // Capability gate (doctor only). A rebuild the DOCTOR initiates on its
      // own — manual Retry, or the watchdog / orphaned-answer triggers, which
      // are exactly the ones that use the request-peer-rebuild handshake —
      // gives the doctor a new DTLS fingerprint. A patient build that doesn't
      // announce peerRebuild can neither be asked to rebuild nor reject the
      // resulting answer, so it would be stranded on a blank video. For such
      // a peer, skip the rebuild and downgrade to the pre-existing ICE-restart
      // request (the patient re-offers from its old pc; the doctor's pc is
      // unchanged so the answer keeps the same fingerprint). Rebuilds driven
      // by the patient's own fresh offer (fingerprint_changed / sdp_error),
      // peer_requested, answer_fingerprint_changed and handlePeerJoined are
      // never gated — the peer already has (or is getting) a new pc.
      // Unknown capabilities with a peer present read as unsupported.
      if (
        isDoctor &&
        !skipHandshake &&
        (manual || handshakeFirst) &&
        peerPresentRef.current &&
        peerCapabilitiesRef.current?.peerRebuild !== true
      ) {
        retryDebugLog(role, appointmentId, "requestPcRebuild:DOWNGRADED_peer_lacks_peerRebuild", {
          reason,
          manual,
          peerCapabilities: peerCapabilitiesRef.current,
          skipped: "full pc rebuild (peer is an old client)",
          action: manual ? "ice_restart_request_only" : "ice_restart_request_then_recheck",
        });
        if (!manual && oldPeerIceRestartTimerRef.current) {
          log("COALESCED_old_peer_ice_restart_pending", {});
          return "coalesced";
        }
        if (socket.connected) {
          socket.emit("ice-restart-request", { appointmentId });
          retryDebugLog(role, appointmentId, "requestPcRebuild:old_peer_ice_restart_request_SENT", {
            reason,
            recheckInMs: OLD_PEER_ICE_RESTART_RECHECK_MS,
          });
        } else {
          // Our own signaling socket is down — nothing to send. Kick the
          // reconnect; handleSocketReconnect's doctor nudge requests the ICE
          // restart itself once we're back.
          socket.connect();
          retryDebugLog(role, appointmentId, "requestPcRebuild:old_peer_ice_restart_skipped_socket_down", {
            reason,
          });
        }
        const requestedAt = Date.now();
        window.clearTimeout(oldPeerIceRestartTimerRef.current);
        oldPeerIceRestartTimerRef.current = window.setTimeout(() => {
          oldPeerIceRestartTimerRef.current = null;
          const pc = pcRef.current;
          const connected =
            !!pc &&
            (pc.connectionState === "connected" ||
              pc.iceConnectionState === "connected" ||
              pc.iceConnectionState === "completed");
          const mediaFlowedSince = lastMediaGrowthAtRef.current >= requestedAt;
          const recovered = connected && mediaFlowedSince;
          retryDebugLog(role, appointmentId, "requestPcRebuild:old_peer_ice_restart_recheck", {
            reason,
            connected,
            mediaFlowedSince,
            recovered,
          });
          if (recovered) return;
          waitingForOldPeerRef.current = true;
          setWaitingForOldPeer(true);
          setReconnectStalled(true);
        }, OLD_PEER_ICE_RESTART_RECHECK_MS);
        return "downgraded_ice_restart";
      }

      if (!manual && countsTowardLimit) {
        const now = Date.now();
        autoRebuildTimestampsRef.current = autoRebuildTimestampsRef.current.filter(
          (t) => now - t < AUTO_REBUILD_WINDOW_MS,
        );
        if (autoRebuildTimestampsRef.current.length >= AUTO_REBUILD_MAX_COUNT) {
          log("BLOCKED_rate_limit", {
            recentCount: autoRebuildTimestampsRef.current.length,
            windowMs: AUTO_REBUILD_WINDOW_MS,
          });
          // Stop auto-rebuilding and fall back to the existing manual-Retry
          // banner rather than looping forever.
          stashOffer();
          setReconnectStalled(true);
          return "blocked";
        }
      }

      if (isDoctor && !skipHandshake && (manual || handshakeFirst)) {
        const canAskPeer = socket.connected && peerPresentRef.current;
        if (canAskPeer) {
          if (!manual) {
            if (peerRebuildWaitRef.current) {
              log("COALESCED_waiting_for_peer", {});
              stashOffer();
              return "coalesced";
            }
            socket.emit("request-peer-rebuild", { appointmentId });
            retryDebugLog(role, appointmentId, "request-peer-rebuild:SENT", {
              reason,
              manual,
              willWaitMs: PEER_REBUILD_WAIT_MS,
            });
            const timerId = window.setTimeout(() => {
              const wait = peerRebuildWaitRef.current;
              if (!wait || wait.timerId !== timerId) return;
              peerRebuildWaitRef.current = null;
              if (pcRef.current !== wait.pc) {
                retryDebugLog(role, appointmentId, "peerRebuildWait:fallback_skipped_pc_replaced", {
                  reason,
                });
                return;
              }
              retryDebugLog(role, appointmentId, "peerRebuildWait:FALLBACK_rebuilding_alone", {
                reason,
                waitedMs: PEER_REBUILD_WAIT_MS,
              });
              void requestPcRebuildRef.current(reason, { ...options, skipHandshake: true });
            }, PEER_REBUILD_WAIT_MS);
            peerRebuildWaitRef.current = {
              reason,
              cancelOn: waitCancelOn,
              timerId,
              pc: pcRef.current,
            };
            return "waiting_for_peer";
          }
          // Manual doctor Retry: ask the patient to rebuild too, but don't
          // make the person who just tapped Retry wait for it.
          socket.emit("request-peer-rebuild", { appointmentId });
          retryDebugLog(role, appointmentId, "request-peer-rebuild:SENT", {
            reason,
            manual,
            willWaitMs: 0,
          });
        }
      }

      if (pcRebuildInProgressRef.current) {
        if (!manual) {
          log("COALESCED", {});
          stashOffer();
          return "coalesced";
        }
        log("manual_preempting_in_progress_rebuild", {});
      }

      pcRebuildInProgressRef.current = true;
      window.clearTimeout(pcRebuildSafetyTimerRef.current);
      pcRebuildSafetyTimerRef.current = window.setTimeout(() => {
        pcRebuildSafetyTimerRef.current = null;
        pcRebuildInProgressRef.current = false;
      }, REBUILD_IN_PROGRESS_SAFETY_MS);
      if (!manual && countsTowardLimit) autoRebuildTimestampsRef.current.push(Date.now());
      cancelPeerRebuildWait("rebuild_started");
      window.clearTimeout(orphanedAnswerCheckTimerRef.current);
      orphanedAnswerCheckTimerRef.current = null;
      stashOffer();
      // The pc we're about to build has no prior negotiation — clearing this
      // stops the replayed offer from re-triggering the fingerprint check.
      lastRemoteFingerprintRef.current = null;
      // Tells the effect cleanup this is a rebuild, not a departure: it skips
      // leave-appointment-room and preserves an in-progress screen share.
      manualReconnectRef.current = true;
      setReconnectStalled(false);
      setReconnectNonce((n) => n + 1);
      log("START", { countsTowardLimit });
      return "started";
    },
    [appointmentId, cancelPeerRebuildWait, isDoctor],
  );

  useEffect(() => {
    requestPcRebuildRef.current = requestPcRebuild;
  }, [requestPcRebuild]);

  // ── Main WebRTC + Socket setup ────────────────────────────────────
  useEffect(() => {
    if (!canJoinConsultation) return;
    // This tab's session has been authoritatively terminated (denied,
    // revoked, or superseded — see sessionEnded's declaration). Returning
    // here both stops a new PeerConnection/media request from ever being
    // made again for this mount, and — since sessionEnded is a dependency
    // of this effect — running this return is preceded by this same
    // effect's own cleanup for whatever instance was previously active,
    // which is what actually removes its socket listeners and tears down
    // its PeerConnection and local tracks.
    if (sessionEnded) return;
    if (!iceConfig) {
      if (iceConfigError) {
        setApptError(`Video consultation is not configured: ${iceConfigError}`);
      }
      return;
    }

    // Capability check: everything below assumes RTCPeerConnection and
    // getUserMedia exist. Older/locked-down browsers and some embedded
    // WebViews don't have them — fail into the same gate-screen pattern
    // used for every other fatal appointment state, instead of letting
    // `new RTCPeerConnection` throw uncaught further down.
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setApptError(
        "Your browser doesn't support video calls. Please use a recent version of Chrome, Edge, Firefox, or Safari.",
      );
      return;
    }

    let mounted = true;
    completedRef.current = false;
    pendingRemoteCandidatesRef.current = [];
    ignoreOfferRef.current = false;
    settingRemoteAnswerPendingRef.current = false;
    pendingOfferIdRef.current = null;
    pendingOfferSentAtRef.current = 0;
    lastReceivedOfferIdRef.current = null;
    clearTimeout(offerAnswerTimeoutRef.current);
    offerAnswerTimeoutRef.current = null;
    clearTimeout(iceRestartTimerRef.current);
    clearTimeout(ignoreOfferResetTimerRef.current);
    clearTimeout(reconnectStallTimerRef.current);
    reconnectStallTimerRef.current = null;
    setReconnectStalled(false);
    let resolveLocalReady = () => {};
    const localReadyPromise = new Promise((resolve) => {
      resolveLocalReady = resolve;
    });
    // localReadyPromise is settled by the media IIFE below, which itself gives
    // up on getUserMedia after MEDIA_ACQUIRE_TIMEOUT_MS. This is the backstop
    // for the rest of that IIFE (e.g. enumerateDevices) hanging: resolves the
    // string "timeout" so the offer path carries on receive-only instead of
    // waiting forever. Only an explicit `false` means "media failed".
    const waitForLocalReady = async (where, offerId) => {
      let timer;
      const result = await Promise.race([
        localReadyPromise,
        new Promise((resolve) => {
          timer = window.setTimeout(() => resolve("timeout"), MEDIA_ACQUIRE_TIMEOUT_MS + 2000);
        }),
      ]);
      window.clearTimeout(timer);
      if (result === "timeout") {
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "localReady:wait_timed_out", {
          where,
          offerId: offerId || null,
        });
      }
      return result;
    };

    if (pcRef.current && pcRef.current.signalingState !== "closed") {
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "effect:closing_old_pc", {
        isManualReconnect: manualReconnectRef.current,
        oldPcConnectionState: pcRef.current.connectionState,
        oldPcIceConnectionState: pcRef.current.iceConnectionState,
        oldPcSignalingState: pcRef.current.signalingState,
        oldPcAgeMs: pcCreatedAtRef.current ? Date.now() - pcCreatedAtRef.current : null,
      });
      pcRef.current.close();
    }

    let pc;
    try {
      pc = new RTCPeerConnection(iceConfig);
    } catch (err) {
      logger.error("RTCPeerConnection construction failed:", err);
      setApptError("Could not start the video call on this browser or device.");
      return;
    }
    pcRef.current = pc;
    pcCreatedAtRef.current = Date.now();
    // TEMPORARY (RETRY_DEBUG)
    retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "effect:new_pc_created", {
      isManualReconnect: manualReconnectRef.current,
    });
    logger.info("WebRTC peer connection created", {
      iceServers: iceConfig.iceServers.map((server) => ({
        urls: server.urls,
        hasUsername: Boolean(server.username),
      })),
    });

    // `let`, not `const` — pc.ontrack below reassigns this to a fresh
    // MediaStream instance whenever it replaces a track, so every consumer
    // that reads it afterwards (including this same closure, on the next
    // track event) sees the current object. See pc.ontrack for why a fresh
    // instance is needed rather than mutating this one in place.
    let remoteStream = new MediaStream();
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
          logger.warn("Queued ICE candidate rejected:", err.message);
        }
      }
    };

    // Same formula the offer-answer watchdog uses to decide an outstanding
    // offer is overdue — widened on high-latency links, capped so a briefly
    // degraded connection can't wedge retry logic behind a multi-minute wait.
    const computeOfferAnswerTimeout = () => {
      const measuredRtt = lastRttMsRef.current;
      return typeof measuredRtt === "number" && measuredRtt > 0
        ? Math.min(Math.max(OFFER_ANSWER_TIMEOUT_MS, measuredRtt * 3 + 5000), 30000)
        : OFFER_ANSWER_TIMEOUT_MS;
    };

    const createAndSendOffer = async ({ iceRestart = false } = {}) => {
      if (!mounted || pc.signalingState === "closed" || makingOfferRef.current)
        return false;
      if (!isReadyRef.current) return false;
      if (pc.signalingState !== "stable") {
        // A peer connection parked in "have-local-offer" past its answer
        // deadline is holding a dead offer nothing will ever answer — every
        // recovery trigger (peer-rejoin nudge, ICE-restart request, socket
        // reconnect) would otherwise skip here and wait out the separate
        // watchdog again. Roll the stale offer back and fall through to a
        // fresh one. Any state other than a genuinely-stuck have-local-offer
        // is left alone (a real negotiation is mid-flight).
        const stuckMs = pendingOfferSentAtRef.current
          ? Date.now() - pendingOfferSentAtRef.current
          : 0;
        const offerIsStale =
          pc.signalingState === "have-local-offer" &&
          stuckMs > computeOfferAnswerTimeout();
        if (!offerIsStale) {
          logger.info(
            "Skipping offer because signaling state is",
            pc.signalingState,
          );
          return false;
        }
        try {
          logVideoEvent("stale_local_offer_rollback", {
            stuckMs,
            offerId: pendingOfferIdRef.current || null,
          });
          await pc.setLocalDescription({ type: "rollback" });
          if (!mounted || pc.signalingState === "closed") return false;
          pendingOfferIdRef.current = null;
          pendingOfferSentAtRef.current = 0;
          clearTimeout(offerAnswerTimeoutRef.current);
          offerAnswerTimeoutRef.current = null;
        } catch (err) {
          logger.warn("Rollback of stale local offer failed:", err.message);
          return false;
        }
        if (pc.signalingState !== "stable") return false;
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
        const offerId = makeOfferId();
        pendingOfferIdRef.current = offerId;
        pendingOfferSentAtRef.current = Date.now();
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "createAndSendOffer:offer_sent", {
          offerId,
          iceRestart,
          isManualReconnect: manualReconnectRef.current,
          dtlsFingerprint: retryDebugExtractFingerprint(pc.localDescription?.sdp),
        });
        socket.emit("video-offer", {
          appointmentId,
          offer: pc.localDescription,
          offerId,
        });
        if (iceRestart)
          logVideoEvent("ice_restart_offer_sent", {
            signalingState: pc.signalingState,
          });

        // Self-heal if this specific offer never gets answered (dropped
        // signaling message, peer mid-reconnect, replayed/rejected stale
        // answer, etc.) — otherwise pc stays wedged in "have-local-offer"
        // forever, since nothing else ever rolls back our own offer.
        //
        // The wait is widened on high-latency links: OFFER_ANSWER_TIMEOUT_MS
        // is sized for a typical connection, but on a slow/high-RTT network
        // (mobile, international) that alone can fire before the answer had
        // any realistic chance to arrive. When a recent RTT sample exists,
        // require at least 3x it (plus headroom for signaling + SDP
        // processing), capped so a temporarily degraded link can't wedge
        // retry logic behind a multi-minute wait.
        const measuredRtt = lastRttMsRef.current;
        const effectiveOfferAnswerTimeoutMs = computeOfferAnswerTimeout();

        clearTimeout(offerAnswerTimeoutRef.current);
        offerAnswerTimeoutRef.current = window.setTimeout(() => {
          offerAnswerTimeoutRef.current = null;
          if (!mounted || pc.signalingState === "closed") return;
          if (pendingOfferIdRef.current !== offerId) return; // already resolved or superseded
          if (pc.signalingState !== "have-local-offer") {
            pendingOfferIdRef.current = null;
            return;
          }
          logVideoEvent("offer_answer_timeout_rollback", {
            offerId,
            signalingState: pc.signalingState,
            timeoutMs: effectiveOfferAnswerTimeoutMs,
            measuredRtt,
          });
          logger.warn(
            "No answer received for offer %s within %dms (rtt=%s) — rolling back to retry.",
            offerId,
            effectiveOfferAnswerTimeoutMs,
            measuredRtt ?? "unknown",
          );
          pc.setLocalDescription({ type: "rollback" })
            .then(() => {
              pendingOfferIdRef.current = null;
              pendingOfferSentAtRef.current = 0;
              // Retry directly rather than via scheduleIceRestart(): that
              // helper bails out early whenever pc.connectionState already
              // reads "connected" — which is exactly the misleading state
              // this timeout is designed to catch (the underlying
              // connectionState can lag well behind reality; a timed-out
              // offer is itself strong evidence something needs
              // renegotiating regardless of what connectionState currently
              // reports). createAndSendOffer's own guards (mounted,
              // signalingState, isReadyRef) still apply, so this can't fire
              // against a closed/torn-down pc.
              void createAndSendOffer({ iceRestart: true });
            })
            .catch((err) => {
              pendingOfferIdRef.current = null;
              logger.error("Rollback after offer-answer timeout failed:", err);
            });
        }, effectiveOfferAnswerTimeoutMs);

        return true;
      } catch (err) {
        logger.error(
          iceRestart ? "ICE restart offer failed:" : "Offer failed:",
          err,
        );
        if (iceRestart)
          logVideoEvent("ice_restart_offer_failed", { message: err.message });
        return false;
      } finally {
        makingOfferRef.current = false;
      }
    };
    createAndSendOfferRef.current = createAndSendOffer;

    const startConnectionWatchdog = () => {
      clearTimeout(connectionFailTimerRef.current);
      connectionFailTimerRef.current = setTimeout(() => {
        if (!mounted || pc.signalingState === "closed") return;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        )
          return;
        logger.warn(
          "Connection establishment timed out; requesting ICE recovery.",
        );
        scheduleIceRestart();
      }, CONNECTION_FAIL_TIMEOUT_MS);
    };

    // UI-only signal, independent of the ICE-restart retry machinery above:
    // if a peer is known to be present but we still aren't connected after a
    // while, let the user know and offer a manual full reconnect instead of
    // leaving them staring at a silent spinner.
    const clearReconnectStallWatch = () => {
      clearTimeout(reconnectStallTimerRef.current);
      reconnectStallTimerRef.current = null;
      // Every call site of this function represents either a genuine
      // reconnect success or "no longer trying to reconnect right now"
      // (peer left) — either way, a future stall is a fresh episode, not a
      // continuation of whatever was happening before.
      reconnectStallCountRef.current = 0;
      setReconnectStalled(false);
    };

    const startReconnectStallWatch = (delayMs) => {
      if (reconnectStallTimerRef.current) return;
      reconnectStallTimerRef.current = setTimeout(() => {
        reconnectStallTimerRef.current = null;
        if (!mounted || pc.signalingState === "closed") return;
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
      // Nothing to restart to once the peer has genuinely left — see
      // peerPresentRef. handlePeerJoined re-drives recovery when they return.
      if (!peerPresentRef.current) return;
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
      if (!mounted || !peerPresentRef.current || iceRestartTimerRef.current)
        return;
      iceRestartTimerRef.current = setTimeout(async () => {
        iceRestartTimerRef.current = null;
        if (!mounted || !peerPresentRef.current || pc.signalingState === "closed")
          return;
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
        // connection stuck in "disconnected" may never fire again. Mirrors
        // DirectVideoCall.jsx's scheduleIceRestart.
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
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
          } else {
            iceRecoveryAttemptsRef.current += 1;
            logVideoEvent("ice_recovery_attempt", {
              attempts: iceRecoveryAttemptsRef.current,
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
            });

            if (isDoctor) {
              requestPeerIceRestart();
            } else {
              await createAndSendOffer({ iceRestart: true });
            }
          }
        }

        // Still unhealthy (or skipped because we're offline) — keep the
        // retry loop alive on the same cadence instead of relying on
        // another state-change event to re-enter this function.
        scheduleIceRestart();
      }, ICE_RESTART_DELAY_MS);
    };

    // See kickIceRecoveryRef's declaration — invoked directly from the
    // browser's "online" event so a network path recovering while the
    // socket itself never dropped still gets a prompt recovery check.
    kickIceRecoveryRef.current = () => {
      if (!mounted || !peerPresentRef.current || pc.signalingState === "closed")
        return;
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      )
        return;
      scheduleIceRestart();
    };

    // Get local media after a lightweight device check.
    (async () => {
      try {
        setDeviceCheck((prev) => ({ ...prev, status: "checking" }));
        const summary = await getDeviceCheckSummary();
        if (!mounted) return;
        setDeviceCheck({ ...summary, status: "checking" });
        logVideoEvent("device_check", summary);

        const mediaAttempt = getConsultationMediaStream();
        if (await mediaAcquireTimedOut(mediaAttempt)) {
          // getUserMedia is hanging (unanswered permission prompt, busy or
          // wedged device). Don't hold the whole call hostage: join and
          // answer receive-only, show the usual media error + Retry, and
          // attach the stream normally if it ever arrives.
          logger.warn("getUserMedia still pending after", MEDIA_ACQUIRE_TIMEOUT_MS, "ms — continuing without local media");
          logVideoEvent("media_acquire_timeout", { timeoutMs: MEDIA_ACQUIRE_TIMEOUT_MS });
          retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "media:acquire_timed_out", {
            timeoutMs: MEDIA_ACQUIRE_TIMEOUT_MS,
          });
          if (mounted) {
            setCamError(true);
            setCamErrorReason(
              "Your camera or microphone is taking too long to respond. The call will connect without it — tap Retry, or check that no other app is using it.",
            );
            setDeviceCheck((prev) => ({ ...prev, status: "failed" }));
            setIsReady(true);
            isReadyRef.current = true;
            if (socket.connected) joinRoom();
          }
          resolveLocalReady(true);
          mediaAttempt
            .then(async (lateStream) => {
              // Skip if the call moved on, or Retry already published media.
              if (
                !mounted ||
                pc.signalingState === "closed" ||
                pc.getSenders().some((s) => s.track && s.track.readyState === "live")
              ) {
                lateStream.getTracks().forEach((t) => t.stop());
                return;
              }
              await attachLocalMediaStream(lateStream, pc);
              void verifyLocalPlaybackLiveness(lateStream, pc);
              setCamError(false);
              setCamErrorReason("");
              setDeviceCheck((prev) => ({ ...prev, status: "ready" }));
              logVideoEvent("media_late_attached", {
                audioTracks: lateStream.getAudioTracks().length,
                videoTracks: lateStream.getVideoTracks().length,
              });
              retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "media:late_attached", {});
              // The connection was negotiated without our tracks — offer again
              // so they get published (createAndSendOffer guards state/glare).
              window.setTimeout(() => {
                if (mounted && pc.signalingState !== "closed") {
                  void createAndSendOffer({ iceRestart: false });
                }
              }, 200);
            })
            .catch((err) => {
              // Same handling as an immediate failure (the error/Retry UI is
              // already up; just make the reason accurate).
              logVideoEvent("media_permission_failed", { name: err?.name, message: err?.message });
              if (mounted) setCamErrorReason(mediaErrorMessage(err));
            });
          return;
        }
        const stream = await mediaAttempt;
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        await attachLocalMediaStream(stream, pc);
        void verifyLocalPlaybackLiveness(stream, pc);

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
              if (
                pc.connectionState === "connected" ||
                pc.iceConnectionState === "connected" ||
                pc.iceConnectionState === "completed"
              )
                return;
              void createAndSendOffer({ iceRestart: inCallRef.current });
            }, 300);
          }
        }
        resolveLocalReady(true);
      } catch (err) {
        logger.error("All media attempts failed:", err.name, err.message);
        logVideoEvent("media_permission_failed", {
          name: err.name,
          message: err.message,
        });
        if (mounted) {
          setCamError(true);
          setCamErrorReason(mediaErrorMessage(err));
          setDeviceCheck((prev) => ({ ...prev, status: "failed" }));
        }
        resolveLocalReady(false);
      }
    })();

    pc.ontrack = (event) => {
      const incomingTracks = event.streams?.length
        ? event.streams.flatMap((stream) => stream.getTracks())
        : [event.track].filter(Boolean);

      // Set when this event actually swaps out a previously-live track for
      // a given kind (as opposed to a first-time add) — see below for why
      // that case needs more than an in-place mutation.
      let trackWasReplaced = false;

      incomingTracks.forEach((track) => {
        // The sending side only ever sends one track per kind (camera OR
        // screen share for video, never both — see startScreenShare's
        // sender.replaceTrack). So a new track of a given kind always
        // replaces the previous one for that kind. This matters a lot after
        // the remote peer's connection is recreated (e.g. they refreshed):
        // their new track has a different id than the old one, so it
        // wouldn't dedupe by id — without pruning, the dead old track stays
        // in this stream alongside the new live one, and the video element
        // can end up stuck rendering (or freezing on) the wrong track.
        const staleTracksOfKind = remoteStream
          .getTracks()
          .filter(
            (existing) =>
              existing.kind === track.kind && existing.id !== track.id,
          );
        if (staleTracksOfKind.length > 0) trackWasReplaced = true;
        staleTracksOfKind.forEach((stale) => remoteStream.removeTrack(stale));

        if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track);

        // A receiver's track fires "mute" when RTP stops arriving for that
        // specific SSRC (e.g. the sender's encoder hiccups, or a transient
        // bandwidth squeeze starves video while audio keeps flowing) without
        // any change to the overall connection/ICE state — none of the
        // reconnection machinery in this effect is reachable from that, so
        // without an explicit listener the <video> element is left frozen on
        // its last frame indefinitely even though audio (no comparable
        // per-frame pipeline to freeze) recovers on its own. Reassigning
        // these on every ontrack firing for this track is safe/idempotent —
        // a plain property assignment, not an accumulating listener list.
        track.onmute = () => {
          logVideoEvent("remote_track_muted", { kind: track.kind, id: track.id });
        };
        track.onunmute = () => {
          logVideoEvent("remote_track_unmuted", { kind: track.kind, id: track.id });
          if (!mounted) return;
          // Same track object, same MediaStream — force a genuine source
          // change the same way the trackWasReplaced branch below already
          // does, so the element actually repaints instead of treating this
          // as a no-op reassignment to an unchanged reference.
          remoteStream = new MediaStream(remoteStream.getTracks());
          remoteStreamRef.current = remoteStream;
          assignStreams(isSwappedRef.current);
          void playAssignedVideos();
        };
      });

      if (trackWasReplaced) {
        // Some browsers don't reliably rebind a <video> element's decode/
        // render pipeline to a track that was swapped into a MediaStream
        // it's already displaying — re-assigning `srcObject` to the SAME
        // object reference (as assignStreams does below) can be treated as
        // a no-op, leaving the video frozen on the last frame from the old
        // track. Audio recovers regardless, since continuous playback has
        // no comparable per-frame pipeline to rebind. Rebuilding the stream
        // as a new object forces every consumer's next `srcObject`
        // assignment to be a genuine source change, which every browser
        // does honor. First-time track additions (no replacement) are
        // unaffected and keep mutating the existing stream as before.
        remoteStream = new MediaStream(remoteStream.getTracks());
        remoteStreamRef.current = remoteStream;
      }

      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "pc.ontrack", {
        trackWasReplaced,
        tracks: incomingTracks.map((track) => ({
          kind: track.kind,
          id: track.id,
          readyState: track.readyState,
          muted: track.muted,
          enabled: track.enabled,
        })),
        streamCount: event.streams?.length || 0,
        attachTarget: isSwappedRef.current
          ? "pipVideoRef(remote)"
          : "mainVideoRef(remote)",
        alsoAttachedTo: "remoteAudioRef",
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
        logVideoEvent("ice_candidate_gathered", candidateInfo);
        socket.emit("ice-candidate", { appointmentId, candidate: e.candidate });
      } else {
        logVideoEvent("ice_gathering_complete", {});
      }
    };

    // Shared by onconnectionstatechange/oniceconnectionstatechange's
    // "connected" transitions below, and by
    // resyncConnectionStateFromPeerConnection further down (a socket
    // reconnect finding the peer connection was healthy all along) — see
    // that function's own comment for why it needs to reuse this. Mirrors
    // VideoCallController._handleConnectedState in the Flutter app.
    const markPeerConnectionHealthy = () => {
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "markPeerConnectionHealthy:called", {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        remoteRebindPending: remoteRebindPendingRef.current,
        hasConnectedOnce: hasConnectedOnceRef.current,
      });
      clearTimeout(iceRestartTimerRef.current);
      clearTimeout(connectionFailTimerRef.current);
      iceRestartTimerRef.current = null;
      restartRequestInFlightRef.current = false;
      iceRecoveryAttemptsRef.current = 0;
      pendingOfferSentAtRef.current = 0;
      peerPresentRef.current = true;
      clearReconnectStallWatch();
      // A pending orphaned-answer recheck is moot once the pc is healthy, as
      // is a doctor's "waiting for the patient to rebuild" state armed for a
      // not-yet-connected / orphaned-answer reason (a connected-but-silent
      // stall is instead cancelled by the media watchdog seeing media flow).
      window.clearTimeout(orphanedAnswerCheckTimerRef.current);
      orphanedAnswerCheckTimerRef.current = null;
      if (peerRebuildWaitRef.current?.cancelOn === "healthy") {
        cancelPeerRebuildWait("pc_healthy");
      }
      // Reconnected: drop any doctor-side "waiting for the other person to
      // reconnect…" state (set when an old-build peer was asked for an ICE
      // restart instead of the doctor rebuilding).
      clearWaitingForOldPeer();
      // The rebuilt connection is up — end the manual Retry button's hold.
      releaseManualReconnectGuard();
      hasConnectedOnceRef.current = true;
      setConnectionState("connected");
      setIsRemoteConnected(true);
      if (!inCallRef.current) {
        setInCall(true);
        inCallRef.current = true;
      }
      startStatsCollection(pc);
      if (remoteRebindPendingRef.current) {
        remoteRebindPendingRef.current = false;
        // A recovery that reused the same track (an ICE restart, or the
        // browser's own passive ICE self-healing after a network switch)
        // never re-fires pc.ontrack, so nothing else would ever rebind the
        // <video> element — rebuild remoteStream as a new object, the same
        // fix pc.ontrack's trackWasReplaced branch above already applies for
        // the track-replaced case, so every consumer's next srcObject
        // assignment is honored as a genuine source change. Only reached
        // once hasConnectedOnceRef is already true (see the set-sites
        // below), so remoteStream always already holds live tracks here.
        remoteStream = new MediaStream(remoteStream.getTracks());
        remoteStreamRef.current = remoteStream;
        assignStreams(isSwappedRef.current);
        void playAssignedVideos();
      }
      // No-op unless the cleanup that preceded this connection preserved an
      // in-progress screen share across the rebuild — see
      // pendingScreenShareResumeRef's own comment.
      resumeScreenShareRef.current();
    };

    // A Socket.IO (signaling) reconnect is a different transport than the
    // already-established WebRTC/ICE media path — if the peer connection
    // itself was never affected by the blip (a common case: the signaling
    // socket times out through a proxy while the UDP/TURN media path
    // survives untouched), neither onconnectionstatechange nor
    // oniceconnectionstatechange ever fires again (no real state transition
    // happened), so nothing would otherwise clear the "disconnected" UI
    // state handleSocketDisconnect sets further down — permanently
    // stranding the UI on "Reconnecting..." over a call that's actually
    // still working. Called after every (re)connect to resync immediately
    // from the peer connection's actual current state instead of waiting on
    // an event that may never come. Safe to call even when nothing changed —
    // markPeerConnectionHealthy only resets state/timers to the same values
    // and restarts stats polling, and creates no offers. Mirrors
    // VideoCallController._resyncConnectionStateFromPeerConnection.
    const resyncConnectionStateFromPeerConnection = () => {
      if (!mounted || pc.signalingState === "closed") return;
      const isConnected =
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed";
      if (isConnected) markPeerConnectionHealthy();
    };

    // Assigned to networkRecoveryRef so the separate online/offline effect
    // below can invoke it — same cross-effect pattern kickIceRecoveryRef
    // already uses. The browser's "online" event typically fires much
    // faster than WebRTC's own ICE consent-check can notice a dead
    // transport (that can take 20-30s+), so this can run well before — or
    // entirely instead of — any onconnectionstatechange/
    // oniceconnectionstatechange transition. Gives the existing ICE stack a
    // short, fixed settle window (the same ICE_RESTART_DELAY_MS
    // scheduleIceRestart already uses — no new timing constant introduced)
    // to either genuinely fail (in which case the untouched connection-state
    // handlers and scheduleIceRestart's own timer already own recovery from
    // there) or silently self-heal; only once neither of those is going to
    // trigger a rebind on its own does this proactively run the exact same
    // rebind markPeerConnectionHealthy() already trusts for the analogous
    // "recovered, same track" case. Idempotent and race-safe:
    // remoteRebindPendingRef is the single shared signal armed just below —
    // if a genuine disconnect/reconnect cycle beats this to it,
    // markPeerConnectionHealthy() will already have cleared the flag by the
    // time this checks it, and this becomes a no-op.
    networkRecoveryRef.current = () => {
      if (networkRecoveryInProgressRef.current) return;
      if (!mounted || manualReconnectRef.current) return;
      const currentPc = pc;
      if (
        !currentPc ||
        currentPc.signalingState === "closed" ||
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
        if (
          !mounted ||
          pcRef.current !== currentPc ||
          currentPc.signalingState === "closed"
        )
          return;
        const stillConnected =
          currentPc.connectionState === "connected" ||
          currentPc.iceConnectionState === "connected" ||
          currentPc.iceConnectionState === "completed";
        if (!stillConnected) return; // unhealthy — existing handlers/scheduleIceRestart own recovery from here
        if (!remoteRebindPendingRef.current) return; // already consumed by a real reconnect in the meantime
        markPeerConnectionHealthy();
      }, ICE_RESTART_DELAY_MS);
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "onconnectionstatechange", {
        oldState: retryDebugPrevConnStateRef.current,
        newState: s,
      });
      retryDebugPrevConnStateRef.current = s;
      if (!mounted) return;
      if (s === "connected") {
        markPeerConnectionHealthy();
      } else if (s === "connecting") {
        setConnectionState("connecting");
        startConnectionWatchdog();
      } else if (s === "disconnected" || s === "failed") {
        logVideoEvent("peer_connection_unhealthy", {
          state: s,
          iceConnectionState: pc.iceConnectionState,
        });
        setConnectionState("disconnected");
        setIsRemoteConnected(false);
        if (hasConnectedOnceRef.current) remoteRebindPendingRef.current = true;
        scheduleIceRestart();
        // Only handlePeerJoined armed this watch before, gated on
        // !inCallRef — so a drop after the call had already connected once
        // was never given a manual Retry escape hatch, just a passive
        // "Reconnecting..." message. Re-arm it here for that case, with a
        // shorter timeout since this is a known-working connection, not a
        // first handshake.
        if (hasConnectedOnceRef.current) startReconnectStallWatch(12000);
      }
    };

    // Fallback for browsers where onconnectionstatechange fires late or not at all
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "oniceconnectionstatechange", {
        oldState: retryDebugPrevIceStateRef.current,
        newState: s,
      });
      retryDebugPrevIceStateRef.current = s;
      if (!mounted) return;
      if (s === "connected" || s === "completed") {
        markPeerConnectionHealthy();
      } else if (s === "checking") {
        if (!inCallRef.current) setConnectionState("connecting");
        startConnectionWatchdog();
      } else if (s === "failed") {
        logger.warn(
          "ICE connection failed - connection may not work properly",
        );
        logVideoEvent("ice_connection_failed", {
          state: s,
          connectionState: pc.connectionState,
        });
        setConnectionState("disconnected");
        setIsRemoteConnected(false);
        if (hasConnectedOnceRef.current) remoteRebindPendingRef.current = true;
        scheduleIceRestart();
        if (hasConnectedOnceRef.current) startReconnectStallWatch(12000);
      } else if (s === "disconnected") {
        logger.warn("ICE connection disconnected");
        logVideoEvent("ice_connection_disconnected", {
          state: s,
          connectionState: pc.connectionState,
        });
        setConnectionState("connecting");
        if (hasConnectedOnceRef.current) remoteRebindPendingRef.current = true;
        scheduleIceRestart();
        if (hasConnectedOnceRef.current) startReconnectStallWatch(12000);
      }
    };

    // Socket handlers
    const handleOffer = async ({ offer, offerId: incomingOfferId }) => {
      if (!offer || !mounted) return;
      // An offer means the peer is here and negotiating — keep the recovery
      // machinery armed for them.
      peerPresentRef.current = true;
      try {
        setConnectionState("connecting");
        // Local camera/mic must be attached to THIS pc BEFORE the offer is
        // applied, for every offer path (a normal incoming offer, the offer
        // replayed onto a freshly rebuilt pc, a stashed one). Applying it
        // first makes setRemoteDescription create the transceivers itself,
        // receive-only and without our tracks; attachLocalMediaStream then
        // only replaceTrack()s onto them — which doesn't change direction —
        // so the answer comes out audio:recvonly / video:recvonly and the
        // peer never receives our media (found by the e2e suite: a rebuilt
        // pc replays the offer ~10ms after creation, long before
        // getUserMedia has resolved). Awaiting first lets
        // attachLocalMediaStream create sendrecv transceivers that the offer
        // then matches, exactly as DirectVideoCall's setupPeerConnection does
        // by adding tracks before replaying its buffered offer. Resolves
        // false (and we carry on, receive-only as before) if media can't be
        // acquired. Incoming ICE candidates are queued meanwhile
        // (pendingRemoteCandidatesRef) and flushed after the offer is applied.
        await waitForLocalReady("handleOffer:before_apply", incomingOfferId);
        if (!mounted || pc.signalingState === "closed") return;
        const readyForOffer =
          !makingOfferRef.current &&
          (pc.signalingState === "stable" ||
            settingRemoteAnswerPendingRef.current);
        const offerCollision = !readyForOffer;

        // Computed BEFORE the collision/ignore logic on purpose: a changed
        // DTLS fingerprint means the peer tore down and rebuilt its
        // RTCPeerConnection (its own Retry). That fresh offer can never be
        // applied to this side's still-open, previously negotiated pc — the
        // m-line layout/DTLS identity differ, and setRemoteDescription throws
        // InvalidAccessError ("order of m-lines ... doesn't match") with no
        // answer ever sent — so treating it as ordinary glare (ignore/stash)
        // would drop the one offer that matters. Both fingerprints must be
        // non-null: the very first offer has nothing to compare against, and
        // an unparseable SDP must never trigger a rebuild on its own (the
        // setRemoteDescription error path below still catches that case).
        const incomingFingerprint = extractDtlsFingerprint(offer?.sdp);
        const previousFingerprint = lastRemoteFingerprintRef.current;
        const peerFingerprintChanged =
          incomingFingerprint != null &&
          previousFingerprint != null &&
          incomingFingerprint !== previousFingerprint;

        const shouldIgnoreOffer =
          !isPolitePeer && offerCollision && !peerFingerprintChanged;

        // TEMPORARY (RETRY_DEBUG): snapshot everything relevant at the
        // moment this offer arrived, before any of it is mutated below.
        const retryDebugRole = isDoctor ? "doctor" : "patient";
        const retryDebugPcAgeMs = pcCreatedAtRef.current
          ? Date.now() - pcCreatedAtRef.current
          : null;
        retryDebugLog(retryDebugRole, appointmentId, "handleOffer:arrived", {
          offerId: incomingOfferId || null,
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          pcAgeMs: retryDebugPcAgeMs,
          pcLooksFreshlyRebuilt:
            retryDebugPcAgeMs !== null && retryDebugPcAgeMs < 3000,
          makingOffer: makingOfferRef.current,
          settingRemoteAnswerPending: settingRemoteAnswerPendingRef.current,
          offerCollision,
          isPolitePeer,
          shouldIgnoreOffer,
          incomingDtlsFingerprint: incomingFingerprint,
          previousRemoteDtlsFingerprint: previousFingerprint,
          dtlsFingerprintChanged: peerFingerprintChanged,
        });

        if (peerFingerprintChanged) {
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:peer_rebuilt_detected_via_fingerprint", {
            offerId: incomingOfferId || null,
          });
          const status = await requestPcRebuild("fingerprint_changed", {
            offerToReplay: { offer, offerId: incomingOfferId },
          });
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:rebuild_request_result", {
            offerId: incomingOfferId || null,
            status,
          });
          return;
        }

        if (shouldIgnoreOffer) {
          markIgnoredOffer();
        } else {
          resetIgnoredOffer();
        }
        if (shouldIgnoreOffer) {
          logger.info("Ignoring colliding offer from peer.");
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:IGNORED_collision", {
            offerId: incomingOfferId || null,
          });
          return;
        }

        if (offerCollision && pc.signalingState === "have-local-offer") {
          logger.info("Rolling back local offer to accept peer offer.");
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:rollback_local_offer", {
            offerId: incomingOfferId || null,
          });
          await pc.setLocalDescription({ type: "rollback" });
          // Our own outstanding offer was just discarded — any answer that
          // still shows up for it later is stale and must be rejected, and
          // the answer-timeout watchdog for it is no longer relevant.
          pendingOfferIdRef.current = null;
          pendingOfferSentAtRef.current = 0;
          clearTimeout(offerAnswerTimeoutRef.current);
          offerAnswerTimeoutRef.current = null;
        } else if (offerCollision) {
          logger.info(
            "Ignoring offer while negotiation is already in progress.",
          );
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:IGNORED_in_progress", {
            offerId: incomingOfferId || null,
            signalingState: pc.signalingState,
          });
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        } catch (err) {
          // Reactive fallback for the same "peer rebuilt their pc" case the
          // fingerprint check above catches proactively — reached when there
          // was no previous fingerprint to compare against yet, or the
          // fingerprint couldn't be parsed. This is the exact production
          // error: Chrome's InvalidAccessError "the order of m-lines in
          // subsequent offer doesn't match order from previous offer/answer".
          const looksLikeStalePcRenegotiation =
            err?.name === "InvalidAccessError" ||
            /m-line/i.test(err?.message || "");
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:setRemoteDescription:ERROR", {
            offerId: incomingOfferId || null,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
            looksLikeStalePcRenegotiation,
          });
          if (looksLikeStalePcRenegotiation) {
            retryDebugLog(retryDebugRole, appointmentId, "handleOffer:peer_rebuilt_detected_via_sdp_error", {
              offerId: incomingOfferId || null,
            });
            const status = await requestPcRebuild("sdp_error", {
              offerToReplay: { offer, offerId: incomingOfferId },
            });
            retryDebugLog(retryDebugRole, appointmentId, "handleOffer:rebuild_request_result", {
              offerId: incomingOfferId || null,
              status,
            });
            return;
          }
          throw err;
        }
        // Real reconnect-logic state, not a log side-effect: what the NEXT
        // offer/answer's fingerprint check compares against. Only advanced
        // when the fingerprint was actually parsed, so an unparseable SDP
        // never erases what we know about the peer.
        if (incomingFingerprint) lastRemoteFingerprintRef.current = incomingFingerprint;
        retryDebugLog(retryDebugRole, appointmentId, "handleOffer:setRemoteDescription:ok", {
          offerId: incomingOfferId || null,
        });
        // Record which offer we just accepted as soon as it's applied, not
        // only once we get around to answering it — if local media isn't
        // ready yet, retryMediaPermissions() answers this same remote
        // description later, and needs the right id to echo back then too.
        lastReceivedOfferIdRef.current = incomingOfferId || null;
        resetIgnoredOffer();
        await flushPendingIceCandidates();
        // Now wait for local tracks so the answer includes our video/audio.
        const localReady = await waitForLocalReady("handleOffer:before_answer", incomingOfferId);
        if (!mounted) return;
        if (localReady === false) {
          setCamError(true);
          setCamErrorReason(
            "Allow camera or microphone access, then retry to join the consultation.",
          );
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:local_media_not_ready", {
            offerId: incomingOfferId || null,
          });
          return;
        }
        // A collision rollback can leave the matched transceivers recvonly even
        // though we hold live local tracks — fix that before answering.
        await ensureLocalTracksSentInAnswer(pc, localStreamRef.current, (label, data) =>
          retryDebugLog(retryDebugRole, appointmentId, label, data),
        );
        if (!mounted || pc.signalingState === "closed") return;
        let answer;
        try {
          answer = await pc.createAnswer();
        } catch (err) {
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:createAnswer:ERROR", {
            offerId: incomingOfferId || null,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
          });
          throw err;
        }
        logLocalAnswerDirections(
          retryDebugRole,
          appointmentId,
          answer?.sdp,
          localStreamRef.current,
          "handleOffer",
        );
        try {
          await pc.setLocalDescription(answer);
        } catch (err) {
          retryDebugLog(retryDebugRole, appointmentId, "handleOffer:setLocalDescription:ERROR", {
            offerId: incomingOfferId || null,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
          });
          throw err;
        }
        retryDebugLog(retryDebugRole, appointmentId, "handleOffer:answer_sent", {
          offerId: incomingOfferId || null,
        });
        socket.emit("video-answer", {
          appointmentId,
          answer: pc.localDescription,
          offerId: incomingOfferId,
        });
        if (!inCallRef.current) {
          setInCall(true);
          inCallRef.current = true;
        }
        // TEMPORARY (RETRY_DEBUG): watch whether media actually starts
        // flowing on this pc after answering this offer.
        retryDebugPollInboundVideoStats(
          pc,
          retryDebugRole,
          appointmentId,
          "handleOffer:post_answer",
        );
      } catch (err) {
        logger.error("Offer error:", err);
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleOffer:ERROR", {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        });
      }
    };

    // One-off recheck ~ORPHANED_ANSWER_RECHECK_MS after an orphaned answer
    // (handleAnswer's wrong-signalingState / offerId-mismatch branches). Most
    // orphaned answers are normal perfect-negotiation glare fallout that
    // resolves itself, so this deliberately does NOT rebuild on the spot —
    // only if the pc is *still* unhealthy this long after. Debounced to a
    // single pending timer; skips itself if the pc was replaced by any other
    // rebuild in the meantime. A pc that IS connected but silently not
    // flowing media is the media watchdog's own concern, not re-implemented
    // here (two independent stall detectors could disagree).
    const scheduleOrphanedAnswerRecheck = (reason) => {
      const role = isDoctor ? "doctor" : "patient";
      window.clearTimeout(orphanedAnswerCheckTimerRef.current);
      retryDebugLog(role, appointmentId, "scheduleOrphanedAnswerRecheck:armed", { reason });
      orphanedAnswerCheckTimerRef.current = window.setTimeout(() => {
        orphanedAnswerCheckTimerRef.current = null;
        if (!mounted || pcRef.current !== pc || pc.signalingState === "closed") {
          retryDebugLog(role, appointmentId, "scheduleOrphanedAnswerRecheck:cancelled_pc_replaced", {
            reason,
          });
          return;
        }
        const isHealthy =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        retryDebugLog(role, appointmentId, "scheduleOrphanedAnswerRecheck:fired", {
          reason,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          isHealthy,
        });
        if (!isHealthy) {
          void requestPcRebuild(`orphaned_answer:${reason}`, {
            handshakeFirst: true,
            waitCancelOn: "healthy",
          });
        }
      }, ORPHANED_ANSWER_RECHECK_MS);
    };

    const handleAnswer = async ({ answer, offerId: receivedOfferId }) => {
      if (!answer || !mounted) return;
      // TEMPORARY (RETRY_DEBUG)
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:received", {
        offerId: receivedOfferId || null,
        expectedOfferId: pendingOfferIdRef.current,
        signalingState: pc.signalingState,
        isManualReconnect: manualReconnectRef.current,
      });
      try {
        if (pc.signalingState !== "have-local-offer") {
          logger.info(
            "Ignoring stale answer while signaling state is",
            pc.signalingState,
          );
          retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:ORPHANED_wrong_signaling_state", {
            offerId: receivedOfferId || null,
            signalingState: pc.signalingState,
          });
          scheduleOrphanedAnswerRecheck("wrong_signaling_state");
          return;
        }
        // Guards against a stale/replayed video-answer being applied to a
        // newer offer — e.g. connectionStateRecovery redelivering an
        // already-consumed answer across a reconnect. signalingState alone
        // can't tell a genuine fresh answer apart from that, since a
        // replayed one arrives while we're legitimately in have-local-offer
        // waiting for a real one.
        const expectedOfferId = pendingOfferIdRef.current;
        if (!expectedOfferId || receivedOfferId !== expectedOfferId) {
          logVideoEvent("answer_rejected_stale", {
            expectedOfferId: expectedOfferId || null,
            receivedOfferId: receivedOfferId || null,
            signalingState: pc.signalingState,
            timestamp: new Date().toISOString(),
          });
          logger.warn(
            "Rejecting answer: offerId mismatch (expected %s, got %s) — not applying to current RTCPeerConnection state.",
            expectedOfferId || "none",
            receivedOfferId || "none",
          );
          retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:ORPHANED_offerid_mismatch", {
            offerId: receivedOfferId || null,
            expectedOfferId: expectedOfferId || null,
          });
          scheduleOrphanedAnswerRecheck("offerid_mismatch");
          return;
        }
        // Safety net for a peer that rebuilt its pc: an answer whose DTLS
        // fingerprint differs from the last one we applied from this peer
        // comes from a brand-new RTCPeerConnection (e.g. the doctor rebuilt
        // while the patient — the sole offerer — kept its old pc). It can't
        // be applied to our still-open, previously negotiated pc, so don't
        // try; rebuild instead so a fresh offer goes out from a new pc. Same
        // non-null-on-both-sides rule as handleOffer's check.
        const answerFingerprint = extractDtlsFingerprint(answer?.sdp);
        const knownRemoteFingerprint = lastRemoteFingerprintRef.current;
        if (
          answerFingerprint != null &&
          knownRemoteFingerprint != null &&
          answerFingerprint !== knownRemoteFingerprint
        ) {
          retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:peer_rebuilt_detected_via_answer_fingerprint", {
            offerId: receivedOfferId || null,
            answerFingerprint,
            knownRemoteFingerprint,
          });
          const status = await requestPcRebuild("answer_fingerprint_changed");
          retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:rebuild_request_result", {
            offerId: receivedOfferId || null,
            status,
          });
          return;
        }
        settingRemoteAnswerPendingRef.current = true;
        peerPresentRef.current = true;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        if (answerFingerprint) lastRemoteFingerprintRef.current = answerFingerprint;
        pendingOfferIdRef.current = null;
        pendingOfferSentAtRef.current = 0;
        clearTimeout(offerAnswerTimeoutRef.current);
        offerAnswerTimeoutRef.current = null;
        logVideoEvent("answer_accepted", {
          offerId: receivedOfferId,
          signalingState: pc.signalingState,
          timestamp: new Date().toISOString(),
        });
        resetIgnoredOffer();
        await flushPendingIceCandidates();
        if (!inCallRef.current) {
          setInCall(true);
          inCallRef.current = true;
        }
        // TEMPORARY (RETRY_DEBUG)
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:applied_ok", {
          offerId: receivedOfferId || null,
        });
      } catch (err) {
        logger.error("Answer error:", err);
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handleAnswer:ERROR", {
          offerId: receivedOfferId || null,
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        });
      } finally {
        settingRemoteAnswerPendingRef.current = false;
      }
    };

    const handleIce = async ({ candidate }) => {
      if (!candidate || !mounted) return;
      const candidateInfo = describeIceCandidate(candidate.candidate);
      logVideoEvent("ice_candidate_received", candidateInfo);
      if (!pc.remoteDescription) {
        if (ignoreOfferRef.current) {
          logger.info("Dropping ICE candidate for ignored colliding offer.");
          return;
        }
        pendingRemoteCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (ignoreOfferRef.current) {
          logger.info(
            "Ignoring ICE candidate rejected after offer collision:",
            err.message,
          );
          return;
        }
        logger.warn("ICE candidate rejected:", err.message);
      }
    };

    const handleIceRestartRequest = async () => {
      if (!mounted || !isReadyRef.current || !peerPresentRef.current) return;
      // The doctor still never self-initiates an offer as a matter of
      // course (see handlePeerJoined) — but if the PATIENT explicitly asks
      // for a restart because it just exhausted its own recovery attempts
      // (see scheduleIceRestart's exhaustion branch), it needs the doctor
      // to actually act on that request. Previously this returned early
      // for isDoctor, so that hand-off silently went nowhere and neither
      // side ever retried again. createAndSendOffer/handleOffer's existing
      // collision handling (impolite ignores, polite rolls back) already
      // resolves the rare case where both sides end up offering at once.
      if (
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      )
        return;
      logger.info("Peer requested ICE restart.");
      logVideoEvent("ice_restart_request_received", {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        role: isDoctor ? "doctor" : "user",
      });
      await createAndSendOffer({ iceRestart: true });
    };

    // The other participant asked us to rebuild our pc (see the doctor-side
    // handshake in requestPcRebuild). Subject to the same coalescing and
    // automatic-rebuild rate limit as every other trigger, plus two "already
    // handled" guards: a pc built within REBUILD_GRACE_MS is already fresh
    // (its own offer is on the way), and a recent watchdog-triggered rebuild
    // is still inside its cooldown.
    const handlePeerRebuildRequest = () => {
      if (!mounted || completedRef.current) return;
      const role = isDoctor ? "doctor" : "patient";
      const pcAgeMs = pcCreatedAtRef.current
        ? Date.now() - pcCreatedAtRef.current
        : Infinity;
      const cooldownActive = Date.now() < mediaStallCooldownUntilRef.current;
      retryDebugLog(role, appointmentId, "request-peer-rebuild:RECEIVED", {
        pcAgeMs,
        cooldownActive,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      if (pcAgeMs < REBUILD_GRACE_MS) {
        retryDebugLog(role, appointmentId, "request-peer-rebuild:IGNORED_pc_already_fresh", {
          pcAgeMs,
        });
        return;
      }
      if (cooldownActive) {
        retryDebugLog(role, appointmentId, "request-peer-rebuild:IGNORED_cooldown", {});
        return;
      }
      void requestPcRebuild("peer_requested");
    };

    // Relayed "camera-state" from the peer (only the mobile client emits it
    // today — native mobile stops sending video entirely when a track is
    // disabled, unlike browsers). Feeds the media watchdog so a deliberately
    // off remote camera is never read as a stall.
    const handleCameraState = ({ isCamOff } = {}) => {
      if (!mounted) return;
      remoteCamOffRef.current = Boolean(isCamOff);
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "camera-state:received", {
        isCamOff: Boolean(isCamOff),
      });
    };

    const handlePeerJoined = (payload = {}) => {
      const { resumedCall, peerCapabilities } = payload || {};
      // The server relays the OTHER participant's announced capabilities.
      // Absent / malformed = an older client (or an older server) = not
      // supported. Only a payload that actually carries the field can change
      // what we know: a bare re-echo must not erase capabilities learned from
      // an earlier event.
      if (peerCapabilities !== undefined) {
        peerCapabilitiesRef.current =
          peerCapabilities && typeof peerCapabilities === "object"
            ? { peerRebuild: peerCapabilities.peerRebuild === true }
            : null;
      } else if (peerCapabilitiesRef.current === null) {
        peerCapabilitiesRef.current = { peerRebuild: false };
      }
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "peerCapabilities:on_peer_joined", {
        received: peerCapabilities === undefined ? "(field absent — old server/client)" : peerCapabilities,
        effective: peerCapabilitiesRef.current,
        resumedCall: Boolean(resumedCall),
      });
      // completedRef flips synchronously the instant performCleanup() runs
      // (room-denied / duplicate-session / access-revoked), ahead of
      // whatever else reacts to sessionEnded — checking it here closes the
      // brief window before this effect's own cleanup has actually run
      // where a "peer-joined" arriving for an already-terminated session
      // would otherwise pass pcNeedsRebuild's "!existingPc" check below
      // (pcRef.current is nulled by performCleanup) and rebuild a fresh
      // PeerConnection + re-request camera/mic for a session that's over.
      if (mounted && !completedRef.current) {
        peerJoinedRef.current = true;
        peerPresentRef.current = true;
        setPeerJoined(true);
        setPeerLeft(false);

        // A peer connection that's missing (torn down in handleParticipantLeft
        // when the peer genuinely left), closed, or failed cannot be salvaged
        // with an ICE restart against a peer that now has a brand-new
        // connection/DTLS identity. Rebuild it from scratch — same mechanism
        // the manual "Retry" button uses (reconnectNonce): the effect tears
        // down and re-runs, producing a fresh RTCPeerConnection, fresh local
        // media, a fresh room (re)join, and a clean offer/answer where the
        // patient offers and the doctor answers. Reusing the stale connection
        // is exactly what left calls one-way after a refresh.
        const existingPc = pcRef.current;
        const pcHealthy =
          !!existingPc &&
          (existingPc.connectionState === "connected" ||
            existingPc.iceConnectionState === "connected" ||
            existingPc.iceConnectionState === "completed");
        // A resumed session whose PC is stuck at "disconnected" (rather than
        // the "failed" case already handled above) after a real network
        // outage won't reliably self-heal via ICE restart alone — mirrors
        // DirectVideoCall.jsx's handlePeerJoined. Gated on resumedCall so an
        // ordinary first-time connect (a fresh pc briefly sits at
        // "new"/"connecting", which is also "not healthy") is never
        // affected — this only widens rebuild for a genuine resume.
        //
        // Also gated on REBUILD_GRACE_MS: rejoining the room (which every
        // rebuild's own effect setup does, via emitOnlineAndJoinRoom) makes
        // the server echo this very "peer-joined" straight back to us
        // whenever a peer is present — including right after a rebuild we
        // just performed for that same reason. That echo carries
        // resumedCall:true and arrives long before a brand-new pc has any
        // realistic chance to negotiate, so without this grace window it
        // would immediately re-satisfy "resumed but not yet healthy" and
        // tear the pc down again before it ever connects — see
        // REBUILD_GRACE_MS's own comment for the full explanation. A pc
        // genuinely stale from before this effect instance even started
        // (the case this whole clause exists for) is always well past the
        // grace window by the time it's evaluated, so that recovery path is
        // unaffected.
        const pcAgeMs = pcCreatedAtRef.current
          ? Date.now() - pcCreatedAtRef.current
          : Infinity;
        const pcNeedsRebuild =
          !existingPc ||
          existingPc.signalingState === "closed" ||
          existingPc.connectionState === "failed" ||
          (resumedCall && !pcHealthy && pcAgeMs > REBUILD_GRACE_MS);
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "handlePeerJoined", {
          resumedCall: Boolean(resumedCall),
          existingPcConnectionState: existingPc?.connectionState ?? null,
          existingPcIceConnectionState: existingPc?.iceConnectionState ?? null,
          existingPcSignalingState: existingPc?.signalingState ?? null,
          pcHealthy,
          pcAgeMs,
          rebuildGraceMs: REBUILD_GRACE_MS,
          pcNeedsRebuild,
          branch: pcNeedsRebuild ? "REBUILD" : "NO_REBUILD",
          rebuildAlreadyInProgress: pcRebuildInProgressRef.current,
        });
        if (pcNeedsRebuild) {
          const rebuildReason = !existingPc
            ? "missing"
            : existingPc.connectionState === "failed"
              ? "failed"
              : existingPc.signalingState === "closed"
                ? "closed"
                : "stale_resumed";
          logVideoEvent("peer_rejoined_pc_rebuild", {
            reason: rebuildReason,
            resumedCall: Boolean(resumedCall),
          });
          // Only "no pc exists" (the peer left and came back — see
          // handleParticipantLeft) is exempt from the automatic-rebuild rate
          // limit: that's structural, not error recovery. closed / failed /
          // stale_resumed all count. resumedCall alone never triggers this:
          // it's a socket-level signal, and the age-gated
          // "resumedCall && !pcHealthy && pcAgeMs > REBUILD_GRACE_MS" clause
          // above only fires for a pc that is genuinely unhealthy.
          // requestPcRebuild's body is synchronous up to its return, so the
          // in-progress flag already reflects the outcome here: set means the
          // rebuild started (or coalesced into one that's already running) and
          // the rest of this handler is moot; clear means it was blocked by
          // the rate limit — fall through so the normal watchdogs/nudges below
          // still run against the existing pc while the Retry banner shows.
          void requestPcRebuild(rebuildReason, { countsTowardLimit: Boolean(existingPc) });
          if (pcRebuildInProgressRef.current) return;
        }

        const currentlyConnected =
          !!existingPc &&
          (existingPc.connectionState === "connected" ||
            existingPc.iceConnectionState === "connected" ||
            existingPc.iceConnectionState === "completed");

        if (isReadyRef.current && !currentlyConnected) startConnectionWatchdog();
        // Resuming a known-active call should recover in ~1-2s (see the
        // doctor nudge below), so a stall is meaningful much sooner. A
        // first-time connect has no such guarantee — real handshakes can
        // legitimately take well past a few seconds on slow networks, so
        // give it more room before nagging the user with a "reconnecting"
        // banner that doesn't even apply yet. Re-arm even when inCallRef is
        // already true (a call that connected once, then the peer left and
        // came back) so the doctor still gets the manual Retry escape hatch.
        if (isReadyRef.current && !currentlyConnected) {
          startReconnectStallWatch(
            resumedCall || inCallRef.current ? 8000 : 20000,
          );
        }
        if (!isDoctor && isReadyRef.current) {
          window.setTimeout(() => {
            if (!mounted || pc.signalingState === "closed") return;
            if (
              pc.connectionState === "connected" ||
              pc.iceConnectionState === "connected" ||
              pc.iceConnectionState === "completed"
            )
              return;
            void createAndSendOffer({ iceRestart: inCallRef.current });
          }, 300);
        }
        // Doctor never self-initiates an offer (polite peer in perfect
        // negotiation), so recovery after a doctor-side refresh otherwise
        // depends on the 25s connection watchdog. When the server confirms
        // this room was already active before (resumedCall), nudge the
        // patient to renegotiate right away instead of waiting on that
        // watchdog. Gated on resumedCall so an ordinary first-time call
        // start (patient already waiting) is never perturbed.
        if (isDoctor && resumedCall && isReadyRef.current) {
          window.setTimeout(() => {
            if (!mounted || pc.signalingState === "closed") return;
            if (
              pc.connectionState === "connected" ||
              pc.iceConnectionState === "connected" ||
              pc.iceConnectionState === "completed"
            )
              return;
            requestPeerIceRestart();
          }, 500);
        }
      }
    };

    const handleParticipantLeft = () => {
      if (!mounted) return;
      peerJoinedRef.current = false;
      // The peer genuinely left (a ~15s disconnect grace already elapsed
      // server-side, or they left deliberately). Stand the recovery machinery
      // fully down and DROP the peer connection — a reloaded/reconnected peer
      // comes back with a brand-new RTCPeerConnection and DTLS identity, so
      // keeping the old one and trying to ICE-restart onto it is exactly what
      // wedges negotiation in "have-local-offer" or leaves video one-way.
      // handlePeerJoined rebuilds a fresh connection when they return. Local
      // camera/mic and its stream are left running so nothing has to be
      // re-permissioned on rejoin.
      peerPresentRef.current = false;
      setIsRemoteConnected(false);
      setConnectionState("disconnected");
      setPeerJoined(false);
      setPeerLeft(true);
      clearReconnectStallWatch();

      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
      clearTimeout(connectionFailTimerRef.current);
      connectionFailTimerRef.current = null;
      clearTimeout(offerAnswerTimeoutRef.current);
      offerAnswerTimeoutRef.current = null;
      clearTimeout(ignoreOfferResetTimerRef.current);
      ignoreOfferResetTimerRef.current = null;
      pendingOfferIdRef.current = null;
      pendingOfferSentAtRef.current = 0;
      lastReceivedOfferIdRef.current = null;
      pendingRemoteCandidatesRef.current = [];
      makingOfferRef.current = false;
      ignoreOfferRef.current = false;
      settingRemoteAnswerPendingRef.current = false;
      restartRequestInFlightRef.current = false;
      iceRecoveryAttemptsRef.current = 0;
      stopStatsCollection();
      // A genuinely new peer session starts fresh: stale state here would
      // make the next peer's first offer look like a "changed fingerprint"
      // rebuild against an identity that no longer exists, keep a doctor
      // waiting on a patient who left, replay an offer from the old session,
      // or skip the video check based on the old peer's camera state.
      lastRemoteFingerprintRef.current = null;
      pendingRemoteOfferRef.current = null;
      remoteCamOffRef.current = false;
      // The next participant may be a different client build — re-learn its
      // capabilities from its own join — and any "waiting for the other
      // person" state / ICE-restart recheck belonged to the one who left.
      peerCapabilitiesRef.current = null;
      clearWaitingForOldPeer();
      window.clearTimeout(orphanedAnswerCheckTimerRef.current);
      orphanedAnswerCheckTimerRef.current = null;
      cancelPeerRebuildWait("participant_left");

      const deadPc = pcRef.current;
      if (deadPc) {
        deadPc.ontrack = null;
        deadPc.onicecandidate = null;
        deadPc.onnegotiationneeded = null;
        deadPc.onconnectionstatechange = null;
        deadPc.oniceconnectionstatechange = null;
        try {
          deadPc.close();
        } catch {
          /* already closed */
        }
        pcRef.current = null;
      }

      // Clear the peer's last frame so the stage doesn't stay frozen on it
      // while we wait for them to return. The local self-view keeps running.
      const rs = remoteStreamRef.current;
      if (rs) {
        rs.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* no-op */
          }
          rs.removeTrack(track);
        });
      }
      assignStreams(isSwappedRef.current);
    };

    const handleChatMessage = (msg) => {
      if (mounted) {
        setMessages((prev) => [
          ...prev,
          { ...msg, _localKey: makeMessageKey() },
        ]);
        if (!chatOpenRef.current) setUnreadCount((c) => c + 1);
      }
    };
    const handleChatHistory = (payload) => {
      if (mounted && payload?.appointmentId === appointmentId) {
        const history = Array.isArray(payload.messages) ? payload.messages : [];
        setMessages(
          history.map((msg) => ({ ...msg, _localKey: makeMessageKey() })),
        );
      }
    };

    const handleApptUpdated = ({ status }) => {
      if (!mounted) return;
      if (["complete", "completed"].includes(status) && !isDoctor) {
        setShowCompletedOverlay(true);
        setTimeout(() => navigate("/user/dashboard", { replace: true }), 4000);
        return;
      }
      // Patient-side cancellation had no handling here at all previously —
      // only "complete" redirected the patient, so a mid-call cancellation
      // (by the doctor or an admin) left the patient's call silently
      // stalling with no explanation once evictAllFromAppointmentRoom
      // dropped them from the room. Tear the session down the same way
      // handleRoomDenied/handleDuplicateSession do, with a message that
      // matches the doctor-side wording below.
      if (status === "cancelled" && !isDoctor) {
        performCleanup();
        setSessionEnded(true);
        setApptError("This appointment was cancelled by an administrator.");
        return;
      }
      // Doctor-side: an admin (or backend job) can close this appointment
      // out from under a doctor who's still in the call. completingRef
      // guards against re-showing this for the doctor's OWN
      // completeAppointment() call — that PUT request triggers this exact
      // same broadcast back to the doctor's own socket, which is still in
      // the appointment room at that instant.
      if (
        ["complete", "completed", "cancelled"].includes(status) &&
        isDoctor &&
        !completingRef.current
      ) {
        setApptClosedByOther(
          status === "cancelled"
            ? "This appointment was cancelled by an administrator."
            : "This appointment was marked complete by an administrator.",
        );
      }
    };

    const handleNewPrescription = ({ diagnosis }) => {
      if (!mounted || isDoctor) return;
      setPrescriptionNotif({ diagnosis });
      setTimeout(() => setPrescriptionNotif(null), 10000);
    };

    const handleRoomDenied = ({ msg } = {}) => {
      if (!mounted) return;
      // Previously left the camera/mic running and the RTCPeerConnection
      // open indefinitely behind the "Access Denied" gate screen — local
      // media was already acquired by this effect independently of whether
      // the room join itself succeeded. Tear the session down the same way
      // a duplicate session does, instead of only changing what's rendered.
      performCleanup();
      setSessionEnded(true);
      setApptError(msg || "Access to this call room was denied.");
    };

    const handleDuplicateSession = ({ msg } = {}) => {
      if (!mounted) return;
      // A newer session for this appointment has taken over. Tear this
      // stale session all the way down — tracks, timers, socket room,
      // peer connection — instead of only closing the PC, so nothing
      // (call timer, stats polling, socket listeners) keeps running
      // behind the "Access Denied" gate screen this triggers below.
      // sessionEnded (a dependency of this effect) is what actually
      // removes the socket listeners themselves and stops a later
      // "peer-joined" from silently rebuilding a fresh PeerConnection and
      // re-requesting media in a tab the server has already flagged as
      // superseded.
      performCleanup();
      setSessionEnded(true);
      setApptError(
        msg || "Another consultation session was started elsewhere.",
      );
    };

    // The backend forcibly removes a socket from the appointment room (and
    // emits this) when the appointment is reassigned to a different doctor,
    // or — as a defensive fallback with no more specific reason — in any
    // other case access is revoked outside the normal complete/cancel flow.
    // "completed"/"cancelled" are deliberately excluded here: those already
    // get their own, friendlier messaging above via "appointment-updated"
    // (the completed-overlay redirect, the doctor's "closed by other"
    // banner, and the cancellation handling just added above) — reacting to
    // them here too would just race that messaging with a blunter "Access
    // Denied" screen for the exact same event.
    const handleAccessRevoked = ({ msg, reason } = {}) => {
      if (!mounted) return;
      if (reason === "completed" || reason === "cancelled") return;
      performCleanup();
      setSessionEnded(true);
      setApptError(msg || "You no longer have access to this appointment.");
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
    socket.on("duplicate-session", handleDuplicateSession);
    socket.on("appointment-access-revoked", handleAccessRevoked);
    socket.on("request-peer-rebuild", handlePeerRebuildRequest);
    socket.on("camera-state", handleCameraState);

    const joinRoom = () => {
      emitOnlineAndJoinRoom();
      flushTelemetryQueue();
      resyncConnectionStateFromPeerConnection();
    };

    const handleSocketDisconnect = () => {
      joinedSocketIdRef.current = "";
      if (!mounted) return;
      logVideoEvent("socket_disconnected_during_call", {
        inCall: inCallRef.current,
      });
      setConnectionState("disconnected");
      setIsRemoteConnected(false);
    };

    // Socket.IO v4 event order on a reconnect: the Manager's "reconnect"
    // fires as soon as the Engine.IO transport opens — BEFORE the namespace
    // CONNECT handshake completes, i.e. before socket.on("connect", joinRoom).
    // This handler used to reset joinedSocketIdRef and call joinRoom() itself;
    // that only avoided a duplicate join-appointment-room because
    // emitOnlineAndJoinRoom bails while socket.connected is still false —
    // fragile, and redundant (handleSocketDisconnect already clears
    // joinedSocketIdRef, and the "connect" handler joins). It now leaves the
    // join to "connect" and only does its own follow-up below.
    const handleSocketReconnect = () => {
      if (!mounted) return;
      logVideoEvent("socket_reconnected_during_call", {
        inCall: inCallRef.current,
        role: isDoctor ? "doctor" : "user",
      });
      if (isDoctor) {
        window.setTimeout(() => {
          if (
            !mounted ||
            !peerPresentRef.current ||
            !socket.connected ||
            pc.signalingState === "closed"
          )
            return;
          if (
            pc.connectionState === "connected" ||
            pc.iceConnectionState === "connected" ||
            pc.iceConnectionState === "completed"
          )
            return;
          requestPeerIceRestart();
        }, 500);
        return;
      }
      if (!isDoctor && isReadyRef.current) {
        window.setTimeout(() => {
          if (
            !mounted ||
            !peerPresentRef.current ||
            !socket.connected ||
            pc.signalingState === "closed"
          )
            return;
          if (
            pc.connectionState === "connected" ||
            pc.iceConnectionState === "connected" ||
            pc.iceConnectionState === "completed"
          )
            return;
          void createAndSendOffer({ iceRestart: inCallRef.current });
        }, 500);
      }
    };

    const sampleInboundBytes = async (pcInstance) => {
      try {
        const stats = await pcInstance.getStats();
        for (const report of stats.values()) {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            if (typeof report.bytesReceived === "number") return report.bytesReceived;
          }
        }
      } catch {
        // Unknown, not stalled — see verifyConnectionAfterVisible's null handling.
      }
      return null;
    };

    // A browser tab can be throttled or fully frozen while hidden (most
    // aggressively on mobile Safari/Chrome), which can silently kill the
    // underlying connection without pc.onconnectionstatechange ever getting
    // a chance to run — so pc.connectionState can still read "connected"
    // purely because nothing updated it since the freeze. Tabs don't get
    // suspended by the OS the way a backgrounded native app does, so this
    // has no exact equivalent elsewhere in this file, but the risk is the
    // same one VideoCallController.handleAppResumed guards against on
    // mobile: take two inbound-bytes samples ~1.5s apart on the
    // already-selected candidate pair, and only treat it as stalled (and
    // force a restart) if there's zero growth — a connected call should
    // always show some growth from RTP/RTCP keepalives even during
    // silence/camera-off.
    const verifyConnectionAfterVisible = async () => {
      if (verifyingVisibilityRef.current || !peerPresentRef.current) return;
      verifyingVisibilityRef.current = true;
      try {
        if (!mounted || !peerPresentRef.current || pc.signalingState === "closed")
          return;
        const isConnected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        if (!isConnected) return; // already unhealthy — the normal state-change handlers own this

        const before = await sampleInboundBytes(pc);
        if (!mounted || pc.signalingState === "closed") return;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        if (!mounted || pc.signalingState === "closed") return;
        const stillConnected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        if (!stillConnected) return; // a real state-change callback already took over

        const after = await sampleInboundBytes(pc);
        if (!mounted || pc.signalingState === "closed") return;
        if (before === null || after === null || after > before) return;

        logVideoEvent("tab_resume_stale_connection_detected", {
          bytesBefore: before,
          bytesAfter: after,
        });
        logger.warn(
          'Tab resumed with a stale "connected" state — no inbound media progress, forcing recovery.',
        );
        if (isDoctor) {
          requestPeerIceRestart();
        } else {
          void createAndSendOffer({ iceRestart: true });
        }
      } finally {
        verifyingVisibilityRef.current = false;
      }
    };

    // No exact equivalent needed on native mobile — VideoCallController
    // already has handleAppResumed for the analogous app-background case.
    // Refreshing the auth token here (like that method does) isn't
    // necessary: unlike the mobile access token, this page's session isn't
    // proactively refreshed on a timer either, so a stale-token rejection
    // would already have to be handled by the existing auth/redirect flow
    // regardless of tab visibility.
    const handleVisibilityChange = () => {
      if (!mounted || document.visibilityState !== "visible") return;
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
      void verifyConnectionAfterVisible();
    };

    // Keep the shared socket's handshake auth aligned with THIS page's role,
    // not whatever api.js's ambient activeAuthRole happens to be — see
    // setSocketAuthRole's own comment for why that matters. Set before any
    // connect()/reconnect_attempt below so the very next handshake already
    // carries the right token.
    setSocketAuthRole(isDoctor ? "doctor" : "user");

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
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ── Inbound-media watchdog ─────────────────────────────────────────
    // A pc can read "connected" while inbound media has silently stopped
    // (production: ICE "connected", zero inbound video bytes for 20+ s), or
    // sit in "new"/"connecting" without ever firing a state-change event.
    // Runs on its own MEDIA_WATCHDOG_INTERVAL_MS tick from pc creation (the
    // 30s quality-stats poll only starts once connected). Two consecutive
    // stalled samples for the patient (the sole offerer, so it acts first);
    // three for the doctor, whose fresh-offer-from-the-patient path gets one
    // extra tick to resolve things before it rebuilds too. Any inbound audio
    // OR video growth means the connection is alive. A remote camera reported
    // off (relayed camera-state) skips the connected-but-silent branch. The
    // cooldown lives in a component ref so it survives the rebuild it causes.
    let watchdogPrev = null;
    let watchdogStallCount = 0;
    let watchdogBusy = false;
    const mediaWatchdogTimer = window.setInterval(async () => {
      if (!mounted || pc.signalingState === "closed" || watchdogBusy) return;
      if (!peerPresentRef.current || !isReadyRef.current) {
        watchdogPrev = null;
        watchdogStallCount = 0;
        return;
      }
      watchdogBusy = true;
      try {
        const report = await pc.getStats();
        if (!mounted || pcRef.current !== pc) return;
        let videoBytes = null;
        let videoFrames = null;
        let audioBytes = null;
        report.forEach((stat) => {
          if (stat.type !== "inbound-rtp" || stat.isRemote) return;
          const kind = stat.kind || stat.mediaType;
          if (kind === "video") {
            if (typeof stat.bytesReceived === "number") videoBytes = stat.bytesReceived;
            if (typeof stat.framesDecoded === "number") videoFrames = stat.framesDecoded;
          } else if (kind === "audio") {
            if (typeof stat.bytesReceived === "number") audioBytes = stat.bytesReceived;
          }
        });
        const prev = watchdogPrev;
        watchdogPrev = { videoBytes, videoFrames, audioBytes };
        if (!prev) return; // first sample — nothing to diff against yet

        const grew = (now, before) =>
          typeof now === "number" && typeof before === "number" && now > before;
        const audioGrew = grew(audioBytes, prev.audioBytes);
        const videoGrew =
          grew(videoBytes, prev.videoBytes) || grew(videoFrames, prev.videoFrames);
        if (audioGrew || videoGrew) {
          watchdogStallCount = 0;
          // Inbound media is flowing: record it for the old-peer downgrade
          // recheck and drop any "waiting for the other person" banner.
          lastMediaGrowthAtRef.current = Date.now();
          clearWaitingForOldPeer();
          if (peerRebuildWaitRef.current?.cancelOn === "media") {
            cancelPeerRebuildWait("media_recovered");
          }
          return;
        }

        const role = isDoctor ? "doctor" : "patient";
        const pcAgeMs = pcCreatedAtRef.current
          ? Date.now() - pcCreatedAtRef.current
          : 0;
        const connected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        const neverConnected =
          !connected &&
          (pc.connectionState === "new" || pc.connectionState === "connecting") &&
          pcAgeMs > MEDIA_STALL_NEVER_CONNECTED_MS;
        const connectedButSilent = connected && !remoteCamOffRef.current;
        if (!neverConnected && !connectedButSilent) {
          watchdogStallCount = 0;
          return;
        }
        if (Date.now() < mediaStallCooldownUntilRef.current) {
          watchdogStallCount = 0;
          return;
        }

        watchdogStallCount += 1;
        const requiredSamples = isDoctor ? 3 : 2;
        retryDebugLog(role, appointmentId, "mediaStallWatchdog:sample", {
          neverConnected,
          connectedButSilent,
          remoteCamOff: remoteCamOffRef.current,
          connectionState: pc.connectionState,
          pcAgeMs,
          consecutiveCount: watchdogStallCount,
          requiredSamples,
        });
        if (watchdogStallCount < requiredSamples) return;

        watchdogStallCount = 0;
        mediaStallCooldownUntilRef.current = Date.now() + MEDIA_STALL_COOLDOWN_MS;
        retryDebugLog(role, appointmentId, "mediaStallWatchdog:TRIGGERING_rebuild", {
          reason: neverConnected ? "never_connected" : "connected_no_inbound_media",
        });
        void requestPcRebuild(
          neverConnected ? "media_never_connected" : "media_stall",
          {
            handshakeFirst: true,
            waitCancelOn: neverConnected ? "healthy" : "media",
          },
        );
      } catch (err) {
        logger.warn("[media-watchdog] getStats failed:", err?.message || err);
      } finally {
        watchdogBusy = false;
      }
    }, MEDIA_WATCHDOG_INTERVAL_MS);

    // Effect setup is complete: any pending rebuild request has now actually
    // happened. Clear the in-progress flag (so later automatic triggers can
    // start a new rebuild rather than coalescing forever), then replay the
    // offer that revealed the stale pc — its listeners are registered above,
    // and handleOffer waits for local media before answering. Dropped if it
    // has gone stale; the peer re-offers on its own answer timeout anyway.
    if (pcRebuildInProgressRef.current) {
      pcRebuildInProgressRef.current = false;
      window.clearTimeout(pcRebuildSafetyTimerRef.current);
      pcRebuildSafetyTimerRef.current = null;
      retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "requestPcRebuild:DONE_effect_ready", {});
    }
    const pendingReplay = pendingRemoteOfferRef.current;
    pendingRemoteOfferRef.current = null;
    if (pendingReplay) {
      const ageMs = Date.now() - pendingReplay.at;
      if (ageMs <= PENDING_OFFER_MAX_AGE_MS) {
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "requestPcRebuild:replaying_pending_offer", {
          ageMs,
          offerId: pendingReplay.payload?.offerId || null,
        });
        void handleOffer(pendingReplay.payload);
      } else {
        retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "requestPcRebuild:dropped_stale_pending_offer", {
          ageMs,
        });
      }
    }

    return () => {
      mounted = false;
      window.clearInterval(mediaWatchdogTimer);
      window.clearTimeout(orphanedAnswerCheckTimerRef.current);
      orphanedAnswerCheckTimerRef.current = null;
      cancelPeerRebuildWait("effect_cleanup");
      resolveLocalReady(false);
      clearTimeout(iceRestartTimerRef.current);
      clearTimeout(connectionFailTimerRef.current);
      clearTimeout(ignoreOfferResetTimerRef.current);
      clearTimeout(reconnectStallTimerRef.current);
      iceRestartTimerRef.current = null;
      ignoreOfferResetTimerRef.current = null;
      reconnectStallTimerRef.current = null;
      restartRequestInFlightRef.current = false;
      // A manual forceReconnect() also tears this effect down and re-runs
      // it (via reconnectNonce), but that's not a real departure — skip the
      // leave-room emit so the peer doesn't see a spurious "left the call".
      const isManualReconnect = manualReconnectRef.current;
      manualReconnectRef.current = false;
      if (
        joinedSocketIdRef.current &&
        socket.connected &&
        !pageUnloadingRef.current &&
        !isManualReconnect
      ) {
        socket.emit("leave-appointment-room", { appointmentId });
      }
      socket.off("connect", joinRoom);
      socket.off("disconnect", handleSocketDisconnect);
      socket.io.off("reconnect", handleSocketReconnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
      socket.off("duplicate-session", handleDuplicateSession);
      socket.off("appointment-access-revoked", handleAccessRevoked);
      socket.off("request-peer-rebuild", handlePeerRebuildRequest);
      socket.off("camera-state", handleCameraState);
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      // A rebuild (manual Retry, or the automatic pcNeedsRebuild path in
      // handlePeerJoined — both set manualReconnectRef.current, captured
      // above as isManualReconnect) tears down and recreates the whole
      // RTCPeerConnection, but has nothing to do with the browser's own
      // display-capture session, which getDisplayMedia() can't silently
      // re-request without a fresh user gesture. Stopping the track here
      // would permanently end that capture for no reason. For a rebuild
      // specifically — never a real leave/unmount, where stopping it below
      // is still correct — keep it alive and hand it to
      // resumeScreenShareRef (invoked from markPeerConnectionHealthy once
      // the new connection is healthy) instead of stopping it now.
      if (isManualReconnect && screenSharingRef.current && screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => {
          t.onended = null;
        });
        pendingScreenShareResumeRef.current = screenStreamRef.current;
      } else {
        screenStreamRef.current?.getTracks().forEach((t) => {
          t.onended = null;
          t.stop();
        });
        // A real leave/unmount (not a rebuild) — also stop anything left
        // over from an earlier rebuild's preservation that never actually
        // got resumed (e.g. the rebuilt connection never reached
        // "connected" before this real departure happened), so the
        // capture session can't be silently leaked indefinitely.
        if (pendingScreenShareResumeRef.current) {
          pendingScreenShareResumeRef.current.getTracks().forEach((t) => {
            t.onended = null;
            if (t.readyState !== "ended") t.stop();
          });
          pendingScreenShareResumeRef.current = null;
        }
      }
      screenStreamRef.current = null;
      pendingRemoteCandidatesRef.current = [];
      joinedSocketIdRef.current = "";
      peerJoinedRef.current = false;
      ignoreOfferRef.current = false;
      pendingOfferIdRef.current = null;
      lastReceivedOfferIdRef.current = null;
      lastRttMsRef.current = null;
      clearTimeout(offerAnswerTimeoutRef.current);
      offerAnswerTimeoutRef.current = null;
      // Mirror the ref reset into React state. This cleanup now also runs on
      // an automatic PeerConnection rebuild after a peer leaves and rejoins
      // (see handlePeerJoined) — not only on unmount or the manual "Retry" —
      // so a user who was screen-sharing when that rebuild fires needs the
      // "Stop Sharing" button to un-highlight too, not just have the track
      // stopped underneath it. Gated on the ref so an ordinary teardown while
      // not sharing doesn't trigger an unnecessary re-render.
      if (screenSharingRef.current) setIsScreenSharing(false);
      screenSharingRef.current = false;
      screenShareStartInProgressRef.current = false;
      screenShareStopInProgressRef.current = false;
      clearInterval(callTimerRef.current);
      stopStatsCollection();
    };
  }, [
    appt,
    canJoinConsultation,
    appointmentId,
    assignStreams,
    playAssignedVideos,
    isDoctor,
    attachLocalMediaStream,
    verifyLocalPlaybackLiveness,
    emitOnlineAndJoinRoom,
    logVideoEvent,
    flushTelemetryQueue,
    stopStatsCollection,
    performCleanup,
    requestPcRebuild,
    cancelPeerRebuildWait,
    clearWaitingForOldPeer,
    releaseManualReconnectGuard,
    reconnectNonce,
    iceConfig,
    iceConfigError,
    sessionEnded,
  ]);

  // ── Call timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (inCall) {
      callTimerRef.current = setInterval(
        () => setCallDuration((d) => d + 1),
        1000,
      );
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
    authRefreshFailureCountRef.current = 0;
    const heartbeat = setInterval(
      () => {
        api
          .post("/api/auth/refresh", null, {
            authRole: isDoctor ? "doctor" : "user",
          })
          .then(() => {
            authRefreshFailureCountRef.current = 0;
          })
          .catch((err) => {
            authRefreshFailureCountRef.current += 1;
            // A 401/403 here is the backend explicitly saying this refresh
            // token itself is invalid/expired — no ambiguity, act on it
            // immediately rather than waiting for it to repeat. Anything
            // else (no response at all, a network error, a transient 5xx)
            // is treated as ambiguous and only escalated after repeating —
            // never on a single failure, so one dropped request can't tear
            // down an otherwise-healthy call.
            const status = err?.response?.status;
            const isConfirmedAuthFailure = status === 401 || status === 403;
            if (
              !isConfirmedAuthFailure &&
              authRefreshFailureCountRef.current < AUTH_REFRESH_FAILURE_THRESHOLD
            ) {
              return; // transient — the next scheduled attempt will try again
            }
            // Confirmed (or repeated) failure: the session can no longer be
            // kept alive by retrying. Stop the futile silent retries and
            // surface the same terminal apptError/sessionEnded gate this
            // file already uses for room-denied/duplicate-session/access-
            // revoked, instead of a second authentication UI — that gate
            // also short-circuits the main WebRTC effect's own reconnect
            // machinery (it starts with `if (sessionEnded) return;`), so
            // this can't leave a reconnect loop running against a session
            // that's already been told it's unauthenticated.
            clearInterval(heartbeat);
            performCleanup();
            setSessionEnded(true);
            setApptError(
              "Your session has expired. Please refresh the page and log in again to continue.",
            );
          });
      },
      4 * 60 * 1000,
    );
    return () => clearInterval(heartbeat);
  }, [inCall, isDoctor, performCleanup]);

  // ── Controls ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
  }, []);

  const toggleCamera = useCallback(() => {
    const next = !isCamOffRef.current;
    isCamOffRef.current = next;
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
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

  const stopScreenShare = useCallback(
    async ({ stopTracks = true } = {}) => {
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
        logger.error("Camera restore after screen share failed:", err);
        logVideoEvent("screen_share_restore_failed", { message: err.message });
        showInlineMessage(
          "Screen sharing stopped, but camera could not be restored. Toggle the camera or rejoin the call.",
        );
      } finally {
        screenSharingRef.current = false;
        setIsScreenSharing(false);
        screenShareStartInProgressRef.current = false;
        screenShareStopInProgressRef.current = false;
      }
    },
    [logVideoEvent, restoreCameraAfterScreenShare, showInlineMessage],
  );

  const startScreenShare = useCallback(async () => {
    // Re-entrancy guards for an already-in-flight start/stop — left silent
    // (not a user-facing failure, just protecting against a double-click
    // racing an operation already underway).
    if (
      screenSharingRef.current ||
      screenShareStartInProgressRef.current ||
      screenShareStopInProgressRef.current
    )
      return;

    const pc = pcRef.current;
    if (!pc || pc.signalingState === "closed") {
      // Previously a silent no-op: pcRef.current is nulled once the peer
      // leaves (handleParticipantLeft) or the session ends, but nothing
      // disabled the Share button for that window, so a click here produced
      // no feedback at all. The button's own `disabled` also now covers the
      // common case (peerLeft), but this stays as the authoritative check.
      showInlineMessage(
        "Screen sharing isn't available right now — the other participant isn't connected.",
      );
      return;
    }

    if (!canUseScreenShare()) {
      showInlineMessage(
        "Screen sharing is not supported on this browser or device.",
      );
      return;
    }

    const sender = getVideoSender(pc);
    if (!sender) {
      showInlineMessage(
        "Screen sharing requires an active video sender. Enable camera first, then try again.",
      );
      return;
    }

    let screen = null;
    screenShareStartInProgressRef.current = true;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
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
      // Local self-preview of the shared screen is assigned by the
      // isScreenSharing-keyed effect below (it accounts for `isSwapped` too
      // — the self-view lives in the main stage, not the PiP, whenever the
      // view is swapped), rather than here, so there's a single source of
      // truth for which element shows what instead of two assignments that
      // can race and briefly show the wrong stream.
      setIsScreenSharing(true);
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
        logger.error(
          "Camera restore after failed screen share start failed:",
          restoreErr,
        );
      }
      // NotAllowedError/AbortError both mean the user dismissed the share
      // picker — browsers differ on which they throw for that case — so
      // neither is a real failure worth logging or showing an error for.
      if (err.name !== "NotAllowedError" && err.name !== "AbortError") {
        logger.error("Screen share error:", err);
        logVideoEvent("screen_share_failed", {
          name: err.name,
          message: err.message,
        });
        showInlineMessage(screenShareErrorMessage(err));
      }
    } finally {
      screenShareStartInProgressRef.current = false;
    }
  }, [
    getVideoSender,
    logVideoEvent,
    restoreCameraAfterScreenShare,
    showInlineMessage,
    stopScreenShare,
  ]);

  const toggleScreenShare = useCallback(() => {
    if (screenSharingRef.current) {
      void stopScreenShare();
      return;
    }
    void startScreenShare();
  }, [startScreenShare, stopScreenShare]);

  // Consumes pendingScreenShareResumeRef — a still-live display-capture
  // MediaStream the main effect's cleanup preserved (never stopped) across a
  // PeerConnection rebuild specifically because it was mid-share at the
  // time. Re-attaches it to the new PeerConnection's video sender via the
  // same replaceTrack() call startScreenShare already uses — no new
  // getDisplayMedia() prompt, so no user-gesture requirement is at stake,
  // and no renegotiation is triggered (replaceTrack doesn't touch the SDP
  // m-line). Assigned to resumeScreenShareRef so the main effect (where the
  // new pc/markPeerConnectionHealthy live) can invoke it once the rebuilt
  // connection is actually healthy, mirroring the existing
  // kickIceRecoveryRef/networkRecoveryRef cross-effect pattern.
  const resumeScreenShareIfPending = useCallback(async () => {
    const pendingScreen = pendingScreenShareResumeRef.current;
    if (!pendingScreen) return;
    pendingScreenShareResumeRef.current = null;

    const pc = pcRef.current;
    const screenTrack = pendingScreen.getVideoTracks()[0];
    // The browser's own "Stop sharing" bar can end the capture at any
    // moment, including during the narrow rebuild window — if that already
    // happened, or there's no pc to attach to, there's nothing to resume;
    // fall back to the existing manual reselect flow (the Share button)
    // rather than guessing, per the requirement not to auto-prompt
    // getDisplayMedia().
    if (!pc || pc.signalingState === "closed" || !screenTrack || screenTrack.readyState !== "live") {
      pendingScreen.getTracks().forEach((track) => {
        track.onended = null;
        if (track.readyState !== "ended") track.stop();
      });
      return;
    }

    const sender = getVideoSender(pc);
    if (!sender) {
      pendingScreen.getTracks().forEach((track) => {
        track.onended = null;
        if (track.readyState !== "ended") track.stop();
      });
      return;
    }

    try {
      setTrackHint(screenTrack, "detail");
      await sender.replaceTrack(screenTrack);
      await tuneSenderQuality(sender, {
        maxBitrate: BITRATE_PROFILE.screenShareVideo,
        maxFramerate: 30,
        maintainResolution: true,
      });
      screenStreamRef.current = pendingScreen;
      screenSharingRef.current = true;
      setIsScreenSharing(true);
      logVideoEvent("screen_share_resumed_after_reconnect", {});
      screenTrack.onended = () => {
        void stopScreenShare({ stopTracks: false });
      };
    } catch (err) {
      logger.error("Resuming screen share after reconnect failed:", err);
      logVideoEvent("screen_share_resume_failed", { message: err.message });
      pendingScreen.getTracks().forEach((track) => {
        track.onended = null;
        if (track.readyState !== "ended") track.stop();
      });
    }
  }, [getVideoSender, logVideoEvent, stopScreenShare]);

  useEffect(() => {
    resumeScreenShareRef.current = resumeScreenShareIfPending;
  }, [resumeScreenShareIfPending]);

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
    if (!pipVideoRef.current || !mainVideoRef.current) return;

    const frameId = requestAnimationFrame(() => {
      if (!pipVideoRef.current || !mainVideoRef.current) return;

      // Baseline: normal remote/local assignment for both elements, exactly
      // as if screen sharing weren't happening.
      assignStreams(isSwapped);

      // While screen sharing, the *self-view* element should preview the
      // actual shared screen rather than the still-live camera feed —
      // replaceTrack() in startScreenShare only changes what's sent to the
      // peer, it doesn't touch localStreamRef, so assignStreams() alone
      // would otherwise keep showing the camera locally. Which element is
      // "self view" depends on swap state: normally it's the PiP, but when
      // the view is swapped, self-view is the main stage — previously this
      // only handled the not-swapped case, so a presenter who swapped views
      // mid-share had no local preview of their own shared screen at all.
      if (isScreenSharing && screenStreamRef.current) {
        const selfViewEl = isSwapped ? mainVideoRef.current : pipVideoRef.current;
        selfViewEl.srcObject = screenStreamRef.current;
        selfViewEl.play?.().catch(() => {});
      }

      pipVideoRef.current.play?.().catch(() => {});
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
        showInlineMessage(
          "Full screen is not available for this call layout on iPhone Safari.",
        );
      } else {
        showInlineMessage("Full screen is not supported by this browser.");
      }
    } catch (err) {
      logger.error("Fullscreen toggle failed:", err);
      logVideoEvent("fullscreen_failed", { message: err.message });
      showInlineMessage("Full screen could not be started on this device.");
    }
  }, [logVideoEvent, showInlineMessage]);

  const leaveCall = useCallback(() => {
    if (completing) return;
    setEndCallConfirm(false);
    performCleanup();
    navigate(resolveHomePath(), { replace: true });
  }, [completing, resolveHomePath, performCleanup, navigate]);

  const completeAppointment = useCallback(async () => {
    if (!isDoctor || completing) return;
    setEndCallConfirm(false);
    setCompleting(true);
    try {
      if (["assigned", "confirmed"].includes(appt?.status)) {
        await api.put(`/api/appointments/${appointmentId}/complete`, null, {
          authRole: "doctor",
        });
      }
      performCleanup();
      navigate("/doctor-dashboard/patients", { replace: true });
    } catch (err) {
      setCompleting(false);
      showInlineMessage(
        err.response?.data?.msg ||
          "Failed to complete appointment. Please try again.",
        5000,
      );
    }
  }, [
    completing,
    isDoctor,
    appt?.status,
    appointmentId,
    performCleanup,
    navigate,
    showInlineMessage,
  ]);

  // Manual escape hatch when automatic recovery is taking too long: forces
  // the main effect to tear down and rebuild the RTCPeerConnection + rejoin
  // the room from scratch, on either role.
  const forceReconnect = useCallback(() => {
    // Ignore taps while a previous Retry is still being held (see
    // MANUAL_RECONNECT_HOLD_MS / releaseManualReconnectGuard).
    if (manualReconnectCooldownRef.current) return;
    // TEMPORARY (RETRY_DEBUG)
    retryDebugLog(isDoctor ? "doctor" : "patient", appointmentId, "forceReconnect:TAPPED", {
      pcConnectionState: pcRef.current?.connectionState ?? null,
      pcIceConnectionState: pcRef.current?.iceConnectionState ?? null,
    });
    setManualReconnecting(true);
    // Held until the rebuilt connection is healthy (markPeerConnectionHealthy
    // calls releaseManualReconnectGuard) or MANUAL_RECONNECT_HOLD_MS passes,
    // whichever comes first — a rebuild that never gets healthy (e.g. the
    // other side hasn't rejoined) can't leave the button stuck disabled.
    manualReconnectCooldownRef.current = window.setTimeout(() => {
      manualReconnectCooldownRef.current = null;
      setManualReconnecting(false);
    }, MANUAL_RECONNECT_HOLD_MS);
    // The actual rebuild goes through the same serialized entry point as
    // every automatic trigger. manual: true bypasses the automatic-rebuild
    // rate limit and always takes effect; on the doctor side it also asks
    // the patient to rebuild (request-peer-rebuild) — see requestPcRebuild.
    void requestPcRebuild("manual_retry", { manual: true });
  }, [appointmentId, isDoctor, requestPcRebuild]);

  useEffect(
    () => () => {
      window.clearTimeout(manualReconnectCooldownRef.current);
      window.clearTimeout(oldPeerIceRestartTimerRef.current);
    },
    [],
  );

  const retryMediaPermissions = useCallback(async () => {
    if (retryingMedia) return;
    const pc = pcRef.current;
    if (!pc || pc.signalingState === "closed") {
      setCamError(true);
      setCamErrorReason(
        "The call connection is no longer active. Rejoin the consultation and try again.",
      );
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
      void verifyLocalPlaybackLiveness(stream, pc);

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
        logLocalAnswerDirections(
          isDoctor ? "doctor" : "patient",
          appointmentId,
          answer?.sdp,
          localStreamRef.current,
          "retryMediaPermissions",
        );
        await pc.setLocalDescription(answer);
        socket.emit("video-answer", {
          appointmentId,
          answer: pc.localDescription,
          offerId: lastReceivedOfferIdRef.current,
        });
      } else if (!isDoctor && peerJoinedRef.current && !inCallRef.current) {
        // Media was denied on the first attempt, so the patient — the only
        // side that self-initiates an offer — never sent one, and there's no
        // remote offer waiting to answer. handlePeerJoined's offer nudge only
        // re-fires on a fresh "peer-joined", which emitOnlineAndJoinRoom()
        // above skips when this socket is already in the room — so kick the
        // handshake here too. Short delay mirrors handlePeerJoined so any
        // in-flight (re)join settles first; pcRef/createAndSendOffer are read
        // fresh, and createAndSendOffer's own guards (mounted / signalingState
        // / makingOfferRef / isReadyRef) keep it idempotent against the
        // handlePeerJoined nudge if that also fires.
        window.setTimeout(() => {
          const activePc = pcRef.current;
          if (!activePc || activePc.signalingState !== "stable") return;
          if (
            activePc.connectionState === "connected" ||
            activePc.iceConnectionState === "connected" ||
            activePc.iceConnectionState === "completed"
          )
            return;
          void createAndSendOfferRef.current?.({ iceRestart: false });
        }, 400);
      }
    } catch (err) {
      setCamError(true);
      setCamErrorReason(mediaErrorMessage(err));
      setDeviceCheck((prev) => ({ ...prev, status: "failed" }));
      logVideoEvent("media_retry_failed", {
        name: err.name,
        message: err.message,
      });
    } finally {
      setRetryingMedia(false);
    }
  }, [
    appointmentId,
    attachLocalMediaStream,
    verifyLocalPlaybackLiveness,
    emitOnlineAndJoinRoom,
    isDoctor,
    logVideoEvent,
    retryingMedia,
  ]);

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

  const saveNotes = useCallback(
    async ({ manual = false } = {}) => {
      if (!isDoctor || !appointmentId || !notesLoaded) return;

      const next = {
        content: noteContent,
      };
      const previous = lastSavedNoteRef.current;
      if (!manual && previous.content === next.content) return;

      setNotesSaving(true);
      setNotesError("");
      try {
        const res = await api.put(
          `/api/notes/appointment/${appointmentId}`,
          next,
          { authRole: "doctor" },
        );
        const saved = res.data?.note;
        setNotesSavedAt(saved?.updatedAt || new Date().toISOString());
        lastSavedNoteRef.current = next;
      } catch (err) {
        setNotesError(err.response?.data?.msg || "Could not save notes.");
      } finally {
        setNotesSaving(false);
      }
    },
    [isDoctor, appointmentId, notesLoaded, noteContent],
  );

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
    if (chatSendCooldownTimerRef.current) return;
    const text = chatInput.trim();
    if (!text) return;
    socket.emit("appointment-message", {
      appointmentId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text,
    });
    setChatInput("");
    setChatSendCoolingDown(true);
    chatSendCooldownTimerRef.current = window.setTimeout(() => {
      chatSendCooldownTimerRef.current = null;
      setChatSendCoolingDown(false);
    }, CHAT_SEND_COOLDOWN_MS);
  }, [chatInput, appointmentId, currentUser]);

  useEffect(
    () => () => window.clearTimeout(chatSendCooldownTimerRef.current),
    [],
  );

  const handleChatKey = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      if (file.size > 10 * 1024 * 1024) {
        showInlineMessage("File too large. Max 10 MB.");
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
        showInlineMessage(
          err.response?.data?.msg || err.message || "File upload failed.",
        );
      } finally {
        setUploadingFile(false);
      }
    },
    [appointmentId, currentUser, showInlineMessage],
  );

  // ── Other party info ──────────────────────────────────────────────
  const otherParty = useMemo(() => {
    if (!appt) return null;
    if (isDoctor)
      return {
        label: "Patient",
        name: appt.patientId?.name || "Unknown Patient",
      };
    return {
      label: "Doctor",
      name: `Dr. ${appt.doctorId?.name || "Unknown"}`,
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
        <div className="hc-vc__gate-icon">
          <FiAlertTriangle />
        </div>
        <h2>Access Denied</h2>
        <p>{apptError}</p>
        {/* navigate(-1) previously relied on the back-button trap effect's
            own extra pushState entry being gone by the time this renders,
            and even then just went back one history step — unreliable, and
            not necessarily "home" if the user arrived here via a deep link.
            Route straight to the right dashboard instead, replacing this
            entry so a later back-navigation doesn't return to the now-dead
            call/gate screen. */}
        <button
          className="hc-vc__gate-btn"
          onClick={() => navigate(resolveHomePath(), { replace: true })}
        >
          Go Home
        </button>
      </div>
    );
  }

  if (
    !canJoinConsultation &&
    ["pending", "requested", "upcoming", "assigned"].includes(appt?.status)
  ) {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">
          <FiClock />
        </div>
        <h2>Appointment Pending</h2>
        <p>
          {isDoctor
            ? "Confirm this appointment from your dashboard before starting the video call."
            : "Your appointment is awaiting the doctor's confirmation."}
        </p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  if (
    ["complete", "completed"].includes(appt?.status) ||
    appt?.status === "cancelled"
  ) {
    return (
      <div className="hc-vc__gate">
        <div className="hc-vc__gate-icon">
          {["complete", "completed"].includes(appt.status) ? (
            <FiCheckCircle />
          ) : (
            <FiX />
          )}
        </div>
        <h2>
          Appointment{" "}
          {["complete", "completed"].includes(appt.status)
            ? "Complete"
            : "Cancelled"}
        </h2>
        <p>This appointment is no longer active.</p>
        <button className="hc-vc__gate-btn" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  // ── PiP position style ────────────────────────────────────────────
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
  const screenShareSupported = canUseScreenShare();

  // ── Main call UI ──────────────────────────────────────────────────
  return (
    <div className="hc-vc__page" ref={pageRef}>
      <div className="hc-vc__ctrlbar-meta">
        <div className="hc-vc__meta-left">
          <div className="hc-vc__logo-mark">
            <img
              src={HumancareLogo}
              alt="Humancare Connect"
              className="hc-vc__logo-img"
            />
          </div>
        </div>

        {otherParty && (
          <div className="hc-vc__meta-party">
            <span className="hc-vc__meta-party-icon">
              <FiUser />
            </span>
            <div className="hc-vc__meta-party-text">
              <span className="hc-vc__infobar-label">{otherParty.label}</span>
              <span className="hc-vc__infobar-name">{otherParty.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Offline banner ───────────────────────────────────────── */}
      {isOffline && (
        <div className="hc-vc__offline-banner">
          <FiAlertTriangle /> You're offline. Reconnecting once your internet is
          back.
        </div>
      )}

      {/* ── Inline error toast ──────────────────────────────────── */}
      {inlineError && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            borderRadius: 10,
            padding: "12px 20px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <FiAlertTriangle /> {inlineError}
        </div>
      )}

      {/* ── End Call confirm modal ───────────────────────────────── */}
      {endCallConfirm && (
        <div
          className="hc-vc__confirm-overlay"
          onClick={() => setEndCallConfirm(false)}
        >
          <div
            className="hc-vc__confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hc-vc__confirm-icon hc-vc__confirm-icon--danger">
              <FiPhoneOff />
            </div>
            <h3 className="hc-vc__confirm-title">
              {isDoctor ? "Leave or Complete?" : "Leave Call?"}
            </h3>
            <p className="hc-vc__confirm-text">
              {isDoctor
                ? "Leave only exits the video call. Complete Appointment will mark the consultation complete."
                : "You will leave the video call. The doctor will be notified."}
            </p>
            <div className="hc-vc__confirm-actions">
              <button
                className="hc-vc__confirm-btn"
                onClick={() => setEndCallConfirm(false)}
              >
                Stay
              </button>
              <button
                className="hc-vc__confirm-btn hc-vc__confirm-btn--danger"
                onClick={leaveCall}
              >
                Leave Call
              </button>
              {isDoctor && (
                <button
                  className="hc-vc__confirm-btn hc-vc__confirm-btn--success"
                  onClick={completeAppointment}
                  disabled={completing}
                >
                  {completing ? "Completing..." : "Complete Appointment"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deviceCheck.status !== "idle" && deviceCheck.status !== "ready" && (
        <div
          style={{
            position: "fixed",
            top: inlineError ? 72 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: deviceCheck.status === "failed" ? "#fef2f2" : "#eff6ff",
            border: `1px solid ${deviceCheck.status === "failed" ? "#fca5a5" : "#93c5fd"}`,
            color: deviceCheck.status === "failed" ? "#dc2626" : "#1d4ed8",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {deviceCheck.status === "checking" ? (
            <FiRefreshCw />
          ) : (
            <FiAlertTriangle />
          )}
          {deviceCheck.status === "checking"
            ? "Checking camera and microphone..."
            : "Device check failed. Review browser permissions and retry."}
        </div>
      )}

      {/* ── Leave (back button) confirm modal ───────────────────── */}
      {leaveConfirm && (
        <div
          className="hc-vc__confirm-overlay"
          onClick={() => setLeaveConfirm(false)}
        >
          <div
            className="hc-vc__confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hc-vc__confirm-icon">⚠</div>
            <h3 className="hc-vc__confirm-title">Leave Consultation?</h3>
            <p className="hc-vc__confirm-text">
              Leaving will end your consultation session. Are you sure?
            </p>
            <div className="hc-vc__confirm-actions">
              <button
                className="hc-vc__confirm-btn"
                onClick={() => setLeaveConfirm(false)}
              >
                Stay
              </button>
              <button
                className="hc-vc__confirm-btn hc-vc__confirm-btn--danger"
                onClick={() => {
                  setLeaveConfirm(false);
                  performCleanup();
                  navigate(pendingLeaveRef.current || "/user/dashboard", {
                    replace: true,
                  });
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Consultation completed overlay (patient) ─────────────── */}
      {showCompletedOverlay && !isDoctor && (
        <div className="hc-vc__completed-overlay">
          <div className="hc-vc__completed-card">
            <div className="hc-vc__completed-icon">
              <FiCheckCircle />
            </div>
            <h2>Consultation Completed</h2>
            <p>Your doctor has marked this session as complete.</p>
            <p className="hc-vc__completed-sub">
              Redirecting to your dashboard...
            </p>
            <div className="hc-vc__completed-spinner" />
          </div>
        </div>
      )}

      {/* ── Prescription notification banner (patient) ───────────── */}
      {prescriptionNotif && !isDoctor && (
        <div className="hc-vc__rx-notif">
          <span className="hc-vc__rx-notif-icon">💊</span>
          <span className="hc-vc__rx-notif-text">
            Prescription issued: <strong>{prescriptionNotif.diagnosis}</strong>
          </span>
          <button
            className="hc-vc__rx-notif-view"
            onClick={() => navigate("/user/my-records")}
          >
            View
          </button>
          <button
            className="hc-vc__rx-notif-close"
            onClick={() => setPrescriptionNotif(null)}
          >
            <FiX />
          </button>
        </div>
      )}

      {/* ── Rx saved toast (doctor) ──────────────────────────────── */}
      {rxSavedToast && isDoctor && (
        <div className="hc-vc__rx-saved-toast">
          <FiCheckCircle /> Prescription issued successfully
        </div>
      )}

      {/* Main stage + chat */}
      <div
        className={`hc-vc__body ${chatOpen || notesOpen ? "hc-vc__body--chat" : ""}`}
      >
        {/* Stage */}
        <div className="hc-vc__stage">
          {/* Main video */}
          <div className="hc-vc__main-wrap">
            <video
              ref={setMainVideoRef}
              autoPlay
              playsInline
              muted
              className={`hc-vc__main-video${isSwapped ? " hc-vc__video--local" : ""}${isMainVideoPortrait ? " hc-vc__main-video--portrait" : ""}`}
            />

            {/* Waiting overlay — only when remote isn't connected and remote is in main */}
            {!isRemoteConnected && !isSwapped && (
              <div className="hc-vc__waiting">
                <div className="hc-vc__waiting-ring">
                  <div className="hc-vc__waiting-avatar-wrap">
                    <span className="hc-vc__waiting-icon">
                      <FiUser />
                    </span>
                  </div>
                </div>
                <p className="hc-vc__waiting-title">
                  {peerJoined
                    ? hasConnectedOnceRef.current
                      ? "Reconnecting..."
                      : "Establishing secure connection..."
                    : `Waiting for ${isDoctor ? "patient" : "doctor"}...`}
                </p>
                <p className="hc-vc__waiting-sub">
                  {peerJoined
                    ? hasConnectedOnceRef.current
                      ? "Restoring your connection to the call."
                      : "Both participants are ready. Video starting soon."
                    : "Share the appointment link with the other person to begin."}
                </p>
              </div>
            )}

            {/* Reconnect stalled — manual escape hatch if automatic recovery is
                slow. Past MAX_RECONNECT_STALL_RETRIES stalls in a row, stop
                implying "still working on it" and offer an explicit way to
                give up instead of retrying silently forever. */}
            {/* Also kept up while a manual Retry is being held
                (manualReconnecting) — the tap itself clears reconnectStalled,
                which used to make the banner (and its "Reconnecting…"
                button) vanish the instant it was pressed. It goes away when
                the rebuilt connection is healthy or the hold ends. */}
            {(reconnectStalled || manualReconnecting) && (
              <div className="hc-vc__reconnect-stalled-notice">
                <span>
                  <FiAlertTriangle />
                </span>
                <span>
                  {manualReconnecting
                    ? "Reconnecting to the call…"
                    : waitingForOldPeer
                      ? "Waiting for the other person to reconnect…"
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
                  <button
                    type="button"
                    className="hc-vc__rx-btn-ghost"
                    onClick={() => setEndCallConfirm(true)}
                  >
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

            {/* Peer left notice */}
            {peerLeft && (
              <div className="hc-vc__peer-left-notice">
                <span>
                  <FiPhoneOff />
                </span>
                <span>
                  {isDoctor ? "Patient" : "Doctor"} has left the call.
                </span>
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
                ref={setPipVideoRef}
                autoPlay
                playsInline
                muted
                className={`hc-vc__pip-video${!isSwapped ? " hc-vc__video--local" : ""}${isPipVideoPortrait ? " hc-vc__pip-video--portrait" : ""}`}
              />

              {isCamOff && !isSwapped && (
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

              {/* Expand / swap button */}
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

          {/* Remote audio output — kept mounted independent of self-view
              visibility. It must never live inside a conditionally-rendered
              block: the main video is always muted (audio plays only
              through this element), so unmounting it would silently cut
              the remote party's audio while self-view is minimized. Kept
              rendered-but-invisible rather than display:none — some engines
              (older mobile Safari) won't start playback on a display:none
              media element. Mirrors DirectVideoCall.jsx. */}
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
                <span className="hc-vc__chat-icon">
                  <FiMessageSquare />
                </span>
                <span className="hc-vc__chat-title">In-call Chat</span>
              </div>
              <button
                className="hc-vc__chat-close-btn"
                onClick={toggleChat}
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
                  <p>Share notes or files here during the call.</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const mine = msg.senderId === currentUser.id;
                return (
                  <div
                    key={msg._localKey ?? i}
                    className={`hc-vc__msg ${mine ? "hc-vc__msg--mine" : "hc-vc__msg--theirs"}`}
                  >
                    {!mine && (
                      <div className="hc-vc__msg-name">{msg.senderName}</div>
                    )}

                    {msg.fileUrl ? (
                      <div className="hc-vc__msg-bubble hc-vc__msg-file">
                        {msg.fileType?.startsWith("image/") ? (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hc-vc__msg-img-link"
                          >
                            <img
                              src={msg.fileUrl}
                              alt={msg.fileName}
                              className="hc-vc__msg-img"
                            />
                            <span className="hc-vc__msg-img-name">
                              {msg.fileName}
                            </span>
                          </a>
                        ) : (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={msg.fileName}
                            className="hc-vc__msg-file-row"
                          >
                            <span className="hc-vc__msg-file-icon">
                              {msg.fileType?.includes("pdf")
                                ? "📄"
                                : msg.fileType?.includes("word") ||
                                    msg.fileType?.includes("doc")
                                  ? "📝"
                                  : msg.fileType?.includes("sheet") ||
                                      msg.fileType?.includes("excel")
                                    ? "📊"
                                    : "📎"}
                            </span>
                            <span className="hc-vc__msg-file-name">
                              {msg.fileName}
                            </span>
                            <span className="hc-vc__msg-file-dl">↓</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="hc-vc__msg-bubble">{msg.text}</div>
                    )}

                    <div className="hc-vc__msg-time">
                      {fmtTime(msg.createdAt)}
                    </div>
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
                aria-label="Attach file"
              >
                {uploadingFile ? (
                  <span className="hc-vc__attach-spin" />
                ) : (
                  <FiPaperclip />
                )}
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
                disabled={!chatInput.trim() || chatSendCoolingDown}
                title="Send"
                aria-label="Send message"
              >
                <FiSend />
              </button>
            </div>
          </div>
        )}

        {/* ── Doctor notes panel ────────────────────────────────── */}
        {notesOpen && isDoctor && (
          <div className="hc-vc__notes">
            <div className="hc-vc__notes-head">
              <div className="hc-vc__notes-head-left">
                <span className="hc-vc__notes-icon">
                  <FiFileText />
                </span>
                <span className="hc-vc__notes-title">Consultation Notes</span>
              </div>
              <button
                className="hc-vc__notes-close-btn"
                onClick={toggleNotes}
                title="Close notes"
                aria-label="Close notes"
              >
                <FiX />
              </button>
            </div>

            <div className="hc-vc__notes-meta">
              <span>{otherParty?.name || "Patient"}</span>
              <span>
                {notesSaving
                  ? "Saving..."
                  : notesSavedAt
                    ? `Saved ${fmtTime(notesSavedAt)}`
                    : "Not saved yet"}
              </span>
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
              placeholder={
                notesLoading
                  ? "Loading notes..."
                  : "Write consultation observations, assessment, plan, and follow-up notes..."
              }
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
            <span className="hc-vc__btn-icon">
              {isMuted ? <FiMicOff /> : <FiMic />}
            </span>
            <span className="hc-vc__btn-label">
              {isMuted ? "Unmute" : "Mute"}
            </span>
          </button>

          <button
            className={`hc-vc__btn ${isCamOff ? "hc-vc__btn--danger" : ""}`}
            onClick={toggleCamera}
            disabled={!isReady}
            title={isCamOff ? "Turn camera on" : "Turn camera off"}
          >
            <span className="hc-vc__btn-icon">
              {isCamOff ? <FiVideoOff /> : <FiVideo />}
            </span>
            <span className="hc-vc__btn-label">
              {isCamOff ? "Cam On" : "Cam Off"}
            </span>
          </button>

          <button
            className={`hc-vc__btn hc-vc__btn--share ${isScreenSharing ? "hc-vc__btn--active" : ""}`}
            onClick={toggleScreenShare}
            disabled={
              !isReady ||
              // Only gates *starting* a new share — stopping one already in
              // progress must stay available regardless of peer state.
              // peerLeft covers the common case (pcRef.current is nulled by
              // handleParticipantLeft while it's true); startScreenShare
              // itself remains the authoritative check and surfaces a
              // message for any other case where a connection isn't usable.
              (!isScreenSharing && (!screenShareSupported || peerLeft))
            }
            title={
              !screenShareSupported
                ? "Screen sharing is not supported on this browser"
                : isScreenSharing
                  ? "Stop sharing"
                  : peerLeft
                    ? "Screen sharing is unavailable while the other participant is away"
                    : "Share screen"
            }
          >
            <span className="hc-vc__btn-icon">
              <FiMonitor />
            </span>
            <span className="hc-vc__btn-label">
              {isScreenSharing ? "Stop" : "Share"}
            </span>
          </button>
          {inCall && isDoctor && (
            <div className="hc-vc__timer">
              <FiClock />
              <span>{fmtDuration(callDuration)}</span>
            </div>
          )}
          {inCall && (
            <div className="hc-vc__live-pill">
              <span className="hc-vc__live-dot" />
              Live
            </div>
          )}
          {inCall && connectionQuality !== "unknown" && (
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
            <span className="hc-vc__btn-icon">
              {isFullscreen ? <FiMinimize /> : <FiMaximize />}
            </span>
            <span className="hc-vc__btn-label">
              {isFullscreen ? "Exit" : "Full"}
            </span>
          </button>

          <button
            className={`hc-vc__btn ${isSelfViewMinimized ? "hc-vc__btn--active" : ""}`}
            onClick={toggleSelfView}
            title={
              isSelfViewMinimized ? "Show self view" : "Minimize self view"
            }
          >
            <span className="hc-vc__btn-icon">
              {isSelfViewMinimized ? <FiMaximize2 /> : <FiMinimize2 />}
            </span>
            <span className="hc-vc__btn-label">
              {isSelfViewMinimized ? "Show Me" : "Hide Me"}
            </span>
          </button>

          <button
            className={`hc-vc__btn ${chatOpen ? "hc-vc__btn--chat-on" : ""}`}
            onClick={toggleChat}
            title="Chat"
          >
            <span className="hc-vc__btn-icon">
              <FiMessageSquare />
            </span>
            <span className="hc-vc__btn-label">Chat</span>
            {unreadCount > 0 && !chatOpen && (
              <span className="hc-vc__badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {isDoctor && (
            <button
              className={`hc-vc__btn ${notesOpen ? "hc-vc__btn--notes-on" : ""}`}
              onClick={toggleNotes}
              title="Consultation notes"
            >
              <span className="hc-vc__btn-icon">
                <FiFileText />
              </span>
              <span className="hc-vc__btn-label">Notes</span>
            </button>
          )}

          <button
            className="hc-vc__btn hc-vc__btn--end"
            onClick={() => setEndCallConfirm(true)}
            disabled={completing}
            title={isDoctor ? "Leave or complete appointment" : "Leave call"}
          >
            <span className="hc-vc__btn-icon">
              {completing ? <FiRefreshCw /> : <FiPhoneOff />}
            </span>
            <span className="hc-vc__btn-label">
              {completing ? "Completing..." : "Leave Call"}
            </span>
          </button>
        </div>
      </div>
      {/* Cam error banner */}
      {camError && (
        <div className="hc-vc__error-bar">
          <FiAlertTriangle />{" "}
          {camErrorReason ||
            "Camera or microphone access denied. Check browser permissions and retry."}
          <button
            onClick={retryMediaPermissions}
            disabled={retryingMedia}
            style={{
              marginLeft: 12,
              padding: "4px 12px",
              borderRadius: 6,
              background: "#fff",
              color: "#dc2626",
              border: "none",
              fontWeight: 700,
              cursor: retryingMedia ? "not-allowed" : "pointer",
              opacity: retryingMedia ? 0.7 : 1,
            }}
          >
            {retryingMedia ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      {/* Doctor-side notice: an admin/backend job closed this appointment
          while the doctor is still in the call — no auto-redirect, since
          the doctor may still want to finish talking to the patient first. */}
      {apptClosedByOther && isDoctor && (
        <div className="hc-vc__error-bar">
          <FiAlertTriangle /> {apptClosedByOther}
          <button
            onClick={leaveCall}
            style={{
              marginLeft: 12,
              padding: "4px 12px",
              borderRadius: 6,
              background: "#fff",
              color: "#dc2626",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Leave Call
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
