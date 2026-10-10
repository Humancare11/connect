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

// Same check the superadmin "Mail IDs" page runs before saving a mailbox.
const { checkMailboxConnection } = require("../services/gmail/connectionCheck");

const DEFAULT_ADDRESSES = ["support@humancareconnect.co", "tech@humancareconnect.co"];

(async () => {
  const addresses = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ADDRESSES;
  let failed = 0;
  for (const address of addresses) {
    const res = await checkMailboxConnection(address);
    if (res.ok) {
      console.log(`✔ ${res.address}`);
      console.log(`    history id      : ${res.historyId}`);
      console.log(`    latest ids      : ${res.latestIds.length ? res.latestIds.join(", ") : "(none)"}`);
    } else {
      failed += 1;
      console.log(`✖ ${address}`);
      console.log(`    ${res.message}${res.detail ? ` (${res.detail})` : ""}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
