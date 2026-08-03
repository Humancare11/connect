import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { uploadFileDirectToS3 } from "../../utils/directUpload";
import { useEmployeeAdmin } from "../../context/EmployeeAdminContext";
import "./Assigntask.css";

const PRIORITIES = [
  { value: "Low", label: "Low", tone: "low" },
  { value: "Medium", label: "Medium", tone: "medium" },
  { value: "High", label: "High", tone: "high" },
  { value: "Urgent", label: "Critical", tone: "urgent" },
];

const DEPARTMENTS = [
  "Operations",
  "Support",
  "Medical",
  "Billing",
  "Technology",
  "Administration",
];

const DRAFT_KEY = "at:draft:v1";
const FORM_ID = "assign-task-form";

const emptyForm = {
  department: "",
  title: "",
  description: "",
  comment: "",
  attachments: [],
  startDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  priority: "Medium",
  tags: [],
  assignedTo: "",
};

const TAG_COLORS = ["violet", "teal", "amber", "rose", "blue"];

function colorForTag(tag = "") {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length];
}

function initialsFor(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "EA"
  );
}

async function uploadFilesToTaskStorage(fileList, assigneeId) {
  const files = Array.from(fileList || []);
  const results = [];

  for (const file of files) {
    const size = `${(file.size / 1024).toFixed(1)} KB`;
    try {
      const uploaded = await uploadFileDirectToS3(file, {
        ownerType: "employee-task",
        ownerId: assigneeId,
      });
      // Store the raw S3 key (not the bucket URL) so the app's URL
      // normalizer rewrites it to the authenticated /api/uploads proxy —
      // the bucket itself is private and rejects direct, unauthenticated reads.
      results.push({
        name: uploaded.name || file.name,
        size,
        url: uploaded.key,
        key: uploaded.key,
        type: uploaded.type || file.type,
      });
    } catch (err) {
      results.push({
        name: file.name,
        size,
        error: err?.response?.data?.msg || err?.message || "Upload failed.",
      });
    }
  }

  return results;
}

function extOf(name = "") {
  const dot = name.lastIndexOf(".");
  return dot >= 0
    ? name
        .slice(dot + 1)
        .toUpperCase()
        .slice(0, 4)
    : "FILE";
}

