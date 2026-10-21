# Admin Dashboard — Phase 1 Audit (Audit Only)

Branch `uat`. No application source was modified. Pre-existing modified/untracked files were left untouched (see §2.3).

**Evidence labels used throughout:** `[SRC]` = read from source, `[INF]` = inferred from source/CSS arithmetic, `[BROWSER]` = verified in a running browser. **No `[BROWSER]` checks were performed in this audit** (see §11).

---

## 1. Executive summary

1. **The dashboard in the repo is far smaller than the approved design.** `/admin-dashboard` renders `AdminOverview.jsx` (132 lines): a greeting, **3** stat cards (Total Users, Approved Doctors, Total Appointments) and a **4-tile "Quick Navigation"** card. It has **no** Open Tickets card, attention banner, Our Doctors section, Manage Users section, appointment status overview, Search Analytics section, Support Tickets section, Partner Cases status overview, global search, Refresh control, or dashboard-level notification bell [SRC `AdminOverview.jsx:19-132`].
2. **Most of the design's data does not come from the one API the dashboard calls.** `GET /api/admin/stats` returns only `totalUsers, activeUsers, totalDoctors, totalAppointments, pendingAccountDeletionRequests` [SRC `backend/controllers/adminController.js:130-143`]. Open-ticket counts, appointment status breakdowns and search-analytics summaries have no existing dashboard-sized endpoint (details in §3.3). Only Partner Cases has a status-breakdown endpoint (`GET /api/admin/partner-cases/stats`, `backend/routes/adminPartnerCases.js:56`). **Delivering the full design therefore needs a decision from you** (§11, item D1): reuse existing list endpoints and count client-side, add backend aggregates, or ship a reduced layout. This audit does not assume either.
3. **There are two different "dashboards".** `/admin-dashboard` (admin + superadmin, `AdminOverview`) and `/superadmin-dashboard` (superadmin only, `SuperAdminDashboard.jsx`, 870 lines, tabs for Admins / Employee Admins / Partner Companies / Healthcare / Payment / Prices / Blogs; styled by `Dashboard.css`, not `AdminDashboard.css`). The approved design's content (Our Doctors, Manage Users, Tickets…) matches the **first** one. This report assumes the target is `/admin-dashboard`; please confirm (D2).
4. **Navigation on the existing dashboard is correct as written** — every card/tile destination resolves to a defined route with a role guard — with **two items needing your decision, not a code bug**: the "Approved Doctors" card goes to *Manage Doctors* (approvals page), not *Our Doctors* (D3); and the "Support Tickets" tile has no matching sidebar-visible restriction, which is fine but worth noting (§4).
5. **`AdminDashboard.css` is shared by 8+ files** (layout shell for every admin page plus Employee and Partner layouts). Any change to `.ad-*` selectors is a cross-app change. Dashboard-only classes (`.adp-stat*`, `.ado-*`, `.adp-header`) are also re-declared in other page CSS files (§5).
6. Shell-level responsive structure (drawer ≤768px, 2-col stats ≤768, 1-col ≤480) exists and looks sound by source reading; the main gaps are against the *new design*, not regressions of the current page.

---

## 2. Files and components inspected

