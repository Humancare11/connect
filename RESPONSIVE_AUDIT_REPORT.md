# Responsive Design Audit Report

Audit date: 2026-10-02  
Scope: `connect/frontend` presentation sources. No application source files were modified.

## Executive Summary

| Measure                                                              |                                  Result |
| -------------------------------------------------------------------- | --------------------------------------: |
| Presentation-capable source files statically inventoried             |                                     599 |
| Stylesheets scanned                                                  |                                     100 |
| Page modules inventoried                                             |                                     418 |
| Shared component modules inventoried                                 |                                      36 |
| Route declarations in `src/App.jsx`                                  |                                     462 |
| Unique active route patterns extracted from the Vite-transformed app |                                     407 |
| Media-query occurrences / unique query expressions                   |                                486 / 69 |
| Numeric media-query values extracted                                 |                                      54 |
| Confirmed and risk-qualified issues below                            |                                       9 |
| Severity counts                                                      | Critical: 1; High: 2; Medium: 4; Low: 2 |

The confirmed defects are the 300px global body minimum at extra-small widths, an overflowing four-column Conditions grid on the Specialties page, and a clipped email address on Contact. Mobile measurements also found a 34x28px hamburger button, 40.75px booking tabs, and a 15px search input. Fixed `100vh` shells and safe-area behavior are risk items requiring real iOS verification.

**Coverage note:** All 100 stylesheets and 599 presentation-capable frontend source files were inventoried and searched for responsive/layout patterns. The requested 33-width matrix was measured after font stabilization on nine representative route families. All 407 active route patterns were separately smoke-tested at 320px and 1440px (814 states; seven redirects). This is not a full 407-route x 33-width screenshot matrix. A representative mobile/tablet landscape set was also checked. Actual browser zoom at 150%/200%, iOS Safari, and screenshots for every page/state were unavailable; findings depending on those environments are marked accordingly, not asserted as observed defects.

## Breakpoint Inventory

Counts below are unique stylesheets containing a media query with that numeric value. There are 53 distinct pixel width values listed here; the remaining numeric query value is non-width. Values are intentionally listed rather than normalized because non-matching breakpoints are part of the audit finding.

