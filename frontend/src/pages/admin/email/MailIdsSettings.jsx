import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mailIdsApi, apiMessage } from "../../../api/emailApi";
import { Icon } from "./EmailParts";
import { Modal } from "./MiParts";
import TrackingSettingsCard from "./TrackingSettingsCard";
import { EMAIL_BASE, fmtFull } from "./emailUtils";
import "./email.css";

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#0d7a6f";
const DEFAULT_FOOTER = "Human Care Connect";

function ago(value) {
  if (!value) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// Label + colour picker + hex field, shared by the Add and Edit forms.
function ColorField({ value, onChange }) {
  return (
    <div className="mi-color">
      <input type="color" aria-label="Pick a colour" value={COLOR_RE.test(value) ? value : DEFAULT_COLOR} onChange={(e) => onChange(e.target.value)} />
      <input type="text" aria-label="Colour (hex)" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} className="mono" />
    </div>
  );
}

function AddModal({ domain, onClose, onAdded }) {
  const [address, setAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [signature, setSignature] = useState(DEFAULT_FOOTER);
  const [trackOpensDefault, setTrackOpensDefault] = useState(true);
  const [error, setError] = useState("");
  // The address that passed the check. Editing the field invalidates it.
  const [checked, setChecked] = useState("");
  const typed = address.trim().toLowerCase();

  const check = useMutation({
    mutationFn: () => mailIdsApi.check(typed),
    onSuccess: (res) => {
      if (res.ok) {
        setChecked(typed);
        setError("");
      } else {
        setChecked("");
        setError(res.message || "The connection check failed.");
      }
    },
    onError: (err) => {
      setChecked("");
      setError(apiMessage(err));
    },
  });

  const add = useMutation({
    mutationFn: () => mailIdsApi.add({ address: typed, displayName: displayName.trim(), color, signature, trackOpensDefault }),
    onSuccess: (res) => onAdded(res.mailbox),
    onError: (err) => setError(apiMessage(err)),
  });

  const verified = checked === typed && typed !== "";
  const formOk = displayName.trim() && COLOR_RE.test(color);
  const busy = check.isPending || add.isPending;

  const runCheck = () => {
    if (!typed.endsWith(`@${domain}`)) return setError(`The address must end in @${domain}.`);
    setError("");
    check.mutate();
  };

  return (
    <Modal title="Add a mail ID" onClose={busy ? () => {} : onClose}>
      <form
        className="mi-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!verified || !formOk || busy) return;
          setError("");
          add.mutate();
        }}
        noValidate
      >
        <label htmlFor="mi-address">Email address</label>
        <div className="mi-inline">
          <input
            id="mi-address"
            type="email"
            autoFocus
            placeholder={`hr@${domain}`}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setError("");
            }}
          />
          <button type="button" className="em-btn em-btn-ghost" onClick={runCheck} disabled={busy || !typed}>
            {check.isPending ? "Checking…" : "Check connection"}
          </button>
        </div>
        <p className="em-sub">
          Must be a user mailbox on @{domain} (not a Group or alias). The check only reads the profile and the latest mail ids.
        </p>
        {verified && <div className="mi-ok" role="status">Connected — Google accepts this mailbox.</div>}

        <label htmlFor="mi-name">Display name</label>
        <input id="mi-name" type="text" maxLength={60} placeholder="e.g. Accounts" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

        <label>Colour</label>
        <ColorField value={color} onChange={setColor} />

        <label htmlFor="mi-footer">Footer (added under every mail sent from this ID)</label>
        <textarea id="mi-footer" rows={3} maxLength={500} value={signature} onChange={(e) => setSignature(e.target.value)} />

        <label className="mi-check">
          <input type="checkbox" checked={trackOpensDefault} onChange={(e) => setTrackOpensDefault(e.target.checked)} />
          Track opens by default for mail sent from this ID
        </label>

        {error && <div className="mi-error" role="alert">{error}</div>}
        <p className="em-sub">After saving, mail from the last 30 days is imported automatically within about a minute.</p>
        <div className="mi-actions">
          <button type="button" className="em-btn em-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="em-btn em-btn-primary" disabled={!verified || !formOk || busy}>
            {add.isPending ? "Saving…" : "Save mail ID"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ mailbox, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(mailbox.displayName);
  const [color, setColor] = useState(mailbox.color);
  const [signature, setSignature] = useState(mailbox.signature || "");
  const [trackOpensDefault, setTrackOpensDefault] = useState(mailbox.trackOpensDefault !== false);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => mailIdsApi.update(mailbox.id, { displayName: displayName.trim(), color, signature, trackOpensDefault }),
    onSuccess: (res) => onSaved(res.mailbox),
    onError: (err) => setError(apiMessage(err)),
  });
  const ok = displayName.trim() && COLOR_RE.test(color);

  return (
    <Modal title={`Edit ${mailbox.address}`} onClose={save.isPending ? () => {} : onClose}>
      <form
        className="mi-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && !save.isPending) save.mutate();
        }}
        noValidate
      >
        <label>Email address</label>
        <input type="text" value={mailbox.address} readOnly aria-readonly="true" className="mi-readonly" />
        <p className="em-sub">The address cannot be changed. Add a new mail ID instead.</p>

        <label htmlFor="mi-name">Display name</label>
        <input id="mi-name" type="text" maxLength={60} autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

        <label>Colour</label>
        <ColorField value={color} onChange={setColor} />

        <label htmlFor="mi-footer">Footer</label>
        <textarea id="mi-footer" rows={3} maxLength={500} value={signature} onChange={(e) => setSignature(e.target.value)} />

        <label className="mi-check">
          <input type="checkbox" checked={trackOpensDefault} onChange={(e) => setTrackOpensDefault(e.target.checked)} />
          Track opens by default for mail sent from this ID
        </label>
        <p className="em-sub">Only has an effect while open tracking is switched on below. Admins can still change it for each mail.</p>

        {error && <div className="mi-error" role="alert">{error}</div>}
        <div className="mi-actions">
          <button type="button" className="em-btn em-btn-ghost" onClick={onClose} disabled={save.isPending}>Cancel</button>
          <button type="submit" className="em-btn em-btn-primary" disabled={!ok || save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDeactivate({ mailbox, onClose, onDone }) {
  const [error, setError] = useState("");
  const off = useMutation({
    mutationFn: () => mailIdsApi.update(mailbox.id, { isActive: false }),
    onSuccess: (res) => onDone(res.mailbox),
    onError: (err) => setError(apiMessage(err)),
  });
  return (
    <Modal title="Deactivate this mail ID?" onClose={off.isPending ? () => {} : onClose}>
      <div className="mi-form">
        <p>
          Admins will stop seeing <b>{mailbox.address}</b> in the Email module and no new mail will be imported. Mail already stored is
          kept, and you can reactivate it any time.
        </p>
        {error && <div className="mi-error" role="alert">{error}</div>}
        <div className="mi-actions">
          <button type="button" className="em-btn em-btn-ghost" onClick={onClose} disabled={off.isPending}>Cancel</button>
          <button type="button" className="em-btn mi-danger" onClick={() => off.mutate()} disabled={off.isPending}>
            {off.isPending ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SyncCell({ m }) {
  if (!m.isActive) return <span className="em-sub">Not syncing</span>;
  if (m.lastSyncError) {
    return (
      <div>
        <span className="mi-sync-err">Last sync failed</span>
        <div className="mi-errmsg" title={m.lastSyncError}>{m.lastSyncError}</div>
        {m.lastSyncAt && <div className="em-sub">Last OK {ago(m.lastSyncAt)}</div>}
      </div>
    );
  }
  if (!m.lastSyncAt) return <span className="em-sub">{m.firstSyncPending ? "First sync pending…" : "Not synced yet"}</span>;
  return <span title={fmtFull(m.lastSyncAt)}>{ago(m.lastSyncAt)}</span>;
}

// Super Admin only (the route guard hides it; the API refuses everyone else too).
export default function MailIdsSettings() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // { kind: "add" | "edit" | "off", mailbox? }
  const [toast, setToast] = useState("");
  const [rowError, setRowError] = useState("");
  const toastTimer = useRef(null);

  const listQ = useQuery({ queryKey: ["mail-ids"], queryFn: mailIdsApi.list, refetchInterval: 30_000, staleTime: 0 });
  const mailboxes = listQ.data?.mailboxes || [];
  const domain = listQ.data?.domain || "humancareconnect.co";

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mail-ids"] });
    qc.invalidateQueries({ queryKey: ["email", "mailboxes"] });
  };
  const done = (message) => {
    setDialog(null);
    setRowError("");
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
    refresh();
  };

  const reactivate = useMutation({
    mutationFn: (m) => mailIdsApi.update(m.id, { isActive: true }),
    onSuccess: (res) => done(`${res.mailbox.address} is active again.`),
    onError: (err) => setRowError(apiMessage(err)),
  });

  return (
    <div className="em-root mi-page">
      <div className="mi-top">
        <div>
          <Link to={`${EMAIL_BASE}/inbox`} className="mi-back"><Icon name="back" size={16} /> Back to Email</Link>
          <h1>Mail IDs</h1>
          <p className="em-sub">Company mailboxes used in the Email module. Only Super Admins can see this page.</p>
        </div>
        <button type="button" className="em-btn em-btn-primary" onClick={() => setDialog({ kind: "add" })}>+ Add mail ID</button>
      </div>

      {rowError && <div className="mi-error" role="alert">{rowError}</div>}

      <div className="mi-card">
        {listQ.isLoading && <div className="em-empty">Loading…</div>}
        {listQ.isError && <div className="em-empty em-err">{apiMessage(listQ.error, "Could not load mail IDs.")}</div>}
        {listQ.isSuccess && !mailboxes.length && <div className="em-empty">No mail IDs yet. Add the first one.</div>}

        {mailboxes.length > 0 && (
          <div className="mi-table" role="table" aria-label="Mail IDs">
            <div className="mi-tr mi-th" role="row">
              <span role="columnheader">Mail ID</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Last sync</span>
              <span role="columnheader" className="mi-num">Mail</span>
              <span role="columnheader" />
            </div>
            {mailboxes.map((m) => (
              <div className={`mi-tr${m.isActive ? "" : " off"}`} role="row" key={m.id}>
                <span role="cell" className="mi-id">
                  <span className="em-box-dot" style={{ background: m.color }} />
                  <span>
                    <b>{m.displayName}</b>
                    <small>{m.address}</small>
                    {m.trackOpensDefault === false && <small className="mi-note">Open tracking off by default</small>}
                  </span>
                </span>
                <span role="cell">
                  <span className={`em-tag ${m.isActive ? "mi-on" : "mi-off"}`}>{m.isActive ? "Active" : "Inactive"}</span>
                </span>
                <span role="cell"><SyncCell m={m} /></span>
                <span role="cell" className="mi-num">{m.messageCount}</span>
                <span role="cell" className="mi-row-actions">
                  <button type="button" className="em-btn em-btn-ghost" onClick={() => setDialog({ kind: "edit", mailbox: m })}>Edit</button>
                  {m.isActive ? (
                    <button type="button" className="em-btn em-btn-ghost" onClick={() => setDialog({ kind: "off", mailbox: m })}>Deactivate</button>
                  ) : (
                    <button type="button" className="em-btn em-btn-ghost" onClick={() => reactivate.mutate(m)} disabled={reactivate.isPending}>
                      {reactivate.isPending && reactivate.variables?.id === m.id ? "Checking…" : "Reactivate"}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <TrackingSettingsCard />

      {dialog?.kind === "add" && (
        <AddModal domain={domain} onClose={() => setDialog(null)} onAdded={(m) => done(`${m.address} added. Mail is being imported.`)} />
      )}
      {dialog?.kind === "edit" && <EditModal mailbox={dialog.mailbox} onClose={() => setDialog(null)} onSaved={(m) => done(`${m.address} updated.`)} />}
      {dialog?.kind === "off" && (
        <ConfirmDeactivate mailbox={dialog.mailbox} onClose={() => setDialog(null)} onDone={(m) => done(`${m.address} deactivated.`)} />
      )}

      {toast && createPortal(<div className="em-root"><div className="em-toast" role="status">{toast}</div></div>, document.body)}
    </div>
  );
}