### 2.1 Frontend
| File | Why |
|---|---|
| `frontend/src/App.jsx` (lazy imports 727-848; routes 1494-2060; `AppLayout` 1196-1240) | Route table, role guards, which components render where, floating widgets |
| `frontend/src/pages/admin/AdminDashboard.jsx` (5 lines) | Thin wrapper → `AdminOverview` |
| `frontend/src/pages/admin/AdminOverview.jsx` (132 lines) | **The actual `/admin-dashboard` page** |
| `frontend/src/pages/admin/AdminDashboard.css` (1466 lines) | Shell + dashboard styles (`.ad-*`, `.adp-*`, `.ado-*`) |
| `frontend/src/pages/admin/AdminLayout.jsx` (505 lines) | Sidebar, nested menus, topbar, drawer |
| `frontend/src/pages/admin/SuperAdminDashboard.jsx` (870 lines; navigation/handler lines grepped, tab bodies skimmed) + `Dashboard.css` (560 lines, existence/size only) | The other "dashboard" |
| `frontend/src/pages/admin/OurDoctors.jsx`, `ManageDoctors.jsx`, `ManageUsers.jsx`, `AdminDeletionRequests.jsx`, `DeletionRequestsPanel.jsx`, `AdminAppointments.jsx`, `SupportTickets.jsx`, `SearchAnalytics.jsx`, `PartnerCases.jsx`, `DirectCallAlertsBell.jsx` | Destination pages and their data sources (endpoint/navigate greps; not read in full) |
| `frontend/src/features/livechat/LiveChatWidget.css`, `LiveChatWidgetLoader.jsx` | Floating widget position / visibility |
| `frontend/tests/*.test.mjs` (names listed; `liveChatSidebarStatic.test.mjs` head read) | Existing static tests |
| `e2e/tests/*.spec.js` (grep only) | Existing e2e touching admin routes |

### 2.2 Backend (read-only, for data-source verification)
`backend/routes/admin.js:16`, `backend/controllers/adminController.js:130-143`, `backend/routes/adminPartnerCases.js:56-68`, `backend/routes/tickets.js:19-21`.

### 2.3 Working-tree state at start (preserved)
Modified: `AdminAssignCategoryDoctor.jsx`, `AdminAssignDoctor.css/.jsx`, `AdminDashboard.css`, `AdminDoctorProfile.jsx`, `AdminLayout.jsx`, `AdminUserProfile.css`, `ManageUsers.css/.jsx`, `UserConsultationList.jsx`. Untracked: three prior `*_RESPONSIVE_AUDIT.md` files.
**Note:** `AdminLayout.jsx` (−194 lines) and `AdminDashboard.css` (−56/+40) carry **uncommitted edits by someone else**, including the removal of the portal/flyout submenu in favour of an in-place accordion. This audit describes the *working copy*. Any implementation must be built on, and must not overwrite, those edits.

---

## 3. Current dashboard structure

### 3.1 Shell (every admin page) — `AdminLayout.jsx`
- `.ad-root` flex container → fixed floating `aside.ad-sidebar` (navy `#01164a`, 256px, inset 16px, radius 24) + `main.ad-main` (`margin-left: 288px`).
- Sticky `header.ad-topbar` (navy): burger (`.ad-menu-btn`), page title, `DirectCallAlertsBell`, `👋 firstname` pill.
- Content: `.ad-content` > `ErrorBoundary` > page.
- Phone (`useMediaQuery("(max-width: 768px)")`): sidebar becomes a drawer (`transform`, `inert` while closed, Escape closes and refocuses burger, backdrop click closes) [SRC `AdminLayout.jsx:284-311, 380-398`].
- Background is a light gradient (`#e8eaf0 → #eef0f5`) — matches the "light neutral workspace" direction. Cards are translucent glass (`rgba(255,255,255,.55)` + `backdrop-filter: blur(18px)`), **not** the design's flat white cards with subtle borders [SRC `AdminDashboard.css:460-475, 1046-1058`].

### 3.2 Page content — `AdminOverview.jsx`
1. Header block (`Humancare Admin` eyebrow, `Welcome back, {first name} 👋`, subtitle) — lines 90-94.
2. Error banner `.adp-load-error` + "Try again" if `/api/admin/stats` fails (lines 96-106). Cards show "—" rather than 0 on failure (by design, comment at lines 8-9).
3. `.adp-stats` grid of 3 clickable cards (`div role="button" tabIndex=0`) — lines 108-121.
4. "Quick Navigation" card with 4 `.ado-action-card` tiles — lines 123-137.

**Behaviors to preserve:** loading/error/retry state, dash-not-zero rule, `active` unmount guard, keyboard activation (`Enter`/`Space`, ignoring bubbled events from children).

