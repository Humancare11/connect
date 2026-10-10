// Sends ONE real test mail through the same code path the dashboard uses
// (attribution, Gmail send, sync adoption) — for a deliberate live check.
//
// Safe by default: without --send it only prints what it WOULD do and sends nothing.
//
// Usage:
//   node scripts/sendTestMail.js --admin <admin login email> --mailbox <support|tech address> --to <recipient>
//   node scripts/sendTestMail.js ... --send        # actually sends
//
// Refuses to run against the production database (see utils/dbGuard.js).
// No attachments here (they need real S3); attachments are covered by the tests.
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : process.env.NODE_ENV === "uat" ? ".env.uat" : ".env"
  ),
});
const mongoose = require("mongoose");
const Mailbox = require("../models/Mailbox");
const User = require("../models/User");
const { assertNotProductionDb } = require("../utils/dbGuard");
const { getGmailApi } = require("../services/gmail/gmailAuth");
const { createGmailClient } = require("../services/gmail/gmailClient");
const { sendNewMail } = require("../services/email/emailSender");
const { normalizeAddressList } = require("../utils/emailValidation");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const adminEmail = String(arg("admin") || "").toLowerCase();
  const mailboxAddress = String(arg("mailbox") || "").toLowerCase();
  const toRaw = arg("to");
  const live = process.argv.includes("--send");
  if (!adminEmail || !mailboxAddress || !toRaw) {
    throw new Error("Usage: node scripts/sendTestMail.js --admin <email> --mailbox <address> --to <recipient> [--send]");
  }

  assertNotProductionDb({ uri: process.env.MONGO_URI });
  mongoose.set("debug", false);
  await mongoose.connect(process.env.MONGO_URI);

  const admin = await User.findOne({ email: adminEmail, role: { $in: ["admin", "superadmin"] }, accountDisabled: { $ne: true } }).select("name role");
  if (!admin) throw new Error(`No active admin/superadmin with login email ${adminEmail}.`);
  const mailbox = await Mailbox.findOne({ address: mailboxAddress, isActive: true }).lean();
  if (!mailbox) throw new Error(`No active mailbox ${mailboxAddress}.`);
  const to = normalizeAddressList(toRaw, { label: "To", required: true });

  const subject = "[TEST] HCC Mail Desk - please ignore";
  const body = "This is a test message from the Human Care Connect Mail Desk. No action is needed.";

  console.log(`${live ? "SENDING" : "DRY RUN (nothing sent)"}:`);
  console.log(`  from (what the recipient sees): ${mailbox.address}`);
  console.log(`  to                            : ${to.map((a) => a.address).join(", ")}`);
  console.log(`  recorded as sent by           : ${admin.name} (${admin.role})`);
  console.log(`  subject                       : ${subject}`);

  if (live) {
    const gmail = createGmailClient(getGmailApi(mailbox));
    const { message } = await sendNewMail({
      mailbox,
      actor: { id: admin._id, name: admin.name },
      to,
      cc: [],
      subject,
      body,
      files: [],
      clientRequestId: `test-${Date.now()}`,
      gmail,
      store: null,
    });
    console.log(`  result: status=${message.status}, stored id=${message._id}`);
    console.log("Next: run node scripts/syncMailboxesOnce.js — the Sent row must NOT be duplicated.");
  } else {
    console.log("Add --send to actually send it.");
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
