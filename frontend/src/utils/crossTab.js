// Messages between the tabs of one browser (the admin dashboard tab and the Live Chat tab).
// BroadcastChannel where the browser has it; otherwise a localStorage key plus the "storage" event, which browsers
// fire in the OTHER tabs only. A tab never receives its own messages on either transport.
const CHANNEL = "hc-cross-tab";
const FALLBACK_KEY = "hcCrossTab";

let channel = null;
let channelTried = false;
const listeners = new Set();

function getChannel() {
  if (channelTried) return channel;
  channelTried = true;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event) => listeners.forEach((listener) => listener(event.data));
    }
  } catch {
    channel = null;
  }
  if (!channel && typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== FALLBACK_KEY || !event.newValue) return;
      try {
        const { message } = JSON.parse(event.newValue);
        listeners.forEach((listener) => listener(message));
      } catch {
        /* ignore a malformed message */
      }
    });
  }
  return channel;
}

export function postToTabs(message) {
  try {
    const ch = getChannel();
    if (ch) ch.postMessage(message);
    else localStorage.setItem(FALLBACK_KEY, JSON.stringify({ message, n: Math.random() }));
  } catch {
    /* no cross-tab messaging in this browser: every tab then just works on its own */
  }
}

export function onTabMessage(listener) {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Session sync between admin tabs ─────────────────────────────────────────────────────────────────────────
const ACTIVITY_EVERY_MS = 20_000;
const INPUT_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export const broadcastLogout = () => postToTabs({ type: "session:logout" });

// Shares real user input with the other tabs so the idle timeout of a tab the admin is not looking at does not log
// them out of everything. `onRemoteActivity` and `onRemoteLogout` run for messages from the other tabs.
export function startSessionSync({ onRemoteActivity, onRemoteLogout }) {
  let last = 0;
  const share = () => {
    const now = Date.now();
    if (now - last < ACTIVITY_EVERY_MS) return;
    last = now;
    postToTabs({ type: "session:activity" });
  };
  INPUT_EVENTS.forEach((name) => window.addEventListener(name, share, { passive: true }));
  const off = onTabMessage((message) => {
    if (message?.type === "session:activity") onRemoteActivity();
    else if (message?.type === "session:logout") onRemoteLogout();
  });
  return () => {
    INPUT_EVENTS.forEach((name) => window.removeEventListener(name, share));
    off();
  };
}
