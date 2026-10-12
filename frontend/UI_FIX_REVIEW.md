# UI fix review: branch `issue` vs `main`

Written after phases 6A, 6B and 7 and a fresh whole-branch check. Not committed on purpose.
Everything below was re-run at the end on commit `c8e5dc3` (tip of `issue`). Where something was only checked in code, it says so.

---

## 1. Phase summary

| Phase | Commit | What changed | Files | Status |
|---|---|---|---|---|
| 1 Routing, navigation | `d24826c` | Unknown URLs reach the 404 page (BlogPost now loads, shows 404 / retry state; it also fixes a crash that left `/:slug` blank). Dev routes removed (`/test`, `/images`, `/cookies`). `weight-and-nurtrition` to `weight-and-nutrition` with 19 redirects (also in `render.yaml`). Page titles for login pages and `/pay`. | 18 | done |
| 2 Accessibility basics | `3749ae6` | One `<main id="main-content">` + skip link on all pages; one `<h1>` on login, booking and others; `autocomplete`; `aria-invalid`, `aria-describedby`, `role="alert"` on form errors; 40 `:focus-visible` rules; 67 clickable divs made keyboard-operable; 4 broken links fixed. | 369 | done (dashboards code-checked only) |
| 3 Feedback, loading, errors | `accb357` | Toast system (7 `alert()` replaced), ErrorBoundary (app and dashboards), delayed route spinner, Retry buttons on 6 failed-load screens, 404 inside `<main>`, hidden h1 on video-call pages. | 29 | done |
| 4 Assets and performance | `a7c5175` | ~91 MB of unused source assets removed (not in the shipped build), `decoding="async"` on 72 images, width/height on 2, icons + manifest, dependency cleanup (`@studio-freight/lenis`). | 78 | done (smaller than the audit expected: shipped images were already optimised) |
| 5 Mobile | `e7157cc` | Tiny text to 12px on phones (22 selectors), invisible 44px hit areas, hover lifts gated to real hover devices (258 rules), reduced-motion (global CSS, Motion, autoplay, Swiper, GSAP), `transition: all` replaced (37), CMS tables get a scroller, design tokens, chat bubble moved above fixed bars. | 93 | done |
| 6A Modal and Confirm | `bc0b732` | `Modal`, `ConfirmDialog`/`useConfirm`, `useModalA11y`; all 13+ `confirm()` replaced; role/aria/Escape/focus trap/focus return on 20 existing modals and the mobile menu. | 33 | done |
| 6B Button, Field, wording, headings | `b9bc204` | `Button`, `Field`; 9 buttons migrated; auth wording unified; hidden h1 for 15 dashboard routes, layout title is no longer an h1; keyboard-operable table rows; Home search is an ARIA combobox. | 28 | done (see decisions: header wording not changed) |
| 7 Cleanup, breadcrumbs | `c8e5dc3` | 63 dead files deleted (4.4 MB), visible breadcrumbs on 250 condition/specialty routes (same helper as the JSON-LD), TODO report. | 316 | done (icons skipped, careers form not wired: see below) |

No phase was discarded. `git log --oneline main..issue` and the diff stat are at the end.

---

## 2. Decisions made for you (no answers were available)