function relativeFromNow(timestamp) {
  if (!timestamp) return "";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function formatDateDisplay(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AssignTask() {
  const navigate = useNavigate();
  const { employeeAdmin } = useEmployeeAdmin();
  const currentUserId = employeeAdmin?._id || employeeAdmin?.id;
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const assignableEmployees = useMemo(
    () => employees.filter((employee) => String(employee._id) !== String(currentUserId)),
    [employees, currentUserId],
  );

  const selectedEmployee = useMemo(
    () => assignableEmployees.find((employee) => employee._id === form.assignedTo),
    [assignableEmployees, form.assignedTo],
  );

  useEffect(() => {
    if (form.assignedTo || !assignableEmployees.length) return;
    setForm((prev) => ({ ...prev, assignedTo: prev.assignedTo || assignableEmployees[0]._id }));
  }, [assignableEmployees, form.assignedTo]);

  const priorityMeta = PRIORITIES.find((p) => p.value === form.priority);
  const priorityTone = priorityMeta?.tone || "medium";

  const titleError = submitAttempted && !form.title.trim() ? "Task title is required." : "";
  const departmentError = submitAttempted && !form.department ? "Department is required." : "";
  const assigneeError = submitAttempted && !form.assignedTo ? "Assignee is required." : "";

  useEffect(() => {
    let active = true;

    api
      .get("/api/employee-admin/employees")
      .then((res) => {
        if (!active) return;
        const list = res.data || [];
        setEmployees(list);
      })
      .catch(() => {
        if (active)
          setMessage({ type: "error", text: "Could not load employees." });
      })
      .finally(() => {
        if (active) setLoadingEmployees(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Restore an unsaved draft from this device, if one exists.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.form) {
        setForm((prev) => ({ ...prev, ...draft.form, assignedTo: prev.assignedTo || draft.form.assignedTo || "" }));
      }
      if (draft?.savedAt) setDraftSavedAt(draft.savedAt);
    } catch {
      // ignore a malformed/corrupted draft
    }
  }, []);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = (tag) => {
    if (!tag || form.tags.includes(tag)) return;
    setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
  };

  const removeTag = (tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const saveDraft = () => {
    const savedAt = Date.now();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, savedAt }));
      setDraftSavedAt(savedAt);
      setMessage({ type: "success", text: "Draft saved on this device." });
    } catch {
      setMessage({ type: "error", text: "Could not save draft." });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setMessage({ type: "", text: "" });

    if (!form.title.trim() || !form.department || !form.assignedTo) {
      setMessage({ type: "error", text: "Please complete the required fields before assigning." });
      return;
    }

    setSaving(true);

    const payload = {
      department: form.department,
      title: form.title,
      description: form.description,
      comment: form.comment,
      attachments: form.attachments.filter((file) => !file.error),
      startDate: form.startDate,
      dueDate: form.dueDate,
      priority: form.priority,
      tags: form.tags,
      assignedTo: form.assignedTo,
    };

    try {
      await api.post("/api/employee-admin/tasks", payload);
      setForm((prev) => ({ ...emptyForm, assignedTo: prev.assignedTo }));
      setMessage({ type: "success", text: "Task assigned successfully." });
      setSubmitAttempted(false);
      localStorage.removeItem(DRAFT_KEY);
      setDraftSavedAt(null);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.msg || "Could not assign task.",
      });
    } finally {
      setSaving(false);
    }
  };

  const goToTasks = () => navigate("/employee-dashboard/my-tasks");
  const canSubmit = !saving && !loadingEmployees && !!assignableEmployees.length && !!form.assignedTo;

  return (
    <div className="at-page">
      <header className="at-header">
        <div className="at-header__intro">
          <span className="at-eyebrow">Task Master</span>
          <h1 className="at-title">Assign a new task</h1>
          <p className="at-sub">Create and assign work to your team.</p>
        </div>
        <div className="at-header__actions">
          <button type="button" className="at-btn at-btn--subtle at-btn--small" onClick={goToTasks}>
            Cancel
          </button>
          <button type="button" className="at-btn at-btn--ghost at-btn--small" onClick={saveDraft}>
            Save Draft
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="at-btn at-btn--primary at-btn--small"
            disabled={!canSubmit}
          >
            {saving ? "Assigning…" : "Assign Task"}
          </button>
        </div>
      </header>

      {message.text && (
        <div
          className={`at-alert at-alert--${message.type === "success" ? "success" : "error"}`}
        >
          {message.text}
        </div>
      )}

      <form id={FORM_ID} className="at-form" onSubmit={handleSubmit}>
        <div className="at-workspace">
          {/* ---------- Main content: one cohesive workspace ---------- */}
          <div className="at-workspace-main">
            <div className="at-titleblock">
              <label className="at-label" htmlFor="at-title-input">
                Task<span className="at-label__req">*</span>
              </label>
              <input
                id="at-title-input"
                className="at-title-input"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="e.g. Follow up on Healthcare partnership"
                maxLength={140}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? "at-title-error" : undefined}
              />
              <div className="at-titleblock__meta">
                {form.department && (
                  <span className="at-titleblock__chip">{form.department}</span>
                )}
                <span className="at-titleblock__count">{form.title.length}/140</span>
              </div>
              {titleError && (
                <span id="at-title-error" className="at-field-error">
                  {titleError}
                </span>
              )}
            </div>

            <div className="at-divider" />

            <section className="at-section">
              <div className="at-section__head">
                <h2 className="at-section__title">Description</h2>
              </div>
              <DescriptionEditor
                id="at-desc"
                value={form.description}
                onChange={(value) => setField("description", value)}
                placeholder="Write a description — add context, requirements, links, etc."
                maxLength={2000}
              />
            </section>

            <div className="at-divider" />

            <section className="at-section at-section--compact">
              <div className="at-section__head">
                <h2 className="at-section__title">Comment</h2>
                <span className="at-section__hint">Optional note for the assignee</span>
              </div>
              <textarea
                id="at-comment"
                className="at-comment-input"
                value={form.comment}
                onChange={(event) => setField("comment", event.target.value)}
                placeholder="Add a note for the assignee…"
                maxLength={2000}
              />
            </section>

            <div className="at-divider" />

            <section className="at-section">
              <div className="at-section__head">
                <h2 className="at-section__title">Attachments</h2>
                {form.attachments.length > 0 && (
                  <span className="at-section__count">{form.attachments.length}</span>
                )}
              </div>
              <AttachmentDropzone
                id="at-files"
                attachments={form.attachments}
                assigneeId={form.assignedTo}
                onAdd={(files) => setField("attachments", [...form.attachments, ...files])}
                onRemove={(index) =>
                  setField(
                    "attachments",
                    form.attachments.filter((_, i) => i !== index),
                  )
                }
              />
            </section>
          </div>

          {/* ---------- Properties panel: task control center ---------- */}
          <aside className="at-panel">
            <div className="at-panel__group">
              <h3 className="at-panel__title">Task details</h3>

              <div className="at-panel__field">
                <label className="at-label" htmlFor="at-priority">
                  Priority
                </label>
                <div className="at-priority-select" data-tone={priorityTone}>
                  <span className="at-priority-select__dot" aria-hidden="true" />
                  <select
                    id="at-priority"
                    className="at-select at-select--priority"
                    value={form.priority}
                    onChange={(event) => setField("priority", event.target.value)}
                    aria-label="Priority"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="at-panel__field">
                <label className="at-label" htmlFor="at-department">
                  Department<span className="at-label__req">*</span>
                </label>
                <select
                  id="at-department"
                  className="at-select"
                  value={form.department}
                  onChange={(event) => setField("department", event.target.value)}
                  aria-invalid={!!departmentError}
                  aria-describedby={departmentError ? "at-department-error" : undefined}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                {departmentError && (
                  <span id="at-department-error" className="at-field-error">
                    {departmentError}
                  </span>
                )}
              </div>

              <div className="at-panel__field">
                <label className="at-label">
                  Assignee<span className="at-label__req">*</span>
                </label>
                <AssigneeSelector
                  employees={assignableEmployees}
                  loading={loadingEmployees}
                  selectedId={form.assignedTo}
                  onSelect={(id) => setField("assignedTo", id)}
                />
                {assigneeError && <span className="at-field-error">{assigneeError}</span>}
              </div>

              <div className="at-panel__field">
                <label className="at-label" htmlFor="at-start">
                  Start date
                </label>
                <div className="at-date-field">
                  <CalendarIcon />
                  <input
                    id="at-start"
                    className="at-input at-input--date"
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setField("startDate", event.target.value)}
                  />
                </div>
              </div>

              <div className="at-panel__field">
                <label className="at-label" htmlFor="at-due">
                  Due date
                </label>
                <div className="at-date-field">
                  <CalendarIcon />
                  <input
                    id="at-due"
                    className="at-input at-input--date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setField("dueDate", event.target.value)}
                    min={form.startDate}
                  />
                </div>
              </div>

              <div className="at-panel__field">
                <label className="at-label">Tags</label>
                <TagInput tags={form.tags} onAdd={addTag} onRemove={removeTag} />
              </div>
            </div>

            <div className="at-panel__divider" />

            <div className="at-panel__group">
              <h3 className="at-panel__title">Task summary</h3>
              <dl className="at-summary">
                <div className="at-summary__row">
                  <dt>Priority</dt>
                  <dd>
                    <span className="at-summary__dot" data-tone={priorityTone} aria-hidden="true" />
                    {priorityMeta?.label || form.priority}
                  </dd>
                </div>
                <div className="at-summary__row">
                  <dt>Assignee</dt>
                  <dd>{selectedEmployee?.name || "Not assigned"}</dd>
                </div>
                <div className="at-summary__row">
                  <dt>Department</dt>
                  <dd>{form.department || "Not set"}</dd>
                </div>
                <div className="at-summary__row">
                  <dt>Due date</dt>
                  <dd>{formatDateDisplay(form.dueDate)}</dd>
                </div>
                <div className="at-summary__row">
                  <dt>Attachments</dt>
                  <dd>{form.attachments.length} files</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>

        {/* ---------- Sticky action bar ---------- */}
        <div className="at-actions">
          <div className="at-actions__status">
            <span className="at-actions__status-main">
              {selectedEmployee ? (
                <>
                  Assigning <strong>{form.title || "this task"}</strong> to{" "}
                  <strong>{selectedEmployee.name}</strong>
                </>
              ) : (
                "Pick a teammate to continue"
              )}
            </span>
            {draftSavedAt && (
              <span className="at-actions__status-sub">
                Draft saved {relativeFromNow(draftSavedAt)}
              </span>
            )}
          </div>
          <div className="at-actions__buttons">
            <button type="button" className="at-btn at-btn--subtle" onClick={goToTasks}>
              Cancel
            </button>
            <button type="button" className="at-btn at-btn--ghost" onClick={saveDraft}>
              Save Draft
            </button>
            <button type="submit" className="at-btn at-btn--primary" disabled={!canSubmit}>
              {saving ? "Assigning…" : "Assign Task"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Description editor — plain-text field with a lightweight
   formatting toolbar that inserts markdown-style syntax.
   ============================================================ */
function wrapSelection(textareaRef, value, onChange, before, after = before, placeholder = "text") {
  const el = textareaRef.current;
  if (!el) return;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const cursor = start + before.length + selected.length + after.length;
    el.setSelectionRange(cursor, cursor);
  });
}

