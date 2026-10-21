# Manage User Details — Responsive Audit (Phase 1, audit only)

## 1. Objective and scope
Audit the page opened by **View** on `/admin-dashboard/manage-users` (route `/admin-dashboard/manage-users/:id`) for responsiveness from 320px to 2560px. No application source was modified in this phase.

Git at start: branch `uat`; `git status --short` showed `M frontend/src/pages/admin/AdminDoctorProfile.jsx` and `?? OUR_DOCTORS_DETAIL_RESPONSIVE_AUDIT.md` (unrelated earlier work, untouched).

**Reference screenshots:** the two screenshots mentioned in the request did not reach me (no image was attached to the message). Design conformance is therefore judged from the existing CSS and your text description (dark navy header, blue gradient banner, white rounded cards, blue uppercase labels). Please re-attach them before Phase 2 if exact fidelity matters.

## 2. Files inspected
| Purpose | File |
|---|---|
| Listing + View navigation | `frontend/src/pages/admin/ManageUsers.jsx` (View → `/admin-dashboard/manage-users/:id`) |
| Route | `frontend/src/App.jsx:1927` (`AdminLayout > AdminUserProfile`) |
| Page component | `frontend/src/pages/admin/AdminUserProfile.jsx` (285 lines) |
| Consultations list | `frontend/src/pages/admin/UserConsultationList.jsx` |
| Page styles | `frontend/src/pages/admin/AdminUserProfile.css` (page layout), `ManageUsers.css` lines 368–815 (`.mu-*` profile content) — **shared with the Manage Users listing and Deletion Requests page** |
| Shell / header | `AdminLayout.jsx:628–663`, `AdminDashboard.css` (`.ad-main`, `.ad-topbar*`, `.ad-bell*`) |

## 3. Current structure
`.ad-main` (padding 10px ≤768px) → `.ad-topbar` (menu, title, bell, user pill) → `.mu-page` → `.mu-hero` (avatar, name/ID, optional deletion notice, actions) → `.mu-grid.mu-grid--profile`: **Personal Information** (`mu-area-personal`) | `.mu-col-right` = **Consultations Info** (filter `<select>`, count, `<table class="mu-ctable">` in `.mu-consults-scroll`, pager) over **A/C Information**. Info cards are `.mu-row` label/value pairs.

Existing breakpoints: grid → 1 column ≤640px (`ManageUsers.css:569`); two columns ≥1000px (`:612`); hero actions stretch ≤640px; consultation cell padding ≤640px (`:795`). Already good: `overflow-wrap:anywhere` on values (`:511–518`), hero name and notice; `min-width:0` on cards/info; table wrapped in an `overflow-x:auto` container.

## 4. Findings
Visual behaviour was **not browser-verified** (see §12); all symptoms below are inferred from CSS and width arithmetic unless stated.

### High
*(none confirmed)*

### Medium
**M1 — Consultation table likely scrolls sideways on phones, hiding "View" (`ManageUsers.css:670–716`, `UserConsultationList.jsx:179–211`).**
Four columns (Sr. No ≈40px, Date "12 October 2026" + time, App. ID, nowrap View button ≈60px). Usable card width at 320px ≈ 252px (320 − 10 main − 8 page gutters×2 − 32 card padding), at 360–390px ≈ 292–322px. The date and ID columns plus Sr. No and View exceed that, so the table scrolls inside `.mu-consults-scroll` and the View action can sit off-screen. Affects ~320–420px (inferred).
Fix: below ~520px render each row as a stacked card (Sr. No + Date/time, App. ID/type, full-width View button) using the same markup via CSS (`display:block` rows + `data-label`s) — no data removed.

**M2 — Two-column layout starts at 1000px viewport, but with the 220–256px sidebar each column is only ≈ 320–350px between 1000 and ~1200px (`ManageUsers.css:612`).** Consultations table is squeezed right at M1's limit; rows in Personal Information cramped. Fix: raise the two-column breakpoint to ~1200px (single column below), or use a width that accounts for the sidebar.

