/* eslint-disable */
// One side of a call, for the browser test: the REAL hook, engine, panels, overlay and buttons; a fake Azure SDK (see fakeSpeechSdk.mjs);
// a fake call socket between browser tabs (BroadcastChannel) that stamps the sender's role like the server does; a fake HTTP client that
// records the requests. Real microphone input comes from Chrome's fake audio device.
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranscription } from "../../../../src/features/translation/useTranscription.js";
import { LanguageButton, TranscriptButton } from "../../../../src/features/translation/ControlButtons.jsx";
import LanguagePanel from "../../../../src/features/translation/LanguagePanel.jsx";
import TranscriptPanel from "../../../../src/features/translation/TranscriptPanel.jsx";
import TranscriptionOverlay from "../../../../src/features/translation/TranscriptionOverlay.jsx";

const params = new URLSearchParams(location.search);
const role = params.get("role") === "doctor" ? "doctor" : "patient";
const appointmentId = params.get("appt") || "64b7f0c2a1b2c3d4e5f60718";
const flagOn = params.get("flag") !== "off";

// ---- things the test looks at ----
window.__hc = { requests: [], gum: 0, audioContexts: 0, busMessages: 0 };
const RealAudioContext = window.AudioContext;
window.AudioContext = function (...a) { window.__hc.audioContexts += 1; return new RealAudioContext(...a); };
const realGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = (c) => { window.__hc.gum += 1; return realGum(c); };

const channel = new BroadcastChannel(`hc-${appointmentId}`);
const handlers = new Map();
channel.onmessage = (e) => {
  const { event, payload, from } = e.data;
  window.__hc.busMessages += 1;
  (handlers.get(event) || []).forEach((fn) => fn(payload && typeof payload === "object" ? { ...payload, from } : payload));
};
const socket = {
  emit: (event, payload) => { window.__hc.busMessages += 1; channel.postMessage({ event, payload, from: role }); },
  on: (event, fn) => { (handlers.get(event) || handlers.set(event, []).get(event)).push(fn); },
  off: (event, fn) => { handlers.set(event, (handlers.get(event) || []).filter((f) => f !== fn)); },
};
const http = {
  async get(url) {
    window.__hc.requests.push({ method: "GET", url });
    if (url.startsWith("/api/speech-token")) return { data: { token: "test-token", region: "eastus", expiresInSeconds: 540 } };
    return { data: {} };
  },
  async post(url, body) {
    window.__hc.requests.push({ method: "POST", url, body });
    return { data: {} };
  },
};

function App() {
  const localRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [panel, setPanel] = useState(null);
  const config = useMemo(() => ({ mode: "notice", noticeVersion: "v1" }), []);
  const tr = useTranscription({
    active: flagOn,
    role,
    appointmentId,
    config,
    http,
    socket,
    getLocalStream: () => localRef.current,
    getRemoteElements: () => [],
    browserLanguages: [params.get("lang") || "en-US"],
  });
  window.__hc.state = () => tr.state;
  window.__hc.actions = tr.actions;

  // Like the call screen: the microphone exists whatever the flag says.
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { localRef.current = s; setReady(true); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!(tr.active && ready)) return;
    tr.actions.start();
    setTimeout(() => channel.postMessage({ event: "peer-joined", payload: {}, from: role }), 50); // the server tells the others I joined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr.active, ready]);
  useEffect(() => { tr.actions.setMuted(muted); }, [muted, tr.actions]);

  return (
    <div className="row">
      <div className="stage" style={{ flex: 1 }}>
        <div id="role" style={{ position: "absolute", right: 8, top: 8 }}>{role}</div>
        <div id="bar" style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 8, padding: 8, zIndex: 60, background: "#0a1826" }}>
          <button id="mute" onClick={() => setMuted((m) => !m)}>{muted ? "Unmute" : "Mute"}</button>
          {tr.active && (
            <>
            <LanguageButton language={tr.state.readLang} open={panel === "language"} onClick={() => setPanel((p) => (p === "language" ? null : "language"))} />
            <TranscriptButton open={panel === "transcript"} onClick={() => setPanel((p) => (p === "transcript" ? null : "transcript"))} />
            </>
          )}
        </div>
        {tr.active && <TranscriptionOverlay state={tr.state} actions={tr.actions} role={role} ownLanguageCode="en" />}
      </div>
      {tr.active && panel === "language" && <LanguagePanel open onClose={() => setPanel(null)} state={tr.state} actions={tr.actions} />}
      {tr.active && panel === "transcript" && <TranscriptPanel open onClose={() => setPanel(null)} state={tr.state} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
