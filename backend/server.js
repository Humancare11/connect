// ── Load the correct .env file based on NODE_ENV ──
// "npm run start:prod" sets NODE_ENV=production before this runs,
// so we load .env.production; dev/nodemon falls back to .env.
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : process.env.NODE_ENV === "uat"
        ? ".env.uat"
        : ".env"
  ),
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomInt, randomUUID, randomBytes } = require("crypto");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
const Doctor = require("./models/Doctor");
const Session = require("./models/Session");
const RevokedToken = require("./models/RevokedToken");
const ChatMessage = require("./models/ChatMessage");
const Question = require("./models/Question");
const EmployeeTask = require("./models/EmployeeTask");
const DirectVideoRoom = require("./models/DirectVideoRoom");
const { verifyToken, verifyAdminToken, adminOnly } = require("./middleware/verifyToken");
const { recordActivity } = require("./utils/activityLogger");
const { findUploadInS3, streamUploadFromS3, keyFromStoredValue } = require("./utils/uploadStorage");
const { ensureBucketCors } = require("./config/s3");
const { encryptChatText, decryptChatText } = require("./utils/chatCrypto");
const { recordSecurityEvent } = require("./utils/securityMonitor");
const { makeSocketLimiter } = require("./utils/socketRateLimit");
const { scheduleRetentionCleanup } = require("./jobs/retentionJobs");
const { ensureDefaults: ensureRetentionDefaults } = require("./controllers/retentionController");
const { seedCategoryPricing } = require("./models/CategoryPricing");
// const Anthropic = require("@anthropic-ai/sdk");
// const Groq = require("groq-sdk");

const app = express();


// const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// const client = new Groq({ apiKey: process.env.GROQ_API_KEY });


// Trust the first reverse proxy (Nginx, Apache, Cloudflare).
// Without this, req.protocol returns "http" even behind HTTPS termination.
app.set("trust proxy", 1);

// Creates a default account if it doesn't already exist. In development
// this uses a fixed, well-known password for local convenience. Outside
// development a random password is generated and printed to the server
// log once — a fresh/reset database must never end up with a hardcoded,
// publicly-documented admin login.
async function seedDefaultAccount({ email, name, role, devPassword, isDev }) {
  const existing = await User.findOne({ email });
  if (existing) return;

  const password = isDev ? devPassword : randomBytes(18).toString("base64url");
  const hashed = await bcrypt.hash(password, 10);

  await User.create({ name, email, password: hashed, role });

  if (!isDev) {
    console.warn(
      `[startup] No "${role}" account existed — created ${email} with a generated password (shown once, not recoverable): ${password}`
    );
    console.warn(`[startup] Log in and change this password immediately.`);
  }
}

// DB connect + auto-seed admin
const startServer = async () => {
  await connectDB();

  const isDev = process.env.NODE_ENV === "development";

  await seedDefaultAccount({
    email: "admin@gmail.com",
    name: "Admin",
    role: "admin",
    devPassword: "admin123",
    isDev,
  });

  await seedDefaultAccount({
    email: "superadmin@humancare.com",
    name: "Super Admin",
    role: "superadmin",
    devPassword: "superadmin123",
    isDev,
  });

  // Backfill 5-digit doctorId for any doctor that doesn't have one yet
  const doctorsWithoutId = await Doctor.find({
    $or: [{ doctorId: { $exists: false } }, { doctorId: null }],
  });
  for (const doc of doctorsWithoutId) {
    let newId;
    let taken = true;
    while (taken) {
      newId = randomInt(10000, 100000);
      taken = await Doctor.exists({ doctorId: newId });
    }
    await Doctor.findByIdAndUpdate(doc._id, { doctorId: newId });
  }

  await seedCategoryPricing();
  await ensureRetentionDefaults();
  scheduleRetentionCleanup();

  await ensureBucketCors(allowedOrigins);
};

function normalizeOrigin(value) {
  const origin = String(value || "").trim().replace(/\/+$/, "");
  if (!origin) return "";
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

// Allowed Origins
const allowedOrigins = Array.from(
  new Set([
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
    "https://humancareconnect.co",
    "https://www.humancareconnect.co",
    "https://uat.humancareconnect.co",
    "http://localhost:5173",
    "http://localhost:3000",
  ].filter(Boolean))
);

function isLocalDevOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// Flutter web's dev server (flutter run -d chrome) binds a fresh random
// port every session, so it can never be tracked by a fixed allow-list
// entry the way the React app's stable Vite port (5173) can. Only relax
// this outside production — the UAT backend is shared by every
// developer's local web build, but the real deployed sites must keep the
// strict explicit allow-list.
function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.indexOf(normalized) !== -1) return true;
  return process.env.NODE_ENV !== "production" && isLocalDevOrigin(normalized);
}

// A missing JWT_SECRET must never silently degrade into a hardcoded/weak
// fallback — every access/refresh token in this app (verifyToken.js,
// server.js's socket auth) is signed and verified with this single secret,
// so an absent or guessable value means anyone can forge an admin token.
// Same fail-fast requirement as the TURN vars below, for the same reason:
// this failure mode is otherwise invisible until it's actively exploited.
const MIN_JWT_SECRET_LENGTH = 32;
const WEAK_JWT_SECRETS = new Set([
  "secret",
  "password",
  "123456",
  "jwt_secret",
  "fallback_secret_not_secure",
  "default",
  "test",
  "changeme",
]);

function validateRuntimeConfig() {
  const required = ["JWT_SECRET", "MONGO_URI"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[config] FATAL: Missing required environment variable(s): ${missing.join(", ")}`);
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    console.error(
      `[config] FATAL: JWT_SECRET is too short (${jwtSecret.length} chars, minimum ${MIN_JWT_SECRET_LENGTH}). ` +
        "Generate one with: openssl rand -base64 64"
    );
    process.exit(1);
  }
  if (WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
    console.error("[config] FATAL: JWT_SECRET is a well-known weak/default value. Generate a strong secret with: openssl rand -base64 64");
    process.exit(1);
  }

  // TURN is required (not just STUN) because STUN alone cannot relay media
  // for peers behind symmetric/restrictive NAT — see backend/routes/rtc.js
  // and backend/utils/turnCredentials.js for how these are consumed. Unlike
  // JWT_SECRET/MONGO_URI above, missing TURN config doesn't crash on its own
  // request path (it silently degrades to STUN-only ICE servers, logged once
  // as a console.warn deep in routes/rtc.js), so a misconfiguration here
  // would otherwise stay invisible until a real user's call fails on a
  // restrictive network. Fail fast at boot instead.
  const requiredTurn = ["RTC_TURN_URLS", "TURN_STATIC_AUTH_SECRET"];
  const missingTurn = requiredTurn.filter((key) => !process.env[key]);
  if (missingTurn.length) {
    console.error(
      `[config] Missing required TURN environment variable(s): ${missingTurn.join(", ")}. ` +
        "The primary TURN region needs both RTC_TURN_URLS (relay URL(s), comma-separated) and " +
        "TURN_STATIC_AUTH_SECRET (must match the coturn server's static-auth-secret) to mint " +
        "working ICE credentials. Set them in the environment (see backend/.env) before starting."
    );
    process.exit(1);
  }

  // The optional 2nd TURN region (see backend/.env.production) is only
  // useful if both of its vars are set together — one without the other is
  // almost certainly a partial/forgotten config rather than an intentional
  // single-var setup, so warn (not fail) to surface it without blocking boot.
  const turnRegion2Urls = Boolean(process.env.RTC_TURN_URLS_2);
  const turnRegion2Secret = Boolean(process.env.TURN_STATIC_AUTH_SECRET_2);
  if (turnRegion2Urls !== turnRegion2Secret) {
    console.warn(
      "[config] RTC_TURN_URLS_2 and TURN_STATIC_AUTH_SECRET_2 must both be set to enable the " +
        "secondary TURN region; only one is set, so it will be ignored."
    );
  }

  if (process.env.NODE_ENV === "uat" && !process.env.HTTPS) {
    console.warn("[config] UAT should set HTTPS=true so auth cookies use SameSite=None; Secure.");
  }

  if (!process.env.FRONTEND_URL && !process.env.CORS_ALLOWED_ORIGINS) {
    console.warn("[config] FRONTEND_URL/CORS_ALLOWED_ORIGINS not set; using built-in origin fallbacks only.");
  }

  console.info("[config] Runtime", {
    nodeEnv: process.env.NODE_ENV || "development",
    https: process.env.HTTPS || "false",
    allowedOrigins,
  });
}

const awsS3Region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const s3AssetSources = [
  process.env.AWS_S3_PUBLIC_BASE_URL,
  process.env.S3_PUBLIC_BASE_URL,
  process.env.AWS_S3_BUCKET
    ? `https://${process.env.AWS_S3_BUCKET}.s3.${awsS3Region}.amazonaws.com`
    : null,
  "https://*.s3.amazonaws.com",
].filter(Boolean);

app.use(
  helmet({
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:", ...s3AssetSources],
        connectSrc: ["'self'", ...allowedOrigins, ...s3AssetSources],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  })
);

app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  next();
});

