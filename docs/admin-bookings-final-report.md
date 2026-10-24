# Admin Appointments merge: final report

Branch `admin` (from `uat`). Written after the overnight autonomous run. Nothing pushed, merged or deployed.
Deploy order, rollback and the smoke checklist are in `docs/admin-bookings-deploy.md`.

## 1. Status

| Step | Status | Notes |
|---|---|---|
| 3 (selection menu and bulk bar, commit `0ff240c4`) | Done | Summary in section 2. |
| 4 (cleanup) | Done | Old endpoints retired with 410, old pages/routes/sidebar/styles removed, redirects, profile link, super-admin Delete. `c4afef04`. |
| 5 (socket recovery fix) | Done (server side) | `aaac0563`. A client follow-up is optional, see decisions. |
| 6 (full browser check) | Done | `ec650fdf`. 24 of 24. |
| 7 (deploy notes) | Done | `docs/admin-bookings-deploy.md`. |

### Follow-up round (after the first report)

Satish's answers to the first report, done in commit `728cced2` and the sibling repos:

- Mark/Unmark testing now needs no confirmation: a toast with an **Undo** that reverses only the bookings that really changed (one already in the target state is left alone). (`728cced2`)
- `GET /api/appointments/admin/all` retired with 410, handler deleted. (`728cced2`)
- Fees always show two decimals ($99.00). (`728cced2`)
- doctorapp (own `admin` branch, commit `589b8fd`, nothing pushed): row 7, B1 and R1 of `docs/video/COMPATIBILITY.md` updated; new `docs/video/ADMIN_BACKEND_RETEST.md` manual checklist. `doctor-app.html` untouched.
- connect-mobile: branch `admin` created **from `origin/main`** (`6539e7f`, after a fetch) in a separate worktree, so the local-only camera-switch commits on local `main` and the modified `pubspec.yaml` were not involved. One commit, `68733f5`: `appointments_screen.dart` only (`displayStatus` is now the real status, so Assigned stays under Pending with no Join; the unused `hasAssignedDoctor` helper is gone). `flutter analyze` on the file: no issues. Not pushed. The worktree was removed; the branch is kept.
- `retiredEndpoint` now logs every hit (`[retired-endpoint]`: method, path, role, `X-Client-Platform`, `X-App-Version`); the rule for removing the stubs is in the deploy notes.
- **Follow-ups (not now, as decided):**
  1. Make the web, mobile and doctor clients ignore call events whose `appointmentId` is not the call they are in. The server now tags every call event, and no longer sends them across calls, so this is a second line of defence.
  2. Make the dashboard overview match the All tab (today the overview counts regular appointments only, minus testing).

### Round 3 (changes after Satish's local test)

1. **Copy booking ID:** clicking the ID copies the full id, toast "Booking ID copied", copy cursor and tooltip; if the clipboard is refused the full id is selected and the toast says to press Ctrl+C.
2. **Assign doctor** moved to the Doctor column (under "Not assigned") and out of Actions. The server now assigns **any open booking with no doctor, whatever its status**, and treats a reference to a deleted doctor as "no doctor". The disabled-button bug (e.g. `…1459ABBD`, `…50E43207`) was the old rule: Assign was only allowed on Upcoming/Pending.
3. **Admin Confirm removed** completely (button, `POST /:id/confirm`, handler, its email, tests, docs, doctor-app checklist item M-ADMIN-3). Only the doctor confirms; the doctor's own confirm still records `confirmedBy` (role doctor).
4. **Cancel is super admin only**: hidden for admins (row and bulk bar); `POST /:id/cancel` and bulk cancel answer 403 for anyone else.
5. **Reactivate** on Complete rows (admins and super admins): confirmation, Complete -> Confirmed through the shared reopen logic, records `reactivatedBy {id,name,email}` and `reactivatedAt`, 409 if it is no longer Complete (or the doctor is busy then, `slot_taken`), doctor and patient told, nothing for testing bookings.
6. **Assigned by** no longer breaks an email mid-word: one line, ellipsis, full value on hover (cards on a phone show it all).
7. **Assigned rows with a doctor but no recorded assigner** show "—" with the tooltip "Assigned before tracking started" (for other statuses the tooltip also covers bookings made directly with the doctor).

**The two counts (not run: the only configured database is Atlas, and the local MongoDB on this machine has no booking data).** Read-only queries to run against the dev database yourself:

