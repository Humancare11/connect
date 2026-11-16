import { useEffect } from "react";
import { io } from "socket.io-client";
import { getUserAuthToken } from "../../../api";
import { setLivePush } from "./emailUtils";

const LIST_REFRESH_DELAY_MS = 400;

const parseTransports = (value) => {
  const list = String(value || "").split(",").map((t) => t.trim()).filter(Boolean);
  return list.length ? list : ["polling", "websocket"];
};

const adminToken = () => getUserAuthToken("admin") || getUserAuthToken("superadmin") || "";

// Live updates for the Email pages: the server says "mail changed in mailbox X" (no mail data) and
// we ask the normal API again, so the open list and the unread counts update without waiting for
// the next poll. It has its own small connection, closed when the Email pages are left, so it never
// touches the shared socket the video call pages use. While it is working the polls slow down
// (see pollMs in emailUtils); if it is not (offline, refused, blocked) they stay at the normal pace.
export function useEmailLive(queryClient) {
  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(url, {
      path: "/socket.io/",
      transports: parseTransports(import.meta.env.VITE_SOCKET_TRANSPORTS),
      withCredentials: true,
      reconnection: true,
      reconnectionDelayMax: 30000,
      // A function, so every (re)connect sends the current token.
      auth: (cb) => cb({ token: adminToken() }),
    });

    let timer = null;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["email", "mailboxes"] });
        queryClient.invalidateQueries({ queryKey: ["email", "list"] });
      }, LIST_REFRESH_DELAY_MS);
    };

    socket.on("connect", () => socket.emit("email-watch", { token: adminToken() }));
    socket.on("email-watching", () => {
      setLivePush(true);
      refresh(); // anything that arrived while we were not connected
    });
    socket.on("email-watch-denied", () => setLivePush(false));
    socket.on("disconnect", () => setLivePush(false));
    socket.on("connect_error", () => setLivePush(false));
    socket.on("email-changed", refresh);

    return () => {
      clearTimeout(timer);
      setLivePush(false);
      socket.off();
      socket.disconnect();
    };
  }, [queryClient]);
}
