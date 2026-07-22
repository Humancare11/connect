import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import socket from "../socket";
import api from "../api";
import { RTC_CONFIG } from "../utils/rtcIceConfig";
import "./directvideocall.css";
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

  const previewVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const pcRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const joinedRef = useRef(false);
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatSendCooldownTimerRef = useRef(null);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
  }, [roomId, stopCallTimer]);

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

        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
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
        } else if (pc.connectionState === "disconnected") {
          setCallStatus("reconnecting");
        } else if (pc.connectionState === "failed") {
          setCallStatus("reconnecting");
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

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

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

  // ── Render: terminal / setup states ────────────────────────────────────────
  if (stage === "checking") {
    return (
      <div className="dvcall-page dvcall-page--center">
        <div className="dvcall-spinner" />
        <p>Checking your meeting link…</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="dvcall-page dvcall-page--center">
        <div className="dvcall-error-card">
          <FiAlertTriangle size={34} />
          <h2>Can't join this meeting</h2>
          <p>{errorInfo?.msg}</p>
          <Link to="/" className="dvcall-btn-primary">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "ended") {
    return (
      <div className="dvcall-page dvcall-page--center">
        <div className="dvcall-error-card">
          <h2>Call ended</h2>
          <p>You have left the meeting.</p>
          <Link to="/" className="dvcall-btn-primary">
            Return Home
          </Link>
        </div>
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

  return (
    <div className="dvcall-page">
      {isOffline && (
        <div className="dvcall-offline-banner">
          <FiAlertTriangle /> You're offline. Reconnecting once your internet is back.
        </div>
      )}
      <div className="dvcall-topbar">
        <span className="dvcall-badge">Direct Video Consultation</span>
        {connected && <span className="dvcall-duration">{fmtDuration(duration)}</span>}
      </div>

      <div className="dvcall-stage">
        <video ref={remoteVideoRef} className="dvcall-remote-video" autoPlay playsInline />
        {!connected && (
          <div className="dvcall-waiting-overlay">
            <div className="dvcall-spinner" />
            <p>
              {waitingForPeer && "Waiting for the other participant to join…"}
              {connecting && `Connecting${peerName ? ` to ${peerName}` : ""}…`}
              {reconnecting && "Reconnecting…"}
            </p>
          </div>
        )}
        {peerLeftNotice && !connected && (
          <div className="dvcall-peer-left-banner">The other participant left the meeting.</div>
        )}

        <video ref={localVideoRef} className="dvcall-local-video" autoPlay playsInline muted />
      </div>

      <div className="dvcall-controls">
        <button type="button" className={`dvcall-ctrl ${!micOn ? "dvcall-ctrl--off" : ""}`} onClick={toggleMic}>
          {micOn ? <FiMic /> : <FiMicOff />}
        </button>
        <button type="button" className={`dvcall-ctrl ${!camOn ? "dvcall-ctrl--off" : ""}`} onClick={toggleCam}>
          {camOn ? <FiVideo /> : <FiVideoOff />}
        </button>
        <button type="button" className="dvcall-ctrl dvcall-ctrl--chat" onClick={() => setChatOpen((v) => !v)}>
          <FiMessageSquare />
        </button>
        <button type="button" className="dvcall-ctrl dvcall-ctrl--leave" onClick={leaveCall}>
          <FiPhoneOff />
        </button>
      </div>

      {chatOpen && (
        <div className="dvcall-chat">
          <div className="dvcall-chat__head">
            <span>In-call chat</span>
            <button type="button" onClick={() => setChatOpen(false)}>
              <FiX />
            </button>
          </div>
          <div className="dvcall-chat__body">
            {messages.length === 0 && <p className="dvcall-chat__empty">No messages yet.</p>}
            {messages.map((msg, idx) => (
              <div key={msg._localKey ?? idx} className={`dvcall-chat__msg ${msg.mine ? "dvcall-chat__msg--mine" : ""}`}>
                <span className="dvcall-chat__sender">{msg.senderName}</span>
                <p>{msg.text}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="dvcall-chat__form" onSubmit={sendChatMessage}>
            <input
              type="text"
              value={chatText}
              maxLength={2000}
              placeholder="Type a message…"
              onChange={(e) => setChatText(e.target.value)}
            />
            <button type="submit" disabled={!chatText.trim() || chatSendCoolingDown}>
              <FiSend />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
