import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import emailApi, { apiMessage } from "../../../api/emailApi";
import EmailFilters from "./EmailFilters";
import { Avatar, FirstViewed, Icon, MailboxChip, TrackingBadge } from "./EmailParts";
import {
  EMAIL_BASE,
  FOLDERS,
  FOLDER_IDS,
  OUTSIDE_LABEL,
  POLL_MS,
  dateFromPreset,
  firstName,
  fmtTime,
  folderPath,
  messagePath,
  personLabel,
  useEmailShell,
} from "./emailUtils";

const PAGE_SIZE = 50;
const FILTER_KEYS = ["by", "box", "st", "open", "view", "date", "att"];

const SUBTITLES = {
  inbox: "Mail that came to the company IDs",
  sent: "Every mail shows which admin sent it",
  spam: "Mail Gmail marked as spam",
  all: "Received and sent, in one place",
};

function Row({ m, onOpen }) {
  const open = () => onOpen(m.id);
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const clip = m.hasAttachments && (
    <span className="em-clip" title={`${m.attachmentCount} attachment${m.attachmentCount === 1 ? "" : "s"}`}>
      <Icon name="clip" size={16} />
    </span>
  );

  if (m.direction === "in") {
    return (
      <div className={`em-row ${m.unread ? "unread" : "read"}`} role="button" tabIndex={0} onClick={open} onKeyDown={onKey}>
        <div className="em-who">
          <Avatar name={personLabel(m.from)} external />
          <span className="em-nm">{personLabel(m.from)}</span>
        </div>
        <div className="em-box-col">
          <MailboxChip mailbox={m.mailbox} />
        </div>
        <div className="em-line">
          {m.isSpam && <span className="em-tag em-tag-spam">Spam</span>}
          {m.repliedAt && <span className="em-tag em-tag-replied">{firstName(m.repliedByName)} replied</span>}
          <span className="em-subj">{m.subject || "(no subject)"}</span>
          {m.snippet && <span className="em-snip">— {m.snippet}</span>}
          {clip}
        </div>
        <div className="em-view-col">{!m.isSpam && <FirstViewed firstViewed={m.firstViewed} />}</div>
        <div className="em-time">{fmtTime(m.messageDate)}</div>
      </div>
    );
  }

  const senderName = m.sentBy?.name || OUTSIDE_LABEL;
  return (
    <div className="em-row read" role="button" tabIndex={0} onClick={open} onKeyDown={onKey}>
      <div className="em-who">
        <Avatar name={senderName} colorKey={m.sentBy?.id} external={!m.sentBy} />
        <span className="em-nm">{senderName}</span>
      </div>
      <div className="em-box-col">
        <MailboxChip mailbox={m.mailbox} />
      </div>
      <div className="em-line em-line-stack">
        <div className="em-line-main">
          {m.status === "failed" && <span className="em-tag em-tag-failed">Failed</span>}
          {m.status === "sending" && <span className="em-tag em-tag-by">Sending…</span>}
          <span className="em-tag em-tag-by">To: {m.to.map((a) => a.address).join(", ")}</span>
          <span className="em-subj">{m.subject || "(no subject)"}</span>
          {m.snippet && <span className="em-snip">— {m.snippet}</span>}
          {clip}
        </div>
        {m.tracking && (
          <div>
            <TrackingBadge tracking={m.tracking} />
          </div>
        )}
      </div>
      <div className="em-view-col">
        <FirstViewed firstViewed={m.firstViewed} />
      </div>
      <div className="em-time">{fmtTime(m.messageDate)}</div>
    </div>
  );
}

