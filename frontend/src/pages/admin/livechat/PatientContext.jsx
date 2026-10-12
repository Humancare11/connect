import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import Icon from "./lcIcons";

// Patient context (docs/live-chat-admin-ui.html "Customer context"): what would make the next conversation easier.
// Four built-in fields plus the text fields a Super Admin defined in AI agent settings. A field is added with its
// "+" chip, saved when the box loses focus or Enter is pressed, and stays with the patient across their chats.
const BASE = "/api/admin/livechat";
const BUILT_IN = [
  { key: "followUpDate", label: "Follow-up date", type: "date" },
  { key: "preferredLanguage", label: "Preferred language", type: "text" },
  { key: "contactPreference", label: "Contact preference", type: "text" },
  { key: "reasonForContact", label: "Reason for contact", type: "text" },
];

export function PatientContextFields({ visitorId, fields, fieldDefs }) {
  const { admin } = useAdmin();
  const defs = [...BUILT_IN, ...(fieldDefs || []).map((d) => ({ key: d.key, label: d.label, type: "text", custom: true }))];
  const valueOf = (def, source) => (def.custom ? source?.custom?.[def.key] : source?.[def.key]) || "";
  const [initial] = useState(() => Object.fromEntries(defs.map((d) => [d.key, valueOf(d, fields)])));
  const stored = useRef(initial); // what the server has
  const [values, setValues] = useState(initial);
  const [added, setAdded] = useState(() => new Set()); // chips the user clicked (shown even while empty)
  const [state, setState] = useState({}); // key -> "saving" | "saved" | error text
  const shown = defs.filter((d) => values[d.key] || added.has(d.key));
  const hidden = defs.filter((d) => !shown.includes(d));

  const save = async (def) => {
    const value = values[def.key].trim();
    if (value === stored.current[def.key]) return;
    setState((s) => ({ ...s, [def.key]: "saving" }));
    try {
      const body = def.custom ? { custom: { [def.key]: value } } : { [def.key]: value };
      await api.put(`${BASE}/visitors/${visitorId}/context`, body);
      stored.current[def.key] = value; // an unchanged blur does not save again
      setState((s) => ({ ...s, [def.key]: "saved" }));
    } catch (err) {
      const errors = err?.response?.data?.errors;
      setState((s) => ({ ...s, [def.key]: (errors && Object.values(errors)[0]) || "Could not save." }));
    }
  };

  return (
    <>
      <p className="rt-q">What would make the next conversation easier?</p>
      {hidden.length > 0 && (
        <div className="rt-chips">
          {hidden.map((def) => (
            <button key={def.key} type="button" className="rt-chip" onClick={() => setAdded(new Set([...added, def.key]))}>
              <Icon name="plus" size={14} /> {def.label}
            </button>
          ))}
        </div>
      )}
      {shown.map((def) => (
        <div className="rt-field" key={def.key}>
          <label htmlFor={`pc-${def.key}`}>{def.label}</label>
          <input
            id={`pc-${def.key}`}
            type={def.type}
            maxLength={200}
            autoFocus={added.has(def.key) && !values[def.key]}
            value={values[def.key]}
            placeholder={def.type === "date" ? "" : "Add a note"}
            onChange={(e) => {
              setValues({ ...values, [def.key]: e.target.value });
              setState((s) => ({ ...s, [def.key]: "" }));
            }}
            onBlur={() => save(def)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          {state[def.key] === "saved" && <span className="wk-saved">Saved</span>}
          {state[def.key] && !["saved", "saving"].includes(state[def.key]) && <span className="wk-field-error">{state[def.key]}</span>}
        </div>
      ))}
      <p className="rt-q" style={{ marginTop: 6 }}>
        Need something else?
        <br />
        {admin?.role === "superadmin" ? (
          <Link className="rt-linkbtn" to="/admin-dashboard/live-chat/settings">
            Create your own field in AI agent settings.
          </Link>
        ) : (
          <span className="wk-muted">A Super Admin can add more fields in AI agent settings.</span>
        )}
      </p>
    </>
  );
}

// "Tell me about this patient": a short AI summary of the chat, made when asked and never saved. It uses the chat text
// only (the server replaces the patient's name, email and phone first), so it needs a chat.
export function TellMe({ url, hasChat = true }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const ask = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!hasChat) {
      setText("");
      setError("No chat yet, so there is nothing to summarize.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(url);
      setText(data.summary || "");
    } catch (err) {
      const code = err?.response?.data?.error;
      setText("");
      setError(
        code === "no_content" || code === "no_chat"
          ? "No messages yet, so there is nothing to summarize."
          : code === "rate_limited"
            ? "Too many requests. Wait a moment and try again."
            : "The AI summary is unavailable right now."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rt-tellrow">
      <button type="button" className="rt-tell" aria-expanded={open} onClick={ask}>
        Tell me about this patient
      </button>
      {open && (
        <div className="wk-aisum" role="status">
          {busy ? "Reading the chat…" : error || text}
        </div>
      )}
    </div>
  );
}
