// Sound and browser notifications for live chat admins.
//
//  - A short chime (generated with Web Audio, no file) for new chats, patient messages and queue entries. Always on:
//    there is no mute. Browsers only allow sound after the admin has interacted with the page, so the audio context is
//    created on the first click or key press.
//  - Browser notifications only after the admin clicked "Turn on notifications" AND the browser granted permission.
//    They are shown only while the tab is hidden, and never contain message text or health details: just who and
//    what kind of event ("Emma Wilson: new message").
import { openLiveChat } from "./liveChatTabs";

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

// Sound, the "new website visitor" sound and the spoken alerts are always on: no switch, and any "off" an admin saved
// earlier in this browser is simply never read. Kept as functions so the callers stay as they were.
export const soundEnabled = () => true;
export const visitorSoundEnabled = () => true;
export const voiceEnabled = () => true;

// True once the admin has clicked or typed on the page (the same unlock the chime needs).
export const audioUnlocked = () => Boolean(audio && audio.state === "running");

// The "click anywhere to enable sound" hint follows the audio state: listeners are told after every unlock attempt.
const audioListeners = new Set();
const tellAudioListeners = () => audioListeners.forEach((listener) => listener());
export function subscribeAudioState(listener) {
  audioListeners.add(listener);
  return () => audioListeners.delete(listener);
}

// Creates the audio context on the first real user gesture (autoplay rules).
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const done = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  const unlock = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audio) {
        audio = new Ctx();
        audio.onstatechange = tellAudioListeners;
      }
      const resumed = audio?.resume?.();
      // Stop listening only once the context really runs; a failed attempt gets another chance on the next click.
      if (audio?.state === "running") done();
      else resumed?.then?.(() => audio.state === "running" && done()).catch?.(() => {});
    } catch {
      /* no sound on this browser */
    }
    tellAudioListeners();
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

// Two notes, at the same loud level in every case (0.6 of full scale: the two notes barely overlap, so no clipping).
// Silent if the page was never interacted with, or if audio is unavailable.
export function playChime() {
  if (!soundEnabled() || !audio || audio.state !== "running") return;
  const peak = 0.6;
  try {
    const now = audio.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(peak, now + i * 0.14 + 0.02);
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

// The page is in front of the admin: visible AND focused. Hidden tabs and unfocused windows (another monitor) are not.
export const pageInFront = () =>
  typeof document === "undefined" || (document.visibilityState === "visible" && (typeof document.hasFocus !== "function" || document.hasFocus()));

// `title` and `body` must already be free of message text. `path` is opened when the notification is clicked.
// `requireInteraction` keeps it on screen until dismissed (a patient waiting in the Queue); a `tag` per chat makes a
// newer notification for the same chat replace the old one and `renotify` alerts again.
export function showBrowserNotification({ title, body, path, tag, requireInteraction = false }) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  if (pageInFront()) return; // the toast is enough
  try {
    const n = new Notification(title, { body, tag, renotify: Boolean(tag), requireInteraction, icon: "/favicon.svg", silent: true });
    n.onclick = () => {
      window.focus();
      if (path) openLiveChat(path);
      n.close();
    };
  } catch {
    /* some browsers throw outside secure contexts */
  }
}
