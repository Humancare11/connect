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
    <div className="et-page">
      <header className="et-header et-detail-header">
        <button type="button" className="et-back-btn" onClick={() => navigate("/employee-dashboard/my-tasks")}>
          Back to tasks
        </button>
        <span className="et-eyebrow">Task details</span>
        <h1 className="et-title">{task?.title || "Task details"}</h1>
        <p className="et-sub">Full task information is shown here after opening a task card.</p>
      </header>

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
        <TaskDetailsCard task={task} currentUserId={currentUserId} onStatusChange={updateStatus} />
      )}
    </div>
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

function TaskDetailsCard({ task, currentUserId, onStatusChange }) {
  const canUpdate = String(task.assignedTo?._id) === String(currentUserId);
  const attachments = task.attachments || [];
  const subtasks = task.subtasks || [];
  const tags = task.tags || [];
  const due = dueInfo(task.dueDate, task.status);

  return (
    <article className="et-card">
      <div className="et-card__top">
        <div className="et-card__title-wrap">
          <span className="et-card__kicker">{task.department || "General"}</span>
          <h3 className="et-card__title">{task.title || "Untitled task"}</h3>
          <div className="et-card__created">Created {formatDateTime(task.createdAt)}</div>
        </div>
        <div className="et-card__badges">
          <span className={`et-pill et-pill--${priorityTone(task.priority)}`}>
            <span className="et-pill__dot" aria-hidden="true" />
            {task.priority || "Medium"}
          </span>
          <span className={`et-pill et-pill--${statusTone(task.status)}`}>
            {task.status || "Pending"}
          </span>
        </div>
      </div>

      <div className="et-field-grid">
        <TaskField label="Department" value={task.department || "General"} />
        <TaskField label="Task name" value={task.title || "Untitled task"} />
        <TaskField label="Priority" value={task.priority || "Medium"} />
        <TaskField label="Status" value={task.status || "Pending"} />
        <TaskField label="Start date" value={formatDate(task.startDate)} />
        <TaskField label="Due date" value={formatDate(task.dueDate)} />
        <TaskField label="Assigned to user" value={task.assignedTo?.name} />
        <TaskField label="Assigned by" value={task.createdBy?.name} />
        <TaskField label="Created" value={formatDateTime(task.createdAt)} />
      </div>

      <div className="et-people">
        <PersonRow role="Assigned to" person={task.assignedTo} />
        <PersonRow role="Assigned by" person={task.createdBy} />
      </div>

      <div className="et-dates">
        <div className="et-date">
          <span className="et-date__label">Start</span>
          <span className="et-date__value">{formatDate(task.startDate)}</span>
        </div>
        <span className="et-date__arrow" aria-hidden="true">to</span>
        <div className="et-date">
          <span className="et-date__label">Due</span>
          <span className="et-date__value">{formatDate(task.dueDate)}</span>
        </div>
        {due && (
          <span className="et-date__remaining" data-tone={due.tone}>
            {due.label}
          </span>
        )}
      </div>

      <TextBlock label="Description" value={task.description} />
      <TextBlock label="Comment" value={task.comment} />

      <div className="et-block">
        <div className="et-block__label">Tags</div>
        {tags.length > 0 ? (
          <div className="et-chips">
            {tags.map((tag) => (
              <span key={tag} className="et-chip">{tag}</span>
            ))}
          </div>
        ) : (
          <EmptyValue text="No tags added" />
        )}
      </div>

      <div className="et-block">
        <div className="et-block__label">
          Attachments
          <span className="et-block__count">{attachments.length}</span>
        </div>
        <AttachmentList attachments={attachments} />
      </div>

      <div className="et-block">
        <div className="et-block__label">
          Subtasks
          <span className="et-block__count">{subtasks.length}</span>
        </div>
        {subtasks.length > 0 ? (
          <div className="et-subtasks">
            {subtasks.map((subtask, index) => (
              <SubtaskCard
                key={subtask._id || `subtask-${index}`}
                subtask={subtask}
                index={index}
              />
            ))}
          </div>
        ) : (
          <EmptyValue text="No subtasks added" />
        )}
      </div>

      <div className="et-card__footer">
        <div className="et-card__footer-note">
          {canUpdate
            ? "Update your status as work progresses."
            : "Only the assignee can change the status."}
        </div>
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
          <span className={`et-pill et-pill--${statusTone(task.status)}`}>
            {task.status || "Pending"}
          </span>
        )}
      </div>
    </article>
  );
}

function PersonRow({ role, person }) {
  const name = person?.name || "-";
  return (
    <div className="et-person">
      <span className="et-avatar">{initialsFor(person?.name)}</span>
      <div className="et-person__body">
        <span className="et-person__role">{role}</span>
        <span className="et-person__name" title={name}>{name}</span>
      </div>
    </div>
  );
}

function TaskField({ label, value }) {
  return (
    <div className="et-field-item">
      <span className="et-field-item__label">{label}</span>
      <strong className="et-field-item__value">{hasText(value) && value !== "-" ? value : "Not added"}</strong>
    </div>
  );
}

function TextBlock({ label, value }) {
  return (
    <div className="et-block">
      <div className="et-block__label">{label}</div>
      {hasText(value) ? (
        <p className="et-block__text">{value}</p>
      ) : (
        <EmptyValue text={`${label} not added`} />
      )}
    </div>
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

function SubtaskCard({ subtask, index }) {
  const attachments = subtask.attachments || [];
  return (
    <div className="et-subtask">
      <div className="et-subtask__head">
        <span className="et-subtask__num">{String(index + 1).padStart(2, "0")}</span>
        <span className="et-subtask__title">{subtask.title || "Untitled subtask"}</span>
      </div>

      <div className="et-field-grid et-field-grid--subtask">
        <TaskField label="Task name" value={subtask.title || "Untitled subtask"} />
      </div>

      <TextBlock label="Description" value={subtask.description} />
      <TextBlock label="Comment" value={subtask.comment} />

      <div className="et-block">
        <div className="et-block__label">
          Attachments
          <span className="et-block__count">{attachments.length}</span>
        </div>
        <AttachmentList attachments={attachments} />
      </div>
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
