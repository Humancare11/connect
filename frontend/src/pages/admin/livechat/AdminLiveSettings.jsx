import { useEffect, useState } from "react";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import { hub } from "./liveChatHub";
import "./LiveChatPages.css";

// Live Chat > AI agent settings (docs/chat-demo.html). Only a Super Admin can save; admins see everything read only.
// A save is checked by the server as a whole, applies at once (no restart) and is written to the change log below.
const BASE = "/api/admin/livechat";

const ICONS = [
  ["stethoscope", "Doctor"],
  ["pill", "Prescription"],
  ["clipboard", "Clipboard"],
  ["document", "Document"],
  ["dots", "Question mark"],
  ["agent", "Headset"],
];
const AI_MODES = [
  ["ai_first", "AI first, agents can take over", "The AI answers every chat right away. Any agent can step in."],
  ["ai_off", "AI off (agents only)", "Every chat goes to the Queue. The AI only helps agents with suggested replies."],
];

// the fields the page edits (everything else on the settings document is not sent back)
const EDITABLE = [
  "aiMode", "followUpMinutes", "agentDisplayName", "greeting", "unavailableMessage", "businessFacts",
  "dailySpendCapUsd", "handoffRules", "quickOptions", "prices",
];
const pick = (settings) => Object.fromEntries(EDITABLE.map((k) => [k, settings[k]]));
const slug = (label, taken) => {
  const base = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "option";
  let key = base;
  for (let i = 2; taken.includes(key); i += 1) key = `${base}_${i}`;
  return key;
};

function ErrorText({ errors, name }) {
  return errors[name] ? <span className="lcp-field-error">{errors[name]}</span> : null;
}