### 3.3 Data availability vs. the approved design
| Design element | Existing source | Status |
|---|---|---|
| Total Users | `/api/admin/stats.totalUsers` | **Exists** (used today) |
| Approved Doctors | `/api/admin/stats.totalDoctors` | **Exists** (used today) |
| Total Appointments | `/api/admin/stats.totalAppointments` | **Exists** (used today) |
| Open Tickets | `/api/tickets/all` + `/api/tickets/user/all` return full lists (`SupportTickets.jsx:323-324`); no count endpoint | **No aggregate.** Client-side count means downloading both full lists on the dashboard |
| Attention banner | `stats.pendingAccountDeletionRequests` exists in the API response but **is not read by `AdminOverview`** | Partial. Other "attention" items (pending doctor approvals, open tickets) have no aggregate; the doctor-workflow stats function `getDoctorWorkflowStats` exists in the controller export list but its route/shape was **not verified** |
| Our Doctors section | `/api/admin/approved-doctors` (`OurDoctors.jsx:35`) — full list | List only |
| Manage Users section | `/api/admin/users` (`ManageUsers.jsx:68`) — list | List only |
| Appointment status overview | `/api/appointments/admin/all` (`AdminAppointments.jsx:93`) — full list | **No status aggregate** |
| Search Analytics section | `getSearchAnalytics()` → `/api/admin/search-analytics` (`SearchAnalytics.jsx:3,23`) | Exists, shape not inspected in detail |
| Partner Cases status overview | `GET /api/admin/partner-cases/stats` (status → count map) | **Exists** |
| Global search, Refresh, dashboard notification bell | Bell exists in the shell (`DirectCallAlertsBell`, direct-video alerts only). No global search anywhere; "Refresh" would just re-run the above requests | Search: **no existing behavior** — design implies a new feature (D4) |

---

## 4. Navigation inventory

Legend — Status: ✅ verified correct · ⚠ needs decision · ❓ cannot verify. "Route evidence" = the `<Route>` in `App.jsx`.

### 4.1 Dashboard page (`AdminOverview.jsx`)
| Label | Location | Mechanism | Destination | Route evidence | Status |
|---|---|---|---|---|---|
| Total Users (card) | `AdminOverview.jsx:73,111-120` | `div[role=button]` `onClick`/Enter/Space → `navigate(path)` | `/admin-dashboard/manage-users` | `App.jsx:~1920` → `ManageUsers`, roles admin+superadmin | ✅ |
| Approved Doctors (card) | `:74` | same | `/admin-dashboard/manage-doctors` | `App.jsx:~1900` → `ManageDoctors` | ⚠ **D3.** Count is `Enrollment.approvalStatus === "approved"` (`adminController.js:134`), the same population as *Our Doctors* (`/api/admin/approved-doctors`). The card lands on *Manage Doctors* (approve/reject/export page). Current behavior is deliberate-looking and works; whether it should go to Our Doctors is a product decision. **Do not change without confirmation.** |
| Total Appointments (card) | `:75` | same | `/admin-dashboard/appointments` | `App.jsx:~1950` → `AdminAppointments` | ✅ |
| Manage Doctors (tile) | `:79` | `navigate` | `/admin-dashboard/manage-doctors` | as above | ✅ |
| Manage Users (tile) | `:80` | `navigate` | `/admin-dashboard/manage-users` | as above | ✅ |
| Appointments (tile) | `:81` | `navigate` | `/admin-dashboard/appointments` | as above | ✅ |
| Support Tickets (tile) | `:82` | `navigate` | `/admin-dashboard/tickets` | `App.jsx:2045` → `SupportTickets`, admin+superadmin | ✅ |
| "Try again" (error banner) | `:99-103` | `onClick={retry}` | re-fetch `/api/admin/stats` | n/a | ✅ |

Note: tiles/cards are `div role="button"` with `navigate()`, not anchors. Behaviorally correct, but they cannot be opened in a new tab / middle-clicked / copied (§7).

