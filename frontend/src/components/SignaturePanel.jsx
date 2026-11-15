import { useRef, useState } from "react";
import { validateSignatureFile } from "../utils/visitNote";
import "./SignaturePanel.css";

// A small pen pad. Exports a PNG that goes through exactly the same preview/save flow as a chosen file.
export function DrawPad({ onDone, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  };
  const start = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0b1f4d";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setEmpty(false);
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const use = () => {
    canvasRef.current.toBlob((blob) => {
      if (blob) onDone(new File([blob], "signature.png", { type: "image/png" }));
    }, "image/png");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="sgp-draw"
        width={520}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        aria-label="Draw your signature"
      />
      <div className="sgp-actions" style={{ marginTop: 8 }}>
        <button type="button" className="sgp-btn" onClick={clear}>Clear</button>
        <button type="button" className="sgp-btn sgp-btn--primary" onClick={use} disabled={empty}>Use this signature</button>
        <button type="button" className="sgp-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * The one place a doctor sets their signature: upload a PNG/JPG or draw one, check the processed preview, then save.
 * Used by the Visit Note review page, the Prescription form, the Certificate form and the profile "My Signature" card.
 *
 *   sig       the object returned by hooks/useDoctorSignature
 *   onSaved   called after a new signature has been stored
 *   prompt    optional message shown when no signature is saved yet
 */
export default function SignaturePanel({ sig, onSaved, prompt = "" }) {
  const fileRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState(null); // { file, previewDataUrl, sourceType, backgroundRemoved }
  const [removeBg, setRemoveBg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPending(null);
    setDrawing(false);
    setRemoveBg(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const runPreview = async (file, removeBackground) => {
    setBusy(true);
    setError("");
    try {
      const result = await sig.preview(file, removeBackground);
      setPending({ file, ...result });
      setDrawing(false);
    } catch (err) {
      setError(err.response?.data?.msg || "Could not read that image.");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  };

  const choose = async (file) => {
    setError("");
    const problem = await validateSignatureFile(file);
    if (problem) {
      setError(problem);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setRemoveBg(true);
    await runPreview(file, true);
  };

  const toggleBackground = (checked) => {
    setRemoveBg(checked);
    if (pending) runPreview(pending.file, checked);
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await sig.save(pending.file, removeBg);
      reset();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.msg || "Could not save the signature.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sgp">
      {sig.imageUrl ? (
        <div className="sgp-img-box"><img src={sig.imageUrl} alt="Your saved signature" /></div>
      ) : (
        !sig.loading && (prompt ? <p className="sgp-prompt">{prompt}</p> : <p className="sgp-muted">No signature saved yet.</p>)
      )}

      {pending ? (
        <div className="sgp-pending">
          <strong>Preview of the signature that will be saved</strong>
          <div className="sgp-preview"><img src={pending.previewDataUrl} alt="Processed signature preview" /></div>
          {pending.sourceType === "jpeg" && (
            <label className="sgp-check">
              <input type="checkbox" checked={removeBg} disabled={busy} onChange={(e) => toggleBackground(e.target.checked)} />
              <span>
                Remove the white background
                {removeBg && !pending.backgroundRemoved && " (not applied: the background of this image is not white)"}
              </span>
            </label>
          )}
          <div className="sgp-actions">
            <button type="button" className="sgp-btn sgp-btn--primary" disabled={busy} onClick={confirm}>
              {busy ? "Working…" : "Save signature"}
            </button>
            <button type="button" className="sgp-btn" disabled={busy} onClick={reset}>Cancel</button>
          </div>
        </div>
      ) : drawing ? (
        <DrawPad onDone={(file) => runPreview(file, true)} onCancel={() => setDrawing(false)} />
      ) : (
        <div className="sgp-actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            hidden
            onChange={(e) => e.target.files?.[0] && choose(e.target.files[0])}
          />
          <button type="button" className="sgp-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Working…" : sig.hasSignature ? "Change signature (PNG / JPG)" : "Upload signature (PNG / JPG)"}
          </button>
          <button type="button" className="sgp-btn" disabled={busy} onClick={() => setDrawing(true)}>Draw</button>
        </div>
      )}

      <p className="sgp-muted">
        PNG or JPG, up to 2 MB. A transparent PNG works best. Saved to your profile and used on your prescriptions,
        certificates and visit notes; changing it never alters documents already issued.
      </p>
      {(error || sig.error) && <div className="sgp-error" role="alert">{error || sig.error}</div>}
    </div>
  );
}
