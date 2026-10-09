// Test support for the Live Chat tests: a real Socket.IO server with the module mounted, fake sessions and
// stubs for everything that would touch MongoDB or the network. Not a test file (the test glob is *.test.js).
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");
const { io: connectClient } = require("socket.io-client");
const { mountLiveChat } = require("../../services/liveChat");
const { liveChatAgentOnly } = require("../../middleware/verifyToken");

const ROLE_TOKENS = {
  "admin-token": { id: "a1", role: "admin" },
  "super-token": { id: "s1", role: "superadmin" },
  "user-token": { id: "u1", role: "user" },
  "doctor-token": { id: "d1", role: "doctor" },
  "employee-token": { id: "e1", role: "employeeadmin" },
  "payment-token": { id: "p1", role: "paymentadmin" },
  "partner-token": { id: "pt1", role: "partner" },
};

const VISITOR_ID = "visitor-0123456789abcdef";

async function startLiveChatServer({ env = {}, mount = {} } = {}) {
  const identities = { ...ROLE_TOKENS };
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true, credentials: true } });

  // Routes use a header-driven fake session instead of real JWT sessions.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: "t1", role };
    return next();
  };

  const statuses = [];
  const livechat = mountLiveChat({
    app,
    io,
    env: { LIVECHAT_ENABLED: "true", NODE_ENV: "test", ...env },
    validateAccessToken: async (token) => identities[token] || null,
    graceMs: 250,
    revalidateMs: 0, // re-check the session on every event
    agentStore: {
      get: async () => ({ online: false, displayName: "Sam" }),
      setOnline: async (id, online) => {
        statuses.push([id, online]);
        return { online, displayName: "Sam" };
      },
    },
    isIpBlocked: async (ip) => ip === "6.6.6.6",
    lookupLocation: async () => ({ city: "Austin", state: "Texas", country: "United States" }),
    getSettings: async () => ({ key: "default" }),
    guard: [fakeAuth, liveChatAgentOnly],
    ...mount,
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];

  // Resolves with the connected socket, or rejects with the server's connect error message.
  function connect(namespace, { auth = {}, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const socket = connectClient(url + namespace, {
        auth,
        extraHeaders: headers,
        transports: ["websocket"],
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      // The server sends the visitor snapshot as soon as an agent connects, so capture it before "connect".
      socket.snapshotPromise = new Promise((done) => socket.once("visitors:snapshot", done));
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", (err) => {
        socket.close();
        reject(err);
      });
    });
  }

  return {
    app,
    io,
    url,
    livechat,
    identities,
    statuses,
    connect,
    agent: (token = "admin-token") => connect("/livechat-admin", { auth: { token } }),
    visitor: (extra = {}) =>
      connect("/livechat", { auth: { visitorId: VISITOR_ID, consent: true, ...extra } }),
    async close() {
      sockets.forEach((socket) => socket.close());
      livechat?.shutdown();
      io.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const once = (socket, event, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args.length > 1 ? args : args[0]);
    });
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { startLiveChatServer, once, sleep, VISITOR_ID, ROLE_TOKENS };