### 4.2 Sidebar (`AdminLayout.jsx:106-185`), working copy
| Label | Destination | Route / role evidence | Status |
|---|---|---|---|
| Dashboard | `/admin-dashboard` (exact) | `App.jsx:1857`, admin+superadmin | ✅ |
| Doctors ▸ Our Doctors | `/admin-dashboard/our-doctors` | `App.jsx:1867` | ✅ |
| Doctors ▸ Manage Doctors | `/admin-dashboard/manage-doctors` | `App.jsx:~1887` | ✅ |
| Users ▸ Manage Users | `/admin-dashboard/manage-users` | route present | ✅ |
| Users ▸ Deletion Requests | `/admin-dashboard/deletion-requests` | route present → `AdminDeletionRequests` | ✅ |
| Appointments ▸ Appointments | `/admin-dashboard/appointments` | route present | ✅ |
| Appointments ▸ Category Consultations | `/admin-dashboard/category-consultations` | route present | ✅ |
| Direct Video Consultation | `/admin-dashboard/direct-video-consultation` | route present | ✅ |
| Documents ▸ Manual Invoices | `/admin-dashboard/manual-invoices` (payment admin → `/payment-admin/manual-invoices`) | `App.jsx:1825`, `1812` | ✅ |
| Documents ▸ Guarantee of Payment | `/admin-dashboard/gop` | `App.jsx:1835` | ✅ |
| Payment Links / Payment History (payment-admin only) | `/payment-admin/payment-links`, `/payment-admin/payment-history` | `App.jsx:1786, 1799` | ✅ (not visible to admin/superadmin) |
| Partner Cases | `/admin-dashboard/partner-cases` | `App.jsx:1611` | ✅ |
| Email | `/admin-dashboard/email` | `App.jsx:1631` | ✅ |
| Live Chat (only when `VITE_LIVECHAT_ENABLED=true`) | `<a target=_blank rel=noopener>` → `/admin-dashboard/live-chat` | `App.jsx:1672`; guarded by `liveChatSidebarStatic.test.mjs` | ✅ **Must stay a plain anchor with no `onClick`** (existing test asserts this) |
| Search Analytics | `/admin-dashboard/search-analytics` | `App.jsx:2035` | ✅ |
| Support Tickets | `/admin-dashboard/tickets` | `App.jsx:2045` | ✅ |
| Sign Out | `logout()` → context logout, then `/adminauth` (or `/payment-admin-login`) | `AdminLayout.jsx:313-318` | ✅ |
| Burger | toggles drawer (phone only; no-op on desktop — `aria-expanded` is hard-coded `true` off-phone) | `:468-490` | ⚠ low (§7) |
| Group parents (Doctors/Users/Appointments/Documents) | toggle accordion, `aria-expanded`/`aria-controls` | `:224-276` | ✅ |

### 4.3 Elements named in the brief that exist on *destination pages*, not on today's dashboard
| Item | Where it actually lives | Verified destination | Status |
|---|---|---|---|
| Our Doctors "View Profile" | `OurDoctors.jsx:253-261` | `navigate('/admin-dashboard/doctor-profile/${d._id}', {state:{enrollment:d, from:"our-doctors"}})` → `AdminDoctorProfile` (`App.jsx:~1907`) | ✅ — **a doctor action does not go to Manage Users.** The `state` payload is relied on by the detail page's Back behavior; a dashboard mini-list must pass the same state |
| Manage Users "deletion history" | `ManageUsers.jsx:177` `<Link to="/admin-dashboard/deletion-requests">` | `AdminDeletionRequests` | ✅ (ManageUsers.jsx also has uncommitted edits) |
| Partner case row | `PartnerCases.jsx:137-142` | `/admin-dashboard/partner-cases/${c._id}` | ✅ |
| Notification bell | `DirectCallAlertsBell.jsx:161` | `/admin-dashboard/direct-video-consultation/calls/${alert.roomId}` | ✅ (route at `App.jsx:~1990`) |
| Global search | — | **does not exist** | ❓ no behavior to preserve; would be new (D4) |
| Refresh | — | **does not exist** on the dashboard; only per-page refreshes elsewhere | ❓ new (D4) |
| User/profile menu | — | Only a non-interactive `👋 name` pill and the sidebar profile block (non-interactive) | ❓ no existing menu to preserve; the design's "profile menu" would be new |
| Appointment-status cards, Search Analytics links, Ticket summaries, Partner status cards | — | **Not on the current dashboard.** Likely destinations: `/admin-dashboard/appointments`, `/search-analytics`, `/tickets`, `/partner-cases` — but **whether a status card should deep-link with a filter is unverified**: see below | ❓ |

