# CHANGED_PAGES.md

Compares `main` with `preview/issue-plus-fonts` (`git diff main..preview/issue-plus-fonts`): 505 changed/added files under `frontend/src` (plus 72 deleted dead files that no page uses). Generated from the code, not from a browser: for each route in `App.jsx` I followed its imports (layouts, components, CSS) and listed which changed files it pulls in. Not committed.

**Legend, "what changed":** fonts = Satoshi/Inter font work from the `fonts` branch (also contains other design edits made on that branch, e.g. the new Categories hero); accessibility = main landmark, skip link, headings, aria, focus rings, autocomplete, form-error wiring; modal = Modal/ConfirmDialog/focus trap/Escape; toast = `alert()` replaced; breadcrumb; link fix; wording; hover = hover lifts only on real hover devices; states = retry button / error boundary / loading spinner; other = tokens, transitions, mobile text size, touch hit areas, image attributes, CSS cleanup.

## 0. Changes that affect ALL pages (shared files)

Shared files changed: `App.css`, `App.jsx`, `AppProviders.jsx`, `components/Header.jsx`, `components/footer.css`, `components/header.css`, `components/ui/Button.css`, `components/ui/Button.jsx`, `components/ui/ConfirmDialog.jsx`, `components/ui/ErrorBoundary.css`, `components/ui/ErrorBoundary.jsx`, `components/ui/HasMainContext.js`, `components/ui/Modal.css`, `components/ui/Modal.jsx`, `components/ui/RouteFallback.css`, `components/ui/RouteFallback.jsx`, `components/ui/Toast.css`, `components/ui/Toast.jsx`, `hooks/useModalA11y.js`, `index.css`, `seo/redirects.js`, `seo/routes.js`, `seo/schema.js`.

| Effect on every page | Phasea |
|---|---|
| Fonts: `index.css` font tokens, header/footer fonts (fonts) | fonts branch |
| One `<main id="main-content">` around the page and a "Skip to content" link (accessibility) | P2 |
| 404 page for unknown URLs, redirects (old URLs), page titles for login pages | P1, links fix |
| Error boundary around every page, delayed loading spinner, toast container, confirm dialog host (`App.jsx`, `AppProviders.jsx`) | P3, P6A |
| Header: mobile menu is a keyboard-trapped dialog, larger touch targets, hover lifts only on real hover (accessibility, modal, hover) | P2, P5, P6A |
| Footer: bigger tap areas on links | P5 |
| Global CSS: reduced-motion rules, tokens (`--z-*`, `--container-*`, `--duration-*`), `.sr-only` | P3, P5 |

Needs login: no. Every URL below also inherits these.

## 1. Page table (grouped by area; identical pages are grouped in one row)

"URL" shows up to 6 examples per row; every URL is listed in Appendix A. Phases: P1 routing/404; P2 accessibility; P3 toasts/errors/loading; P4 images/assets; P5 mobile/hover/tokens; P6A modals/confirm; P6B Button/headings/wording; P7 breadcrumbs/cleanup; links fix; fonts branch.