| Breakpoint value | Stylesheets using it | Notes on inconsistency                                           |
| ---------------: | -------------------: | ---------------------------------------------------------------- |
|            320px |                    9 | Doctor workspace files only; global body minimum is also 300px.  |
|            340px |                    1 | Isolated in `EverydayCareSection.css`.                           |
|            350px |                    1 | Isolated in `AppointmentBooking.css`.                            |
|            360px |                    6 | Separate from common 375/380/400 mobile transitions.             |
|            375px |                    1 | Isolated in `WhyChooseUs.css`.                                   |
|            380px |                   15 | Common component/page breakpoint, but not shared as a token.     |
|            399px |                    4 | Coexists with 400px and 420px rules.                             |
|            400px |                    7 | Used by booking, contact, home and other components.             |
|            420px |                   32 | One of the most common phone breakpoints.                        |
|            425px |                    1 | Isolated in `videocall.css`.                                     |
|            450px |                    9 | Header and selected page rules; no shared mobile token.          |
|            479px |                    2 | Isolated in demo and condition detail styles.                    |
|            480px |                   24 | Common, but sits beside 479px and 520px rules.                   |
|            520px |                    8 | Includes component and video-call styles.                        |
|            540px |                    4 | Separate from 520px/560px conventions.                           |
|            560px |                    6 | Separate from 540px/580px conventions.                           |
|            580px |                    1 | Isolated in user profile settings.                               |
|            599px |                    3 | Coexists with 600px and 640px rules.                             |
|            600px |                   16 | Used as a minimum in some rules and maximum in others.           |
|            601px |                    1 | Isolated tablet range in admin Manage Users.                     |
|            620px |                    2 | Isolated in admin healthcare management and doctor notes.        |
|            639px |                    3 | Coexists with 640px and 641px rules.                             |
|            640px |                   43 | Major shared breakpoint; still adjacent to 639px/641px.          |
|            641px |                    1 | Isolated admin Q&A tablet rule.                                  |
|            700px |                    1 | Isolated in doctor layout.                                       |
|            720px |                    1 | Isolated in employee task layout.                                |
|            760px |                    4 | Admin and individual blog rules.                                 |
|            767px |                    7 | Coexists with the much more common 768px transition.             |
|            768px |                   39 | Major shared breakpoint; min- and max-width rules both occur.    |
|            769px |                    3 | Isolated min-width rules in admin/user layouts.                  |
|            820px |                    3 | Used in marketing and admin styles.                              |
|            821px |                    1 | Isolated adjacent tablet breakpoint in `Sa.css`.                 |
|            860px |                   10 | Used across booking, condition, doctor and employee layouts.     |
|            900px |                   54 | Most common breakpoint; many distinct layout decisions share it. |
|            940px |                    1 | Isolated employee task breakpoint.                               |
|            960px |                    3 | Header, FAQ and medical-question styles.                         |
|            961px |                    1 | Isolated min-width FAQ rule adjacent to 960px.                   |
|            980px |                    3 | Header, admin and employee layouts.                              |
|            991px |                    4 | Coexists with 992px.                                             |
|            992px |                    6 | Includes video-call and ranged tablet rules.                     |
|           1000px |                    1 | Isolated admin Manage Users rule.                                |
|           1023px |                    4 | Coexists with 1024px.                                            |
|           1024px |                   39 | Major shared breakpoint.                                         |
|           1050px |                    1 | Isolated doctor notes breakpoint.                                |
|           1080px |                    3 | Marketing/blog-specific.                                         |
|           1100px |                    7 | Marketing, doctor and admin rules.                               |
|           1180px |                    1 | Header-specific.                                                 |
|           1199px |                    5 | Coexists with 1200px.                                            |
|           1200px |                    8 | Common desktop/container transition.                             |
|           1279px |                    1 | Isolated condition detail breakpoint adjacent to 1280px.         |
|           1280px |                    5 | Booking, category and specialty layouts.                         |
|           1399px |                    2 | Coexists with 1400px.                                            |
|           1400px |                    1 | Isolated home-page min-width transition.                         |

Additional media features: `(max-width: 992px) and (max-height: 520px)` occurs once; coarse-pointer/hover appears once; `prefers-reduced-motion: reduce` appears in 16 stylesheets; print appears once. Media queries are predominantly max-width, with min-width strategies in PCP, Specialties, Symptoms and the condition detail template. Several exact-width pairs are adjacent rather than a shared token system; no same-selector visual regression was proven solely from those pairs.

## Issue Register

