// Sound and browser notifications for live chat admins.
//
//  - A short chime (generated with Web Audio, no file) for new chats, patient messages and queue entries. On by
//    default; the admin can mute it (remembered in this browser). Browsers only allow sound after the admin has
//    interacted with the page, so the audio context is created on the first click or key press.
//  - Browser notifications only after the admin clicked "Turn on notifications" AND the browser granted permission.
//    They are shown only while the tab is hidden, and never contain message text or health details: just who and
//    what kind of event ("Emma Wilson: new message").
import { openLiveChat } from "./liveChatTabs";

const SOUND_KEY = "hcLiveChatSound";
const VISITOR_SOUND_KEY = "hcLiveChatVisitorSound";
const VOICE_KEY = "hcLiveChatVoice";
const DISMISS_KEY = "hcLiveChatNotifyDismissed";

let audio = null;
let unlockInstalled = false;

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* optional */
  }
};

export const soundEnabled = () => read(SOUND_KEY) !== "off";
export function setSoundEnabled(on) {
  write(SOUND_KEY, on ? "on" : "off");
}

// "Sound on new website visitor": per admin, OFF unless the admin turned it on. It also needs the main Sound on.
export const visitorSoundEnabled = () => read(VISITOR_SOUND_KEY) === "on";
export function setVisitorSoundEnabled(on) {
  write(VISITOR_SOUND_KEY, on ? "on" : "off");
}

// "Voice alerts" (spoken "New visitor" / "Patient wants a live agent"): ON unless the admin turned it off. They also
// need the main Sound on (and the Visitor sound for the visitor alert), and only play in the Live Chat tab.
export const voiceEnabled = () => read(VOICE_KEY) !== "off";
export function setVoiceEnabled(on) {
  write(VOICE_KEY, on ? "on" : "off");
}

// True once the admin has clicked or typed on the page (the same unlock the chime needs).
export const audioUnlocked = () => Boolean(audio && audio.state === "running");

// Creates the audio context on the first real user gesture (autoplay rules).
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audio) audio = new Ctx();
      audio?.resume?.();
    } catch {
      /* no sound on this browser */
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

// Two soft notes. Silent if muted, if the page was never interacted with, or if audio is unavailable.
export function playChime() {
  if (!soundEnabled() || !audio || audio.state !== "running") return;
  try {
    const now = audio.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.35);
    });
  } catch {
    /* ignore */
  }
}

// One low, quiet note: clearly not the two-note chime of a chat or a message.
export function playVisitorSound() {
  if (!soundEnabled() || !audio || audio.state !== "running") return;
  try {
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = 523;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {
    /* ignore */
  }
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : "denied");
export const bannerDismissed = () => read(DISMISS_KEY) === "1";
export const dismissBanner = () => write(DISMISS_KEY, "1");

// Must be called from a click (browsers refuse otherwise). Resolves to "granted" | "denied" | "default".
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// `title` and `body` must already be free of message text. `path` is opened when the notification is clicked.
export function showBrowserNotification({ title, body, path, tag }) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return; // the toast is enough
  try {
    const n = new Notification(title, { body, tag, icon: "/favicon.svg", silent: true });
    n.onclick = () => {
      window.focus();
      if (path) openLiveChat(path);
      n.close();
    };
  } catch {
    /* some browsers throw outside secure contexts */
  }
}
