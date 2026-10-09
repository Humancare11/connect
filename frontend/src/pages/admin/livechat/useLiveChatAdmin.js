import { useSyncExternalStore } from "react";
import { hub } from "./liveChatHub";

// State of the shared live-chat connection: visitors, unread counts, agent status, toasts, connection status.
export function useLiveChatAdmin() {
  return useSyncExternalStore(hub.subscribe, hub.getSnapshot, hub.getSnapshot);
}
