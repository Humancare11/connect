# UI Consistency Audit: Humancare Connect Web Frontend

Scope: `connect/frontend` (Vite + React 19, Tailwind v4 imported in `src/index.css`, plain CSS per page and component, many inline styles). This was a read-only audit. Counts come from grep over `src/` and `index.html`, so treat them as approximate. `src/scratch/update_fonts.js` was ignored because it is a dev script, not shipped UI.

---

## 1. Summary

**Distinct font families found: 12 named families, plus system and generic stacks.**

| Group | Families |
|---|---|
| Intended brand fonts, loaded | **Satoshi**, **Inter** |
| Named in code but never loaded (silently fall back) | Plus Jakarta Sans, DM Sans, Manrope, Source Serif 4, Fraunces, IBM Plex Mono, Poppins |
| Loaded on only one page | JetBrains Mono (`mdemo.css` only) |
| System and generic | Georgia / Times, Arial / Helvetica Neue, `-apple-system` / Segoe UI / Roboto / `system-ui`, `ui-monospace` / Menlo / `monospace` |

**Top 5 problems**

1. **Seven font families are referenced but never loaded.** Plus Jakarta Sans (about 20 inline uses in the user profile and password pages and the delete-account UI), DM Sans, Manrope (blog), Source Serif 4 (blog), Fraunces (FAQ), IBM Plex Mono (FAQ) and Poppins (Services) only render if the visitor has them installed. Everyone else gets a fallback. The intended look is not what most users see.
2. **Satoshi and Inter are loaded many times over.** They are loaded in `index.html` and `App.css`, and again via `@import` in 10 more CSS files. `@import url()` in CSS blocks rendering and chains requests. `home.css` also requests `satoshi@1`, a different spec than the others.
3. **The same element is styled with different fonts on different pages.** Examples: the account pages use hardcoded Plus Jakarta Sans, booking and checkout pages use DM Sans, employee and partner dashboards use Inter or a system stack, and the public site uses Satoshi for headings and Inter for body. Buttons, inputs and headings do not follow one rule.
4. **Hardcoded font-family values bypass `--font-primary` and `--font-secondary`.** Under the 218 + 172 token uses there are about 80+ hardcoded values. Examples: 12 category pages with `'Satoshi', sans-serif` inline, `FONT` constants in JSX, and 6 stacks starting with `-apple-system`. They have inconsistent fallbacks and spellings.
5. **The core font tokens are defined twice, and `--font-display` has two meanings.** `--font-primary` and `--font-secondary` are declared in both `src/index.css:4-5` and `src/App.css:11-12`. `--font-display` means Manrope in `.blog-page` and Fraunces in `.faq-page`. Other tokens (`--font`, `--font-heading`, `--font-body`, `--mi-serif`, `--ead-font`, `--at-font`, `--et-font`, `--faq-font-*`) add more parallel systems.

Secondary headline: about **791 distinct hex colours**, **half-pixel and odd font sizes**, and **`#94a3b8` / `#9ca3af` text (roughly 90 uses) that fails WCAG AA on white**.

---

## 2. Font Family Inventory

