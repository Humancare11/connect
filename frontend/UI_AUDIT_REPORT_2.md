# UI/UX Deep Audit (Part 2): Humancare Connect Web Frontend

Companion to `UI_AUDIT_REPORT.md` (fonts, font sizes, colours, radii). Those findings are not repeated here, only referenced.

**How this was done.** Read-only. No project file was changed. The one file added is this report.
- **Code audit:** grep and small Node scripts over `src/` (476 `.jsx` files, 101 `.css` files, `App.jsx` with 3,130 lines).
- **Rendered checks:** the site was served with `vite preview` from the existing `dist/` build (built 6 Oct 17:25, which may be older than `src/`). It was driven by the already-installed Chrome through the DevTools protocol at 375, 768 and 1440 px. Scripts and screenshots are in the session scratchpad, outside the project.
- **Not rendered:** every page behind a login (user, doctor, admin, employee, partner, video call). They redirect to `/login` without credentials. No backend was running, so data-driven pages showed empty or error states. See section 6.

---

## 1. Executive summary

**Overall score: 5.3 / 10** (calculation in section 4). The site works and is broadly responsive on the pages I rendered, with no horizontal scroll at 375 px on any of 15 sampled public pages. It is held back by three things: no shared component library, a very large amount of duplicated CSS and inline style, and uneven accessibility basics.

**Top 10 problems, ranked by user impact**

1. **Unknown URLs fire a blog lookup before the 404 can show.** `src/App.jsx:3112` routes every single-segment unknown path to `BlogPost`. On a failed lookup the user sees "This article could not be loaded right now. Please try again." (`Blogs/BlogPost.jsx:37`) instead of the 404 page. I saw this on `/zzz` with no backend. The real 404 only appears if the API answers 404 (`BlogPost.jsx:20-29`), and the page is blank while it waits.
2. **Account, booking and checkout pages look different from the public site.** Hardcoded fonts, colours and button styles are used (see Part 1, H1 and H3). This is the most visible consistency break for paying users.
3. **No shared UI components.** There is no `components/ui` folder and no Button, Modal, Table, Toast or Skeleton component. I counted 157 differently prefixed `*-btn` / `*-button` CSS classes, 11 modal/overlay class families, 34 badge/pill/chip classes and 49 `<table>` elements, each styled per page.
4. **Native `alert()` for errors and confirmations** in 7 places, e.g. `NewServices/ServiceContact.jsx:32,36`, `CategoryConsultant.jsx:328`, `user/PaymentHistory.jsx:82`. There is no toast system.
5. **Heading and landmark problems on key pages.** `/login` renders **4 `<h1>`**. `/appointment-booking` and the 404 render **0 `<h1>`**. 9 of 15 sampled public pages have **no `<main>`** landmark (including home, login, contact, blogs, categories, corporates). There is no skip link.
6. **Large unoptimised assets.** `src/assets/CATEGORIES/1-7.png` total about 55 MB (5-10 MB each) and are not referenced anywhere in `src`. `hero-bg1.jpeg` is 2.5 MB and two videos are 1.8 and 9.7 MB. The main JS chunks are 715 KB (vendor-react), 656 KB (index) and 555 KB (state).
7. **Many touch targets under 44 px.** 32-64 interactive elements per page measured below 44 px in width or height, mostly header, footer and text links. Several inputs and buttons use `height: 46px` or `48px` correctly (`Login.css:168`), but small links are the norm.
8. **Focus indicators removed in 95 places** (`outline: none`) against only 39 `:focus-visible` rules. Worst: `employee/EmployeeTasks.css` (7), `log.css`, `employee/Assigntask.css`, `doctors/Doctor.css`, `Login.css` (5 each).
9. **CSS maintainability.** 594 `!important`, 2,048 inline `style={{}}` blocks, about 1.6 MB of CSS across 101 files, 65 distinct media-query breakpoints, z-index values up to 999999, and 9 CSS files and 16 components that nothing imports.
10. **Most form fields cannot be audited for labels from code alone, and autocomplete is rare.** 325 of 420 `<input>/<select>/<textarea>` tags have no `id` or `aria-label` (many may sit inside a `<label>`). On the rendered login and contact forms every field had a label, but the login fields had **no `autocomplete` attribute**, which hurts password managers.