// CORS Config
const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Role"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(require("cookie-parser")());

// Every response carries an X-Request-Id so a user-reported error (or a
// support ticket quoting the header) can be traced back to the matching
// server-side log line. Requests over 1s are also logged here so slow
// endpoints surface without needing a full APM setup.
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(
        `[perf] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms (${req.id})`
      );
    }
  });
  next();
});

// API responses (session data, PHI, tokens) must never be cached by browsers,
// proxies, or CDNs — a shared/back-forward cache serving a previous user's
// response to the next visitor on a shared machine is a real PHI leak path in
// a healthcare app. Static assets aren't under /api and are unaffected.
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const contactRoutes = require("./routes/contact");
app.use("/api/contact", contactRoutes);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uploadAccessPath(value) {
  const key = keyFromStoredValue(value);
  if (!key) return null;
  return `/api/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function requestIdentities(req) {
  const identities = [];
  const seen = new Set();
  const add = async (identity) => {
    if (!identity?.id || !identity?.role) return;
    if (identity.sid) {
      const session = await Session.findById(identity.sid).select("userId role revokedAt").lean();
      if (!session || session.revokedAt) return;
      if (session.userId !== String(identity.id) || session.role !== identity.role) return;
    }
    const key = `${identity.role}:${identity.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    identities.push(identity);
  };

  await add(req.user);

  for (const cookieName of ["userToken", "doctorToken", "adminToken"]) {
    const token = req.cookies?.[cookieName];
    if (!token) continue;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== "refresh") await add(decoded);
    } catch {
      // Ignore stale cookies.
    }
  }

  return identities;
}

async function canAccessUpload(req, filename) {
  const identities = await requestIdentities(req);

  const superadmin = identities.find((identity) => identity.role === "superadmin");
  if (superadmin) return { allowed: true, reason: "superadmin", identity: superadmin };

  const admin = identities.find((identity) => ["admin", "paymentadmin"].includes(identity.role));
  if (admin) return { allowed: true, reason: "admin", identity: admin };

  const upload = await findUploadInS3(filename);
  if (upload?.metadata?.uploadedBy) {
    const uploader = identities.find((identity) => String(identity.id) === String(upload.metadata.uploadedBy));
    if (uploader) return { allowed: true, reason: "uploader", identity: uploader };
  }

  const fileUrlPattern = new RegExp(`(?:^|/)${escapeRegExp(filename)}$`);

  const employeeAdminIdentity = identities.find((identity) => identity.role === "employeeadmin");
  if (employeeAdminIdentity) {
    const employeeTask = await EmployeeTask.findOne({
      $or: [
        { "attachments.key": filename },
        { "attachments.url": fileUrlPattern },
        { "subtasks.attachments.key": filename },
        { "subtasks.attachments.url": fileUrlPattern },
      ],
    })
      .select("assignedTo createdBy")
      .lean();

    if (employeeTask) {
      const identityId = String(employeeAdminIdentity.id);
      const allowed =
        String(employeeTask.assignedTo) === identityId || String(employeeTask.createdBy) === identityId;
      return {
        allowed,
        reason: allowed ? "employee_task" : "not_assigned",
        identity: employeeAdminIdentity,
      };
    }
  }
  const appointment = await Appointment.findOne({
    $or: [
      { "medicalReports.url": fileUrlPattern },
      { "medicalReports.key": fileUrlPattern },
    ],
  })
    .select("patientId doctorId medicalReports")
    .lean();

  let accessAppointment = appointment;
  if (!accessAppointment) {
    const chatMessage = await ChatMessage.findOne({ fileUrl: fileUrlPattern })
      .select("appointmentId fileUrl")
      .lean();
    if (chatMessage?.appointmentId) {
      accessAppointment = await Appointment.findById(chatMessage.appointmentId)
        .select("patientId doctorId")
        .lean();
    }
  }

  if (!accessAppointment) {
    const question = await Question.findOne({
      $or: [
        { "attachments.url": fileUrlPattern },
        { "attachments.key": fileUrlPattern },
      ],
    })
      .select("user assignedDoctorId")
      .lean();

    if (question) {
      const matchedQuestionUser = identities.find((identity) => {
        const identityId = String(identity.id);
        return (
          (identity.role === "user" && String(question.user) === identityId) ||
          (identity.role === "doctor" && String(question.assignedDoctorId) === identityId)
        );
      });

      return {
        allowed: Boolean(matchedQuestionUser),
        reason: matchedQuestionUser?.role === "user" ? "question_owner" : matchedQuestionUser?.role === "doctor" ? "assigned_doctor" : "not_assigned",
        identity: matchedQuestionUser,
        appointmentId: null,
        patientId: question.user,
      };
    }
  }

  if (!accessAppointment) return { allowed: false, reason: "unassigned" };

  const matched = identities.find((identity) => {
    const identityId = String(identity.id);
    return (
      (identity.role === "user" && String(accessAppointment.patientId) === identityId) ||
      (identity.role === "doctor" && String(accessAppointment.doctorId) === identityId)
    );
  });

  return {
    allowed: Boolean(matched),
    reason: matched?.role === "user" ? "patient" : matched?.role === "doctor" ? "doctor" : "not_assigned",
    identity: matched,
    appointmentId: accessAppointment._id,
    patientId: accessAppointment.patientId,
  };
}

