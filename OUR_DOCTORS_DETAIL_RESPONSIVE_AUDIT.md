# Our Doctors Detail Page — Responsive Audit

## 1. Objective and scope
Audit the responsiveness of the page opened by **View Profile** on `/admin-dashboard/our-doctors`. Scope is limited to that page and its direct dependencies. No backend, API, auth, route or business-logic changes.

Git state at start: branch `uat`, working tree clean (`git status --short` empty).

## 2. Files inspected
| Purpose | File |
|---|---|
| Listing → detail navigation | `frontend/src/pages/admin/OurDoctors.jsx` (button navigates to `/admin-dashboard/doctor-profile/:id`, `state.from = "our-doctors"`) |
| Route | `frontend/src/App.jsx` (`/admin-dashboard/doctor-profile/:id` → `AdminLayout > AdminDoctorProfile`) |
| Detail page (view + inline edit mode) | `frontend/src/pages/admin/AdminDoctorProfile.jsx` (~4000 lines) |
| Layout shell | `frontend/src/pages/admin/AdminLayout.jsx`, `AdminDashboard.css` (`.ad-main`, `.ad-content`) |

`/admin-dashboard/doctors/:slug` renders the public `DoctorProfileForUser` (`adminView`); it is **not** the page reached from Our Doctors and is out of scope.

The page has **no CSS file**. All layout is inline `style={{}}` (196 occurrences) plus one tiny `<style>` block holding a `@keyframes pulse`. Inline styles cannot contain media queries, so the page has **no responsive breakpoints of its own**; it relies solely on `flex-wrap` and `repeat(auto-fill, minmax(Npx,1fr))` grids.

## 3. Page structure
Wrapper (`maxWidth 980`) → top nav (Back, "DOCTOR PROFILE", h1 name) → gradient hero card (avatar, name/qualification/experience/location/timestamps, status badges) → progress + admin-actions grid → either `AdminEditForm` (edit mode) or read-only `Section`s (Personal, Location, Professional, Clinic, licensed states, documents, availability, etc.) using `Field` / `DocItem`.

Available content width: tablet-and-below `.ad-main` padding is 10px at ≤768px, so at 320px the content column is 300px; a `Section` body adds 22px padding per side → **254px** of usable width.

## 4. Findings
Visual behaviour was **not verified in a browser** (see §9). Severity is based on layout arithmetic against the CSS above.

### High
**H1 — Grids with `minmax(≥260px)` overflow at 320px (inferred, arithmetic).**
`AdminDoctorProfile.jsx:1810` (`G2`, 260px), `:2400` (280px), `:3711` (280px), `:3770` (220px ok). Usable width at 320px is 254px < 260/280px, so a single column is wider than its container; `.ad-main` has `overflow-x:hidden`, so the overflow is **clipped**, not scrollable. Affects edit-mode form fields and document upload cards.
Root cause: fixed minimum track size with no `min(100%, …)`.
Fix: `minmax(min(100%, Npx), 1fr)`.

**H2 — Progress / Admin-actions grid is `1fr auto` with a 190px-min actions card at every width (`:3207`, `:3242`).**
At ≤480px the progress card is left ≈ 300 − 190 − 20 = 90px; the 5-step bar and the "Current: …" label are squeezed. Root cause: inline `gridTemplateColumns` cannot change per breakpoint.
Fix: move columns to a class in the page's `<style>` block; single column under 700px.

### Medium
**M1 — Field values never wrap long unbroken strings (`Field`, `:423`).** Long emails/URLs (e.g. 40+ chars at 14px ≈ 280px) exceed the 254px column at 320px and are clipped. Grid items also lack `min-width:0`.
**M2 — Top nav title has no `min-width:0` / wrapping (`:2989–3031`).** A long doctor name in the h1 cannot shrink in the flex row beside the Back button.
**M3 — Hero name/qualification text has no `overflow-wrap` (`:3078`).** Long qualification strings overflow the hero.
**M4 — `ProfileChangeSummary` Before/After is a fixed two-column grid (`:532`).** At 320px each column is ≈ 127px minus 28px padding; values are unreadable. Root cause: inline `1fr 1fr`; the divider is an inline `borderRight`.
**M5 — Section header/body padding (22px) is not reduced on narrow screens (`Section`, `:371`).** Costs 44px of the 300px available; contributes to H1/M1.
**M6 — Edit-mode inputs use inline `outline:"none"` with no replacement focus style.** Keyboard users lose the focus indicator.