function insertLinePrefix(textareaRef, value, onChange, prefix) {
  const el = textareaRef.current;
  if (!el) return;
  const start = el.selectionStart ?? value.length;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const cursor = start + prefix.length;
    el.setSelectionRange(cursor, cursor);
  });
}

function DescriptionEditor({ id, value, onChange, placeholder, maxLength }) {
  const textareaRef = useRef(null);

  return (
    <div className="at-editor">
      <div className="at-editor__toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          className="at-editor__btn at-editor__btn--bold"
          title="Bold"
          onClick={() => wrapSelection(textareaRef, value, onChange, "**")}
        >
          B
        </button>
        <button
          type="button"
          className="at-editor__btn at-editor__btn--italic"
          title="Italic"
          onClick={() => wrapSelection(textareaRef, value, onChange, "_")}
        >
          I
        </button>
        <span className="at-editor__divider" aria-hidden="true" />
        <button
          type="button"
          className="at-editor__btn"
          title="Bullet list"
          aria-label="Bullet list"
          onClick={() => insertLinePrefix(textareaRef, value, onChange, "- ")}
        >
          •
        </button>
        <button
          type="button"
          className="at-editor__btn"
          title="Numbered list"
          aria-label="Numbered list"
          onClick={() => insertLinePrefix(textareaRef, value, onChange, "1. ")}
        >
          1.
        </button>
        <span className="at-editor__divider" aria-hidden="true" />
        <button
          type="button"
          className="at-editor__btn"
          title="Link"
          aria-label="Insert link"
          onClick={() =>
            wrapSelection(textareaRef, value, onChange, "[", "](https://)", "link text")
          }
        >
          <LinkIcon />
        </button>
      </div>
      <textarea
        id={id}
        ref={textareaRef}
        className="at-editor__textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-label="Description"
      />
      <div className="at-foot">
        {value.length}/{maxLength}
      </div>
    </div>
  );
}

