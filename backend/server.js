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
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomInt } = require("crypto");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
const Doctor = require("./models/Doctor");
const Session = require("./models/Session");
const RevokedToken = require("./models/RevokedToken");
const ChatMessage = require("./models/ChatMessage");
const Question = require("./models/Question");
const DirectVideoRoom = require("./models/DirectVideoRoom");
const { verifyToken, verifyAdminToken, adminOnly } = require("./middleware/verifyToken");
const { recordActivity } = require("./utils/activityLogger");
const { findUploadInS3, streamUploadFromS3, keyFromStoredValue } = require("./utils/uploadStorage");
const { ensureBucketCors } = require("./config/s3");
const { encryptChatText, decryptChatText } = require("./utils/chatCrypto");
const { recordSecurityEvent } = require("./utils/securityMonitor");
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

// DB connect + auto-seed admin
const startServer = async () => {
  await connectDB();

  // Seed default admin
  const existingAdmin = await User.findOne({ email: "admin@gmail.com" });

  if (!existingAdmin) {
    const hashed = await bcrypt.hash("admin123", 10);

    await User.create({
      name: "Admin",
      email: "admin@gmail.com",
      password: hashed,
      role: "admin",
    });

    console.log("Admin account created ✅");
  }

  // Seed superadmin
  const existingSuperAdmin = await User.findOne({
    email: "superadmin@humancare.com",
  });

  if (!existingSuperAdmin) {
    const hashed = await bcrypt.hash("superadmin123", 10);

    await User.create({
      name: "Super Admin",
      email: "superadmin@humancare.com",
      password: hashed,
      role: "superadmin",
    });

    console.log("Super Admin created ✅");
  }

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
    console.log(`Assigned doctorId ${newId} to doctor ${doc.email}`);
  }
  if (doctorsWithoutId.length > 0) {
    console.log(`✅ Backfilled doctorId for ${doctorsWithoutId.length} doctor(s).`);
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

function validateRuntimeConfig() {
  const required = ["JWT_SECRET", "MONGO_URI"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(`[config] Missing required environment variable(s): ${missing.join(", ")}`);
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
    // Allow requests without origin
    if (!origin) return callback(null, true);

    // Allow listed origins
    if (allowedOrigins.indexOf(normalizeOrigin(origin)) !== -1) {
      return callback(null, true);
    }

    // Reject unknown origins
    return callback(null, true);
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Role"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(require("cookie-parser")());

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
const CategoryConsultation = require("./models/CategoryConsultation");
const Enrollment = require("./models/Enrollment");


// app.post("/api/search", async (req, res) => {
//   const { query, routes } = req.body;
//   console.log("🔍 Search hit:", query); // ✅ add this

//   try {
//     const message = await client.messages.create({
//       model: "claude-sonnet-4-6",
//       max_tokens: 500,
//       messages: [{
//         role: "user",
//         content: `A patient searched: "${query}".
// From this list, return the top 5 most relevant as a JSON array (same shape as input).
// List: ${JSON.stringify(routes)}
// Return ONLY a valid JSON array. No explanation, no markdown.`
//       }]
//     });

//     const results = JSON.parse(message.content[0].text);
//     res.json({ results });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Search failed" });
//   }
// });


// app.post("/api/search", async (req, res) => {
//   const { query, routes } = req.body;

//   try {
//     const completion = await client.chat.completions.create({
//       model: "llama-3.1-8b-instant",
//       max_tokens: 500,
//       messages: [
//         {
//           role: "system",
//           content: "You are a medical search assistant. Always respond with ONLY a valid JSON array. Never include markdown, backticks, or explanation."
//         },
//         {
//           role: "user",
//           // highlight-start
//           content: `A patient typed: "${query}" (may be partial or misspelled).
// Match against these medical routes using their title AND keywords.
// Return the top 5 most relevant as a JSON array (same shape as input, include the keywords field).
// Prioritize: exact title match > keyword match > partial/fuzzy match.
// List: ${JSON.stringify(routes)}
// Return ONLY a valid JSON array.`
//           // highlight-end
//         }
//       ]
//     });

//     let raw = completion.choices[0].message.content.trim();
//     raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

//     const results = JSON.parse(raw);
//     res.json({ results });

//   } catch (err) {
//     console.error("Search error:", err);
//     res.status(500).json({ error: "Search failed", detail: err.message });
//   }
// });

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
const roomActivated = new Map(); // appointmentId -> true

app.get("/api/admin/active-users", verifyAdminToken, adminOnly, (req, res) => {
  res.json({ activeUsers: onlineUsers.size });
});

// HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  path: "/socket.io/",
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  connectTimeout: Number(process.env.SOCKET_CONNECT_TIMEOUT_MS || 45000),
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL_MS || 25000),
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT_MS || 30000),
  connectionStateRecovery: {
    maxDisconnectionDuration: Number(process.env.SOCKET_STATE_RECOVERY_MS || 120000),
    skipMiddlewares: false,
  },
});

app.set("io", io);

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
  if (!userId || !role) return null;
  return { userId: String(userId), role };
}

function isSocketInAppointmentRoom(socket, appointmentId) {
  if (!appointmentId) return false;
  const room = appointmentRoomName(appointmentId);
  return String(socketRooms.get(socket.id) || "") === String(appointmentId) && socket.rooms.has(room);
}

