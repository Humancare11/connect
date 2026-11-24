# UAT -> main merge report

Generated 2026-11-15. Read-only analysis: `git fetch`, `git log`, `git diff`, `git merge-tree --write-tree`. Nothing was merged or changed.

## 1. Branches
`origin/main` and `origin/uat` both exist (branch is named `uat`). Local `uat` matches `origin/uat` (3fb5fb0c).

## 2. Commits that will come into main (17 non-merge commits, plus merge commits)
| Commit | Author | Date | Message |
|---|---|---|---|
| 3fb5fb0c | Humancare11 | 2026-11-15 | Assign doctor page: better search, admin-only email under the doctor name |
| 9835b76b | Humancare11 | 2026-11-15 | "Sign this ..." checkbox is unchecked by default |
| 6756721e | Humancare11 | 2026-11-15 | Document signatures (frontend) |
| fca64dee | Humancare11 | 2026-11-15 | Document signatures (backend) |
| bc47c631 | Humancare11 | 2026-11-15 | Medical report PDF: larger header/footer logo |
| a6dbd5c8 | Humancare11 | 2026-11-15 | solve errors |
| 437a413f | Humancare11 | 2026-11-15 | done mr |
| 23ce2fae | Humancare11 | 2026-11-15 | Medical report list: remove patient/status columns, details, void and status filter |
| de084120 | Humancare11 | 2026-11-15 | Medical report: HCC template, manual patient details, template-only form |
| 96990642 | unknown | 2026-11-14 | Doctor or Sick Note Service |
| e38d1358 | unknown | 2026-11-14 | Header and home page changes |
| d1a5376f | Humancare11 | 2026-11-11 | livechat: AI quotes prices only from Super Admin pricing, in the visitor's currency |
| ae67c837 | Humancare11 | 2026-11-10 | livechat: sound always on; clearer file storage errors |
| d95f013c | Humancare11 | 2026-11-10 | livechat: file bubbles with thumbnails, Open/Download |
| 06136552 | Humancare11 | 2026-11-10 | livechat: auto-growing message box, greeter pill |
| 6228a14d | Humancare11 | 2026-11-10 | livechat: notification sound for widget and admin console |
| 51acabeb | Humancare11 | 2026-11-10 | support: threaded tickets, admin close, dual-timezone timestamps, admin email alerts |

## 3. Reverse check (main commits not in uat)
None. `origin/uat..origin/main` is empty, so uat is strictly ahead of main and the merge can fast-forward.

## 4. File summary
171 files changed, +10,515 / -4,378.
- Deleted (4): `frontend/src/pages/Serviceareas.jsx`, `Serviceareas.css`, `pages/doctors/RaiseTicket.css`, `pages/user/RaiseTicket.css`
- Renamed: none
- Added: about 60 files (new backend utils/models/tests, signature components, support components, live chat helpers, docs/translation)
- Modified: the rest

## 5. Changes grouped by feature
1. **Document signatures (Rx and medical certificates).** Doctors can upload or draw a signature, and sign prescriptions and certificates. Each issued document gets its own private S3 copy of the signature (`signatureKey`, `signedAt`, `signedBy`). Prescriptions and certificates become write-once (`lockUpdates.js`). The retention job also deletes the S3 signature copies. New rate limiter on signature upload. Affects the doctor dashboard, patient records, the PDF and slip views, and `backend/models`.
2. **Medical report (HCC template).** Template-only form, manual patient details (reports with no patient account, `patientId` is now optional), a list view without the patient/status columns, a void action and a status filter, and a larger PDF logo (`assets/medical-report-logo.png`). Affects the admin Medical Reports page and the PDF generator.
3. **Support tickets.** Threaded conversations, categories, admin close, timestamps in both timezones, and admin email alerts. Both `Ticket` and `UserTicket` schemas gain fields. New patient "My Support Tickets" UI. The separate `RaiseTicket.css` files are removed.
4. **Live chat.** Notification sounds, file bubbles with thumbnails and a signed-URL endpoint (new rate limiter), an auto-growing composer, and prices quoted only from Super Admin pricing in the visitor's currency (`livePrices.js`). Pricing and service routes now invalidate the live price cache and write a price audit log. Adds the script `scripts/liveChatPriceReport.js`.
5. **New "Doctor's Note & Sick Notes" page.** New route `/doctors-note-sick-notes` and SEO entry. The old `/service-areas` page, route and SEO entry are removed. Header and home page restyled (Header help dropdown, many CSS files).
6. **Assign Doctor admin page.** Better search. The `/approved` doctors endpoint now exposes email, phone and country code to admins only.
7. **Docs / translation spike.** `docs/translation/*`, including two zip files and a UAT package. This is not app code.
8. **Tests.** About 25 new or updated backend and frontend tests.