### Public

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/eye-ear-bone/orthopedics/arthritis`<br>`/online-second-medical-opinion/cancer-second-opinion`<br>`/chronic-care/cardiology/chest-pain`<br>`/chronic-kidney-disease`<br>`/online-second-medical-opinion/complex-diagnosis-review`<br>`/chronic-care/gastroenterology/fatty-liver`<br>… +215 more (221 pages in total) | accessibility, breadcrumb, fonts, hover, link fix, mobile text/touch, tokens/transitions | P1 routing/404, P2 accessibility, P5 mobile/hover/tokens, P7 breadcrumbs/cleanup, fonts branch | no | - |
| `/child-and-family-care/adolescent-medicine`<br>`/child-and-family-care/pediatrics`<br>`/chronic-care/cardiology`<br>`/chronic-care/gastroenterology`<br>`/chronic-care/neurology`<br>`/chronic-care/pulmonology`<br>… +20 more (26 pages in total) | accessibility, breadcrumb, fonts, hover, image attrs, mobile text/touch, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P7 breadcrumbs/cleanup, fonts branch | no | - |
| `/contact-us`<br>`/service-areas`<br>`/refund-cancellation-policy`<br>`/provider-terms-of-service`<br>`/privacy-policy`<br>`/terms-of-service`<br>… +6 more (12 pages in total) | accessibility, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens | no | - |
| `/blogs`<br>`/how-does-a-telemedicine-appointment-work`<br>`/online-doctor-consultation`<br>`/telemedicine-vs-in-person-doctor-visits`<br>`/telemedicine-cost-usa`<br>`/are-online-doctors-real-doctors`<br>… +1 more (7 pages in total) | accessibility, fonts, hover, image attrs, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, fonts branch | no | - |
| `/chronic-medication-management`<br>`/chronic-care-management`<br>`/online-prescription-refills`<br>`/service-sexual-health`<br>`/weight-loss-programs`<br>`/online-second-medical-opinion`<br>… +1 more (7 pages in total) | accessibility, fonts, hover, mobile text/touch, tokens/transitions, toast | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, fonts branch | no | - |
| `/conditions-treated-through-telemedicine`<br>`/top-telemedicine-platforms-providers`<br>`/is-telemedicine-safe`<br>`/uti-symptoms-causes-treatment-&-when-to-see-a-doctor`<br>`/migraine-vs-headache-symptoms-causes-differences-and-treatment-options`<br>`/telehealth-for-hypertension`<br>… +1 more (7 pages in total) | accessibility, fonts, hover, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens, fonts branch | no | - |
| `/child-and-family-care`<br>`/eye-ear-bone`<br>`/general-and-everyday-care`<br>`/mens-health`<br>`/mental-health` | fonts, hover, mobile text/touch, tokens/transitions | P5 mobile/hover/tokens, fonts branch | no | - |
| `/skin-and-hair-care`<br>`/travel-and-global-care`<br>`/women-health` | fonts, hover, link fix, mobile text/touch, tokens/transitions | P5 mobile/hover/tokens, fonts branch, links fix | no | - |
| `/weight-and-nutrition/weight-management`<br>`/weight-and-nutrition/lifestyle-medicine`<br>`/weight-and-nutrition/nutrition-and-dietetics` | accessibility, breadcrumb, fonts, hover, link fix, image attrs, mobile text/touch, tokens/transitions | P1 routing/404, P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P7 breadcrumbs/cleanup, fonts branch | no | - |
| `/ask-a-question`<br>`/profile` | only the shared changes in section 0 | - | no | - |
| `/doctors/10958-bo-gevers`<br>`/doctor/<doctor id> (redirects to /doctors/<slug>)` | hover, other, tokens/transitions | P3 toasts/errors/loading, P5 mobile/hover/tokens | no | - |
| `/what-is-telemedicine`<br>`/telemedicine-services` | accessibility, fonts, hover, link fix, image attrs, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, fonts branch, links fix | no | - |
| `/general-consultation`<br>`/lab-requisitions` | accessibility, fonts, hover, image attrs, mobile text/touch, tokens/transitions, toast | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, fonts branch | no | - |
| `/` | accessibility, fonts, hover, image attrs, mobile text/touch, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | no | - |
| `/medical-services` | accessibility, fonts, hover, image attrs, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, fonts branch | no | - |
| `/corporates` | accessibility, fonts, hover, modal, other, image attrs, mobile text/touch, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | no | - |
| `/categories` | accessibility, fonts, hover, link fix, other, mobile text/touch, tokens/transitions | P1 routing/404, P5 mobile/hover/tokens, fonts branch | no | - |
| `/specialties` | accessibility, fonts, hover, link fix, other, mobile text/touch, tokens/transitions | P1 routing/404, P2 accessibility, P5 mobile/hover/tokens, fonts branch, links fix | no | - |
| `/conditions` | accessibility, fonts, hover, link fix, other, mobile text/touch, tokens/transitions | P1 routing/404, P2 accessibility, P5 mobile/hover/tokens, fonts branch | no | - |
| `/chronic-care` | fonts, hover, mobile text/touch, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens, fonts branch | no | - |
| `/sexual-health` | fonts, hover, link fix, mobile text/touch, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens, fonts branch, links fix | no | - |
| `/weight-and-nutrition` | fonts, hover, link fix, mobile text/touch, tokens/transitions | P1 routing/404, P5 mobile/hover/tokens, fonts branch, links fix | no | - |
| `/primary-care-provider` | accessibility, fonts, hover, mobile text/touch, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens, fonts branch | no | - |
| `/about-us` | hover, image attrs, tokens/transitions | P4 images/assets, P5 mobile/hover/tokens | no | - |
| `/career` | accessibility, fonts, hover, image attrs, mobile text/touch, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, fonts branch | no | - |
| `/<slug of a published Super Admin blog> (any slug from /blogs); unknown slug = 404 page` | accessibility, fonts, hover, other, image attrs, tokens/transitions | P1 routing/404, P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, fonts branch | no | - |

### Auth

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/adminauth`<br>`/payment-admin-login`<br>`/employee-login` | accessibility, hover, mobile text/touch, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens | no | - |
| `/login` | accessibility, hover, image attrs, mobile text/touch, tokens/transitions, wording | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P6B Button/headings/wording, links fix | no | - |
| `/doctor-login` | accessibility, hover, mobile text/touch, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens, P6B Button/headings/wording | no | - |
| `/partner-login` | accessibility, hover, image attrs, mobile text/touch, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens | no | - |
| `/admin-auth` | only the shared changes in section 0 | - | no | - |

### Booking/payment

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/appointment-booking`<br>`/appointment-booking/chronic-care`<br>`/appointment-booking/chronic-care/cardiology` | accessibility, fonts, hover, image attrs, mobile text/touch, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, fonts branch | form: no (pay: needs a payment link) | - |
| `/appointment-booking/chronic-care/cardiology/chest-pain`<br>`/appointment-booking/category-confirm` | accessibility, fonts, hover, modal, image attrs, tokens/transitions, wording | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | form: no (pay: needs a payment link) | - |
| `/category-consultant`<br>`/service-consultant` | hover, mobile text/touch, tokens/transitions, toast | P3 toasts/errors/loading, P5 mobile/hover/tokens | form: no (pay: needs a payment link) | - |
| `/book-appointment` | accessibility, fonts, hover, tokens/transitions | P2 accessibility, P5 mobile/hover/tokens, fonts branch | form: no (pay: needs a payment link) | - |
| `/pay/<token from Payment Admin > Payment Links> (any text token shows the "not found" state)` | accessibility, fonts, tokens/transitions | P1 routing/404, P2 accessibility, P5 mobile/hover/tokens, fonts branch | form: no (pay: needs a payment link) | - |
| `/services-prices` | modal, image attrs, tokens/transitions | P4 images/assets, P5 mobile/hover/tokens, P6A modals/confirm | form: no (pay: needs a payment link) | - |
| `/appointment-booking/form` | only the shared changes in section 0 | - | form: no (pay: needs a payment link) | - |

### User

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/user/dashboard`<br>`/user/appointments`<br>`/user/favourite-doctors`<br>`/user/lab-appointments`<br>`/user/raise-ticket` | accessibility, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording | yes | patient (role user) |
| `/user/medical-questions` | only the shared changes in section 0 | - | yes | patient (role user) |
| `/user/profile-settings` | accessibility, fonts, hover, image attrs, new Button, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, P6B Button/headings/wording, fonts branch | yes | patient (role user) |
| `/user/change-password` | accessibility, fonts, hover, new Button, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording, fonts branch | yes | patient (role user) |
| `/user/my-records` | accessibility, fonts, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | yes | patient (role user) |
| `/user/payment-history` | accessibility, fonts, hover, tokens/transitions, states(retry/error/loading), toast | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording, fonts branch | yes | patient (role user) |

