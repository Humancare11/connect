import { useEffect, useRef, useState } from "react";
import { cleanFeeInput, centsToInput, FEE_PLACEHOLDER, sameFee, STATUS_OPTIONS } from "./entriesFormat";

const SAVED_SHOWN_MS = 1500;

// One editable cell. It keeps what the person is typing (`draft`) apart from what the server last said (`serverText`), so a quiet
// refresh of the list never overwrites a box that has focus. `run(value)` saves and answers { ok, item, noop, msg }.
// The little badge shows Saving… / Saved / Couldn't save; a failure puts the box back to what is saved and says why on hover
// (and in a toast, from the caller).
function useCell({ serverText, run, textOf, onFailure }) {
  const [draft, setDraft] = useState(serverText);
  const [status, setStatus] = useState({ state: "", msg: "" });
  const focused = useRef(false);
  const latest = useRef(serverText);
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    latest.current = serverText;
    if (!focused.current) setDraft(serverText);
  }, [serverText]);

  const commit = async (value) => {
    clearTimeout(timer.current);
    setStatus({ state: "saving", msg: "" });
    const result = await run(value);
    if (!alive.current) return;
    if (result.ok) {
      setDraft(textOf(result.item));
      setStatus({ state: "saved", msg: "" });
      timer.current = setTimeout(() => alive.current && setStatus({ state: "", msg: "" }), SAVED_SHOWN_MS);
    } else {
      setDraft(latest.current);
      setStatus({ state: "err", msg: result.msg });
      onFailure?.(result);
    }
  };

  const cancel = () => setDraft(latest.current);
  return {
    draft,
    setDraft,
    status,
    commit,
    cancel,
    focus: () => {
      focused.current = true;
      if (status.state === "err") setStatus({ state: "", msg: "" });
    },
    blur: () => {
      focused.current = false;
    },
  };
}

function Badge({ status }) {
  if (!status.state) return null;
  const text = { saving: "Saving…", saved: "Saved", err: "Couldn’t save" }[status.state];
  return (
    <span className={`en-st en-st--${status.state}`} title={status.msg || undefined} role={status.state === "err" ? "alert" : "status"}>
      {text}
    </span>
  );
}

const onEnterBlur = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
  } else if (event.key === "Escape") {
    event.currentTarget.dataset.cancel = "1";
    event.currentTarget.blur();
  }
};

// The doctor fee ($). Saved when the box loses focus or Enter is pressed.
export function FeeCell({ row, save, disabled }) {
  const serverText = centsToInput(row.entry.doctorFeeCents);
  const cell = useCell({
    serverText,
    run: (value) => save(row, "doctorFee", value),
    textOf: (item) => centsToInput(item.entry.doctorFeeCents),
  });
  const finish = (event) => {
    cell.blur();
    if (event.currentTarget.dataset.cancel) {
      delete event.currentTarget.dataset.cancel;
      cell.cancel();
      return;
    }
    const clean = cleanFeeInput(cell.draft);
    // Not a number: leave the text in the box with the red hint so it can be fixed (nothing is sent).
    if (!clean.ok) return;
    if (sameFee(clean.value, row.entry.doctorFeeCents)) {
      cell.setDraft(serverText);
      return;
    }
    cell.commit(clean.value);
  };
  const invalid = !cleanFeeInput(cell.draft).ok;
  return (
    <div className="en-cell">
      <input
        className="en-fee-in"
        inputMode="decimal"
        value={cell.draft}
        placeholder={FEE_PLACEHOLDER}
        aria-label="Doctor fee"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onFocus={cell.focus}
        onChange={(event) => cell.setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={onEnterBlur}
      />
      {invalid ? <span className="en-st en-st--err" role="alert">Use a number like 74.25</span> : <Badge status={cell.status} />}
    </div>
  );
}

// Paid status. Saved as soon as another status is picked.
export function StatusCell({ row, save, disabled }) {
  const cell = useCell({
    serverText: row.entry.paidStatus,
    run: (value) => save(row, "paidStatus", value),
    textOf: (item) => item.entry.paidStatus,
  });
  return (
    <div className="en-cell">
      <select
        className={`en-ps en-ps--${cell.draft}`}
        value={cell.draft}
        aria-label="Paid status"
        disabled={disabled}
        onFocus={cell.focus}
        onBlur={cell.blur}
        onChange={(event) => {
          const value = event.target.value;
          cell.setDraft(value);
          cell.commit(value);
        }}
      >
        {STATUS_OPTIONS.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <Badge status={cell.status} />
    </div>
  );
}

// Paid on (a calendar day). Saved when a date is picked or cleared.
export function PaidOnCell({ row, save, disabled }) {
  const cell = useCell({
    serverText: row.entry.paidOn,
    run: (value) => save(row, "paidOn", value),
    textOf: (item) => item.entry.paidOn,
  });
  return (
    <div className="en-cell">
      <input
        type="date"
        value={cell.draft}
        aria-label="Paid on"
        disabled={disabled}
        onFocus={cell.focus}
        onBlur={cell.blur}
        onChange={(event) => {
          const value = event.target.value;
          cell.setDraft(value);
          if (value !== row.entry.paidOn) cell.commit(value);
        }}
      />
      <Badge status={cell.status} />
    </div>
  );
}

// The comment. Saved when the box loses focus or Enter is pressed.
export function CommentCell({ row, save, disabled }) {
  const cell = useCell({
    serverText: row.entry.comment,
    run: (value) => save(row, "comment", value),
    textOf: (item) => item.entry.comment,
  });
  const finish = (event) => {
    cell.blur();
    if (event.currentTarget.dataset.cancel) {
      delete event.currentTarget.dataset.cancel;
      cell.cancel();
      return;
    }
    const value = cell.draft.trim();
    if (value === row.entry.comment) {
      cell.setDraft(row.entry.comment);
      return;
    }
    cell.commit(value);
  };
  return (
    <div className="en-cell">
      <input
        value={cell.draft}
        placeholder={disabled ? "" : "Add a note"}
        maxLength={500}
        aria-label="Comment"
        title={cell.draft || undefined}
        disabled={disabled}
        onFocus={cell.focus}
        onChange={(event) => cell.setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={onEnterBlur}
      />
      <Badge status={cell.status} />
    </div>
  );
}
