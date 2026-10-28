import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import RetryButton from "../../../components/ui/RetryButton";
import { getManualHistory } from "./entriesApi";

const IST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "26 Oct 2026, 17:10 IST"
export function formatIst(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${IST.format(d)} IST` : "";
}

const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Every change made to one manual entry, newest first, one group per save: who (with their role), when (IST), and each field with its old
// value (red, struck through) -> new value (green). The first group is "Created the entry".
export default function HistoryDialog({ row, onClose }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "", data: null });
    getManualHistory(row.id)
      .then((res) => alive && setState({ loading: false, error: "", data: res.data }))
      .catch((err) => alive && setState({ loading: false, error: err.response?.data?.msg || "Couldn’t load the history.", data: null }));
    return () => {
      alive = false;
    };
  }, [row.id, attempt]);

  const form = row.manual.form;
  const groups = state.data?.groups || [];
  return (
    <Modal open onClose={onClose} title={`History · ${row.shortId}`} description={`${form.patientName} · ${form.company || "No company"} · case ${form.caseNumber || "—"}`} className="en-modal en-hist">
      <button type="button" className="en-x" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {state.loading ? (
        <p className="en-hist-empty">Loading…</p>
      ) : state.error ? (
        <div className="en-hist-empty">
          <p>{state.error}</p>
          <RetryButton onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      ) : groups.length === 0 ? (
        <p className="en-hist-empty">No changes yet. Edits made here will be listed with who made them and when.</p>
      ) : (
        <div className="hl">
          {groups.map((g, i) => (
            <div className="hg" key={`${g.at}-${i}`}>
              <div className="hw">
                <span className="av2">{initials(g.by.name)}</span>
                <b>{g.by.name}</b>
                {g.by.roleLabel && <span className="rl">{g.by.roleLabel}</span>}
                <time dateTime={g.at || undefined}>{formatIst(g.at)}</time>
              </div>
              <ul>
                {g.created && (
                  <li>
                    <span className="hf">Created the entry</span>
                  </li>
                )}
                {g.items.map((item, j) => (
                  <li key={`${item.field}-${j}`}>
                    <span className="hf">{item.field}</span>
                    <span className="ha">{item.from}</span>
                    <span className="arr">→</span>
                    <span className="hb">{item.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
