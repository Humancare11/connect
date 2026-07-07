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
const ChatMessage = require("./models/ChatMessage");
const Question = require("./models/Question");
const { verifyToken, verifyAdminToken, adminOnly } = require("./middleware/verifyToken");
const { logAudit } = require("./utils/auditLogger");
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
  allowedHeaders: ["Content-Type", "Authorization"],
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
    await logAudit(req, {
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
    await logAudit(req, {
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
app.use("/api/audit-logs", require("./routes/auditLogs"));
app.use("/api/retention-policies", require("./routes/retention"));
app.use("/api/locations", require("./routes/locations"));

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

// Authenticate socket connections via HttpOnly cookies.
io.use((socket, next) => {
  const cookies = parseCookieHeader(socket.handshake.headers.cookie || "");
  const tokens = [cookies.userToken, cookies.doctorToken, cookies.adminToken].filter(Boolean);
  for (const token of tokens) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type === "refresh") continue;
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      break;
    } catch (_) {
      // Try next cookie.
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

  socket.on("user-online", ({ userId, role }) => {
    if (!userId) return;

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

  socket.on("join-appointment-room", ({ appointmentId }) => {
    if (!appointmentId) return;

    const room = `appointment_${appointmentId}`;

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

    // Prefer runtime identity registered via user-online; fall back to JWT handshake.
    const liveIdentity = socketUsers.get(socket.id);
    const socketUserId = liveIdentity?.userId || socket.userId;
    const socketUserRole = liveIdentity?.role || socket.userRole;

    // Seat limit: max 2 unique users (not 2 raw sockets). This avoids false
    // denials during reconnects / duplicate tabs from the same participant.
    if (socketUserId && socketUserRole) {
      const existingSocketIds = existing ? Array.from(existing) : [];
      const uniqueUsersInRoom = new Set();

      for (const sid of existingSocketIds) {
        const peerSocket = io.sockets.sockets.get(sid);
        if (!peerSocket) continue;
        const peerLiveIdentity = socketUsers.get(sid);
        const peerUserId = peerLiveIdentity?.userId || peerSocket.userId;
        if (peerUserId) uniqueUsersInRoom.add(String(peerUserId));
      }

      const alreadyInRoom = uniqueUsersInRoom.has(String(socketUserId));
      if (uniqueUsersInRoom.size >= 2 && !alreadyInRoom) {
        socket.emit("room-access-denied", { msg: "This call room is full." });
        return;
      }
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

    socket.to(room).emit("peer-joined");
    if (currentSize > 0) socket.emit("peer-joined");
  });

  socket.on("leave-appointment-room", ({ appointmentId }) => {
    if (!appointmentId) return;

    const room = `appointment_${appointmentId}`;
    socket.to(room).emit("participant-left");
    socket.leave(room);
    socketRooms.delete(socket.id);
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
        .then((message) => logAudit(
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
          senderId,
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

  socket.on("video-offer", ({ appointmentId, offer }) => {
    if (!appointmentId || !offer) return;

    socket
      .to(`appointment_${appointmentId}`)
      .emit("video-offer", { offer });
  });

  socket.on("video-answer", ({ appointmentId, answer }) => {
    if (!appointmentId || !answer) return;

    socket
      .to(`appointment_${appointmentId}`)
      .emit("video-answer", { answer });
  });

  socket.on("ice-candidate", ({ appointmentId, candidate }) => {
    if (!appointmentId || !candidate) return;

    socket
      .to(`appointment_${appointmentId}`)
      .emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", (reason) => {
    // Notify peer if this socket was in an appointment room
    const appointmentId = socketRooms.get(socket.id);
    if (appointmentId) {
      socket.to(`appointment_${appointmentId}`).emit("participant-left");
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

