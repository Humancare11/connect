# Changelog

All notable changes to the HumanCare Connect app are recorded here.
Newest release is on top. Each release is what went from `uat` into `main`.

Sections used: **Added**, **Changed**, **Fixed**, **Removed**, **Security**, **Deployment notes**, **Known issues**.

---

## [Unreleased]

_Nothing yet._

---

## [v2026.11.15] - 2026-11-15

### Added
- **Document signatures for doctors.** Doctors can upload or draw their signature, and sign prescriptions and medical certificates with it.
  - The signature appears on the prescription/certificate PDF and slip view.
  - The "Sign this …" checkbox is unchecked by default, so the doctor chooses each time.
  - Each signed document keeps its own private copy of the signature, along with who signed it and when.
- **New "Doctor's Note & Sick Notes" page** at `/doctors-note-sick-notes`, with its own SEO entry.
- **Medical reports without a patient account.** Admins can now type in patient details by hand when creating a medical report for someone who has no account.
- **Support tickets as conversations.** Patients and doctors can reply back and forth on a ticket in a thread.
  - Tickets have categories.
  - Admins can close tickets.
  - Timestamps show in both the user's and the admin's timezone.
  - Admins get an email alert for new ticket activity.
  - New "My Support Tickets" screen for patients.
- **Live chat improvements**
  - Notification sound on new messages, for both the website widget and the admin console.
  - Files sent in chat show as bubbles with thumbnails and Open / Download buttons.
  - The message box grows as you type, and there is a new greeter bubble.
- **Live chat price report** script for admins (`scripts/liveChatPriceReport.js`).

### Changed
- **Header and home page redesigned**, including a new Help dropdown in the header.
- **Medical reports** now use the new HCC template with a template-only form. The PDF has a larger header and footer logo.
- **Medical Reports list (admin)** is simplified. The patient and status columns were removed.
- **Prescriptions and medical certificates are final once issued.** They can no longer be edited after creation.
- **Live chat prices** are now quoted only from the Super Admin pricing, in the visitor's currency.
  - When pricing or services are changed in admin, live chat picks up the new prices straight away.
  - Every price change is recorded in an audit log.
- **Assign Doctor page (admin)** has better search, and shows the doctor's email under their name.
- **Live chat file errors** now give clearer messages when a file can't be stored.
- **Medical record retention clean-up** now also deletes the stored signature copies of the records it removes.

### Fixed
- Blog posts can no longer use the `doctors-note-sick-notes` URL, which would have clashed with the new page.
- Removed leftover live chat styles from the old greeter that were no longer used.

### Removed
- **Service Areas page.** `/service-areas` now returns a 404. No redirect was added (on purpose). The URL stays reserved, so a blog post can't reuse it.
- The Service Areas link in the footer.

### Security
- Doctor email, phone and country code from the approved doctors list (`/api/doctors/approved`) are now shown to admins only. Public visitors no longer receive them.
- Signature copies are stored privately, one per document.
- Rate limits added on signature upload and on live chat file links.
- Live chat file downloads use short-lived signed links.
- The site's Content Security Policy no longer allows `api.fontshare.com`. Fonts are now self-hosted.

### Deployment notes
- **Environment variables (production)**
  - `MULTI_CURRENCY_ENABLED`: set it to enable multi-currency prices in live chat. If it is missing, everything shows in USD.
  - `MEDICAL_REPORT_LOGO_PATH` (optional): if it is missing, the app uses the bundled logo, then the invoice logo, then no logo (with a warning in the logs).
- **Database / schema.** No migration scripts are needed, because existing records keep working through defaults.
  - `MedicalReport.patientId` is now optional, and a `patientName` field was added.
  - `Prescription` and `MedicalCertificate` gain signature fields (`signatureKey`, `signedAt`, `signedBy`) and are write-once. Any script, or any manual edit in Atlas, that updates these records after creation will now fail.
  - `Ticket` and `UserTicket` gain `messages`, `closedAt`, `closedBy` and `userTimezone`. `Ticket` also gains `category` (default `other`).
- **Storage.** The app's S3 credentials must be allowed to copy and delete signature objects.
- **No dependency, lock file, CI/CD or Docker changes.**

### Known issues
- The search taxonomy plan test fails. It also fails on the previous release, so it was not caused by this release. Regenerating the plan needs a decision on which database to read, and is deferred to a separate task.
- The meta description of the Doctor's Note & Sick Notes page is short (84 characters). This is an SEO warning only.