async function serveProtectedUpload(req, res, next) {
  // Extract the full key/path for the requested upload. Support both
  // single-segment param routes and multi-segment keys embedded in the URL.
  const maybeParam = req.params && req.params.filename;
  const fromPath = String(req.path || "").replace(/^\/api\/uploads\//, "");
  const key = decodeURIComponent((maybeParam || fromPath || "").replace(/^\/+|\/+$/g, ""));

  if (!key) {
    await recordActivity(req, {
      action: "MEDICAL_FILE_ACCESS_DENIED",
      resource: "MedicalFile",
      resourceId: null,
      success: false,
      details: { reason: "invalid_key" },
    });
    return res.status(400).json({ msg: "Invalid upload key." });
  }

  try {
    const access = await canAccessUpload(req, key);
    await recordActivity(req, {
      action: access.allowed ? "MEDICAL_FILE_ACCESS" : "MEDICAL_FILE_ACCESS_DENIED",
      resource: "MedicalFile",
      resourceId: key,
      patientId: access.patientId || null,
      success: access.allowed,
      userId: access.identity?.id || req.user?.id,
      userEmail: access.identity?.email || req.user?.email || "",
      userRole: access.identity?.role || req.user?.role || "anonymous",
      details: {
        appointmentId: access.appointmentId || null,
        reason: access.reason,
      },
    });

    if (!access.allowed) {
      return res.status(403).json({ msg: "Access denied." });
    }

    const hour = new Date().getHours();
    if (hour < 6 || hour >= 22) {
      await recordSecurityEvent(req, {
        type: "phi_after_hours",
        severity: "medium",
        title: "Medical file accessed outside normal hours",
        resource: "MedicalFile",
        resourceId: key,
        userId: access.identity?.id || req.user?.id,
        userRole: access.identity?.role || req.user?.role,
        metadata: { appointmentId: access.appointmentId || null, hour },
      });
    }

    const streamed = await streamUploadFromS3(key, res);
    if (streamed) return;
  } catch (err) {
    console.error("S3 upload read error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ msg: "Could not read uploaded file from shared storage." });
    }
    return;
  }

  return next();
}

app.get(/^\/uploads\/.+$/, (_req, res) => {
  res.status(404).json({ msg: "Direct upload URLs are disabled. Use the authenticated API path." });
});
app.get(/^\/api\/uploads\/.+$/, verifyToken, serveProtectedUpload);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/superadmin", require("./routes/superadmin"));
app.use("/api/employee-admin", require("./routes/employeeAdmin"));
app.use("/api/qna", require("./routes/qna"));
app.use("/api/doctor", require("./routes/doctorAuth"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/medical", require("./routes/medical"));
app.use("/api/notes", require("./routes/consultationNotes"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/paypal", require("./routes/paypal"));
app.use("/api/pricing", require("./routes/pricing"));
app.use("/api/services", require("./routes/services"));
app.use("/api/superadmin/healthcare", require("./routes/healthcareManagement"));
app.use("/api/appointment-tree", require("./routes/appointmentTree"));
app.use("/api/retention-policies", require("./routes/retention"));
app.use("/api/locations", require("./routes/locations"));
app.use(
  "/api/category-consultation",
  require("./routes/categoryConsultation")
);
app.use("/api/direct-video-room", require("./routes/directVideoRoom"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/rtc", require("./routes/rtc"));
const CategoryConsultation = require("./models/CategoryConsultation");
const Enrollment = require("./models/Enrollment");

const searchRoutes = require("./searchRoutes");

app.post("/api/search", (req, res) => {
  const { query, routes } = req.body;

  const results = searchRoutes(query, routes);

  res.json({ results });
});

// Health Check
app.get("/api/health", (req, res) => {
  res.send("API Running...");
});

// Active users
const onlineUsers = new Map();

// Track which appointment room each socket is in
const socketRooms = new Map(); // socketId -> appointmentId

// Track authenticated identity per socket
const socketUsers = new Map(); // socketId -> { userId, role }

// Track appointment rooms that have already had both participants present at
// once, so a later rejoin can be told "this is a resume of an active call"
// (peer should renegotiate quickly) vs. an ordinary first-time join (peer
// should not be perturbed while a normal handshake is already in progress).
const roomActivated = new Map(); // appointmentId -> lastActivatedAt (ms epoch)
// Entries persist across a room's transient auto-eviction (see the
// disconnect grace-timeout handler below) so a simultaneous-drop-and-
// reconnect still counts as a resume, not a first join — but that means
// there's no other prompt cleanup for appointments that end via crash/kill/
// permanent network loss without an explicit leave-appointment-room. Sweep
// stale entries on a TTL instead of letting the Map grow unbounded.
const ROOM_ACTIVATED_TTL_MS = Number(process.env.ROOM_ACTIVATED_TTL_MS || 24 * 60 * 60 * 1000);
function sweepRoomActivated() {
  const cutoff = Date.now() - ROOM_ACTIVATED_TTL_MS;
  for (const [appointmentId, activatedAt] of roomActivated) {
    if (activatedAt < cutoff) roomActivated.delete(appointmentId);
  }
}
setInterval(sweepRoomActivated, Math.min(ROOM_ACTIVATED_TTL_MS, 60 * 60 * 1000)).unref();

// Per-socket rate limits for signaling/chat events — see socketRateLimit.js
// for why this exists. Limits are generous relative to legitimate use
// (ICE candidates are naturally bursty during gathering; SDP offers/answers
// and chat/telemetry are not) so real users never notice them.
const chatMessageLimiter = makeSocketLimiter({ windowMs: 1000, max: 5 });
const videoSdpLimiter = makeSocketLimiter({ windowMs: 1000, max: 2 });
const iceCandidateLimiter = makeSocketLimiter({ windowMs: 1000, max: 20 });
const iceRestartLimiter = makeSocketLimiter({ windowMs: 5000, max: 3 });
const telemetryLimiter = makeSocketLimiter({ windowMs: 1000, max: 10 });
const directChatLimiter = makeSocketLimiter({ windowMs: 1000, max: 5 });
// max: 6, not 2 like videoSdpLimiter above. That budget works for the
// appointment flow because only one side (the patient) ever self-initiates
// an offer there — the doctor only answers, so a normal handshake never
// sends more than one SDP message per side per second. Direct Video Call
// guests are symmetric peers: both sides independently create their
// RTCPeerConnection and add tracks, so an initial "offer glare" (both sides
// firing onnegotiationneeded at once) is expected, and the polite side's
// rollback can itself re-trigger onnegotiationneeded, producing a real
// burst of up to 3 legitimate SDP messages (offer, re-offer, then the
// answer) within under a second. At max: 2, the answer that actually
// completes the handshake was being silently dropped by this limiter,
// leaving the call stuck at "connecting" forever. 6 keeps comfortable
// headroom for that burst while still capping well below anything a real
// flood needs.
const directSdpLimiter = makeSocketLimiter({ windowMs: 1000, max: 6 });
const directIceCandidateLimiter = makeSocketLimiter({ windowMs: 1000, max: 20 });
const directIceRestartLimiter = makeSocketLimiter({ windowMs: 5000, max: 3 });

const SOCKET_LIMITERS = [
  chatMessageLimiter,
  videoSdpLimiter,
  iceCandidateLimiter,
  iceRestartLimiter,
  telemetryLimiter,
  directChatLimiter,
  directSdpLimiter,
  directIceCandidateLimiter,
  directIceRestartLimiter,
];

app.get("/api/admin/active-users", verifyAdminToken, adminOnly, (req, res) => {
  res.json({ activeUsers: onlineUsers.size });
});

// How long the "disconnect" handler waits before telling the peer someone
// left (see that handler, below) — long enough to ride out a brief mobile
// network blip without a false "left the call" notice, short enough that a
// genuine departure is still reported promptly. Socket.IO's own
// connectionStateRecovery window (below) is capped to this same value: a
// recovery window longer than the grace period let a socket recover
// invisibly at, say, 60s while the grace-period timer had already declared
// it "left" at 10s — a real gap the peer would briefly (and wrongly) see as
// "left the call" before self-healing. Capping the recovery window to the
// grace period means a socket that recovers has always done so before that
// verdict is reached, closing the gap; anything slower already falls
// through to the (already-correct) normal-join re-eviction/re-negotiation
// path handled in join-appointment-room.
const SOCKET_LEAVE_GRACE_MS = Number(process.env.SOCKET_LEAVE_GRACE_MS || 15000);

// HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  path: "/socket.io/",
  allowEIO3: true,
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  connectTimeout: Number(process.env.SOCKET_CONNECT_TIMEOUT_MS || 45000),
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS || 25000),
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS || 30000),
  connectionStateRecovery: {
    maxDisconnectionDuration: Math.min(
      Number(process.env.SOCKET_STATE_RECOVERY_MS || SOCKET_LEAVE_GRACE_MS),
      SOCKET_LEAVE_GRACE_MS,
    ),
    skipMiddlewares: false,
  },
});

app.set("io", io);
app.set("evictDoctorFromAppointmentRoom", evictDoctorFromAppointmentRoom);

io.engine.on("connection_error", (err) => {
  console.warn("[socket] connection_error", {
    code: err.code,
    message: err.message,
    context: err.context,
    origin: err.req?.headers?.origin,
    transport: err.req?._query?.transport,
  });
});

function parseCookieHeader(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

async function validateSocketAccessToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === "refresh" || !decoded.sid || !decoded.id || !decoded.role) return null;

    const session = await Session.findById(decoded.sid).select("userId role revokedAt").lean();
    if (!session || session.revokedAt) return null;
    if (session.userId !== String(decoded.id) || session.role !== decoded.role) return null;

    const revoked = await RevokedToken.exists({ sessionId: String(decoded.sid), userId: String(decoded.id) });
    if (revoked) return null;

    return {
      id: String(decoded.id),
      role: decoded.role,
      email: decoded.email || "",
      sid: String(decoded.sid),
    };
  } catch {
    return null;
  }
}

async function validateSocketRefreshToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "refresh" || !decoded.sid || !decoded.id || !decoded.role) return null;

    const session = await Session.findById(decoded.sid).select("userId role revokedAt").lean();
    if (!session || session.revokedAt) return null;
    if (session.userId !== String(decoded.id) || session.role !== decoded.role) return null;

    return {
      id: String(decoded.id),
      role: decoded.role,
      email: decoded.email || "",
      sid: String(decoded.sid),
    };
  } catch {
    return null;
  }
}