### Doctor

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/doctor-dashboard`<br>`/doctor-dashboard/patients/<patientId from Patients list>/prescription`<br>`/doctor-dashboard/messages`<br>`/doctor-dashboard/raise-ticket`<br>`/doctor-dashboard/analytics`<br>`/doctor-dashboard/settings` | accessibility, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/appointments`<br>`/doctor-dashboard/patients`<br>`/doctor-dashboard/notes` | accessibility, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/profile` | accessibility, hover, image attrs, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, P6B Button/headings/wording | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/doctor-profile-for-patients` | accessibility, hover, other, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/enrollments` | accessibility, image attrs | P2 accessibility, P4 images/assets | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/patients/<patientId>/prescriptions/<rxId> (open from a patient panel)` | accessibility, fonts, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/patients/<patientId>/certificates/<certId>` | accessibility, fonts, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording, fonts branch | yes | doctor (enrolled + approved) |
| `/doctor-dashboard/qna` | only the shared changes in section 0 | - | yes | doctor (enrolled + approved) |

### Admin

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/admin-dashboard/category-consultations/assign-doctor/<consultation id>`<br>`/admin-dashboard/partner-cases`<br>`/admin-dashboard/appointments`<br>`/admin-dashboard/category-consultations/<consultation id>`<br>`/admin-dashboard/appointments/<appointment id>`<br>`/admin-dashboard/appointments/<appointment id>/assign` | accessibility, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording | yes | admin (superadmin sees all) |
| `/admin-dashboard/email`<br>`/admin-dashboard/manage-users`<br>`/admin-dashboard/deletion-requests`<br>`/admin-dashboard/direct-video-consultation` | accessibility, fonts, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, fonts branch | yes | admin (superadmin sees all) |
| `/admin-dashboard/email/box/<mailbox id>/inbox`<br>`/admin-dashboard/email/inbox`<br>`/payment-admin`<br>`/admin-dashboard/qna` | only the shared changes in section 0 | - | yes | admin (superadmin sees all) / payment admin (or admin for /payment-admin pages) |
| `/admin-dashboard/email/settings/mail-ids`<br>`/admin-dashboard/our-doctors`<br>`/admin-dashboard/direct-video-consultation/calls`<br>`/admin-dashboard/direct-video-consultation/calls/<room id from Calls list>` | accessibility, fonts, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, fonts branch | yes | superadmin / admin (superadmin sees all) |
| `/payment-admin/payment-links`<br>`/payment-admin/payment-history`<br>`/admin-dashboard`<br>`/admin-dashboard/manage-doctors` | accessibility, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens | yes | payment admin (or admin for /payment-admin pages) / admin (superadmin sees all) |
| `/payment-admin/manual-invoices`<br>`/admin-dashboard/manual-invoices`<br>`/admin-dashboard/gop` | accessibility, fonts, hover, image attrs, tokens/transitions, states(retry/error/loading), toast | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, fonts branch | yes | payment admin (or admin for /payment-admin pages) / admin / payment admin |
| `/admin-dashboard/partner-cases/<case id>`<br>`/admin-dashboard/manage-users/<user id from Manage Users>` | accessibility, fonts, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | yes | admin (superadmin sees all) |
| `/admin-dashboard/email/mail/<message id from inbox>` | accessibility | P6B Button/headings/wording | yes | admin (superadmin sees all) |
| `/admin-dashboard/doctors/10958-bo-gevers` | accessibility, hover, other, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens | yes | admin (superadmin sees all) |
| `/admin-dashboard/doctor-profile/<doctor enrollment id from Manage Doctors>` | accessibility, hover, modal, image attrs, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, P6A modals/confirm | yes | admin (superadmin sees all) |
| `/admin-dashboard/category-consultations` | accessibility, hover, modal, tokens/transitions, states(retry/error/loading), toast | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording | yes | admin (superadmin sees all) |
| `/admin-dashboard/tickets` | accessibility, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm | yes | admin (superadmin sees all) |
| `/superadmin-dashboard` | accessibility, fonts, hover, modal, other, image attrs, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens, P6A modals/confirm, fonts branch | yes | superadmin |