## 6. RISKY
- **Schema changes (no migration scripts).** All are additive except one relaxation:
  - `MedicalReport.patientId` changes from required to optional, and `patientName` is added.
  - `Prescription` and `MedicalCertificate` gain signature fields and become write-once. Any code path anywhere that updates these documents will now throw "cannot be changed once issued".
  - `Ticket` and `UserTicket` gain `messages`, `closedAt`, `closedBy` and `userTimezone`. `Ticket` also gains `category` (default "other"). Existing rows are fine because of the defaults.
- **Env / config.** New env vars read: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `MEDICAL_REPORT_LOGO_PATH`, `MULTI_CURRENCY_ENABLED`. Check that they are set on production. No secrets or UAT URLs were found in app code. The test files use dummy values (`sk_test_dummy_not_used`, `test-secret`), which are harmless. `docs/translation/.../.env.example` is an example file only.
- **API / contract changes.**
  - `/api/doctors/approved` now returns `email`, `phoneNumber` and `countryCode` to admins only and strips them for anonymous callers. Check that no public page relied on these fields.
  - `/service-areas` is removed, so it will 404 or fall through. `service-areas` stays in the reserved blog slugs. The Footer link is commented out, not deleted.
  - New endpoints for signatures, ticket threads and live chat file URLs.
- **Dependencies.** `frontend/package.json` only gains two npm test scripts. No dependency or lock file changes. Backend `package.json` is untouched.
- **CI/CD / Docker / deploy.** No changes. `docs/translation/.../nginx-step0.conf.snippet` is documentation only.
- **`frontend/index.html` is rewritten (reindented).** The CSP also changes: `https://api.fontshare.com` is removed from `style-src` and `font-src`. That is safe only if Fontshare is no longer used (the fonts are self-hosted). Confirm that no page still loads from it.
- **Debug and leftover code.**
  - `console.log` appears only in `scripts/liveChatPriceReport.js` (a CLI script) and in a `[pricing-audit]` audit log line. That is intentional.
  - Commented-out Footer link block.
  - Commit messages "solve errors" and "done mr" are vague.
  - `frontend/src/seo/routes.js` has an entry that does not match the surrounding formatting.
  - Two binary zip files (about 135 KB) in `docs/`, plus UAT test HTML and an `.env.example` under `docs/`. They will land in main and are probably not wanted there.
- **Retention.** Medical-record deletion now also deletes S3 objects, and failures are logged only. This is a behaviour change in a destructive job.

## 7. Conflicts
`git merge-tree --write-tree origin/main origin/uat` is available and printed a clean tree hash (4e8e063c765a2ce8c02db9895301a401aea9d9b8) with no conflict output. No conflicts. Main has no commits that uat lacks.

## 8. Final report
- **Totals:** 17 non-merge commits, 171 files (+10,515 / -4,378).
- **Features:** document signatures, HCC medical report, support ticket threads, live chat upgrades and price source, Doctor's Note page (replacing Service Areas), Assign Doctor search, translation docs.
- **Before merging, check / test:**
  1. Signing flow end to end (upload, draw, sign Rx and certificate, PDF shows the signature, S3 copy is private).
  2. Anything that edits Prescriptions or Certificates after creation, because they are now write-once.
  3. The medical report create, list and void flow, including unlinked patients.
  4. Support ticket reply, close and email alerts.
  5. Live chat in each currency, file upload and download, and sound.
  6. The Fontshare CSP removal across the site, `/service-areas` links, and the new `/doctors-note-sick-notes` route.
  7. Production env vars (`AZURE_SPEECH_*`, `MEDICAL_REPORT_LOGO_PATH`, `MULTI_CURRENCY_ENABLED`) and S3 permissions for the signature copies.
  8. Run the backend and frontend test suites. I did not run them. Your notes mention 3 known failing tests on another branch.
- **Recommendation:** Technically ready (clean, fast-forwardable, no dependency or CI changes), but merge only after the UAT sign-off on the checks above. Consider removing `docs/translation/step0-uat/*.zip` and the UAT package from the merge. Items 2, 6 and 7 are the most likely to cause production surprises.