**M3 — No maximum width on ultrawide screens (`AdminUserProfile.css:3–9`, `.mu-page {max-width:100%}`).** At 1920–2560px the banner and two cards stretch to ≈ 1600–2200px; `.mu-row` uses `justify-content:space-between` (`ManageUsers.css:491–498`), so labels and values end up ~900px apart. Fix: `max-width` (≈1280px) with `margin-inline:auto` on the profile page.

**M4 — Class collision with my earlier change: the Manage Users *listing* root now has the class `mu-page` (`ManageUsers.jsx:163`), which `AdminUserProfile.css:3–9` also defines (`display:flex; flex-direction:column; padding:0 8px 24px`).** Once the profile chunk's CSS has loaded (visit a profile, go Back), the listing page picks up that padding/flex layout — a cross-page regression introduced by the heading work, plus it would inherit any `max-width` added for M3. Fix: rename the listing/heading scope class to `mu-list-page` (JSX + the 6 selectors at `ManageUsers.css:321–365`) and keep `.mu-page` for the profile only.

**M5 — Touch targets below 44px.** Consultation **View** link ≈ 28px tall (`:717–727`, padding 6px 14px, 12px text); pager buttons 32–34px (`:759–772`, `:802`); hero **Delete User/Approve/Reject** ≈ 36–40px (`:448–451`, `:594–598`); status select 38px (`:643–646`). Fix: `min-height:44px` at ≤768px (coarse pointers), without changing desktop.

**M6 — Label/value rows get cramped at ≤400px (`.mu-row`, `:491–518`).** Label is `flex:0 0 auto` (e.g. "REGISTERED VIA" ≈ 105px) beside a right-aligned value in ≈ 130px; long email / "Web · Chrome on Windows 10…" values wrap into a narrow ragged column. Fix: stack label above value (left-aligned) at ≤420px; keep `overflow-wrap:anywhere`.

### Low
**L1 — Global `@media (max-width:600px){ .adp-btn{width:100%} }` in `ManageUsers.css:283–285`** applies to every `.adp-btn` on pages that load this stylesheet (hero buttons currently survive because `flex:1 1 130px` is more specific). Not a defect today; fragile.
**L2 — Topbar (shared shell, `AdminDashboard.css:368–410, 1146–1172`)**: title has no ellipsis and `.ad-topbar-right{flex-shrink:0}` with an un-truncated user pill; at 320px with a long first name or long page title the row can overflow. Shared by all admin pages — flag only; recommend a separate, explicit change if confirmed in a browser.
**L3 — `mu-shimmer` skeleton animation has no `prefers-reduced-motion` guard (`:535`).**
**L4 — Fixed `height:64px/54px` topbar and fixed skeleton heights** (`:29–39` of `AdminUserProfile.css`) could clip under heavy text zoom; skeletons are decorative, topbar is shared.
**L5 — Hero banner ≤640px** wraps actions to a full row (good) but the 50px avatar + name stay inline; a very long name wraps via `overflow-wrap:anywhere` (OK). No change needed unless the browser pass shows otherwise.

### Checked and fine
Long emails/IPs/browser strings wrap (`overflow-wrap:anywhere`); cards have `min-width:0`; focus: no `outline:none` on `.mu-*` controls (only on an unrelated input at line 225), so default focus rings remain; Delete flow uses the shared confirm dialog; toast is `position:fixed`.

## 5. Recommended changes (Phase 2 plan, priority order)
1. **M4** rename listing scope class to `mu-list-page` (JSX + CSS) — fixes the regression first.
2. **M3** profile page: `max-width:1280px; margin-inline:auto` on `.mu-page` (in `AdminUserProfile.css`, which is page-specific).
3. **M2** two-column breakpoint 1000px → 1200px in `ManageUsers.css:612` (`.mu-grid--profile` and its `.mu-area-*` rules are profile-only, so no other page is affected).
4. **M1** consultations: stacked-card presentation below ~520px; keep table above. Add `data-label` attributes to `<td>`s in `UserConsultationList.jsx` (markup-only, no logic change).
5. **M6** stack label/value ≤420px for `.mu-row` (profile-only selectors).
6. **M5** 44px min touch targets for View, pager, hero actions, select at ≤768px.
7. **L3** reduced-motion guard.
8. L1/L2/L4: record only; no change unless the browser pass confirms a defect.