async function canSocketAccessAppointment(socket, appointmentId, requestedIdentity = {}) {
  if (!appointmentId) return { allowed: false, reason: "missing_appointment" };

  const identity = getSocketIdentity(socket, requestedIdentity);
  if (!identity) return { allowed: false, reason: "unauthenticated" };

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

  // ── TEMP DEBUG LOG ──
  console.log("[socket-auth] raw cookie header:", socket.handshake.headers.cookie);
  console.log("[socket-auth] parsed cookies:", cookies);

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

// Socket Events
io.on("connection", (socket) => {
  console.log("[socket] connected", {
    id: socket.id,
    transport: socket.conn.transport.name,
    origin: socket.handshake.headers.origin,
    userId: socket.userId || null,
    role: socket.userRole || null,
  });

  socket.conn.on("upgrade", (transport) => {
    console.log("[socket] transport upgraded", {
      id: socket.id,
      transport: transport.name,
    });
  });

  socket.on("user-online", ({ userId: requestedUserId, role: requestedRole } = {}) => {
    const matchingIdentity = Array.isArray(socket.authIdentities)
      ? socket.authIdentities.find((identity) =>
        (!requestedUserId || String(identity.id) === String(requestedUserId)) &&
        (!requestedRole || identity.role === requestedRole)
      )
      : null;

    const identity = matchingIdentity || (
      socket.userId && socket.userRole
        ? { id: socket.userId, role: socket.userRole, email: socket.userEmail, sid: socket.sessionId }
        : null
    );

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

    console.log("Socket joined rooms:", userId, role);
  });

  socket.on("join-appointment-room", async ({ appointmentId, userId, role } = {}) => {
    if (!appointmentId) return;

    const room = appointmentRoomName(appointmentId);
    const access = await canSocketAccessAppointment(socket, appointmentId, { userId, role });

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

    // If this socket is already in the room (e.g. duplicate emit from an
    // effect re-run), re-notify peers AND tell ourselves about any peer
    // already present — otherwise a rejoin can leave both sides without a
    // "peer-joined" signal (e.g. if our previous listener was detached
    // between the original join and this duplicate emit).
    if (socket.rooms.has(room)) {
      socket.to(room).emit("peer-joined");
      const existing = io.sockets.adapter.rooms.get(room);
      if (existing && existing.size > 1) socket.emit("peer-joined");
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
    // handshake may still be in progress and must not be perturbed).
    const wasActivated = roomActivated.get(appointmentId) === true;
    if (currentSize > 0) roomActivated.set(appointmentId, true);

    socket.to(room).emit("peer-joined", { resumedCall: wasActivated });
    if (currentSize > 0) socket.emit("peer-joined", { resumedCall: wasActivated });
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

  socket.on("video-offer", ({ appointmentId, offer }) => {
    if (!appointmentId || !offer) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;

    socket
      .to(appointmentRoomName(appointmentId))
      .emit("video-offer", { offer });
  });

  socket.on("video-answer", ({ appointmentId, answer }) => {
    if (!appointmentId || !answer) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;

    socket
      .to(appointmentRoomName(appointmentId))
      .emit("video-answer", { answer });
  });

  socket.on("ice-candidate", ({ appointmentId, candidate }) => {
    if (!appointmentId || !candidate) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;

    socket
      .to(appointmentRoomName(appointmentId))
      .emit("ice-candidate", { candidate });
  });

  socket.on("ice-restart-request", ({ appointmentId }) => {
    if (!appointmentId) return;
    if (!isSocketInAppointmentRoom(socket, appointmentId)) return;

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
          const remaining = io.sockets.adapter.rooms.get(appointmentRoom);
          if (!remaining || remaining.size === 0) {
            roomActivated.delete(appointmentId);
          }
        }
      }, Number(process.env.SOCKET_LEAVE_GRACE_MS || 10000));

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
    console.log("[socket] disconnected", {
      id: socket.id,
      reason,
      activeUsers: onlineUsers.size,
    });
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
    socket.to(directRoomName(roomId)).emit("direct-video-offer", { offer });
  });

  socket.on("direct-video-answer", ({ roomId, answer } = {}) => {
    if (!roomId || !answer) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    socket.to(directRoomName(roomId)).emit("direct-video-answer", { answer });
  });

  socket.on("direct-ice-candidate", ({ roomId, candidate } = {}) => {
    if (!roomId || !candidate) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    socket.to(directRoomName(roomId)).emit("direct-ice-candidate", { candidate });
  });

  socket.on("direct-ice-restart-request", ({ roomId } = {}) => {
    if (!roomId) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;
    socket.to(directRoomName(roomId)).emit("direct-ice-restart-request");
  });

  // Ephemeral, relay-only chat — intentionally not persisted, since this
  // room has no association with any Appointment/ChatMessage record and no
  // authenticated identity to attribute a stored message to.
  socket.on("direct-room-message", ({ roomId, text } = {}) => {
    if (!roomId || !text) return;
    if (!isSocketInDirectRoom(socket, roomId)) return;

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
    }, Number(process.env.SOCKET_LEAVE_GRACE_MS || 10000));
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