---

## 2. Site structure map

### 2.1 Routes (`src/App.jsx:1175-3113`)

471 `<Route path>` entries (434 unique). 386 `lazy()` imports. Rough grouping by first path segment:

| Area | Examples / counts |
|---|---|
| **Public site** | `/`, `/about-us`, `/contact-us`, `/medical-services`, `/services-prices`, `/corporates`, `/service-areas`, `/career`, `/support-center` (FAQ), `/doctors/:slug`, `/service-consultant`, `/category-consultant` |
| **Categories and specialties** (largest group) | `/categories`, `/specialties`, `/conditions`; 12 category hubs (`/mens-health`, `/women-health`, `/mental-health`, ...); about 150 specialty and condition pages under them (`/chronic-care/*` 41, `/mental-health/*` 26, `/eye-ear-bone/*` 25, `/women-health/*` 24, `/general-and-everyday-care/*` 21, `/mens-health/*` 19, ...) plus about 90 root-level condition pages (`/vomiting`, `/joint-pain`, `/jet-lag`, ...) |
| **Blog** | `/blogs`, 11 article routes (e.g. `/what-is-telemedicine`, `/telemedicine-cost-usa`), dynamic `/:slug` (`App.jsx:3112`) |
| **Legal / policy** | `/privacy-policy`, `/terms-of-service`, `/cookie-policy`, `/accessibility-statement`, `/refund-and-cancellation-policy`, `/CCPA`, `/hipaa-notice-of-privacy-practices`, `/account-deletion-policy`, ... (about 20) |
| **Auth** | `/login`, `/doctor-login`, `/adminauth`, `/admin-auth`, `/payment-admin-login`, `/employee-login`, `/partner-login` (register routes are commented out) |
| **Booking / checkout** | `/appointment-booking` (+6 sub-routes), `/book-appointment`, `/pay/:token`, `/online-second-medical-opinion/*` |
| **User account** | `/user/*` (10 routes), `UserLayout.jsx` |
| **Doctor** | `/doctor-dashboard/*` (15), `DoctorLayout.jsx`, enrollment wizard with its own standalone UI (`App.jsx:1107-1139`) |
| **Employee** | `/employee-dashboard/*` (5), `EmployeeLayout.jsx` |
| **Partner** | `/partner-dashboard/*` (5), `PartnerLayout.jsx` |
| **Admin** | `/admin-dashboard/*` (25), `/superadmin-dashboard/*` (2), `/payment-admin/*` (4), `AdminLayout.jsx`, email client with `EmailLayout.jsx` and nested routes (`App.jsx:1551-1554`) |
| **Video call** | `/video-call/*`, `/direct-video-call/*` (full-screen, no header/footer) |
| **Leftover / dev routes on production** | `/test` (`App.jsx:1202`), `/images` (`1207`), `/cookies` (renders the banner as a page, `1205`), `/ServiceDemo` (`2984`) |

### 2.2 Layouts and shared components

- `AppLayout` (`App.jsx:3120-3130` region) renders the shared `Header` and `Footer` for everything **except** paths starting with `/doctor-dashboard`, `/admin`, `/payment-admin`, `/superadmin`, `/employee`, `/partner`, `/user`, `/pay/`, `/video-call`, `/direct-video-call`. That is a hand-maintained string-prefix list, so any new area has to be added by hand.
- Each logged-in area has its own layout (`AdminLayout`, `DoctorLayout`, `EmployeeLayout`, `PartnerLayout`, `UserLayout`). These are independent implementations, not variants of one shell.
- Shared: `Header.jsx` (active state via `location.pathname === item.link`, `Header.jsx:340,388`; `aria-expanded` on the mobile toggle, `:373`), `Footer.jsx`, `NotFound.jsx`, `CookieBanner`, `FAQ`, `SessionTimeoutManager` (an inline modal, `App.jsx:~1090-1105`).
- Public pages that bypass the shared header/footer: none found. The enrollment wizard `DoctorEnrollmentsWrapper` (`App.jsx:1107`) deliberately skips `DoctorLayout`.

### 2.3 Component architecture

