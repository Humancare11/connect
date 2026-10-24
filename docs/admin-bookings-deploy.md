# Admin Appointments merge: deploy notes

Branch `admin` (cut from `uat`). Nothing here has been pushed, merged or deployed.
What it does: Appointments and Category consultations are one list in the admin dashboard
(`/api/admin/bookings`), with assign / alternate / confirm / auto-complete / cancel / testing actions, bulk actions,
a call lock (only a **confirmed** booking opens the video room), and a socket recovery fix.

## 1. Deploy order

1. **Backend and web together, in one release.** They depend on each other:
   - The server call lock (`utils/appointmentRoomAccess.js`) denies joining any booking that is not `confirmed`.
   - The web patient Appointments page (`pages/user/Appointments.jsx`) no longer shows Assigned bookings under
     Confirmed or with a Join button. If the server ships without the web change, patients see Join on an Assigned
     booking and are refused; if the web ships without the server, nothing is enforced.
   - The new admin page calls `/api/admin/bookings*`, which only the new backend has. The old admin pages are gone,
     so the old backend cannot serve the new frontend either.
   - Backend order inside the release: start the new backend, then publish the web build.
2. **doctorapp: no release needed; retest it against the new backend before or right after the deploy**
   (it already shows Join only for `confirmed`). The things to retest are in section 4, "Doctor app".
3. **connect-mobile: the assigned-join fix in the next mobile release.** It is written: branch `admin` in the connect-mobile repo, one commit (`68733f5`, only `lib/screens/appointments_screen.dart`), based on `origin/main` (`6539e7f`), **not pushed**. Details in `docs/mobile-next-task-assigned-join.md`.
   Until then a mobile patient sees "Join" on an Assigned booking and, on tapping it, reads the server's message:
   "Your doctor hasn't confirmed this appointment yet. You can join once it's confirmed." Nothing breaks.
4. The 410 Gone endpoints stay (see "When to remove the 410 stubs" below).

### When to remove the 410 stubs

Every hit on a retired endpoint is logged as one `[retired-endpoint]` line (method, path without query, caller role,
`X-Client-Platform` and `X-App-Version` when an app sent them, and the replacement). **Remove the stubs
(`middleware/retiredEndpoint.js` and its uses in `routes/categoryConsultation.js` and `routes/appointments.js`, plus
`tests/retiredEndpoints.test.js`) only when both are true:** the next connect-mobile and doctor app releases are live, **and**
the logs show no `[retired-endpoint]` hits for 2 weeks in a row. Search the logs for `[retired-endpoint]`; a hit with an
`appVersion` tells you which app build still calls it.

No database migration is required. New fields all have defaults and read as empty when missing.

## 2. The `isTesting` backfill: never run (the script stays in the repo)

`backend/scripts/backfillBookingAdminFields.js` sets `isTesting: false` on bookings that have no `isTesting` field.
It is optional: every filter uses `isTesting: { $ne: true }`, so a document without the field counts as "not testing".
It only changes documents that lack the field, never a `true` or `false`, and re-running it changes nothing.

Read-only counts to run first (mongosh, against the database you intend to touch; this changes nothing):

```js
db.appointments.countDocuments({ isTesting: { $exists: false } })
db.categoryconsultations.countDocuments({ isTesting: { $exists: false } })
```

The script has `node scripts/backfillBookingAdminFields.js --dry-run`, which prints the same two counts.
Decision: **the backfill is never run.** The code uses `$ne: true` everywhere, so it is not needed; the script is kept in the repo only for reference.

## 3. Rollback

| Part | Rollback |
|---|---|
| Backend (call lock, admin bookings API, socket fix, 410 routes) | Redeploy the previous backend build. No data change to undo: the new fields (`isTesting`, `originalDoctorId/Name`, `cancelReason/By/At`, `confirmedBy/At`, `assignedBy` on category bookings, `testingMarkedBy/At`) are additive and ignored by the old code. |
| Web (new Appointments page, patient Appointments tab fix, redirects) | Redeploy the previous web build. **Roll back backend and web together**: the old web calls the old admin endpoints, which the new backend answers with 410. |
| Call lock only | In `server.js`, `canSocketAccessAppointment` calls `decideAppointmentAccess`; the one rule is `if (status !== "confirmed") return { reason: "not_confirmed" }` in `utils/appointmentRoomAccess.js`. Removing that line restores "any participant of a non-ended booking may join". Also roll the web patient tab fix back with it. |
| Socket fix | Redeploy the previous backend. The change is server-side and additive (an `appointmentId` field on call events, plus leave-old-room-on-join and a rebuild after recovery), so mixed versions work. |
| Data written by the new actions | Cancelled bookings: set `status` back by hand if a cancel was a mistake (nothing is refunded or deleted). Deleted category consultations (super admin Delete) are gone for good; there is no undo. `isTesting` can be flipped back from the Appointments page. |
| connect-mobile fix | Ship the previous mobile build; behavior is as in "Deploy order" step 3. |

## 4. Smoke test on uat after deploy

Admin (use an admin and a super admin):