### 4.4 Filter deep-linking — unverified
Whether `AdminAppointments`, `SupportTickets` (`useState("all")` filter, `:310-ish`) and `PartnerCases` (status filter held in React Query key, `PartnerCases.jsx:25`) accept a filter from the URL or router `state` was **not established**. `SupportTickets` filter and tab are plain `useState` (no URL param). Therefore, "Open Tickets → tickets page pre-filtered to Open" is **not currently possible without modifying that page**. Cards must link to the unfiltered page unless you approve the destination page change (D5).

### 4.5 Confirmed navigation defects
**None found** in the existing dashboard/sidebar. No orphan handlers, missing routes or role mismatches were seen.

### 4.6 Superadmin dashboard (`SuperAdminDashboard.jsx`)
Internal tab buttons (`setActiveTab`, lines ~780-830), "Admin Dashboard" `navigate("/admin-dashboard")` (~`:828`), and logout. It is outside the design's content; left as-is.

---

## 5. Responsive findings

> None of these were observed in a browser. All are `[SRC]`/`[INF]`. Breakpoints in the CSS: ≤480, ≤768, 769-1024, plus the default. **The 16 requested widths collapse into these four CSS regimes; widths ≥1025 are not distinguished by any rule**, so 1100…2560 behave identically except for the `auto-fill` grids.

### High
**H1 — The page cannot render the approved design without new markup and data.** (§1, §3.3.) Everything below about "approved layout" is therefore a plan, not a defect list. This is the dominant finding.

**H2 — No max-width on the content column [INF].** `.ad-main` is `flex:1` and `.ad-content` has no `max-width` (`AdminDashboard.css:347-357, 404-407`). At 1920/2560 px the three stat cards (`repeat(auto-fill, minmax(180px,1fr))`) stretch to ~600-800px each and the 4 tiles stretch likewise: "excessively wide content" for the request's 1600/1920/2560 targets. With 7-9 sections planned, a content cap (e.g. 1440-1600px, centered) is needed.

**H3 — Stat grid uses `auto-fill` + fixed 180px min, so four cards at 769-1100 px wrap 3+1 [INF].** Content width at 1024 = 1024−220−32−20 ≈ 750px → 4 × 180 + gaps = 774px → **wraps to 3+1**; at 1100 it just fits. Design wants 4 across on desktop and 2×2 on tablet/phone. Needs explicit column counts per range.

### Medium
**M1 — 320-360px: stats go single-column at ≤480 (`:1166`)** — four tall cards before any content; design wants 2×2. Drawer, topbar (54px, padding 10) and content (padding 10 → ~300px at 320) are otherwise workable. Long names: `.ad-topbar-user` has no `max-width`/ellipsis, so at 320px a long first name + bell + title can squeeze or clip the title [INF].
**M2 — Glass cards (`backdrop-filter`) are costly and visually differ from the flat design.** Applying the design to dashboard cards only requires scoping, not editing `.adp-stat`'s shared look (§8).
**M3 — Topbar has no room for a global search + Refresh at ≤768px.** Search must collapse (icon → overlay) or move into the page body on phones. `.ad-topbar` is shared by every admin page.
**M4 — Sticky topbar offsets (`top:16px` / `10px`) mean ~70px of persistent chrome on phones**, reducing the visible viewport; relevant to a dense dashboard [INF].
**M5 — Floating widget overlap [INF, partly unverified].** In `AppLayout` the legacy `TextWidget` is rendered on **all** paths including admin when `VITE_LIVECHAT_ENABLED !== "true"` (`App.jsx:~1222`). The new `LiveChatWidget` is `position:fixed; right:20px; bottom:20px; z-index:100000` (`LiveChatWidget.css:26-29`) but its loader only mounts on public pages (`LiveChatWidgetLoader.jsx:28`), so on admin pages the overlap risk comes from the legacy widget, whose size/position are third-party and **unknown**. Either way, the bottom-right ~80×80px corner of the page needs bottom padding.