| Font | Where loaded | Where used (file:line) | Usage count | Notes |
|---|---|---|---|---|
| **Satoshi** (Fontshare, 300-900) | `index.html:31-34` (`<link>`); `App.css:4`; `@import` in `AppointmentBooking.css:2`, `Blogs/Blogs.css:2` (400, 500, 700 only), `home.css:3` (`satoshi@1`), `mdemo.css:1`, `user/dashboard.css:8`, `user/ProfileSettings.css:8`, `Findadoctor.css:2` (commented out) | Token `--font-primary` (`index.css:4`, `App.css:11`): about 218 `var(--font-primary)` uses, including headings at `index.css:26`, `App.css:109`. Hardcoded: 12 category pages (`Categories/*.jsx`, e.g. `ChildMain.jsx:438`, `WomenHealth.jsx:505`), `Conditions/EarInfection.jsx:991`, `TravelersDiarrhea.jsx:991`; `AppointmentBooking.css:28` (`--font`); `EverydayCareSection.css:74,97,327,362` | about 240+ | Main heading font. Loaded about 9 times. |
| **Inter** (Google, 300-900) | `index.html:26-29`; `App.css:5`; `@import` in `Appointment.css:6` (400-700), `AppointmentBooking.css:1`, `Blogs/Blogs.css:1` (300-600), `home.css:2` (300-600), `mdemo.css:2` (400-700), `user/dashboard.css:9`, `user/ProfileSettings.css:7`, `user/RaiseTicket.css:6` | Token `--font-secondary` (`index.css:5`, `App.css:12`): about 172 uses, plus `body` (`index.css:17`, `App.css:~65`) and form controls (`index.css:30`, `App.css:119`). Hardcoded: `AppointmentBookingForm.jsx:73`, `EmployeeTasks.css:1242,1461`, `--at-font` `Assigntask.css:52`, `--ead-font` `EmployeeDashboard.css:52`, `--et-font` `EmployeeTasks.css:58`, `EverydayCareSection.css:107,374,398` | about 190+ | Body and UI font. Loaded about 10 times with different weight lists. |
| **Plus Jakarta Sans** | Not loaded anywhere | `user/ProfileSettings.jsx:37,70,126,275,294,347,422,552,566`; `user/ChangePassword.jsx:76,112,143,247,254,279,320,375,386`; `DeleteAccountSection.jsx:8`; `DeleteAccountModal.jsx:7` | about 20 (one is a `<style>` string, `ProfileSettings.jsx:275`) | **Never loaded.** Inline hardcoded. The account area falls back to `sans-serif`. |
| **DM Sans** | Not loaded | `BookAppointment.jsx:49`; `PaymentLinkCheckout.jsx:20` (`'DM Sans', 'Inter', system-ui, sans-serif`) | 2 | Never loaded. It falls back to Inter, which is loaded globally, so the effect is mostly masked. |
| **Manrope** | Not loaded | `Blogs/telemedicine.css:28` (`--font-display`, scoped to `.blog-page`); used by 11 blog JSX files, e.g. `Blogs/Telemedicine.jsx:1670` | 1 definition, about 11 uses | Never loaded. Blog "display" text falls back to `sans-serif`. |
| **Source Serif 4** | Not loaded | `Blogs/telemedicine.css:29` (`--font-serif`) | 1 | Never loaded. Serif body text on blogs falls back to the default `serif`. |
| **Fraunces** | Not loaded | `FAQPage.css:14` (`--font-display`, `.faq-page`) | 1 definition | Never loaded. It falls back to Georgia, serif. |
| **IBM Plex Mono** | Not loaded | `FAQPage.css:16` (`--font-mono`) | 1 | Never loaded. |
| **Poppins** | Not loaded | `Services.css:24` (`--font`) | 1 | Never loaded, and `var(--font)` is not referenced anywhere (dead token). |
| **JetBrains Mono** | `@import` in `mdemo.css:2` only | `EmployeeTasks.css:1270,1285,1321,1333,1361,1391,1423,1445,1544`; `industrySlider.css:24`; `mdemo.css:27` | about 11 | Loaded only if `mdemo.css` has been bundled. The employee tasks page depends on that side effect. With code-splitting it may not be present. |
| **Georgia / Times New Roman** | system | `ManualInvoices.css:27` (`--mi-serif`, 13 uses); `Assigntask.css:494`; `EarInfection.jsx:897`, `TravelersDiarrhea.jsx:897`; `FAQPage.css:14` | about 18 | Only the `ManualInvoices.css` uses are deliberate invoice styling. The others are one-offs. Other hits for "Georgia" are the US state or country (`PhoneInputField.jsx:116`, `Serviceareas.jsx:12`) and are not fonts. |
| **Arial / Helvetica Neue** | system | `MedicalCertificateSlip.jsx:247`; `GOP.css:33-34`; `ManualInvoices.css:34-35`; `searchIndex.js` (text only) | 3 | Printable and admin documents. |
| **System stack** (`-apple-system`, Segoe UI, Roboto, `system-ui`) | system | `admin/PartnerCaseDetail.css:36`; `partner/PartnerCaseDetail.css:27`; `partner/Partner-dasboard.css:30`; `partner/Submit.css:46`; `Appointment.css`; `AppointmentBookingForm.jsx` | about 8 | Four partner and admin files use `-apple-system, ..., Inter, Roboto` with a different order from the main tokens. |
| **monospace** | system | `admin/OurDoctors.jsx:286`, `ManageUsers.jsx`, `ManageUsers.css`, `PaymentHistory.css`, `email/email.css`, `AdminDeletionRequests.css`, `AdminDirectVideoConsultation.css` | about 10 | Mixed `monospace`, `ui-monospace, Menlo, Consolas, monospace` and `ui-monospace, SFMono-Regular, ...`. |

