// Real-process test stack for the signaling layer: an in-memory MongoDB, the
// actual `node server.js` as a child process, seeded users/appointment/direct
// rooms, and socket.io-client helpers. Nothing here ever touches a real
// database or service - all secrets are random, mail/payment keys are dummies.
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const net = require("node:net");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { io: ioClient } = require("socket.io-client");

const BACKEND_DIR = path.resolve(__dirname, "../..");
const b64 = () => crypto.randomBytes(32).toString("base64");

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function httpStatus(url) {
  try {
    const res = await fetch(url);
    return res.status;
  } catch {
    return 0;
  }
}

async function startStack({ env = {}, graceMs = 1500 } = {}) {
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri("signal_test");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const childEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(port),
    MONGO_URI: mongoUri,
    FRONTEND_URL: "http://localhost:5173",
    JWT_SECRET: crypto.randomBytes(48).toString("hex"),
    CHAT_ENCRYPTION_KEY: b64(),
    PHI_ENCRYPTION_KEY: b64(),
    EMAIL_ENCRYPTION_KEY: b64(),
    DIRECT_PIN_ENC_KEY: crypto.randomBytes(32).toString("hex"),
    DIRECT_SESSION_SECRET: crypto.randomBytes(24).toString("hex"),
    RTC_TURN_URLS: "turn:127.0.0.1:3478?transport=udp",
    TURN_STATIC_AUTH_SECRET: "signal-test-turn-secret",
    STRIPE_SECRET_KEY: "sk_test_dummy_0000000000",
    STRIPE_WEBHOOK_SECRET: "whsec_dummy",
    AWS_S3_BUCKET: "dummy-bucket",
    AWS_REGION: "us-east-1",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1",
    SOCKET_LEAVE_GRACE_MS: String(graceMs),
    DIRECT_ROOM_LEAVE_GRACE_MS: "5000",
    ...env,
  };
  // Never let a developer's real .env values leak in through the parent env.
  for (const key of ["MONGODB_URI", "DATABASE_URL"]) delete childEnv[key];

  const logs = [];
  let child = null;

  async function startBackend() {
    child = spawn(process.execPath, ["server.js"], { cwd: BACKEND_DIR, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => logs.push(String(d)));
    child.stderr.on("data", (d) => logs.push(String(d)));
    child.exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if ((await httpStatus(`${baseUrl}/api/rtc/ice-servers`)) === 401) return;
      await sleep(250);
    }
    throw new Error("backend did not start:\n" + logs.join("").slice(-2000));
  }

  async function stopBackend() {
    if (!child) return;
    const c = child;
    child = null;
    c.kill("SIGKILL");
    await c.exited;
  }

  // ---- seed (own connection, then disconnect so the server owns the DB)
  const ids = {};
  const creds = {
    doctor: { email: `doctor-${crypto.randomBytes(4).toString("hex")}@signal.invalid`, password: `Dd1!${crypto.randomBytes(8).toString("hex")}` },
    patient: { email: `patient-${crypto.randomBytes(4).toString("hex")}@signal.invalid`, password: `Pp1!${crypto.randomBytes(8).toString("hex")}` },
    other: { email: `other-${crypto.randomBytes(4).toString("hex")}@signal.invalid`, password: `Oo1!${crypto.randomBytes(8).toString("hex")}` },
  };
  process.env.JWT_SECRET ||= childEnv.JWT_SECRET;
  // Models read crypto keys at require-time in some modules - give this process the same ones.
  for (const k of ["CHAT_ENCRYPTION_KEY", "PHI_ENCRYPTION_KEY", "EMAIL_ENCRYPTION_KEY", "DIRECT_PIN_ENC_KEY", "DIRECT_SESSION_SECRET"]) {
    process.env[k] = childEnv[k];
  }
  const Doctor = require(path.join(BACKEND_DIR, "models/Doctor.js"));
  const User = require(path.join(BACKEND_DIR, "models/User.js"));
  const Appointment = require(path.join(BACKEND_DIR, "models/Appointment.js"));
  const DirectVideoRoom = require(path.join(BACKEND_DIR, "models/DirectVideoRoom.js"));

  await mongoose.connect(mongoUri);
  const doctor = await Doctor.create({ name: "Signal Doctor", email: creds.doctor.email, password: creds.doctor.password, isEnrolled: true });
  const patient = await User.create({ name: "Signal Patient", email: creds.patient.email, password: await bcrypt.hash(creds.patient.password, 10), role: "user" });
  const other = await User.create({ name: "Signal Other", email: creds.other.email, password: await bcrypt.hash(creds.other.password, 10), role: "user" });
  ids.doctorId = String(doctor._id);
  ids.patientId = String(patient._id);
  ids.otherId = String(other._id);

  async function makeAppointment(status = "confirmed") {
    const now = new Date();
    const appt = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      category: "General",
      specialty: "General Practice",
      condition: "signal test",
      patientDetails: { firstName: "S", lastName: "P", email: creds.patient.email },
      date: now.toISOString().slice(0, 10),
      time: "10:00",
      appointmentDateTimeUtc: now,
      status,
      paymentStatus: "paid",
    });
    return String(appt._id);
  }

  async function makeDirectRoom({ status = "active", expiresInMs = 6 * 3600 * 1000 } = {}) {
    const room = await DirectVideoRoom.create({
      roomId: crypto.randomBytes(16).toString("hex"),
      createdBy: patient._id,
      createdByName: "Signal Patient",
      note: "signal test",
      status,
      expiresAt: new Date(Date.now() + expiresInMs),
    });
    return room.roomId;
  }

  ids.appointmentId = await makeAppointment("confirmed");
  ids.directRoomId = await makeDirectRoom();

  await startBackend();

  async function login(role) {
    const url = role === "doctor" ? "/api/doctor/login" : "/api/auth/login";
    const res = await fetch(baseUrl + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds[role]),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.accessToken) throw new Error(`${role} login failed: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return { accessToken: body.accessToken, refreshToken: body.refreshToken };
  }

  const tokens = { doctor: await login("doctor"), patient: await login("patient"), other: await login("other") };

  const sockets = new Set();

  function connect({ token, reconnection = false, extra = {} } = {}) {
    const socket = ioClient(baseUrl, {
      path: "/socket.io/",
      transports: ["websocket"],
      reconnection,
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
      auth: token ? { token } : {},
      forceNew: true,
      ...extra,
    });
    sockets.add(socket);
    socket.events = [];
    socket.onAny((event, ...args) => socket.events.push({ event, args, at: Date.now() }));
    // onAny does not see the reserved events
    socket.on("disconnect", (reason) => socket.events.push({ event: "disconnect", args: [reason], at: Date.now() }));
    return new Promise((resolve, reject) => {
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
      setTimeout(() => reject(new Error("socket connect timeout")), 10_000);
    });
  }

  function waitFor(socket, event, { timeout = 5000, predicate = () => true } = {}) {
    const existing = socket.events.find((e) => e.event === event && predicate(...e.args));
    if (existing) return Promise.resolve(existing.args[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`timed out waiting for "${event}" (${timeout}ms). Saw: ${socket.events.map((e) => e.event).join(", ")}`));
      }, timeout);
      function handler(...args) {
        if (!predicate(...args)) return;
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(args[0]);
      }
      socket.on(event, handler);
    });
  }

  const count = (socket, event) => socket.events.filter((e) => e.event === event).length;

  async function joinAppointment(socket, role, { appointmentId = ids.appointmentId, tokenOverride } = {}) {
    const userId = role === "doctor" ? ids.doctorId : role === "patient" ? ids.patientId : ids.otherId;
    const token = tokenOverride === undefined ? tokens[role]?.accessToken : tokenOverride;
    const apptRole = role === "doctor" ? "doctor" : "user";
    socket.emit("user-online", { userId, role: apptRole, token });
    socket.emit("join-appointment-room", { appointmentId, userId, role: apptRole, token, capabilities: { peerRebuild: true } });
  }

  async function alive() {
    return (await httpStatus(`${baseUrl}/api/rtc/ice-servers`)) === 401;
  }

  async function stop() {
    for (const s of sockets) s.close();
    sockets.clear();
    await stopBackend();
    await mongoose.disconnect().catch(() => {});
    await mongod.stop().catch(() => {});
  }

  return {
    baseUrl,
    ids,
    creds,
    tokens,
    logs: () => logs.join(""),
    connect,
    waitFor,
    count,
    sleep,
    joinAppointment,
    makeAppointment,
    makeDirectRoom,
    alive,
    login,
    stop,
    stopBackend,
    startBackend,
    killMongo: () => mongod.stop(),
    models: { Appointment, DirectVideoRoom, User, Doctor },
    get childPid() {
      return child?.pid;
    },
    get childExited() {
      return child?.exited;
    },
  };
}

module.exports = { startStack, sleep };
