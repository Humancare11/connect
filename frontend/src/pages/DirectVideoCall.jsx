import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import socket from "../socket";
import api from "../api";
import { RTC_CONFIG } from "../utils/rtcIceConfig";
import "./videocall.css";
import "./directvideocall.css";
import HumancareLogo from "../assets/VideoCallingImage.png";
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
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
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

// First line of defense against a stuck Enter key / paste-loop flooding
// chat — the server has its own rate limit (see backend/utils/socketRateLimit.js),
// this just keeps the UI itself from firing faster than a human can type.
const CHAT_SEND_COOLDOWN_MS = 300;

const CONNECTION_STATS_INTERVAL_MS = 5000;

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

// Turns raw WebRTC stats into a coarse, user-facing quality bucket. Packet
// loss is derived from the DELTA between this poll and the previous one
// (not the raw cumulative counter) — using the cumulative value directly
// would mean a single lost packet early in a long call marks the
// connection "poor" for its entire remaining duration.
const deriveConnectionQuality = (diagnostics, previousSample) => {
  if (diagnostics.rtt === null) return "unknown";

  let lossRatio = 0;
  if (previousSample) {
    const deltaSent = diagnostics.packetsSent - previousSample.packetsSent;
    const deltaLost = diagnostics.packetsLost - previousSample.packetsLost;
    if (deltaSent > 0 && deltaLost > 0) {
      lossRatio = deltaLost / (deltaSent + deltaLost);
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

  const [callStatus, setCallStatus] = useState("waiting"); // waiting | connecting | connected | reconnecting
  const [peerLeftNotice, setPeerLeftNotice] = useState(false);
  const [peerName, setPeerName] = useState("");
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

  const previewVideoRef = useRef(null);
  const mainVideoRef = useRef(null);
  const pipVideoRef = useRef(null);
  const mainVideoOrientationCleanupRef = useRef(null);
  const pipVideoOrientationCleanupRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const pcRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const isSwappedRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
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

  // A fully offline device previously only surfaced indirectly, once the
  // socket/ICE timeouts eventually fired. Report it immediately via the
  // browser's own connectivity signal instead.
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
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

    getCallMediaStream()
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
        setPreviewMicOn(stream.getAudioTracks().length > 0);
        setPreviewCamOn(stream.getVideoTracks().length > 0);
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
          const diagnostics = { rtt: null, packetsSent: 0, packetsLost: 0 };
          for (const report of stats.values()) {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              if (typeof report.currentRoundTripTime === "number") {
                diagnostics.rtt = Math.round(report.currentRoundTripTime * 1000);
              }
              if (typeof report.packetsSent === "number") {
                diagnostics.packetsSent = report.packetsSent;
              }
              if (typeof report.packetsLost === "number") {
                diagnostics.packetsLost = report.packetsLost;
              }
            }
          }
          const quality = deriveConnectionQuality(diagnostics, lastStatsSampleRef.current);
          lastStatsSampleRef.current = {
            packetsSent: diagnostics.packetsSent,
            packetsLost: diagnostics.packetsLost,
          };
          setConnectionQuality(quality);
        } catch (err) {
          console.warn("[direct-video-call] getStats failed:", err.message);
        }
      }, CONNECTION_STATS_INTERVAL_MS);
    },
    [stopStatsCollection],
  );

  // ── Assign local/remote streams to whichever <video> is in the main vs.
  // pip slot right now — kept as a single source of truth so swapping the
  // view just re-points srcObject instead of moving DOM nodes around. ──────
  const playAssignedVideos = useCallback(async () => {
    const mainOk = await playVideoElement(mainVideoRef.current);
    const pipOk = await playVideoElement(pipVideoRef.current);
    const remoteVideoEl = isSwappedRef.current ? pipVideoRef.current : mainVideoRef.current;
    const remoteOk = remoteVideoEl === pipVideoRef.current ? pipOk : mainOk;
    setPlaybackBlocked(Boolean(remoteVideoEl?.srcObject) && !remoteOk);
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
      void playAssignedVideos();
    },
    [playAssignedVideos],
  );

  const setMainVideoRef = useCallback((node) => {
    mainVideoRef.current = node;
    mainVideoOrientationCleanupRef.current?.();
    mainVideoOrientationCleanupRef.current = node
      ? watchVideoOrientation(node, setIsMainVideoPortrait)
      : null;
  }, []);

  const setPipVideoRef = useCallback((node) => {
    pipVideoRef.current = node;
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
    socket.emit("leave-direct-room", { roomId });
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
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

    const handleOffer = async ({ offer } = {}) => {
      const pc = pcRef.current;
      if (!pc || !offer) return;
      const polite = !isInitiatorRef.current;
      const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
      ignoreOfferRef.current = !polite && offerCollision;
      if (ignoreOfferRef.current) return;

      try {
        if (offerCollision) {
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(offer);
        await flushPendingCandidates();
        await pc.setLocalDescription();
        socket.emit("direct-video-answer", { roomId, answer: pc.localDescription });
      } catch (err) {
        console.error("[direct-video-call] offer handling failed", err);
      }
    };

    const handleAnswer = async ({ answer } = {}) => {
      const pc = pcRef.current;
      if (!pc || !answer) return;
      try {
        await pc.setRemoteDescription(answer);
        await flushPendingCandidates();
      } catch (err) {
        console.error("[direct-video-call] answer handling failed", err);
      }
    };

    const handleIceCandidate = async ({ candidate } = {}) => {
      const pc = pcRef.current;
      if (!pc || !candidate) return;
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!ignoreOfferRef.current) console.error("[direct-video-call] addIceCandidate failed", err);
      }
    };

    const handlePeerJoined = ({ name } = {}) => {
      if (!mountedRef.current) return;
      setPeerLeftNotice(false);
      setPeerName(name || "");
      setCallStatus((prev) => (prev === "connected" ? prev : "connecting"));
    };

    const handleParticipantLeft = () => {
      if (!mountedRef.current) return;
      setPeerLeftNotice(true);
      setCallStatus("waiting");
    };

    const handleRoomClosed = () => {
      if (!mountedRef.current) return;
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
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit("direct-video-offer", { roomId, offer: pc.localDescription });
      } catch (err) {
        console.error("[direct-video-call] ICE restart failed", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    const handleChatMessage = ({ senderName, text, createdAt } = {}) => {
      if (!mountedRef.current || !text) return;
      setMessages((prev) => [
        ...prev,
        { senderName, text, createdAt, mine: false, _localKey: makeMessageKey() },
      ]);
    };

    const setupPeerConnection = () => {
      let pc;
      try {
        pc = new RTCPeerConnection(RTC_CONFIG);
      } catch (err) {
        console.error("[direct-video-call] RTCPeerConnection construction failed:", err);
        handleRoomError({
          code: "server_error",
          msg: "Could not start the video call on this browser or device.",
        });
        return;
      }
      pcRef.current = pc;

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

        incomingTracks.forEach((track) => {
          remoteStream
            .getTracks()
            .filter((existing) => existing.kind === track.kind && existing.id !== track.id)
            .forEach((stale) => remoteStream.removeTrack(stale));
          if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track);
        });

        assignStreams(isSwappedRef.current);
      };

      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current = true;
          await pc.setLocalDescription();
          socket.emit("direct-video-offer", { roomId, offer: pc.localDescription });
        } catch (err) {
          console.error("[direct-video-call] negotiationneeded failed", err);
        } finally {
          makingOfferRef.current = false;
        }
      };

      pc.onconnectionstatechange = () => {
        if (!mountedRef.current) return;
        if (pc.connectionState === "connected") {
          setCallStatus("connected");
          setPeerLeftNotice(false);
          startCallTimer();
          startStatsCollection(pc);
        } else if (pc.connectionState === "disconnected") {
          setCallStatus("reconnecting");
          stopStatsCollection();
        } else if (pc.connectionState === "failed") {
          setCallStatus("reconnecting");
          stopStatsCollection();
          socket.emit("direct-ice-restart-request", { roomId });
        }
      };

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }
    };

    const handleRoomJoined = ({ isInitiator } = {}) => {
      if (!mountedRef.current) return;
      isInitiatorRef.current = !!isInitiator;
      setCallStatus(isInitiator ? "connecting" : "waiting");
      setupPeerConnection();
    };

    const joinRoom = () => {
      socket.emit("join-direct-room", { roomId, guestId: guestIdRef.current, name: guestName });
    };

    socket.on("connect", joinRoom);
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
      cleanupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, roomId]);

  const retryPreview = useCallback(() => {
    setPreviewAttempt((n) => n + 1);
  }, []);

  const togglePreviewMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) return;
    setPreviewMicOn((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const togglePreviewCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || stream.getVideoTracks().length === 0) return;
    setPreviewCamOn((prev) => {
      const next = !prev;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const joinMeeting = useCallback(
    (event) => {
      event.preventDefault();
      if (joining) return;
      setJoining(true);
      const trimmedName = guestName.trim().slice(0, 60);
      setGuestName(trimmedName);
      try {
        localStorage.setItem(NAME_STORAGE_KEY, trimmedName);
      } catch {
        // Storage unavailable — non-fatal, just won't be remembered next time.
      }
      setMicOn(previewMicOn);
      setCamOn(previewCamOn);
      joinedRef.current = true;
      setStage("call");
    },
    [joining, guestName, previewMicOn, previewCamOn],
  );

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMicOn((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setCamOn((prev) => {
      const next = !prev;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

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
      } else if (pageEl.requestFullscreen) {
        await pageEl.requestFullscreen();
      }
    } catch (err) {
      console.error("[direct-video-call] Fullscreen toggle failed:", err);
    }
  }, []);

  const leaveCall = useCallback(() => {
    cleanupCall();
    setStage("ended");
  }, [cleanupCall]);

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
        <p>You have left the meeting.</p>
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
              type="text"
              value={guestName}
              maxLength={60}
              placeholder="Your name"
              onChange={(e) => setGuestName(e.target.value)}
              autoFocus
            />
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

      <div className={`hc-vc__body ${chatOpen ? "hc-vc__body--chat" : ""}`}>
        <div className="hc-vc__stage">
          <div className="hc-vc__main-wrap">
            <video
              ref={setMainVideoRef}
              autoPlay
              playsInline
              muted={isSwapped}
              className={`hc-vc__main-video${isSwapped ? " hc-vc__video--local" : ""}${isMainVideoPortrait ? " hc-vc__main-video--portrait" : ""}`}
            />

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
                muted={!isSwapped}
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
            onClick={leaveCall}
            title="Leave call"
          >
            <span className="hc-vc__btn-icon">
              <FiPhoneOff />
            </span>
            <span className="hc-vc__btn-label">Leave Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}
