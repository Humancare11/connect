import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signaturesApi, apiMessage } from "../../../api/emailApi";
import { Icon } from "./EmailParts";
import { Modal } from "./MiParts";
import { MailEnding, SignatureImage } from "./SignatureView";
import { EMAIL_BASE } from "./emailUtils";
import { IMAGE_TIP, SIGNATURES_KEY, previewMail } from "./signatureUtils";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import "./email.css";

const LAYOUTS = [
  ["text", "Text only"],
  ["image", "Image only"],
  ["image_text", "Image with text lines below"],
];

function SignatureForm({ initial, limits, title, onClose, onSaved }) {
  const [name, setName] = useState(initial.name);
  const [content, setContent] = useState(initial.content);
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [layout, setLayout] = useState(initial.layout || "text");
  const [alt, setAlt] = useState(initial.imageAlt || "");
  const [link, setLink] = useState(initial.imageLink || "");
  const [file, setFile] = useState(null);
  const [dropImage, setDropImage] = useState(false);
  const [error, setError] = useState("");
  // Once the text has been saved, a retry updates it instead of creating a second signature.
  const savedId = useRef(initial.id || "");
  const max = limits.maxContentLength;

  const hasImage = Boolean(file) || Boolean(initial.image && !dropImage);
  const effectiveLayout = hasImage ? layout : "text";

  // Preview of a file that was just chosen (before it is uploaded).
  const picked = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => picked && URL.revokeObjectURL(picked), [picked]);

  const choose = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return setError("Only PNG or JPG images are allowed.");
    if (f.size > 5 * 1024 * 1024) return setError("The image is larger than 5 MB. Choose a smaller file.");
    setError("");
    setFile(f);
    setDropImage(false);
    if (layout === "text") setLayout("image_text");
  };

  const save = useMutation({
    mutationFn: async () => {
      const base = { name: name.trim(), content, isDefault };
      let sig = savedId.current
        ? (await signaturesApi.update(savedId.current, base)).signature
        : (await signaturesApi.create(base)).signature;
      savedId.current = sig.id;

      if (dropImage && sig.image && !file) sig = (await signaturesApi.removeImage(sig.id)).signature;
      if (file) sig = (await signaturesApi.uploadImage(sig.id, file)).signature;
      if (sig.image) {
        sig = (await signaturesApi.update(sig.id, { layout: effectiveLayout, imageAlt: alt.trim(), imageLink: link.trim() })).signature;
      }
      return sig;
    },
    onSuccess: (sig) => onSaved(sig),
    onError: (err) => setError(savedId.current && !initial.id ? `The text was saved, but: ${apiMessage(err)}` : apiMessage(err)),
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

  const textLabel =
    effectiveLayout === "image"
      ? "Text version (used in the plain-text mail)"
      : effectiveLayout === "image_text"
        ? "Text lines (shown below the image)"
        : "Signature";
  const textHelp =
    effectiveLayout === "image"
      ? "Not shown under the image. Mail apps that cannot show images, and plain-text mail, use this: name, title, phone, website."
      : effectiveLayout === "image_text"
        ? "Also used as the plain-text version. Web addresses (https:// or www.) become links."
        : "Plain text. Web addresses (https:// or www.) become links.";

  return (
    <Modal title={title} onClose={() => (save.isPending ? undefined : onClose())}>
      <form className="mi-form" onSubmit={submit} noValidate>
        <label className="mi-field">
          <span>Name</span>
          <input type="text" value={name} maxLength={limits.maxNameLength} onChange={(e) => setName(e.target.value)} placeholder="Formal, Short, …" autoFocus />
          <small className="em-sub">Only you see the name. It helps you choose when you write.</small>
        </label>

        <div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Image (optional)</span>
          <div className="sg-upload">
            <input type="file" accept="image/png,image/jpeg" onChange={choose} aria-label="Signature image" />
            {hasImage && (
              <button
                type="button"
                className="em-btn em-btn-ghost"
                onClick={() => {
                  setFile(null);
                  setDropImage(true);
                  setLayout("text");
                }}
              >
                Remove image
              </button>
            )}
          </div>
          <p className="sg-tip">{IMAGE_TIP}</p>
          <small className="em-sub">
            PNG or JPG. It is resized to at most {limits.maxImageWidth || 600} px wide, kept under {Math.round((limits.maxImageBytes || 204800) / 1024)} KB,
            and metadata is removed. Only you can see or use it.
          </small>
          {hasImage && (
            <div className="sg-img-box">
              {file ? (
                <img className="sg-img sg-thumb" src={picked} alt="Chosen file" />
              ) : (
                <SignatureImage signature={initial} className="sg-img sg-thumb" maxWidth={300} />
              )}
              {file && <small className="em-sub" style={{ display: "block" }}>This is your file; the saved image is the resized copy.</small>}
            </div>
          )}
        </div>

        {hasImage && (
          <fieldset className="sg-layout" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 700 }}>What to show</legend>
            {LAYOUTS.map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="sg-layout" value={value} checked={effectiveLayout === value} onChange={() => setLayout(value)} />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        <label className="mi-field">
          <span>{textLabel}</span>
          <textarea className="sg-text" rows={7} value={content} onChange={(e) => setContent(e.target.value)} aria-describedby="sg-count" />
          <small id="sg-count" className={`em-sub sg-counter${content.length > max ? " over" : ""}`}>
            {content.length} / {max}
          </small>
          <small className="em-sub">{textHelp}</small>
        </label>

        {hasImage && effectiveLayout !== "text" && (
          <>
            <label className="mi-field">
              <span>Image description (alt text)</span>
              <input type="text" value={alt} maxLength={120} onChange={(e) => setAlt(e.target.value)} placeholder={content.split("\n")[0].slice(0, 120) || "Shown if the image is not displayed"} />
              <small className="em-sub">Read aloud by screen readers and shown when the image is not displayed. Empty uses the first text line.</small>
            </label>
            <label className="mi-field">
              <span>Link for the whole image (optional)</span>
              <input type="text" inputMode="url" value={link} maxLength={500} onChange={(e) => setLink(e.target.value)} placeholder="https://humancareconnect.co" />
              <small className="em-sub">When link tracking is on, a click on the image is counted like any link.</small>
            </label>
          </>
        )}

        <p className="em-sub">Clients see this exactly as you set it, including your name.</p>

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

  const previewSig = signatures.find((s) => s.id === previewId) || signatures.find((s) => s.isDefault) || signatures[0] || null;
  const footerText = mailboxes.find((m) => m.companyFooter)?.companyFooter || "";
  const withFooter = data?.companyFooterWithSignature !== false;
  const layoutOf = (s) => (s.image ? s.layout || "text" : "text");

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
                  {s.image && <span className="em-tag">{layoutOf(s) === "image" ? "Image" : layoutOf(s) === "image_text" ? "Image + text" : "Text (image kept)"}</span>}
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
                {s.image && layoutOf(s) !== "text" && (
                  <div className="sg-img-box">
                    <SignatureImage signature={s} className="sg-img sg-thumb" maxWidth={300} />
                  </div>
                )}
                <pre className="sg-pre">{s.content}</pre>
                {layoutOf(s) === "image" && <small className="em-sub">Plain-text version only; the image is shown in HTML mail.</small>}
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
          {layoutOf(previewSig) === "text" ? (
            <pre className="sg-pre sg-preview" aria-label="Preview">
              {previewMail({ message: "Dear client,\n\nThank you for your enquiry.", signature: previewSig.content, companyFooter: footerText, withCompanyFooter: withFooter })}
            </pre>
          ) : (
            <MailEnding
              message={"Dear client,\n\nThank you for your enquiry."}
              layout={layoutOf(previewSig)}
              image={<SignatureImage signature={previewSig} className="sg-img" />}
              lines={previewSig.content}
              company={withFooter ? footerText : ""}
            />
          )}
          <p className="em-sub">
            {layoutOf(previewSig) === "text"
              ? withFooter && footerText
                ? "The company footer follows your signature."
                : "The company footer is not added when a signature is used (a Super Admin setting)."
              : "This is how it looks in HTML mail. Plain-text mail shows the text lines with the company footer."}
          </p>
        </section>
      )}

      {dialog?.kind === "new" && (
        <SignatureForm
          title="New signature"
          initial={{ name: "", content: data?.template || "", isDefault: signatures.length === 0, layout: "text", image: null }}
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