```js
// 2. Assigned (or any open status) with no doctor, or a doctor that no longer exists
db.appointments.countDocuments({ status: { $nin: ["complete", "completed", "cancelled"] }, $or: [{ doctorId: null }, { doctorId: { $exists: false } }] })
db.categoryconsultations.countDocuments({ status: { $in: ["Assigned", "Confirmed"] }, $or: [{ assignedDoctorId: null }, { assignedDoctorId: { $exists: false } }] })
// ...and Assigned ones whose doctor was deleted (dangling reference): list their doctor ids, then look them up
db.appointments.find({ status: "assigned", doctorId: { $ne: null } }, { doctorId: 1 })   // check each id exists in db.doctors
db.categoryconsultations.find({ status: "Assigned", assignedDoctorId: { $ne: null } }, { assignedDoctorId: 1 }) // check in db.enrollments

// 7. Assigned with a doctor but no recorded assigner
db.appointments.countDocuments({ status: "assigned", doctorId: { $ne: null }, $or: [{ "assignedBy.name": { $in: [null, ""] } }, { "assignedBy.name": { $exists: false } }], "assignedBy.email": { $in: [null, ""] } })
db.categoryconsultations.countDocuments({ status: "Assigned", assignedDoctorId: { $ne: null }, "assignedBy.name": { $in: [null, ""] }, "assignedBy.email": { $in: [null, ""] } })
```

**How bookings got "Assigned with no doctor" (from the code, not from data):** (a) the old Category Consultations `PATCH /:id/status` accepted "Assigned" with no doctor, which is how a status can be set without ever picking one; (b) a doctor's account or enrollment deleted later leaves the booking pointing at nothing (the list shows "Not assigned" because the reference no longer resolves, while the stored status stays Assigned); (c) the old appointment assign paths set the status and the doctor in one write, so they were not a cause. **Assigned with a doctor but no assigner** is data from before the `assignedBy` field existed on category consultations (it was added in this branch), and any booking whose doctor was set by the patient at booking time.



Commit `0ff240c4` (16 files). Header checkbox opens a menu (Select this page / Select one by one / Clear selection / Exit selection, only what applies); row tick boxes while selecting; a navy bar "N selected on this page" with Auto complete, Cancel (one required reason; paid bookings counted by gateway), Mark/Unmark testing, Done; no bulk Confirm; a result list (done / skipped with reason / failed) then the list and counts reload.
Tests at that commit: backend relevant suites 188 pass; frontend 228 of 229 (one live-chat flake, passes alone); browser 22 of 22.
**The mixed-selection scenario was run**: 7 selected (one deleted underneath), auto complete gave "3 done, 4 skipped", the skips being Pending, Upcoming, Complete and "no longer exists", each with its reason; testing bookings sent nothing. Also run: bulk cancel with paid counts, mark/unmark testing, a failed request that keeps the ticks, the phone-width layout.

## 3. Callers found in step 4, and what was retired

Searched `connect/backend`, `connect/frontend/src`, `connect-mobile/lib`, `doctorapp/lib` (read-only for the last two):

| Endpoint | Callers found | Result |
|---|---|---|
| `PUT /api/appointments/:id/change-doctor` | `frontend/src/pages/admin/AdminAssignDoctor.jsx` only (deleted). None in connect-mobile or doctorapp. | Retired: 410, handler deleted |
| `PATCH /api/category-consultation/:id/assign-doctor` | `AdminAssignCategoryDoctor.jsx` only (deleted). None in mobile/doctorapp. | Retired: 410, handler deleted |
| `GET /api/category-consultation` (`getAllCategoryConsultations`) | `AdminCategoryConsultations.jsx` only (deleted). None elsewhere. | Retired: 410, handler deleted |
| `GET /:id`, `PATCH /:id/status`, `DELETE /:id` on `/api/category-consultation` (admin) | `AdminCategoryConsultationDetails.jsx` and the old list (deleted). None elsewhere. | Retired: 410, handlers deleted |

The 410 answers `{ msg, code: "endpoint_retired", use }` after the normal admin auth (an anonymous caller still gets 401). Kept untouched: `POST /api/category-consultation` (patient booking), `GET /mine`, `GET /doctor/mine`. Because no mobile or doctor app calls any retired endpoint, nothing had to be kept.
Not on the list but noticed: `GET /api/appointments/admin/all` had no callers anywhere (the old page used it). Retired with 410 in the follow-up round (`728cced2`).

## 4. Commits (oldest first)

See `docs/admin-bookings-deploy.md` section 5 for the full list with one line each (17 commits plus the docs commit).

## 5. Test results (final)

