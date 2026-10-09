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
// Real ObjectId-shaped ids: assignees and read markers are stored as ObjectIds.
const AGENT_A = "64b000000000000000000a01";
const AGENT_B = "64b000000000000000000b02";
const SUPER_S = "64b000000000000000000c03";

async function startLiveChatServer({ env = {}, mount = {} } = {}) {
  const identities = { ...ROLE_TOKENS };
  const app = express();
  app.set("trust proxy", 1);
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true, credentials: true } });

  // Routes use a header-driven fake session instead of real JWT sessions.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: req.headers["x-test-user"] || "t1", role };
    return next();
  };

  const statuses = [];
  const agentNames = {}; // userId -> display name shown to patients
  const emails = []; // every follow-up email the module "sent" (no real mail in tests)
  const store = new Map(); // fake file store: key -> { buffer, contentType }
  const presigned = []; // every presigned URL the module issued
  const failures = { put: false, presign: false, mail: false }; // tests flip these to make storage / mail fail
  const livechat = mountLiveChat({
    app,
    io,
    env: { LIVECHAT_ENABLED: "true", NODE_ENV: "test", ...env },
    validateAccessToken: async (token) => identities[token] || null,
    graceMs: 250,
    revalidateMs: 0, // re-check the session on every event
    agentStore: {
      get: async () => ({ online: false, displayName: "Sam" }),
      displayName: async (id) => agentNames[id] || "",
      setOnline: async (id, online) => {
        statuses.push([id, online]);
        return { online, displayName: "Sam" };
      },
    },
    isIpBlocked: async (ip) => ip === "6.6.6.6",
    lookupLocation: async () => ({ city: "Austin", state: "Texas", country: "United States" }),
    getSettings: async () => ({ key: "default" }),
    sendMail: async (mail) => {
      if (failures.mail) throw Object.assign(new Error(`550 mailbox unavailable for ${mail.to}`), { code: 550 });
      emails.push(mail);
    },
    fileStore: {
      put: async (key, buffer, contentType) => {
        if (failures.put) throw new Error("AccessDenied: bucket secret-bucket-name");
        store.set(key, { buffer, contentType });
      },
      presign: async (key, opts) => {
        if (failures.presign) throw new Error("AccessDenied: bucket secret-bucket-name");
        presigned.push({ key, ...opts });
        return `https://files.test/${key}?sig=fake`;
      },
      remove: async (key) => void store.delete(key),
    },
    sessionCheckMs: 100,
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
      // Everything the server sends, including what arrives right at connect, before a test can attach listeners.
      socket.events = [];
      socket.onAny((event, payload) => socket.events.push([event, payload]));
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
    agentNames,
    emails,
    store,
    presigned,
    failures,
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

// ── Chat tests: real in-memory MongoDB, scripted AI, fake Turnstile ───────────────────────────────────────────

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { dayKey } = require("../../services/liveChat/limits");

const ALL_DAY = { open: "00:00", close: "23:59", enabled: true };
const PASS = (req, res, next) => next();

// Scripted AI: each call takes the next scripted result (or the default "ok" answer) and records what it was asked.
function scriptedAi(script = []) {
  const queue = [...script];
  const suggestions = [];
  const ai = {
    calls: [],
    queue,
    suggestions,
    suggestCalls: [],
    async suggestReply(input) {
      ai.suggestCalls.push(input);
      return suggestions.shift() || { ok: true, reply: "Thanks for waiting. Let me check that for you.", usage: { inputTokens: 800, cachedInputTokens: 0, outputTokens: 20, costUsd: 0.0001 } };
    },
    async generateReply(input) {
      ai.calls.push(input);
      const next = queue.shift();
      if (typeof next === "function") return next(); // lets a test hold the reply back
      return (
        next || {
          ok: true,
          reply: "A general consultation is $49.",
          handoff: false,
          handoffReason: "none",
          topic: "pricing",
          usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 50, costUsd: 0.000125 },
        }
      );
    },
  };
  return ai;
}

async function startChatServer({ ai = scriptedAi(), env = {}, mount = {} } = {}) {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const models = {
    LcVisitor: require("../../models/LcVisitor"),
    LcConversation: require("../../models/LcConversation"),
    LcMessage: require("../../models/LcMessage"),
    LcSettings: require("../../models/LcSettings"),
    LcAiUsage: require("../../models/LcAiUsage"),
    LcPageVisit: require("../../models/LcPageVisit"),
    LcCannedReply: require("../../models/LcCannedReply"),
    LcFile: require("../../models/LcFile"),
    LcBlockedIp: require("../../models/LcBlockedIp"),
  };
  await Promise.all(Object.values(models).map((m) => m.init()));
  await require("../../services/liveChat").seedLiveChatDefaults({ LIVECHAT_ENABLED: "true", NODE_ENV: "test" });
  const settingsDoc = await models.LcSettings.getSettings();
  // Support hours: open all day, so tests do not depend on when they run.
  settingsDoc.supportHours.days.forEach((d) => Object.assign(d, ALL_DAY));
  await settingsDoc.save();

  const lc = await startLiveChatServer({
    env: { JWT_SECRET: "test-secret", ...env },
    mount: {
      ai,
      settingsCacheMs: 0,
      publicLimiters: { contact: PASS, config: PASS, upload: PASS }, // the per-IP route limiters are not under test
      verifyTurnstile: async ({ token }) => (token === "good-token" ? { ok: true } : { ok: false, reason: "failed" }),
      ...mount,
    },
  });

  let seq = 0;
  const api = {
    ...lc,
    ai,
    models,
    mongod,
    async setSettings(patch) {
      await models.LcSettings.updateOne({ key: "default" }, { $set: patch });
    },
    async post(path, body, headers = {}) {
      const res = await fetch(`${lc.url}/api/livechat${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    // Uploads a file as a patient (multipart). Returns { status, body }.
    async upload(token, { name, buffer, type }, headers = {}) {
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: type || "application/octet-stream" }), name);
      const res = await fetch(`${lc.url}/api/livechat/upload`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}`, ...headers } : headers,
        body: form,
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    // A tracking-only socket (cookies accepted, no chat token), like a visitor who never opened the widget.
    trackerSocket: (visitorId, headers = {}) =>
      lc.connect("/livechat", { auth: { visitorId, consent: true }, headers }),
    // Fills the contact form like a real visitor and returns { visitorId, token }.
    async submitContact(extra = {}, headers = {}) {
      seq += 1;
      const res = await api.post(
        "/contact",
        {
          name: "Emma Wilson",
          email: `emma${seq}@example.com`,
          phone: "",
          consent: true,
          turnstileToken: "good-token",
          ...extra,
        },
        headers
      );
      return { ...res.body, status: res.status };
    },
    // A chat socket for a visitor that has submitted the form.
    chatSocket: (token, extra = {}, headers = {}) => lc.connect("/livechat", { auth: { chatToken: token, ...extra }, headers }),
    // emit with an acknowledgement
    call: (socket, event, payload) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ack for ${event}`)), 3000);
        const done = (reply) => {
          clearTimeout(timer);
          resolve(reply);
        };
        if (payload === undefined) socket.emit(event, done);
        else socket.emit(event, payload, done);
      }),
    // Calls the agent REST API as a given admin. Returns { status, body }.
    async rest(method, path, { user = AGENT_A, role = "admin", body } = {}) {
      const res = await fetch(`${lc.url}/api/admin/livechat${path}`, {
        method,
        headers: { "content-type": "application/json", "x-test-role": role, "x-test-user": user },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
    // A signed-in, online agent, so the team counts as available.
    async onlineAgent(token = "admin-token") {
      const socket = await lc.agent(token);
      await socket.snapshotPromise;
      await api.call(socket, "agent:status", { online: true });
      return socket;
    },
    async close() {
      await lc.close();
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
  return api;
}

// Minimal real files (the module reads the actual bytes to find the type).
const FILES = {
  png: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
  pdf: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"),
  jpg: Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=", "base64"),
  exe: Buffer.from("MZ\x90\x00\x03\x00\x00\x00 this is not a pdf", "binary"),
  html: Buffer.from("<html><script>alert(1)</script></html>"),
};

module.exports = { FILES, startLiveChatServer, startChatServer, scriptedAi, once, sleep, dayKey, VISITOR_ID, ROLE_TOKENS, AGENT_A, AGENT_B, SUPER_S };
