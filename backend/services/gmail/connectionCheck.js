const { getGmailApi } = require("./gmailAuth");
const { createGmailClient } = require("./gmailClient");
const { EMAIL_DOMAIN, isCompanyAddress } = require("../../models/Mailbox");

const CHECK_TIMEOUT_MS = Number(process.env.EMAIL_MAILBOX_CHECK_TIMEOUT_MS) || 15_000;

// Read-only Gmail connectivity check for ONE company address: users.getProfile
// plus a 5-item users.messages.list. It never sends, modifies or deletes anything.
// Shared by the "Add mailbox" API and scripts/checkGmailConnection.js.
//
// → { ok: true, address, historyId, latestIds }
//   { ok: false, code, message, detail }   message is safe to show; detail is a
//                                          short Google error word (never secrets)
//
// `getApi` is injectable so tests need no Google credentials.

const fail = (code, message, detail = "") => ({ ok: false, code, message, detail });

function googleErrorWord(err) {
  const data = err?.response?.data;
  if (typeof data?.error === "string") return data.error; // token endpoint: invalid_grant, ...
  return data?.error?.errors?.[0]?.reason || data?.error?.status || "";
}

function classify(err, address) {
  const text = String(err?.message || "");
  const data = err?.response?.data;
  const status = Number(err?.code) || Number(err?.status) || Number(err?.response?.status) || 0;
  const word = googleErrorWord(err);

  if (/^Gmail is not configured|^Gmail service-account key/.test(text)) {
    return fail("NOT_CONFIGURED", "Gmail is not configured on this server (service-account key missing).");
  }
  if (err?.name === "CheckTimeout") {
    return fail("TIMEOUT", "Google did not answer in time. Please try again.");
  }
  if (word === "unauthorized_client") {
    return fail(
      "DELEGATION",
      "Domain-wide delegation does not cover this address or the Gmail scope. Check the delegation setup in the Google Admin console.",
      word
    );
  }
  if (word === "invalid_grant") {
    return fail(
      "NO_USER_MAILBOX",
      `Google found no user mailbox for ${address}. It may be a Group, an alias or a misspelling. Use the user's primary address.`,
      word
    );
  }
  if (word === "failedPrecondition" || /mail service not enabled/i.test(String(data?.error?.message || text))) {
    return fail("NO_GMAIL", `${address} has no Gmail mailbox (the user may not be licensed for Gmail).`, word);
  }
  if (status === 403) {
    return fail("DELEGATION", "Google refused access to this mailbox. Check the delegation setup in the Google Admin console.", word);
  }
  return fail("UNKNOWN", "The Gmail connection check failed. Please try again or check the server logs.", word);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "CheckTimeout" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function checkMailboxConnection(rawAddress, { getApi = getGmailApi, timeoutMs = CHECK_TIMEOUT_MS } = {}) {
  const address = String(rawAddress || "").trim().toLowerCase();
  if (!isCompanyAddress(address)) {
    return fail("INVALID_ADDRESS", `Enter a valid @${EMAIL_DOMAIN} address.`);
  }
  try {
    // A transient object: the address is checked against the company domain by
    // assertImpersonable, and nothing is saved by this check.
    const client = createGmailClient(getApi({ address, isActive: true }));
    const result = await withTimeout(
      (async () => {
        const profile = await client.getProfile();
        const latestIds = await client.listMessageIds({ limit: 5 });
        return { profile, latestIds };
      })(),
      timeoutMs
    );
    if (String(result.profile.emailAddress || "").toLowerCase() !== address) {
      return fail(
        "ALIAS",
        `${address} is an alias of ${result.profile.emailAddress}. Add the user's primary address instead.`,
        "alias"
      );
    }
    return { ok: true, address, historyId: result.profile.historyId, latestIds: result.latestIds };
  } catch (err) {
    return classify(err, address);
  }
}

module.exports = { checkMailboxConnection, CHECK_TIMEOUT_MS };
