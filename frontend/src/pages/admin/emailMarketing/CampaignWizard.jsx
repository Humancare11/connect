import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingApi } from "../../../api/emailMarketingApi";
import RecipientsStep from "./RecipientsStep";
import ContentStep from "./ContentStep";
import PreviewStep from "./PreviewStep";
import SendStep from "./SendStep";
import { MK_BASE, errorMessage, isEmail } from "./marketingUtils";

const STEPS = ["Recipients", "Content", "Preview & test", "Send"];

// The campaign builder: Recipients, Content, Preview & test, Send. The draft is saved on the server each time
// the admin moves forward, so a draft can be reopened from the campaigns list. `initial` is the saved draft
// (or null for a new campaign).
export default function CampaignWizard({ initial }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mailboxesQ = useQuery({ queryKey: ["marketing", "mailboxes"], queryFn: marketingApi.mailboxes });
  const mailboxes = useMemo(() => mailboxesQ.data?.mailboxes || [], [mailboxesQ.data]);

  const [campaignId, setCampaignId] = useState(initial?.id || null);
  const [saved, setSaved] = useState(initial);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [name, setName] = useState(initial?.name || "");
  const [chosenMailbox, setChosenMailbox] = useState(initial?.mailboxId || "");
  // Until the admin picks one, the first Mail ID allowed for marketing is the From.
  const mailboxId = chosenMailbox || mailboxes[0]?.id || "";
  const [mode, setMode] = useState("lines");
  const [raw, setRaw] = useState({ emails: "", lines: initial?.recipientsText || "", csv: "" });
  const [csvName, setCsvName] = useState("");
  const [parse, setParse] = useState(null);
  const [parseError, setParseError] = useState("");
  // Step 2
  const [subject, setSubject] = useState(initial?.subject || "");
  const [html, setHtml] = useState(initial?.html || "");
  const [cmode, setCmode] = useState("paste");
  const [htmlName, setHtmlName] = useState("");
  const [fallbackName, setFallbackName] = useState(initial?.fallbackName || "there");
  const [fallbackCompany, setFallbackCompany] = useState(initial?.fallbackCompany || "");
  // Step 3
  const [pv, setPv] = useState(null);
  const [pvError, setPvError] = useState("");
  const [pvIdx, setPvIdx] = useState(0);
  const [device, setDevice] = useState("desktop");
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  // Step 4
  const [confirm, setConfirm] = useState(false);

  // Live counts for the recipients box: the server applies the same rules as when the list is saved.
  const text = raw[mode];
  useEffect(() => {
    if (!text.trim()) return undefined;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const result = await marketingApi.previewRecipients({ mode, text });
        if (live) {
          setParse(result);
          setParseError("");
        }
      } catch (err) {
        if (live) {
          setParse(null);
          setParseError(errorMessage(err, "Could not read the recipients."));
        }
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [mode, text]);

  // Nothing typed means nothing to count, whatever the last answer was.
  const shownParse = text.trim() ? parse : null;
  const shownParseError = text.trim() ? parseError : "";

  const canGo = (n) => {
    if (n >= 2 && !(shownParse?.willReceive > 0 && name.trim() && mailboxId)) return false;
    if (n >= 3 && !(subject.trim() && html.trim())) return false;
    return true;
  };

  // Saves what the earlier steps hold. The draft is created on the first save.
  async function persist(upTo) {
    let id = campaignId;
    let view = saved;
    if (!id) {
      const created = await marketingApi.create({ name: name.trim(), mailboxId });
      id = created.campaign.id;
      view = created.campaign;
      setCampaignId(id);
    }
    if (upTo >= 2) view = (await marketingApi.save(id, { name: name.trim(), mailboxId, recipients: { mode, text: raw[mode] } })).campaign;
    if (upTo >= 3) view = (await marketingApi.save(id, { subject, html, fallbackName, fallbackCompany })).campaign;
    setSaved(view);
    qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
    return { id, view };
  }

  async function goTo(n) {
    if (n === step || busy) return;
    setError("");
    if (n < step) return setStep(n);
    if (!canGo(n)) return;
    setBusy(true);
    try {
      await persist(n);
      setPvIdx(0);
      setStep(n);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Step 3: the preview of the person being looked at.
  useEffect(() => {
    if (step !== 3 || !campaignId) return undefined;
    let live = true;
    marketingApi
      .previewMail(campaignId, pvIdx)
      .then((r) => live && (setPv(r), setPvError("")))
      .catch((err) => live && setPvError(errorMessage(err, "Could not load the preview.")));
    return () => {
      live = false;
    };
  }, [step, campaignId, pvIdx]);
  const pvLoading = step === 3 && !pvError && (!pv || pv.index !== pvIdx);

  async function sendTest() {
    if (!isEmail(testTo)) return setTestMsg("Enter a valid email address first.");
    setTestBusy(true);
    setTestMsg("");
    try {
      await marketingApi.sendTest(campaignId, testTo.trim());
      setTestMsg(`Test email sent to ${testTo.trim()}.`);
    } catch (err) {
      setTestMsg(errorMessage(err, "The test email could not be sent."));
    } finally {
      setTestBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      const { id } = await persist(3);
      await marketingApi.send(id);
      qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
      navigate(`${MK_BASE}/campaign/${id}`);
    } catch (err) {
      const missing = err?.response?.data?.missing;
      setError(missing?.length ? `${errorMessage(err)} Missing: ${missing.join(", ")}.` : errorMessage(err));
      setBusy(false);
    }
  }

  async function discard() {
    if (!campaignId || !window.confirm("Delete this draft? This cannot be undone.")) return;
    try {
      await marketingApi.remove(campaignId);
      qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
      navigate(MK_BASE);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const mailbox = mailboxes.find((m) => m.id === mailboxId);
  const fromText = mailbox ? mailbox.address : saved?.fromAddress || "";
  const nextOk = step < 4 && canGo(step + 1);
  const topRef = useRef(null);
  useEffect(() => {
    topRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [step]);

  return (
    <section className="mk-card" ref={topRef}>
      <div className="mk-chead">
        <div>
          <h2>{initial ? "Edit draft" : "New campaign"}</h2>
          <p>{name.trim() || "Untitled campaign"}{fromText ? ` · from ${fromText}` : ""}</p>
        </div>
      </div>
      <div className="mk-steps" role="tablist" aria-label="Campaign steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <button key={label} type="button" role="tab" aria-selected={step === n} className={`mk-step${step === n ? " on" : ""}${step > n ? " done" : ""}`} disabled={(n > step && !canGo(n)) || busy} onClick={() => goTo(n)}>
              <i>{step > n ? "✓" : n}</i>{label}
            </button>
          );
        })}
      </div>

      <div className="mk-body">
        {error && <div className="mk-callout bad" role="alert"><div>{error}</div></div>}
        {step === 1 && (
          <RecipientsStep
            mailboxes={mailboxes} mailboxId={mailboxId} setMailboxId={setChosenMailbox} name={name} setName={setName}
            mode={mode} setMode={setMode} raw={raw} setRaw={setRaw} csvName={csvName} setCsvName={setCsvName}
            parse={shownParse} parseError={shownParseError} fallbackName={fallbackName} onFileError={setError}
          />
        )}
        {step === 2 && (
          <ContentStep
            subject={subject} setSubject={setSubject} html={html} setHtml={setHtml} cmode={cmode} setCmode={setCmode}
            htmlName={htmlName} setHtmlName={setHtmlName} fallbackName={fallbackName} setFallbackName={setFallbackName}
            fallbackCompany={fallbackCompany} setFallbackCompany={setFallbackCompany} onFileError={setError}
          />
        )}
        {step === 3 && (
          <PreviewStep
            pv={pv} loading={pvLoading} error={pvError} pvIdx={pvIdx} setPvIdx={setPvIdx} device={device} setDevice={setDevice}
            from={mailbox ? `${mailbox.displayName} <${mailbox.address}>` : fromText} testTo={testTo} setTestTo={setTestTo}
            onTest={sendTest} testBusy={testBusy} testMsg={testMsg}
          />
        )}
        {step === 4 && (
          <SendStep
            from={fromText} subject={subject} total={saved?.recipientCount ?? shownParse?.willReceive ?? 0}
            skipped={{ invalid: saved?.invalidCount ?? 0, duplicates: saved?.duplicatesCount ?? 0, suppressed: saved?.suppressedCount ?? 0 }}
            estimate={saved?.estimate} confirm={confirm} setConfirm={setConfirm} onSend={send} busy={busy}
            ready={saved?.sendReady !== false} error=""
          />
        )}
      </div>

      <div className="mk-foot">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {step > 1 ? (
            <button type="button" className="mk-btn mk-btn-g" onClick={() => goTo(step - 1)} disabled={busy}>Back</button>
          ) : (
            <button type="button" className="mk-btn mk-btn-g" onClick={() => navigate(MK_BASE)} disabled={busy}>Cancel</button>
          )}
          {campaignId && <button type="button" className="mk-btn mk-btn-d" onClick={discard} disabled={busy}>Delete draft</button>}
        </div>
        {step < 4 && (
          <button type="button" className="mk-btn mk-btn-p" onClick={() => goTo(step + 1)} disabled={!nextOk || busy}>
            {busy ? "Saving…" : `Next: ${STEPS[step]}`}
          </button>
        )}
      </div>
    </section>
  );
}