- `src/components` has 57 files, and no shared primitives. No `Button`, `Input`, `Modal`, `Table`, `Toast`, `Badge`, `Skeleton` or `EmptyState` component exists. Only one modal component file (`DeleteAccountModal.jsx`).
- Duplicated patterns, by evidence of class families: partner pages repeat the same `pt-*` set (`pt-page`, `pt-btn`, `pt-table`, `pt-badge`, `pt-stat`, `pt-card`, `pt-empty`, ...) in 4-5 CSS files; `hc-card`, `btn-primary`, `badge`, `eyebrow` are redefined in 3-6 files each. 291 class names are defined in 2 or more CSS files, 79 in 3 or more. Because CSS is global, a later import can silently override an earlier one.
- Pages that build their own overlay: 12 JSX files use `position: "fixed"` inline, 71 files use their own `modal`/`overlay` class.
- Dead and backup code still in `src`: `Header-old.jsx`, `header-old.css`, `Login-old.jsx`, `PrescriptionSlip-old.jsx`, `AppointmentBookingbackup.jsx`, `DoctorProfile-old.jsx`, `Conditions/AaSample.jsx`, `hero-new.jsx`, `MDemo.jsx`, `Findadoctor.jsx`, `AmbientBackdrop.jsx`, `AppointmentChat.jsx`, `user/Profile.jsx`, `Categories/ChildMain.jsx`. These 16 `.jsx` files are imported by nothing (my script matches on file name, so verify before deleting). Nine CSS files are never imported: `header-old.css`, `admin/AdminAssignCategoryDoctor.css`, `admin/Login.css`, `doctors/Doctor.css` (1,751 lines, 121 `!important`), `doctors/DoctorEnrollments.css`, `employee/EmployeeLayout.css`, `terms.css`, `user/profile.css`, `user/ProfileSettings.css`. This also means some of the font `@import` lines counted in Part 1 sit in dead files.
- Icons: 3 libraries in use. `lucide-react` (238 imports), `react-icons` across 8 sub-packages (`fi` 61, `md` 33, `gi` 30, `fa` 6, `fa6` 3, `bs` 2, `tb` 1, `ri` 1).

---

## 3. Findings per area

### 3.1 Layout and structure

- **Medium: container widths are not standardised.** Max-widths in use: 900 (60 times), 1024 (35), 1200 (25), 1100 (11), 1280 (10), 1180, 1240, 1400, 1500 (`home.css:55,1760`), and 1160 (`contact.css:49`, `AboutPage.css:15`). Content edges move between pages. *Fix:* define 2-3 container widths (reading, standard, wide) and use them.
- **Medium: z-index chaos.** About 50 distinct values from -10 to 999999: 9998, 9999 (9 uses), 10000, 10001, 99999 (`CookieBanner.css:6`), 999999. Examples of arms-race values: `DoctorPatients.css:565,597` ("must beat the app's sidebar"), `AdminDashboard.css:823,1057`, `ManageUsers.css:9`, `Appointment.css:1281`, `App.css:803`. *Why it matters:* modals, banners and dropdowns can end up behind each other. *Fix:* a small named scale (base, dropdown, sticky, overlay, modal, toast) as variables.
- **Low: overflow risks.** At 375 px no page had document-level horizontal scroll. Elements wider than the viewport exist but are contained: marquee and orb decorations on home (`.testi-marquee-row`, `.t-orb`), `.quick-nav__pill` on `/support-center`, `.slider-nav-v2` on `/corporates`, `.solve-card__glow` on `/about-us`, and `table.compare` (520 px) on `/what-is-telemedicine`. I did not confirm each one is clipped or scrollable.
- **Low: 100% fixed-height patterns** (`height: 48px` etc.) are fine for controls. A scan of fixed large widths was not exhaustive.

### 3.2 Responsive design

