// One combined "Read status" per sent mail, from the strongest signal we have.
//
//   replied > downloaded > clicked > receipt > opened > opened_apple
//     > pending > automated > unavailable
//
// The first six are real signals. The last three are the "no signal" states and
// stay separate on purpose: a mail we cannot track must never read as "Not opened".
//
// The status is derived from fields already on the message, in the screen
// (computeReadStatus) and in the list filter (readStatusClause), so it can never
// be stale and needs no backfill. Both come from the one table below.

const SENT = { direction: "out", status: { $in: ["sent", "replied"] } };

const count = (path) => ({
  has: { [path]: { $gt: 0 } },
  not: { [path]: { $not: { $gt: 0 } } }, // also matches a missing field
});

// Highest first. `test` runs on a document, `has`/`not` are the same rule for Mongo.
const SIGNALS = [
  {
    key: "replied",
    test: (d) => d.status === "replied",
    has: { status: "replied" },
    not: { status: { $ne: "replied" } },
    at: (d) => d.repliedAt || null,
  },
  { key: "downloaded", test: (d) => (d.tracking?.downloadCount || 0) > 0, ...count("tracking.downloadCount"), at: (d) => d.tracking?.lastDownloadedAt || null },
  { key: "clicked", test: (d) => (d.tracking?.clickCount || 0) > 0, ...count("tracking.clickCount"), at: (d) => d.tracking?.lastClickedAt || null },
  {
    key: "receipt",
    test: (d) => Boolean(d.tracking?.receiptAt),
    has: { "tracking.receiptAt": { $ne: null } },
    not: { "tracking.receiptAt": null },
    at: (d) => d.tracking?.receiptAt || null,
  },
  {
    key: "opened",
    test: (d) => d.tracking?.status === "opened",
    has: { "tracking.status": "opened" },
    not: { "tracking.status": { $ne: "opened" } },
    at: (d) => d.tracking?.lastOpenedAt || null,
  },
  { key: "opened_apple", test: (d) => (d.tracking?.appleOpenCount || 0) > 0, ...count("tracking.appleOpenCount"), at: (d) => d.tracking?.lastAppleOpenedAt || null },
];

// The three "no signal" states. Mutually exclusive, so they need no negations among themselves.
const QUIET = [
  {
    key: "pending",
    test: (d) => d.tracking?.status === "pending",
    has: { "tracking.status": "pending" },
  },
  {
    key: "automated",
    test: (d) => d.tracking?.status === "unavailable" && d.tracking?.unavailableReason === "automated_only",
    has: { "tracking.status": "unavailable", "tracking.unavailableReason": "automated_only" },
  },
  {
    // Not tracked at all (tracking off, mail off, internal/opted-out recipient, sent from Gmail, older mail).
    key: "unavailable",
    test: (d) => !d.tracking || (d.tracking.status === "unavailable" && d.tracking.unavailableReason !== "automated_only"),
    has: {
      $or: [
        { "tracking.status": "unavailable", "tracking.unavailableReason": { $ne: "automated_only" } },
        { tracking: { $exists: false } },
      ],
    },
  },
];

const READ_STATUSES = [...SIGNALS, ...QUIET].map((s) => s.key);

const isSentOut = (doc) => doc.direction === "out" && ["sent", "replied"].includes(doc.status);

// → { status, at } for a mail that went out, or null (received, failed, still sending).
function computeReadStatus(doc) {
  if (!isSentOut(doc)) return null;
  for (const s of SIGNALS) if (s.test(doc)) return { status: s.key, at: s.at(doc) };
  for (const s of QUIET) if (s.test(doc)) return { status: s.key, at: null };
  return { status: "unavailable", at: null };
}

// Mongo filter matching exactly the mails whose combined status is `status`.
function readStatusClause(status) {
  const index = SIGNALS.findIndex((s) => s.key === status);
  if (index >= 0) {
    return { $and: [SENT, SIGNALS[index].has, ...SIGNALS.slice(0, index).map((s) => s.not)] };
  }
  const quiet = QUIET.find((s) => s.key === status);
  if (!quiet) return null;
  // A quiet state applies only when no real signal is present.
  return { $and: [SENT, quiet.has, ...SIGNALS.map((s) => s.not)] };
}

module.exports = { READ_STATUSES, computeReadStatus, readStatusClause };