| Suite | Result |
|---|---|
| Backend (`npm test`) | 2035 of 2038 pass. The 3 failures are unrelated and fail identically on a clean `uat` (checked in a separate worktree): `searchTaxonomy/applyPreflight` "plan integrity", and two date-dependent live-chat tests in `liveChatTrash.test.js` (a day-window check that began failing when the calendar date moved on; they passed in this branch's earlier runs). |
| Frontend (`node --test` of `src/**/*.test.mjs` and `tests/*.test.mjs`) | 236 of 237 pass; the one failure is a live-chat static test that fails only under full-run load and passes 10 of 10 alone |
| Browser harness (`npm run test:e2e:appointments`) | 25 of 25 pass (real Chromium, real page, real API code, in-memory MongoDB, notifications recorded not sent; includes the Undo toast) |
| Call lock tests (`appointmentRoomAccess.test.js`) | 15 of 15, re-run after the socket change |
| Socket tests (`appointmentRoomState.test.js`) | 11 of 11 |
| CSS prefix check | passes |

A few unrelated tests (a live-chat static test, an OpenAI-SDK test) failed once under the load of a full run and passed every time when run alone; treated as flakes.

## 6. Socket fix: details and evidence

Files: `backend/utils/appointmentRoomState.js` (new), `backend/server.js` (wiring).
- **Rebuild after recovery:** in `io.on("connection")`, `if (socket.recovered) rebuildAfterRecovery(socket, roomState)` repopulates `socketRooms` from the rooms Socket.IO restored, so `leave-appointment-room` works without the client re-joining.
- **One call at a time:** `join-appointment-room` first leaves any other `appointment_*` room (both in the recovered "already in this room" branch and the normal join). The old room's peer is told `participant-left` (tagged with that call) and the old room's "activated" flag is cleared if it is now empty. `leave-appointment-room` uses the same helper.
- **`appointmentId` added to every call event payload:** `participant-left`, `peer-joined` (4 sites), `peer-socket-up` (2), `peer-socket-down`, `video-offer`, `video-answer`, `ice-candidate`, `ice-restart-request`, `camera-state`, `request-peer-rebuild`, `appointment-access-revoked` (2). Added only; no field renamed or removed.
- **Compatibility, checked read-only:** every Dart handler in connect-mobile and doctorapp for these events is declared `(dynamic _)`, so the extra payload is accepted (`ice-restart-request` and `request-peer-rebuild` previously had none); the web handlers ignore extra arguments.
- **Evidence (tests with a real Socket.IO server and a real forced reconnect with state recovery, asserted `socket.recovered === true`):** after recovery `socketRooms` is rebuilt and a leave actually removes the socket from the room and tells the peer (a control test with the rebuild undone shows the leave being ignored, as before); call A, recovered reconnect, then call B on the same socket: the socket ends in B's room only, A's peer is told once (tagged A), a late `participant-left` sent into A reaches neither the socket nor B's other participant, signaling for A is no longer relayed and B's is; re-joining the same room keeps it and leaves nothing; and a source check that every call-event emit carries the id.
- **Behavior change to know about:** moving to a second call without an explicit leave now tells the first call's peer `participant-left` (it previously never learned, which is the leak). Existing clients treat it as the normal "peer left" event.

## 7. Decisions (all answered)

1. Mark/Unmark testing: no confirmation; a toast with **Undo** (done).
2. `GET /api/appointments/admin/all`: retired with 410 (done).
3. connect-mobile fix: done on branch `admin` from `origin/main`, not pushed (see section 1).
4. Client use of `appointmentId`: later; listed as follow-up 1.
5. Doctor app: checklist and doc update done on doctorapp's `admin` branch (`589b8fd`), not pushed.
6. Fees show two decimals (done).
7. Overview stays regular appointments minus testing; "make the overview match the All tab" is follow-up 2.
8. Refunds stay manual (cancel never refunds; the warning names Stripe or PayPal).
9. The `isTesting` backfill is never run (`$ne: true` makes it unnecessary); the script stays in the repo.
10. The 410 stubs stay, and log every hit. Remove them only after the next mobile and doctor app releases are live **and** the logs show no hits for 2 weeks (rule in the deploy notes).
11. `connect-mobile/pubspec.yaml` (modified) and `doctorapp/doctor-app.html` (untracked) are Satish's and stay exactly as they are, uncommitted.

## 8. Confirmations

- **Nothing was merged or deployed.** The `admin` branch of this repo is pushed to origin at Satish's request; Satish opens the pull request into `uat` himself (https://github.com/Humancare11/connect/compare/uat...admin?expand=1, with this report as the description). The connect-mobile and doctorapp `admin` branches are local only.
- **Atlas and any production database, server or secret were not touched.** Every test and browser run used `mongodb-memory-server`; the repo's browser harness refuses to start unless its database address is local.
- **doctorapp:** local `admin` branch, one docs commit (`589b8fd`); `doctor-app.html` untouched. **connect-mobile:** local `admin` branch, one commit (`68733f5`, one file); the checked-out branch and `pubspec.yaml` were never touched.