## 6. Regression risks
- `ManageUsers.css` is also loaded by the listing and Deletion Requests pages. Every new selector must be scoped to `.mu-grid--profile`, `.mu-hero`, `.mu-ctable`, `.mu-row`, or `.mu-consults` (profile-only classes). `.mu-pager*` are also used on the listing (`:874`), so touch-target growth for pager buttons must be scoped under `.mu-consults .mu-pager-btn`.
- `UserConsultationList` is only rendered by the profile (verify with a grep before editing).
- Renaming `mu-page` must update all five users of the heading-scope rules.

## 7. Testing strategy / acceptance criteria
- `eslint` on changed JSX, `npm run check:css`, `vite build`, `git diff --check`.
- Browser pass (needs admin session): 320, 344, 360, 375, 390, 414, 430, 480, 600, 768, 820, 900, 1024, 1100, 1280, 1366, 1440, 1600, 1920, 2560; plus 200% zoom and enlarged text. Use normal and very long values (60-char email, long browser string, long name).
- Accept when: no horizontal page scroll; View reachable without inner scrolling at every width; two columns only when each is ≥ ~480px; content capped on ultrawide; listing page unchanged after visiting a profile; Delete User flow, filter, pager and View links work.

## 8. Items that could not be verified
No browser automation, no running app and no admin session are available here, and the reference screenshots were not received. **No viewport has been tested; every symptom above is inferred.** Also unverified: overlap with floating support/chat widgets, orientation changes, zoom behaviour, and the topbar (L2).

**Phase 2 will not start until you approve this report.**

## 9. Phase 2 — implementation record (approved)

**Files modified (4):** `frontend/src/pages/admin/ManageUsers.jsx` (1 line), `ManageUsers.css`, `AdminUserProfile.css` (3 lines), `UserConsultationList.jsx` (3 `<td>` attributes). Nothing else touched.

| Finding | Change |
|---|---|
| M4 | Listing root `mu-page` → `mu-list-page` (`ManageUsers.jsx:163`); the six heading-scope selectors in `ManageUsers.css` renamed to `.mu-list-page …`. `mu-page` now belongs to the profile page only (`AdminUserProfile.jsx/css`, unchanged names). Deletion Requests uses `adr-page`, unaffected. |
| M3 | `.mu-page` in `AdminUserProfile.css`: `max-width: 1280px; margin-inline: auto` (was `max-width:100%`). |
| M2 | Profile two-column breakpoint `min-width: 1000px` → `1200px` (`.mu-grid--profile` block only); comment updated. |
| M1 | `UserConsultationList.jsx`: `data-label` on Sr. No / Date / App. ID cells + `mu-cell-id` class (markup only). `ManageUsers.css` `@media (max-width:519px)`: rows become stacked cards (Sr. No + Date on one line, App. ID and a full-width View button below); header row visually hidden but kept for screen readers. Table layout unchanged ≥520px. |
| M6 | `@media (max-width:420px)`: `.mu-grid--profile .mu-row` stacks label above left-aligned value. |
| M5 | `@media (max-width:768px)`: `.mu-hero-actions .adp-btn`, `.mu-consults .mu-status-select` min-height 44px; `.mu-consults .mu-view-btn` 44px; `.mu-consults .mu-pager-btn` 44×44 (scoped, listing pager untouched). |
| L3 | `@media (prefers-reduced-motion: reduce) { .mu-skeleton { animation: none } }` (skeleton stays visible, only the shimmer stops). |
| L1, L2, L4 | Not changed (as planned). |