Tailwind: Tailwind v4 is imported (`src/index.css:1`), but there is no `tailwind.config` and no `font-sans`, `font-serif` or `font-[...]` classes in `.jsx`. Tailwind's Preflight and theme `--font-sans` are therefore unused. Fonts are controlled entirely by plain CSS.

---

## 3. Font Family Issues

### High

**H1. Fonts referenced but never loaded (7 families).** See the inventory. Plus Jakarta Sans (`ProfileSettings.jsx`, `ChangePassword.jsx`, `DeleteAccount*.jsx`) is the most visible, because the logged-in account pages render in a fallback font that differs from the rest of the site. The same applies to `.blog-page` (Manrope, Source Serif 4), `.faq-page` (Fraunces, IBM Plex Mono), `Services.css` (Poppins, unused) and `BookAppointment` / `PaymentLinkCheckout` (DM Sans).
*Fix:* Decide per family whether it is intended. If not, replace it with `--font-primary` or `--font-secondary`. If it is, load it once, centrally, and document it. Delete dead definitions such as `--font` in `Services.css:24`.

**H2. Duplicate and redundant loading of Satoshi and Inter.** Both are loaded in `index.html:26-34` and again in `App.css:4-5`, then by `@import` in about 10 other CSS files, each with a different weight list (for example 300-900, 400-700, 300-600, `satoshi@1`). Weight lists such as `Blogs.css:2` (Satoshi 400, 500, 700) load a second copy of the same family and can override or duplicate its `@font-face` declarations. `@import url()` inside CSS also delays rendering. `index.html` also has a duplicate `preconnect` to `fonts.googleapis.com` (lines 20-21).
*Fix:* Load each family once, in `index.html` (`<link>` with `preconnect` to `fonts.gstatic.com`), with the one weight set the site needs. Remove all CSS `@import` font lines. Consider self-hosting.

**H3. Same element type, different fonts across areas.**
- Headings: `--font-primary` (Satoshi) on the public site (`index.css:26`, `App.css:109`); Plus Jakarta Sans on account pages (`ChangePassword.jsx:254,279,320`); Manrope on blogs (`telemedicine.css:28`); Fraunces on FAQ (`FAQPage.css:14`); Inter on employee dashboards (`EmployeeDashboard.css:52`).
- Buttons: inherit `--font-secondary` globally (`index.css:30`), but inline-styled buttons in `ProfileSettings.jsx:552,566` and `ChangePassword.jsx:375,386` set Plus Jakarta Sans, and `fontFamily: "inherit"` is used about 115 times (83 in CSS, 32 in JSX) alongside explicit families.
- Body: Inter on the public site, system stack on partner pages, Georgia on invoices.
*Fix:* Pick one heading font and one body font for the product and apply them through the two tokens only. Keep exceptions only where deliberate, such as printable documents.

### Medium

**M1. Hardcoded font-family bypassing tokens.** About 12 category pages set `fontFamily: "'Satoshi', sans-serif"` inline (see inventory). `FONT` constants in `DeleteAccount*.jsx:7-8`. Inline JSX at `EarInfection.jsx:991`, `TravelersDiarrhea.jsx:991`. `EmployeeTasks.css:1242,1461` hardcode `"Inter", sans-serif`.
*Fix:* Replace each with `var(--font-primary)` or `var(--font-secondary)` or remove it so the element inherits.

**M2. Inconsistent fallback stacks.**
- `--font-primary`: `"Satoshi", "Inter", -apple-system, ..., Roboto, sans-serif` (full)
- `var(--font-primary, 'Satoshi', sans-serif)` (`EverydayCareSection.css`, `FAQ.css:21`) uses a different fallback from the token itself.
- `"Satoshi", "Inter", sans-serif` (`AppointmentBooking.css:28`)
- `'Satoshi', sans-serif` (12 category pages)
- `Satoshi, sans-serif` (unquoted, `EarInfection.jsx:991`)
- `-apple-system, ..., Inter, Roboto, ...` (4 partner and admin files, Inter placed late)
*Fix:* Use a single fallback stack that appears in the tokens only.

