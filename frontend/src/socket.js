import { io } from "socket.io-client";

const parseTransports = (value) => {
  const transports = String(value || "")
    .split(",")
    .map((transport) => transport.trim())
    .filter(Boolean);
  return transports.length ? transports : ["polling", "websocket"];
};

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

const socket = io(socketUrl, {
  autoConnect: false,
  path: "/socket.io/",
  transports: parseTransports(import.meta.env.VITE_SOCKET_TRANSPORTS),
  reconnection: true,
  timeout: Number(import.meta.env.VITE_SOCKET_TIMEOUT_MS || 20000),
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: Number(import.meta.env.VITE_SOCKET_RECONNECTION_ATTEMPTS || 10),
  randomizationFactor: 0.5,
  withCredentials: true,
});

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
