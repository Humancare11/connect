import { onTabMessage, postToTabs } from "../../../utils/crossTab";

// The Live Chat dashboard opens in a new browser tab on every click. This module knows whether a Live Chat tab is
// open (a heartbeat between tabs) and tells the other admin tabs to stay quiet (no sound, no toasts) while it is.
export const LIVECHAT_HOME = "/admin-dashboard/live-chat";
const HEARTBEAT_MS = 5000;
const ALIVE_MS = 12000; // a heartbeat this recent means the Live Chat tab is open

let isLiveChatTab = false; // this tab is the Live Chat tab
let lastHeartbeat = 0; // when another tab last said it is the Live Chat tab
let goTo = null; // moves this (Live Chat) tab to a path without a reload

const validPath = (path) => typeof path === "string" && (path === LIVECHAT_HOME || path.startsWith(`${LIVECHAT_HOME}/`));

onTabMessage((message) => {
  switch (message?.type) {
    case "lc:heartbeat":
      lastHeartbeat = Date.now();
      break;
    case "lc:closed":
      lastHeartbeat = 0;
      break;
    case "lc:who":
      if (isLiveChatTab) postToTabs({ type: "lc:heartbeat" });
      break;
    default:
  }
});
// A freshly opened tab asks right away instead of waiting for the next heartbeat.
postToTabs({ type: "lc:who" });

export const isLiveChatTabOpen = () => isLiveChatTab || Date.now() - lastHeartbeat < ALIVE_MS;

// Sound, toasts and browser notifications: only the Live Chat tab while it is open; any tab when it is not.
export const shouldAlert = () => isLiveChatTab || !isLiveChatTabOpen();

// Called by the Live Chat shell while it is mounted. `navigate(path)` moves the tab to a chat in place.
export function registerLiveChatTab(navigate) {
  isLiveChatTab = true;
  goTo = navigate;
  postToTabs({ type: "lc:heartbeat" });
  const timer = window.setInterval(() => postToTabs({ type: "lc:heartbeat" }), HEARTBEAT_MS);
  const closed = () => postToTabs({ type: "lc:closed" });
  window.addEventListener("pagehide", closed);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("pagehide", closed);
    isLiveChatTab = false;
    goTo = null;
    closed();
  };
}

// True in the Live Chat tab itself: a link to a chat is followed in place there (no reload).
export const inLiveChatTab = () => isLiveChatTab && Boolean(goTo);

// For places that cannot be an anchor (a browser notification's click). Always a new tab (no window features), except
// inside the Live Chat tab itself, where the chat is followed in place.
export function openLiveChat(path = LIVECHAT_HOME) {
  const target = validPath(path) ? path : LIVECHAT_HOME;
  if (inLiveChatTab()) {
    goTo(target);
    window.focus();
    return;
  }
  window.open(target, "_blank");
}