export default function AdminLiveSettings() {
  const { admin } = useAdmin();
  const me = String(admin?._id || admin?.id || "");
  const [form, setForm] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState([]);
  const [canned, setCanned] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [linkPages, setLinkPages] = useState([]);
  const [version, setVersion] = useState(0);
  const [cannedError, setCannedError] = useState("");

  useEffect(() => hub.acquire(me), [me]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`${BASE}/settings`), api.get(`${BASE}/settings/audit`, { params: { limit: 50 } }), api.get(`${BASE}/canned-replies`, { params: { all: 1 } })])
      .then(([s, a, c]) => {
        if (cancelled) return;
        setForm((current) => current || pick(s.data.settings));
        setCanEdit(Boolean(s.data.canEdit));
        setLinkPages(s.data.linkPages || []);
        setAudit(a.data.entries || []);
        setCanned(c.data.replies || []);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (loadError) {
    return (
      <div className="lcp">
        <div className="lcp-error">{loadError}</div>
      </div>
    );
  }
  if (!form) return <div className="lcp lcp-muted">Loading…</div>;

  const set = (key, value) => {
    setMessage("");
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setRule = (key, value) => set("handoffRules", { ...form.handoffRules, [key]: value });
  const setOption = (index, patch) => set("quickOptions", form.quickOptions.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  const moveOption = (index, by) => {
    const next = [...form.quickOptions];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("quickOptions", next);
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { data } = await api.put(`${BASE}/settings`, form);
      setForm(pick(data.settings));
      setErrors({});
      setMessage(data.changed ? `Saved. ${data.changed} change${data.changed === 1 ? "" : "s"} applied now.` : "Nothing changed.");
      setVersion((v) => v + 1);
    } catch (err) {
      const body = err?.response?.data;
      if (body?.errors) {
        setErrors(body.errors);
        setMessage("Please fix the highlighted fields. Nothing was saved.");
      } else setMessage(err?.response?.status === 403 ? "Only a Super Admin can save settings." : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // canned replies save on their own (they are separate records)
  const cannedCall = async (request) => {
    setCannedError("");
    try {
      await request();
      setVersion((v) => v + 1);
      return true;
    } catch (err) {
      const e = err?.response?.data?.errors;
      setCannedError(e ? Object.values(e).join(" ") : "Could not save the reply.");
      return false;
    }
  };

  return (
    <div className="lcp">
      <div className="lcp-title">
        <div>
          <div className="lcp-eyebrow">Live Chat</div>
          <h2>AI agent settings</h2>
        </div>
        <span className="lcp-muted">Changes apply to new chats straight away. No restart.</span>
      </div>
      {!canEdit && <div className="lcp-viewonly">View only. Ask a Super Admin to change these settings. You can change your own display name on the Team page.</div>}

      <fieldset disabled={!canEdit}>
        <div className="lcp-grid">
          <div className="lcp-panel">
            <h3>When should the AI answer?</h3>
            {AI_MODES.map(([value, label, help]) => (
              <label key={value} className="lcp-radio">
                <input type="radio" name="aiMode" checked={form.aiMode === value} onChange={() => set("aiMode", value)} />
                <span>
                  <b>{label}</b>
                  <small>{help}</small>
                </span>
              </label>
            ))}
            <ErrorText errors={errors} name="aiMode" />
          </div>

          <div className="lcp-panel">
            <h3>Handing a chat to a live agent</h3>
            <label className="lcp-check">
              <input type="checkbox" checked disabled /> Contact form before any chat: name and email required, phone optional (always on)
            </label>
            <label className="lcp-check">
              <input type="checkbox" checked={form.handoffRules.onPatientRequest} onChange={(e) => setRule("onPatientRequest", e.target.checked)} /> The patient asks for a person
            </label>
            <label className="lcp-check">
              <input type="checkbox" checked={form.handoffRules.onAccountOrPayment !== false} onChange={(e) => setRule("onAccountOrPayment", e.target.checked)} /> Account issue: a specific booking, payment, refund, prescription or account problem
            </label>
            <label className="lcp-check">
              <input type="checkbox" checked={form.handoffRules.onTechnicalIssue !== false} onChange={(e) => setRule("onTechnicalIssue", e.target.checked)} /> Technical issue: the site, login, video call or an upload is not working
            </label>
            <label className="lcp-check">
              <input type="checkbox" checked disabled /> Emergency: the patient describes an emergency (always on)
            </label>
            <label className="lcp-check">
              <input type="checkbox" checked={form.handoffRules.onComplaint !== false} onChange={(e) => setRule("onComplaint", e.target.checked)} /> Complaint: the patient is upset or asks for a manager
            </label>
            <label className="lcp-check">
              <input type="checkbox" checked={form.handoffRules.onUnsure} onChange={(e) => setRule("onUnsure", e.target.checked)} /> Unanswered after two tries: a Humancare question the AI could not answer twice in a row
            </label>
            <span className="lcp-help">Off-topic or personal questions never go to an agent; after three in a row the patient is reminded they can tap "Talk to live agent".</span>
            <div className="lcp-field">
              <label htmlFor="maxAi">AI replies per chat (1-200)</label>
              <input id="maxAi" type="number" min="1" max="200" value={form.handoffRules.maxAiRepliesPerChat} onChange={(e) => setRule("maxAiRepliesPerChat", Number(e.target.value))} />
              <ErrorText errors={errors} name="handoffRules.maxAiRepliesPerChat" />
            </div>
            <div className="lcp-field">
              <label htmlFor="grace">If the agent holding a chat goes offline, return it to the Queue after (seconds)</label>
              <input id="grace" type="number" min="0" max="3600" value={form.handoffRules.agentOfflineGraceSeconds} onChange={(e) => setRule("agentOfflineGraceSeconds", Number(e.target.value))} />
              <ErrorText errors={errors} name="handoffRules.agentOfflineGraceSeconds" />
            </div>
            <div className="lcp-field">
              <label htmlFor="followUpMinutes">Email notice after (minutes, 1-30)</label>
              <input
                id="followUpMinutes"
                type="number"
                min="1"
                max="30"
                value={form.followUpMinutes ?? 1}
                onChange={(e) => set("followUpMinutes", Number(e.target.value))}
              />
              <span className="lcp-help">
                A patient waiting in the Queue with no admin reply after this long is told "Our team will connect with you by email" and gets one
                generic follow-up email. The chat stays in the Queue.
              </span>
              <ErrorText errors={errors} name="followUpMinutes" />
            </div>
          </div>

          <div className="lcp-panel">
            <h3>What the AI says</h3>
            <label className="lcp-check">
              <input type="checkbox" checked disabled /> Never diagnose or suggest medication (always on)
            </label>
            <div className="lcp-field">
              <label htmlFor="greeting">Greeting</label>
              <textarea id="greeting" value={form.greeting} maxLength={600} onChange={(e) => set("greeting", e.target.value)} />
              <span className="lcp-help">Use {"{firstName}"} for the patient's first name.</span>
              <ErrorText errors={errors} name="greeting" />
            </div>
            <div className="lcp-field">
              <label htmlFor="unavail">Message when the AI is unavailable</label>
              <textarea id="unavail" value={form.unavailableMessage} maxLength={600} onChange={(e) => set("unavailableMessage", e.target.value)} />
              <ErrorText errors={errors} name="unavailableMessage" />
            </div>
            <div className="lcp-field">
              <label htmlFor="facts">Business facts the AI may use</label>
              <textarea id="facts" style={{ minHeight: 120 }} value={form.businessFacts} maxLength={8000} onChange={(e) => set("businessFacts", e.target.value)} />
              <span className="lcp-help">Plain facts only (holidays, how booking works). Never put patient information here.</span>
              <ErrorText errors={errors} name="businessFacts" />
            </div>
          </div>

          <div className="lcp-panel">
            <h3>Prices the AI may quote</h3>
            {form.prices.map((p, i) => (
              <div key={i}>
                <div className="lcp-row lcp-row--price">
                  <input type="text" value={p.name} maxLength={60} aria-label="Service" onChange={(e) => set("prices", form.prices.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input type="number" min="0" step="0.01" value={p.price} aria-label="Price in USD" onChange={(e) => set("prices", form.prices.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
                  <button type="button" className="lcp-btn lcp-btn--small lcp-btn--danger" onClick={() => set("prices", form.prices.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                <ErrorText errors={errors} name={`prices.${i}.name`} />
                <ErrorText errors={errors} name={`prices.${i}.price`} />
              </div>
            ))}
            <button type="button" className="lcp-btn lcp-btn--small" style={{ marginTop: 10 }} disabled={form.prices.length >= 30} onClick={() => set("prices", [...form.prices, { name: "", price: 0 }])}>
              Add a price
            </button>
            <ErrorText errors={errors} name="prices" />
          </div>

          <div className="lcp-panel">
            <h3>Agents and limits</h3>
            <div className="lcp-field">
              <label htmlFor="agentName">Default agent name shown to patients</label>
              <input id="agentName" type="text" value={form.agentDisplayName} maxLength={40} onChange={(e) => set("agentDisplayName", e.target.value)} />
              <span className="lcp-help">Used when an agent has not set their own name. Agents set theirs on the Team page.</span>
              <ErrorText errors={errors} name="agentDisplayName" />
            </div>
            <div className="lcp-field">
              <label htmlFor="cap">Daily AI spend cap (USD)</label>
              <input id="cap" type="number" min="0" max="1000" step="0.5" value={form.dailySpendCapUsd} onChange={(e) => set("dailySpendCapUsd", Number(e.target.value))} />
              <span className="lcp-help">When the day's AI cost reaches this, patients see the "AI unavailable" message and live chat keeps working.</span>
              <ErrorText errors={errors} name="dailySpendCapUsd" />
            </div>
          </div>
        </div>

        <div className="lcp-panel">
          <div className="lcp-panel-head">
            <div>
              <h3>Quick options shown after the greeting</h3>
              <span className="lcp-help">Clicking one sends its label as the patient's message and shows its reply. The "live" option sends the patient to an agent.</span>
            </div>
            <button
              type="button"
              className="lcp-btn lcp-btn--small"
              disabled={form.quickOptions.length >= 8}
              onClick={() => set("quickOptions", [...form.quickOptions, { key: slug("New option", form.quickOptions.map((o) => o.key)), label: "New option", icon: "dots", reply: "" }])}
            >
              Add an option
            </button>
          </div>
          <ErrorText errors={errors} name="quickOptions" />
          {form.quickOptions.map((o, i) => (
            <div key={`${o.key}-${i}`} className="lcp-option">
              <div className="lcp-option-top">
                <input type="text" value={o.label} maxLength={80} aria-label="Label" onChange={(e) => setOption(i, { label: e.target.value })} />
                <select value={o.icon} aria-label="Icon" onChange={(e) => setOption(i, { icon: e.target.value })}>
                  {ICONS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="lcp-option-actions">
                  <button type="button" className="lcp-btn lcp-btn--small" onClick={() => moveOption(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className="lcp-btn lcp-btn--small" onClick={() => moveOption(i, 1)} disabled={i === form.quickOptions.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button type="button" className="lcp-btn lcp-btn--small lcp-btn--danger" onClick={() => set("quickOptions", form.quickOptions.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              </div>
              {o.key === "live" ? (
                <span className="lcp-help">This option sends the patient to a live agent, so it has no reply text.</span>
              ) : (
                <>
                  <textarea value={o.reply} maxLength={1200} aria-label="Reply" placeholder="What the AI answers when this option is picked" onChange={(e) => setOption(i, { reply: e.target.value })} />
                  <select value={o.link || ""} aria-label="Page button" onChange={(e) => setOption(i, { link: e.target.value })}>
                    <option value="">No page button</option>
                    {linkPages.map((p) => (
                      <option key={p.url} value={p.url}>
                        Page button: {p.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <ErrorText errors={errors} name={`quickOptions.${i}.key`} />
              <ErrorText errors={errors} name={`quickOptions.${i}.label`} />
              <ErrorText errors={errors} name={`quickOptions.${i}.icon`} />
              <ErrorText errors={errors} name={`quickOptions.${i}.reply`} />
              <ErrorText errors={errors} name={`quickOptions.${i}.link`} />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="lcp-savebar">
        <button type="button" className="lcp-btn lcp-btn--primary" onClick={save} disabled={!canEdit || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {message && <span className={message.startsWith("Saved") ? "lcp-saved" : message.startsWith("Nothing") ? "lcp-muted" : "lcp-field-error"} role="status">{message}</span>}
        {!canEdit && <span className="lcp-muted">Only a Super Admin can save.</span>}
      </div>

      <CannedReplies canned={canned} canEdit={canEdit} error={cannedError} call={cannedCall} />

      <div className="lcp-panel" style={{ marginTop: 14 }}>
        <h3>Change log</h3>
        <span className="lcp-help">Who changed what and when (the last 50 saves).</span>
        <div className="lcp-table-wrap lcp-log" style={{ marginTop: 10 }}>
          <table className="lcp-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What changed</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td className="lcp-mono">{new Date(entry.at).toLocaleString()}</td>
                  <td>
                    {entry.actor.name || "Unknown"}
                    <div className="lcp-muted">{entry.actor.role}</div>
                  </td>
                  <td>
                    <ul>
                      {entry.changes.map((c, i) => (
                        <li key={i}>
                          <b>{c.field}</b>: <span className="lcp-muted">{c.before || "(empty)"}</span> → {c.after || "(empty)"}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={3} className="lcp-muted">
                    No changes yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Canned replies agents insert into a chat. Each add / edit / delete is saved at once (and logged).
function CannedReplies({ canned, canEdit, error, call }) {
  const [editing, setEditing] = useState(null); // id or "new"
  const [draft, setDraft] = useState({ title: "", text: "", active: true });
  const begin = (reply) => {
    setEditing(reply ? reply.id : "new");
    setDraft(reply ? { title: reply.title, text: reply.text, active: reply.active } : { title: "", text: "", active: true });
  };
  return (
    <div className="lcp-panel" style={{ marginTop: 14 }}>
      <div className="lcp-panel-head">
        <div>
          <h3>Canned replies</h3>
          <span className="lcp-help">Ready-made replies in the chat. Use {"{agentName}"} for the agent's display name.</span>
        </div>
        {canEdit && (
          <button type="button" className="lcp-btn lcp-btn--small" onClick={() => begin(null)}>
            Add a reply
          </button>
        )}
      </div>
      {error && <div className="lcp-error">{error}</div>}
      {editing && canEdit && (
        <form
          className="lcp-option"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await call(() => (editing === "new" ? api.post(`${BASE}/canned-replies`, draft) : api.put(`${BASE}/canned-replies/${editing}`, draft)));
            if (ok) setEditing(null);
          }}
        >
          <input type="text" value={draft.title} maxLength={80} placeholder="Title (shown on the button)" aria-label="Title" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea value={draft.text} maxLength={1000} placeholder="The reply" aria-label="Reply text" onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <label className="lcp-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Show in chats
          </label>
          <div className="lcp-option-actions">
            <button type="submit" className="lcp-btn lcp-btn--primary lcp-btn--small">
              Save reply
            </button>
            <button type="button" className="lcp-btn lcp-btn--small" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {canned.map((reply) => (
        <div key={reply.id} className="lcp-option" style={{ opacity: reply.active ? 1 : 0.6 }}>
          <div className="lcp-option-top" style={{ gridTemplateColumns: "1fr auto" }}>
            <b>
              {reply.title}
              {!reply.active && <span className="lcp-muted"> (hidden)</span>}
            </b>
            {canEdit && (
              <div className="lcp-option-actions">
                <button type="button" className="lcp-btn lcp-btn--small" onClick={() => begin(reply)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="lcp-btn lcp-btn--small lcp-btn--danger"
                  onClick={() => window.confirm(`Delete the canned reply "${reply.title}"?`) && call(() => api.delete(`${BASE}/canned-replies/${reply.id}`))}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <span className="lcp-muted">{reply.text}</span>
        </div>
      ))}
      {canned.length === 0 && <span className="lcp-muted">No canned replies yet.</span>}
    </div>
  );
}
