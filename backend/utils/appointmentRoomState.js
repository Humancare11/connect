// Bookkeeping for which appointment call room a socket is in (server.js keeps one `socketRooms` map,
// socketId -> appointmentId, and every signaling/chat event is gated on it).
//
// Two things used to go wrong:
//   • After a Socket.IO connection-state recovery the library restores socket.rooms, but our map is cleared by the
//     "disconnect" handler and was only repaired if the client re-emitted join-appointment-room. Until then
//     leave-appointment-room was ignored and the socket could stay in the old appointment_* room.
//   • A socket that joined a second appointment room never left the first, so call events from the old call (e.g. a
//     late participant-left) were delivered into the new one, and no event said which call it belonged to.
//
// The fixes are server-side only and add nothing a current client could trip over: events gain an `appointmentId`
// field (see withAppointmentId), nothing is renamed or removed.
const PREFIX = "appointment_";

const appointmentRoomName = (appointmentId) => `${PREFIX}${appointmentId}`;
const appointmentIdOfRoom = (room) => (typeof room === "string" && room.startsWith(PREFIX) ? room.slice(PREFIX.length) : "");

// The appointment ids of the appointment_* rooms this socket is in, oldest first.
const appointmentRoomsOf = (socket) => [...socket.rooms].map(appointmentIdOfRoom).filter(Boolean);

// An event payload with the call it belongs to. Existing fields win, so a payload is never changed, only added to.
const withAppointmentId = (appointmentId, payload = {}) => ({ appointmentId: String(appointmentId), ...payload });

// A socket restored by connection-state recovery: rebuild its bookkeeping from the rooms the library restored,
// so leave-appointment-room and every gated event work straight away. A (never expected) second appointment room
// is left, newest one kept. Returns the appointment id it is in, or "".
function rebuildAfterRecovery(socket, state) {
  const ids = appointmentRoomsOf(socket);
  if (ids.length === 0) return "";
  const keep = ids[ids.length - 1];
  for (const id of ids.slice(0, -1)) leaveAppointmentRoom(socket, id, state);
  state.socketRooms.set(socket.id, keep);
  return keep;
}

// Leaves one room: tells the others in it (with the call's id) and forgets the room if it is now empty.
function leaveAppointmentRoom(socket, appointmentId, state) {
  const room = appointmentRoomName(appointmentId);
  socket.to(room).emit("participant-left", withAppointmentId(appointmentId));
  socket.leave(room);
  if (String(state.socketRooms.get(socket.id) || "") === String(appointmentId)) state.socketRooms.delete(socket.id);
  const remaining = socket.nsp.adapter.rooms.get(room);
  if (!remaining || remaining.size === 0) state.roomActivated.delete(String(appointmentId));
}

// About to be in `appointmentId`'s room: leave every other appointment room first, so a previous call's events can
// no longer reach this socket. Returns the ids left.
function leaveOtherAppointmentRooms(socket, appointmentId, state) {
  const others = appointmentRoomsOf(socket).filter((id) => id !== String(appointmentId));
  for (const id of others) leaveAppointmentRoom(socket, id, state);
  return others;
}

module.exports = {
  PREFIX,
  appointmentRoomName,
  appointmentIdOfRoom,
  appointmentRoomsOf,
  withAppointmentId,
  rebuildAfterRecovery,
  leaveAppointmentRoom,
  leaveOtherAppointmentRooms,
};
