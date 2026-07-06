import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Assigntask.css";

const PRIORITIES = [
    { value: "Low", tone: "low" },
    { value: "Medium", tone: "medium" },
    { value: "High", tone: "high" },
    { value: "Urgent", tone: "urgent" },
];

const DEPARTMENTS = [
    "Operations",
    "Support",
    "Medical",
    "Billing",
    "Technology",
    "Administration",
];

const emptyForm = {
    department: "",
    title: "",
    description: "",
    comment: "",
    attachments: [],
    subtasks: [],
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "Medium",
    tags: [],
    tagInput: "",
    assignedTo: "",
};

const emptySubtask = {
    title: "",
    description: "",
    comment: "",
    attachments: [],
};

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

function filesToMetadata(fileList) {
    return Array.from(fileList || []).map((file) => ({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
    }));
}

function extOf(name = "") {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

export default function AssignTask() {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [loadingEmployees, setLoadingEmployees] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const selectedEmployee = useMemo(
        () => employees.find((employee) => employee._id === form.assignedTo),
        [employees, form.assignedTo],
    );

    useEffect(() => {
        let active = true;

        api
            .get("/api/employee-admin/employees")
            .then((res) => {
                if (!active) return;
                const list = res.data || [];
                setEmployees(list);
                setForm((prev) => ({
                    ...prev,
                    assignedTo: prev.assignedTo || list[0]?._id || "",
                }));
            })
            .catch(() => {
                if (active) setMessage({ type: "error", text: "Could not load employees." });
            })
            .finally(() => {
                if (active) setLoadingEmployees(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const setField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const addTag = () => {
        const nextTag = form.tagInput.trim();
        if (!nextTag || form.tags.includes(nextTag)) return;
        setForm((prev) => ({ ...prev, tags: [...prev.tags, nextTag], tagInput: "" }));
    };

    const addSubtask = () => {
        setForm((prev) => ({ ...prev, subtasks: [...prev.subtasks, { ...emptySubtask }] }));
    };

    const updateSubtask = (index, field, value) => {
        setForm((prev) => ({
            ...prev,
            subtasks: prev.subtasks.map((subtask, currentIndex) =>
                currentIndex === index ? { ...subtask, [field]: value } : subtask,
            ),
        }));
    };

    const removeSubtask = (index) => {
        setForm((prev) => ({
            ...prev,
            subtasks: prev.subtasks.filter((_, currentIndex) => currentIndex !== index),
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage({ type: "", text: "" });

        const payload = {
            department: form.department,
            title: form.title,
            description: form.description,
            comment: form.comment,
            attachments: form.attachments,
            subtasks: form.subtasks,
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
        } catch (err) {
            setMessage({
                type: "error",
                text: err.response?.data?.msg || "Could not assign task.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="at-page">
            <header className="at-header">
                <span className="at-eyebrow">Task Master</span>
                <h1 className="at-title">Assign a task</h1>
                <p className="at-sub">
                    Define what needs to be done, who's doing it, and when it's due. Subtasks and attachments are optional.
                </p>
            </header>

            {message.text && (
                <div className={`at-alert at-alert--${message.type === "success" ? "success" : "error"}`}>
                    {message.text}
                </div>
            )}

            <form className="at-form" onSubmit={handleSubmit}>
                {/* ---------- Basics ---------- */}
                <section className="at-section">
                    <div className="at-section__head">
                        <h2 className="at-section__title">Task basics</h2>
                        <span className="at-section__hint">Required to assign</span>
                    </div>

                    <div className="at-grid">
                        <div className="at-field">
                            <label className="at-label" htmlFor="at-department">
                                Department<span className="at-label__req">*</span>
                            </label>
                            <select
                                id="at-department"
                                className="at-select"
                                value={form.department}
                                onChange={(event) => setField("department", event.target.value)}
                                required
                            >
                                <option value="">Select department</option>
                                {DEPARTMENTS.map((department) => (
                                    <option key={department} value={department}>{department}</option>
                                ))}
                            </select>
                        </div>

                        <div className="at-field">
                            <label className="at-label" htmlFor="at-title-input">
                                Task name<span className="at-label__req">*</span>
                            </label>
                            <input
                                id="at-title-input"
                                className="at-input"
                                value={form.title}
                                onChange={(event) => setField("title", event.target.value)}
                                placeholder="e.g. Follow up on Healthcode partnership"
                                maxLength={140}
                                required
                            />
                            <div className="at-foot">{form.title.length}/140</div>
                        </div>

                        <div className="at-field">
                            <label className="at-label" htmlFor="at-start">Start date</label>
                            <input
                                id="at-start"
                                className="at-input"
                                type="date"
                                value={form.startDate}
                                onChange={(event) => setField("startDate", event.target.value)}
                            />
                        </div>

                        <div className="at-field">
                            <label className="at-label" htmlFor="at-due">Due date</label>
                            <input
                                id="at-due"
                                className="at-input"
                                type="date"
                                value={form.dueDate}
                                onChange={(event) => setField("dueDate", event.target.value)}
                                min={form.startDate}
                            />
                        </div>

                        <div className="at-field at-field--full">
                            <label className="at-label">Priority</label>
                            <div className="at-priority" role="radiogroup" aria-label="Priority">
                                {PRIORITIES.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={form.priority === p.value}
                                        data-active={form.priority === p.value}
                                        data-tone={p.tone}
                                        className="at-priority__opt"
                                        onClick={() => setField("priority", p.value)}
                                    >
                                        <span className="at-priority__dot" aria-hidden="true" />
                                        {p.value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- Details ---------- */}
                <section className="at-section">
                    <div className="at-section__head">
                        <h2 className="at-section__title">Details</h2>
                        <span className="at-section__hint">What the assignee needs to know</span>
                    </div>

                    <div className="at-grid">
                        <div className="at-field at-field--full">
                            <label className="at-label" htmlFor="at-desc">Description</label>
                            <textarea
                                id="at-desc"
                                className="at-textarea"
                                value={form.description}
                                onChange={(event) => setField("description", event.target.value)}
                                placeholder="What does done look like? Link to documents, name people, set the scope."
                                maxLength={2000}
                            />
                            <div className="at-foot">{form.description.length}/2000</div>
                        </div>

                        <div className="at-field at-field--full">
                            <label className="at-label" htmlFor="at-comment">Comment</label>
                            <textarea
                                id="at-comment"
                                className="at-textarea"
                                value={form.comment}
                                onChange={(event) => setField("comment", event.target.value)}
                                placeholder="Optional note — context, hand-off info, anything that helps."
                                maxLength={2000}
                            />
                            <div className="at-foot">{form.comment.length}/2000</div>
                        </div>
                    </div>
                </section>

                {/* ---------- Organize ---------- */}
                <section className="at-section">
                    <div className="at-section__head">
                        <h2 className="at-section__title">Organize</h2>
                        <span className="at-section__hint">Tags and attachments</span>
                    </div>

                    <div className="at-field">
                        <label className="at-label" htmlFor="at-tags">Tags</label>
                        <div className="at-tags-row">
                            <input
                                id="at-tags"
                                className="at-input"
                                value={form.tagInput}
                                onChange={(event) => setField("tagInput", event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === ",") {
                                        event.preventDefault();
                                        addTag();
                                    }
                                }}
                                placeholder="Type a tag and press Enter"
                            />
                            <button
                                type="button"
                                className="at-btn at-btn--ghost at-btn--small"
                                onClick={addTag}
                            >
                                Add tag
                            </button>
                        </div>
                        {form.tags.length > 0 && (
                            <div className="at-chips">
                                {form.tags.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        className="at-chip"
                                        onClick={() => setField("tags", form.tags.filter((t) => t !== tag))}
                                        aria-label={`Remove tag ${tag}`}
                                    >
                                        {tag}
                                        <span className="at-chip__x" aria-hidden="true">×</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="at-field">
                        <label className="at-label">Attachments</label>
                        <label className="at-drop" htmlFor="at-files">
                            <strong>Click to upload</strong> or drag files in
                            <input
                                id="at-files"
                                type="file"
                                multiple
                                onChange={(event) => {
                                    setField("attachments", [
                                        ...form.attachments,
                                        ...filesToMetadata(event.target.files),
                                    ]);
                                    event.target.value = "";
                                }}
                            />
                        </label>
                        <AttachmentList
                            attachments={form.attachments}
                            onRemove={(index) =>
                                setField(
                                    "attachments",
                                    form.attachments.filter((_, i) => i !== index),
                                )
                            }
                        />
                    </div>
                </section>

                {/* ---------- Subtasks ---------- */}
                <section className="at-section">
                    <div className="at-section__head">
                        <h2 className="at-section__title">Subtasks</h2>
                        <span className="at-section__hint">
                            {form.subtasks.length === 0 ? "Optional" : `${form.subtasks.length} added`}
                        </span>
                    </div>

                    {form.subtasks.length > 0 && (
                        <div className="at-subtasks">
                            {form.subtasks.map((subtask, index) => (
                                <SubtaskFields
                                    key={`subtask-${index}`}
                                    index={index}
                                    subtask={subtask}
                                    onChange={updateSubtask}
                                    onRemove={removeSubtask}
                                />
                            ))}
                        </div>
                    )}

                    <div className="at-add-row">
                        <button
                            type="button"
                            className="at-btn at-btn--ghost at-btn--small"
                            onClick={addSubtask}
                        >
                            + Add subtask
                        </button>
                    </div>
                </section>

                {/* ---------- Assignee ---------- */}
                <section className="at-section">
                    <div className="at-section__head">
                        <h2 className="at-section__title">Assign to</h2>
                        <span className="at-section__hint">
                            {selectedEmployee ? `Going to ${selectedEmployee.name}` : "Pick one teammate"}
                        </span>
                    </div>

                    {loadingEmployees ? (
                        <div className="at-loading">
                            <div className="at-spinner" />
                            <span>Loading employees…</span>
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="at-empty">
                            <h3>No employees found</h3>
                            <p>Add an active employee admin before assigning tasks.</p>
                        </div>
                    ) : (
                        <div className="at-people">
                            {employees.map((employee) => {
                                const active = employee._id === form.assignedTo;
                                return (
                                    <button
                                        key={employee._id}
                                        type="button"
                                        className="at-person"
                                        data-active={active}
                                        onClick={() => setField("assignedTo", employee._id)}
                                    >
                                        <span className="at-person__avatar">{initialsFor(employee.name)}</span>
                                        <span className="at-person__body">
                                            <span className="at-person__name">{employee.name}</span>
                                            <span className="at-person__email">{employee.email}</span>
                                        </span>
                                        <span className="at-person__check" aria-hidden="true">✓</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ---------- Sticky actions ---------- */}
                <div className="at-actions">
                    <div className="at-actions__status">
                        {selectedEmployee ? (
                            <>
                                Assigning <strong>{form.title || "this task"}</strong> to{" "}
                                <strong>{selectedEmployee.name}</strong>
                            </>
                        ) : (
                            <>Pick an assignee to continue</>
                        )}
                    </div>
                    <div className="at-actions__buttons">
                        <button
                            type="button"
                            className="at-btn at-btn--ghost"
                            onClick={() => navigate("/employee-dashboard/my-tasks")}
                        >
                            View my tasks
                        </button>
                        <button
                            type="submit"
                            className="at-btn at-btn--primary"
                            disabled={
                                saving || loadingEmployees || !employees.length || !form.assignedTo
                            }
                        >
                            {saving ? "Assigning…" : "Assign task"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

function AttachmentList({ attachments, onRemove }) {
    if (!attachments.length) return null;

    return (
        <div className="at-attachments">
            {attachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="at-attachment">
                    <span className="at-attachment__icon">{extOf(attachment.name)}</span>
                    <span className="at-attachment__name">{attachment.name}</span>
                    <span className="at-attachment__size">{attachment.size}</span>
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

function SubtaskFields({ index, subtask, onChange, onRemove }) {
    return (
        <div className="at-subtask">
            <div className="at-subtask__head">
                <div className="at-subtask__num">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    Subtask
                </div>
                <button
                    type="button"
                    className="at-subtask__remove"
                    onClick={() => onRemove(index)}
                >
                    Remove
                </button>
            </div>

            <div className="at-grid">
                <div className="at-field at-field--full">
                    <label className="at-label" htmlFor={`subtask-title-${index}`}>Name</label>
                    <input
                        id={`subtask-title-${index}`}
                        className="at-input"
                        value={subtask.title}
                        onChange={(event) => onChange(index, "title", event.target.value)}
                        placeholder="What's this step?"
                        maxLength={140}
                    />
                </div>

                <div className="at-field at-field--full">
                    <label className="at-label" htmlFor={`subtask-description-${index}`}>Description</label>
                    <textarea
                        id={`subtask-description-${index}`}
                        className="at-textarea"
                        value={subtask.description}
                        onChange={(event) => onChange(index, "description", event.target.value)}
                        placeholder="Optional detail"
                        maxLength={2000}
                    />
                </div>

                <div className="at-field at-field--full">
                    <label className="at-label" htmlFor={`subtask-comment-${index}`}>Comment</label>
                    <textarea
                        id={`subtask-comment-${index}`}
                        className="at-textarea"
                        value={subtask.comment}
                        onChange={(event) => onChange(index, "comment", event.target.value)}
                        placeholder="Optional note"
                        maxLength={2000}
                    />
                </div>

                <div className="at-field at-field--full">
                    <label className="at-label">Attachments</label>
                    <label className="at-drop" htmlFor={`subtask-files-${index}`}>
                        <strong>Click to upload</strong> or drag files in
                        <input
                            id={`subtask-files-${index}`}
                            type="file"
                            multiple
                            onChange={(event) => {
                                onChange(index, "attachments", [
                                    ...subtask.attachments,
                                    ...filesToMetadata(event.target.files),
                                ]);
                                event.target.value = "";
                            }}
                        />
                    </label>
                    <AttachmentList
                        attachments={subtask.attachments}
                        onRemove={(attachmentIndex) =>
                            onChange(
                                index,
                                "attachments",
                                subtask.attachments.filter((_, j) => j !== attachmentIndex),
                            )
                        }
                    />
                </div>
            </div>
        </div>
    );
}