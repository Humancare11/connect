const express  = require("express");
const router   = express.Router();
const Question = require("../models/Question");
const { verifyUserToken, verifyDoctorToken, verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

// ── POST /api/qna/ask ─────────────────────────────────────────────────────────
router.post("/ask", verifyUserToken, async (req, res) => {
  try {
    const { question, category, attachments } = req.body;
    if (!question || !question.trim())
      return res.status(400).json({ msg: "Question is required." });

    const user = req.user;
    let userName = "Anonymous";
    try {
      const u = await require("../models/User").findById(user.id).select("name").lean();
      if (u?.name) userName = u.name;
    } catch (_) {}

    const newQ = await Question.create({
      user: user.id, name: userName,
      question: question.trim(), category: category || "General", status: "pending",
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("new-question", newQ);
      io.to(`patient_${user.id}`).emit("question-created", newQ);
    }

    res.status(201).json(newQ);
  } catch (err) {
    console.error("Ask Question Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ── GET /api/qna/ — public approved questions ─────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const questions = await Question.find({ status: "approved" }).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── GET /api/qna/user-questions — user's own questions ───────────────────────
router.get("/user-questions", verifyUserToken, async (req, res) => {
  try {
    const questions = await Question.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── GET /api/qna/admin/all ────────────────────────────────────────────────────
router.get("/admin/all", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const questions = await Question.find().populate("user", "name email").sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── GET /api/qna/doctor/assigned ──────────────────────────────────────────────
router.get("/doctor/assigned", verifyDoctorToken, async (req, res) => {
  try {
    const questions = await Question.find({
      assignedDoctorId: req.user.id,
      status: { $in: ["assigned", "answered"] },
    }).populate("user", "name email").sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── PUT /api/qna/:id/assign ───────────────────────────────────────────────────
router.put("/:id/assign", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const { doctorId, doctorName, doctorSpec } = req.body;
    if (!doctorName) return res.status(400).json({ msg: "Doctor name is required." });

    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { status: "assigned", assignedDoctorId: doctorId || null, assignedDoctorName: doctorName || "", assignedDoctorSpec: doctorSpec || "" },
      { new: true }
    );
    if (!question) return res.status(404).json({ msg: "Question not found." });

    const io = req.app.get("io");
    if (io && doctorId) io.to(`doctor_${doctorId}`).emit("question-assigned", question);

    res.json(question);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── PUT /api/qna/:id/answer ───────────────────────────────────────────────────
router.put("/:id/answer", verifyDoctorToken, async (req, res) => {
  try {
    const { answer, doctorName, doctorSpec } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ msg: "Answer is required." });

    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ msg: "Question not found." });

    if (question.assignedDoctorId?.toString() !== req.user.id)
      return res.status(403).json({ msg: "This question was not assigned to you." });

    question.answer  = answer.trim();
    question.status  = "approved";
    question.answered = true;
    question.doctor = {
      name:           (doctorName || question.assignedDoctorName || "").trim(),
      specialization: (doctorSpec  || question.assignedDoctorSpec || "").trim(),
    };
    await question.save();

    const io = req.app.get("io");
    if (io) {
      io.to("admin_room").emit("question-answered", question);
      if (question.user) io.to(`patient_${question.user}`).emit("question-approved", question);
    }

    res.json(question);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// ── PUT /api/qna/:id/approve ──────────────────────────────────────────────────
router.put("/:id/approve", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id, { status: "approved", answered: true }, { new: true }
    );
    if (!question) return res.status(404).json({ msg: "Question not found." });

    const io = req.app.get("io");
    if (io) {
      if (question.user) io.to(`patient_${question.user}`).emit("question-approved", question);
      io.emit("question-approved", question);
    }
    res.json(question);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