**M3. Token definitions duplicated and conflicting.** `--font-primary` and `--font-secondary` are declared at `index.css:4-5` and `App.css:11-12` (identical today but two sources of truth). `--font-display` is Manrope (`telemedicine.css:28`) and Fraunces (`FAQPage.css:14`). Other tokens: `--font` (2 files, both unused), `--font-heading` (`home.css:28`, `CategoryConsultant.css:38`), `--font-body` (3 files), `--ead-font`, `--at-font`, `--et-font`, `--mi-serif`, `--faq-font-heading/body`, `--mono`, `--font-mono`.
*Fix:* Keep one place for tokens (`index.css`). Reuse the same names for the same meaning. Remove local aliases that only wrap the two tokens.

**M4. JetBrains Mono loaded as a side effect.** It is only imported by `mdemo.css:2`, but `EmployeeTasks.css` uses it in 9 places and `industrySlider.css:24` references it. This works only if `mdemo.css` ends up in the same bundle chunk.
*Fix:* Decide whether a monospace font is needed. If so, load it once centrally. Otherwise use one system monospace stack.

**M5. Inconsistent monospace and serif system stacks.** Three different monospace stacks (see inventory). Georgia appears as `Georgia, serif` (`Assigntask.css:494`), `'Georgia',serif` (`EarInfection.jsx:897`) and `Georgia, "Times New Roman", Times, serif` (`ManualInvoices.css:27`).
*Fix:* One mono stack, one serif stack, defined as tokens.

### Low

**L1. Font weights.** Counts across all CSS: 700 (598), 600 (412), 800 (171), 500 (170), 900 (98), 400 (27), plus **non-standard values 650 (23), 550 (7), 850 (6), 750 (1)**. Those values are not in the loaded weight sets and snap to the nearest loaded weight, so 650 and 600 may look identical or different depending on the font. Roles are not consistent (headings use 700, 800 and 900 on different pages; labels use 500, 600 and 700). Weights 300 and 900 are loaded but used rarely (300: 3, 900: 98).
*Fix:* Restrict to 400, 500, 600, 700 (and 800 only if headings need it), then load only those.

**L2. Form elements.** The global rule at `index.css:30` and `App.css:119` makes `input, button, select, textarea` use `--font-secondary`, so default controls are covered. Gaps: third-party widgets (`react-select`, `react-phone-input-2` at `PhoneInputField.jsx`, TipTap `.ProseMirror` in `admin/BlogEditor.css`) and the `.ps-phone .pif-input` override at `ProfileSettings.jsx:275` set their own fonts. The `inherit` pattern is also used in about 115 places that depend on the parent font being correct.
*Fix:* After standardising, confirm third-party widgets inherit from the root, and drop per-component overrides.

**L3. Dead and commented-out code.** `Findadoctor.css:1-2` has commented `@import` lines. `header-old.css`, `Login-old.jsx` and `PrescriptionSlip-old.jsx` still carry font rules (7 in `PrescriptionSlip-old.jsx`). `src/scratch/update_fonts.js` is a leftover font-rewriting script with a hardcoded path on another machine.
*Fix:* Remove or archive.

---

## 4. Font Size, Colour and Other Issues

**Font size (Medium).** About 2,660 px, 215 rem and 5 em declarations in CSS, so units are mixed (roughly 92% px).
- Over 50 distinct px values. Many are fractional and near-duplicates: 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 / 15 / 15.5 / 16 / 16.5 / 17.
- Most used: 13px (456), 14px (344), 12px (303), 11px (222), 15px (141), 12.5px (117), 13.5px (129), 16px (88). About 24 uses are 9-9.5px, which is hard to read.
- No shared heading scale. h1 sizes are set per page (e.g. `.corp-hero h1` uses `clamp(28px, 5vw, 46px)`; account pages use fixed `28px`; h2 values of 17 / 22 / 24 / 26 / 28 / 30 are all present).
- *Fix:* Define a small scale (see section 5), use rem, and map existing values to the nearest step.

**Line-height (Low).** Body text uses 1.4, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75 and 1.8 for the same role (paragraphs). Headings mix 1, 1.1, 1.2, 1.25 and 1.3. *Fix:* Two body values and two heading values.

**Letter-spacing (Low).** Global headings use `-0.02em` (`index.css:27`), while account pages use `-0.5px` inline (`ChangePassword.jsx:254`) and many components set their own values. *Fix:* Set it once on headings.

