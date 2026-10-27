import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../../components/ui/Toast";
import { copyText } from "../appointments/copyText";
import { editManualEntry } from "./entriesApi";
import { formFromRow, rowNumber, saveErrorText } from "./entriesFormat";
import {
  SHEET_COLUMNS, calcCell, changedFields, draftCalc, entriesText, firstProblem, isLockedWhenPaid, settleDraft, sheetTotals,
} from "./sheetColumns";

// Today as the date input wants it, in the browser's own time zone.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The Manual entries view: a spreadsheet like the team's Excel sheet. It scrolls sideways inside its own box (never the page); the header
// row stays on top, Date, Company, Case Number and Patient Name stay on the left and Actions on the right. Edit turns one row into
// inputs in place (one row at a time); History and Delete are in Actions.
export default function ManualSheet({ rows, totals, page, onRowSaved, onDelete, onHistory }) {
  const [editId, setEditId] = useState(null);
  const sums = sheetTotals(totals);

  return (
    <div className="xs-wrap" data-testid="manual-sheet">
      <table className="xs">
        <thead>
          <tr>
            <th className="rn">#</th>
            {SHEET_COLUMNS.map((c) => (
              <th key={c.header} className={`${c.pin ? `stick ${c.pin}` : ""}`.trim()}>
                {c.header}
              </th>
            ))}
            <th className="act">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) =>
            editId === row.id ? (
              <EditRow
                key={row.id}
                row={row}
                number={rowNumber(page, index)}
                onCancel={() => setEditId(null)}
                onSaved={(item, message) => {
                  setEditId(null);
                  onRowSaved(item, message);
                }}
                onConflict={(item) => {
                  setEditId(null);
                  if (item) onRowSaved(item, null);
                }}
              />
            ) : (
              <ViewRow key={row.id} row={row} number={rowNumber(page, index)} editing={editId !== null} onEdit={() => setEditId(row.id)} onDelete={onDelete} onHistory={onHistory} />
            ),
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="rn" />
            {SHEET_COLUMNS.map((c) => {
              const pin = c.pin ? `stick ${c.pin}` : "";
              if (c.header === "Date") return <td key={c.header} className={`${pin} l`}>Total</td>;
              if (c.header === "Company") return <td key={c.header} className={`${pin} l`}>{entriesText(sums.entries)}</td>;
              if (c.header === "Consultation Fee") return <td key={c.header} className="nr">{sums.consult}</td>;
              if (c.header === "Doctor's Fee") return <td key={c.header} className="nr">{sums.doctor}</td>;
              if (c.header === "Calculation") {
                return (
                  <td key={c.header} className="nr">
                    <span className={sums.calc.negative ? "neg" : "pos"}>{sums.calc.text}</span>
                  </td>
                );
              }
              return <td key={c.header} className={pin} />;
            })}
            <td className="act" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// The row number is a button: clicking it copies the entry's M- code.
function CodeButton({ row, number }) {
  const toast = useToast();
  const full = useRef(null);
  const code = row.shortId;
  const copy = async () => {
    const result = await copyText(code, {
      select: () => {
        const range = document.createRange();
        range.selectNodeContents(full.current);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },
      execCopy: () => document.execCommand("copy"),
    });
    if (result === "copied") toast.success("Booking ID copied");
    else toast.info(`Could not copy automatically. The ID is selected, press Ctrl+C: ${code}`);
  };
  return (
    <>
      <button type="button" className="code" title={`${code} · click to copy`} aria-label={`Copy booking ID ${code}`} onClick={copy}>
        {number}
      </button>
      <span ref={full} className="en-fullid">
        {code}
      </span>
    </>
  );
}

function ViewRow({ row, number, editing, onEdit, onDelete, onHistory }) {
  const form = row.manual.form;
  const calc = calcCell(row.manual.calculation?.cents);
  const count = row.manual.historyCount || 0;
  return (
    <tr data-kind="manual" data-id={row.id}>
      <td className="rn">
        <CodeButton row={row} number={number} />
      </td>
      {SHEET_COLUMNS.map((c) => {
        const cls = [c.pin ? `stick ${c.pin}` : "", c.green ? "grn" : "", c.align || ""].filter(Boolean).join(" ");
        if (c.kind === "calc") {
          return (
            <td key={c.header} className={cls} data-l={c.header}>
              <span className={calc.negative ? "neg" : "pos"}>{calc.text}</span>
            </td>
          );
        }
        const tone = c.tone?.(form);
        return (
          <td key={c.header} className={cls} data-l={c.header} title={c.header}>
            {tone ? <span className={tone}>{c.show(form)}</span> : c.show(form)}
          </td>
        );
      })}
      <td className="act">
        <div className="acts2">
          <button type="button" onClick={onEdit} disabled={editing} title={editing ? "Finish editing the other row first" : "Edit this row here in the table"}>
            Edit
          </button>
          <button type="button" onClick={() => onHistory(row)} title="See who changed what">
            History{count ? <i>{count}</i> : null}
          </button>
          <button
            type="button"
            className="dl"
            onClick={() => onDelete(row)}
            disabled={!row.manual.canDelete}
            title={row.manual.canDelete ? "Delete this manual entry" : "Change Payment to provider from Paid before deleting"}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// One row turned into editable cells. Enter saves (not in a text area), Escape cancels.
function EditRow({ row, number, onCancel, onSaved, onConflict }) {
  const toast = useToast();
  const original = useMemo(() => formFromRow(row), [row]);
  const [draft, setDraft] = useState(original);
  const [bad, setBad] = useState("");
  const [saving, setSaving] = useState(false);
  const rowRef = useRef(null);
  const paid = Boolean(row.manual.locked);

  useEffect(() => {
    rowRef.current?.querySelector(".ie:not(:disabled)")?.focus();
  }, []);

  const set = (key) => (event) => {
    setBad("");
    setDraft((d) => ({ ...d, [key]: event.target.value }));
  };

  const save = async () => {
    if (saving) return;
    const settled = settleDraft(draft, localToday());
    const problem = firstProblem(settled);
    if (problem) {
      setBad(problem.key);
      toast.error(problem.msg);
      rowRef.current?.querySelector(`[data-f="${problem.key}"]`)?.focus();
      return;
    }
    const { changed, body } = changedFields(original, settled, row.entry.version);
    if (!changed.length) {
      toast.info("No changes");
      onCancel();
      return;
    }
    setSaving(true);
    try {
      const res = await editManualEntry(row.id, body);
      onSaved(res.data.item, `Saved ${changed.length} change${changed.length > 1 ? "s" : ""}`);
    } catch (err) {
      const data = err.response?.data;
      if (data?.item) {
        // Someone else saved first (or the row got locked): show what is saved now.
        toast.error(data.code === "stale" ? "Someone else changed this row. Here is the latest." : saveErrorText(err));
        onConflict(data.item);
        return;
      }
      toast.error(saveErrorText(err));
      setSaving(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && event.target.tagName !== "TEXTAREA" && event.target.tagName !== "BUTTON") {
      event.preventDefault();
      save();
    }
  };

  const calc = draftCalc(draft);
  const locked = (key) => isLockedWhenPaid(key, paid);
  const cellProps = (c) => ({
    "data-f": c.key,
    "aria-label": c.header,
    className: `ie${c.align === "nr" ? " nr" : ""}${bad === c.key ? " bad" : ""}`,
    disabled: saving || locked(c.key),
    title: locked(c.key) ? "Locked: already paid to the provider" : undefined,
    value: draft[c.key] ?? "",
    onChange: set(c.key),
  });

  const editor = (c) => {
    if (c.kind === "date") return <input type="date" {...cellProps(c)} />;
    if (c.kind === "money") return <input inputMode="decimal" placeholder="0.00" {...cellProps(c)} />;
    if (c.kind === "area") return <textarea rows={2} maxLength={c.key === "comment" ? 500 : 1000} {...cellProps(c)} />;
    if (c.kind === "select") {
      return (
        <select {...cellProps(c)}>
          {c.choices.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      );
    }
    if (c.kind === "service") {
      const other = { key: "otherService", header: "Other service", align: "" };
      return (
        <>
          <select {...cellProps(c)}>
            {draft.serviceType === "" && <option value="">Not set</option>}
            {[["house_call", "House call"], ["teleconsultation", "Teleconsultation"], ["others", "Others"]].map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          {draft.serviceType === "others" && <input style={{ marginTop: 4 }} maxLength={120} placeholder="Other service" {...cellProps(other)} />}
        </>
      );
    }
    if (c.key === "country") return <input maxLength={60} {...cellProps(c)} />;
    const max = { company: 120, caseNumber: 60, patientName: 80, serviceProvider: 120, providerNumber: 20, contactNumber: 20 }[c.key];
    return <input maxLength={max} {...cellProps(c)} />;
  };

  return (
    <tr ref={rowRef} className="editing" data-kind="manual" data-id={row.id} onKeyDown={onKeyDown}>
      <td className="rn">
        <CodeButton row={row} number={number} />
      </td>
      {SHEET_COLUMNS.map((c) => {
        const cls = [c.pin ? `stick ${c.pin}` : "", c.green ? "grn" : "", c.align || ""].filter(Boolean).join(" ");
        if (c.kind === "calc") {
          return (
            <td key={c.header} className={cls}>
              <span className={calc.negative ? "neg" : "pos"}>{calc.text}</span>
            </td>
          );
        }
        return (
          <td key={c.header} className={cls}>
            {editor(c)}
          </td>
        );
      })}
      <td className="act">
        <div className="acts2">
          <button type="button" className="sv" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
        {paid && <div className="lk">Paid: some fields locked</div>}
      </td>
    </tr>
  );
}