## 9. Verification (follow-up, read-only on origin/uat)

### 9.1 Write-once risk (Prescription / MedicalCertificate)
Searched all non-test backend code for `findByIdAndUpdate`, `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `bulkWrite`, `.save()` and `$set` on these two models. **No hit.** Only two files import the models:
- `controllers/medicalController.js`: `Prescription.create`, `MedicalCertificate.create`, `find` (read) and the signature streaming helpers (read). `create` is a new document, so `lockAgainstUpdates` allows it.
- `jobs/retentionJobs.js`: `find` and `deleteMany`. Deletes are deliberately not blocked.

`utils/documentSignature.js`, `routes/doctorSignature.js` and `utils/signatureUpload.js` only touch the signature key on a new document at creation time. Nothing that is currently in the code will throw. **Remaining risk:** only future code, or ad-hoc scripts run against the database through Mongoose. I did not scan the raw MongoDB shell or Atlas, which bypass Mongoose.

### 9.2 Optional MedicalReport.patientId (null cases)
| Location | Null patientId behaviour |
|---|---|
| `routes/adminMedicalReports.js` create (l.71-135) | Handled on purpose. Only `generated` reports may omit it, and a patient name is required. `patient?._id` is safe. |
| Admin list (l.150-180) | `.populate("patientId")` with a null id is fine. Search also matches `patientName`. |
| `serializeReport` (`utils/medicalReportService.js` l.154-172) | Handled. It returns `{ name: patientName, linked: false }`. |
| `recordActivity(... patientId: report.patientId)` in get/download/void/delete (l.217-297) | Passes `undefined`/null. It does not crash if `recordActivity` accepts an empty patientId, but the audit entry has no patient. I did not find a patientId check in `utils/activityLogger.js`, so it is probably fine. Worth a manual check. |
| `controllers/medicalController.js` l.456 (patient's own list) | Filters by `patientId: req.user.id`, so unlinked reports are never shown. Correct. |
| Patient notification email (`notify` in create) | `medicalReportService.js` l.125 only sets `patientId` when linked. For unlinked reports there is nobody to email. I did not read the notify code path in full, so test "unlinked + notify=true". |

No definite crash found. The ones to test by hand are the audit log entry and the notify flag.

### 9.3 /service-areas references
Remaining on uat:
- `backend/data/reservedBlogSlugs.js:141`, slug `service-areas` kept (harmless; keeps a blog from using that slug).
- `frontend/src/components/Footer.jsx:131`, commented-out link.
- Docs only: `frontend/CHANGED_PAGES.md`, `KT_DOCUMENT_WEB.md`, `UI_AUDIT_REPORT*.md`.

**No redirect exists.** `frontend/src/seo/redirects.js`, `deploy/nginx-uat.conf.example` (generated from `render.yaml`), `generate-sitemap.mjs` and `render.yaml` contain no `service-areas` entry. The sitemap is built from `seo/routes.js`, where the entry was removed, so it drops out of the sitemap. Result: an old `/service-areas` URL will serve the SPA fallback, and the app should show its 404/not-found view (not a 301). Because the page was indexed, consider adding a 301 in `seo/redirects.js` (and `render.yaml`) to a suitable page.

### 9.4 Fontshare
No code references remain. Matches are only in `frontend/src/fonts.css` (a comment: Satoshi is now self-hosted) and in documentation (`KT_DOCUMENT_WEB.md`, `SEO_CODE_REVIEW.md`, `UI_AUDIT_REPORT*.md`). No html, css, jsx or js file loads from `api.fontshare.com`, so removing it from the CSP is safe.

### 9.5 Env vars
| Var | Where read | If missing |
|---|---|---|
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | **Only in `docs/translation/speech-token.js`** (a documentation sample, not wired into the backend). | Nothing in the app reads them. **This corrects section 6**: they are not needed for this merge. The sample returns HTTP 500 without the key and defaults the region to `eastus`. |
| `MEDICAL_REPORT_LOGO_PATH` | `backend/utils/medicalReportPdf.js` l.10 | Fallback chain: the bundled `assets/medical-report-logo.png` (added in this merge), then the invoice logo. If all fail, a warning is logged and the PDF renders without a logo. No crash. |
| `MULTI_CURRENCY_ENABLED` | `backend/utils/currencyConfig.js` l.66 | Off by default. Everything is USD (live chat and checkout), and EUR/GBP/INR stay disabled. Silent disable, no crash. Already existed before this merge; live chat now follows it. |

### 9.6 Commits a6dbd5c8 and 437a413f
- **a6dbd5c8 "solve errors"** (3 files, +5/-832): deletes `pages/Serviceareas.jsx` and `.css`, and edits `seo/routes.js` (removes the `/service-areas` SEO entry, adds `/doctors-note-sick-notes`). It finishes the removal of the Service Areas page.
- **437a413f "done mr"** (29 files, +2105/-128):
  - Adds all of `docs/translation/*` (progress reports, an Azure speech-token sample, two zip files, a UAT package).
  - Reformats and edits `frontend/index.html`, including the CSP change that drops Fontshare.
  - Makes small UI edits: Footer (comments out the service-areas link), `header.css`, `index.css`, live chat `QuickOptions.jsx`, `LiveChatShell.jsx`, `livechat-ui.css`, booking and payment form CSS.
  
  Mixed bag: documentation plus unrelated UI tweaks under a vague message.

### 9.7 Tests (run in the existing checkout; it is already on `uat` at origin/uat with a clean tree, so no branch change and no worktree was needed)
Commands: `cd backend && node --test "tests/**/*.test.js"` and `cd frontend && node --test tests/*.test.mjs src/pages/admin/appointments/*.test.mjs`. I did not run the `test:e2e*` browser scripts.

