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

## 2. Step 3 in brief

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
Not on the list but noticed: `GET /api/appointments/admin/all` now has no callers anywhere (the old page used it). Left in place, see decisions.

## 4. Commits (oldest first)

See `docs/admin-bookings-deploy.md` section 5 for the full list with one line each (17 commits plus the docs commit).

## 5. Test results (final)

| Suite | Result |
|---|---|
| Backend (`npm test`) | 2037 of 2038 pass. The one failure is the known, unrelated `searchTaxonomy/applyPreflight` "plan integrity" check (fails identically on a clean `uat`). |
| Frontend (`node --test` of `src/**/*.test.mjs` and `tests/*.test.mjs`) | 240 of 240 pass |
| Browser harness (`npm run test:e2e:appointments`) | 24 of 24 pass (real Chromium, real page, real API code, in-memory MongoDB, notifications recorded not sent) |
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

## 7. Needs Satish's decision

1. **Confirmation for Mark/Unmark testing.** They currently run immediately (as the reference does). Add a confirm? (Needs a business call.)
2. **`GET /api/appointments/admin/all`** has no callers any more. Retire it (410) in the same release, or keep it? Left as is.
3. **connect-mobile fix** (`lib/screens/appointments_screen.dart:110-113` and `:129`, see `docs/mobile-next-task-assigned-join.md`): not done (read-only repo). Until released, mobile patients see Join on an Assigned booking and get the clear refusal message.
4. **Client use of `appointmentId`:** the server now tags call events, but the web, mobile and doctor clients do not yet use it to ignore events for another call. Not needed for the fix (the server no longer sends them cross-call) but is a cheap second line of defence. Needs client changes, so not done.
5. **Doctor app retest** against the new backend before release (the checklist is in the deploy notes). `doctorapp/docs/video/COMPATIBILITY.md` row 7 ("pending/assigned allowed") is out of date; I did not edit that repo.
6. **Fee format:** the reference shows two decimals always ($99.00); the page shows $99 for whole dollars and $12.50 when it has cents.
7. **Overview counts vs the All tab** differ by design (the overview counts regular appointments only, minus testing); as agreed earlier, left that way.
8. **No automatic refunds** on cancel (as agreed); the warning names Stripe or PayPal.
9. **Optional `isTesting` backfill:** not run, not needed. Your call whether to run it later.
10. **Remove the 410 stubs** after one release (they are in `routes/categoryConsultation.js`, `routes/appointments.js` and `middleware/retiredEndpoint.js`).
11. **Pre-existing changes in the two read-only repos** that are not mine (see section 8): a modified `connect-mobile/pubspec.yaml` and an untracked `doctorapp/doctor-app.html`.

## 8. Confirmations

- **Nothing was pushed, merged, rebased onto `uat`, or deployed.** All work is on the local `admin` branch.
- **Atlas and any production database, server or secret were not touched.** The only `MONGO_URI` in `backend/.env` is Atlas and was never loaded; every test and browser run used `mongodb-memory-server`. The repo's browser harness refuses to start unless its database address is local.
- **connect-mobile/ and doctorapp/ were only read.** `git status` (read-only, no optional locks) at the end:
  - `connect-mobile`: ` M pubspec.yaml` (a change that was already there; I never edited that repo). Last commit `6596b69`.
  - `doctorapp`: `?? doctor-app.html` (untracked, already there). Last commit `8bd0246`.
- `connect` working tree: clean apart from this report once committed.
