import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import { useEmployeeAdmin } from "../../context/EmployeeAdminContext";
import "./EmployeeTasks.css";

const STATUSES = [
  { value: "Pending", tone: "pending" },
  { value: "In Progress", tone: "in-progress" },
  { value: "Completed", tone: "completed" },
  { value: "Blocked", tone: "blocked" },
];

const RANGE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All" },
];

const STATUS_FILTERS = [
  { key: "", label: "Any status" },
  { key: "Pending", label: "Pending" },
  { key: "In Progress", label: "In Progress" },
  { key: "Completed", label: "Completed" },
  { key: "Blocked", label: "Blocked" },
];

const SCOPE_TABS = [
  { key: "assigned", label: "Assigned to me" },
  { key: "created", label: "Assigned by me" },
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialsFor(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "-"
  );
}

function extOf(name = "") {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

function priorityTone(priority) {
  return String(priority || "Medium").toLowerCase();
}

function statusTone(status) {
  return String(status || "Pending").toLowerCase().replace(/\s+/g, "-");
}

function dueInfo(dueDate, status) {
  if (status === "Completed") return { label: "Completed", tone: "done" };
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diff = Math.round((due - now) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: `Overdue by ${Math.abs(diff)}d`, tone: "overdue" };
  if (diff === 0) return { label: "Due today", tone: "soon" };
  if (diff <= 2) return { label: `${diff}d left`, tone: "soon" };
  return { label: `${diff}d left`, tone: "ok" };
}

export default function EmployeeTasks() {
  const { taskId } = useParams();

  if (taskId) return <EmployeeTaskDetails taskId={taskId} />;
  return <EmployeeTaskList />;
}

function EmployeeTaskList() {
  const navigate = useNavigate();
  const [scope, setScope] = useState("assigned");
  const [range, setRange] = useState("today");
  const [status, setStatus] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const viewingCreated = scope === "created";

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((task) => task.status !== "Completed").length,
      completed: tasks.filter((task) => task.status === "Completed").length,
    }),
    [tasks],
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ scope, range });
    if (status) params.set("status", status);

    api
      .get(`/api/employee-admin/tasks?${params.toString()}`)
      .then((res) => setTasks(res.data || []))
      .catch(() => setMessage({ type: "error", text: "Could not load tasks." }))
      .finally(() => setLoading(false));
  }, [scope, range, status]);

  const handleScopeChange = (key) => {
    setScope(key);
    setRange(key === "created" ? "all" : "today");
    setStatus("");
  };

  return (
    <div className="et-page">
      <header className="et-header">
        <span className="et-eyebrow">Task Master</span>
        <h1 className="et-title">My tasks</h1>
        <p className="et-sub">
          Task cards show the task name and description. Open a card to view every detail.
        </p>
      </header>

      <div className="et-stats">
        <StatCard
          label={viewingCreated ? "Assigned by me" : "Assigned to me"}
          value={stats.total}
          tone="blue"
          icon={<TaskIcon />}
        />
        <StatCard label="Open" value={stats.pending} tone="amber" icon={<ClockIcon />} />
        <StatCard label="Completed" value={stats.completed} tone="green" icon={<CheckIcon />} />
      </div>

      {message.text && (
        <div className={`et-alert et-alert--${message.type === "success" ? "success" : "error"}`}>
          {message.text}
        </div>
      )}

      <div className="et-toolbar">
        <div className="et-scope-row">
          <div>
            <h2 className="et-scope-title">
              {viewingCreated ? "Tasks assigned by me" : "Tasks assigned to me"}
            </h2>
            <div className="et-scope-sub">
              {viewingCreated
                ? "Open any card to inspect the full handoff."
                : "Open any assigned card to inspect the full task."}
            </div>
          </div>
          <div className="et-tabs" role="tablist" aria-label="Task scope">
            {SCOPE_TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={scope === item.key}
                data-active={scope === item.key}
                className="et-tab"
                onClick={() => handleScopeChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="et-filter-row">
          <div className="et-tabs" role="tablist" aria-label="Date range">
            {RANGE_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={range === item.key}
                data-active={range === item.key}
                className="et-tab"
                onClick={() => setRange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="et-select"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.label} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="et-loading">
          <div className="et-spinner" />
          <span>Loading tasks...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="et-empty">
          <h3>No tasks found</h3>
          <p>Change the filters to see other tasks.</p>
        </div>
      ) : (
        <div className="et-summary-grid">
          {tasks.map((task) => (
            <TaskSummaryCard
              key={task._id}
              task={task}
              onOpen={() => navigate(`/employee-dashboard/my-tasks/${task._id}`, { state: { task } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeTaskDetails({ taskId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { employeeAdmin } = useEmployeeAdmin();
  const [task, setTask] = useState(location.state?.task || null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const currentUserId = employeeAdmin?._id || employeeAdmin?.id;

  useEffect(() => {
    let active = true;
    setLoading(!task);
    api
      .get(`/api/employee-admin/tasks/${taskId}`)
      .then((res) => {
        if (!active) return;
        setTask(res.data);
      })
      .catch((err) => {
        if (!active) return;
        if (location.state?.task) {
          setTask(location.state.task);
          setMessage({ type: "", text: "" });
          return;
        }
        setMessage({
          type: "error",
          text: err.response?.data?.msg || "Could not load task details.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [taskId]);

  const updateStatus = async (nextStatus) => {
    setMessage({ type: "", text: "" });
    try {
      const res = await api.put(`/api/employee-admin/tasks/${taskId}/status`, {
        status: nextStatus,
      });
      setTask(res.data);
      setMessage({ type: "success", text: "Task status updated." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.msg || "Could not update task status.",
      });
    }
  };

  return (
    <div className="et-page et-page--detail">
      <button
        type="button"
        className="et-back-link"
        onClick={() => navigate("/employee-dashboard/my-tasks")}
      >
        <BackIcon />
        My Tasks
      </button>

      {message.text && (
        <div className={`et-alert et-alert--${message.type === "success" ? "success" : "error"}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="et-loading">
          <div className="et-spinner" />
          <span>Loading task details...</span>
        </div>
      ) : !task ? (
        <div className="et-empty">
          <h3>Task not found</h3>
          <p>The task may have been removed or you may not have access.</p>
        </div>
      ) : (
        <TaskWorkspace task={task} currentUserId={currentUserId} onStatusChange={updateStatus} />
      )}
    </div>
  );
}

function TaskWorkspace({ task, currentUserId, onStatusChange }) {
  const canUpdate = String(task.assignedTo?._id) === String(currentUserId);
  const attachments = task.attachments || [];
  const subtasks = task.subtasks || [];
  const tags = task.tags || [];

  return (
    <article className="et-workspace">
      <header className="et-workspace__header">
        <span className="et-workspace__kicker">{task.department || "General"}</span>
        <div className="et-workspace__title-row">
          <h1 className="et-workspace__title">{task.title || "Untitled task"}</h1>
          <div className="et-workspace__badges">
            <span className={`et-pill et-pill--${priorityTone(task.priority)}`}>
              <span className="et-pill__dot" aria-hidden="true" />
              {task.priority || "Medium"}
            </span>
            <span className={`et-pill et-pill--${statusTone(task.status)}`}>
              <span className="et-pill__dot" aria-hidden="true" />
              {task.status || "Pending"}
            </span>
          </div>
        </div>
        <div className="et-workspace__meta">
          Created {formatDate(task.createdAt)} · Assigned by {task.createdBy?.name || "-"}
        </div>
      </header>

      <div className="et-status-strip">
        <span className="et-status-strip__label">Status</span>
        {canUpdate ? (
          <div className="et-status-set" role="radiogroup" aria-label="Update status">
            {STATUSES.map((statusOption) => (
              <button
                key={statusOption.value}
                type="button"
                role="radio"
                aria-checked={task.status === statusOption.value}
                data-active={task.status === statusOption.value}
                data-tone={statusOption.tone}
                className="et-status-opt"
                onClick={() => task.status !== statusOption.value && onStatusChange(statusOption.value)}
              >
                {statusOption.value}
              </button>
            ))}
          </div>
        ) : (
          <span className="et-status-strip__note">
            <span className={`et-pill et-pill--${statusTone(task.status)}`}>
              {task.status || "Pending"}
            </span>
            Only the assignee can change this.
          </span>
        )}
      </div>

      <div className="et-workspace__body">
        <div className="et-main">
          <section className="et-section">
            <h2 className="et-section__title">Description</h2>
            {hasText(task.description) ? (
              <p className="et-section__text">{task.description}</p>
            ) : (
              <EmptyValue text="No description added" />
            )}
          </section>

          {hasText(task.comment) && (
            <section className="et-section et-section--muted">
              <h2 className="et-section__title">Comment</h2>
              <p className="et-section__text et-section__text--muted">{task.comment}</p>
            </section>
          )}

          <section className="et-section">
            <h2 className="et-section__title">Tags</h2>
            {tags.length > 0 ? (
              <div className="et-chips">
                {tags.map((tag) => (
                  <span key={tag} className="et-chip">{tag}</span>
                ))}
              </div>
            ) : (
              <EmptyValue text="No tags added" />
            )}
          </section>

          <section className="et-section">
            <h2 className="et-section__title">
              Attachments
              <span className="et-section__count">{attachments.length}</span>
            </h2>
            <AttachmentList attachments={attachments} />
          </section>

          <section className="et-section">
            <div className="et-section__head">
              <h2 className="et-section__title">Subtasks</h2>
              {subtasks.length > 0 && (
                <span className="et-section__hint">{subtasks.length} total</span>
              )}
            </div>
            {subtasks.length > 0 ? (
              <div className="et-subtasks">
                {subtasks.map((subtask, index) => (
                  <SubtaskItem
                    key={subtask._id || `subtask-${index}`}
                    subtask={subtask}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <EmptyValue text="No subtasks added" />
            )}
          </section>
        </div>

        <TaskSidebar task={task} />
      </div>
    </article>
  );
}

function TaskSidebar({ task }) {
  const attachments = task.attachments || [];
  const subtasks = task.subtasks || [];
  const due = dueInfo(task.dueDate, task.status);

  return (
    <aside className="et-sidebar">
      <div className="et-sidebar__panel">
        <h3 className="et-sidebar__title">Task details</h3>

        <div className="et-detail-row">
          <span className="et-detail-row__label">Assignee</span>
          <div className="et-detail-row__person">
            <span className="et-avatar et-avatar--sm">{initialsFor(task.assignedTo?.name)}</span>
            <div>
              <div className="et-detail-row__value">{task.assignedTo?.name || "-"}</div>
              {task.assignedTo?.email && (
                <div className="et-detail-row__sub">{task.assignedTo.email}</div>
              )}
            </div>
          </div>
        </div>

        <div className="et-detail-row">
          <span className="et-detail-row__label">Assigned by</span>
          <div className="et-detail-row__person">
            <span className="et-avatar et-avatar--sm">{initialsFor(task.createdBy?.name)}</span>
            <div className="et-detail-row__value">{task.createdBy?.name || "-"}</div>
          </div>
        </div>

        <div className="et-detail-row">
          <span className="et-detail-row__label">Priority</span>
          <span className={`et-pill et-pill--${priorityTone(task.priority)}`}>
            <span className="et-pill__dot" aria-hidden="true" />
            {task.priority || "Medium"}
          </span>
        </div>

        <div className="et-detail-row">
          <span className="et-detail-row__label">Department</span>
          <span className="et-detail-row__value">{task.department || "General"}</span>
        </div>

        <div className="et-detail-row et-detail-row--split">
          <div>
            <span className="et-detail-row__label">Start date</span>
            <span className="et-detail-row__value">{formatDate(task.startDate)}</span>
          </div>
          <div>
            <span className="et-detail-row__label">Due date</span>
            <span className="et-detail-row__value">{formatDate(task.dueDate)}</span>
            {due && (
              <span className="et-due-tag" data-tone={due.tone}>{due.label}</span>
            )}
          </div>
        </div>

        <div className="et-detail-row">
          <span className="et-detail-row__label">Created</span>
          <span className="et-detail-row__value">{formatDateTime(task.createdAt)}</span>
        </div>
      </div>

      <div className="et-sidebar__panel">
        <h3 className="et-sidebar__title">Task progress</h3>
        <div className="et-progress-row">
          <span className="et-progress-row__label">Subtasks</span>
          <span className="et-progress-row__value">{subtasks.length} total</span>
        </div>
        <div className="et-progress-row">
          <span className="et-progress-row__label">Attachments</span>
          <span className="et-progress-row__value">{attachments.length} files</span>
        </div>
      </div>
    </aside>
  );
}

function TaskSummaryCard({ task, onOpen }) {
  return (
    <button type="button" className="et-summary-card" onClick={onOpen}>
      <div className="et-summary-card__top">
        <h3>{task.title || "Untitled task"}</h3>
        <span className={`et-pill et-pill--${statusTone(task.status)}`}>{task.status || "Pending"}</span>
      </div>
      <p>{hasText(task.description) ? task.description : "No description added."}</p>
      <span className="et-summary-card__open">Open details</span>
    </button>
  );
}

function EmptyValue({ text = "Not added" }) {
  return <div className="et-empty-value">{text}</div>;
}

function AttachmentList({ attachments }) {
  if (!attachments.length) {
    return <EmptyValue text="No attachments added" />;
  }

  return (
    <div className="et-attachments">
      {attachments.map((attachment, index) => (
        <div className="et-attachment" key={`${attachment.name}-${index}`}>
          <span className="et-attachment__icon">{extOf(attachment.name)}</span>
          <span className="et-attachment__name" title={attachment.name}>{attachment.name}</span>
          {attachment.size && <span className="et-attachment__size">{attachment.size}</span>}
        </div>
      ))}
    </div>
  );
}

function SubtaskItem({ subtask, index }) {
  const [open, setOpen] = useState(false);
  const attachments = subtask.attachments || [];

  return (
    <div className="et-subtask" data-open={open}>
      <button
        type="button"
        className="et-subtask__head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="et-subtask__num">{String(index + 1).padStart(2, "0")}</span>
        <span className="et-subtask__title">{subtask.title || "Untitled subtask"}</span>
        <ChevronIcon className="et-subtask__chevron" />
      </button>

      {open && (
        <div className="et-subtask__body">
          <div className="et-subtask__field">
            <span className="et-subtask__field-label">Description</span>
            {hasText(subtask.description) ? (
              <p className="et-subtask__field-text">{subtask.description}</p>
            ) : (
              <EmptyValue text="No description added" />
            )}
          </div>
          <div className="et-subtask__field">
            <span className="et-subtask__field-label">Comment</span>
            {hasText(subtask.comment) ? (
              <p className="et-subtask__field-text">{subtask.comment}</p>
            ) : (
              <EmptyValue text="No comment added" />
            )}
          </div>
          <div className="et-subtask__field">
            <span className="et-subtask__field-label">Attachments</span>
            <AttachmentList attachments={attachments} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone, icon }) {
  return (
    <div className={`et-stat et-stat--${tone}`}>
      <div className="et-stat__icon">{icon}</div>
      <div>
        <div className="et-stat__value">{value}</div>
        <div className="et-stat__label">{label}</div>
      </div>
    </div>
  );
}

function TaskIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
