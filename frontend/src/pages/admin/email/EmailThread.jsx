import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import emailApi, { apiMessage } from "../../../api/emailApi";
import { AttachmentList, Avatar, GmailMark, Icon, MailboxChip, TrackOpensToggle, TrackingNote } from "./EmailParts";
import {
  ACCEPT_ATTR,
  EMAIL_BASE,
  FOLDERS,
  OUTSIDE_LABEL,
  OUTSIDE_NOTE,
  addFiles,
  fmtFull,
  fmtTime,
  newRequestId,
  personLabel,
  roleLabel,
  trackingInfo,
  useEmailShell,
} from "./emailUtils";

function MessageBlock({ m, onDownload, showTracking }) {
  const outbound = m.direction === "out";
  const senderName = m.sentBy?.name || OUTSIDE_LABEL;
  const name = outbound ? `${senderName} (via ${m.mailbox?.displayName || "company ID"})` : personLabel(m.from);
  const addr = outbound ? m.mailbox?.address : m.from.address;
  const to = [...m.to.map((a) => a.address), ...(m.cc.length ? [`cc: ${m.cc.map((a) => a.address).join(", ")}`] : [])].join(", ");

  return (
    <div className="em-msg">
      {outbound ? (
        m.sentBy ? <Avatar name={senderName} colorKey={m.sentBy.id} large /> : <GmailMark large />
      ) : (
        <Avatar name={personLabel(m.from)} external large />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="em-msg-top">
          <div>
            <b>{name}</b> <span className="em-addr">&lt;{addr}&gt;</span>
            <span className="em-to">to {to}</span>
          </div>
          <span className="em-time">{fmtFull(m.messageDate)}</span>
        </div>
        <div className="em-msg-body">{m.text || "(no text)"}</div>
        <AttachmentList items={m.attachments.filter((a) => !a.isInline)} onOpen={onDownload} />
        {outbound && showTracking && <TrackingNote tracking={m.tracking} />}
      </div>
    </div>
  );
}

function InfoBox({ icon, label, children }) {
  return (
    <div className="em-ibox">
      <span className="em-ibox-ic">{icon}</span>
      <div className="em-ibox-main">
        <div className="em-ibox-k">{label}</div>
        {children}
      </div>
    </div>
  );
}

// Three small boxes under the subject: who sent / replied, open tracking, who viewed.
function InfoBoxes({ m, views, adminId }) {
  const outbound = m.direction === "out";
  const info = trackingInfo(m.tracking);
  const first = views[0];
  // The sender opening their own mail is never recorded, so "Nobody yet" would read wrongly to them.
  const ownSentMail = outbound && m.sentBy && adminId && String(m.sentBy.id) === String(adminId);

  return (
    <div className="em-info">
      {outbound && (
        <InfoBox icon={m.sentBy ? <Avatar name={m.sentBy.name} colorKey={m.sentBy.id} /> : <GmailMark />} label="Sent by">
          {m.sentBy ? <b>{m.sentBy.name}</b> : <b>Gmail website</b>}
          <small>
            {m.sentBy ? [roleLabel(m.sentBy.role), fmtFull(m.messageDate)].filter(Boolean).join(" · ") : `${OUTSIDE_NOTE} · ${fmtFull(m.messageDate)}`}
          </small>
        </InfoBox>
      )}

      {!outbound && m.repliedAt && (
        <InfoBox icon={<Avatar name={m.repliedByName} />} label="Replied">
          <b>{m.repliedByName || "Someone"}</b> replied
          <small>{fmtFull(m.repliedAt)}</small>
        </InfoBox>
      )}

      {outbound && info && (
        <InfoBox icon={<Icon name="open" size={20} />} label="Open tracking">
          <b className={info.kind === "opened" ? "em-ok" : undefined}>{info.text}</b>
          <small>{info.detail}</small>
        </InfoBox>
      )}

      <InfoBox icon={<Icon name="eye" size={20} />} label="Viewed by">
        {first ? (
          <>
            <b>{first.admin.name}</b> first
            <ol className="em-views">
              {views.map((v) => (
                <li key={v.admin.id} title={v.count > 1 ? `Opened ${v.count} times, last ${fmtFull(v.lastAt)}` : undefined}>
                  <Avatar name={v.admin.name} colorKey={v.admin.id} />
                  <span>{v.admin.name.split(/\s+/)[0]}</span>
                  <span className="em-n">
                    {fmtTime(v.firstAt)}
                    {v.count > 1 ? ` · ×${v.count}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <small>{ownSentMail ? "Not opened by another admin" : "Nobody yet"}</small>
        )}
      </InfoBox>
    </div>
  );
}

function ReplyBox({ message, reply, adminName, tracking, onSent, onCancel }) {
  const [body, setBody] = useState("");
  const [trackChoice, setTrackChoice] = useState(null);
  const trackOpens = trackChoice ?? message.mailbox?.trackOpensDefault !== false;
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(null);
  // One idempotency key per reply form: retries and double-clicks can never send twice.
  const requestId = useRef(newRequestId());
  const mailbox = message.mailbox;

  const send = useMutation({
    mutationFn: ({ confirm }) => {
      const fd = new FormData();
      fd.append("body", body.trim());
      fd.append("clientRequestId", requestId.current);
      if (confirm) fd.append("confirm", "1");
      if (tracking?.available) fd.append("trackOpens", trackOpens ? "1" : "0");
      files.forEach((f) => fd.append("files", f));
      return emailApi.reply(message.id, fd);
    },
    onSuccess: () => onSent(),
    onError: (err) => {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.code === "ALREADY_REPLIED") {
        setError("");
        setConflict(data);
      } else {
        setConflict(null);
        setError(apiMessage(err));
      }
    },
  });

  const submit = (e, confirm = false) => {
    e?.preventDefault();
    if (send.isPending) return;
    if (!body.trim()) {
      setError("The reply is empty.");
      return;
    }
    setError("");
    send.mutate({ confirm });
  };

  const onFiles = (e) => {
    const result = addFiles(files, Array.from(e.target.files));
    setFiles(result.files);
    setError(result.error);
    e.target.value = "";
  };

  return (
    <form className="em-replybox" onSubmit={submit} noValidate>
      <div className="em-rb-head">
        <Icon name="reply" />
        <span>
          Reply to <b className="mono">{reply.to.address}</b> from
        </span>
        <MailboxChip mailbox={mailbox} full />
        <span>
          · as <b>{adminName}</b>
        </span>
      </div>
      <textarea aria-label="Reply message" placeholder="Write your reply…" value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
      {conflict && (
        <div className="em-banner warn" role="alert">
          <span>
            <b>{conflict.repliedByName || "Someone"}</b> already replied to this mail
            {conflict.repliedAt ? ` (${fmtFull(conflict.repliedAt)})` : ""}. Send your reply anyway?
          </span>
          <span className="em-banner-actions">
            <button type="button" className="em-btn em-btn-primary" disabled={send.isPending} onClick={() => submit(null, true)}>
              Send anyway
            </button>
            <button type="button" className="em-btn em-btn-ghost" onClick={() => setConflict(null)}>
              Cancel
            </button>
          </span>
        </div>
      )}
      <div className="em-rb-foot">
        <AttachmentList items={files} onRemove={(i) => setFiles(files.filter((_, idx) => idx !== i))} />
        <button type="submit" className="em-btn em-btn-primary" disabled={send.isPending}>
          {send.isPending ? "Sending…" : "Send"}
        </button>
        <label className="em-attach-lbl" title="Attach files">
          <input type="file" multiple accept={ACCEPT_ATTR} onChange={onFiles} aria-label="Attach files to reply" />
          <Icon name="clip" />
        </label>
        {tracking?.available && <TrackOpensToggle checked={trackOpens} onChange={setTrackChoice} disclosure={tracking.disclosure} />}
        {error && <span className="em-errtext" role="alert">{error}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="em-btn em-btn-ghost" onClick={onCancel}>
          Discard
        </button>
      </div>
    </form>
  );
}

export default function EmailThread() {
  const { messageId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { admin, mailboxes, showToast, refreshCounts, tracking } = useEmailShell();
  const [replyOpen, setReplyOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const backTo = location.state?.from || `${EMAIL_BASE}/inbox`;
  const folderId = (backTo.match(/\/(inbox|sent|spam|all)(?:\?|$)/) || [])[1];

  const messageQ = useQuery({
    queryKey: ["email", "message", messageId],
    queryFn: () => emailApi.get(messageId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Record this open exactly once per mail page, then refresh what it affects
  // (viewer list, "first viewed by" in lists, unread counts).
  const viewedFor = useRef(null);
  useEffect(() => {
    if (viewedFor.current === messageId) return;
    viewedFor.current = messageId;
    emailApi
      .recordView(messageId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["email", "message", messageId] });
        qc.invalidateQueries({ queryKey: ["email", "list"] });
        qc.invalidateQueries({ queryKey: ["email", "mailboxes"] });
      })
      .catch(() => {});
  }, [messageId, qc]);

  const spamMutation = useMutation({
    mutationFn: (toSpam) => (toSpam ? emailApi.markSpam(messageId) : emailApi.notSpam(messageId)),
    onSuccess: (_res, toSpam) => {
      qc.invalidateQueries({ queryKey: ["email"] });
      if (toSpam) {
        showToast("Mail moved to Spam");
        navigate(backTo);
      } else {
        showToast("Mail moved to Received");
      }
    },
    onError: (err) => setActionError(apiMessage(err)),
  });

  const download = async (attachment) => {
    setActionError("");
    try {
      await emailApi.downloadAttachment(attachment);
    } catch (err) {
      const blob = err.response?.data;
      let msg = "Could not download the file.";
      if (blob instanceof Blob) {
        try {
          msg = JSON.parse(await blob.text()).msg || msg;
        } catch {
          /* keep the generic message */
        }
      }
      setActionError(msg);
    }
  };

  if (messageQ.isLoading) return <div className="em-empty">Loading…</div>;
  if (messageQ.isError) {
    return (
      <>
        <div className="em-toolbar">
          <button className="em-icon-btn" onClick={() => navigate(backTo)} aria-label="Back to list" title="Back">
            <Icon name="back" />
          </button>
        </div>
        <div className="em-empty em-err">{apiMessage(messageQ.error, "This mail could not be loaded.")}</div>
      </>
    );
  }

  const { message: m, thread, views, reply } = messageQ.data;
  const outbound = m.direction === "out";
  const folderLabel = FOLDERS.find((f) => f.id === folderId)?.label || "Mail";
  const mbParam = new URLSearchParams(location.search).get("mb");
  const mailboxLabel = mbParam === "all" ? "All mail IDs" : mailboxes.find((x) => x.id === mbParam)?.displayName || m.mailbox?.displayName || "";

  const afterReply = () => {
    setReplyOpen(false);
    showToast(`Reply sent from ${m.mailbox.address} · by ${admin.name}`);
    qc.invalidateQueries({ queryKey: ["email"] });
    refreshCounts();
  };

  return (
    <>
      <div className="em-toolbar">
        <button className="em-icon-btn" onClick={() => navigate(backTo)} aria-label="Back to list" title="Back">
          <Icon name="back" />
        </button>
        <span className="em-sub">
          {folderLabel}
          {mailboxLabel ? ` · ${mailboxLabel}` : ""}
        </span>
      </div>

      <div className="em-reader">
        <div className="em-read-head">
          <h2>{m.subject || "(no subject)"}</h2>
          <div className="em-chips">
            <span className="em-sub">{outbound ? "Sent from" : "Received on"}</span>
            <MailboxChip mailbox={m.mailbox} full />
            {m.isSpam && <span className="em-tag em-tag-spam">Spam</span>}
          </div>
        </div>

        {m.isSpam && (
          <div className="em-banner spam">
            <span>
              Gmail marked this mail as <b>spam</b>. Do not open links. Attachments cannot be downloaded until you mark it as not spam.
            </span>
          </div>
        )}

        {outbound && m.status === "failed" && (
          <div className="em-banner spam">
            <span>
              This mail was not delivered{m.failureReason ? `: ${m.failureReason}` : "."}
            </span>
          </div>
        )}

        <InfoBoxes m={m} views={views} adminId={admin?._id ?? admin?.id} />

        {actionError && <div className="em-banner spam" role="alert"><span>{actionError}</span></div>}

        {thread.map((t) => (
          <MessageBlock key={t.id} m={t} onDownload={download} showTracking={t.id !== m.id} />
        ))}

        {reply.allowed && replyOpen ? (
          <ReplyBox message={m} reply={reply} adminName={admin.name} tracking={tracking} onSent={afterReply} onCancel={() => setReplyOpen(false)} />
        ) : (
          <div className="em-reply-actions">
            {reply.allowed && (
              <button className="em-btn em-btn-ghost" onClick={() => setReplyOpen(true)}>
                <Icon name="reply" size={18} />
                Reply
              </button>
            )}
            {!outbound && (
              <button className="em-btn em-btn-ghost" disabled={spamMutation.isPending} onClick={() => spamMutation.mutate(!m.isSpam)}>
                {m.isSpam ? "Not spam" : "Mark as spam"}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