**Colours (Medium).**
- About **791 distinct 6-digit hex colours** in CSS and JSX, plus many 3-digit, rgb and rgba values.
- Brand blues appear as `#0b57e8` (102), `#2563eb` (134), `#1d4ed8` (71), `#083ebd` (41), `#083ab0` (32) and `#08308e` (32). Navy appears as `#0b0443` (42), `#0a1f44` (49), `#071b44`, `#10244d`, `#1e3a5f`, `#223a5e`, `#0f172a` (99). Greys come from three families (Tailwind slate `#64748b`, `#94a3b8`, `#e2e8f0`; Tailwind gray `#6b7280`, `#9ca3af`, `#374151`, `#e5e7eb`; and custom `#6d7c99`, `#6b7ca3`). These are near-duplicates.
- Whites are written as `#fff` (607) and `#ffffff` (241). Teal and green: `#0c8b7a`, `#14b8a6`, `#059669`, `#16a34a`.
- CSS variables exist (`App.css:14-33`, e.g. `--primary`, `--navy`, `--text`, `--muted`) but `var(--text)` is used about once in `App.css`. Almost all colour values are hardcoded.
- **Low contrast (WCAG AA 4.5:1 for normal text, estimated):** `color: #94a3b8` (about 53 uses; roughly 2.6:1 on white) and `color: #9ca3af` (37 uses; roughly 2.5:1 on white) fail AA. If they are placeholders or disabled text they are borderline acceptable, but at that count many will be real body or label text. `#64748b` (about 4.8:1 on white) and `#6b7280` (about 4.8:1) pass narrowly. Check any of these on tinted backgrounds such as `#f1f5f9`.
- *Fix:* Consolidate to one brand blue, one navy, and one grey ramp exposed as variables. Darken light greys used for text to about `#64748b` or darker.

**Border radius (Low).** Values in use: 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 px, 50px, 100px, 999px, 9999px, 50%. About ten near-equivalent steps between 8 and 24px. Three different "pill" values (50px, 999px, 9999px) do the same thing. *Fix:* A set of about 4 radii plus one pill value.

**Buttons / spacing (Low).** Inline-styled buttons on account pages (`ProfileSettings.jsx:552,566`, `ChangePassword.jsx:375,386`) use `padding: 11px 22px` / `11px 28px` and `borderRadius: 12px`, with blue shadows `rgba(59,130,246,.36)` that do not match other pages' buttons. No shared button component or class was found. Page-level spacing uses ad-hoc px values. *Fix:* One button style set (primary, secondary, danger) with shared padding, radius and shadow.

---

## 5. Suggested Standard (recommendation only)

**Fonts (2 families, loaded once)**
- Headings and display: **Satoshi**, weights 500, 700, 800.
- Body and UI (paragraphs, labels, inputs, buttons, tables): **Inter**, weights 400, 500, 600, 700.
- Keep one system monospace stack (token `--font-mono`) for IDs and code, and one serif stack only for printed invoice and certificate documents. Remove Plus Jakarta Sans, DM Sans, Manrope, Source Serif 4, Fraunces, IBM Plex Mono, Poppins and JetBrains Mono, unless a designer confirms one of them is intended.
- Load in `index.html` only (one `<link>` each, with `preconnect`), delete every CSS `@import` font line, and optionally self-host later.
- Tokens in one file: `--font-primary`, `--font-secondary`, `--font-mono`, each with a single shared fallback stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). All components reference tokens; no literal family names in CSS or JSX.

**Weights:** 400 body, 500 labels and nav, 600 buttons and emphasis, 700 headings, 800 only for the hero h1. Remove 300, 650, 550, 750, 850 and 900 from use and from loading.

**Size scale (rem, 16px base):** 0.75 (12), 0.875 (14), 1 (16), 1.125 (18), 1.25 (20), 1.5 (24), 1.875 (30), 2.25 (36), 3 (48). Body 1rem (0.875rem for dense admin tables). No text below 12px. Headings: h1 `clamp(2rem, 5vw, 3rem)`, h2 1.875rem, h3 1.5rem, h4 1.25rem.

**Line-height and spacing of type:** body 1.6; headings 1.2; small or UI text 1.4. Letter-spacing `-0.02em` on headings only.

**Colour:** one brand blue (`--primary`), one navy for headings (`--navy`), a single grey ramp (slate), and AA-safe text greys (nothing lighter than about `#64748b` for text on white). Express them as the existing `:root` variables and replace hardcoded hex over time.

**Radius:** 8, 12, 16 and pill (`999px`).
