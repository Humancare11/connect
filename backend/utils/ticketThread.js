// Shared logic for support-ticket conversations (Ticket = doctors, UserTicket = patients).
//
// Rules enforced here, once, for both models:
//   - replies are only accepted while the ticket is open (and are written atomically with that check,
//     so a reply can never slip in after the admin closed the ticket);
//   - a reply never changes the status; only closeTicket() does;
//   - tickets created before threads existed have no messages[]: their thread is derived from
//     description (+ resolution) when read, and stored the first time somebody replies or closes.
const ADMIN_TIMEZONE = "Asia/Kolkata";
const MAX_REPLY_LENGTH = 2000;

const validTimeZone = (tz) => {
  if (!tz || typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Display id shown to people and used in the admin email, e.g. TCK-3F9A1C.
const ticketRef = (id) => `TCK-${String(id).slice(-6).toUpperCase()}`;

// "7 Nov 2026, 04:30 pm" + "Asia/Kolkata (GMT+5:30)". Returns "" for an unusable date/zone.
const formatInZone = (date, timeZone) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime()) || !validTimeZone(timeZone)) return "";
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value || "";
  return `${when} · ${timeZone}${offset ? ` (${offset})` : ""}`;
};

const legacyMessages = (t) => {
  const out = [{ sender: "user", text: t.description, createdAt: t.createdAt }];
  if (t.status === "resolved" && t.resolution) {
    out.push({ sender: "admin", text: t.resolution, createdAt: t.closedAt || t.updatedAt || t.createdAt });
  }
  return out;
};

// Plain object for the API. `forUser` hides who closed it (admin identity is not the raiser's business).
const serializeTicket = (doc, { forUser = false } = {}) => {
  const t = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (!Array.isArray(t.messages) || t.messages.length === 0) t.messages = legacyMessages(t);
  if (t.status === "resolved" && !t.closedAt) t.closedAt = t.updatedAt || null;
  t.ref = ticketRef(t._id);
  if (forUser) {
    delete t.closedBy;
    delete t.resolvedBy;
  }
  return t;
};

// Store the derived thread of an old ticket (once; the filter makes it safe under concurrency).
const ensureThread = async (Model, doc) => {
  if (Array.isArray(doc.messages) && doc.messages.length > 0) return;
  await Model.updateOne(
    { _id: doc._id, "messages.0": { $exists: false } },
    { $set: { messages: legacyMessages(doc.toObject()) } },
  );
};

const cleanReply = (text) => {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, MAX_REPLY_LENGTH);
};

// -> { status: 200, ticket } | { status: 404 } | { status: 409 }
const appendReply = async (Model, filter, sender, text) => {
  const doc = await Model.findOne(filter);
  if (!doc) return { status: 404 };
  if (doc.status !== "open") return { status: 409 };
  await ensureThread(Model, doc);
  const ticket = await Model.findOneAndUpdate(
    { _id: doc._id, status: "open" },
    { $push: { messages: { sender, text, createdAt: new Date() } } },
    { returnDocument: "after" },
  );
  if (!ticket) return { status: 409 };
  return { status: 200, ticket };
};

// -> { status: 200, ticket } | { status: 404 } | { status: 409 }. `note` (optional) is added as a last admin message.
const closeTicket = async (Model, id, adminId, note = "") => {
  const doc = await Model.findById(id);
  if (!doc) return { status: 404 };
  if (doc.status !== "open") return { status: 409 };
  await ensureThread(Model, doc);
  const set = { status: "resolved", closedAt: new Date(), closedBy: adminId, resolvedBy: adminId };
  const update = { $set: set };
  if (note) {
    set.resolution = note;
    update.$push = { messages: { sender: "admin", text: note, createdAt: new Date() } };
  }
  const ticket = await Model.findOneAndUpdate({ _id: doc._id, status: "open" }, update, { returnDocument: "after" });
  if (!ticket) return { status: 409 };
  return { status: 200, ticket };
};

module.exports = {
  ADMIN_TIMEZONE,
  MAX_REPLY_LENGTH,
  validTimeZone,
  ticketRef,
  formatInZone,
  legacyMessages,
  serializeTicket,
  ensureThread,
  cleanReply,
  appendReply,
  closeTicket,
};
