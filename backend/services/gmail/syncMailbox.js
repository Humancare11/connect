const os = require("os");
const crypto = require("crypto");
const Mailbox = require("../../models/Mailbox");
const EmailMessage = require("../../models/EmailMessage");
const EmailAttachment = require("../../models/EmailAttachment");
const { getGmailApi } = require("./gmailAuth");
const { createGmailClient, HistoryExpiredError } = require("./gmailClient");
const { parseGmailMessage } = require("./mimeParser");

const LEASE_MS = 5 * 60 * 1000;
const BACKFILL_DAYS = Number(process.env.EMAIL_BACKFILL_DAYS) || 30;
const BACKFILL_LIMIT = 2000;
const RECONCILE_EVERY_MS = 10 * 60 * 1000;
const RECONCILE_WINDOW = "newer_than:2d";
const FETCH_CONCURRENCY = 5;
const BATCH_SIZE = 50;

// Shown as "replied by" when someone answered from the Gmail website rather
// than the dashboard — still tells admins not to reply twice.
const OUTSIDE_REPLIER = "Gmail (outside dashboard)";

const defaultOwner = () => `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;

// ── reply matching ──
// Threads are Gmail's threadId. Our own replies are sent with In-Reply-To /
// References + the same subject, so Gmail keeps them in the client's thread.
async function linkReplies(doc) {
  if (!doc.gmailThreadId) return;

  if (doc.direction === "in" && !doc.isSpam) {
    // The recipient answered: earlier mail we sent in this thread is now "replied".
    await EmailMessage.updateMany(
      {
        mailbox: doc.mailbox,
        gmailThreadId: doc.gmailThreadId,
        direction: "out",
        status: "sent",
        messageDate: { $lt: doc.messageDate },
      },
      { $set: { status: "replied", repliedAt: doc.messageDate } }
    );
  } else if (doc.direction === "out" && doc.sentOutsideDashboard) {
    // Dashboard replies mark the inbound mail themselves (send path); mail sent
    // from Gmail directly is only discovered here.
    await EmailMessage.updateMany(
      {
        mailbox: doc.mailbox,
        gmailThreadId: doc.gmailThreadId,
        direction: "in",
        isSpam: false,
        repliedAt: null,
        messageDate: { $lt: doc.messageDate },
      },
      { $set: { repliedAt: doc.messageDate, repliedByName: OUTSIDE_REPLIER } }
    );
  }
}

// Stores one parsed Gmail message. Idempotent. → "created" | "updated" | "skipped"
async function ingestParsed(mailbox, p) {
  if (p.isDraft) return "skipped"; // Drafts/Trash are not part of this module.

  const existing = await EmailMessage.findOne({ mailbox: mailbox._id, gmailMessageId: p.gmailMessageId })
    .select("_id direction isSpam gmailRead");
  if (existing) {
    // Only two labels can change for a stored inbound message: SPAM and UNREAD (mirrors Gmail-side moves/reads).
    if (existing.direction !== "in") return "skipped";
    const set = {};
    if (existing.isSpam !== p.isSpam) set.isSpam = p.isSpam;
    if (Boolean(existing.gmailRead) === p.isUnread) set.gmailRead = !p.isUnread;
    if (!Object.keys(set).length) return "skipped";
    await EmailMessage.updateOne({ _id: existing._id }, { $set: set });
    if ("isSpam" in set && !p.isSpam) {
      const doc = await EmailMessage.findById(existing._id);
      if (doc) await linkReplies(doc);
    }
    return "updated";
  }
  if (p.isTrash) return "skipped";

  const direction = p.isSent ? "out" : "in";

  // A mail we sent from the dashboard exists already (created before the send,
  // keyed by the Message-ID we chose). Adopt it instead of inserting a twin.
  if (direction === "out" && p.rfcMessageId) {
    const adopted = await EmailMessage.findOneAndUpdate(
      { mailbox: mailbox._id, direction: "out", rfcMessageId: p.rfcMessageId, gmailMessageId: null },
      { $set: { gmailMessageId: p.gmailMessageId, gmailThreadId: p.gmailThreadId } },
      { returnDocument: "after" }
    );
    if (adopted) {
      // If the process died between Gmail accepting the mail and us recording it.
      await EmailMessage.updateOne({ _id: adopted._id, status: "sending" }, { $set: { status: "sent" } });
      return "updated";
    }
  }

  const doc = new EmailMessage({
    mailbox: mailbox._id,
    direction,
    gmailMessageId: p.gmailMessageId,
    gmailThreadId: p.gmailThreadId,
    rfcMessageId: p.rfcMessageId,
    inReplyTo: p.inReplyTo,
    references: p.references,
    from: p.from,
    to: p.to,
    cc: p.cc,
    subject: p.subject,
    messageDate: p.messageDate,
    isSpam: direction === "in" && p.isSpam,
    gmailRead: direction === "in" && !p.isUnread,
    hasAttachments: p.hasAttachments,
    attachmentCount: p.attachmentCount,
    status: direction === "in" ? "received" : "sent",
    sentOutsideDashboard: direction === "out",
  });
  doc.setContent({ text: p.text, html: p.html, snippet: p.snippet });

  try {
    await doc.save();
  } catch (err) {
    if (err?.code === 11000) return "skipped"; // another instance/run stored it first
    throw err;
  }

  if (p.attachments.length) {
    // Bytes stay in Gmail until first download (partId lets us re-resolve the id).
    await EmailAttachment.insertMany(
      p.attachments.map((a) => ({
        message: doc._id,
        mailbox: mailbox._id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        gmailAttachmentId: a.gmailAttachmentId,
        partId: a.partId,
        contentId: a.contentId,
        isInline: a.isInline,
      }))
    );
  }

  await linkReplies(doc);
  return "created";
}

// Copies Gmail's read state onto mail we already hold: ids in `allIds` that are not in
// Gmail's `is:unread` list are read; unread ones are unread. Only the stored flag changes,
// and nothing is ever written to Gmail. → number of rows changed.
async function applyReadState(gmail, mailbox, allIds, { window, limit }) {
  const unread = await gmail.listMessageIds({ q: `is:unread ${window}`, includeSpamTrash: true, limit });
  const unreadSet = new Set(unread);
  const read = allIds.filter((id) => !unreadSet.has(id));
  const [nowRead, nowUnread] = await Promise.all([
    read.length
      ? EmailMessage.updateMany({ mailbox: mailbox._id, direction: "in", gmailRead: false, gmailMessageId: { $in: read } }, { $set: { gmailRead: true } })
      : { modifiedCount: 0 },
    unread.length
      ? EmailMessage.updateMany({ mailbox: mailbox._id, direction: "in", gmailRead: true, gmailMessageId: { $in: unread } }, { $set: { gmailRead: false } })
      : { modifiedCount: 0 },
  ]);
  return nowRead.modifiedCount + nowUnread.modifiedCount;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

async function syncMailbox(mailboxId, { client, owner = defaultOwner(), now = () => new Date() } = {}) {
  let mailbox = await Mailbox.acquireLease(mailboxId, owner, LEASE_MS);
  if (!mailbox) return { skipped: true };

  const stats = { mode: "incremental", created: 0, updated: 0, skipped: 0, reconciled: false, readStateChanged: 0 };

  const renewLease = async () => {
    if (!(await Mailbox.acquireLease(mailboxId, owner, LEASE_MS))) {
      throw new Error("Lost the sync lease for this mailbox.");
    }
  };

  try {
    const gmail = client || createGmailClient(getGmailApi(mailbox));

    // Fetch → parse → store, oldest first so reply matching sees threads in order.
    // skipExisting avoids re-fetching mail we already hold (backfill/reconcile);
    // label-change ids are re-fetched on purpose.
    async function processIds(ids, { skipExisting = false } = {}) {
      let todo = [...new Set(ids)];
      if (skipExisting && todo.length) {
        const have = await EmailMessage.find({ mailbox: mailbox._id, gmailMessageId: { $in: todo } })
          .select("gmailMessageId")
          .lean();
        const haveSet = new Set(have.map((m) => m.gmailMessageId));
        todo = todo.filter((id) => !haveSet.has(id));
      }
      for (let i = 0; i < todo.length; i += BATCH_SIZE) {
        await renewLease();
        const raw = await mapLimit(todo.slice(i, i + BATCH_SIZE), FETCH_CONCURRENCY, (id) => gmail.getMessage(id));
        const parsed = raw.map(parseGmailMessage).filter(Boolean).sort((a, b) => a.messageDate - b.messageDate);
        for (const p of parsed) stats[await ingestParsed(mailbox, p)] += 1;
      }
    }

    async function backfill() {
      stats.mode = "backfill";
      // Baseline BEFORE listing, so mail arriving mid-backfill is picked up next run.
      const { historyId } = await gmail.getProfile();
      const ids = await gmail.listMessageIds({
        q: `newer_than:${BACKFILL_DAYS}d`,
        includeSpamTrash: true,
        limit: BACKFILL_LIMIT,
      });
      await processIds(ids, { skipExisting: true });
      return historyId;
    }

    // Safety net for what history.list can miss (e.g. mail delivered straight
    // to Spam) and for Gmail-side spam moves: cheap, fetches only unknown mail.
    let reconciledIds = [];
    async function reconcile() {
      stats.reconciled = true;
      const spamIds = await gmail.listMessageIds({ q: `in:spam ${RECONCILE_WINDOW}`, includeSpamTrash: true, limit: 500 });
      if (spamIds.length) {
        await EmailMessage.updateMany(
          { mailbox: mailbox._id, direction: "in", isSpam: false, gmailMessageId: { $in: spamIds } },
          { $set: { isSpam: true } }
        );
      }
      const inboxIds = await gmail.listMessageIds({ q: `in:inbox ${RECONCILE_WINDOW}`, limit: 500 });
      if (inboxIds.length) {
        await EmailMessage.updateMany(
          { mailbox: mailbox._id, direction: "in", isSpam: true, gmailMessageId: { $in: inboxIds } },
          { $set: { isSpam: false } }
        );
      }
      const recent = await gmail.listMessageIds({ q: RECONCILE_WINDOW, includeSpamTrash: true, limit: 500 });
      await processIds(recent, { skipExisting: true });
      reconciledIds = recent;
    }

    let historyId = mailbox.gmailHistoryId;
    if (!historyId) {
      historyId = await backfill();
    } else {
      try {
        const changes = await gmail.listHistory(historyId);
        await processIds([...changes.addedIds, ...changes.labelChangedIds]);
        historyId = changes.historyId;
      } catch (err) {
        if (!(err instanceof HistoryExpiredError)) throw err;
        historyId = await backfill();
      }
    }

    const reconcileDue =
      !mailbox.lastReconcileAt || now().getTime() - new Date(mailbox.lastReconcileAt).getTime() > RECONCILE_EVERY_MS;
    if (reconcileDue) await reconcile();

    // Gmail read state. Normally it arrives with label-change events (the message is
    // re-fetched and ingestParsed updates it); this is the safety net for events history
    // can miss, plus a one-time pass for mail stored before this flag existed.
    const readStateBackfillDue = !mailbox.readStateBackfilledAt;
    if (readStateBackfillDue) {
      const window = `newer_than:${BACKFILL_DAYS}d`;
      const all = await gmail.listMessageIds({ q: window, includeSpamTrash: true, limit: BACKFILL_LIMIT });
      stats.readStateChanged = await applyReadState(gmail, mailbox, all, { window, limit: BACKFILL_LIMIT });
    } else if (stats.reconciled) {
      stats.readStateChanged = await applyReadState(gmail, mailbox, reconciledIds, { window: RECONCILE_WINDOW, limit: 500 });
    }

    await Mailbox.updateOne(
      { _id: mailboxId },
      {
        $set: {
          gmailHistoryId: String(historyId),
          lastSyncAt: now(),
          lastSyncError: "",
          ...(stats.reconciled || stats.mode === "backfill" ? { lastReconcileAt: now() } : {}),
          ...(readStateBackfillDue ? { readStateBackfilledAt: now() } : {}),
        },
      }
    );
    return stats;
  } catch (err) {
    await Mailbox.updateOne(
      { _id: mailboxId },
      { $set: { lastSyncError: String(err?.message || err).slice(0, 300) } }
    );
    throw err;
  } finally {
    await Mailbox.releaseLease(mailboxId, owner);
  }
}

module.exports = { syncMailbox, ingestParsed, linkReplies, applyReadState, OUTSIDE_REPLIER };
