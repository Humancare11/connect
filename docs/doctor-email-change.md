# Doctor email change (OTP-verified): readiness notes

Status: implemented and covered by automated tests. **Not yet verified in a browser, with a real SMTP provider, or against the production database.**

## What it does

A signed-in doctor replaces their login email from the Edit Profile step (`DoctorEnrollments.jsx`, "Change Email").

1. `POST /api/doctor/profile/email-change/request` sends a 6-digit OTP to the **new** address. `Doctor.email` is unchanged.
2. `POST /api/doctor/profile/email-change/verify` checks the OTP and swaps `Doctor.email` (the field the login route reads), updates the enrollment's copy of the email, revokes all of that doctor's sessions, and the UI sends the doctor to `/doctor-login`.

Protections: OTP stored hashed, 5 minute expiry, single use, 5 wrong attempts per OTP, 60 s resend cooldown, per-doctor rate limits (5 requests and 10 verifies per 15 min), doctor id taken only from the verified token, duplicate addresses refused with a generic message. Profile saves and admin approval can no longer write `email`.

Code: `backend/utils/doctorEmailChange.js`, `backend/models/EmailChangeChallenge.js`, `backend/models/DoctorEmailChangeAudit.js`, `backend/utils/doctorEmailChangeAudit.js`, routes in `backend/routes/doctorAuth.js`.

## Known risk: two writes without a transaction

The swap does two writes: `Doctor.email` first, then `Enrollment.email`.

- Concurrent requests are safe. The first write is a compare-and-set on the old email and the unique index rejects a second claimant. The rollback (used if the enrollment write throws) only restores the email if it still equals the new one, so it cannot undo a later legitimate change.
- The remaining gap is a process crash or lost connection **between** the two writes. Login would use the new email while the enrollment still shows the old one, and some profile/admin views prefer the enrollment email.

Topology: the local `backend/.env` points at an Atlas replica-set cluster (UAT, per `docs/admin-bookings-final-report.md`). **Production topology has not been confirmed**, so the strategy was not changed.

Recommendation once production is confirmed:

- **Replica set / Atlas (transactions supported):** wrap the two updates in one `session.withTransaction(...)`, keeping the existing compare-and-set and unique index. This removes the crash window. The tests already stub the failure path, so they can be adapted.
- **Standalone MongoDB (no transactions):** keep the current approach and close the gap on the read side by showing `Doctor.email` (via the populated `doctorId`) wherever profile and admin views currently prefer `Enrollment.email`. Optionally add a small reconciliation check that reports doctors whose two emails differ.

## Audit trail and who can read it

Collection: `doctoremailchangeaudits` (model `DoctorEmailChangeAudit`). One row per event: `doctorId`, `action` (`request` / `verify` / `complete`), `outcome`, a fixed `reason` category, `correlationId` (the request's `X-Request-Id`) and `createdAt`. It stores no OTPs, hashes, passwords, tokens, email addresses or IPs.

There is deliberately **no HTTP endpoint** for it. Authorized personnel read it directly in the database:

```js
// mongosh: history for one doctor, newest first
db.doctoremailchangeaudits.find({ doctorId: ObjectId("<doctor _id>") }).sort({ createdAt: -1 })
// recent failures
db.doctoremailchangeaudits.find({ outcome: "failure" }).sort({ createdAt: -1 }).limit(50)
```

Access control is therefore the database's: give support/security staff a **read-only** database role scoped to this collection and keep the application's own user as the only writer. Match a row to server logs with `correlationId`. Open decisions: whether to add a retention (TTL) rule, and whether an admin screen is ever wanted (it would need the existing admin/superadmin guards).

## Manual browser test (not yet performed)

Use UAT/local, never production. You need two mailboxes you control (A = current, B = new) and SMTP configured (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_USER`).

Setup: start the backend and `npm run dev` in `frontend`. Register a new test doctor with mailbox A through the normal sign-up (this also proves the existing OTP email works), then open `/doctor-dashboard/enrollments` step 1.

| # | Check | Expected |
|---|-------|----------|
| 1 | Click **Change Email** | New-email box and Send OTP appear; the current email stays read-only |
| 2 | Enter `not-an-email` | "Enter a valid email address." and nothing is sent |
| 3 | Enter mailbox A (current) | Rejected: must differ from the current email |
| 4 | Enter an address another doctor uses | Generic "can't be used" message, no hint about the other account |
| 5 | Enter mailbox B, Send OTP | "An OTP has been sent to your new email address..."; the code arrives in B, none in A |
| 6 | Click Resend OTP at once | Cooldown message (about 60 s); no second email |
| 7 | Enter a wrong code, Verify | "Invalid OTP"; email unchanged. After 5 wrong tries the OTP is locked |
| 8 | Wait 5+ minutes, enter the right code | "OTP has expired"; request a new one |
| 9 | **Before step 10**, copy `doctorToken` and `doctorRefreshToken` from dev tools (Application > Cookies) | Needed for check 12 |
| 10 | Enter the correct code, Verify | Success message, then redirect to `/doctor-login` |
| 11 | Log in with B and the old password | Succeeds; same doctor (same doctor id and enrollment data) |
| 12 | Log in with A | Refused. Using the saved tokens, `GET /api/doctor/me` with `Authorization: Bearer <access>` and `POST /api/auth/refresh` with `Bearer <refresh>` and body `{"role":"doctor"}` both return 401 |
| 13 | Profile page and, as admin, Manage Doctors / the doctor's profile | Both show B |
| 14 | "Forgot password" with A, then with B | Same on-screen message for both; only B receives a reset OTP |
| 15 | Database: `doctoremailchangeaudits` | Rows for request, failed verify and complete; no code or address in any row |

Record the result of each row and any console errors before signing off.

## Stale plan-integrity test (unrelated to this feature)

`tests/searchTaxonomy/applyPreflight.test.js` ("plan integrity") fails with `Source "appRoutes" changed since the plan was generated`. The plan (`backend/scripts/searchTaxonomy/searchTaxonomyMigrationPlan.json`) records a hash of `frontend/src/App.jsx`, which was committed afterwards (`f25d2166`, Appointment entries). Only the `appRoutes` source is stale.

Do not edit the plan by hand or loosen the check. The project's own workflow is to regenerate it: from `backend/`, `node scripts/searchTaxonomy/prepareSearchTaxonomyMigration.js [--plan-out <file>]`. It is dry-run only (a driver-level guard blocks every write) but it **reads the live taxonomy from the configured MongoDB**, so the regenerated plan reflects whichever database `MONGO_URI` points to and its operations may change. Whoever owns the search-taxonomy migration should run it against the intended database, review the plan diff, and commit it.