### Low
**L1 — Touch targets.** Back / Edit / Refresh buttons are ≈ 30–36px tall (padding 7–9px, 12–13px text), below the 44px recommendation. Increase on mobile via class.
**L2 — Hero badge column is right-aligned (`alignItems:flex-end`)**; when it wraps below the text on mobile it floats right. Cosmetic.

### Not defects (checked)
- Hero uses `flexWrap:"wrap"`; avatar `flexShrink:0`, fixed 72px with `object-fit:cover` — fine.
- Time inputs (`width:120`) sit in rows with `flexWrap:"wrap"` — fine.
- `DocItem` uses `word-break:break-all` — fine.
- Multi-select dropdown is `position:absolute; left:0; right:0` relative to its field — fits.
- `ConfirmDialog` (shared component) not audited; out of scope.

## 5. Recommended fixes / implementation plan (priority order)
1. H1: replace `minmax(Npx,1fr)` with `minmax(min(100%,Npx),1fr)` for the four ≥220px grids and the `200px` Field grids (same helper pattern).
2. H2: class `adp-dp-split` + media query in the existing `<style>` block; remove inline `gridTemplateColumns`; `minWidth:"min(190px,100%)"` on the actions card.
3. M1–M3: `minWidth:0` + `overflowWrap:"anywhere"` on `Field`, hero text, nav title.
4. M4: class-based Before/After grid that stacks under 520px.
5. M5: `Section` padding via classes with a ≤480px reduction.
6. M6/L1: scoped `.adp-dp` rules: `:focus-visible` box-shadow on inputs/selects/textareas (inline `outline:none` kept, so no `!important` needed) and `min-height:40px` on top-nav/action buttons at ≤768px.

All new CSS lives in the existing `<style>` inside this component and is namespaced `adp-dp-*` / `.adp-dp`. No shared stylesheet is touched, so other pages cannot be affected.

## 6. Regression risks
- Desktop layout must be unchanged: all new rules are either `min()`-wrapped (no effect when wide) or inside `max-width` media queries.
- `.adp-btn*` classes are shared globally and are not modified.

## 7. Testing strategy and acceptance criteria
- `eslint` on the file, `npm run check:css`, `vite build`.
- Manual (needs an admin session and a doctor record): 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 — no horizontal clipping, long email/name wrap, progress card readable, Before/After readable, buttons ≥ 40px at ≤768px, visible focus ring in edit mode.

## 8. Implementation record
**File modified:** `frontend/src/pages/admin/AdminDoctorProfile.jsx` only (+51/−28). No stylesheet, route, API or logic change.

| Finding | Status | Change |
|---|---|---|
| H1 | Fixed (static) | 10 `repeat(auto-fill, minmax(Npx,1fr))` grids → `minmax(min(100%, Npx), 1fr)` |
| H2 | Fixed (static) | `.adp-dp-split` class; 2 columns on >700px (same as before), 1 column ≤700px; actions card `minWidth: min(190px,100%)` |
| M1 | Fixed (static) | `Field`: `minWidth:0`, value `overflowWrap:anywhere` |
| M2 | Fixed (static) | Nav row/title container `minWidth:0`; h1 `overflowWrap:anywhere` |
| M3 | Fixed (static) | Hero text block `overflowWrap:anywhere`, `minWidth: min(200px,100%)` |
| M4 | Fixed (static) | `.adp-dp-diff` grid; stacks ≤520px with a bottom divider instead of right divider |
| M5 | Fixed (static) | `Section` padding moved to `.adp-dp-sec-head/body`; reduced ≤480px (desktop values unchanged) |
| M6 | Fixed (static) | `.adp-dp` `:focus-visible` box-shadow/border on input/select/textarea (no `!important`) |
| L1 | Fixed (static) | `min-height:40px` on nav and actions buttons ≤768px |
| L2 | Not changed | Cosmetic; left as is |

All new CSS is in the component's existing `<style>` block, namespaced `adp-dp*`; no shared CSS touched.

**Checks run (from `frontend/`):**
- `npx eslint src/pages/admin/AdminDoctorProfile.jsx` → 2 errors, 2 warnings. The identical 4 problems exist on `HEAD` (checked by linting `git show HEAD:…` via stdin; only line numbers shifted by 7): `set-state-in-effect` in `SignedImage`, `no-empty` at the catch block, two hook warnings. None introduced by this change.
- `npm run check:css` → passed.
- `git diff --check` → clean.
- `npx vite build` → succeeds. (Full `npm run build` with SSR/prerender not run.)

**Viewports verified:** none (see §9). **Acceptance status:** code changes complete; visual acceptance at 320–1440px is **not verified** and must be checked manually with an admin session.