- **High: breakpoint sprawl.** 65 distinct width values in media queries. Most common: 900 (55), 640 (46), 768 (45), 1024 (35), 480 (29), 420 (29), 380 (15), 600 (14), plus one-offs such as 399, 450, 520, 540, 560, 639, 760, 767, 769, 820, 860, 960, 980, 991, 992, 1023, 1199. Mixing 767/768/769 and 1023/1024 creates one-pixel gaps and layout flips at different widths on different pages. *Fix:* adopt 4-5 shared breakpoints (e.g. 480, 768, 1024, 1280).
- **Medium: tables.** 49 `<table>` elements, 26 with a wrapper class, 42 `overflow-x: auto` rules across CSS. Mostly handled, but the `.compare` table at `/what-is-telemedicine` measured 520 px wide at 375 px; confirm it scrolls inside its wrapper.
- **Medium: touch targets.** Rendered count of interactive elements under 44 px (width or height) at 375 px: home 33 of 76, login 34 of 77, contact 34 of 58, `/support-center` 37 of 153, blogs 37 of 55, categories 36 of 104, chronic-care 64 of 110. Many are footer and in-text links. *Fix:* raise minimum hit area (padding) on nav, footer and chip links, and form controls.
- **Medium: hover-only styling.** 684 `:hover` rules but only 1 `@media (hover: hover)` guard. On touch screens hover states stick after a tap. I did not find content that is reachable only by hover.
- **Pass:** at 375 / 768 / 1440 px the 15 sampled public pages had no page-level horizontal overflow; header collapses to a menu button at 375 (`cdp__375.png`).
- **Low: the sampled mobile header logo is small** compared with the very large footer logo (see Part 1 screenshots), and the dark "CONNECT" wordmark on the footer's navy background is hard to read.

### 3.3 Navigation and information architecture

- **High: the catch-all `/:slug` route** described in the summary (`App.jsx:3112`, `Blogs/BlogPost.jsx:20-37`).
- **Medium: duplicate and typo routes.** 37 paths are declared more than once, e.g. `/chronic-care/neurology` ×3 (`App.jsx:1878, 1912`, and one more), `/chronic-care/pulmonology` ×3, `/chronic-care/gastroenterology` ×3, `/corporates` ×2 (`1181, 1185`), `/appointment-booking` ×2, the legal pages ×2 each. The first match wins, so the second is dead. The URL `/weight-and-nurtrition` (`App.jsx:1853`) is misspelled ("nutrition"), and it is the public URL. Two near-identical routes exist for several pages (`/mens-health-men-health`, `/urinary-symptoms-men` vs `/urinary-symptoms-in-men`, `/refund-and-cancellation-policy` vs `/refund-cancellation-policy`, `/tele-health-informed-consent` vs `/telehealth-informed-consent`). Mixed URL case: `/CCPA`, `/ServiceDemo`.
- **Medium: dev routes live in the production router** (`/test`, `/images`, `/cookies`, `/ServiceDemo`).
- **Low: no breadcrumbs** on about 150 deep specialty and condition pages. `Breadcrumb` appears in only 6 files (all booking-related). Users arriving from search have no visible path back to the category.
- **Pass:** all 846 internal `to=` / `href=` / `navigate()` string targets I checked resolve to a declared route. The header has an active state (`Header.jsx:340`). `ScrollToTop` is mounted. A `NotFound` page with `noindex` exists (`NotFound.jsx`).
- **Low: login redirects.** `Login.jsx:393` reads `location.state?.from`, so deep-link return works for guarded routes. Redirect behaviour after logout was not tested because it needs sessions.

### 3.4 Component consistency

- **High: no design-system primitives** (see 2.3). Counts: 157 button class families, 11 modal/overlay families, 34 badge families, 49 tables, 3 icon libraries (8 `react-icons` packs).
- **Medium: inline-styled one-off buttons** on account pages (`user/ProfileSettings.jsx:552,566`, `user/ChangePassword.jsx:375,386`) with their own padding, radius and blue shadow.
- **Medium: feedback is inconsistent.** No toast library is installed (0 hits). Native `alert()` / `window.alert()` appears in 7 places (`admin/AdminCategoryConsultations.jsx:135`, `admin/GOP.jsx:257`, `admin/ManualInvoices.jsx:397`, `CategoryConsultant.jsx:328`, `NewServices/ServiceContact.jsx:32,36`, `user/PaymentHistory.jsx:82`) and `confirm()` in 11. Native dialogs block, cannot be styled, and are poor on mobile.
- **Low: CTA wording differs.** "Book Appointment" (3), "Book an Appointment" (1), "Get Started" (13), "Contact Us" (12), and auth wording "Login" (3), "Log in" (1), "Register" (2) while the login page says "Sign In" / "Sign Up". *Fix:* one verb per action.

