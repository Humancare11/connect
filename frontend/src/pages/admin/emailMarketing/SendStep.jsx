import { estimateText } from "./marketingUtils";

// Step 4: the summary, the required confirmation, and the send button. After it the campaign runs on the server.
export default function SendStep({ from, subject, total, skipped, estimate, confirm, setConfirm, onSend, busy, ready, error }) {
  return (
    <>
      <div className="mk-sum">
        <div><span>From</span><b>{from}</b></div>
        <div><span>Subject</span><b>{subject}</b></div>
        <div><span>Recipients</span><b>{total} people, one email each</b></div>
        <div><span>Skipped</span><b>{skipped.invalid} invalid · {skipped.duplicates} duplicates · {skipped.suppressed} unsubscribed</b></div>
        <div><span>Estimated time</span><b>{estimateText(estimate)}</b></div>
        <div><span>Sent through</span><b>Amazon SES. Normal Gmail mail is not affected.</b></div>
      </div>
      {!ready && (
        <div className="mk-callout warn" role="status">
          <div>Sending is not fully set up on the server yet, so the Send button will be refused. Ask your tech team to finish the Email Marketing setup.</div>
        </div>
      )}
      {error && <div className="mk-callout bad" role="alert"><div>{error}</div></div>}
      <label className="mk-chk">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
        <span>I have checked the preview and the test email. Sent emails cannot be recalled.</span>
      </label>
      <div>
        <button type="button" className="mk-btn mk-btn-p" onClick={onSend} disabled={!confirm || busy || !total}>
          <svg className="mk-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
          {busy ? "Starting…" : `Send to ${total} recipients`}
        </button>
      </div>
    </>
  );
}
