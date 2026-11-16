// "Something changed in the Email module" events for the open dashboard, over our Socket.IO.
//
// The payload is only { mailboxId }: no subject, sender, address or body. An admin's browser
// reacts by asking the normal, authenticated API again, so mailbox access rules still decide
// what it sees. Only sockets that joined EMAIL_ROOM (verified admin or Super Admin, see
// canWatchEmail and the "email-watch" handler in server.js) receive it.
//
// Several changes of one mailbox within THROTTLE_MS are sent as one event.

const EMAIL_ROOM = "email_room";
const EVENT = "email-changed";
const THROTTLE_MS = 2000;

let emitter = null;
const lastSent = new Map();

// emit(payload) delivers the event to EMAIL_ROOM. Set once, by server.js, after Socket.IO exists.
function setEmailEmitter(fn) {
  emitter = typeof fn === "function" ? fn : null;
  lastSent.clear();
}

// → true when an event was sent. Never throws: a push problem must not break a sync or a send.
function emitEmailChanged(mailboxId, { now = Date.now() } = {}) {
  if (!emitter) return false;
  const key = String(mailboxId || "all");
  const last = lastSent.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return false;
  lastSent.set(key, now);
  try {
    emitter({ mailboxId: mailboxId ? String(mailboxId) : null });
    return true;
  } catch (err) {
    console.error("[email-events] emit failed:", err?.message || err);
    return false;
  }
}

const canWatchEmail = (identity) => Boolean(identity?.id) && (identity.role === "admin" || identity.role === "superadmin");

module.exports = { EMAIL_ROOM, EVENT, THROTTLE_MS, setEmailEmitter, emitEmailChanged, canWatchEmail };