### 3.5 Forms UX

- **Medium: autocomplete is almost absent.** 18 `autoComplete` uses across 420 form controls. The rendered login form had none, so password managers and browser autofill work poorly. Same for contact and booking forms.
- **Medium: label association cannot be proven.** 325 of 420 controls lack `id`/`aria-label`; labels are mostly implicit wrappers (248 `<label>`, 77 `htmlFor`). Rendered checks on `/login` and `/contact-us` found all fields labelled. `/appointment-booking` has 1 field (the search box) with only a placeholder (no label).
- **Medium: validation and errors.** Only 28 `aria-invalid` / `aria-describedby` / `role="alert"` uses in the whole app, so error messages are mostly not announced to screen readers and not linked to their field.
- **Low: required indicators.** 6 of 9 fields on login are `required`; visible required markers were not checked in code.
- **Low: `DoctorCareers.jsx:450`** has a TODO where the form submit is not wired to an API.
- **Pass:** submitting/disabled states exist in many forms (e.g. `opacity` + `not-allowed` on submit buttons in `BookAppointment.jsx` and `user/ChangePassword.jsx`). Phone input uses `react-phone-input-2` with a custom country list (`PhoneInputField.jsx`).

### 3.6 UI states

- **Medium: loading UI is inconsistent.** Skeleton/shimmer exists in 14 files, "Loading..." text in 31 files, spinners/loaders in 63 files. Route loading renders an empty `<main aria-hidden="true">` (`App.jsx:1173`), so each lazy page shows a blank screen until its chunk arrives. `BlogPost.jsx:34-36` renders an empty `min-height: 60vh` while loading.
- **Medium: error states are bare.** Examples: `BlogPost.jsx:37` (plain sentence, no retry button), `Services` page showed "Services are not available right now" with no retry when the API failed.
- **Low: empty states** exist in 34 places, with different wording and styling.
- **Low: layout shift risk.** Images on the rendered pages have no width/height attributes (see 3.8).

### 3.7 Accessibility (beyond contrast)

- **High: headings.** `/login` renders 4 `<h1>` (also `/book-appointment` and `/user/*`, which show the login view when logged out). `/appointment-booking` has 0 `<h1>`. The 404 view I saw had 0. Heading levels skip at least once on each sampled page.
- **High: landmarks.** 9 of 15 sampled public pages have no `<main>`. All pages have `<nav>` (1-2) and `<header>`/`<footer>`. There is no skip-to-content link anywhere. (`<main>` appears in 313 JSX files, so many logged-in screens are fine; the gap is on public pages.)
- **High: focus.** 95 `outline: none` rules vs 39 `:focus-visible` rules. Keyboard users lose their position on those controls. Check `Login.css:153,190` first.
- **Medium: clickable `div`s.** 28 `onClick` on `div`/`span`/`li`; a few are real controls with no keyboard support: `admin/AdminOverview.jsx:65`, `admin/SupportTickets.jsx:227`, `doctors/RaiseTicket.jsx:195`, `employee/EmployeeDashboard.jsx:155`. Only 7 uses of `role="button"` in the project. Backdrop clicks (`email/MiParts.jsx:14`) are acceptable.
- **Medium: modals.** 15 `aria-modal`/`role="dialog"` uses and 11 files handling Escape against 71 files with their own modal/overlay classes. Most hand-built overlays likely lack focus trapping and focus return. Not tested at runtime.
- **Medium: motion.** 17 CSS files respect `prefers-reduced-motion` while 54 files define `@keyframes`, and GSAP, Framer Motion and Lenis smooth-scroll (`App.jsx:3123`) are used in 39 files. Smooth scrolling and marquees run for users who asked for reduced motion unless guarded elsewhere.
- **Pass:** `<html lang="en">` (`index.html:2`). Images have alt text (1 `<img>` without `alt`: `employee/EmployeeTasks.jsx:989`; 4 intentionally empty). 252 `aria-label` uses and 0 icon-only buttons without a label in a multi-line scan. Mobile menu uses `aria-expanded`.

