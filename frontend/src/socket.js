import { io } from "socket.io-client";
import { getUserAuthToken } from "./api";

const parseTransports = (value) => {
  const transports = String(value || "")
    .split(",")
    .map((transport) => transport.trim())
    .filter(Boolean);
  return transports.length ? transports : ["polling", "websocket"];
};

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Which role (doctor/user) this socket should authenticate as. Set
// explicitly by the page that owns the connection via setSocketAuthRole
// below, rather than inferred from api.js's `activeAuthRole` — that's a
// single global last-writer-wins value driven by whichever role's REST
// call most recently ran anywhere in the app, which is not necessarily the
// role this socket's owning page actually needs (a browser can have both a
// doctor and a user session stored at once).
let currentAuthRole = "";

const socket = io(socketUrl, {
  autoConnect: false,
  path: "/socket.io/",
  transports: parseTransports(import.meta.env.VITE_SOCKET_TRANSPORTS),
  reconnection: true,
  timeout: Number(import.meta.env.VITE_SOCKET_TIMEOUT_MS || 20000),
  reconnectionDelay: Number(import.meta.env.VITE_SOCKET_RECONNECTION_DELAY_MS || 1000),
  reconnectionDelayMax: Number(import.meta.env.VITE_SOCKET_RECONNECTION_DELAY_MAX_MS || 30000),
  reconnectionAttempts: Infinity,
  randomizationFactor: 0.5,
  withCredentials: true,
  // Send the current access token (if stored) in the handshake auth payload so
  // the server can authenticate sockets when cookies are not available.
  auth: {
    token: getUserAuthToken(),
  },
});

// Called by the page that owns this connection (currently VideoCall.jsx) as
// soon as it knows which role the call is for, and read again on every
// reconnect below — keeps the handshake token aligned with the actual
// caller instead of api.js's ambient `activeAuthRole`. Falls back to that
// same ambient behavior (via getUserAuthToken's own default) if this is
// never called, so any other future caller of this shared socket is
// unaffected.
export function setSocketAuthRole(role) {
  currentAuthRole = role || "";
  socket.auth = { token: getUserAuthToken(currentAuthRole || undefined) };
}

if (!socket.__hcDiagnosticsInstalled) {
  socket.__hcDiagnosticsInstalled = true;

  socket.on("connect", () => {
    console.info("[socket] connected", {
      id: socket.id,
      transport: socket.io.engine?.transport?.name,
      url: socketUrl,
    });

    if (socket.io.engine && !socket.io.engine.__hcUpgradeDiagnosticsInstalled) {
      socket.io.engine.__hcUpgradeDiagnosticsInstalled = true;
      socket.io.engine.on("upgrade", (transport) => {
        console.info("[socket] transport_upgraded", { transport: transport?.name });
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.warn("[socket] disconnected", { reason });
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error", {
      message: err?.message,
      description: err?.description,
      context: err?.context,
    });
  });

  socket.io.on("reconnect_attempt", (attempt) => {
    // The token may have been refreshed (or expired) since the initial
    // handshake. socket.auth is only read at the moment a connection
    // attempt is made, so updating it here ensures every reconnect
    // (network change, tab resume, etc.) authenticates with a current
    // token for whichever role this socket was last explicitly set to via
    // setSocketAuthRole, instead of replaying whatever was valid at module
    // load time or drifting to api.js's ambient active role.
    socket.auth = { token: getUserAuthToken(currentAuthRole || undefined) };
    console.info("[socket] reconnect_attempt", { attempt });
  });

  socket.io.on("reconnect", (attempt) => {
    console.info("[socket] reconnected", {
      attempt,
      transport: socket.io.engine?.transport?.name,
    });
  });

  socket.io.on("reconnect_failed", () => {
    console.error("[socket] reconnect_failed");
  });
}

export default socket;