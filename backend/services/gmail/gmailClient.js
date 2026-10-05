// Thin, testable wrapper over the Gmail `users.*` API for ONE mailbox.
// `api` is the object returned by gmailAuth.getGmailApi(mailbox) (tests pass a fake).

class HistoryExpiredError extends Error {
  constructor() {
    super("Gmail history id is too old; a full resync is required.");
    this.name = "HistoryExpiredError";
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(err) {
  return Number(err?.code) || Number(err?.status) || Number(err?.response?.status) || 0;
}

function reasonOf(err) {
  return err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || "";
}

function isRetryable(err) {
  const status = statusOf(err);
  if (status === 429 || status >= 500) return true;
  return status === 403 && /rateLimitExceeded|userRateLimitExceeded/i.test(reasonOf(err));
}

// Retries rate-limit and 5xx errors with exponential backoff + jitter.
async function withRetry(fn, { retries = 4, baseMs = 500, sleepFn = sleep } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      await sleepFn(baseMs * 2 ** attempt + Math.floor(Math.random() * 250));
    }
  }
}

const decodeBase64Url = (data) => Buffer.from(String(data || ""), "base64url");

function createGmailClient(api, { sleepFn = sleep } = {}) {
  const retry = (fn) => withRetry(fn, { sleepFn });
  const users = api.users;

  return {
    // → { emailAddress, historyId }. historyId is the baseline for incremental sync.
    async getProfile() {
      const res = await retry(() => users.getProfile({ userId: "me" }));
      return { emailAddress: res.data.emailAddress, historyId: String(res.data.historyId) };
    },

    // Incremental changes since `startHistoryId`. Gmail answers 404 once the id
    // is older than ~a week → HistoryExpiredError so the caller does a backfill.
    // → { addedIds, labelChangedIds, historyId }
    async listHistory(startHistoryId) {
      const added = new Set();
      const labelChanged = new Set();
      let historyId = String(startHistoryId);
      let pageToken;
      do {
        let res;
        try {
          res = await retry(() =>
            users.history.list({
              userId: "me",
              startHistoryId,
              historyTypes: ["messageAdded", "labelAdded", "labelRemoved"],
              maxResults: 500,
              pageToken,
            })
          );
        } catch (err) {
          if (statusOf(err) === 404) throw new HistoryExpiredError();
          throw err;
        }
        for (const h of res.data.history || []) {
          for (const m of h.messagesAdded || []) added.add(m.message.id);
          for (const m of [...(h.labelsAdded || []), ...(h.labelsRemoved || [])]) {
            labelChanged.add(m.message.id);
          }
        }
        if (res.data.historyId) historyId = String(res.data.historyId);
        pageToken = res.data.nextPageToken;
      } while (pageToken);

      for (const id of added) labelChanged.delete(id);
      return { addedIds: [...added], labelChangedIds: [...labelChanged], historyId };
    },

    // Message ids matching a Gmail search, newest first. Spam/Trash are
    // excluded by Gmail unless includeSpamTrash is set.
    async listMessageIds({ q = "", includeSpamTrash = false, limit = 500 } = {}) {
      const ids = [];
      let pageToken;
      do {
        const res = await retry(() =>
          users.messages.list({
            userId: "me",
            q: q || undefined,
            includeSpamTrash,
            maxResults: Math.min(500, limit - ids.length),
            pageToken,
          })
        );
        for (const m of res.data.messages || []) ids.push(m.id);
        pageToken = res.data.nextPageToken;
      } while (pageToken && ids.length < limit);
      return ids;
    },

    // Full message (headers + MIME tree). null if it no longer exists.
    async getMessage(id) {
      try {
        const res = await retry(() => users.messages.get({ userId: "me", id, format: "full" }));
        return res.data;
      } catch (err) {
        if (statusOf(err) === 404) return null;
        throw err;
      }
    },

    async getAttachment(messageId, attachmentId) {
      const res = await retry(() =>
        users.messages.attachments.get({ userId: "me", messageId, id: attachmentId })
      );
      return decodeBase64Url(res.data.data);
    },

    // Sends a raw RFC 822 message. Deliberately NOT retried: a retry after an
    // ambiguous 5xx could deliver the same mail twice to a client.
    // → { id, threadId }
    async sendRaw(rawBuffer, threadId) {
      const res = await users.messages.send({
        userId: "me",
        requestBody: {
          raw: Buffer.from(rawBuffer).toString("base64url"),
          ...(threadId ? { threadId } : {}),
        },
      });
      return { id: res.data.id, threadId: res.data.threadId };
    },

    modifyLabels(id, { add = [], remove = [] }) {
      return retry(() =>
        users.messages.modify({ userId: "me", id, requestBody: { addLabelIds: add, removeLabelIds: remove } })
      );
    },

    // Mirrors "Mark as spam" / "Not spam" into Gmail (which also trains its filter).
    setSpam(id, isSpam) {
      return this.modifyLabels(
        id,
        isSpam ? { add: ["SPAM"], remove: ["INBOX"] } : { add: ["INBOX"], remove: ["SPAM"] }
      );
    },
  };
}

module.exports = { createGmailClient, HistoryExpiredError, withRetry, isRetryable, statusOf };
