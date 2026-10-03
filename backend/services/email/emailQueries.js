const mongoose = require("mongoose");

// Query-string → validated params → MongoDB filter for the mail lists.
// Everything arrives as an untrusted string; nothing is passed to Mongo raw.

const FOLDERS = ["inbox", "sent", "spam", "all"];
const STATUS_FILTERS = ["noreply", "replied", "failed"];
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;

class EmailQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailQueryError";
    this.status = 400;
  }
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A query value must be a plain string (guards against ?q[$ne]=x style input).
function str(query, key) {
  const v = query[key];
  if (v === undefined || v === "") return "";
  if (typeof v !== "string") throw new EmailQueryError(`Invalid "${key}".`);
  return v.trim();
}

function objectId(query, key) {
  const v = str(query, key);
  if (!v) return null;
  if (!mongoose.isValidObjectId(v)) throw new EmailQueryError(`Invalid "${key}".`);
  return new mongoose.Types.ObjectId(v);
}

function parseListQuery(query = {}) {
  const folder = str(query, "folder") || "inbox";
  if (!FOLDERS.includes(folder)) throw new EmailQueryError("Invalid folder.");

  const status = str(query, "status");
  if (status && !STATUS_FILTERS.includes(status)) throw new EmailQueryError("Invalid status filter.");

  // "none" = not viewed by anyone; otherwise an admin id.
  const viewedByRaw = str(query, "viewedBy");
  if (viewedByRaw && viewedByRaw !== "none" && !mongoose.isValidObjectId(viewedByRaw)) {
    throw new EmailQueryError('Invalid "viewedBy".');
  }

  // The browser computes today / last 7 days / this month in the admin's own
  // timezone and sends the start as an ISO date, so the server never guesses.
  const dateFromRaw = str(query, "dateFrom");
  let dateFrom = null;
  if (dateFromRaw) {
    dateFrom = new Date(dateFromRaw);
    if (Number.isNaN(dateFrom.getTime())) throw new EmailQueryError('Invalid "dateFrom".');
  }

  const q = str(query, "q");
  if (q.length > MAX_SEARCH_LENGTH) throw new EmailQueryError("Search text is too long.");

  const page = Math.max(1, parseInt(str(query, "page"), 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(str(query, "limit"), 10) || DEFAULT_LIMIT));

  return {
    folder,
    mailbox: objectId(query, "mailbox"),
    sentBy: objectId(query, "sentBy"),
    status,
    viewedBy: viewedByRaw === "none" ? "none" : viewedByRaw ? new mongoose.Types.ObjectId(viewedByRaw) : null,
    dateFrom,
    hasAttachment: str(query, "hasAttachment") === "1",
    q,
    page,
    limit,
  };
}

const FOLDER_FILTERS = {
  inbox: { direction: "in", isSpam: false },
  spam: { direction: "in", isSpam: true },
  sent: { direction: "out" },
  // "All mail" = received (not spam) + sent, as in the approved demo.
  all: { $or: [{ direction: "in", isSpam: false }, { direction: "out" }] },
};

const STATUS_CLAUSES = {
  // sent: not answered by the recipient. received: no admin/Gmail reply yet.
  noreply: { $or: [{ direction: "out", status: "sent" }, { direction: "in", repliedAt: null }] },
  // sent: the recipient replied. received: someone already replied to it.
  replied: { $or: [{ direction: "out", status: "replied" }, { direction: "in", repliedAt: { $ne: null } }] },
  failed: { direction: "out", status: "failed" },
};

// accessibleMailboxIds: ObjectIds this admin may use (see Mailbox.allowedAdmins).
function buildMessageFilter(params, accessibleMailboxIds) {
  const and = [];

  if (params.mailbox) {
    const allowed = accessibleMailboxIds.some((id) => id.equals(params.mailbox));
    and.push({ mailbox: allowed ? params.mailbox : { $in: [] } });
  } else {
    and.push({ mailbox: { $in: accessibleMailboxIds } });
  }

  and.push(FOLDER_FILTERS[params.folder]);
  if (params.sentBy) and.push({ sentByAdmin: params.sentBy });
  if (params.status) and.push(STATUS_CLAUSES[params.status]);
  if (params.viewedBy === "none") and.push({ firstViewedAt: null });
  else if (params.viewedBy) and.push({ firstViewedBy: params.viewedBy });
  if (params.dateFrom) and.push({ messageDate: { $gte: params.dateFrom } });
  if (params.hasAttachment) and.push({ hasAttachments: true });

  if (params.q) {
    // Bodies are encrypted at rest, so search covers subject, addresses, names
    // and who sent it. Partial, case-insensitive ("anit" finds Anita).
    const re = new RegExp(escapeRegex(params.q), "i");
    and.push({
      $or: [
        { subject: re },
        { "from.address": re },
        { "from.name": re },
        { "to.address": re },
        { "to.name": re },
        { "cc.address": re },
        { sentByName: re },
      ],
    });
  }

  return { $and: and };
}

module.exports = { FOLDERS, STATUS_FILTERS, EmailQueryError, parseListQuery, buildMessageFilter, escapeRegex };
