import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import emailApi, { apiMessage } from "../../../api/emailApi";
import EmailFilters from "./EmailFilters";
import { Avatar, FirstViewed, GmailMark, Icon, TrackingBadge } from "./EmailParts";
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
  recipientsLabel,
  useEmailShell,
} from "./emailUtils";

const PAGE_SIZE = 50;
const FILTER_KEYS = ["by", "box", "st", "open", "view", "date", "att"];

const FROM_HEADER = { inbox: "From", spam: "From", sent: "Sent by", all: "From / Sent by" };

// Paperclip (if any attachment) and, only while "All" is selected, the mail ID tag.
function MetaCol({ m, showMailbox }) {
  return (
    <div className="em-mc">
      {showMailbox && m.mailbox && (
        <span className="em-mtag" title={m.mailbox.address}>
          <span className="em-dot" style={{ background: m.mailbox.color }} />
          {m.mailbox.displayName}
        </span>
      )}
      {m.hasAttachments && (
        <span title={`${m.attachmentCount} attachment${m.attachmentCount === 1 ? "" : "s"}`}>
          <Icon name="clip" size={15} />
        </span>
      )}
    </div>
  );
}

function Row({ m, onOpen, showMailbox }) {
  const open = () => onOpen(m.id);
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  if (m.direction === "in") {
    const unread = m.unread && !m.isSpam;
    return (
      <div className={`em-row ${unread ? "unread" : "read"}`} role="button" tabIndex={0} onClick={open} onKeyDown={onKey}>
        <div className="em-who">
          <Avatar name={personLabel(m.from)} external />
          <span className="em-nm">{personLabel(m.from)}</span>
        </div>
        <div className="em-line">
          {m.isSpam && <span className="em-tag em-tag-spam">Spam</span>}
          {m.repliedAt && <span className="em-tag em-tag-replied">{firstName(m.repliedByName)} replied</span>}
          <span className="em-subj">{m.subject || "(no subject)"}</span>
          {m.snippet && <span className="em-snip">— {m.snippet}</span>}
        </div>
        <MetaCol m={m} showMailbox={showMailbox} />
        <div className="em-stc">{!m.isSpam && <FirstViewed firstViewed={m.firstViewed} />}</div>
        <div className="em-time">{fmtTime(m.messageDate)}</div>
      </div>
    );
  }

  return (
    <div className="em-row read" role="button" tabIndex={0} onClick={open} onKeyDown={onKey}>
      <div className="em-who">
        {m.sentBy ? (
          <>
            <Avatar name={m.sentBy.name} colorKey={m.sentBy.id} />
            <span className="em-nm">{m.sentBy.name}</span>
          </>
        ) : (
          <>
            <GmailMark />
            <span className="em-nm em-nm-ext">{OUTSIDE_LABEL}</span>
          </>
        )}
      </div>
      <div className="em-line">
        {m.status === "failed" && <span className="em-tag em-tag-failed">Failed</span>}
        {m.status === "sending" && <span className="em-tag em-tag-by">Sending…</span>}
        {m.to.length > 0 && <span className="em-to">To: {recipientsLabel(m.to)}</span>}
        <span className="em-subj">{m.subject || "(no subject)"}</span>
        {m.snippet && <span className="em-snip">— {m.snippet}</span>}
      </div>
      <MetaCol m={m} showMailbox={showMailbox} />
      <div className="em-stc">
        <TrackingBadge tracking={m.tracking} />
        <FirstViewed firstViewed={m.firstViewed} />
      </div>
      <div className="em-time">{fmtTime(m.messageDate)}</div>
    </div>
  );
}

export default function EmailList() {
  const { folder: folderParam, mailboxId: legacyMailboxId } = useParams();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { mailboxes, mailboxesReady, selectedMailboxId, mbValue, refreshCounts, clearSearchText } = useEmailShell();

  const folder = folderParam;
  const valid = FOLDER_IDS.includes(folder);
  const allMailIds = mailboxesReady && !selectedMailboxId;

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || ""]));
  const q = sp.get("q") || "";
  const page = Math.max(1, parseInt(sp.get("page"), 10) || 1);
  // Mail ID filter only exists while "All" is selected.
  const boxFilter = allMailIds ? filters.box : "";

  const adminsQ = useQuery({ queryKey: ["email", "admins"], queryFn: emailApi.admins, staleTime: 5 * 60_000, enabled: valid });
  const listQ = useQuery({
    queryKey: ["email", "list", { folder, mailboxId: selectedMailboxId, ...filters, box: boxFilter, q, page }],
    queryFn: () =>
      emailApi.list({
        folder,
        mailbox: selectedMailboxId || boxFilter || undefined,
        sentBy: folder === "sent" ? filters.by || undefined : undefined,
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
    // show another folder's (or Mail ID's) mail while a new one loads.
    placeholderData: (previous, previousQuery) => {
      const prev = previousQuery?.queryKey?.[2];
      return prev && prev.folder === folder && prev.mailboxId === selectedMailboxId ? previous : undefined;
    },
    refetchInterval: POLL_MS,
    staleTime: 0,
    refetchOnWindowFocus: true,
    // Wait for the mail IDs: the default selection (Support) is only known then.
    enabled: valid && mailboxesReady,
  });

  // Older /box/<id>/<folder> links become /<folder>?mb=<id>.
  if (legacyMailboxId) return <Navigate to={folderPath(folder, legacyMailboxId)} replace />;
  if (!valid) return <Navigate to={`${EMAIL_BASE}/inbox`} replace />;

  const mailbox = mailboxes.find((m) => m.id === selectedMailboxId) || null;
  const folderMeta = FOLDERS.find((f) => f.id === folder);
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
  const openMail = (id) => navigate(messagePath(id, sp.get("mb")), { state: { from: location.pathname + location.search } });
  const showFilters = folder === "inbox" || folder === "sent";
  const from = items.length ? (page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <>
      <div className="em-lhead">
        <h1>{folderMeta.label}</h1>
        <span className="em-sub">
          {mailbox ? mailbox.address : mbValue === "all" ? "All mail IDs" : ""}
          {data ? ` · ${data.total} mail` : ""}
        </span>
        <div className="em-spacer" />
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
          key={`${folder}-${selectedMailboxId}`}
          folder={folder}
          allMailIds={allMailIds}
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

      <div className={`em-list${allMailIds ? " all" : ""}`} aria-busy={listQ.isFetching}>
        {listQ.isError && <div className="em-empty em-err">{apiMessage(listQ.error, "Could not load mail.")}</div>}
        {(listQ.isLoading || !mailboxesReady) && <div className="em-empty">Loading…</div>}
        {mailboxesReady && !listQ.isLoading && !listQ.isError && items.length === 0 && <div className="em-empty">There is no mail here.</div>}
        {items.length > 0 && (
          <div className="em-rhead" aria-hidden="true">
            <span>{FROM_HEADER[folder]}</span>
            <span>Subject</span>
            <span />
            <span>Status</span>
            <span className="r">Time</span>
          </div>
        )}
        {items.map((m) => (
          <Row key={m.id} m={m} onOpen={openMail} showMailbox={allMailIds} />
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