### Employee

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/employee-dashboard`<br>`/employee-dashboard/assign-task` | accessibility, fonts, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, fonts branch | yes | employee admin |
| `/employee-dashboard/my-tasks`<br>`/employee-dashboard/my-tasks/<task id from My tasks>` | accessibility, fonts, hover, image attrs, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P4 images/assets, P5 mobile/hover/tokens, fonts branch | yes | employee admin |
| `/employee-dashboard/tasks` | only the shared changes in section 0 | - | yes | employee admin |

### Partner

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/partner-dashboard/cases`<br>`/partner-dashboard/billing` | accessibility, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording | yes | partner company login |
| `/partner-dashboard` | accessibility, fonts, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6B Button/headings/wording, fonts branch | yes | partner company login |
| `/partner-dashboard/submit-case` | accessibility, fonts, hover, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, fonts branch | yes | partner company login |
| `/partner-dashboard/cases/<case id from All cases>` | accessibility, fonts, hover, modal, tokens/transitions, states(retry/error/loading) | P2 accessibility, P3 toasts/errors/loading, P5 mobile/hover/tokens, P6A modals/confirm, P6B Button/headings/wording, fonts branch | yes | partner company login |

### Video call

| URL | What changed | Phase | Needs login | Test account role |
|---|---|---|---|---|
| `/video-call/<confirmed appointment id> (join from Appointments)` | hover, image attrs, tokens/transitions | P4 images/assets, P5 mobile/hover/tokens | yes | patient or doctor with a confirmed appointment |
| `/direct-video-call/<room id> (create under Admin > Direct video consultation)` | accessibility, hover, image attrs, tokens/transitions | P2 accessibility, P4 images/assets, P5 mobile/hover/tokens | yes | patient or doctor with a confirmed appointment |

## 2. Notes per area

- **public:** Condition and specialty pages (about 250 URLs) all share one change set: fonts, breadcrumb above the badge, 12px minimum text on phones, hover lifts, link fixes. Blog articles lost their own skip link and `<main>` (the shared one is used). The Home page also has the new search combobox, the reduced-motion guard on the entrance animation and the testimonials parallax.
- **auth:** Login pages: one visible h1 (the other form headings are h2), autocomplete, error messages linked to inputs, "Create Account" wording, visible focus on buttons/forgot link/country picker.
- **booking/payment:** Booking forms: the consent popup is now a proper dialog (Escape, focus trap), errors announced, retry button when categories fail to load. `/pay/:token` has the "Secure Payment" title and a hidden h1 while loading.
- **user:** User dashboard: the top-bar title is no longer a heading, every page has one h1, profile/password pages use the shared Button and a "Saving…" spinner, delete-account section/modal use the shared buttons, payment history has a Retry button and shows a toast instead of a popup.
- **doctor:** Doctor dashboard: hidden h1 on pages that had none, mark-as-completed / notes / certificate / patient panel are real dialogs, delete-note uses the confirm dialog, doctor profile has autocomplete.
- **admin:** Admin area: every `confirm()` is now the in-page confirm dialog (consultations, doctor profile delete, blogs, healthcare items, services, partner companies, users, deletion requests, direct video rooms, email composer discard); GOP and manual invoices show toasts; hidden h1 on pages without one; table-row keyboard access on partner cases.
- **employee:** Employee area: fonts, hover, keyboard-operable cards; layout main landmark with skip target.
- **partner:** Partner area: case table rows can be opened with Enter/Space, messages drawer is a dialog.
- **video call:** Only the hidden h1 ("Video consultation"), image attributes and shared CSS changed. The call UI itself was not touched.

Changed files that no route renders (dead or not mounted): `components/CookieBanner.*` (never mounted), `components/ui/Field.*` (new, not used yet), `data/searchIndex.js`, `pages/Register.jsx`, `pages/Findadoctor.css`, `pages/hero-new.css`, `pages/mdemo.css`, `pages/register.css`.

## 3. Dynamic routes: one real example each

