import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signaturesApi, apiMessage } from "../../../api/emailApi";
import { Icon } from "./EmailParts";
import { Modal } from "./MiParts";
import { EMAIL_BASE } from "./emailUtils";
import { SIGNATURES_KEY, previewMail } from "./signatureUtils";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import "./email.css";

function SignatureForm({ initial, limits, title, onClose, onSaved }) {
  const [name, setName] = useState(initial.name);
  const [content, setContent] = useState(initial.content);
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [error, setError] = useState("");
  const max = limits.maxContentLength;

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), content, isDefault };
      return initial.id ? signaturesApi.update(initial.id, payload) : signaturesApi.create(payload);
    },
    onSuccess: (res) => onSaved(res.signature),
    onError: (err) => setError(apiMessage(err)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (save.isPending) return;
    if (!name.trim()) return setError("Give the signature a name.");
    if (!content.trim()) return setError("Write the signature text.");
    if (content.length > max) return setError(`The signature can be up to ${max} characters.`);
    setError("");
    save.mutate();
  };

  return (
    <Modal title={title} onClose={() => (save.isPending ? undefined : onClose())}>
      <form className="mi-form" onSubmit={submit} noValidate>
        <label className="mi-field">
          <span>Name</span>
          <input type="text" value={name} maxLength={limits.maxNameLength} onChange={(e) => setName(e.target.value)} placeholder="Formal, Short, …" autoFocus />
          <small className="em-sub">Only you see the name. It helps you choose when you write.</small>
        </label>

        <label className="mi-field">
          <span>Signature</span>
          <textarea className="sg-text" rows={7} value={content} onChange={(e) => setContent(e.target.value)} aria-describedby="sg-count" />
          <small id="sg-count" className={`em-sub sg-counter${content.length > max ? " over" : ""}`}>
            {content.length} / {max}
          </small>
        </label>

        <p className="em-sub">
          Plain text. Web addresses (https:// or www.) become links. Clients see this exactly as you write it, including your name.
        </p>

        <label className="mi-check">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Use this one by default
        </label>

        {error && <div className="mi-error" role="alert">{error}</div>}

        <div className="mi-actions">
          <button type="button" className="em-btn em-btn-ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button type="submit" className="em-btn em-btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Every admin and Super Admin: their OWN signatures (the server refuses anything else).
export default function MySignature() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState(null); // { kind: "new" | "edit", signature? }
  const [toast, setToast] = useState("");
  const [rowError, setRowError] = useState("");
  const [previewId, setPreviewId] = useState("");
  const toastTimer = useRef(null);

  const q = useQuery({ queryKey: SIGNATURES_KEY, queryFn: signaturesApi.get, staleTime: 0 });
  const data = q.data;
  const signatures = data?.signatures || [];
  const mailboxes = data?.mailboxes || [];
  const limits = data?.limits || { maxSignatures: 10, maxNameLength: 40, maxContentLength: 1000 };
  const atLimit = signatures.length >= limits.maxSignatures;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = () => qc.invalidateQueries({ queryKey: SIGNATURES_KEY });
  const done = (message) => {
    setDialog(null);
    setRowError("");
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
    refresh();
  };

  const makeDefault = useMutation({
    mutationFn: (s) => signaturesApi.update(s.id, { isDefault: true }),
    onSuccess: (res) => done(`“${res.signature.name}” is now your default.`),
    onError: (err) => setRowError(apiMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (s) => signaturesApi.remove(s.id),
    onSuccess: () => done("Signature deleted."),
    onError: (err) => setRowError(apiMessage(err)),
  });
  const setForMailbox = useMutation({
    mutationFn: ({ mailbox, signatureId }) => signaturesApi.setMailboxDefault(mailbox, signatureId),
    onSuccess: () => done("Saved."),
    onError: (err) => setRowError(apiMessage(err)),
  });

  const askDelete = async (s) => {
    const ok = await confirm({
      title: "Delete signature",
      message: `Delete “${s.name}”? Mail you already sent is not changed.`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (ok) remove.mutate(s);
  };

  // The preview follows the Super Admin setting for the company footer.
  const previewSig = signatures.find((s) => s.id === previewId) || signatures.find((s) => s.isDefault) || signatures[0] || null;
  const footerText = mailboxes.find((m) => m.companyFooter)?.companyFooter || "";
  const withFooter = data?.companyFooterWithSignature !== false;

  return (
    <div className="em-root mi-page">
      <div className="mi-top">
        <div>
          <Link to={`${EMAIL_BASE}/inbox`} className="mi-back"><Icon name="back" size={16} /> Back to Email</Link>
          <h1>My signature</h1>
          <p className="em-sub">
            Your signatures go below your message when you write or reply. Only you can see and change them: no other admin can, and
            neither can a Super Admin.
          </p>
        </div>
        <button
          type="button"
          className="em-btn em-btn-primary"
          disabled={atLimit || !data}
          title={atLimit ? `You can keep up to ${limits.maxSignatures} signatures.` : undefined}
          onClick={() => setDialog({ kind: "new" })}
        >
          + New signature
        </button>
      </div>

      <div className="sg-note" role="note">
        <b>Clients will see this.</b> Until now clients never saw an admin&rsquo;s name; with a signature they do, as you write it. Web
        addresses in a signature are clickable and, when link tracking is on, a click on one also counts as a click on the mail.
      </div>

      {rowError && <div className="mi-error" role="alert">{rowError}</div>}
      {toast && createPortal(<div className="em-root"><div className="em-toast" role="status">{toast}</div></div>, document.body)}

      <div className="mi-card">
        {q.isLoading && <div className="em-empty">Loading…</div>}
        {q.isError && <div className="em-empty em-err">{apiMessage(q.error, "Could not load your signatures.")}</div>}
        {q.isSuccess && !signatures.length && (
          <div className="em-empty">
            You have no signatures yet. Mail goes out with the company footer only.
            <div style={{ marginTop: 10 }}>
              <button type="button" className="em-btn em-btn-primary" onClick={() => setDialog({ kind: "new" })}>
                Create your first signature
              </button>
            </div>
          </div>
        )}

        {signatures.length > 0 && (
          <ul className="sg-list">
            {signatures.map((s) => (
              <li key={s.id} className="sg-item">
                <div className="sg-head">
                  <b>{s.name}</b>
                  {s.isDefault && <span className="em-tag mi-on">Default</span>}
                  <span style={{ flex: 1 }} />
                  {!s.isDefault && (
                    <button type="button" className="em-btn em-btn-ghost" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(s)}>
                      Make default
                    </button>
                  )}
                  <button type="button" className="em-btn em-btn-ghost" onClick={() => setDialog({ kind: "edit", signature: s })}>
                    Edit
                  </button>
                  <button type="button" className="em-btn em-btn-ghost" disabled={remove.isPending} onClick={() => askDelete(s)}>
                    Delete
                  </button>
                </div>
                <pre className="sg-pre">{s.content}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>

      {signatures.length > 0 && mailboxes.length > 0 && (
        <section className="mi-section" aria-labelledby="sg-mb-h">
          <h2 id="sg-mb-h">Per mailbox</h2>
          <p className="em-sub">
            Use a different signature when you write from a particular mailbox. Without a choice here, your default is used.
          </p>
          <div className="mi-card">
            <ul className="sg-boxes">
              {mailboxes.map((m) => (
                <li key={m.id}>
                  <span className="sg-box-name">
                    <b>{m.displayName || m.address}</b>
                    <small className="em-sub">{m.address}</small>
                  </span>
                  <select
                    aria-label={`Signature when sending from ${m.address}`}
                    value={data.mailboxDefaults?.[m.id] || ""}
                    disabled={setForMailbox.isPending}
                    onChange={(e) => setForMailbox.mutate({ mailbox: m.id, signatureId: e.target.value || null })}
                  >
                    <option value="">My default{signatures.find((s) => s.isDefault) ? ` (${signatures.find((s) => s.isDefault).name})` : " (none)"}</option>
                    {signatures.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {previewSig && (
        <section className="mi-section" aria-labelledby="sg-pv-h">
          <h2 id="sg-pv-h">How it ends a mail</h2>
          {signatures.length > 1 && (
            <label className="em-sub" style={{ display: "block", marginBottom: 6 }}>
              Preview{" "}
              <select value={previewSig.id} onChange={(e) => setPreviewId(e.target.value)}>
                {signatures.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          <pre className="sg-pre sg-preview" aria-label="Preview">
            {previewMail({ message: "Dear client,\n\nThank you for your enquiry.", signature: previewSig.content, companyFooter: footerText, withCompanyFooter: withFooter })}
          </pre>
          <p className="em-sub">
            {withFooter && footerText
              ? "The company footer follows your signature."
              : "The company footer is not added when a signature is used (a Super Admin setting)."}
          </p>
        </section>
      )}

      {dialog?.kind === "new" && (
        <SignatureForm
          title="New signature"
          initial={{ name: "", content: data?.template || "", isDefault: signatures.length === 0 }}
          limits={limits}
          onClose={() => setDialog(null)}
          onSaved={(s) => done(`“${s.name}” saved.`)}
        />
      )}
      {dialog?.kind === "edit" && (
        <SignatureForm
          title="Edit signature"
          initial={dialog.signature}
          limits={limits}
          onClose={() => setDialog(null)}
          onSaved={(s) => done(`“${s.name}” saved.`)}
        />
      )}
    </div>
  );
}