export default function EmailList() {
  const { folder: folderParam, mailboxId } = useParams();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { mailboxes, refreshCounts, clearSearchText } = useEmailShell();

  const folder = folderParam;
  const valid = FOLDER_IDS.includes(folder);

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || ""]));
  const q = sp.get("q") || "";
  const page = Math.max(1, parseInt(sp.get("page"), 10) || 1);

  const adminsQ = useQuery({ queryKey: ["email", "admins"], queryFn: emailApi.admins, staleTime: 5 * 60_000, enabled: valid });
  const listQ = useQuery({
    queryKey: ["email", "list", { folder, mailboxId: mailboxId || "", ...filters, q, page }],
    queryFn: () =>
      emailApi.list({
        folder,
        mailbox: mailboxId || filters.box || undefined,
        sentBy: filters.by || undefined,
        status: filters.st || undefined,
        // Sent only; the server ignores it elsewhere.
        openStatus: folder === "sent" ? filters.open || undefined : undefined,
        viewedBy: filters.view || undefined,
        dateFrom: dateFromPreset(filters.date),
        hasAttachment: filters.att || undefined,
        q: q || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    // Keep the old rows while paging/filtering inside the same folder, but never
    // show another folder's mail (e.g. Spam under Received) while a new one loads.
    placeholderData: (previous, previousQuery) => {
      const prev = previousQuery?.queryKey?.[2];
      return prev && prev.folder === folder && prev.mailboxId === (mailboxId || "") ? previous : undefined;
    },
    refetchInterval: POLL_MS,
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: valid,
  });

  if (!valid) return <Navigate to={`${EMAIL_BASE}/inbox`} replace />;

  const mailbox = mailboxId ? mailboxes.find((m) => m.id === mailboxId) : null;
  const folderMeta = FOLDERS.find((f) => f.id === folder);
  const title = mailbox ? mailbox.address : folderMeta.label;
  const data = listQ.data;
  const items = data?.items || [];

  const update = (changes) => {
    // Start from the live URL (not this render's snapshot), so two quick changes
    // in a row both stick instead of the second overwriting the first.
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setSp(next, { replace: true });
  };
  const clearFilters = () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
  const openMail = (id) => navigate(messagePath(id), { state: { from: location.pathname + location.search } });
  const showFilters = folder === "inbox" || folder === "sent";
  const from = items.length ? (page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <>
      <div className="em-toolbar">
        <div>
          <h1 className={mailbox ? "mono" : ""} style={mailbox ? { fontSize: 15 } : undefined}>
            {title}
          </h1>
          <div className="em-sub">{mailbox ? `${folderMeta.label} · mail to and from this ID` : SUBTITLES[folder]}</div>
        </div>
        <div className="em-spacer" />
        {mailbox && (
          <div className="em-tabs" role="tablist">
            {FOLDERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={folder === f.id}
                className={`em-tab${folder === f.id ? " on" : ""}`}
                onClick={() => navigate(folderPath(f.id, mailboxId))}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <span className="em-sub">{data ? `${data.total} mail` : ""}</span>
        <button
          type="button"
          className="em-icon-btn"
          title="Refresh"
          aria-label="Refresh"
          onClick={() => {
            listQ.refetch();
            refreshCounts();
          }}
        >
          <Icon name="refresh" />
        </button>
      </div>

      {showFilters && (
        <EmailFilters
          folder={folder}
          inMailboxView={Boolean(mailboxId)}
          filters={filters}
          mailboxes={mailboxes}
          admins={adminsQ.data?.admins || []}
          onChange={(key, value) => update({ [key]: value })}
          onClear={clearFilters}
        />
      )}

      {q && (
        <div className="em-searchnote">
          Results for <b>“{q}”</b> — subject, sender, recipient and “sent by”.
          <button
            type="button"
            className="em-fclear"
            onClick={() => {
              clearSearchText();
              update({ q: "" });
            }}
          >
            Clear search
          </button>
        </div>
      )}

      <div className="em-list" aria-busy={listQ.isFetching}>
        {listQ.isError && <div className="em-empty em-err">{apiMessage(listQ.error, "Could not load mail.")}</div>}
        {listQ.isLoading && <div className="em-empty">Loading…</div>}
        {!listQ.isLoading && !listQ.isError && items.length === 0 && <div className="em-empty">There is no mail here.</div>}
        {items.map((m) => (
          <Row key={m.id} m={m} onOpen={openMail} />
        ))}
      </div>

      {data && (data.hasMore || page > 1) && (
        <div className="em-pager">
          <span className="em-sub">
            {from}–{from + items.length - 1} of {data.total}
          </span>
          <button type="button" className="em-btn em-btn-ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
            Newer
          </button>
          <button type="button" className="em-btn em-btn-ghost" disabled={!data.hasMore} onClick={() => update({ page: String(page + 1) })}>
            Older
          </button>
        </div>
      )}
    </>
  );
}