- [ ] Appointments opens on **Upcoming**; the tabs are All, Upcoming, Assigned, Pending, Confirmed, Complete, Cancelled, Testing, each with a count; counts do not change when you type in the search.
- [ ] A category consultation and a regular appointment both appear in **All**, and the Category column says which category.
- [ ] "Hide testing" removes testing bookings from All and the tab counts; the Testing tab still lists them.
- [ ] Old URLs redirect: `/admin-dashboard/category-consultations` opens Appointments (All tab); `/admin-dashboard/category-consultations/<id>` and `/admin-dashboard/appointments/<id>/assign` open that booking. The sidebar has one Appointments item.
- [ ] **Assign doctor** on an Upcoming booking: it becomes **Assigned** (not Confirmed); the doctor and patient get one email each; the video call does **not** open yet.
- [ ] A Next Available category booking asks for a time when assigning.
- [ ] **Confirm** on an Assigned row: it becomes Confirmed; the doctor gets an email, the patient a push; the call now opens for both.
- [ ] **Alternate doctor** on a Confirmed booking: it returns to Assigned, the old doctor is told and removed from the call; "Go back to <original>" restores the first doctor.
- [ ] **Cancel** asks for one of the five reasons; a paid booking shows "Refund it in Stripe/PayPal"; the doctor gets an email; the patient a push.
- [ ] **Auto complete** asks first; works on Assigned/Confirmed, is disabled on others.
- [ ] A **testing** booking: every action above sends no email and no push.
- [ ] Select page, then Auto complete and Cancel on a mixed selection (some Complete): a result list shows done / skipped (with the reason); the list and counts refresh.
- [ ] Two admins on the same booking: the second action says "This booking was already updated, refreshing".
- [ ] The booking's View page: a super admin sees **Delete** on a category consultation (with a confirmation), an ordinary admin does not; a regular appointment has no Delete.
- [ ] User profile > consultations: a category consultation link opens its booking page.
- [ ] Overview counts exclude testing bookings.
- [ ] Old endpoints answer 410 with a pointer (`PUT /api/appointments/<id>/change-doctor`, `GET /api/appointments/admin/all`, the admin `/api/category-consultation` routes).
- [ ] Mark testing / Unmark testing run at once and show a toast with **Undo**; Undo restores exactly what changed. Fees show two decimals.

Patient web:

- [ ] Appointments: an Assigned booking is under **Pending** ("Awaiting doctor confirmation"), no Join link; a Confirmed one is under Confirmed with Join.
- [ ] Joining a Confirmed booking's call works; trying the call URL of an Assigned booking shows "Your doctor hasn't confirmed this appointment yet."

Doctor web and **doctor app** (retest against the new backend):

- [ ] Confirm button on an Assigned booking works and records the doctor as confirmer.
- [ ] Join only on Confirmed; a call starts and both sides see video.
- [ ] Reconnect: switch network (Wi-Fi to mobile data) during a call, it recovers; end the call and start another one on the same device, the old call's "participant left" does not appear in the new call.
- [ ] An admin cancelling or completing a booking during a call shows the closed banner and ends the call.

## 5. Commits on `admin` since `uat` (oldest first)

```
583f19f9 Add appointments reference design
e791d52c Step 2: add testing, alternate-doctor and cancel fields to both booking models
77ecd570 Step 3: unified admin bookings list with server-side counts and pagination
0523c970 Step 4: assign, alternate, revert and confirm actions on the unified bookings list
74efa4b4 Step 5: cancel with reason, mark/unmark testing, overview counts skip testing
44f57914 Step 6: bulk auto-complete, cancel and mark/unmark testing; single auto-complete
22687366 Call lock: only a confirmed booking opens the call room; web patient shows Assigned as pending
745d4058 Step 1 (frontend): unified Appointments list page
91b1339b Step 2 (backend): admin confirm records who and when and tells the doctor; alternate always ends Assigned
24ad603a Step 2 (frontend): row actions on the Appointments list
a93ed3d9 Gateway on list rows; a doctor's own confirm records confirmedBy (role doctor)
e43c4d39 Admin teal for the Appointments confirm dialogs; the refund reminder names the gateway
461ebc88 Keep the Appointments browser check in the repo (frontend/tests/e2e/adminAppointments)
0ff240c4 Step 3: selection menu and bulk actions on the Appointments list
c4afef04 Step 4: retire the old category/assign endpoints (410), remove the old pages, redirects, super-admin Delete
aaac0563 Step 5: socket recovery fix; every appointment call event carries appointmentId
ec650fdf Step 6: full browser check of the Appointments page
```

```
88f28c6b Step 7: deploy notes and final report for the admin Appointments merge
728cced2 Testing Undo toast, two-decimal fees, retire GET /appointments/admin/all (410)
f28ac2ac Report: follow-up round (testing Undo, admin/all retired, two-decimal fees, doctorapp docs) and the open decisions
a1effa68 Report: the PR still has to be opened (no gh CLI available)
```

Later commits (the 410 hit logging, the docs updates) are on the branch; use `git log uat..admin --oneline` for the exact list. Sibling repos (local branches, not pushed): doctorapp `admin` `589b8fd` (docs), connect-mobile `admin` `68733f5` (one file).