| Suite | Total | Pass | Fail |
|---|---|---|---|
| Backend | 3169 | 3162 | **3** |
| Frontend (unit) | 413 | 412 | **1** |

Failures:
1. **`reserved slugs cover every static single-segment route in App.jsx`** (backend). **Real regression from this merge.** `doctors-note-sick-notes` is a new route but is missing from `backend/data/reservedBlogSlugs.js`. Without it a Super Admin could create a blog with that slug and clash with the page. **Fix before merging** (add the slug to that list).
2. **`plan integrity: current plan passes; tampering and stale sources fail`** (backend, `searchTaxonomy/applyPreflight.test.js`). `Source "appRoutes" changed since the plan was generated`. The new route changed `appRoutes`, so the search taxonomy plan is stale. It needs to be regenerated, or confirmed as expected. This is probably the same root cause as the first failure.
3. **`live chat: doctor greeter and round button`** / **`the old H logo launcher and the greeting bubble are gone`** (backend `liveChatWidgetStatic` and the frontend equivalent `liveChatLauncherStatic.test.mjs:186`). The CSS in `LiveChatWidget.css` still contains `.lcw-greet` selectors (`body:has(.sp-hero) .lcw-greet`) which the test says should be gone. This is a stale CSS block or an outdated assertion. Cosmetic, but the tests are red.

My earlier note about "3 known failing tests" was from a different branch. These 4 failures (3 backend, 1 frontend, with two of them the same live chat assertion) are on uat itself.

### Updated recommendation
**Not ready yet.** Fix first: add `doctors-note-sick-notes` to `reservedBlogSlugs.js`, regenerate or confirm the search taxonomy plan, and resolve the stale `.lcw-greet` CSS or test. Also decide on a 301 for `/service-areas`, and consider dropping the docs zip files. The write-once change looks safe, and fonts and env vars are fine.

## 10. Fixes (branch `fix/pre-main-merge`, from origin/uat; not pushed)

### 10.1 Failure classification
Correction to section 9: the backend had **3 failures + 4 skipped** (the "7" was 3162 passed of 3169, the other 4 are `B2B` tests marked skip in the code). The frontend had 1 failure. That is 4 failures in total. I compared against `origin/main` (a36a2197) in a temporary worktree (removed afterwards; `node_modules` copied from the main checkout, since dependencies are unchanged).

| Test | File | uat | main | Class |
|---|---|---|---|---|
| reserved slugs cover every static single-segment route in App.jsx | backend/tests/blogs.test.js:45 | fail | pass | **New in uat** (fixed) |
| plan integrity: current plan passes; tampering and stale sources fail | backend/tests/searchTaxonomy/applyPreflight.test.js:160 | fail | fail | Pre-existing (plan already stale on main) |
| the old H logo launcher and the greeting bubble are gone | backend/tests/liveChatWidgetStatic.test.js:133 | fail | fail | Pre-existing (fixed anyway) |
| the old launcher, greeting bubble and logo are gone | frontend/tests/liveChatLauncherStatic.test.mjs:186 | fail | fail | Pre-existing (fixed anyway) |