function appointmentRoomName(appointmentId) {
  return `appointment_${appointmentId}`;
}

function getRequestedSocketIdentity(socket, requested = {}) {
  const requestedUserId = requested.userId;
  const requestedRole = requested.role;
  if (!requestedUserId && !requestedRole) return null;

  return Array.isArray(socket.authIdentities)
    ? socket.authIdentities.find((identity) =>
      (!requestedUserId || String(identity.id) === String(requestedUserId)) &&
      (!requestedRole || identity.role === requestedRole)
    ) || null
    : null;
}

function getSocketIdentity(socket, requested = {}) {
  const requestedIdentity = getRequestedSocketIdentity(socket, requested);
  if (requestedIdentity) {
    return { userId: String(requestedIdentity.id), role: requestedIdentity.role };
  }

  const liveIdentity = socketUsers.get(socket.id);
  const userId = liveIdentity?.userId || socket.userId;
  const role = liveIdentity?.role || socket.userRole;
  if (userId && role) return { userId: String(userId), role };

  // Last resort: an identity resolved from this connection's cookies/handshake
  // auth (io.use), for a socket that hasn't sent a "user-online" ping yet to
  // populate socketUsers. Purely additive — only reached when every check
  // above found nothing, so it can only make peer-presence detection more
  // accurate, never less.
  const cachedIdentity = Array.isArray(socket.authIdentities) ? socket.authIdentities[0] : null;
  if (cachedIdentity) return { userId: String(cachedIdentity.id), role: cachedIdentity.role };

  return null;
}

// True iff at least one live socket in `existingSocketIds` belongs to a real
// user other than `excludeUserId`. Used to decide whether a rejoining
// participant is actually resuming a call with someone else already present,
// as opposed to just seeing their own not-yet-disconnected pre-refresh
// socket (which briefly lingers in the room until its ping/pong timeout —
// see the "disconnect" handler). Counting raw socket ids instead of unique
// users here previously caused a rejoining participant's own stale socket to
// be mistaken for a peer.
function hasOtherUserInRoom(existingSocketIds, excludeUserId) {
  if (!existingSocketIds) return false;
  for (const sid of existingSocketIds) {
    const peerSocket = io.sockets.sockets.get(sid);
    if (!peerSocket) continue;
    const peerIdentity = getSocketIdentity(peerSocket);
    if (peerIdentity?.userId && String(peerIdentity.userId) !== String(excludeUserId)) {
      return true;
    }
  }
  return false;
}

// Async, race-free identity resolution for a SPECIFIC requested role/userId.
// socket.authIdentities is a snapshot taken once, when this transport
// connection was first established, from whatever cookies existed then —
// it is not re-derived per event. A client can emit several events
// back-to-back (e.g. "user-online" then "join-appointment-room") that are
// each handled independently and asynchronously on the server, so nothing
// here can assume one has already finished priming shared state before the
// other runs. Every caller that needs a specific identity resolves it
// itself, the same way, rather than depending on ordering between events.
async function resolveSocketIdentity(socket, requested = {}) {
  // Fast path: already known to this connection (cookie-derived, or a token
  // validated earlier on this same connection — see below).
  const cached = getRequestedSocketIdentity(socket, requested);
  if (cached) return cached;

  // Slow path: an explicit, fresh bearer token was supplied — validate it
  // directly instead of relying on some other event to have primed
  // socket.authIdentities first.
  if (requested.token) {
    const tokenIdentity = await validateSocketAccessToken(requested.token);
    if (
      tokenIdentity &&
      (!requested.userId || String(tokenIdentity.id) === String(requested.userId)) &&
      (!requested.role || tokenIdentity.role === requested.role)
    ) {
      const already = socket.authIdentities.some(
        (i) => i.id === tokenIdentity.id && i.role === tokenIdentity.role,
      );
      if (!already) socket.authIdentities.push(tokenIdentity);
      return tokenIdentity;
    }
  }

  // Last resort: whatever is already registered on this socket — but ONLY
  // when the caller didn't ask for anything specific (a plain "still here"
  // ping). If a SPECIFIC role/userId was requested but couldn't be verified
  // by either the token or the cached identities, silently keeping a stale
  // registration risks resolving a doctor's request as an old patient
  // identity from earlier on this same connection — doing nothing is the
  // safe failure mode.
  if (!requested.role && !requested.userId && socket.userId && socket.userRole) {
    return {
      id: socket.userId,
      role: socket.userRole,
      email: socket.userEmail,
      sid: socket.sessionId,
    };
  }

  return null;
}

function isSocketInAppointmentRoom(socket, appointmentId) {
  if (!appointmentId) return false;
  const room = appointmentRoomName(appointmentId);
  return String(socketRooms.get(socket.id) || "") === String(appointmentId) && socket.rooms.has(room);
}

// Forcibly removes a specific doctor's socket(s) from an appointment's video
// call room — used when the appointment is reassigned to someone else while
// a call may be live. video-offer/answer/ice-candidate only check room
// membership (isSocketInAppointmentRoom), not DB authorization, per-message —
// this is what actually revokes access, at the moment it changes, without
// adding a DB check to every signaling message.
function evictDoctorFromAppointmentRoom(appointmentId, doctorUserId) {
  const room = appointmentRoomName(appointmentId);
  const socketIds = io.sockets.adapter.rooms.get(room);
  if (!socketIds) return;

  for (const socketId of Array.from(socketIds)) {
    const peerSocket = io.sockets.sockets.get(socketId);
    if (!peerSocket) continue;
    const identity = getSocketIdentity(peerSocket);
    if (identity?.role === "doctor" && String(identity.userId) === String(doctorUserId)) {
      peerSocket.emit("appointment-access-revoked", {
        msg: "You have been removed from this appointment.",
      });
      peerSocket.leave(room);
      socketRooms.delete(peerSocket.id);
    }
  }
}

