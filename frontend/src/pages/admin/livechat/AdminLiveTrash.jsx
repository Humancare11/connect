import { useCallback, useEffect, useState } from "react";
import api from "../../../api";
import DeleteChatsDialog from "./DeleteChatsDialog";
import { timeOf } from "./chatUtils";

// Live Chat > Trash (Super Admin only): chats deleted from the Archive wait here for 30 days, then the daily job
// removes them for good. Restore puts a chat back in the Archive; Delete permanently removes it now.
const BASE = "/api/admin/livechat";
const CONFIRM_ABOVE = 50;
const ERRORS = {
  confirm_required: "Type DELETE to confirm.",
  rate_limited: "Too many delete requests. Wait a minute and try again.",
  nothing_selected: "Nothing is selected.",
  server_error: "Something went wrong. Nothing was changed.",
};
const dateTime = (iso) =>
  iso ? `${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${timeOf(iso)}` : "–";

export default function AdminLiveTrash() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { ids, all }
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(
    (nextPage) =>
      api
        .get(`${BASE}/trash`, { params: { page: nextPage } })
        .then(({ data }) => {
          setResult(data);
          setError("");
        })
        .catch(() => setError("Could not load Trash.")),
    []
  );
  useEffect(() => {
    load(page);
  }, [page, load]);

  const rows = result?.rows || [];
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.conversationId));
  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((s) => {
      const next = new Set(s);
      rows.forEach((r) => (allOnPage ? next.delete(r.conversationId) : next.add(r.conversationId)));
      return next;
    });

  const fail = (err) => ERRORS[err?.response?.data?.error] || ERRORS.server_error;

  const restore = async (ids) => {
    setBusy(true);
    setNotice("");
    try {
      const { data } = await api.post(`${BASE}/trash/restore`, { ids });
      setNotice(`${data.restored} chat${data.restored === 1 ? "" : "s"} restored to the Archive.`);
      setSelected(new Set());
      await load(page);
    } catch (err) {
      setError(fail(err));
    } finally {
      setBusy(false);
    }
  };

  const purge = async (typed) => {
    setBusy(true);
    setDialogError("");
    try {
      const body = dialog.all ? { all: true } : { ids: dialog.ids };
      const { data } = await api.post(`${BASE}/trash/purge`, { ...body, ...(typed ? { confirm: typed } : {}) });
      setNotice(
        `${data.purged} chat${data.purged === 1 ? "" : "s"} deleted permanently.` +
          (data.failedStorage ? ` ${data.failedStorage} could not be removed from storage and will be retried.` : "")
      );
      setDialog(null);
      setSelected(new Set());
      await load(page);
    } catch (err) {
      setDialogError(fail(err));
    } finally {
      setBusy(false);
    }
  };

  const ids = [...selected];

  return (
    <div className="ar">
      <div className="ar-head">
        <div>
          <h1>Trash</h1>
          <p className="wk-muted">Deleted chats are kept here for 30 days, then removed for good with their messages and files. Only a Super Admin can see this page.</p>
        </div>
      </div>

      <div className="ar-bulk">
        <button type="button" className="wk-btn" disabled={!ids.length || busy} onClick={() => restore(ids)}>
          Restore selected{ids.length ? ` (${ids.length})` : ""}
        </button>
        <button type="button" className="wk-btn dc-danger" disabled={!ids.length || busy} onClick={() => setDialog({ ids, all: false })}>
          Delete permanently{ids.length ? ` (${ids.length})` : ""}
        </button>
        <button type="button" className="wk-btn dc-danger-ghost" disabled={!result?.total || busy} onClick={() => setDialog({ ids: [], all: true })}>
          Empty Trash
        </button>
      </div>

      {notice && (
        <div className="ar-note" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="wk-error" role="alert">
          {error}
        </div>
      )}

      <div className="ar-tablewrap" data-lenis-prevent>
        <table className="ar-table ar-table--narrow">
          <thead>
            <tr>
              <th className="ar-check">
                <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select all chats on this page" />
              </th>
              <th>Patient</th>
              <th>Type</th>
              <th>Archived</th>
              <th>Deleted</th>
              <th>Removed for good in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.conversationId} className="ar-row--static">
                <td className="ar-check">
                  <input type="checkbox" checked={selected.has(row.conversationId)} onChange={() => toggle(row.conversationId)} aria-label={`Select chat ${row.conversationId}`} />
                </td>
                <td>
                  <b>{row.name || "Visitor"}</b>
                  <small className="wk-mono wk-muted">{row.conversationId}</small>
                </td>
                <td>
                  <span className={`wk-tag ${row.type === "live" ? "wk-tag--human" : "wk-tag--ai"}`}>{row.type === "live" ? "Live agent" : "AI"}</span>
                </td>
                <td>{dateTime(row.closedAt)}</td>
                <td>{dateTime(row.trashedAt)}</td>
                <td>{row.daysLeft} day{row.daysLeft === 1 ? "" : "s"}</td>
                <td>
                  <button type="button" className="wk-btn" disabled={busy} onClick={() => restore([row.conversationId])}>
                    Restore
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr className="ar-empty">
                <td colSpan={7}>{result ? "Trash is empty." : "Loading…"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ar-pager">
        <span className="wk-small wk-muted">{result ? `${result.total} chat${result.total === 1 ? "" : "s"} · page ${result.page} of ${result.pages}` : ""}</span>
        <div>
          <button type="button" className="wk-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button type="button" className="wk-btn" disabled={!result || page >= result.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      {dialog && (
        <DeleteChatsDialog
          title="Delete permanently"
          count={dialog.all ? result?.total ?? 0 : dialog.ids.length}
          countLabel="will be removed for good"
          description="Their messages, translations, contact details and files are deleted and cannot be restored."
          confirmLabel="Delete permanently"
          requireTyping={dialog.all || dialog.ids.length > CONFIRM_ABOVE}
          busy={busy}
          error={dialogError}
          onConfirm={purge}
          onCancel={() => {
            setDialog(null);
            setDialogError("");
          }}
        />
      )}
    </div>
  );
}