## 9. Unverified
No browser automation is installed (no Playwright/Puppeteer in `node_modules`), and the page requires an authenticated admin session and backend data. **No viewport was tested; every behaviour above is inferred from CSS and layout arithmetic.**

## 10. Final verification (code review pass)

**Scope check:** `git status --short` shows only `frontend/src/pages/admin/AdminDoctorProfile.jsx` (modified) and this report (new). No other working-tree changes exist.

**Verified by reading the diff:**
- Every new class used in CSS exists in JSX and vice versa: `adp-dp` (wrapper), `adp-dp-nav`, `adp-dp-split`, `adp-dp-sec-head`, `adp-dp-sec-body`, `adp-dp-diff`, `adp-dp-diff-before`. The names appear in no other file, so no other page can match them.
- Inline styles that would have beaten the new rules were removed: `gridTemplateColumns` on the split grid, the Section header/body `padding`, and the diff grid's `display/gridTemplateColumns/borderRight`. The remaining inline `padding` on the "After" cell equals the class value, so there is no conflict.
- All 10 auto-fill grids now use `minmax(min(100%, Npx), 1fr)`; no `minmax(Npx` pattern remains.
- Media queries (700 / 520 / 480 / 768px) target the intended classes. The component's `<style>` block is rendered in the same return that contains `Section`, `ProfileChangeSummary` and `AdminEditForm`, so the rules reach them.
- Known limitation of the focus rule: inputs set an inline `border` shorthand, so the `border-color` part of the `:focus-visible` rule is overridden; the blue `box-shadow` ring still applies.

**Re-run after review (no code changed since):** `git diff --check` clean; `npm run check:css` passed; `vite build` succeeded. ESLint results unchanged (4 pre-existing problems, identical on HEAD).

**Browser verification: NOT performed.** No dev server was running (localhost:5173 unreachable), no admin session is available, and no browser automation is installed (none added, per instructions). Widths 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440 are all **unverified**: overflow, clipping, progress/action layout, Before/After readability, button sizes, focus ring and desktop parity still need a manual check.

## 11. Redesign pass against the responsive reference image (1440 / 768 / 390)

Differences found between the page and the reference, and what changed (all in `frontend/src/pages/admin/AdminDoctorProfile.jsx`; no other file):

| Reference behaviour | Change |
|---|---|
| 768 / 390: Professional Details, Submitted Documents, Availability Schedule, Payout Information are collapsed rows with a chevron; 1440: all open | `Section` gained a `collapsible` prop + `useIsNarrow()` (`matchMedia (max-width:1023px)`). On narrow screens those four view-mode sections render as an `aria-expanded` button header with a chevron, collapsed by default; on desktop they are unchanged. Edit-mode sections are not collapsible. |
| Detail fields: 4 columns desktop, 3 tablet, 2 mobile | New `.adp-dp-fields` grid driven by **container queries** on `.adp-dp-sec-body` (≥800px: 4, 520–799: 3, 280–519: 2, <280: 1), so the admin sidebar width is accounted for. Replaces 5 `auto-fill` field grids. |
| Document cards: 4 across on desktop, fewer on narrow | `.adp-dp-docs`: 4 / 2 / 1 columns by container width (≥800 / 420–799 / <420). |
| Availability: seven day cards on desktop | `.adp-dp-days`: `auto-fill, minmax(min(100%,120px),1fr)`; day-name/“Available” row now wraps. |
| Mobile hero: badges as a centered stack beneath the identity details | `.adp-dp-badges` (right-aligned column on desktop/tablet, as before); ≤560px it spans the full width and centers. |
| Compact bottom action bar (Back to List left; Edit Profile / Reject right) | `.adp-dp-bar` / `-actions` / `-btn` classes replace inline padding; wraps, tighter padding ≤560px. The existing bar and its handlers are reused, nothing duplicated. |
| Progress and actions side by side at 768, stacked at 390 | Already provided by `.adp-dp-split` (breakpoint 700px) from §8. |
| Top nav / hero | Already match the reference structure; unchanged. |

Container-query note: `container-type: inline-size` is set on the section body only (not the page wrapper), so absolutely positioned dropdowns and the page's fixed overlays are unaffected.

**Checks:** ESLint → same 4 pre-existing problems (2 errors, 2 warnings; identical on HEAD); `npm run check:css` passed; `git diff --check` clean; `vite build` succeeded. Full `npm run build` not run.

**Not verified (still):** no browser pass was possible — no running app, no admin session, no automation tooling. 320/360/375/390/430/768/1024/1440px, edit mode, expand/collapse behaviour, and pixel-level match to the reference are all unconfirmed. Expand/collapse relies on viewport width at load and on resize via `matchMedia`; it has not been exercised.