async function canSocketAccessAppointment(socket, appointmentId, requestedIdentity = {}) {
  if (!appointmentId) return { allowed: false, reason: "missing_appointment" };

  const resolved = await resolveSocketIdentity(socket, requestedIdentity);
  if (!resolved) return { allowed: false, reason: "unauthenticated" };
  const identity = { userId: String(resolved.id), role: resolved.role };

  const userId = String(identity.userId);
  let appointment = null;
  let allowed = false;

  try {
    appointment = await Appointment.findById(appointmentId)
      .select("patientId doctorId")
      .lean();

    if (appointment) {
      allowed =
        (identity.role === "user" && String(appointment.patientId) === userId) ||
        (identity.role === "doctor" && appointment.doctorId && String(appointment.doctorId) === userId);
    } else {
      const cc = await CategoryConsultation.findById(appointmentId)
        .select("patientId assignedDoctorId")
        .lean();

      if (cc) {
        appointment = cc;

        if (identity.role === "user") {
          allowed = String(cc.patientId) === userId;
        } else if (identity.role === "doctor" && cc.assignedDoctorId) {
          const enrollment = await Enrollment.findOne({ doctorId: identity.userId }).select("_id").lean();
          allowed = !!enrollment && String(cc.assignedDoctorId) === String(enrollment._id);
        }
      }
    }
  } catch {
    return { allowed: false, reason: "invalid_appointment" };
  }

  if (!appointment) return { allowed: false, reason: "appointment_not_found" };

  return {
    allowed,
    reason: allowed ? "participant" : "not_participant",
    identity,
    appointment,
  };
}

// ── Direct Video Room (ad-hoc, link-based, guest access — no login required) ──
// Fully independent of the appointment-based flow above and of the platform's
// user/doctor/admin auth system: no ownership check, no identity requirement —
// just "does this room exist, is it still active, and does it already have 2
// participants," same trust model as a Google Meet link. Participants are
// tracked by a client-generated guestId (not an authenticated identity) purely
// so a page refresh in the same tab is treated as a rejoin, not a 3rd seat.
const directRoomSockets = new Map(); // socketId -> { roomId, guestId, name }
// roomId -> { initiatorGuestId, participantGuestIds: Set }
// Assigns the initiator/polite role once per guestId, the first time it's
// ever seen in a room, and keeps it stable across refreshes/reconnects.
// Recomputing this role from "who else is currently connected" (as before)
// flips both peers to "initiator" simultaneously whenever the original
// non-initiator refreshes while the other party is still connected, which
// deadlocks perfect-negotiation's offer-collision handling on both sides.
const directRoomRoles = new Map();

function getDirectRoomRole(roomId, guestId) {
  let entry = directRoomRoles.get(roomId);
  if (!entry) {
    entry = { initiatorGuestId: null, participantGuestIds: new Set() };
    directRoomRoles.set(roomId, entry);
  }

  const isReturningGuest = entry.participantGuestIds.has(guestId);
  entry.participantGuestIds.add(guestId);

  if (!entry.initiatorGuestId) {
    // First guest ever seen in this room becomes (and remains) the
    // initiator/impolite peer, whether this is their first join or not.
    entry.initiatorGuestId = guestId;
    return { isInitiator: true, isReturningGuest };
  }

  return { isInitiator: entry.initiatorGuestId === guestId, isReturningGuest };
}

function clearDirectRoomRoles(roomId) {
  directRoomRoles.delete(roomId);
}
const DIRECT_ROOM_ID_PATTERN = /^[a-f0-9]{16,128}$/i;
const DIRECT_GUEST_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

function directRoomName(roomId) {
  return `direct_room_${roomId}`;
}

function sanitizeGuestName(name) {
  const trimmed = String(name || "").trim().slice(0, 60);
  return trimmed || "Guest";
}

function isSocketInDirectRoom(socket, roomId) {
  if (!roomId) return false;
  const meta = directRoomSockets.get(socket.id);
  const room = directRoomName(roomId);
  return !!meta && String(meta.roomId) === String(roomId) && socket.rooms.has(room);
}

// Authenticate socket connections via HttpOnly cookies.
io.use(async (socket, next) => {
  const cookies = parseCookieHeader(socket.handshake.headers.cookie || "");
  const accessTokens = [cookies.userToken, cookies.doctorToken, cookies.adminToken].filter(Boolean);
  const refreshTokens = [cookies.userRefreshToken, cookies.doctorRefreshToken, cookies.adminRefreshToken].filter(Boolean);
  socket.authIdentities = [];
  for (const token of accessTokens) {
    const identity = await validateSocketAccessToken(token);
    if (identity) {
      socket.authIdentities.push(identity);
      if (!socket.userId) {
        socket.userId = identity.id;
        socket.userRole = identity.role;
        socket.userEmail = identity.email;
        socket.sessionId = identity.sid;
      }
    }
  }
  // Also accept auth tokens sent in the websocket handshake. Some clients
  // (mobile apps or SPA token-based flows) cannot rely on HttpOnly cookies
  // being present, so they may pass a Bearer token via `socket.auth.token`
  // or the `Authorization` header. Validate and merge those identities.
  try {
    const bearer = socket.handshake.headers.authorization?.startsWith("Bearer ")
      ? socket.handshake.headers.authorization.split(" ")[1]
      : null;
    const handshakeAccess = socket.handshake?.auth?.token || bearer;
    const handshakeRefresh = socket.handshake?.auth?.refreshToken || socket.handshake?.auth?.refresh;

    if (handshakeAccess) {
      const identity = await validateSocketAccessToken(handshakeAccess);
      if (identity) {
        const already = socket.authIdentities.some((i) => i.id === identity.id && i.role === identity.role);
        if (!already) socket.authIdentities.push(identity);
        if (!socket.userId) {
          socket.userId = identity.id;
          socket.userRole = identity.role;
          socket.userEmail = identity.email;
          socket.sessionId = identity.sid;
        }
      }
    }

    if (handshakeRefresh) {
      const identity = await validateSocketRefreshToken(handshakeRefresh);
      if (identity) {
        const already = socket.authIdentities.some((i) => i.id === identity.id && i.role === identity.role);
        if (!already) socket.authIdentities.push(identity);
        if (!socket.userId) {
          socket.userId = identity.id;
          socket.userRole = identity.role;
          socket.userEmail = identity.email;
          socket.sessionId = identity.sid;
        }
      }
    }
  } catch (err) {
    // Non-fatal — continue with any identities we already parsed from cookies.
  }
  for (const token of refreshTokens) {
    const identity = await validateSocketRefreshToken(token);
    if (!identity) continue;
    const alreadyAdded = socket.authIdentities.some((existing) =>
      existing.id === identity.id && existing.role === identity.role
    );
    if (!alreadyAdded) socket.authIdentities.push(identity);
    if (!socket.userId) {
      socket.userId = identity.id;
      socket.userRole = identity.role;
      socket.userEmail = identity.email;
      socket.sessionId = identity.sid;
    }
  }
  next();
});