| Route pattern | Example to open | Needs login / role |
|---|---|---|
| `/appointment-booking/:catSlug` | `/appointment-booking/chronic-care` | no |
| `/appointment-booking/:catSlug/:specSlug` | `/appointment-booking/chronic-care/cardiology` | no |
| `/appointment-booking/:category/:specialty/:condition` | `/appointment-booking/chronic-care/cardiology/chest-pain` | no |
| `/pay/:token` | `/pay/<token from Payment Admin > Payment Links> (any text token shows the "not found" state)` | no |
| `/doctors/:slug` | `/doctors/10958-bo-gevers` | no |
| `/doctor/:id` | `/doctor/<doctor id> (redirects to /doctors/<slug>)` | no |
| `/doctor-dashboard/patients/:patientId/prescription` | `/doctor-dashboard/patients/<patientId from Patients list>/prescription` | doctor (enrolled + approved) |
| `/doctor-dashboard/patients/:patientId/prescriptions/:rxId` | `/doctor-dashboard/patients/<patientId>/prescriptions/<rxId> (open from a patient panel)` | doctor (enrolled + approved) |
| `/doctor-dashboard/patients/:patientId/certificates/:certId` | `/doctor-dashboard/patients/<patientId>/certificates/<certId>` | doctor (enrolled + approved) |
| `/admin-dashboard/category-consultations/assign-doctor/:id` | `/admin-dashboard/category-consultations/assign-doctor/<consultation id>` | admin (superadmin sees all) |
| `/employee-dashboard/my-tasks/:taskId` | `/employee-dashboard/my-tasks/<task id from My tasks>` | employee admin |
| `/partner-dashboard/cases/:id` | `/partner-dashboard/cases/<case id from All cases>` | partner company login |
| `/admin-dashboard/partner-cases/:id` | `/admin-dashboard/partner-cases/<case id>` | admin (superadmin sees all) |
| `/admin-dashboard/email/mail/:messageId` | `/admin-dashboard/email/mail/<message id from inbox>` | admin (superadmin sees all) |
| `/admin-dashboard/email/box/:mailboxId/:folder` | `/admin-dashboard/email/box/<mailbox id>/inbox` | admin (superadmin sees all) |
| `/admin-dashboard/doctors/:slug` | `/admin-dashboard/doctors/10958-bo-gevers` | admin (superadmin sees all) |
| `/admin-dashboard/doctor-profile/:id` | `/admin-dashboard/doctor-profile/<doctor enrollment id from Manage Doctors>` | admin (superadmin sees all) |
| `/admin-dashboard/manage-users/:id` | `/admin-dashboard/manage-users/<user id from Manage Users>` | admin (superadmin sees all) |
| `/admin-dashboard/direct-video-consultation/calls/:roomId` | `/admin-dashboard/direct-video-consultation/calls/<room id from Calls list>` | admin (superadmin sees all) |
| `/admin-dashboard/category-consultations/:id` | `/admin-dashboard/category-consultations/<consultation id>` | admin (superadmin sees all) |
| `/admin-dashboard/appointments/:id` | `/admin-dashboard/appointments/<appointment id>` | admin (superadmin sees all) |
| `/admin-dashboard/appointments/:id/assign` | `/admin-dashboard/appointments/<appointment id>/assign` | admin (superadmin sees all) |
| `/video-call/:appointmentId` | `/video-call/<confirmed appointment id> (join from Appointments)` | patient or doctor with a confirmed appointment |
| `/direct-video-call/:roomId` | `/direct-video-call/<room id> (create under Admin > Direct video consultation)` | patient or doctor with a confirmed appointment |
| `/:slug` | `/<slug of a published Super Admin blog> (any slug from /blogs); unknown slug = 404 page` | no |

Real example data available in the repo: doctor profile slugs (prerender list in `dist/doctors/`) e.g. `10958-bo-gevers`, `12120-juan-andres-barboza-pena`; category/specialty/condition slugs `chronic-care` / `cardiology` / `chest-pain`. Everything else (appointment, task, case, room, user ids) comes from your database, so open the list page and click a row.

## 4. Pages to test first (20 highest risk)

1. `/login`: h1 swap between sign-in/sign-up, autocomplete, errors, OTP, wording, fonts, focus rings. Account: none.
2. `/doctor-login`: same as /login for doctors (register + login panels). Account: none.
3. `/`: fonts, search combobox, hero video, reduced-motion gsap, header/footer. Account: none.
4. `/appointment-booking/chronic-care/cardiology/chest-pain`: booking form: consent dialog, errors, date/time/notes, price. Account: patient (to finish booking).
5. `/appointment-booking`: h2 became h1, retry button, cards keyboard-operable. Account: none.
6. `/pay/<token>`: title, hidden h1, payment flow after the Button/CSS changes. Account: payment link.
7. `/user/profile-settings`: shared Button (visible change), delete-account modal, autocomplete, location selects. Account: patient.
8. `/user/change-password`: shared Button, per-field errors. Account: patient.
9. `/user/payment-history`: toast instead of popup, Retry button. Account: patient.
10. `/doctor-dashboard/appointments`: mark-as-completed dialog, stat cards keyboard-operable. Account: doctor.
11. `/doctor-dashboard/patients`: notes, certificate and patient-panel dialogs. Account: doctor.
12. `/doctor-dashboard/notes`: delete note uses the new confirm dialog. Account: doctor.
13. `/doctor-dashboard/patients/<patientId>/prescription (and the prescription preview/PDF)`: PDF generation, slip modal. Account: doctor.
14. `/admin-dashboard/manage-users`: delete / approve / reject deletion now go through the confirm dialog. Account: admin.
15. `/admin-dashboard/email`: composer discard dialog, Escape handling, fonts. Account: admin.
16. `/superadmin-dashboard`: two modals, no layout h1, tab pages. Account: superadmin.
17. `/payment-admin/manual-invoices and /admin-dashboard/gop`: toast on download error, invoice/GOP PDF look. Account: admin / payment admin.
18. `/categories and /chronic-care`: fonts-branch hero redesign plus mobile CTA/chat spacing. Account: none.
19. `/chronic-care/cardiology (any condition page)`: breadcrumb, fonts, 12px text on phone, price card. Account: none.
20. `/corporates`: reduced motion, carousels, Netaji popup, many hover rules. Account: none.

Also worth a quick look: `/what-is-telemedicine` (a blog whose own `<main>`/skip link were removed), `/zzz-not-a-page` (new 404), `/employee-dashboard/my-tasks`, `/partner-dashboard/cases` (keyboard rows), `/video-call/<id>` (only the hidden h1 changed).

## Appendix A: every route and its change set