Phase 6A, 6B, 7:
1. **Phase 5 leftover, 1440px differences on `/categories` and `/chronic-care`:** only 590 to 680 differing pixels each, in the same strip as the rotating "Get help for" header text and the live-chat widget. No real visual change, nothing to fix.
2. **`log.css` z-index 999999:** it is the country dropdown inside the login form, not a modal. I left it alone (changing it to `--z-modal` could hide it under neighbours). It would cover a toast if both were open.
3. **Home testimonials parallax:** now skipped under `prefers-reduced-motion`.
4. **Mobile menu "dialog":** the focus trap covers the whole `<header>` (so the hamburger can still close it), and `role="dialog"` is only set while the menu is open. Focus stays on the hamburger when the menu opens (it was already inside the trap).
5. **Confirm outside a provider returns `false`** so a destructive action can never run by accident.
6. **`userAdminActions.js`:** least invasive option: the three functions take the `confirm` function as an extra argument; the three callers pass `useConfirm()`.
7. **Modals skipped:** `DeleteAccountModal`, `MiParts`, `ManualInvoices` already had role/aria/Escape; dashboard sidebar drawers (4 layouts) are layout sidebars, not dialogs; `CertificatePreview`/`PrescriptionPreview` are full pages; cookie banner is a non-modal banner (gets `role="region"`); all video-call modals skipped as instructed.
8. **Button look:** copied from the specialty-page buttons (`.sp-btn--primary-lg`, 66 + 30 uses, the most common). Secondary is white with a blue border (the site's secondary buttons are glass-on-dark, not usable on light cards). **Field look:** copied from `.hc-input` in `Login.css`.
9. **Wording counts (JSX text, excluding legal/blog/SEO):** `Sign In` 9 (7 buttons + 2 sentences) vs `Login` ~3 as a UI label vs `Log in` 1; `Create Account` 7 vs `Register` 5 vs `Sign Up` 4 (3 of the 4 were descriptive sentences); `Book Appointment` 23 vs `Book an Appointment` 1. Applied: `Sign Up` button to `Create Account` (Login, DoctorLogin x2), `Book an Appointment` h1 to `Book Appointment`, `Log in` link to `Sign in`. **Not applied: the header's "Login / Register".** Changing it to "Sign In / Create Account" made the pill overlap "Blogs" at 1025px, and even "Sign In / Register" left no gap, so I reverted it. Portal names ("Admin Login", "Doctor Login") are page names and SEO titles, left as they are.
10. **Dashboard h1:** hidden `<h1 class="sr-only">` added in the route (`App.jsx`) so loading and error states have it too. `AdminDashboard` skipped (its overview already renders an h1). `SuperAdminDashboard` skipped (tab-based: two of its tabs have their own h1, the others none).
11. **Breadcrumbs:** there is no shared template component for condition/specialty pages (each is its own file), so a `Breadcrumb` component was inserted above the badge/h1 in the 221 condition and 29 specialty routes with one scripted edit. Labels come from the same helper as the existing JSON-LD (`breadcrumbItems` in `seo/schema.js`, which the JSON-LD now uses too).
12. **Icons (task 7.3):** skipped. `public/favicon.svg` is the default purple Vite logo, not the brand logo (and is not linked). The icons from phase 4 (made from `single-logo.png`) stay.
13. **Careers form:** no careers/recruitment endpoint exists in the backend (only a reserved blog slug), so the form is not wired.
14. **Files not deleted although unreferenced:** `CookieBanner.jsx` (see issues), `Findadoctor.jsx` (the page `/find-a-doctor` links expect), `ui/Field.jsx` (new, not used yet), logos/`qr-code.png`/`prescription-*` and everything in `public/`.
15. **Local builds used `PRERENDER_SKIP_API=1`** (the backend was unreachable during this run, so the prerender could not fetch blogs/doctors). Prerendered doctor profile pages and blog posts were therefore not built in my checks. Your normal build is unaffected.
16. The lint comparison counts a message as "the same" when rule and first line match, because ESLint messages embed line numbers. Whole-project numbers are in section 3.

Earlier phases (already reported in chat): phase 1 `/CCPA` skipped (no page); phase 2 dashboards `/admin-dashboard/payment-links` links left (never rendered); phase 4 `hero-bg1.jpeg` kept until phase 7; phase 5 crawl sampled 198 representative routes at 5 widths; and so on.

---

## 3. Whole-branch checks against `main` (fresh)

Both branches built successfully (`npm run build`, SEO check passes: 307 indexable routes; `main` 15 redirects, `issue` 34).

### Lint (whole `src/`)
- `main`: 722 errors, 21 warnings in 527 files. `issue`: 667 errors, 20 warnings in 509 files. **Net -55 errors.**
- New in `issue`: only `react-refresh/only-export-components` +1 (the Toast/Confirm files export a provider and a hook from the same file). Everything else is the same or fewer. Per-phase "new error" checks were 0 each time.

### Crawl of all 323 public routes on `issue` (375px and 1440px, API mocked as 404)
- Horizontal overflow: **0 / 646** loads.
- `<h1>` count: 35 URLs first looked wrong (timing: measured while the lazy page was still loading); re-checked with a 4.5 s wait: **0 remain**, so every public route has exactly 1 h1.
- `<main>`: exactly one `main#main-content` on every route (same re-check). Skip link present on all 323.
- Skip link works (Tab, Enter, focus lands on `main#main-content`): 320/323 first pass, **323/323 after the re-check**.
- Failed requests (non-API): **0**. JavaScript exceptions: **0**. Console errors: only `Failed to fetch pricing / blogs` messages, caused by my 404-mocked API.
- `main` for comparison (13 standard pages): 9 of 13 had no `<main>`, `/login` and `/doctor-login` had 4 h1, `/appointment-booking` 0, no skip link anywhere.
- Internal links (static check of 2,011 targets): 3 do not match a route (known false positives, see issues). **But 77 more only "resolve" through the `/:slug` blog catch-all, i.e. they show the 404 page.** Real ones, outside the old `searchIndex.js` data file: `/specialists` (9 blog files), `/book`, `/contact` (5 category pages, should be `/contact-us`), `/find-a-doctor`, `/doctor-pending`, `/export-medical-opinion`, `/patient-informed-consent-form`, `/terms`, `/privacy` (unused Register page). Not fixed in this branch.

### 13 pages, `main` vs `issue` (375px and 1440px)
Identical apart from the following (all intended or noise):
- Live-chat popup timing, rotating "Get help for" header text, Home hero video: noise.
- `/chronic-care` at 375px: chat bubble now sits above the fixed "Book Appointment" bar (intended, phase 5).
- `/appointment-booking` at 1440px: the "Unable to load healthcare categories" panel now has a **Try again** button (intended, phase 3).
- `/zzz-not-a-page`: `main` shows an empty page (the blog lookup spinner) or a bare "Not found"; `issue` shows the real 404 page with header and footer (intended, phase 1).
- Pages with breadcrumbs (condition/specialty) are not among the 13; checked separately (`/chronic-care/cardiology`, deep path at 320px: no overflow).

### git grep checks
- `alert(`: 0. `confirm(` / `window.confirm`: 0 (excluding deleted `-old` files). No `TEST CRASH` / temporary test code. 0 `font-family` names outside tokens in new code. **Not zero overall:** 16 inline `'Plus Jakarta Sans'` in `ChangePassword`, `ProfileSettings` and two delete-account files, 40 `font-family` declarations without `var(--font-*)` (system stacks in partner CSS, `Georgia` on an editor button). Fonts were out of scope for these phases.

---

## 4. Ratings (same categories and weights as `UI_AUDIT_REPORT_2.md` section 4)

Strict, and "code only" is marked where I could not run it (logged-in areas, real devices, screen readers).

| Category | Weight | Old | New | Why |
|---|---|---|---|---|
| Visual consistency | 15% | 5.0 | **5.5** | Button/Field exist and match the dominant style, tokens added, but only 9 buttons migrated and `Field` has no users yet; fonts/colours untouched. |
| Layout and structure | 10% | 6.0 | **7.0** | One main landmark everywhere, containers/z/duration tokens, dead files gone; 65+ breakpoints and z-index up to 999999 remain. |
| Responsive / mobile | 15% | 6.5 | **7.5** | No overflow on 323 routes x 2 widths (and 5 widths on 198 in phase 5), tiny text, hit areas, hover gating, reduced motion; breakpoints not consolidated; logged-in pages not tested. |
| Navigation | 10% | 6.5 | **8.0** | Real 404, dev routes and duplicates gone, redirects, breadcrumbs on 250 routes, titles; about 12 internal links still dead (list above), no breadcrumbs on hubs/other pages. |
| Component reuse | 10% | 4.0 | **5.0** | Toast, Modal, Confirm, ErrorBoundary, Button, Field, Breadcrumb, Retry, RouteFallback now exist; adoption is small (157 button class families still exist). |
| Forms UX | 10% | 5.5 | **6.5** | autocomplete, aria-invalid/describedby/alert, toasts instead of alert; `Field` unused, logged-in forms code-checked only. |
| UI states | 5% | 5.0 | **6.5** | Delayed spinner, error boundary, Retry on 6 screens; most other load errors still bare text, blog list shows "no results" on failure. |
| Accessibility | 15% | 5.0 | **7.0** | Verified in a browser on public routes: h1/main/skip link, focus rings, modal focus trap and Escape, combobox. Dashboards only code-checked (hidden h1 in 15 routes), no screen-reader test, text inputs rely on their own focus style. |
| CSS code quality | 5% | 3.5 | **4.0** | Dead CSS removed, tokens, fewer `transition: all`; `!important` and ~2,000 inline styles untouched. |
| Performance (UI) | 5% | 4.5 | **5.5** | Repo no longer carries ~95 MB of unused assets; shipped images were already WebP, bundles unchanged, jspdf/html2canvas were already lazy. Home still pulls ~1 MB of JS and a 1.7 MB video. |

Weighted overall: 0.825 + 0.700 + 1.125 + 0.800 + 0.500 + 0.650 + 0.325 + 1.050 + 0.200 + 0.275 = **6.45, rounded 6.5 / 10** (was 5.3).

---

## 5. Remaining issues and next steps

**Security / important**
- **The Content-Security-Policy `<meta>` is outside `<head>`** (after `</html>` in `index.html:89`). Browsers ignore it there, so the site effectively has no CSP from that tag (the browser console says so). Move it into `<head>` (or better, send it as an HTTP header from `render.yaml`) and test Stripe, PayPal, GTM, LiveChat, Google sign-in against it.
- **`CookieBanner` is never mounted** (its route was the only reference). GTM only loads after "Accept", so analytics and the consent UI may not be running. Confirm that is intended.
- **Dead links** (section 3): `/find-a-doctor` (linked from the user favourites page and doctor profile; `Findadoctor.jsx` exists but has no route), `/contact` x5, `/specialists` x9 (blog articles), `/book`, `/doctor-pending`, `/export-medical-opinion`, `/patient-informed-consent-form`. Also `/admin-dashboard/payment-links`, `/admin-dashboard/payment-link-history`, `/admin-dashboard/doctor-profile/` (never rendered as links).
- **`/CCPA`** has no page (phase 1).

**UI**
- Header "Login / Register": the unified wording needs a header layout change (the pill overlaps nav at about 1025px).
- Migrate more buttons/fields to `Button`/`Field` (top candidate classes: `sp-btn` 66, `btn` 39, `hcc-btn-primary` 36, `service-btn` 32, `sp-btn--primary-lg` 30, `sp-btn--ghost-lg` 30, `adp-btn` 29, `service-btn--primary` 27, `btn-primary` 27, `em-btn` 26, `hcc-btn-secondary` 24, `pt-btn` 22, `em-btn-ghost` 17, `dp-btn` 16, `dvc-link-btn` 15, `hc-btn` 14, `btn-secondary` 14, `mi-btn` 12, `pt-btn-ghost` 11, `btn-outline` 11).
- Fonts still hardcoded: 16 inline `'Plus Jakarta Sans'` plus system stacks in partner CSS.
- Breakpoints (65 distinct, e.g. `max-width` 640x48, 768x45, 900x55, 1024x35, 480x36, plus one-pixel pairs 767/768, 991/992, 1023/1024, 1199/1200, 1279/1280) and the z-index scale: still to consolidate.
- Blog list shows "no results" when the API fails; `SuperAdminDashboard` has no consistent h1; `WritePrescription`/enrollment wizard show no h1 while loading.
- Tiny badges/eyebrows under 12px on phones were left as they are (decorative).

**Large refactors (U32-U35, not started)**
- U32 move page CSS to scoped modules or full Tailwind; U33 inline-style-heavy pages (`AdminDoctorProfile`, `DoctorEnrollments`, `ProfileSettings`); U34 one layout shell for the five dashboards; U35 generate the ~250 condition/specialty pages from data and one template (this also makes breadcrumbs, JSON-LD and headings a one-place change).

**Other**
- Careers form still not wired (`DoctorCareers.jsx:450`), no endpoint in the backend.
- Legal TODOs left untouched: `PrivacyPolicies/DeleteAccount.jsx` (retention wording), `AdminDeletionRequests.jsx` and `DeletionRequestsPanel.jsx` (personal data on screen). The `Specialties.jsx` OG-image TODO no longer exists in the code.
- `Test.jsx`, `ServiceDemo.jsx` and other dev pages are deleted; E2E tests in `e2e/` were not run.

---

## 6. Manual test checklist (one pass, about 60 to 90 minutes)

**Public pages (desktop, then phone)**
1. Open `/`, `/about-us`, `/contact-us`, `/blogs`, `/corporates`, `/chronic-care`, `/chronic-care/cardiology`. Each looks as before (no new gaps). On the cardiology page: "Home › Chronic Care › Cardiology" above the badge, links work.
2. Press Tab once on any page: a "Skip to content" link appears top-left. Enter: focus jumps to the page content.
3. Open `/zzz-not-a-page` and `/a/b/c`: the real 404 page. Open an old URL like `/weight-and-nurtrition`: it lands on `/weight-and-nutrition`.
4. Home search: type 3+ letters, use Arrow Up/Down and Enter, Escape closes. Mouse still works.
5. Tab through the header: every control shows a ring; the mobile menu (phone) opens, Escape or the X closes it, focus returns to the menu button.
6. Footer links on a phone: tapping slightly above or below a link still opens it.

**Auth**
7. `/login`: there is one big heading; switch between Sign in and Create Account; wrong password shows an error (screen reader announces it); password manager offers to fill; the OTP field accepts a code pasted from SMS.
8. `/doctor-login`, `/adminauth`, `/employee-login`, `/partner-login`, `/payment-admin-login`: same checks, page titles correct.

**Booking and payment**
9. Book a regular appointment end to end (date, time, notes, consent link). Open "Patient Informed Consent": Escape closes, focus returns. Wrong or missing field shows an error next to the field.
10. Open a `/pay/<token>`: title "Secure Payment", pay with a test card. `/services-prices`, category consultation booking (`CategoryConsultant`): the chat bubble no longer covers the bottom bar.

**User dashboard**
11. `/user/dashboard`, appointments, records, payment history (an invoice that is not ready shows a toast, not a popup), raise ticket.
12. Profile settings: Reset and Save Changes buttons now look like the site's blue pill buttons; save shows "Saving…" then "Saved!". Change password: same, error text under each field.
13. "Delete my account" (red button): modal opens; Escape closes; "Keep my account" and the submit button work; Tab stays inside the dialog.

**Doctor**
14. Dashboard, appointments (mark as completed dialog: Escape cancels), patients (open notes, certificate and patient panel: Escape, focus), notes (delete asks "Delete note" with Cancel focused), messages, analytics, settings, profile.
15. Write a prescription and download the PDF; download a medical certificate PDF (both load `jspdf` on demand).

**Admin**
16. Each menu item loads and has one visible page title. Delete a consultation, a blog, a service, a healthcare item, a partner company, a user, approve/reject a deletion request, end a direct video room, regenerate a PIN with "end current session": each now shows the new confirmation dialog (red button, Cancel focused), Cancel and Escape do nothing, Confirm performs the action.
17. GOP and manual invoices: download buttons; force an error (offline) and check a toast appears. Email: compose, close with unsaved text: "Discard message" dialog.
18. Super admin dashboard: Employee admins edit dialog (Escape closes), "Remove account?" dialog.

**Employee / Partner**
19. Employee dashboard, my tasks, assign task. Partner dashboard, submit case, all cases: press Tab to a table row, Enter opens the case; focus ring visible.

**PDFs**
20. Prescription, medical certificate, GOP and manual invoice PDFs: same layout and logos as before.

**Real phone (iOS Safari and Android Chrome)**
21. Home, a category page, a condition page, login, booking: no sideways scroll, text readable, buttons tappable.
22. Turn on Reduce Motion in the OS: Home, Corporates carousels stop, no smooth scroll.
23. Tap cards and buttons: nothing stays "stuck" lifted after the tap.
24. Live-chat bubble does not hide any fixed bottom button.

---

## 7. `git log --oneline main..issue`

```
c8e5dc3 ui phase 7: remove dead files, breadcrumbs, icon refresh, TODO report
b9bc204 ui phase 6B: Button and Field components, consistent wording, dashboard headings, keyboard rows, search combobox
bc0b732 ui phase 6A: Modal and ConfirmDialog, replace confirm(), modal keyboard support
e7157cc ui phase 5: mobile bug fixes, reduced motion, touch targets, hover on touch, table scrolling
a7c5175 ui phase 4: remove unused assets, optimise images, lazy loading, icons, lighter bundles
accb357 ui phase 3: toasts instead of alert, error boundary, loading and error states
3749ae6 ui phase 2: accessibility basics and broken internal links
d24826c ui phase 1: 404 handling, remove dev and duplicate routes, URL fixes, page titles
```

`git diff --stat main..issue`: **565 files changed, 5,291 insertions(+), 19,784 deletions(-)** (468 modified, 25 added, 72 deleted; deletions are mostly dead pages, old component copies and unused images).