Main totals: backend 3057 tests, 3051 pass, 2 fail, 4 skipped. Frontend 371 tests, 370 pass, 1 fail.

### 10.2 Commits on `fix/pre-main-merge`
| Hash | Summary |
|---|---|
| 2454639f | Add `doctors-note-sick-notes` to `backend/data/reservedBlogSlugs.js` (alphabetical, after `doctors-note`). |
| cb90010f | Remove the dead `.lcw-greet` CSS (two media-query blocks in `LiveChatWidget.css`). |
| 89ab5a1e | Service Areas cleanup: remove the commented-out Footer link, regenerate `docs/booking-source-coverage.md` with `npm run report:booking-source` (drops `/service-areas`, adds `/doctors-note-sick-notes`), fix the row in `frontend/KT_DOCUMENT_WEB.md`. |
| f409c551 | Remove `docs/translation/step0-uat/` (both zip files and the UAT package folder). Other docs untouched. |
| 82e2a1b7 | Reformat the `/doctors-note-sick-notes` entry in `frontend/src/seo/routes.js` to the one-line JSON style used by the rest. |

**Item 2 (search taxonomy plan): NOT done, needs your decision.** The generator is `node backend/scripts/searchTaxonomy/prepareSearchTaxonomyMigration.js`. It is read-only (a write guard blocks every DB write), but it connects to the MongoDB in `backend/.env` (`MONGO_URI`, an Atlas cluster) and writes the live categories, specialties and conditions of that database into `searchTaxonomyMigrationPlan.json`. The plan is also bound to a named database in its `--apply` confirmation (`humancare_uat:<hash>`). Regenerating from the wrong cluster would put wrong data in the plan, and it would fail on main for the same reason, so it is not caused by this merge. I did not hand-edit it. Tell me which database to read (or to skip it) and I will run it. Until then this one test keeps failing; it fails on main too.

Notes:
- **`.lcw-greet` choice:** I removed the CSS rather than update the tests. No `.jsx` or `.js` file uses the class (the greeter is now `DoctorGreeter` with `lcw-gr-*` classes), and the tests correctly say the old bubble is gone.
- **Left on purpose:** `service-areas` stays in `reservedBlogSlugs.js`. Historical audit snapshots (`CHANGED_PAGES.md`, `UI_AUDIT_REPORT*.md`) still mention the old page; they are point-in-time reports, so I did not edit them.
- `check-seo` passes; it warns that the new page's meta description is only 84 characters (content, not changed).

### 10.3 What `/service-areas` returns
After this change, with the production/Render setup: **a real HTTP 404**. `render.yaml` states there is deliberately no catch-all rewrite, and there is no `/service-areas` rewrite or prerendered file once the route is removed, so Render serves `dist/404.html` with status 404. The UAT nginx example behaves the same ("anything else -> 404.html with status 404"). Not a 200 with a not-found page. Caveat: the SPA itself shows its NotFound component for unknown routes, but only after you get past the server, which here returns 404 first. I did not run a live request; this is from the config.

### 10.4 Final test results on `fix/pre-main-merge`
| Suite | Total | Pass | Fail | Skipped |
|---|---|---|---|---|
| Backend | 3169 | 3163 | 2 | 4 |
| Frontend unit | 413 | 413 | 0 | 0 |

Remaining backend failures:
1. `applyPreflight.test.js` plan integrity: **pre-existing** (also fails on main).
2. `secureLinks.test.js` "a real download is counted": **flaky, not a code failure**. It failed once in the full run and then passed 3 of 3 times when run alone (35/35), and it passed in the earlier full runs on uat and main. It is timing sensitive under load. This is a difference from your condition "every remaining failure must also fail on main": strictly, this one did not fail on main in my run, but it is a flake and not related to these changes.

### 10.5 Commands to push and merge (run only when you approve; nothing has been pushed)
```
# 1. publish the fix branch
git push -u origin fix/pre-main-merge

# 2. merge it into uat (fast-forward; the branch is based on origin/uat)
git fetch origin
git checkout uat
git pull --ff-only origin uat
git merge --ff-only fix/pre-main-merge
git push origin uat

# 3. later: merge uat into main (after re-checking the report)
git checkout main
git pull --ff-only origin main
git merge --ff-only uat
git push origin main
```
`fix/pre-main-merge` currently tracks `origin/uat` as its upstream, so `git push -u origin fix/pre-main-merge` sets its upstream to the new remote branch. Do not run a bare `git push` on it before that.