| ID      | Severity | File path & line number                                                                                                                                                                                                                                | Component / Selector                          | Breakpoint / viewport range where it breaks                         | What is breaking (observed problem)                                                                                                                                                                                                                                                   | Root cause (the exact CSS rule/property)                                                                                         | Recommended fix (specific code suggestion)                                                                                                                                                                          |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RWD-001 | Critical | [frontend/src/index.css](frontend/src/index.css#L24)                                                                                                                                                                                                   | `body`, `html`                                | 239–300px                                                           | Horizontal overflow is measurable across sampled routes: at 240px, document scroll width is 300px vs 225px client width; at 300px, scroll width is 300px vs 285px client width. Root clipping suppresses access to the overflow rather than making content fit.                       | `body { min-width: 300px; overflow-x: hidden; }` plus `html { overflow-x: hidden; }` at lines 13 and 22.                         | Remove the 300px minimum; use `min-width: 0`/fluid width and fix actual overflowing children. Replace broad `overflow-x: hidden` with `clip` only after verifying sticky descendants and true overflow are handled. |
| RWD-002 | High     | [frontend/src/pages/Specialties.css](frontend/src/pages/Specialties.css#L1301) and [frontend/src/pages/Specialties.jsx](frontend/src/pages/Specialties.jsx#L809)                                                                                       | `.cat-spec-grid` Conditions strip             | 320–730px observed; grid track overflow persists into roughly 760px | Four Conditions cards exceed the available page width. At 600px, grid client width is 529px but grid scroll width is 690px; the final card reaches x=718px. The root clips the right side and leaves cards/content unreachable.                                                       | `grid-template-columns: repeat(4, 1fr)` has no mobile override for `.cat-spec-grid`; grid items retain intrinsic minimum widths. | Add a responsive grid, e.g. two `minmax(0, 1fr)` columns at tablet and one column at small mobile; add `min-width: 0` to `.cat-spec-item` and allow its text to wrap.                                               |
| RWD-003 | High     | [frontend/src/pages/contact.css](frontend/src/pages/contact.css#L158) and [frontend/src/pages/Contact.jsx](frontend/src/pages/Contact.jsx#L190)                                                                                                        | `.contact-detail__value` email link           | 299–320px                                                           | At 320px, `support@humancareconnect.co` extends about 7px beyond the Contact card/body edge and is clipped; at smaller widths the global minimum-width issue compounds it.                                                                                                            | Email anchor is `display: inline-block` with no `overflow-wrap`; the email is an unbroken token.                                 | Add `overflow-wrap: anywhere` (or `word-break: break-word`) to the email link/value and ensure the flex text container has `min-width: 0`.                                                                          |
| RWD-004 | Medium   | [frontend/src/components/header.css](frontend/src/components/header.css#L548)                                                                                                                                                                          | `.hamburger` shared header control            | Mobile, <=768px                                                     | Browser-measured hit target is 34x28px on 390px viewport, below the 44x44px minimum and difficult to tap reliably.                                                                                                                                                                    | The button only has 6px padding around 22px bars and no minimum inline/block size.                                               | Set `min-width: 44px; min-height: 44px; align-items: center; justify-content: center` while preserving the bar dimensions.                                                                                          |
| RWD-005 | Medium   | [frontend/src/pages/AppointmentBooking.css](frontend/src/pages/AppointmentBooking.css#L1096)                                                                                                                                                           | `.hcc-sx .switch button`                      | <=640px                                                             | At 390px the three numbered tabs measure 40.75px high, under the 44px touch-target guidance. The labels fit after the sub-350 rule, but the vertical target remains short.                                                                                                            | Mobile button padding is `11px 8px` with 12.5px type and no `min-height`.                                                        | Add `min-height: 44px` and center the label contents; retain the narrow-width horizontal sizing rule.                                                                                                               |
| RWD-006 | Medium   | [frontend/src/pages/AppointmentBooking.css](frontend/src/pages/AppointmentBooking.css#L296)                                                                                                                                                            | `.hcc-sx .search input`                       | iOS Safari at mobile widths                                         | Computed search input text is 15px at 390px. iOS Safari may zoom the page when this field receives focus.                                                                                                                                                                             | `font-size: 15px` is below Safari’s 16px focus threshold.                                                                        | Use `font-size: 16px` for the input at mobile sizes; verify placeholder and control fit.                                                                                                                            |
| RWD-007 | Medium   | [frontend/src/pages/doctors/Doctor.css](frontend/src/pages/doctors/Doctor.css#L4) and [frontend/src/pages/admin/Dashboard.css](frontend/src/pages/admin/Dashboard.css#L19)                                                                             | `.dd-page`, `.dash-sidebar`                   | Mobile Safari, landscape and short-height viewports                 | **Needs visual verification.** Fixed `100vh` app shells/sidebar heights can extend under the iOS browser chrome; `.dd-page` also uses `overflow: hidden`, so content depends on internal scroll regions. Auth-gated screens were not available for a real-device check.               | `height: 100vh`; `.dd-page` also sets `overflow: hidden`.                                                                        | Use a `100dvh`/`100svh`-aware shell with a `100vh` fallback; verify all internal panels remain scrollable and bottom controls stay reachable on iOS landscape.                                                      |
| RWD-008 | Low      | [frontend/src/components/header.css](frontend/src/components/header.css#L752), [frontend/src/pages/AboutPage.css](frontend/src/pages/AboutPage.css#L190), [frontend/src/pages/AppointmentBooking.css](frontend/src/pages/AppointmentBooking.css#L1091) | Responsive breakpoint system                  | Adjacent widths across shared layouts                               | **Consistency risk, not a confirmed standalone visual defect.** The codebase uses 54 numeric breakpoint values and 69 distinct media queries; adjacent pairs include 767/768, 639/640/641, 399/400/420, 991/992 and 1023/1024. Related components can switch at different CSS pixels. | Independent per-file breakpoint literals; both min-width and max-width strategies are used.                                      | Define shared breakpoint custom properties/design tokens and standardize transitions; retain exceptions only when tied to a documented component requirement.                                                       |
| RWD-009 | Low      | [frontend/index.html](frontend/index.html#L5), [frontend/src/pages/videocall.css](frontend/src/pages/videocall.css#L2474)                                                                                                                              | Viewport meta and fixed edge-to-edge overlays | iOS notch/safe-area devices                                         | **Needs visual verification.** The viewport tag is present, but lacks `viewport-fit=cover`; safe-area padding is used only by selected bottom controls, not consistently on fixed full-screen overlays. iOS notch/gesture-area overlap was not tested.                                | Viewport meta is `width=device-width, initial-scale=1.0`; no `viewport-fit=cover` was found.                                     | If edge-to-edge UI is intended, add `viewport-fit=cover` and apply `env(safe-area-inset-*)` to fixed overlay/control insets; verify on a notched iPhone.                                                            |

## Issues by Viewport Range

| Range       | Findings                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Under 300px | RWD-001: body remains at least 300px; horizontal overflow is measurable and clipped. RWD-002 and RWD-003 can compound it.                                       |
| 300–374px   | RWD-002: Specialties Conditions grid overflows through this band. RWD-003: Contact email clips near 320px. RWD-004 and RWD-005 remain undersized touch targets. |
| 375–480px   | RWD-002 persists; RWD-004/RWD-005/RWD-006 affect mobile navigation and booking.                                                                                 |
| 481–767px   | RWD-002 remains through the measured 730px cutoff; grid cards still exceed their own track/container up to roughly 760px.                                       |
| 768–1023px  | No additional document overflow in the tested representative templates. Breakpoint fragmentation remains a low consistency risk.                                |
| 1024–1439px | No additional document overflow in the tested representative templates.                                                                                         |
| 1440px+     | No document overflow was observed in the representative-page matrix or all-route 1440px smoke.                                                                  |

## Issues by Page or Component

- Global document sizing: RWD-001 affects every route below 300px.
- Specialties page: RWD-002 affects the Conditions strip rendered by `Specialties.jsx`.
- Contact page: RWD-003 affects the email detail row.
- Shared Header: RWD-004 affects the mobile hamburger on public routes.
- Appointment Booking: RWD-005 and RWD-006 affect tab hit areas and search focus behavior.
- Doctor/Admin shells: RWD-007 is an unverified mobile viewport-height risk.
- Shared breakpoint strategy and edge-to-edge overlays: RWD-008/RWD-009 are consistency/device risks.

## Scope Inventory

- Frontend source scanned: 599 files under `frontend/src`: 100 CSS stylesheets, 418 page `.jsx` modules, and 36 shared component `.jsx` modules plus app/context/utility sources. No `.module.css`, SCSS/SASS/LESS, Tailwind config file, styled-components package, or Emotion package was found.
- Shared component modules (36): `booking/BookingCard.jsx`, `booking/ServiceBookingCard.jsx`, `FAQ/FAQ.jsx`, `Aa.jsx`, `AmbientBackdrop.jsx`, `AppointmentChat.jsx`, `CallErrorBoundary.jsx`, `ConsultationNotesPanel.jsx`, `CookieBanner.jsx`, `DatePickerField.jsx`, `Demo.jsx`, `ECGTimeline.jsx`, `EverydayCareSection.jsx`, `Footer.jsx`, `Header-old.jsx`, `Header.jsx`, `HealthcareIcon.jsx`, `Images.jsx`, `IndustrySlider.jsx`, `LazySection.jsx`, `LocationSelects.jsx`, `LogoMarquee.jsx`, `MedicalCertificateSlip.jsx`, `Netaji.jsx`, `NotFound.jsx`, `PCPSection.jsx`, `PhoneInputField.jsx`, `PrescriptionSlip-old.jsx`, `RxSlip.jsx`, `Sa.jsx`, `Seo.jsx`, `ServiceSwitcher.jsx`, `SpecialityBookingCard.jsx`, `StepProgress.jsx`, `WhySection.jsx`, `WordReveal.jsx`.
- Page modules by folder: root 32; `admin` 33; `Blogs` 15; `Categories` 12; `Conditions` 232; `doctors` 18; `employee` 5; `NewServices` 12; `partner` 7; `PrivacyPolicies` 10; `Specialty` 30; `user` 12. Total: 418.
- Route inventory: 462 `<Route>` declarations in [App.jsx](frontend/src/App.jsx#L1172); 426 distinct literal path strings in source including repeated/commented definitions; 407 unique active path patterns in the Vite-transformed runtime source. The active runtime paths were smoke-tested at 320px and 1440px; seven paths redirected (auth/route behavior). Route families include public marketing, appointment booking, blogs, categories/specialties/conditions, user, admin, doctor, employee, partner, payment, and video-call flows.
- Global and tooling checks: [index.html](frontend/index.html#L5) has the correct device-width viewport tag. [index.css](frontend/src/index.css#L8) provides universal `border-box` and constrains `img`, `video`, `canvas`, and `svg` to `max-width: 100%`. Tailwind v4 is imported in `src/index.css` and enabled by `@tailwindcss/vite`; no separate Tailwind config was found. Inline React `style` props exist, primarily for dynamic values; no CSS-in-JS styling library was found.

### Stylesheet Manifest

All 100 stylesheets scanned under `frontend/src`:

```text
App.css
index.css
components/Aa.css
components/AmbientBackdrop.css
components/ConsultationNotesPanel.css
components/CookieBanner.css
components/demo.css
components/ECGTimeline.css
components/EverydayCareSection.css
components/FAQ/FAQ.css
components/footer.css
components/header.css
components/header-old.css
components/industrySlider.css
components/LogoMarquee.css
components/NotFound.css
components/PCPSection.css
components/RxSlip.css
components/Sa.css
components/ServiceSwitcher.css
components/StepProgress.css
components/WhyChooseUs.css
components/WhySection.css
pages/AboutPage.css
pages/admin/AdminAppointments.css
pages/admin/AdminAssignCategoryDoctor.css
pages/admin/AdminAssignDoctor.css
pages/admin/AdminDashboard.css
pages/admin/AdminDirectVideoConsultation.css
pages/admin/AdminUserProfile.css
pages/admin/Dashboard.css
pages/admin/GOP.css
pages/admin/HealthcareManagement.css
pages/admin/Login.css
pages/admin/ManageUsers.css
pages/admin/ManualInvoices.css
pages/admin/PartnerCaseDetail.css
pages/admin/PaymentLinks.css
pages/admin/QnAPage.css
pages/Appointment.css
pages/AppointmentBooking.css
pages/AskDoctor.css
pages/Blogs/Blogs.css
pages/Blogs/telemedicine.css
pages/Categories.css
pages/Categories/categoriesGlobal.css
pages/CategoryConsultant.css
pages/Conditions/Conditions/Condition.css
pages/contact.css
pages/Corporates.css
pages/directvideocall.css
pages/DoctorCareers.css
pages/doctors/Dashboard.css
pages/doctors/Doctor.css
pages/doctors/DoctorAppointments.css
pages/doctors/DoctorEnrollments.css
pages/doctors/DoctorLayout.css
pages/doctors/DoctorNotes.css
pages/doctors/DoctorPatients.css
pages/doctors/DoctorProfile.css
pages/doctors/DoctorQnA.css
pages/doctors/RaiseTicket.css
pages/doctors/WritePrescription.css
pages/employee/Assigntask.css
pages/employee/EmployeeDashboard.css
pages/employee/EmployeeLayout.css
pages/employee/EmployeeLogin.css
pages/employee/EmployeeTasks.css
pages/FAQPage.css
pages/Findadoctor.css
pages/hero-new.css
pages/home.css
pages/log.css
pages/Login.css
pages/mdemo.css
pages/NewServices/newservices.css
pages/partner/partner.css
pages/partner/PartnerCaseDetail.css
pages/partner/Partner-dasboard.css
pages/partner/PartnerLogin.css
pages/partner/Submit.css
pages/PaymentLinkCheckout.css
pages/PCP.css
pages/PrivacyPolicies/PrivacyPolicies.css
pages/register.css
pages/Services.css
pages/Specialties.css
pages/Specialty/SpecialtyPage.css
pages/symptoms.css
pages/terms.css
pages/user/appointment.css
pages/user/dashboard.css
pages/user/MedicalQuestions.css
pages/user/MyRecords.css
pages/user/PaymentHistory.css
pages/user/profile.css
pages/user/ProfileSettings.css
pages/user/RaiseTicket.css
pages/user/user.css
pages/videocall.css
```

## Gaps Analysis

- Width-query coverage exists across the stylesheet set, but there is no shared breakpoint token system; the 54 numeric values create inconsistent transition points.
- Only nine doctor workspace stylesheets define an explicit `max-width: 320px` rule. Most pages rely on base CSS below 320px; the global 300px body minimum makes 239–299px unusable without horizontal overflow.
- Queries at 767/768 and 639/640/641 are adjacent and can apply together at a shared endpoint when mixed min/max conditions are present. A selector-by-selector cascade conflict was not established for every occurrence.
- Viewport ranges are not literally uncovered because base styles apply between media queries; the risk is untested fluid interpolation, not an absence of all CSS.
- Full browser zoom at 150%/200%, iOS Safari address-bar behavior, iOS input focus zoom, and notch safe areas require device/browser verification.
- Tables with internal `overflow-x: auto` wrappers (including admin assignment and partner case views) were treated as intentional contained scrolling, not document overflow; not every table was opened and visually inspected.

## Clean Areas

- Viewport meta tag is present and correct for normal responsive layout.
- Universal `box-sizing: border-box` is set globally.
- Global image/video/canvas/SVG max-width rules prevent common media intrinsic-width overflow.
- Table/data views commonly provide their own horizontal overflow wrapper rather than expanding the document.
- `prefers-reduced-motion` is handled in 16 stylesheets; responsive animation behavior still varies in the remaining files.
- Representative 2560px, 1920px, 1440px, 1366px, 1280px, 1024px, 992px, 820px, 768px, 600px, 480px, 414px, 390px, 375px, 360px, 320px, 300px, 280px, 240px and breakpoint-edge widths were measured on nine route families. Six families were also checked at portrait/landscape dimensions including 390x844, 844x390 and 1024x768.

## Prioritized Fix Roadmap

1. Remove the global 300px body minimum and stop masking real overflow; this directly affects every route at 300px and below.
2. Make the Specialties Conditions grid responsive at tablet/mobile widths; right-hand conditions are currently clipped and the page overflows.
3. Allow the Contact email token to wrap; the address is clipped at common small-phone widths.
4. Raise shared mobile interaction targets to at least 44x44px and booking input text to 16px.
5. Replace fixed `100vh` shell sizing with dynamic/small viewport units after checking internal scroll containers on iOS.
6. Consolidate breakpoint tokens and test both sides of each shared transition; add edge-to-edge safe-area insets only where overlays require them.

## Suggested Global Improvements

- Establish a shared breakpoint scale and document intentional exceptions.
- Prefer `clamp()` for fluid type and spacing, and container queries for reusable components constrained by their parent.
- Preserve `*, *::before, *::after { box-sizing: border-box; }` and `img, video { max-width: 100%; height: auto; }` as shared baselines.
- Replace global overflow masking with root-cause fixes; use `overflow-x: clip` only where clipping is intentional and does not break sticky behavior.
- Add lint/CI checks for document horizontal overflow, sub-44px primary touch targets, and small input text on mobile.

## Completion Checklist

- [x] All 599 frontend source files inventoried; all 100 stylesheets included in automated breakpoint/layout-pattern scans.
- [x] 407 active runtime route patterns smoke-tested at 320px and 1440px.
- [x] Requested exact widths and in-between boundary probes tested on nine representative page families; landscape probes run on six.
- [ ] Every route at every viewport with screenshots: not completed; report coverage and limitations above are explicit.
- [ ] Actual 150%/200% browser zoom and iOS Safari/device verification: not available in this browser session.
- [x] Report saved as `RESPONSIVE_AUDIT_REPORT.md`.
