import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trackingSettingsApi, apiMessage } from "../../../api/emailApi";
import { Modal } from "./MiParts";
import "./email.css";

// Open tracking for mail sent from the dashboard (Super Admin only).
// Tracking is active only when ALL THREE are true: the server switch, a public
// https URL, and the switch below. The card shows each one so it is clear why.
export default function TrackingSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tracking-settings"], queryFn: trackingSettingsApi.get, staleTime: 0 });
  const t = q.data?.tracking;
  const optOuts = q.data?.optOuts || [];

  const [error, setError] = useState("");
  const [confirmOn, setConfirmOn] = useState(false);
  // Unsaved edits of the footer notice; null = showing what the server has.
  const [draft, setDraft] = useState(null);
  const disclosureText = draft?.text ?? t?.disclosureText ?? "";
  const disclosureEnabled = draft?.enabled ?? t?.disclosureEnabled ?? true;
  const setDisclosureText = (text) => setDraft({ text, enabled: disclosureEnabled });
  const setDisclosureEnabled = (enabled) => setDraft({ text: disclosureText, enabled });
  const [optAddress, setOptAddress] = useState("");
  const [optNote, setOptNote] = useState("");

  const accept = (data) => {
    qc.setQueryData(["tracking-settings"], data);
    qc.invalidateQueries({ queryKey: ["email", "mailboxes"] });
    setError("");
  };
  const update = useMutation({
    mutationFn: (patch) => trackingSettingsApi.update(patch),
    onSuccess: (data) => {
      accept(data);
      setDraft(null);
      setConfirmOn(false);
    },
    onError: (err) => {
      setError(apiMessage(err));
      setConfirmOn(false);
    },
  });
  const addOptOut = useMutation({
    mutationFn: () => trackingSettingsApi.addOptOut(optAddress.trim(), optNote.trim()),
    onSuccess: (data) => {
      accept(data);
      setOptAddress("");
      setOptNote("");
    },
    onError: (err) => setError(apiMessage(err)),
  });
  const removeOptOut = useMutation({
    mutationFn: (id) => trackingSettingsApi.removeOptOut(id),
    onSuccess: accept,
    onError: (err) => setError(apiMessage(err)),
  });

  const disclosureDirty = t && (disclosureText.trim() !== t.disclosureText || disclosureEnabled !== t.disclosureEnabled);

  return (
    <section className="mi-section" aria-labelledby="mi-trk-h">
      <h2 id="mi-trk-h">Open tracking</h2>
      <p className="em-sub">
        Adds a tiny image to mail sent from the dashboard so you can see whether it was opened. It is not exact: some mail apps block
        images or load them automatically, and it never proves a mail was read.
      </p>

      <div className="mi-card">
        {q.isLoading && <div className="em-empty">Loading…</div>}
        {q.isError && <div className="em-empty em-err">{apiMessage(q.error, "Could not load the tracking settings.")}</div>}
        {t && (
          <div className="mi-body">
            <div className="mi-state">
              <span className={`em-tag ${t.active ? "mi-on" : "mi-off"}`}>{t.active ? "Active" : "Not active"}</span>
              <span className="em-sub">
                {t.active
                  ? "New mail carries the tracking image unless an admin unticks “Track opens”."
                  : "No mail carries the tracking image and nothing is recorded."}
              </span>
            </div>

            <dl className="mi-gates">
              <dt>Server switch</dt>
              <dd>
                <span className={t.envEnabled ? "mi-ok-t" : "mi-bad-t"}>{t.envEnabled ? "On" : "Off"}</span>
                {!t.envEnabled && <span className="em-sub"> — set by the server setting EMAIL_TRACKING_ENABLED (a developer changes it).</span>}
              </dd>
              <dt>Public URL</dt>
              <dd>
                {t.baseUrlOk ? <span className="mi-ok-t mono">{t.baseUrl}</span> : <span className="mi-bad-t">Not set, or not https</span>}
                {!t.baseUrlOk && <span className="em-sub"> — PUBLIC_TRACKING_BASE_URL must be a public https address.</span>}
              </dd>
              <dt>Allow open tracking</dt>
              <dd>
                <label className="mi-check" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={t.switchOn}
                    disabled={update.isPending}
                    onChange={(e) => (e.target.checked ? setConfirmOn(true) : update.mutate({ trackingEnabled: false }))}
                  />
                  {t.switchOn ? "On" : "Off"}
                </label>
              </dd>
            </dl>

            <div className="mi-sep">
              <h3>Notice in the footer</h3>
              <label className="mi-check" style={{ margin: 0 }}>
                <input type="checkbox" checked={disclosureEnabled} onChange={(e) => setDisclosureEnabled(e.target.checked)} />
                Add this line to the footer of every tracked mail
              </label>
              <textarea aria-label="Footer notice" rows={2} maxLength={300} value={disclosureText} disabled={!disclosureEnabled} onChange={(e) => setDisclosureText(e.target.value)} />
              <div className="mi-actions" style={{ justifyContent: "flex-start", marginTop: 0 }}>
                <button
                  type="button"
                  className="em-btn em-btn-primary"
                  disabled={!disclosureDirty || update.isPending}
                  onClick={() => update.mutate({ disclosureEnabled, disclosureText: disclosureText.trim() })}
                >
                  Save notice
                </button>
                <button type="button" className="em-btn em-btn-ghost" disabled={disclosureText === t.defaultDisclosure} onClick={() => setDisclosureText(t.defaultDisclosure)}>
                  Use the suggested wording
                </button>
              </div>
            </div>

            <div className="mi-sep">
              <h3>Never track these recipients</h3>
              <p className="em-sub">
                If any To or Cc address is on this list, that mail is sent without the tracking image. Mail to company addresses and to
                iCloud / me.com / mac.com addresses is never tracked either.
              </p>
              <form
                className="mi-optadd"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (optAddress.trim() && !addOptOut.isPending) addOptOut.mutate();
                }}
                noValidate
              >
                <input type="email" aria-label="Recipient address" placeholder="patient@example.com" value={optAddress} onChange={(e) => setOptAddress(e.target.value)} />
                <input type="text" aria-label="Note (optional)" placeholder="Note (optional)" maxLength={200} value={optNote} onChange={(e) => setOptNote(e.target.value)} />
                <button type="submit" className="em-btn em-btn-ghost" disabled={!optAddress.trim() || addOptOut.isPending}>
                  Add
                </button>
              </form>
              {optOuts.length === 0 ? (
                <div className="em-sub">Nobody is on the list.</div>
              ) : (
                <ul className="mi-optlist">
                  {optOuts.map((o) => (
                    <li key={o.id}>
                      <span className="mi-opt-main">
                        <span>{o.address}</span>
                        {o.note && <small>{o.note}</small>}
                      </span>
                      <button type="button" className="em-btn em-btn-ghost" disabled={removeOptOut.isPending} onClick={() => removeOptOut.mutate(o.id)} aria-label={`Remove ${o.address}`}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <div className="mi-error" role="alert">{error}</div>}
          </div>
        )}
      </div>

      {confirmOn && (
        <Modal title="Turn on open tracking?" onClose={() => (update.isPending ? undefined : setConfirmOn(false))}>
          <div className="mi-form">
            <p>
              Mail sent from the dashboard will carry a tiny tracking image, and a notice line is added to the footer
              {t?.disclosureEnabled ? "" : " (the notice is currently switched off)"}. Please make sure your privacy and compliance review is complete before
              using this with real recipients.
            </p>
            <div className="mi-actions">
              <button type="button" className="em-btn em-btn-ghost" onClick={() => setConfirmOn(false)} disabled={update.isPending}>
                Cancel
              </button>
              <button type="button" className="em-btn em-btn-primary" onClick={() => update.mutate({ trackingEnabled: true })} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Turn on"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