io.on("connection", (socket) => {
  // Socket.IO restored socket.rooms/socket.data from a prior session within
  // connectionStateRecovery's window — see the join-appointment-room repair
  // below for why our own bookkeeping still needs to be rebuilt on top of it.
  if (socket.recovered) {
    console.info("[socket] connection state recovered", {
      socketId: socket.id,
      rooms: Array.from(socket.rooms),
    });
  }

  socket.on("user-online", async ({ userId: requestedUserId, role: requestedRole, token } = {}) => {
    // See resolveSocketIdentity's comment for why this can't just trust
    // socket.authIdentities' connection-time snapshot when a specific role
    // is being requested.
    const identity = await resolveSocketIdentity(socket, {
      userId: requestedUserId,
      role: requestedRole,
      token,
    });

    if (!identity?.id || !identity?.role) return;

    const previousIdentity = socketUsers.get(socket.id);
    if (
      previousIdentity?.userId &&
      (previousIdentity.userId !== String(identity.id) || previousIdentity.role !== identity.role)
    ) {
      const previousSockets = onlineUsers.get(previousIdentity.userId);
      previousSockets?.delete(socket.id);
      if (previousSockets?.size === 0) onlineUsers.delete(previousIdentity.userId);
      if (previousIdentity.role === "doctor") socket.leave(`doctor_${previousIdentity.userId}`);
      if (previousIdentity.role === "user") socket.leave(`patient_${previousIdentity.userId}`);
      if (previousIdentity.role === "admin" || previousIdentity.role === "superadmin") socket.leave("admin_room");
    }

    socket.userId = String(identity.id);
    socket.userRole = identity.role;
    socket.userEmail = identity.email || socket.userEmail || "";
    socket.sessionId = identity.sid || socket.sessionId || "";

    const userId = String(identity.id);
    const role = identity.role;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    socketUsers.set(socket.id, { userId, role });

    if (role === "doctor") {
      socket.join(`doctor_${userId}`);
    }

    if (role === "user") {
      socket.join(`patient_${userId}`);
    }

    if (role === "admin" || role === "superadmin") {
      socket.join("admin_room");
    }

    if (role !== "admin") {
      io.emit("active-users-count", onlineUsers.size);
    }
  });

  socket.on("join-appointment-room", async ({ appointmentId, userId, role, token } = {}) => {
    if (!appointmentId) return;

    const room = appointmentRoomName(appointmentId);
    const access = await canSocketAccessAppointment(socket, appointmentId, { userId, role, token });

    if (!access.allowed) {
      socket.emit("room-access-denied", { msg: "Access to this call room was denied." });
      console.warn("[socket] appointment room access denied", {
        socketId: socket.id,
        appointmentId,
        reason: access.reason,
        userId: access.identity?.userId || socket.userId || null,
        role: access.identity?.role || socket.userRole || null,
      });
      return;
    }

    // Socket.IO may report this socket as already in the room in two
    // distinct cases: (a) a genuine duplicate emit on the same live
    // connection (e.g. an effect re-run), or (b) a connection recovered via
    // Socket.IO's connectionStateRecovery after a brief disconnect (a
    // network blip, or a Wi-Fi <-> mobile data switch) — the library
    // restores `socket.rooms` for these automatically, but our own
    // bookkeeping (`socketRooms`, keyed by socket.id) is cleared
    // unconditionally in the "disconnect" handler below and is NOT restored
    // by the library, since it lives outside `socket.data`. Every
    // signaling/chat event downstream is gated on isSocketInAppointmentRoom(),
    // which checks `socketRooms` — so without repairing it here, a recovered
    // socket looks connected and "in the room" while every
    // video-offer/answer/ice-candidate and chat message is silently dropped.
    // Repair it unconditionally in both cases before returning.
    if (socket.rooms.has(room)) {
      socketRooms.set(socket.id, appointmentId);

      const existing = io.sockets.adapter.rooms.get(room);
      const peerPresent = hasOtherUserInRoom(existing, access.identity.userId);
      const wasActivated = roomActivated.has(appointmentId);
      if (peerPresent) roomActivated.set(appointmentId, Date.now());

      socket.to(room).emit("peer-joined", { resumedCall: wasActivated });
      if (peerPresent) socket.emit("peer-joined", { resumedCall: wasActivated });
      return;
    }

    const existing = io.sockets.adapter.rooms.get(room);
    const currentSize = existing ? existing.size : 0;

    const socketUserId = access.identity.userId;

    // Seat limit: max 2 unique users (not 2 raw sockets). This avoids false
    // denials during reconnects / duplicate tabs from the same participant.
    const existingSocketIds = existing ? Array.from(existing) : [];
    const uniqueUsersInRoom = new Set();

    for (const sid of existingSocketIds) {
      const peerSocket = io.sockets.sockets.get(sid);
      if (!peerSocket) continue;
      const peerIdentity = getSocketIdentity(peerSocket);
      if (peerIdentity?.userId) uniqueUsersInRoom.add(String(peerIdentity.userId));
    }

    const alreadyInRoom = uniqueUsersInRoom.has(String(socketUserId));

    // If this user already has a socket in the room, evict the old one.
    // This prevents SDP corruption from duplicate sessions (same user,
    // multiple tabs / refresh race) while still allowing reconnection.
    // Evict the old socket for this user so the peer re-establishes
    // signaling with the new socket. Without this, the peer's PC stays
    // connected to the stale socket and the new session cannot negotiate.
    // We deliberately do NOT emit participant-left here — the peer's
    // connection stays up until the evicted tab closes its PC (triggered
    // by duplicate-session), at which point natural ICE disconnection
    // detection fires ice-restart to the new socket.
    if (alreadyInRoom && currentSize > 0) {
      for (const sid of existingSocketIds) {
        if (sid === socket.id) continue;
        const peerSocket = io.sockets.sockets.get(sid);
        if (!peerSocket) continue;
        const peerIdentity = getSocketIdentity(peerSocket);
        if (peerIdentity?.userId === String(socketUserId)) {
          peerSocket.leave(room);
          socketRooms.delete(sid);
          peerSocket.emit("duplicate-session", { msg: "Another consultation session was started elsewhere." });
          break;
        }
      }
    }

    if (uniqueUsersInRoom.size >= 2 && !alreadyInRoom) {
      socket.emit("room-access-denied", { msg: "This call room is full." });
      return;
    }

    socket.join(room);
    socketRooms.set(socket.id, appointmentId);

    ChatMessage.find({ appointmentId })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean()
      .then((storedMessages) => {
        const history = storedMessages.map((message) => ({
          appointmentId: String(message.appointmentId),
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          text: decryptChatText(message),
          fileUrl: uploadAccessPath(message.fileUrl),
          fileName: message.fileName || null,
          fileType: message.fileType || null,
          createdAt: message.createdAt,
        }));
        socket.emit("appointment-chat-history", { appointmentId, messages: history });
      })
      .catch((err) => console.error("chat history load error:", err));

    // Distinguish "resuming an already-active call" (peer should renegotiate
    // quickly) from "first time these two are meeting in this room" (a normal
    // handshake may still be in progress and must not be perturbed). Must be
    // based on a REAL other user, not the raw pre-eviction currentSize — a
    // refreshing participant's own not-yet-disconnected stale socket is
    // still counted in currentSize at this point, which previously made a
    // solo rejoin look like "peer already here" and short-circuited the
    // reconnect-stall timeout on the frontend down to 8s instead of 20s.
    const peerPresent = Array.from(uniqueUsersInRoom).some(
      (id) => id !== String(socketUserId),
    );
    const wasActivated = roomActivated.has(appointmentId);
    if (peerPresent) roomActivated.set(appointmentId, Date.now());

    socket.to(room).emit("peer-joined", { resumedCall: wasActivated });
    if (peerPresent) socket.emit("peer-joined", { resumedCall: wasActivated });
  });

  socket.on("leave-appointment-room", ({ appointmentId }) => {
    if (!appointmentId) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;

    const room = appointmentRoomName(appointmentId);
    socket.to(room).emit("participant-left");
    socket.leave(room);
    socketRooms.delete(socket.id);

    const remaining = io.sockets.adapter.rooms.get(room);
    if (!remaining || remaining.size === 0) {
      roomActivated.delete(appointmentId);
    }
  });

  socket.on(
    "appointment-message",
    ({
      appointmentId,
      senderId,
      senderName,
      text,
      fileUrl,
      fileName,
      fileType,
    }) => {
      if (!appointmentId || (!text && !fileUrl)) return;
      if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
      if (!chatMessageLimiter.allow(socket.id)) return;

      const liveIdentity = socketUsers.get(socket.id);
      const senderRole = liveIdentity?.role || socket.userRole || "user";
      const senderUserId = liveIdentity?.userId || socket.userId || senderId;
      const encrypted = encryptChatText(text || "");
      const hour = new Date().getHours();
      const fileKey = fileUrl ? keyFromStoredValue(fileUrl) : "";

      ChatMessage.create({
        appointmentId,
        senderId: String(senderUserId || senderId || ""),
        senderName: senderName || "",
        senderRole: senderRole === "doctor" ? "doctor" : "user",
        ...encrypted,
        fileUrl: fileKey,
        fileName: fileName || "",
        fileType: fileType || "",
        deliveredAt: new Date(),
      })
        .then((message) => recordActivity(
          { user: { id: senderUserId, role: senderRole }, headers: socket.handshake.headers, socket },
          {
            action: "CHAT_MESSAGE_DELIVERED",
            resource: "ChatMessage",
            resourceId: message._id,
            patientId: null,
            details: { appointmentId, hasAttachment: Boolean(fileKey), encrypted: true, keyVersion: encrypted.keyVersion },
          }
        ))
        .catch((err) => console.error("chat message persist error:", err));

      if (hour < 6 || hour >= 22) {
        recordSecurityEvent(
          { user: { id: senderUserId, role: senderRole }, headers: socket.handshake.headers, socket },
          {
            type: "phi_after_hours",
            severity: "medium",
            title: "Clinical chat message sent outside normal hours",
            resource: "ChatMessage",
            resourceId: appointmentId,
            metadata: { appointmentId, hour },
          }
        );
      }

      io.to(`appointment_${appointmentId}`).emit(
        "appointment-message",
        {
          appointmentId,
          senderId: String(senderUserId || senderId || ""),
          senderName,
          text: text || "",
          fileUrl: uploadAccessPath(fileKey),
          fileName: fileName || null,
          fileType: fileType || null,
          createdAt: new Date().toISOString(),
        }
      );
    }
  );

  socket.on("video-telemetry", async ({ appointmentId, event, role, timestamp, details } = {}) => {
    if (!appointmentId || !event) return;
    if (!telemetryLimiter.allow(socket.id)) return;

    const access = await canSocketAccessAppointment(socket, appointmentId);
    if (!access.allowed) return;

    console.info("[video-telemetry]", {
      appointmentId,
      event: String(event).slice(0, 80),
      role: role || access.identity?.role || socket.userRole || "",
      userId: access.identity?.userId || socket.userId || "",
      timestamp: timestamp || new Date().toISOString(),
      details: details && typeof details === "object" ? details : {},
    });
  });

  socket.on("video-offer", ({ appointmentId, offer, offerId }) => {
    if (!appointmentId || !offer) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
    if (!videoSdpLimiter.allow(socket.id)) return;

    // offerId is opaque to the server — just relayed so the two peers can
    // correlate an answer back to the offer it's meant for (see VideoCall.jsx).
    socket
      .to(appointmentRoomName(appointmentId))
      .emit("video-offer", { offer, offerId });
  });

  socket.on("video-answer", ({ appointmentId, answer, offerId }) => {
    if (!appointmentId || !answer) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
    if (!videoSdpLimiter.allow(socket.id)) return;

    socket
      .to(appointmentRoomName(appointmentId))
      .emit("video-answer", { answer, offerId });
  });

  socket.on("ice-candidate", ({ appointmentId, candidate }) => {
    if (!appointmentId || !candidate) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
    if (!iceCandidateLimiter.allow(socket.id)) return;

    socket
      .to(appointmentRoomName(appointmentId))
      .emit("ice-candidate", { candidate });
  });

  socket.on("ice-restart-request", ({ appointmentId }) => {
    if (!appointmentId) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;
    if (!iceRestartLimiter.allow(socket.id)) return;

    socket
      .to(appointmentRoomName(appointmentId))
      .emit("ice-restart-request");
  });

  socket.on("disconnect", (reason) => {
    // Notify the peer only after a short grace period. Mobile browsers can
    // briefly reconnect sockets during app/background or transport changes.
    const appointmentId = socketRooms.get(socket.id);
    if (appointmentId) {
      const liveIdentity = socketUsers.get(socket.id);
      const disconnectedUserId = liveIdentity?.userId || socket.userId || "";
      const appointmentRoom = `appointment_${appointmentId}`;

      setTimeout(() => {
        const sameUserStillInRoom = Array.from(socketRooms.entries()).some(([sid, roomAppointmentId]) => {
          if (String(roomAppointmentId) !== String(appointmentId)) return false;
          const peerSocket = io.sockets.sockets.get(sid);
          if (!peerSocket) return false;
          const peerIdentity = socketUsers.get(sid);
          const peerUserId = peerIdentity?.userId || peerSocket.userId || "";
          return disconnectedUserId && String(peerUserId) === String(disconnectedUserId);
        });

        if (!sameUserStillInRoom) {
          io.to(appointmentRoom).emit("participant-left");
          // Deliberately NOT clearing roomActivated here: this path also
          // fires when both participants drop at once (e.g. a shared
          // network outage) and later both reconnect — clearing it would
          // make that reconnect look like a first join instead of a resume,
          // costing the doctor the fast requestPeerIceRestart() nudge in
          // favor of the ~20-25s passive watchdog. roomActivated is only
          // cleared on a real, intentional departure — see the explicit
          // leave-appointment-room handler above, which already does this.
        }
      }, SOCKET_LEAVE_GRACE_MS);

      socketRooms.delete(socket.id);
    }

    socketUsers.delete(socket.id);

    for (const [userId, socketSet] of onlineUsers.entries()) {
      if (socketSet.has(socket.id)) {
        socketSet.delete(socket.id);
        if (socketSet.size === 0) onlineUsers.delete(userId);
        break;
      }
    }

    io.emit("active-users-count", onlineUsers.size);

    // Drop this socket's rate-limit bucket entries so SOCKET_LIMITERS' maps
    // don't grow forever across the server's lifetime as sockets churn.
    SOCKET_LIMITERS.forEach((limiter) => limiter.dispose(socket.id));

  });

  // ── Direct Video Room events (ad-hoc, link-based, guest access) ────────────
  // Kept fully separate from the appointment-room events above and from the
  // platform auth system: independent event names, independent in-memory
  // tracking, independent DB model, no identity/login requirement at all.
  socket.on("join-direct-room", async ({ roomId, guestId, name } = {}) => {
    if (!roomId || typeof roomId !== "string" || !DIRECT_ROOM_ID_PATTERN.test(roomId)) {
      socket.emit("direct-room-error", { code: "invalid", msg: "This meeting link is invalid." });
      return;
    }
    if (!guestId || typeof guestId !== "string" || !DIRECT_GUEST_ID_PATTERN.test(guestId)) {
      socket.emit("direct-room-error", { code: "invalid", msg: "Could not join — please reload and try again." });
      return;
    }

    let roomDoc;
    try {
      roomDoc = await DirectVideoRoom.findOne({ roomId });
    } catch (err) {
      console.error("[direct-room] lookup error:", err.message);
      socket.emit("direct-room-error", { code: "server_error", msg: "Could not verify this meeting. Please try again." });
      return;
    }

    if (!roomDoc) {
      socket.emit("direct-room-error", { code: "not_found", msg: "This meeting link is invalid." });
      return;
    }

    if (roomDoc.status === "active" && roomDoc.expiresAt && roomDoc.expiresAt.getTime() <= Date.now()) {
      roomDoc.status = "expired";
      await roomDoc.save().catch(() => { });
    }

    if (roomDoc.status !== "active") {
      socket.emit("direct-room-error", {
        code: roomDoc.status === "expired" ? "expired" : "closed",
        msg: roomDoc.status === "expired"
          ? "This meeting link has expired."
          : "This meeting has ended.",
      });
      return;
    }

    const guestName = sanitizeGuestName(name);
    const room = directRoomName(roomId);

    if (socket.rooms.has(room)) {
      // Duplicate emit from a re-run effect — just re-signal, don't re-count seats.
      socket.to(room).emit("direct-peer-joined", { name: guestName });
      return;
    }

    const existing = io.sockets.adapter.rooms.get(room);
    const existingSocketIds = existing ? Array.from(existing) : [];
    const uniqueGuestIds = new Map(); // guestId -> socketId

    for (const sid of existingSocketIds) {
      const meta = directRoomSockets.get(sid);
      if (meta?.guestId) uniqueGuestIds.set(meta.guestId, sid);
    }

    const alreadyInRoom = uniqueGuestIds.has(guestId);

    // Name of whichever other guest is already in the room, if any — used
    // below to tell a joining guest about them immediately. Without this,
    // only the pre-existing guest ever learned about the new joiner (via the
    // broadcast at the end of this handler); the joiner itself had no way to
    // know someone was already there, leaving it stuck showing "waiting" and
    // (since the client only creates its RTCPeerConnection once it knows a
    // peer is present) never starting WebRTC negotiation at all.
    let existingPeerName = "";
    for (const [gid, sid] of uniqueGuestIds.entries()) {
      if (gid === guestId) continue;
      existingPeerName = directRoomSockets.get(sid)?.name || "";
      break;
    }

    // Evict a stale socket for the same guest (refresh / duplicate tab)
    // rather than counting it as a second seat.
    if (alreadyInRoom) {
      const staleSid = uniqueGuestIds.get(guestId);
      if (staleSid && staleSid !== socket.id) {
        const staleSocket = io.sockets.sockets.get(staleSid);
        if (staleSocket) {
          staleSocket.leave(room);
          directRoomSockets.delete(staleSid);
          staleSocket.emit("direct-duplicate-session", { msg: "This meeting was opened in another tab or window." });
        }
      }
    }

    if (uniqueGuestIds.size >= (roomDoc.maxParticipants || 2) && !alreadyInRoom) {
      socket.emit("direct-room-error", { code: "full", msg: "This meeting already has two participants." });
      return;
    }

    const { isInitiator, isReturningGuest } = getDirectRoomRole(roomId, guestId);
    // "Resumed" means this guest has been in this room before (a refresh or
    // network-change reconnect), as opposed to a first-time join — the peer
    // side uses this to know it should proactively renegotiate rather than
    // wait passively for a normal first handshake.
    const resumedCall = isReturningGuest && existingSocketIds.length > 0;

    socket.join(room);
    directRoomSockets.set(socket.id, { roomId, guestId, name: guestName });

    const now = new Date();
    DirectVideoRoom.updateOne({ roomId }, { $set: { lastActivityAt: now } }).catch(() => { });
    DirectVideoRoom.updateOne({ roomId, firstJoinedAt: null }, { $set: { firstJoinedAt: now } }).catch(() => { });

    socket.emit("direct-room-joined", { roomId, isInitiator, resumedCall });
    if (existingPeerName) socket.emit("direct-peer-joined", { name: existingPeerName });
    socket.to(room).emit("direct-peer-joined", { name: guestName, resumedCall });
  });

  socket.on("leave-direct-room", ({ roomId } = {}) => {
    if (!roomId) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;

    const room = directRoomName(roomId);
    socket.to(room).emit("direct-participant-left");
    socket.leave(room);
    directRoomSockets.delete(socket.id);

    const remaining = io.sockets.adapter.rooms.get(room);
    if (!remaining || remaining.size === 0) clearDirectRoomRoles(roomId);
  });

  socket.on("direct-video-offer", ({ roomId, offer } = {}) => {
    if (!roomId || !offer) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    if (!directSdpLimiter.allow(socket.id)) return;
    socket.to(directRoomName(roomId)).emit("direct-video-offer", { offer });
  });

  socket.on("direct-video-answer", ({ roomId, answer } = {}) => {
    if (!roomId || !answer) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    if (!directSdpLimiter.allow(socket.id)) return;
    socket.to(directRoomName(roomId)).emit("direct-video-answer", { answer });
  });

  socket.on("direct-ice-candidate", ({ roomId, candidate } = {}) => {
    if (!roomId || !candidate) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    if (!directIceCandidateLimiter.allow(socket.id)) return;
    socket.to(directRoomName(roomId)).emit("direct-ice-candidate", { candidate });
  });

  socket.on("direct-ice-restart-request", ({ roomId } = {}) => {
    if (!roomId) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    if (!directIceRestartLimiter.allow(socket.id)) return;
    socket.to(directRoomName(roomId)).emit("direct-ice-restart-request");
  });

  // Ephemeral, relay-only chat — intentionally not persisted, since this
  // room has no association with any Appointment/ChatMessage record and no
  // authenticated identity to attribute a stored message to.
  socket.on("direct-room-message", ({ roomId, text } = {}) => {
    if (!roomId || !text) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    if (!directChatLimiter.allow(socket.id)) return;

    const meta = directRoomSockets.get(socket.id);
    socket.to(directRoomName(roomId)).emit("direct-room-message", {
      senderName: meta?.name || "Guest",
      text: String(text).slice(0, 2000),
      createdAt: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    const meta = directRoomSockets.get(socket.id);
    if (!meta) return;

    const { roomId, guestId } = meta;
    const room = directRoomName(roomId);

    directRoomSockets.delete(socket.id);

    setTimeout(() => {
      const sameGuestStillInRoom = Array.from(directRoomSockets.values()).some(
        (m) => String(m.roomId) === String(roomId) && m.guestId === guestId
      );

      if (!sameGuestStillInRoom) {
        io.to(room).emit("direct-participant-left");
        const remaining = io.sockets.adapter.rooms.get(room);
        if (!remaining || remaining.size === 0) clearDirectRoomRoles(roomId);
      }
    }, SOCKET_LEAVE_GRACE_MS);
  });

}); // end io.on("connection")

// ── Global error handler ──────────────────────────────────────────────────
// Catches uncaught errors from routes/middleware (Express 5 auto-forwards
// async rejections here too) and body-parser errors (e.g. malformed JSON).
// Always logs full detail server-side but never echoes internals (stack
// trace, file paths) to the client.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  const status = Number.isInteger(err?.status)
    ? err.status
    : Number.isInteger(err?.statusCode)
      ? err.statusCode
      : 500;
  res.status(status).json({
    msg: status >= 400 && status < 500 ? "Invalid request." : "Something went wrong. Please try again.",
  });
});

