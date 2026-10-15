const EmailLink = require("../../models/EmailLink");
const EmailClickEvent = require("../../models/EmailClickEvent");

// Which tracked link of a mail was clicked, how often and when, for the mail page.
// → Map(messageId → [{ index, url, count, first, last }]) in the order the links
// appear in the mail. Links nobody clicked are included with count 0. A mail with
// no tracked links has no entry. Counts come from the stored click events, so
// they only reach as far back as the events are kept.
async function summarizeLinks(messageIds) {
  const out = new Map();
  if (!messageIds.length) return out;
  const [links, stats] = await Promise.all([
    EmailLink.find({ message: { $in: messageIds } }).sort({ message: 1, index: 1 }).select("message index url").lean(),
    EmailClickEvent.aggregate([
      { $match: { message: { $in: messageIds }, counted: true } },
      { $group: { _id: "$link", count: { $sum: 1 }, first: { $min: "$at" }, last: { $max: "$at" } } },
    ]),
  ]);
  const byLink = new Map(stats.map((s) => [String(s._id), s]));
  for (const l of links) {
    const key = String(l.message);
    const s = byLink.get(String(l._id));
    if (!out.has(key)) out.set(key, []);
    out.get(key).push({ index: l.index, url: l.url, count: s?.count || 0, first: s?.first || null, last: s?.last || null });
  }
  return out;
}

module.exports = { summarizeLinks };
