# connect-mobile next task: stop showing Join for Assigned bookings

Status: **not started**. Do not change connect-mobile until this is scheduled.

## Why

The server now lets someone into an appointment call room only when the booking
is `confirmed` (reason `not_confirmed`, text "Your doctor hasn't confirmed this
appointment yet. You can join once it's confirmed."). An admin assignment now
leaves a booking in `assigned` until the doctor (or an admin on their behalf)
confirms it.

connect-mobile's patient app treats `assigned` + a doctor as `confirmed`, so it
shows such a booking under the Confirmed tab with a Join button. With the server
lock, that Join taps through to the "Access Denied" screen. The web patient page
had the same mapping and was fixed in the same change as the server lock.

## What to change (all in `lib/screens/appointments_screen.dart`)

| Line | What | Change |
|---|---|---|
| 110-113 | `Appointment.displayStatus`: `if (status == 'assigned' && hasAssignedDoctor) return 'confirmed';` | Remove the mapping. `displayStatus` becomes `status` (or delete the getter and use `status`). |
| 129 | `toVideoCallPayload`: `'status': displayStatus` | Pass the real `status`. Today this is what makes the call screen think an Assigned booking is confirmed (`video_call_controller.dart:398`, `canJoinConsultation => appt?['status'] == 'confirmed'`). |

These already follow `displayStatus`, so they need no edit once it is the real
status: 353 (`_tabForStatus`), 368-377 (`_pending`, which already lists
`assigned`), 379-380 (`_confirmed`), 382-384 (`_completed`), 989
(`canJoinVideoCall`). Line 991-994 already shows "Doctor assigned. Awaiting
confirmation." for an `assigned` booking in the Pending tab.

## What already works

- `video_call_screen.dart:362-372` shows the "Appointment Pending / awaiting the
  doctor's confirmation" gate for `assigned` (and `pending`, `requested`,
  `upcoming`) once the payload carries the real status.
- `_handleRoomDenied` (`video_call_controller.dart:3148-3160`) shows the server's
  `msg` text on the Access Denied screen (`apptError = msg ?? '...'`), so the new
  `not_confirmed` message appears with no mobile change. Until the mobile fix
  ships, a patient on an old build sees Join, taps it, and reads that message.

## Test

- An Assigned booking with a doctor appears under Pending with no Join button.
- A Confirmed booking still appears under Confirmed with Join, and the call opens.
- Deep link (`_tabForStatus`) for an Assigned booking opens the Pending tab.

## Also outdated after the server change

`doctorapp/docs/video/COMPATIBILITY.md` row 7 ("Server join gate: participant +
not complete/cancelled; **pending/assigned allowed**") is no longer true:
only `confirmed` is allowed now.