/* ============================================================
   Attachments — compact drag-and-drop dropzone.
   ============================================================ */
function AttachmentDropzone({ id, attachments, onAdd, onRemove, assigneeId, compact = false }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    try {
      const uploaded = await uploadFilesToTaskStorage(fileList, assigneeId);
      onAdd(uploaded);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="at-dropzone-wrap">
      <label
        className="at-dropzone"
        htmlFor={id}
        data-dragging={dragging}
        data-compact={compact}
        data-busy={uploading}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (uploading) return;
          handleFiles(event.dataTransfer.files);
        }}
      >
        <UploadIcon />
        <span className="at-dropzone__text">
          <strong>{uploading ? "Uploading…" : "Drop files here"}</strong> {!uploading && "or browse"}
          {!compact && !uploading && <em>PDF, DOC, PNG, JPG</em>}
        </span>
        <input
          id={id}
          type="file"
          multiple
          disabled={uploading}
          onChange={(event) => {
            const { files } = event.target;
            event.target.value = "";
            handleFiles(files);
          }}
        />
      </label>
      <AttachmentList attachments={attachments} onRemove={onRemove} />
    </div>
  );
}

function AttachmentList({ attachments, onRemove }) {
  if (!attachments.length) return null;

  return (
    <div className="at-attachments">
      {attachments.map((attachment, index) => (
        <div key={`${attachment.name}-${index}`} className="at-attachment" data-error={!!attachment.error}>
          <span className="at-attachment__icon">{extOf(attachment.name)}</span>
          <span className="at-attachment__name">{attachment.name}</span>
          {attachment.error ? (
            <span className="at-attachment__error">{attachment.error}</span>
          ) : (
            <span className="at-attachment__size">{attachment.size}</span>
          )}
          <button
            type="button"
            className="at-attachment__remove"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${attachment.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Assignee — compact selector with search.
   ============================================================ */
function AssigneeSelector({ employees, loading, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const selected = employees.find((employee) => employee._id === selectedId);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (loading) {
    return (
      <div className="at-loading">
        <div className="at-spinner" />
        <span>Loading team…</span>
      </div>
    );
  }

  if (!employees.length) {
    return (
      <div className="at-empty at-empty--compact">
        <p>No employees found.</p>
      </div>
    );
  }

  const filtered = employees.filter((employee) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      employee.name.toLowerCase().includes(q) || employee.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="at-assignee" ref={containerRef}>
      <button
        type="button"
        className="at-assignee__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span className="at-assignee__avatar">{initialsFor(selected.name)}</span>
            <span className="at-assignee__body">
              <span className="at-assignee__name">{selected.name}</span>
              <span className="at-assignee__email">{selected.email}</span>
            </span>
          </>
        ) : (
          <>
            <SearchIcon />
            <span className="at-assignee__placeholder">Search team member…</span>
          </>
        )}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="at-assignee__panel" role="listbox">
          <div className="at-assignee__searchbar">
            <SearchIcon />
            <input
              autoFocus
              className="at-assignee__search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team members"
            />
          </div>
          <div className="at-assignee__list">
            {filtered.length === 0 && <div className="at-assignee__none">No matches</div>}
            {filtered.map((employee) => (
              <button
                type="button"
                key={employee._id}
                className="at-assignee__option"
                data-active={employee._id === selectedId}
                onClick={() => {
                  onSelect(employee._id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="at-assignee__avatar">{initialsFor(employee.name)}</span>
                <span className="at-assignee__body">
                  <span className="at-assignee__name">{employee.name}</span>
                  <span className="at-assignee__email">{employee.email}</span>
                </span>
                {employee._id === selectedId && (
                  <span className="at-assignee__check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Tags — compact chip input.
   ============================================================ */
function TagInput({ tags, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commit = () => {
    const next = value.trim();
    if (next) onAdd(next);
    setValue("");
    setAdding(false);
  };

  return (
    <div className="at-tagfield">
      {tags.map((tag) => (
        <button
          type="button"
          key={tag}
          className="at-chip"
          data-color={colorForTag(tag)}
          onClick={() => onRemove(tag)}
          aria-label={`Remove tag ${tag}`}
        >
          {tag}
          <span className="at-chip__x" aria-hidden="true">
            ×
          </span>
        </button>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          className="at-tagfield__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setValue("");
              setAdding(false);
            }
          }}
          onBlur={commit}
          placeholder="Tag name"
        />
      ) : (
        <button type="button" className="at-tagfield__add" onClick={() => setAdding(true)}>
          + Add tag
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Icons
   ============================================================ */
function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="at-chevron"
      data-open={open}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="at-search-icon"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