### 3.8 Images and media

- **High: unreferenced giant files in `src/assets/CATEGORIES/` (1.png-7.png, 5.5-10 MB each).** Not imported by any file, so not in the bundle, but they bloat the repo and clone size. `src/assets/gifts/scene-card-bg-video.mp4` is 9.7 MB (also unused by the grep). `hero-bg1.jpeg` is 2.5 MB. Delete or compress.
- **Medium: layout shift.** On every rendered page, images had no `width`/`height` attributes (3 of 3 on most pages, 7 of 7 on `/about-us` and `/what-is-telemedicine`, 16 of 16 on `/corporates`). A source-wide count was not reliable, because JSX tags span several lines.
- **Medium: lazy loading** is used on 54 `<img>`, good on `/corporates` (13 of 16) and `/about-us` (4 of 7), but absent on blogs, categories and home at mobile width (0 of 3).
- **Medium: hero video** `HeroVideo-*.mp4` (1.8 MB) in `dist/assets`; check it does not autoplay on mobile data.
- **Low: favicon variants.** Only one `<link rel="icon" href="/single-logo.png">` (`index.html:61`); `public/` also holds `favicon.svg` but no `apple-touch-icon` or `manifest`. OG and Twitter image tags exist (`index.html:78-110`), but `Specialties.jsx:648` has "TODO: replace with a real, hosted OG image before launch".

### 3.9 Animations and interactions

- **Medium: transition durations are scattered.** Most-used: 0.2s (159 + 28 as `.2s`), 0.15s (98 + 14), 0.3s (59), 0.25s (54 + 27), 0.18s (53), 0.22s (26), 0.16s (20), and 0.1s. Easing is mixed between `ease`, `ease-in-out` and custom cubic-beziers (`App.css:ease` token vs many one-offs). 115 `transition: all` rules animate layout-affecting properties unnecessarily.
- **Low: heavy animation stack.** GSAP, Framer Motion, Swiper and Lenis are all present (about 39 files use animation libraries) alongside CSS keyframes in 54 files.
- **Low: hover effects for the same component type differ** (lift, glow, colour shift) across pages; no tokenised hover style.

### 3.10 CSS architecture and quality

- **High: global CSS in 101 files, about 1.6 MB.** Largest: `videocall.css` (2,827 lines), `home.css` (2,127), `categoriesGlobal.css` (1,947), `Doctor.css` (1,751, dead), `Categories.css` (1,599).
- **High: class collisions.** 291 classes are defined in 2 or more files and 79 in 3 or more (e.g. `eyebrow` ×6, `btn-primary` ×4, `badge`, `hc-card`, the whole `pt-*` set ×4-5, `is-active` ×4). Page CSS stays loaded after navigation in an SPA, so styles from one page can change another.
- **High: 594 `!important`.** Concentrated in `log.css` (224), `doctors/Doctor.css` (121, dead file), `components/Sa.css` (79). This signals specificity fights.
- **High: 2,048 inline `style={{}}`** in JSX. Highest: `admin/AdminDoctorProfile.jsx` (196), `doctors/DoctorEnrollments.jsx` (63), `doctors/DoctorProfile.jsx` (62), `components/MedicalCertificateSlip.jsx` (61, acceptable for print). Inline styles cannot respond to media queries or hover, which is why account pages are weaker on mobile.
- **Medium: dead files.** 9 unimported CSS files, 16 unimported components (see 2.3), plus `src/scratch/update_fonts.js`.
- **Medium: Tailwind is imported (`index.css:1`) and some Tailwind-style utility classes appear (about 778 ambiguous matches), but no config or design tokens connect to it.** It adds Preflight resets that interact with the page CSS. Decide to use it properly or remove it.
- **Pass:** `index.css` and `App.css` do define shared variables (`:root` tokens) and a reset.

### 3.11 Content and copy

