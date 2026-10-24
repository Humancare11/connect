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
- connect-mobile: **not started, waiting for Satish's OK** on the base branch (`main` was chosen; its 4 local commits are listed for him first). The pre-existing `pubspec.yaml` change stays out of any commit.
- **Follow-up (not now, as decided):** make the web, mobile and doctor clients ignore call events whose `appointmentId` is not the call they are in. The server now tags every call event, and no longer sends them across calls, so this is a second line of defence.

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

## 7. Needs Satish's decision

Answered in the follow-up round: 1 (testing confirmation: no, Undo toast), 2 (retire admin/all: done), 3 (mobile fix: waiting on his OK for the base branch), 4 (client use of appointmentId: later, listed as a follow-up above), 5 (doctor app: checklist and doc update done), 6 (two-decimal fees: done). Still open:

7. **Overview counts vs the All tab** differ by design (the overview counts regular appointments only, minus testing); as agreed earlier, left that way.
8. **No automatic refunds** on cancel (as agreed); the warning names Stripe or PayPal.
9. **Optional `isTesting` backfill:** not run, not needed. Your call whether to run it later.
10. **Remove the 410 stubs** after one release (they are in `routes/categoryConsultation.js`, `routes/appointments.js` and `middleware/retiredEndpoint.js`).
11. **Pre-existing changes in the two sibling repos** that are not mine: a modified `connect-mobile/pubspec.yaml` and an untracked `doctorapp/doctor-app.html`; both are left out of every commit.

## 8. Confirmations

- **Nothing was merged or deployed.** The `admin` branch of this repo is pushed and has a pull request into `uat` (not merged), at Satish's request. The sibling repos have nothing pushed.
- **Atlas and any production database, server or secret were not touched.** Every test and browser run used `mongodb-memory-server`; the repo's browser harness refuses to start unless its database address is local.
- **doctorapp:** a new local `admin` branch with one docs commit (`589b8fd`); `doctor-app.html` untouched. **connect-mobile:** no branch or commit yet (waiting for Satish's OK); `pubspec.yaml` untouched.
