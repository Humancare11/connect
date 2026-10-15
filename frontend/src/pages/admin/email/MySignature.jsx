import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signaturesApi, apiMessage } from "../../../api/emailApi";
import { Icon } from "./EmailParts";
import { SignatureImage } from "./SignatureView";
import { EMAIL_BASE } from "./emailUtils";
import { SIGNATURES_KEY, imageFileProblem } from "./signatureUtils";
import "./email.css";

// My signature: ONE image. Upload (drag or click), see how it looks in a mail, replace or remove
// it, and choose whether it is added to new mails automatically. Nothing else.
export default function MySignature() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [askRemove, setAskRemove] = useState(false);

  const q = useQuery({ queryKey: SIGNATURES_KEY, queryFn: signaturesApi.get, staleTime: 10_000 });
  const signature = q.data?.signature || null;
  const hasImage = Boolean(signature?.image);

  const say = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  };
  // The server answers with the new state: show it at once, no second round trip.
  const store = (res) => qc.setQueryData(SIGNATURES_KEY, (old) => ({ ...(old || {}), signature: res.signature }));

  const upload = useMutation({
    mutationFn: (file) => signaturesApi.uploadImage(file),
    onSuccess: (res) => {
      setError("");
      setAskRemove(false);
      store(res);
      say("Signature saved");
    },
    onError: (err) => setError(apiMessage(err, "The image could not be uploaded. Please try again.")),
  });
  const remove = useMutation({
    mutationFn: () => signaturesApi.removeImage(),
    onSuccess: (res) => {
      setError("");
      setAskRemove(false);
      store(res);
      say("Signature removed");
    },
    onError: (err) => {
      setAskRemove(false);
      setError(apiMessage(err));
    },
  });
  const autoAdd = useMutation({
    mutationFn: (value) => signaturesApi.setAutoAdd(value),
    onSuccess: (res) => {
      setError("");
      store(res);
      say(res.signature.autoAdd ? "Will be added to new mails" : "Won't be added automatically");
    },
    onError: (err) => {
      setError(apiMessage(err));
      qc.invalidateQueries({ queryKey: SIGNATURES_KEY });
    },
  });

  const choose = (file) => {
    const problem = imageFileProblem(file);
    if (problem) return setError(problem);
    setError("");
    upload.mutate(file);
  };
  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) choose(file);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) choose(file);
  };
  const openPicker = () => fileRef.current?.click();
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="em-root mi-page">
      <div className="mi-top">
        <div>
          <Link to={`${EMAIL_BASE}/inbox`} className="mi-back"><Icon name="back" size={16} /> Back to Email</Link>
          <h1>My signature</h1>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={onPick} aria-label="Upload signature image" className="sg-file" tabIndex={-1} />

      <div className="mi-card sg-card">
        <h2 className="sg-h2">My email signature</h2>
        <p className="em-sub sg-lead">Upload one image. It is added below your message in mails you send. Only you can see and change it.</p>

        {error && <div className="mi-error" role="alert">{error}</div>}
        {q.isLoading && <div className="em-empty">Loading…</div>}
        {q.isError && <div className="em-empty em-err">{apiMessage(q.error, "Could not load your signature.")}</div>}

        {q.isSuccess && !hasImage && (
          <div
            className={`sg-drop${over ? " over" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Upload signature image"
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }}
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span className="sg-drop-ico"><Icon name="upload" size={22} /></span>
            <b>{upload.isPending ? "Uploading…" : "Upload signature image"}</b>
            <span>Drag an image here or click to choose</span>
            <small>PNG or JPG · best 600px wide · it will be resized automatically</small>
          </div>
        )}

        {q.isSuccess && hasImage && (
          <>
            <p className="sg-prev-h">How it looks in a mail</p>
            <div className="sg-frame">
              <div className="sg-frame-head">
                <span><b>From:</b> Human Care Connect</span>
                <span><b>To:</b> client@example.com</span>
              </div>
              <div className="sg-frame-body">
                <p>Dear Mr. Rao,</p>
                <p>Your appointment is confirmed for 18 October at 11:00 AM.</p>
                <p>Regards</p>
                <SignatureImage signature={signature} className="sg-img sg-big" />
              </div>
            </div>

            <div className="sg-actions">
              <button type="button" className="em-btn em-btn-ghost" onClick={openPicker} disabled={busy}>
                {upload.isPending ? "Uploading…" : "Replace image"}
              </button>
              <button type="button" className="em-btn em-btn-ghost sg-danger" onClick={() => setAskRemove(true)} disabled={busy}>
                Remove
              </button>
            </div>

            {askRemove && (
              <div className="sg-confirm" role="alertdialog" aria-label="Remove signature">
                <span>Remove your signature image? Mail you already sent is not changed.</span>
                <button type="button" className="em-btn em-btn-danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  {remove.isPending ? "Removing…" : "Remove"}
                </button>
                <button type="button" className="em-btn em-btn-ghost" onClick={() => setAskRemove(false)} disabled={remove.isPending}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

        {q.isSuccess && (
          <label className="sg-toggle">
            <input
              type="checkbox"
              checked={signature?.autoAdd !== false}
              disabled={autoAdd.isPending}
              onChange={(e) => autoAdd.mutate(e.target.checked)}
            />
            <span>
              <b>Add to new mails automatically</b>
              <small>You can still switch it off for a single mail while writing.</small>
            </span>
          </label>
        )}

        <p className="sg-private">
          <Icon name="lock" size={15} /> Only you can see this signature. Other admins have their own.
        </p>
      </div>

      {toast && createPortal(<div className="em-root"><div className="em-toast" role="status">{toast}</div></div>, document.body)}
    </div>
  );
}
