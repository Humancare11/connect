// Read-only Gmail connectivity check for the shared mailboxes.
// Usage: node scripts/checkGmailConnection.js [address ...]
//
// Only calls users.getProfile and users.messages.list — it never sends,
// modifies or deletes anything, and it prints no keys, tokens, subjects or
// bodies (just the profile address, history id, counts and message ids).
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : process.env.NODE_ENV === "uat" ? ".env.uat" : ".env"
  ),
});

const { getGmailApi } = require("../services/gmail/gmailAuth");
const { createGmailClient } = require("../services/gmail/gmailClient");

const DEFAULT_ADDRESSES = ["support@humancareconnect.co", "tech@humancareconnect.co"];

async function check(address) {
  const client = createGmailClient(getGmailApi({ address, isActive: true }));
  const profile = await client.getProfile();
  const inbox = await client.listMessageIds({ limit: 5 });
  const spam = await client.listMessageIds({ q: "in:spam", includeSpamTrash: true, limit: 5 });
  console.log(`✔ ${address}`);
  console.log(`    profile address : ${profile.emailAddress}`);
  console.log(`    history id      : ${profile.historyId}`);
  console.log(`    latest ids      : ${inbox.length ? inbox.join(", ") : "(none)"}`);
  console.log(`    spam ids        : ${spam.length ? spam.join(", ") : "(none)"}`);
}

(async () => {
  const addresses = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ADDRESSES;
  let failed = 0;
  for (const address of addresses) {
    try {
      await check(address);
    } catch (err) {
      failed += 1;
      const apiError = err?.response?.data?.error;
      console.log(`✖ ${address}`);
      console.log(`    ${apiError?.error || apiError?.message || err.message}`);
      if (err?.response?.data?.error_description) console.log(`    ${err.response.data.error_description}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
