const express = require("express");
const router = express.Router();
const User = require("../models/User");
const EmployeeTask = require("../models/EmployeeTask");
const { verifyEmployeeAdminToken, employeeAdminOnly } = require("../middleware/verifyToken");

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Pending", "In Progress", "Completed", "Blocked"];
const taskPopulate = [
  { path: "assignedTo", select: "name email role" },
  { path: "createdBy", select: "name email role" },
];

function cleanText(value) {
  return String(value || "").trim();
}

function taskFilterForScope(scope, userId) {
  if (scope === "created") return { createdBy: userId };
  if (scope === "all") return { $or: [{ assignedTo: userId }, { createdBy: userId }] };
  return { assignedTo: userId };
}

function dateRangeFilter(range) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (range === "today") {
    return { dueDate: { $gte: startOfToday, $lt: startOfTomorrow } };
  }

  if (range === "week") {
    const weekEnd = new Date(startOfToday);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { dueDate: { $gte: startOfToday, $lt: weekEnd } };
  }

  if (range === "month") {
    const monthEnd = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 1);
    return { dueDate: { $gte: startOfToday, $lt: monthEnd } };
  }

  return {};
}

function parseDueDate(value) {
  if (!value) return null;
  const dueDate = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(dueDate.getTime())) return undefined;
  return dueDate;
}

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((file) => ({
      name: cleanText(file?.name).slice(0, 255),
      size: cleanText(file?.size).slice(0, 40),
    }))
    .filter((file) => file.name);
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => cleanText(tag).slice(0, 40)).filter(Boolean))];
}

function cleanSubtasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((subtask) => ({
      title: cleanText(subtask?.title).slice(0, 140),
      description: cleanText(subtask?.description).slice(0, 2000),
      comment: cleanText(subtask?.comment).slice(0, 2000),
      attachments: cleanAttachments(subtask?.attachments),
    }))
    .filter((subtask) => subtask.title || subtask.description || subtask.comment || subtask.attachments.length);
}

// GET /api/employee-admin/dashboard — returns authenticated employee admin's profile summary
router.get("/dashboard", verifyEmployeeAdminToken, employeeAdminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email role createdAt").lean();
    if (!user) return res.status(404).json({ msg: "Employee Admin not found." });
    res.json({ name: user.name, email: user.email, role: user.role, memberSince: user.createdAt });
  } catch (err) {
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/employee-admin/employees - active employee admins available for task assignment
router.get("/employees", verifyEmployeeAdminToken, employeeAdminOnly, async (_req, res) => {
  try {
    const employees = await User.find({
      role: "employeeadmin",
      accountDisabled: { $ne: true },
    })
      .select("name email role")
      .sort({ name: 1 })
      .lean();

    res.json(employees);
  } catch (err) {
    console.error("employee list error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/employee-admin/tasks?scope=assigned|created|all&range=today|week|month|all&status=...
router.get("/tasks", verifyEmployeeAdminToken, employeeAdminOnly, async (req, res) => {
  try {
    const scope = ["assigned", "created", "all"].includes(req.query.scope)
      ? req.query.scope
      : "assigned";
    const range = ["today", "week", "month", "all"].includes(req.query.range)
      ? req.query.range
      : "all";

    const filter = {
      ...taskFilterForScope(scope, req.user.id),
      ...dateRangeFilter(range),
    };

    if (STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const tasks = await EmployeeTask.find(filter)
      .populate(taskPopulate)
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    res.json(tasks);
  } catch (err) {
    console.error("employee task list error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// GET /api/employee-admin/tasks/:id - details for tasks assigned to or created by this user
router.get("/tasks/:id", verifyEmployeeAdminToken, employeeAdminOnly, async (req, res) => {
  try {
    const task = await EmployeeTask.findById(req.params.id).populate(taskPopulate).lean();
    if (!task) return res.status(404).json({ msg: "Task not found." });

    const canView =
      String(task.assignedTo?._id || task.assignedTo) === String(req.user.id) ||
      String(task.createdBy?._id || task.createdBy) === String(req.user.id);

    if (!canView) {
      return res.status(403).json({ msg: "You do not have access to this task." });
    }

    res.json(task);
  } catch (err) {
    console.error("employee task detail error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// POST /api/employee-admin/tasks - assign a task to any employee admin
router.post("/tasks", verifyEmployeeAdminToken, employeeAdminOnly, async (req, res) => {
  try {
    const title = cleanText(req.body.title);
    const description = cleanText(req.body.description);
    const department = cleanText(req.body.department);
    const comment = cleanText(req.body.comment);
    const assignedTo = cleanText(req.body.assignedTo);
    const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "Medium";
    const startDate = parseDueDate(req.body.startDate);
    const dueDate = parseDueDate(req.body.dueDate);
    const attachments = cleanAttachments(req.body.attachments);
    const subtasks = cleanSubtasks(req.body.subtasks);
    const tags = cleanTags(req.body.tags);

    if (!title) return res.status(400).json({ msg: "Task title is required." });
    if (!assignedTo) return res.status(400).json({ msg: "Assignee is required." });
    if (startDate === undefined) return res.status(400).json({ msg: "Start date must be a valid date." });
    if (dueDate === undefined) return res.status(400).json({ msg: "Due date must be a valid date." });

    const assignee = await User.findOne({
      _id: assignedTo,
      role: "employeeadmin",
      accountDisabled: { $ne: true },
    }).select("_id").lean();

    if (!assignee) return res.status(404).json({ msg: "Employee not found." });

    const task = await EmployeeTask.create({
      title,
      description,
      department,
      comment,
      attachments,
      subtasks,
      startDate,
      assignedTo: assignee._id,
      createdBy: req.user.id,
      priority,
      dueDate,
      tags,
    });

    const populated = await EmployeeTask.findById(task._id).populate(taskPopulate).lean();
    res.status(201).json(populated);
  } catch (err) {
    console.error("employee task create error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

// PUT /api/employee-admin/tasks/:id/status - assignee updates task status
router.put("/tasks/:id/status", verifyEmployeeAdminToken, employeeAdminOnly, async (req, res) => {
  try {
    const status = req.body.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ msg: "Invalid task status." });

    const task = await EmployeeTask.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: "Task not found." });

    if (String(task.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Only the assigned employee can update this task status." });
    }

    task.status = status;
    task.completedAt = status === "Completed" ? new Date() : null;
    await task.save();

    const populated = await EmployeeTask.findById(task._id).populate(taskPopulate).lean();
    res.json(populated);
  } catch (err) {
    console.error("employee task status update error:", err);
    res.status(500).json({ msg: "Server error." });
  }
});

module.exports = router;