### Low
**L1 — Tile/card `cursor:pointer` divs have no `:focus-visible` style of their own** (only global styles apply) — see §7.
**L2 — `.ado-action-card` hover lifts `translateY(-3px)`**, only under `(hover:hover)` — fine.
**L3 — `adp-title` is a fixed 22px; no fluid sizing.**
**L4 — Emoji icons (👥🩺📅) render differently per OS;** design uses clean line icons. Cosmetic.

### 5.1 Per-viewport expectation (derived from source, **not tested**)
| Width | Sidebar | Stats (current) | Notes |
|---|---|---|---|
| 320-480 | drawer | 1 col | content ≈ 300-460px; topbar crowding (M1) |
| 481-768 | drawer | 2 col | tiles `auto-fill minmax(200px)` → 2 col |
| 769-1024 | 220px fixed | `auto-fit minmax(min(100%,200px),1fr)` → 3 or 4 (3+1 wrap at ~1024 → H3) | main margin-left 252px |
| 1025-1100 | 256px fixed | auto-fill 180px | tight |
| ≥1280 | 256px fixed | stretches | no max-width (H2) |

---

## 6. Proposed layout and CSS changes (for approval — not applied)

Principle: **new dashboard-only classes with a unique prefix (e.g. `.adx-`) in a new file imported only by `AdminOverview.jsx`**, rather than editing shared `.adp-*`/`.ad-*` rules. Existing shared rules stay byte-identical except where §8 flags otherwise.

1. **Content cap**: `.adx-page { max-width: 1480px; margin-inline: auto; }` wrapping the dashboard only (fixes H2 without touching `.ad-content`).
2. **Summary cards (4)**: `grid-template-columns: repeat(4,1fr)` ≥1100; `repeat(2,1fr)` from 320-1099 (fixes H3/M1). Flat white card, 1px border `#e2e8f0`, radius 12-14, subtle shadow; no backdrop-filter. Cards remain `role="button"` today; recommend converting to `<Link>` (same `to`) — a destination-preserving change (see §7) *only with approval*.
3. **Attention banner**: flex row with `flex-wrap`, `min-width:0`, text `overflow-wrap:anywhere`; collapses to stacked list ≤640px. Only render items for which real data exists (D1).
4. **Two-column sections** (Our Doctors | Manage Users; Search Analytics | Support Tickets): CSS grid `repeat(2,minmax(0,1fr))` ≥1100, one column below. `minmax(0,…)` + `min-width:0` is required to avoid the table/label overflow seen in prior audits.
5. **Status overview rows** (Appointments, Partner Cases): `repeat(auto-fit,minmax(min(100%,150px),1fr))`; label `overflow-wrap:anywhere`, count `font-variant-numeric: tabular-nums`.
6. **Analytics bars**: inline-flex bar with `min-width:0`, label truncated with `title`; widths as percent of max.
7. **Bottom safe padding** ≈ 96px so the support widget never covers the last row (M5).
8. **Topbar (shared; high-impact — see §8)**: either leave the topbar untouched and put the design's search + Refresh in a dashboard-local toolbar row (**recommended, zero shared-CSS risk**), or extend `AdminLayout` — which would affect all admin pages and currently has someone else's uncommitted edits.
9. **Navy sidebar/topbar already match** the design (`#01164a`); no sidebar color change needed.

---

## 7. Accessibility findings