- **Medium: CTA and terminology variations** (see 3.4).
- **Medium: URL and visible-name typos.** "nurtrition" in `/weight-and-nurtrition` (`App.jsx:1853`) and the matching component name `WeightNurtrition`.
- **Low: leftover TODOs** in user-facing flows: `DoctorCareers.jsx:450` (form not wired), `PrivacyPolicies/DeleteAccount.jsx:9,150` (legal wording needs review), `Specialties.jsx:648` (OG image). No "lorem ipsum" found. I did not proofread visible copy.
- **Low: sentence case vs Title Case** for headings and buttons is mixed (for example "Go Back Home" vs "Stay signed in"). Not counted systematically.

### 3.12 SEO / meta that affects UI

- **Medium: titles are per-route on public pages** (72 files use Helmet, `document.title` 0). Rendered titles were correct for `/`, `/blogs`, `/contact-us`, `/medical-services`, `/about-us`, `/categories`, `/corporates`, `/service-areas`, `/what-is-telemedicine`, `/chronic-care`. But `/login`, `/zzz` and `/pay/*` kept the generic `index.html` title, "Humancare Connect | Online Doctor Consultation & Telehealth".
- **Medium: `sitemap.xml` and `robots.txt` are not in `public/` and were not in the current `dist/`.** `scripts/generate-sitemap.mjs:180-181` writes them into `dist` at build time (so they exist after `npm run build`, but not in this stale `dist`). Confirm the deploy build runs that script.
- **Low:** OG image and favicon notes in 3.8; `theme-color` is set.

### 3.13 Perceived performance

- **High: bundle weight.** `dist/assets` is 31 MB across 460 JS/asset files. Large chunks: `vendor-react` 716 KB, `index` 656 KB, `state` 555 KB, `jspdf` 400 KB, `vendor-animation` 324 KB, `html2canvas` 200 KB. The 386 route components are lazy-loaded (good), but `jspdf` and `html2canvas` are heavy for one-off PDF features; check they load only on demand.
- **Medium: render-blocking resources.** Google Fonts and Fontshare are loaded as blocking `<link rel="stylesheet">` and again as CSS `@import` (Part 1, H2). `@import` inside page CSS chains requests.
- **Medium: 4 animation/scroll libraries** (GSAP, Framer Motion, Lenis x2: both `lenis` and `@studio-freight/lenis` are in `package.json`) loaded for visual effects.
- **Low: duplicate dependencies.** Both `react-helmet` and `react-helmet-async`, both `lenis` and `@studio-freight/lenis`, `react-icons` and `lucide-react`.

---

## 4. Ratings

| Category | Score | Reason |
|---|---|---|
| Visual consistency | **5.0** | Brand look is coherent on the public site, but 7 unloaded fonts, 791 colours, 50+ font sizes and per-area styles (Part 1) break consistency. |
| Layout and structure | **6.0** | No overflow on sampled pages and sane page shells, but 9+ container widths and z-index up to 999999. |
| Responsive / mobile | **6.5** | No horizontal scroll at 375/768/1440 on 15 pages; undermined by 65 breakpoints, many small touch targets and heavy inline styles. Logged-in areas not rendered. |
| Navigation | **6.5** | All 846 internal links resolve and header has active state; catch-all `/:slug` hides the 404, duplicate routes, dev routes, no breadcrumbs. |
| Component reuse | **4.0** | No shared UI primitives; 157 button variants, 11 modal families, 3 icon libraries, 16 orphaned components. |
| Forms UX | **5.5** | Labels and submit states exist on rendered forms; autocomplete and error association are weak, and native alerts are used for feedback. |
| UI states | **5.0** | Loading, empty and error states exist but are inconsistent; blank route fallback and bare error text. |
| Accessibility | **5.0** | Good: `lang`, alt text, 252 aria-labels. Poor: 4 h1s on login, missing `<main>` on most public pages, no skip link, 95 outline removals, clickable divs. |
| CSS code quality | **3.5** | 594 `!important`, 2,048 inline styles, 79 widely shared class names, 9 dead CSS files, global CSS in 101 files. |
| Performance (UI-related) | **4.5** | Route-level code splitting is good; large vendor chunks, 55 MB of unreferenced images, blocking font loads. |

**Weighted overall:**