**Commands run (from `frontend/`):** `npx eslint src/pages/admin/ManageUsers.jsx src/pages/admin/UserConsultationList.jsx` → no output (clean). `npm run check:css` → passed. `git diff --check` → clean (only LF/CRLF warnings from git). `npx vite build` → succeeded. No existing test targets these files. `git status`: only the 4 files above, `AdminDoctorProfile.jsx` (earlier work, untouched) and the two audit reports.

**Not verified (no browser, no admin session):** none of the 20 listed widths, 200% zoom, enlarged text, orientation change, long-value behaviour, listing-after-profile regression in a real browser, or the Delete / filter / pagination / View flows at runtime. Those flows have no code changes except `data-label` attributes. Remaining unfixed by design: L1/L2/L4 (shared stylesheet/topbar).

## 10. Follow-up pass — squeezed consultations card at intermediate widths

Reported symptoms: at widths where the two cards sit side by side, dates, times and appointment IDs wrap mid-string and the View button is crowded. Cause (from code): the two-column layout (1200px) left each column ≈ 400px wide after the ~290px sidebar, and `.mu-cell-main` uses `overflow-wrap:anywhere`, so dates/IDs were allowed to break at any character. The screenshots again did not reach me; this is based on the written description.

Files changed this pass: `frontend/src/pages/admin/ManageUsers.css` only (all new rules scoped to `.mu-consults`, `.mu-ctable`, `.mu-grid--profile`).
- Two-column breakpoint `1200px` → `1360px`; below it a single column. A viewport query is used instead of a container query because `container-type` adds layout containment, which would re-anchor the `position:fixed` toast inside `.mu-page`.
- `.mu-consults .mu-ctable .mu-cell-main/.mu-cell-sub`: `white-space:nowrap; overflow-wrap:normal` — dates, times and the 8-character IDs stay whole; View is `nowrap`. The existing `overflow-x:auto` wrapper remains only as a last-resort fallback.
- `.mu-consult-head` wraps and the select is `max-width:100%`, so the filter and count cannot overflow.
- `.mu-grid--profile .mu-row-value`: `overflow-wrap:break-word` (breaks only when a word cannot fit) so values like "Web · Chrome on Windows" no longer split mid-word; long emails still wrap.
- Card layout (<520px): date + time and ID + "Doctor" now read as one line each (inline children), still the same markup, no duplicated controls.

Checks (from `frontend/`): `npm run check:css` passed; `git diff --check` clean; `npx eslint` on `AdminUserProfile.jsx` and `UserConsultationList.jsx` clean; `npx vite build` succeeded.

**Still unverified:** no browser/admin session — none of the 20 widths was rendered. Whether a ~487px column fits Sr. No + date + ID + View without the fallback scrollbar is estimated (≈ 52 + 95 + 80 + 70px), not measured.

## 11. Follow-up — consultation card horizontal scrollbar

Cause (from code): the previous pass set `white-space:nowrap` on the cells while the table used automatic layout, so the table's minimum width exceeded the card and `.mu-consults-scroll { overflow-x:auto }` showed a scrollbar and clipped View.

Change (`frontend/src/pages/admin/ManageUsers.css` only): new `@media (min-width:520px)` block scoped to `.mu-consults .mu-ctable`: `table-layout:fixed; width:100%`, cells `box-sizing:border-box; min-width:0`, Sr. No column 52px, View column 84px, Date and App. ID share the remainder; dates may wrap only at spaces, IDs and times stay whole. The stacked-card layout below 520px is unchanged (the fixed widths are inside the ≥520px query so they cannot narrow the cards). The `overflow-x:auto` wrapper is kept as a safety net, not hidden.

Checks (from `frontend/`): `npm run check:css` passed; `git diff --check` clean; `npx vite build` succeeded; no JSX modified this pass.

**Unverified:** no browser/admin session, so 320/390/768/906/1024/1280/1440px were not rendered. Fit is estimated: the narrowest table card (≈ 440px) gives Date/ID ≈ 150px each, enough for "23 Oct 2026" and an 8-character ID.
