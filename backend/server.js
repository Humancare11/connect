// ── Load the correct .env file based on NODE_ENV ──
// "npm run start:prod" sets NODE_ENV=production before this runs,
// so we load .env.production; dev/nodemon falls back to .env.
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomInt } = require("crypto");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
const Doctor = require("./models/Doctor");
const Session = require("./models/Session");
const ChatMessage = require("./models/ChatMessage");
const fs = require("fs");
const { verifyToken, verifyAdminToken, adminOnly } = require("./middleware/verifyToken");
const { logAudit } = require("./utils/auditLogger");
const { findUploadInGridFS, streamUploadFromGridFS } = require("./utils/uploadStorage");
const { encryptChatText, decryptChatText } = require("./utils/chatCrypto");
const { recordSecurityIncident } = require("./utils/securityMonitor");
const { scheduleRetentionCleanup } = require("./jobs/retentionJobs");
const { ensureDefaults: ensureRetentionDefaults } = require("./controllers/retentionController");

const app = express();

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

  await ensureRetentionDefaults();
  scheduleRetentionCleanup();
};

// Allowed Origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
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
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", ...allowedOrigins],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  })
);

// CORS Config
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without origin
    if (!origin) return callback(null, true);

    // Allow listed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
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

// Serve uploaded files
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const upload = await findUploadInGridFS(filename);
  if (upload?.metadata?.uploadedBy) {
    const uploader = identities.find((identity) => String(identity.id) === String(upload.metadata.uploadedBy));
    if (uploader) return { allowed: true, reason: "uploader", identity: uploader };
  }

  const fileUrlPattern = new RegExp(`(?:^|/)${escapeRegExp(filename)}$`);
  const appointment = await Appointment.findOne({
    "medicalReports.url": fileUrlPattern,
  })
    .select("patientId doctorId medicalReports")
    .lean();

  if (!appointment) return { allowed: false, reason: "unassigned" };

  const matched = identities.find((identity) => {
    const identityId = String(identity.id);
    return (
      (identity.role === "user" && String(appointment.patientId) === identityId) ||
      (identity.role === "doctor" && String(appointment.doctorId) === identityId)
    );
  });

  return {
    allowed: Boolean(matched),
    reason: matched?.role === "user" ? "patient" : matched?.role === "doctor" ? "doctor" : "not_assigned",
    identity: matched,
    appointmentId: appointment._id,
    patientId: appointment.patientId,
  };
}

async function serveProtectedUpload(req, res, next) {
  const filename = path.basename(req.params.filename || "");
  if (!filename || filename !== req.params.filename) {
    await logAudit(req, {
      action: "MEDICAL_FILE_ACCESS_DENIED",
      resource: "MedicalFile",
      resourceId: filename || null,
      success: false,
      details: { reason: "invalid_filename" },
    });
    return res.status(400).json({ msg: "Invalid upload filename." });
  }

  try {
    const access = await canAccessUpload(req, filename);
    await logAudit(req, {
      action: access.allowed ? "MEDICAL_FILE_ACCESS" : "MEDICAL_FILE_ACCESS_DENIED",
      resource: "MedicalFile",
      resourceId: filename,
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
      await recordSecurityIncident(req, {
        type: "phi_after_hours",
        severity: "medium",
        title: "Medical file accessed outside normal hours",
        resource: "MedicalFile",
        resourceId: filename,
        userId: access.identity?.id || req.user?.id,
        userRole: access.identity?.role || req.user?.role,
        metadata: { appointmentId: access.appointmentId || null, hour },
      });
    }

    const streamed = await streamUploadFromGridFS(filename, res);
    if (streamed) return;
  } catch (err) {
    console.error("GridFS upload fallback error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ msg: "Could not read uploaded file from shared storage." });
    }
    return;
  }

  if (process.env.NODE_ENV === "production") return next();

  const fallbackBase = (
    process.env.UPLOAD_FALLBACK_BASE_URL ||
    process.env.PRODUCTION_BACKEND_URL ||
    "https://humancareconnect.co"
  ).replace(/\/+$/, "");

  const targetPath = path.join(uploadsDir, filename);
  const tempPath = `${targetPath}.download`;
  const remoteUrl = `${fallbackBase}/api/uploads/${encodeURIComponent(filename)}`;
  const client = remoteUrl.startsWith("https:") ? https : http;

  const cleanupTemp = () => {
    fs.rm(tempPath, { force: true }, () => {});
  };

  const request = client.get(remoteUrl, (upstream) => {
    if (upstream.statusCode !== 200) {
      upstream.resume();
      cleanupTemp();
      return res.status(404).json({
        msg: "Uploaded file was not found in local storage or fallback storage.",
        filename,
      });
    }

    const file = fs.createWriteStream(tempPath);
    upstream.pipe(file);

    upstream.on("error", () => {
      file.destroy();
      cleanupTemp();
      if (!res.headersSent) {
        res.status(502).json({ msg: "Could not retrieve uploaded file from fallback storage." });
      }
    });

    file.on("error", () => {
      upstream.destroy();
      cleanupTemp();
      if (!res.headersSent) {
        res.status(500).json({ msg: "Could not cache uploaded file locally." });
      }
    });

    file.on("finish", () => {
      file.close(() => {
        fs.rename(tempPath, targetPath, (err) => {
          if (err) {
            cleanupTemp();
            if (!res.headersSent) {
              res.status(500).json({ msg: "Could not store uploaded file locally." });
            }
            return;
          }
          res.setHeader("Cache-Control", "private, no-store");
          res.sendFile(targetPath);
        });
      });
    });
  });

  request.setTimeout(15000, () => {
    request.destroy(new Error("Fallback upload fetch timed out."));
  });

  request.on("error", () => {
    cleanupTemp();
    if (!res.headersSent) {
      res.status(502).json({ msg: "Could not retrieve uploaded file from fallback storage." });
    }
  });
}

app.get("/uploads/:filename", (_req, res) => {
  res.status(404).json({ msg: "Direct upload URLs are disabled. Use the authenticated API path." });
});
app.get("/api/uploads/:filename", verifyToken, serveProtectedUpload);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/superadmin", require("./routes/superadmin"));
app.use("/api/qna", require("./routes/qna"));
app.use("/api/doctor", require("./routes/doctorAuth"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/medical", require("./routes/medical"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/paypal", require("./routes/paypal"));
app.use("/api/audit-logs", require("./routes/auditLogs"));
app.use("/api/security-incidents", require("./routes/securityIncidents"));
app.use("/api/retention-policies", require("./routes/retention"));

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
  transports: ["websocket", "polling"],
});

app.set("io", io);

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
  console.log("Socket connected:", socket.id);

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

    // If this socket is already in the room (e.g. duplicate emit), just re-notify peers
    if (socket.rooms.has(room)) {
      socket.to(room).emit("peer-joined");
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
          fileUrl: message.fileUrl || null,
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

      ChatMessage.create({
        appointmentId,
        senderId: String(senderUserId || senderId || ""),
        senderName: senderName || "",
        senderRole: senderRole === "doctor" ? "doctor" : "user",
        ...encrypted,
        fileUrl: fileUrl || "",
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
            details: { appointmentId, hasAttachment: Boolean(fileUrl), encrypted: true, keyVersion: encrypted.keyVersion },
          }
        ))
        .catch((err) => console.error("chat message persist error:", err));

      if (hour < 6 || hour >= 22) {
        recordSecurityIncident(
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
          fileUrl: fileUrl || null,
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

  socket.on("disconnect", () => {
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
    console.log("Active users:", onlineUsers.size);
  });
});

const PORT = process.env.PORT || 5000;

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