| Category | Score | Weight | Contribution |
|---|---|---|---|
| Visual consistency | 5.0 | 15% | 0.750 |
| Responsive | 6.5 | 15% | 0.975 |
| Accessibility | 5.0 | 15% | 0.750 |
| Layout | 6.0 | 10% | 0.600 |
| Navigation | 6.5 | 10% | 0.650 |
| Component reuse | 4.0 | 10% | 0.400 |
| Forms | 5.5 | 10% | 0.550 |
| UI states | 5.0 | 5% | 0.250 |
| CSS quality | 3.5 | 5% | 0.175 |
| Performance | 4.5 | 5% | 0.225 |
| **Total** | | **100%** | **5.325, rounded to 5.3 / 10** |

---

## 5. Prioritised roadmap

**Quick wins (under 1 day)**
- Make unknown URLs reach the 404 quickly: restrict `/:slug` (`App.jsx:3112`) to a known slug pattern or show `NotFound` on the lookup error as well as on 404.
- Fix headings: one `<h1>` on `/login` and the booking pages; add one to `/appointment-booking`.
- Wrap public page content in `<main>` and add a skip link in the shared layout.
- Add `autoComplete` to login, register, contact and booking fields.
- Remove dev routes (`/test`, `/images`, `/cookies`, `/ServiceDemo`) and the duplicate route entries; fix the `nurtrition` spelling with a redirect from the old URL.
- Delete or move unreferenced assets (`src/assets/CATEGORIES/*.png`, unused videos) out of the repo.
- Replace `alert()` calls (7) with an inline message.
- Add `loading="lazy"` plus `width`/`height` to images below the fold.

**Medium (about 1 week)**
- Create a small shared UI kit: Button, Input/Field (label, hint, error), Modal (focus trap, Escape, aria-modal), Toast, Skeleton, EmptyState, Table wrapper, Badge.
- Define variables for breakpoints, container widths, z-index scale, transition durations and hover styles.
- Restore visible `:focus-visible` styles and remove `outline: none` where there is no replacement.
- Delete the 9 dead CSS files and 16 orphaned components after confirming nothing loads them.
- Standardise CTA and auth wording.
- Consolidate font loading (Part 1) and set up a real route-loading fallback (skeleton or spinner).
- Raise touch target size for header, footer and chip links.

**Large refactors**
- Move page CSS to scoped CSS Modules, or adopt Tailwind fully with a theme, to end global class collisions and the `!important` arms race.
- Replace inline-style-heavy pages (`AdminDoctorProfile.jsx`, `DoctorEnrollments.jsx`, `ProfileSettings.jsx`) with component classes.
- Collapse the four per-area layouts into one shell with configurable sidebar, and drive the header/footer hide list from route metadata instead of path prefixes.
- Generate the 150+ condition and specialty pages from data and one template instead of one JSX file each.
- Pick one icon library and one animation library, and lazy-load `jspdf` / `html2canvas`.
- Add automated checks (axe, Lighthouse CI, Playwright screenshots) to the build.

---

## 6. Limitations

- **Authenticated areas were not rendered** (user, doctor, admin, employee, partner, payment-admin, video call, email client). They redirect to the login view without credentials, so their scores come from code only. No real data, no sessions, and no backend were available, so lists, tables and detail pages were seen only in their empty or error state.
- **The rendered build is `dist/` from 6 Oct 17:25**, served by `vite preview`; it may not match the latest `src/`.
- **No real devices.** Mobile checks were Chrome headless with device-metrics emulation at 375, 768 and 1440 px. No Safari, Firefox, iOS or Android testing. An initial screenshot attempt at 375 px with Chrome's plain `--window-size` flag was discarded because headless Chrome enforces a minimum window width; the rendered numbers in this report come from the DevTools emulation run.
- **Counts are grep-based and approximate**, especially "unused" files (matched by file name), clickable `div`s, label association (implicit `<label>` wrapping is not detected) and Tailwind usage (utility names overlap with custom class names).
- **Touch-target counts** include every link and control at the given width, including inline text links that WCAG allows to be smaller.
- **Not tested:** screen-reader behaviour, keyboard traversal and focus trapping at runtime, real performance (Lighthouse, Core Web Vitals), print styles, email templates, copy spelling beyond a few greps, and redirect behaviour after login/logout.