const PORT = process.env.PORT || 5000;

validateRuntimeConfig();

startServer()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Startup error:", err);
    process.exit(1);
  });

// ── Graceful shutdown ──────────────────────────────────────────────────────
// Without this, SIGTERM (e.g. a container orchestrator redeploying/scaling
// down) kills the process immediately — mid-request HTTP calls get dropped
// and active video-call sockets disconnect without a clean close frame.
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[shutdown] ${signal} received — closing server...`);

  // Most orchestrators (Docker, ECS, k8s) SIGKILL shortly after SIGTERM
  // anyway if the process hasn't exited — this just makes that deterministic
  // and logged instead of the process hanging silently on a stuck close.
  const forceExitTimer = setTimeout(() => {
    console.error("[shutdown] Graceful shutdown timed out — forcing exit.");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    // Disconnects all Socket.IO clients (active video-call signaling
    // connections included) before the HTTP server stops — closing the raw
    // HTTP server first would otherwise hang waiting for those long-lived
    // websocket connections to end on their own.
    await new Promise((resolve) => io.close(resolve));
    console.log("[shutdown] Socket.IO closed.");

    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    console.log("[shutdown] HTTP server closed.");

    await mongoose.connection.close();
    console.log("[shutdown] MongoDB connection closed.");

    clearTimeout(forceExitTimer);
    console.log("[shutdown] Graceful shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[shutdown] Error during graceful shutdown:", err);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));