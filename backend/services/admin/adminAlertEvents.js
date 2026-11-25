// "A new patient registered" voice alert for open admin dashboards, over our Socket.IO.
//
// The payload is only { id, name }: no email, mobile or country. Only sockets that joined ADMIN_ALERTS_ROOM
// (verified admin or Super Admin, see canWatchAdminAlerts and the "admin-alerts-watch" handler in server.js) receive it.
//
// Fire-and-forget safe: never throws, and the emit runs after the signup code has moved on (setImmediate), so
// registration is never slowed or failed by it.
//
// Switch: ADMIN_REGISTRATION_VOICE_ALERT. ON unless set to false / 0 / off / no (read on every call).
const ADMIN_ALERTS_ROOM = "admin_alerts_room";
const EVENT = "admin-user-registered";

let emitter = null;

// emit(payload) delivers the event to ADMIN_ALERTS_ROOM. Set once, by server.js, after Socket.IO exists.
function setAdminAlertEmitter(fn) {
  emitter = typeof fn === "function" ? fn : null;
}

const enabled = () =>
  !["false", "0", "off", "no"].includes(String(process.env.ADMIN_REGISTRATION_VOICE_ALERT ?? "").trim().toLowerCase());

const oneLine = (value, max = 80) =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const canWatchAdminAlerts = (identity) =>
  Boolean(identity?.id) && (identity.role === "admin" || identity.role === "superadmin");

function emitUserRegistered({ user } = {}) {
  try {
    if (!enabled() || !emitter || !user?._id) return;
    const payload = { id: String(user._id), name: oneLine(user.name) };
    setImmediate(() => {
      try {
        emitter(payload);
      } catch (err) {
        console.error("[admin-alerts] emit failed:", err?.message || err);
      }
    });
  } catch (err) {
    console.error("[admin-alerts] could not prepare the registration alert:", err?.message || err);
  }
}

module.exports = { ADMIN_ALERTS_ROOM, EVENT, setAdminAlertEmitter, emitUserRegistered, canWatchAdminAlerts };
