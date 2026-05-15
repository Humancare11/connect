import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  autoConnect: false,
  path: "/socket.io/",
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  auth: (cb) => {
    const token =
      localStorage.getItem("doctorToken") ||
      localStorage.getItem("token") ||
      "";
    cb({ token });
  },
});

export default socket;