| Area | URL | Changed (categories) |
|---|---|---|
| public | `/eye-ear-bone/orthopedics/arthritis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/online-second-medical-opinion/cancer-second-opinion` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology/chest-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-kidney-disease` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/online-second-medical-opinion/complex-diagnosis-review` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology/fatty-liver` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology/heart-disease-follow-up` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology/high-blood-pressure` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology/high-cholesterol` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/endocrinology/hormone-imbalance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology/memory-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/weight-management/obesity` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/orthopedics/osteoarthritis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/endocrinology/osteoporosis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology/palpitations` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology/post-covid-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology/pre-op-cardiac-clearance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/rheumatoid-arthritis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology/seizures-epilepsy-follow-up` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology/sleep-apnea-screening` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/online-second-medical-opinion/surgery-second-opinion` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/endocrinology/thyroid-disorders` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/online-second-medical-opinion/treatment-plan-review` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology/tremor` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/endocrinology/type-2-diabetes` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology/abdominal-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/weight-management/binge-eating` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology/bloating` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/nutrition-and-dietetics/cholesterol-lowering-diet` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/dehydration` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/nutrition-and-dietetics/diabetic-diet` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/lifestyle-medicine/diet-and-exercise-planning` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/nutrition-and-dietetics/food-intolerance-planning` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/gastritis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/glp-program-eligibility` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/lifestyle-medicine/healthy-habit-coaching` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/hemorrhoids` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/indigestion` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology/irritable-bowel-syndrome` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/nutrition-and-dietetics/pregnancy-nutrition` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/lifestyle-medicine/sleep-hygiene` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/nutrition-and-dietetics/sports-nutrition` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/metabolic-syndrome` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/vomiting` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/weight-management/weight-loss-planning` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/orthopedics/back-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology/dry-eyes` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/ear-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology/eye-redness` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology/eye-strain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/hoarseness` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/orthopedics/knee-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/orthopedics/muscle-strain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/nasal-congestion` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/orthopedics/neck-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology/numbness-and-tingling` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology/stye` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/swollen-feet-ankles` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/tonsillitis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/joint-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology/vision-changes` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/childhood-allergies` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/pediatrics/ear-pain-children` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/pediatrics/feeding-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/adolescent-medicine/mood-anxiety-teens` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/pediatrics/pediatric-cold-flu` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/pediatrics/pediatric-fever` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/pink-eye-children` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/adolescent-medicine/puberty-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/pediatrics/skin-rash-in-children` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sore-throat-children` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/adolescent-medicine/sports-injuries` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/stomach-pain-children` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/growth-development` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/vomiting-diarrhea-children` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/doctors-note` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/follow-up-consultation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/lab-results-review` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/internal-medicine/medication-review` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/return-to-work-clearance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/specialist-referral` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/allergic-rhinitis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology/asthma` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/asthma-flare-up` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology/copd` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology/persistent-cough` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/pneumonia-follow-up` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology/shortness-of-breath` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/upper-respiratory-infection` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/wheezing` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/chlamydia` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/genital-itching` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/genital-rash` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/gonorrhea` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/herpes` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/hiv-prevention-guidance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/partner-exposure-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/safe-sex-counseling` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness/sti-consultation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/acne` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/athletes-foot` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/cellulitis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/cold-sores` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/contact-dermatitis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/eczema` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/fungal-skin-infection` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/hair-loss` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/hives` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/itchy-skin` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/mole-skin-checks` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/nail-problems` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/psoriasis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/ringworm` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/rosacea` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/shingles` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/skin-rash` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology/warts` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/altitude-sickness` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/global-cross-border-care/cross-border-consultation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/emergency-teleconsultation-abroad` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/fitness-travel-evaluation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/food-poisoning-while-traveling` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/global-cross-border-care/international-medical-assistance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/malaria-prevention` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/jet-lag` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/global-cross-border-care/medication-refill-while-traveling` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/motion-sickness` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/post-travel-symptoms` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/pre-travel-vaccinations` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/global-cross-border-care/referral-coordination-overseas` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-medical-certification` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/travel-related-fever` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine/travelers-diarrhea` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology/acid-reflux-gerd` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/body-aches` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/bronchitis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/cold-and-flu` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology/constipation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/cough` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/covid-19` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/diarrhea` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology/dizziness` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/ear-infection` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/fatigue` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/fever` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/food-poisoning` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/headache` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/insect-bite` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology/migraine` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/minor-burns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/minor-infections` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/internal-medicine/multi-system-complaints` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/nausea-and-vomiting` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/pink-eye` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/internal-medicine/preventive-screening` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/family-medicine/routine-check-ups` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/seasonal-allergies` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician/sinus-infection` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/sore-throat` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/strep-throat` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/internal-medicine/undiagnosed-symptoms` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/family-medicine/vaccination-advice` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/family-medicine/whole-family-illnesses` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/urology/blood-in-urine` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/burning-urination` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/frequent-urination` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/urology/kidney-stones` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/urology/urinary-incontinence` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/urinary-tract-infection` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/bacterial-vaginosis` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/birth-control-consultation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/emergency-contraception-guidance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/heavy-periods` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/irregular-periods` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/lactation-consulting/latch-problems` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/lactation-consulting/low-milk-supply` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/menstrual-cramps` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/lactation-consulting/nipple-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/pcos` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/pelvic-pain` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/women-mental-health/perinatal-anxiety` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/postpartum-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/women-mental-health/pmdd` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/pregnancy-related-questions` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/women-mental-health/postnatal-depression` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/prenatal-consultation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/vaginal-yeast-infection` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/lactation-consulting/weaning-guidance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychology-counseling/stress` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/behavioral-health/anger-management` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/behavioral-health/adjustment-difficulties` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/behavioral-health/substance-use-support` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/behavioral-health/sleep-related-anxiety` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/depression` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/anxiety` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/burnout` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/bipolar-disorder-follow-up` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/ptsd` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/panic-attacks` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/insomnia` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/adhd-evaluation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychology-counseling/grief-and-loss` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychology-counseling/relationship-stress` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychology-counseling/low-self-esteem` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychology-counseling/trauma-support` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/menopause-care/hot-flashes` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/menopause-care/menopause-symptoms` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/menopause-care/hrt-guidance` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/men-health/hair-loss` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/urology/bladder-problems` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/men-health/erectile-dysfunction` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/men-health/low-libido` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/men-health/low-testosterone-symptoms` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-wellness-consultation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/premature-ejaculation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/men-health/prostate-health` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/urinary-symptoms-in-men` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology/fertility-concerns` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry/ocd` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology/eye-irritation` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat/vertigo` | accessibility,breadcrumb,fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/adolescent-medicine` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/child-and-family-care/pediatrics` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/cardiology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/gastroenterology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/neurology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/pulmonology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/family-medicine` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/general-physician` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care/internal-medicine` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/menopause-care` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/obstetrics-and-gynaecology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/women-mental-health` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health/lactation-consulting` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ear-nose-throat` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/ophthalmology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone/orthopedics` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care/endocrinology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/men-health` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health/urology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/behavioral-health` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychiatry` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health/psychology-counseling` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care/dermatology` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/global-cross-border-care` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care/travel-medicine` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health/sexual-health-and-wellness` | accessibility,breadcrumb,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/contact-us` | accessibility,other: tokens/transitions |
| public | `/service-areas` | accessibility,other: tokens/transitions |
| public | `/refund-cancellation-policy` | accessibility,other: tokens/transitions |
| public | `/provider-terms-of-service` | accessibility,other: tokens/transitions |
| public | `/privacy-policy` | accessibility,other: tokens/transitions |
| public | `/terms-of-service` | accessibility,other: tokens/transitions |
| public | `/hipaa-notice-of-privacy-practices` | accessibility,other: tokens/transitions |
| public | `/california-privacy-rights-notice` | accessibility,other: tokens/transitions |
| public | `/cookie-policy` | accessibility,other: tokens/transitions |
| public | `/accessibility-statement` | accessibility,other: tokens/transitions |
| public | `/telehealth-informed-consent` | accessibility,other: tokens/transitions |
| public | `/account-deletion-policy` | accessibility,other: tokens/transitions |
| public | `/blogs` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/how-does-a-telemedicine-appointment-work` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/online-doctor-consultation` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/telemedicine-vs-in-person-doctor-visits` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/telemedicine-cost-usa` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/are-online-doctors-real-doctors` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/future-of-telemedicine` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions |
| public | `/chronic-medication-management` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/chronic-care-management` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/online-prescription-refills` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/service-sexual-health` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/weight-loss-programs` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/online-second-medical-opinion` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/fit-to-fly-certificate` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/conditions-treated-through-telemedicine` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/top-telemedicine-platforms-providers` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/is-telemedicine-safe` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/uti-symptoms-causes-treatment-&-when-to-see-a-doctor` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/migraine-vs-headache-symptoms-causes-differences-and-treatment-options` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/telehealth-for-hypertension` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/support-center` | accessibility,fonts,hover,other: tokens/transitions |
| public | `/child-and-family-care` | fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/eye-ear-bone` | fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/general-and-everyday-care` | fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/mens-health` | fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/mental-health` | fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/skin-and-hair-care` | fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/travel-and-global-care` | fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/women-health` | fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/weight-management` | accessibility,breadcrumb,fonts,hover,link fix,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/lifestyle-medicine` | accessibility,breadcrumb,fonts,hover,link fix,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition/nutrition-and-dietetics` | accessibility,breadcrumb,fonts,hover,link fix,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/ask-a-question` | - |
| public | `/profile` | - |
| public | `/doctors/:slug` | hover,other,other: tokens/transitions |
| public | `/doctor/:id` | hover,other,other: tokens/transitions |
| public | `/what-is-telemedicine` | accessibility,fonts,hover,link fix,other: image attrs,other: tokens/transitions |
| public | `/telemedicine-services` | accessibility,fonts,hover,link fix,other: image attrs,other: tokens/transitions |
| public | `/general-consultation` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/lab-requisitions` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions,toast |
| public | `/` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/medical-services` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading) |
| public | `/corporates` | accessibility,fonts,hover,modal,other,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/categories` | accessibility,fonts,hover,link fix,other,other: mobile text/touch,other: tokens/transitions |
| public | `/specialties` | accessibility,fonts,hover,link fix,other,other: mobile text/touch,other: tokens/transitions |
| public | `/conditions` | accessibility,fonts,hover,link fix,other,other: mobile text/touch,other: tokens/transitions |
| public | `/chronic-care` | fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/sexual-health` | fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/weight-and-nutrition` | fonts,hover,link fix,other: mobile text/touch,other: tokens/transitions |
| public | `/primary-care-provider` | accessibility,fonts,hover,other: mobile text/touch,other: tokens/transitions |
| public | `/about-us` | hover,other: image attrs,other: tokens/transitions |
| public | `/career` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| public | `/:slug` | accessibility,fonts,hover,other,other: image attrs,other: tokens/transitions |
| auth | `/adminauth` | accessibility,hover,other: mobile text/touch,other: tokens/transitions |
| auth | `/payment-admin-login` | accessibility,hover,other: mobile text/touch,other: tokens/transitions |
| auth | `/employee-login` | accessibility,hover,other: mobile text/touch,other: tokens/transitions |
| auth | `/login` | accessibility,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions,wording |
| auth | `/doctor-login` | accessibility,hover,other: mobile text/touch,other: tokens/transitions |
| auth | `/partner-login` | accessibility,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions |
| auth | `/admin-auth` | - |
| booking/payment | `/appointment-booking` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions,states(retry/error/loading) |
| booking/payment | `/appointment-booking/:catSlug` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions,states(retry/error/loading) |
| booking/payment | `/appointment-booking/:catSlug/:specSlug` | accessibility,fonts,hover,other: image attrs,other: mobile text/touch,other: tokens/transitions,states(retry/error/loading) |
| booking/payment | `/appointment-booking/:category/:specialty/:condition` | accessibility,fonts,hover,modal,other: image attrs,other: tokens/transitions,wording |
| booking/payment | `/appointment-booking/category-confirm` | accessibility,fonts,hover,modal,other: image attrs,other: tokens/transitions,wording |
| booking/payment | `/category-consultant` | hover,other: mobile text/touch,other: tokens/transitions,toast |
| booking/payment | `/service-consultant` | hover,other: mobile text/touch,other: tokens/transitions,toast |
| booking/payment | `/book-appointment` | accessibility,fonts,hover,other: tokens/transitions |
| booking/payment | `/pay/:token` | accessibility,fonts,other: tokens/transitions |
| booking/payment | `/services-prices` | modal,other: image attrs,other: tokens/transitions |
| booking/payment | `/appointment-booking/form` | - |
| user | `/user/dashboard` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/appointments` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/favourite-doctors` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/lab-appointments` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/raise-ticket` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/medical-questions` | - |
| user | `/user/profile-settings` | accessibility,fonts,hover,other: image attrs,other: new Button,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/change-password` | accessibility,fonts,hover,other: new Button,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/my-records` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| user | `/user/payment-history` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading),toast |
| doctor | `/doctor-dashboard` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/patients/:patientId/prescription` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/messages` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/raise-ticket` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/analytics` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/settings` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/appointments` | accessibility,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/patients` | accessibility,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/notes` | accessibility,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/profile` | accessibility,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/doctor-profile-for-patients` | accessibility,hover,other,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/enrollments` | accessibility,other: image attrs |
| doctor | `/doctor-dashboard/patients/:patientId/prescriptions/:rxId` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/patients/:patientId/certificates/:certId` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| doctor | `/doctor-dashboard/qna` | - |
| admin | `/admin-dashboard/category-consultations/assign-doctor/:id` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/partner-cases` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/appointments` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/category-consultations/:id` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/appointments/:id` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/appointments/:id/assign` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/email` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/manage-users` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/deletion-requests` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/direct-video-consultation` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/email/box/:mailboxId/:folder` | - |
| admin | `/admin-dashboard/email/inbox` | - |
| admin | `/payment-admin` | - |
| admin | `/admin-dashboard/qna` | - |
| admin | `/admin-dashboard/email/settings/mail-ids` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/our-doctors` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/direct-video-consultation/calls` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/direct-video-consultation/calls/:roomId` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/payment-admin/payment-links` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/payment-admin/payment-history` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/manage-doctors` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| admin | `/payment-admin/manual-invoices` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading),toast |
| admin | `/admin-dashboard/manual-invoices` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading),toast |
| admin | `/admin-dashboard/gop` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading),toast |
| admin | `/admin-dashboard/partner-cases/:id` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/manage-users/:id` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/email/mail/:messageId` | accessibility |
| admin | `/admin-dashboard/doctors/:slug` | accessibility,hover,other,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/doctor-profile/:id` | accessibility,hover,modal,other: image attrs,other: tokens/transitions,states(retry/error/loading) |
| admin | `/admin-dashboard/category-consultations` | accessibility,hover,modal,other: tokens/transitions,states(retry/error/loading),toast |
| admin | `/admin-dashboard/tickets` | accessibility,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| admin | `/superadmin-dashboard` | accessibility,fonts,hover,modal,other,other: image attrs,other: tokens/transitions |
| employee | `/employee-dashboard` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| employee | `/employee-dashboard/assign-task` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| employee | `/employee-dashboard/my-tasks` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading) |
| employee | `/employee-dashboard/my-tasks/:taskId` | accessibility,fonts,hover,other: image attrs,other: tokens/transitions,states(retry/error/loading) |
| employee | `/employee-dashboard/tasks` | - |
| partner | `/partner-dashboard/cases` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| partner | `/partner-dashboard/billing` | accessibility,hover,other: tokens/transitions,states(retry/error/loading) |
| partner | `/partner-dashboard` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| partner | `/partner-dashboard/submit-case` | accessibility,fonts,hover,other: tokens/transitions,states(retry/error/loading) |
| partner | `/partner-dashboard/cases/:id` | accessibility,fonts,hover,modal,other: tokens/transitions,states(retry/error/loading) |
| video call | `/video-call/:appointmentId` | hover,other: image attrs,other: tokens/transitions |
| video call | `/direct-video-call/:roomId` | accessibility,hover,other: image attrs,other: tokens/transitions |

Routes with no page-specific change (only the shared changes in section 0, or redirects): `/ask-a-question`, `/user/medical-questions`, `/profile`, `/doctor-dashboard/qna`, `/employee-dashboard/tasks`, `/admin-dashboard/email/box/:mailboxId/:folder`, `/admin-dashboard/email/inbox`, `/payment-admin`, `/admin-auth`, `/admin-dashboard/qna`, `/appointment-booking/form`.