| # | Finding | Type | Evidence |
|---|---|---|---|
| A1 | Cards and tiles are `div[role=button]` with `navigate()`; no `href`, so no open-in-new-tab, no middle-click, no link semantics for screen-reader link lists. Keyboard (Enter/Space) works. | Confirmed (a11y gap, not a bug) | `AdminOverview.jsx:111, 128` |
| A2 | Tiles/cards define no dedicated `:focus-visible`; whether a visible ring appears depends on global styles in `index.css`, **not inspected** | Unverified | grep of `AdminDashboard.css` |
| A3 | Burger: off-phone `aria-expanded` is hard-coded `true` and the button toggles state that does nothing | Confirmed, low | `AdminLayout.jsx:472-475` |
| A4 | Emoji icons are un-hidden text (`👥` read aloud) | Inferred | `:111-120, 128` — add `aria-hidden` |
| A5 | `<h1>` is the greeting ("Welcome back, X 👋"); topbar title is a `div`. Section headings in the new design should be `h2` | Confirmed | `:92`, `AdminLayout.jsx:491` |
| A6 | Error banner has `role="alert"` ✔; loading state has no `aria-busy`/status text — cards just show "—" | Confirmed | `:96`, `:73` |
| A7 | Touch targets: `.adp-btn` and small status chips likely < 44px; tile cards are large (fine). Exact heights not measured | Inferred | — |
| A8 | Drawer: inert when closed ✔, Escape ✔, focus returns to burger ✔; **focus is not moved into the drawer on open and not trapped** | Confirmed | `AdminLayout.jsx:302-311` |
| A9 | Contrast: white-on-navy and `#6b7ca3` on translucent white (`.ado-action-sub`, `.adp-sub`, 12-14px) — `#6b7ca3` on near-white ≈ 4.0:1 (computed by hand, **below 4.5:1 for 12px text**); not machine-checked | Inferred | `AdminDashboard.css:429-433, 1081-1085` |
| A10 | `prefers-reduced-motion` handled at `AdminDashboard.css:310` ✔ | Confirmed | — |

---

## 8. Regression risks

1. **`AdminDashboard.css` is imported by:** `AdminLayout`, `AdminOverview`, `ManageDoctors`, `OurDoctors`, `SupportTickets`, `EmployeeLayout`, `PartnerLayout` [SRC grep]. Editing `.ad-*` shell rules changes **every admin, employee and partner page**.
2. **Duplicate global class names**: the file's own comment (line ~1189) says `AdminAppointments.css` and `ManageUsers.css` redefine `.adp-*` globally and "whichever lazy chunk loads last wins." Changing `.adp-stat`, `.adp-card`, `.adp-header`, `.adp-title`, `.adp-btn`, `.adp-badge`, `.adp-table` etc. therefore has order-dependent, cross-page effects. → Use a new prefix; do not restyle these.
3. `tests/cssPrefixGuard.test.mjs` exists (contents **not inspected**) — a new prefix must satisfy it. Run it.
4. **Uncommitted edits** in `AdminLayout.jsx` and `AdminDashboard.css` (and `ManageUsers.*`, `OurDoctors`-adjacent files) belong to other work. Implementation must rebase on them and avoid bundled commits.
5. **Existing static tests**: `liveChatSidebarStatic.test.mjs` asserts the Live Chat sidebar anchor shape; it reads `AdminLayout.jsx`. Any AdminLayout edit must keep it green. (It may already fail against the in-progress working copy — **not run**.)
6. **Data/perf**: computing ticket/appointment counts client-side means fetching full lists (`/api/appointments/admin/all`, both ticket lists, users, doctors) on every dashboard visit. Risk: slow load, large payloads, and PII in memory that the dashboard doesn't display. Prefer server aggregates (needs backend work you must approve).
7. **Partial failure handling**: today a single request failure drives one banner. With several independent sections, each needs its own loading/error/empty state so one failure doesn't blank the page or show misleading zeros (preserve the "dash, never 0" rule).
8. **Role**: dashboard route is `admin|superadmin`; `paymentadmin` never reaches it (`AdminLayout` only redirects non-admin roles; payment admin routes are separate). Any new section calling superadmin-only endpoints must be hidden for `admin`. Endpoint role guards were **not** audited beyond `/api/admin/stats` (`verifyAdminToken, adminOnly`).
9. **Shared components**: `Button` (`components/ui/Button`) is used for "Try again"; no shared-component change is required for the design.

---

## 9. Testing plan

**Automated (existing):** `cd frontend && node --test tests/` (cssPrefixGuard, liveChat sidebar static, search analytics tests). Run **before** and **after** to separate pre-existing failures. `npm run lint`, `npm run build`.
**New static tests (proposed):** a source test asserting each dashboard card/tile maps to the exact `path` listed in §4.1 and that every path exists in `App.jsx` routes; an assertion that `AdminOverview` still has no hard-coded counts.
**Manual / browser matrix:** widths 320, 360, 390, 414, 480, 600, 768, 820, 1024, 1100, 1280, 1366, 1440, 1600, 1920, 2560. For each: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), no clipped labels, widget not covering content, cards 2×2 vs 4×1 as designed.
**States:** loading, all-success, one section failing, all failing (offline), zero-data (real zeros vs "—"), very long user/doctor name (60+ chars), counts ≥ 6 digits, role = admin vs superadmin.
**Navigation test:** click/Enter/Space on every item in §4; verify URL, that the target page loads (not a redirect to `/adminauth`), and that browser Back returns to the dashboard.
**A11y:** keyboard-only pass, visible focus on all interactive elements, 200% zoom, `prefers-reduced-motion`, axe scan, touch target ≥44px at 390px.
**E2E:** extend `e2e/tests` (Playwright) with a dashboard navigation spec (existing specs only touch direct-video and session refresh).

---

## 10. Implementation sequence (after approval)

0. Resolve decisions D1-D5 (§11).
1. Baseline: run tests/build; snapshot screenshots at the 16 widths **from the current build** for before/after.
2. Add `AdminOverview` structure with the new prefix and **only data that exists**; keep current fetch + error semantics intact. Cards first (4-card grid), then banner.
3. Add sections one at a time, each with independent loading/error/empty states; wire each to its verified destination only.
4. Responsive CSS (§6) in the new stylesheet; content cap; widget padding.
5. Accessibility pass (links instead of `div role=button`, `aria-hidden` icons, focus rings, headings).
6. Only if approved: topbar search/Refresh/profile menu; backend aggregates.
7. Regression run (§9), browser matrix, then hand over for review. No commit/push/deploy without your say.

---

## 11. Items that could not be verified

**Not verified in a browser (nothing here was rendered):** every viewport in the 16-width list; sidebar/drawer behavior; header alignment; card wrapping; widget overlap; focus ring appearance; touch-target sizes; contrast. A dev server answered on `http://localhost:5173` during the audit, but no browser automation tool was used and no screenshots were taken, so **I make no claim that any width was tested.**

**Not verified in source:**
- Exact route line numbers for some routes shown with `~` (viewed in list output, not individually re-read).
- Full contents of destination pages beyond endpoint/navigate greps.
- Whether destination pages accept URL/state filters (§4.4).
- Response shape of `/api/admin/search-analytics`.
- `getDoctorWorkflowStats` route and shape.
- Global focus styles (`index.css`), `cssPrefixGuard.test.mjs` contents, and whether current tests pass.
- Size/position of the legacy `TextWidget`.
- The approved design image: **the image was not available to me — only the written description was.** Layout details (exact sections order, copy, icon set, colors) were taken from the text of the brief. Please confirm nothing in the image contradicts §6.

**Decisions needed (blocking implementation):**
- **D1** Data for Open Tickets, appointment status, search summary, attention items: reuse list endpoints (heavy), add backend aggregates (backend change), or omit sections without a source?
- **D2** Is the target `/admin-dashboard` (assumed) or `/superadmin-dashboard`?
- **D3** Should "Approved Doctors" keep going to Manage Doctors, or go to Our Doctors?
- **D4** Global search, Refresh and a profile menu do not exist — are they in scope as new UI, and what should search do?
- **D5** Are status cards allowed to deep-link with filters (requires editing the destination pages), or must they link to unfiltered pages?
