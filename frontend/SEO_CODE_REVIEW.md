# SEO Code Review — humancareconnect.co

Scope: `connect/frontend` (plus the backend routes that guard the admin/partner UI). Analysis only — no code was changed.
Paths below are relative to `connect/frontend/` unless stated.

## 1. Stack summary

| Item | Finding |
|---|---|
| Framework / build | React 19 + Vite 8, plain SPA (`src/main.jsx` → `createRoot`). No SSR, no prerender step. |
| Router | `react-router-dom` 7, `BrowserRouter`, one 3,130-line `src/App.jsx` with ~390 `<Route>`s. |
| Hosting | **Render static site** (`render.yaml`): `/* → /index.html` rewrite (HTTP 200) + security headers. `public/_redirects` is a Netlify-format leftover that **Render ignores**. No www/http/trailing-slash rules in the repo (check the Render dashboard). |
| Meta tags | `src/components/Seo.jsx` (react-helmet-async v3) used by ~72 pages; base tags hard-coded in `index.html`. No central metadata config; each page passes literal strings. |
| Sitemap/robots | Generated at build by `scripts/generate-sitemap.mjs` by regex-scraping `path="..."` out of `App.jsx`. |
| Backend | Express + Mongo (`connect/backend`), JWT in httpOnly cookies, separate role middleware. |

## 2. Findings table

Severity: P0 = blocks indexing / security, P1 = major ranking impact, P2 = polish. Effort: S ≤ 1 day, M = days, L = 1–3 weeks.

| # | Issue | Sev | Root cause (file:line) | Fix | Effort |
|---|---|---|---|---|---|
| 1 | Canonical points to homepage everywhere | P0 | `index.html:58` hard-codes `<link rel="canonical" href="https://humancareconnect.co/">`; it is in the server HTML of every URL. `Seo.jsx:10` sets a per-page canonical only after JS runs, and **no `HelmetProvider` exists at the root** (`main.jsx`, `App.jsx`); only `NotFound.jsx` and ~28 Specialty pages wrap their own nested providers. Also, many `url` props are wrong (e.g. `Conditions/Arthritis.jsx:34` says `/arthritis`, the real route is `/eye-ear-bone/orthopedics/arthritis`). | Remove canonical from `index.html`; central metadata map keyed by route; one root `HelmetProvider`; prerender (see §5) so canonical is in raw HTML. | M |
| 2 | Fully client-rendered, raw HTML identical for every URL | P0 | `index.html:162` `<div id="root">`; `main.jsx` is CSR only; `render.yaml` rewrites everything to `index.html`. | Prerender/SSG public routes (§5). | L |
| 3 | Same meta description on all pages (raw HTML) | P0 | `index.html:43` static description, same cause as #2. Per-page descriptions exist in `Seo.jsx` but only after JS. | Same as #1/#2; generate `<head>` per route at build. | M |
| 4 | Soft 404 (HTTP 200, `index, follow`) | P0 | `render.yaml` rewrite `/* → /index.html` returns 200. `App.jsx:3112` `/:slug` → `BlogPost` fetches the API and only then renders `NotFound`; `NotFound.jsx` sets noindex client-side only. `index.html:55` serves `index, follow` for the unknown URL. | Prerender a real `404.html` and have the host return 404 for unknown paths (known-route list generated at build); keep `noindex` in `NotFound`. For `/:slug` blog slugs, include known blog slugs in the prerender list. | M |
| 5 | Admin/partner/internal pages public and in sitemap | P0 | `generate-sitemap.mjs:13-20` `excludedPrefixes` omits `/partner-dashboard`, `/partner-login`, `/services-prices`, `/ServiceDemo`, `/category-consultant`, `/service-consultant`, `/appointment-booking/form`, `/appointment-booking/category-confirm`, `/doctors-note` dupes, `/pay`, `/video-call`. `robots.txt` (`:148-156`) also doesn't disallow them. `App.jsx:1630` registers `/services-prices` with **no route guard at all**. | Add an allow-list instead of a deny-list (see #6/§6); guard `/services-prices` with `PrivateRoute` (superadmin); add `noindex` + robots disallow for the rest. | S |
| 6 | Sitemap quality | P1 | `generate-sitemap.mjs:112` stamps every URL with today's date (build time). Route scraping picks up uppercase paths (`App.jsx:2861` `/mental-health/psychiatry/Ocd`, `:2984` `/ServiceDemo`), the typo `weight-and-nurtrition` (18 occurrences in `App.jsx`), and `:2918` `/uti-symptoms-causes-treatment-&-when-to-see-a-doctor`. Duplicate `<Route>` paths are deduped, but the dupes mask real conflicts (see #8). | Source the sitemap from the central metadata map (indexable flag + real `lastmod` from content/git date); lowercase/kebab slugs; rename typo and UTI URL with 301s. | M |
| 7 | No working structured data | P1 | `Seo.jsx:33-35` always renders `<script type="application/ld+json">{JSON.stringify(schemaData)}</script>`; no page passes `schemaData`, so it renders empty/`undefined`. Only `BlogPost.jsx:84`, `Specialties.jsx:666` and two blogs emit real JSON-LD. | Schema factory in the metadata module (§7); stop emitting empty script. | M |
| 8 | Duplicate / cannibalising pages and routes | P1 | Same component under many URLs: `/doctors-note` (`App.jsx:2267` **and** `:2871`, registered twice), `/medical-certificate` (`:2279`), `/doctor-note-or-sick-notes` (`:3068`); `/prescription-refill` (`:2287`) vs `/online-prescription-refills` (`:2998`); `/second-medical-opinion` (`:2295`) vs `/online-second-medical-opinion` (`:3007`) vs `/expert-medical-opinion` (`:3011`); `/chronic-care/cardiology` (`:1873`) vs `/chronic-care-and-expert-opinion/cardiology` (`:1866`); `/mental-health` (`:1846`) vs `/mental-health-support` (`:2994`); two hair-loss pages (`:2400` skin, `:2800` men); `/chronic-care/gastroenterology|neurology|pulmonology` and `/child-and-family-care/pediatrics` each registered 2–3 times; asthma (`/chronic-care/pulmonology/asthma`, `/asthma-flare-up`, `/mild-asthma-symptoms`), migraine (`/chronic-care/neurology/migraine`, `/chronic-care/neurology/chronic-migraine`, blog) and UTI (`/mens-health/urology/urinary-tract-infection`, `/bladder-infection`, blog). | Pick one canonical per intent; 301 the rest (§6.3); remove duplicate `<Route>`s. | M |
| 9 | Thin condition pages | P1 | `pages/Conditions/*.jsx` (115 files) are one template: `<h1>` = condition name only (`Arthritis.jsx:48-50`), one `<h2>`, generic copy. | Content rewrite per priority condition (symptoms, causes, when to see a doctor, treatment via telehealth, FAQ, clinician review date); descriptive H1. Content task, not code. | L |
| 10 | Performance / page weight | P1 | No `loading="lazy"` on most images (54 of 143 `<img>` have it); large PNGs in `src/assets` (`CATEGORIES/1-7.png`, `404*.png` 187 KB, `NewLogo.png` 94 KB, `Logo.png`, `NethajiEsign.png` 122 KB…); `public/logo-footer.png`; `vite.config.js:46-50` `manualChunks` puts *everything matching "react"* in `vendor-react` (also matches `react-icons`, `react-select`, `react-helmet`…) so a large shared chunk loads on every page; blog pages and ~10 other pages are imported eagerly in `App.jsx:48-61`; `cssMinify: false` (`vite.config.js:20`); Google Fonts + Fontshare are render-blocking `<link rel=stylesheet>` (`index.html:21-29`); duplicate preconnect (`:17-18`). | Convert PNG→WebP/AVIF, `width/height`, lazy-load below the fold, lazy-import the blog pages, enable `cssMinify`, narrow `manualChunks`, `font-display`/self-host fonts. | M |

## 3. Additional SEO problems found

| # | Problem | Sev | Where | Fix |
|---|---|---|---|---|
| A1 | OG/Twitter image files don't exist: `Seo.jsx:19,31` → `/Logo.png`, `index.html:78` → `/preview.jpg`, but `public/` contains only favicon, icons, 3 logos. They live in `src/assets` and get hashed. Result: broken link previews. Also `og:image` is declared 1200×630 in `index.html` but 250×250 in `Seo.jsx:20`. | P1 | `Seo.jsx`, `index.html` | Add a real 1200×630 `public/og-default.jpg` + per-page images. |
| A2 | `Seo.jsx:9` hard-codes `robots="index, follow"`, `og:type="website"`, no `noindex` option. No page can opt out. | P1 | `Seo.jsx` | Add `robots` prop (default from config). |
| A3 | `react-helmet` v6 is in `package.json` but unused (0 imports); two Helmet libs shipped. | P2 | `package.json` | Remove `react-helmet`. |
| A4 | Nested `HelmetProvider` per page (`NotFound.jsx:6`, 28 Specialty pages) – separate instances; tags can conflict/duplicate. | P1 | listed files | One provider in `main.jsx`. |
| A5 | `robots.txt` is not in the repo or `public/`; it is created only by the sitemap script at build, and `build` runs the production mode by default — a UAT deploy using `npm run build` would ship `Allow: /` (UAT uses `build:uat`; verify the Render service uses the right script). `robots.txt` lists `Disallow: /pay/`, `/video-call/` but not partner/superadmin-adjacent public pages. | P1 | `generate-sitemap.mjs:139-160` | Add disallow entries; add `X-Robots-Tag: noindex` header for non-prod in `render.yaml`. |
| A6 | Legacy 301 in `public/_redirects` (`/appointment-booking/form?category=…`) never executes on Render. | P2 | `public/_redirects`, `render.yaml` | Move into `render.yaml` `routes` (Render supports `redirect` type) or handle in `AppointmentBookingLegacyRedirect.jsx`. |
| A7 | No www/http/trailing-slash canonicalisation in repo; relies on Render defaults. `/foo/` vs `/foo` both return 200 with the same canonical-less HTML. | P1 | `render.yaml` | Verify on Render dashboard; add explicit redirect rule for `www` → apex. |
| A8 | No `hreflang`, which is fine for a US-only site, but add `<html lang="en-US">` (currently `lang="en"`, `index.html:2`). | P2 | `index.html` | Set `en-US`. |
| A9 | Images: ~117 of 143 `<img>` tags lack an `alt` on the same line (multi-line tags may inflate this — verify with an ESLint `jsx-a11y/alt-text` run). | P2 | across `src` | Lint rule + fill alts. |
| A10 | Internal links: mostly `<Link>` (231) – good. 56 CTA buttons use `onClick={() => navigate(...)}` (Header/booking CTAs) which are not crawlable. | P2 | grep `navigate(` | Convert navigational ones to `<Link>`. |
| A11 | Header `<h1>`: condition pages have exactly one H1 (good) but the H1 is the bare condition name. Home/Category pages not audited for heading order. | P2 | `Conditions/*` | See #9. |
| A12 | Pages that should be `noindex`: login, `/appointment-booking/*` wizard steps, `/pay/:token`, `/user/*`, `/doctor-login`, `/employee-login`, `/partner-login`, `/payment-admin-login`, `/adminauth`, `/services-prices`, `/ServiceDemo`, `/category-consultant`, `/service-consultant`, `/cookies`, `/images`, `/test`. Several are blocked only by robots.txt (which stops crawling but not indexing if linked). | P1 | `App.jsx` | `robots: noindex` in metadata map; keep robots.txt open for these so the tag can be seen — or leave disallow and rely on 404/noindex at the host. |
| A13 | `Seo.jsx:8` `keywords` meta is ignored by Google; harmless. | P2 | — | Drop. |
| A14 | `index.html:12` CSP allows `'unsafe-inline'` scripts (GTM requires it) — not SEO, noted for §4. | P2 | `index.html` | Nonce-based CSP later. |

## 4. Security findings (top priority)

**Bottom line: the backend enforces auth; the frontend routing leaves some privileged UI public.** No server-side auth exists in the *frontend host* (a static Render site can't have any), so the SPA route guards are UX only; real enforcement is the API.

| # | Finding | Sev | Evidence | Recommendation |
|---|---|---|---|---|
| S1 | `/services-prices` renders the full "Create/Edit/Delete Service" admin UI to anyone, no guard. | **P0 (exposure) / P2 (impact)** | `App.jsx:1630` `<Route path="/services-prices" element={<ServicesPrices />} />` (every other admin route is wrapped in `PrivateRoute`). `pages/admin/ServicesPrices.jsx` calls `GET/POST/PUT/DELETE /api/services`. | **Writes are protected**: `backend/routes/services.js` `POST/PUT/DELETE` use `verifyAdminToken, superAdminOnly`, so an anonymous visitor gets 401/403. But `GET /api/services` is public (also leaks the full service catalogue + prices — probably intended since the site uses it). **Decision:** guard it in place first (`PrivateRoute allowedRoles={["superadmin"]}`, noindex, remove from sitemap, robots disallow), then move it under `/superadmin-dashboard/…` in a later change. |
| S2 | `/partner-dashboard/*`, `/partner-login` are indexable and in the sitemap. | P1 | `App.jsx:1470-1520` use `PartnerPrivateRoute` (client redirect to login). `backend/routes/partner.js:22` `router.use(verifyPartnerToken, partnerOnly, attachPartnerCompany)` protects **all** `/api/partner/*` endpoints. | API is protected. Remove from sitemap, add noindex; login page may stay public but noindex. Exposing the existence of a partner portal is low risk. |
| S3 | Other privileged routes | P2 | `/admin-dashboard/*`, `/superadmin-dashboard`, `/payment-admin/*`, `/employee-dashboard/*`, `/doctor-dashboard/*` all wrapped in role-specific guards in `App.jsx`; backend middleware (`middleware/verifyToken.js`: `verifyAdminToken`, `verifyPartnerToken`, `partnerOnly`, `superAdminOnly`) uses httpOnly cookies. | OK. Still: client guards render the lazy JS bundle of every dashboard to unauthenticated users — an information-disclosure/size issue, not an auth bypass. |
| S4 | Public JS bundle contains all admin code and API paths (no server rendering of guards). | P2 | single SPA bundle | Acceptable if the API is authoritative; consider separate admin build/subdomain (`admin.humancareconnect.co`) with its own `X-Robots-Tag: noindex`. |
| S5 | `GET /api/pricing` and `GET /api/services` are public. | Info | `routes/pricing.js`, `routes/services.js` | Intended for the public site; no PII. |
| S6 | Not verified in this pass | — | I did not review `superAdminOnly` / `makeVerify` internals line-by-line, CORS config, or rate limiting. `SECURITY_AUDIT_REPORT.md` and `FULL_APP_SECURITY_AUDIT_2026-08-05.md` already exist at `connect/` root and should be re-read against this. | Recommend a quick manual test with `curl -X POST /api/services` (no cookie) on production to confirm 401. |

## 5. Rendering recommendation

Options for a Vite + React Router SPA with ~400 mostly static marketing routes:

| Option | What changes | Pros | Cons | Effort | Risk |
|---|---|---|---|---|---|
| **A. Build-time prerender of public routes (SSG) — recommended** | Keep Vite/React. Add `vite-react-ssg` or `vite-plugin-ssr`-style prerender, or a small custom script (`react-dom/server` + `StaticRouter`) that renders each indexable route from the central route/metadata list into `dist/<route>/index.html` with a correct `<head>`. Admin/user/partner routes stay SPA (served by the `/*` fallback). Add a real `404.html`. | Minimal rewrite; correct title/desc/canonical/JSON-LD/body text in raw HTML; works on Render static; fastest path to fixing P0 items; no server to run. | Pages must be SSR-safe (no `window`/`document` at module top level; GSAP/Lenis/framer-motion/Swiper need guarding); lazy routes need `await`-style loaders; hydration mismatches; build time grows with ~300 pages; blog posts from the API need to be fetched at build time (rebuild on publish or a webhook). | M–L (1–2 weeks) | Medium (hydration bugs) |
| B. Prerender service (Prerender.io / Rendertron / Cloudflare) | No code change; proxy bots to rendered HTML | Fastest (days) | Ongoing cost; cloaking risk if output differs; doesn't fix 404 status unless the service forwards it; adds an extra hop and a failure mode; Google says dynamic rendering is a workaround | S | Medium (operational) |
| C. Migrate to Next.js (App Router) | Rewrite routing, data loading, 1,000+ files of imports, auth/context providers | Best long-term SEO + metadata API, real 404s/redirects, ISR for blogs | Biggest effort; touches the whole app including dashboards and video-call code; regression risk on payments/auth | L (4–8 weeks) | High |
| D. Do nothing (CSR only) | — | — | Googlebot renders JS, but with delays and inconsistent head handling; other engines/AI crawlers see an empty page | — | High SEO risk |

**Decision (approved): Option A, build-time prerender, is the chosen path and will be built later in Phase 2.** Rationale: Option A for marketing/clinical content routes. Reasons: the content is static and the site is already on a static host, the stack stays intact, and P0 items #1–4 are all solved by having correct per-route HTML + a real 404. Revisit Next.js only if you later need per-request data on public pages. A prerender service (B) is acceptable as a stop-gap while A is built.

## 6. Implementation plan

### Phase 0 — Same-day safety fixes (S)
1. Guard `/services-prices` **in place** with `PrivateRoute` (superadmin), `App.jsx:1630`. (Moving it under `/superadmin-dashboard/` is a later step, Phase 1.)
2. Add exclusions to `excludedPrefixes`/`excludedExactPaths`: `/partner-dashboard`, `/partner-login`, `/services-prices`, `/ServiceDemo`, `/appointment-booking/form`, `/appointment-booking/category-confirm`, `/category-consultant`, `/service-consultant`, `/pay`, `/video-call`, `/direct-video-call`; add to robots Disallow.
3. Remove `<link rel="canonical">` and `og:url` from `index.html`.
4. Confirm with `curl` that `POST /api/services` is 401 for anonymous callers.

### Phase 1 — Technical fixes (M)
1. Single `HelmetProvider` in `main.jsx`; remove nested providers; remove unused `react-helmet`.
2. Create `src/seo/routes.js` (central metadata, §7) + `src/seo/schema.js`; make `Seo.jsx` read from it by `useLocation().pathname` with prop overrides; support `robots`, `og:image`, `og:type`, JSON-LD array.
3. Fix wrong `url` props (use the metadata map, never literals).
4. Delete duplicate `<Route>`s; implement the 301 map below.
5. Sitemap generated from the metadata map (only `indexable: true`), with real `lastmod`.
6. Add 1200×630 default OG image to `public/`; fix `Logo.png` references.
7. Redirects: either `render.yaml` `routes: - type: redirect` entries (Render supports `redirect` with 301), or a `redirects.json` consumed by the prerender step.
8. www→apex and trailing-slash policy (one canonical form, no slash).
9. Move `/services-prices` under `/superadmin-dashboard/…` (after the in-place guard from Phase 0 has shipped).
10. Apply the approved duplicate merges (§6.3.1) and the hair-loss/UTI/asthma/migraine rewrites (§6.3.2–6.3.3).
11. Rename `weight-and-nurtrition` → `weight-and-nutrition` with 301s (§6.5) as a separate release after steps 1–8.

### Phase 2 — Rendering (L)
1. Make public pages SSR-safe (guard browser APIs).
2. Add the prerender script / `vite-react-ssg` for the indexable routes + `404.html` (served with 404 by the host; on Render static sites this needs a `routes` `rewrite` limited to app-only prefixes such as `/user`, `/doctor-dashboard`, `/admin-dashboard`, … instead of `/*`).
3. Fetch blog content at build time for `/:slug` routes; rebuild via deploy hook when a blog is published.
4. Verify with `curl -s URL | grep -E "<title>|canonical|ld\+json"` for 20 sample URLs.

### Phase 3 — Performance & content (M–L)
1. Convert images to WebP/AVIF, add dimensions + `loading="lazy"`, `fetchpriority` on LCP image.
2. Lazy-load blog pages, fix `manualChunks`, enable `cssMinify`, self-host fonts.
3. Content expansion of condition pages (H1 with intent, 600–1,000 words, FAQ, medical review byline/date).
4. Internal-link pass: hub → spoke links, breadcrumbs component (UI + JSON-LD).
5. Submit new sitemap in Search Console; monitor index coverage and the 301 map.

### 6.3 Decisions and 301 redirect map (draft winners approved; implementation deferred)

**Status:** Option A (build-time prerender) is approved as the rendering path, to be built later (Phase 2). No code has been changed. All redirects below are **permanent (301)** and must be implemented together with removal of the duplicate `<Route>`s, the sitemap update, and updated internal links (a redirect is not a substitute for fixing internal links).

#### 6.3.1 Duplicate groups

| Group | Winner (kept) | 301 from (losers) | Notes |
|---|---|---|---|
| Doctor's note | `/doctors-note` | `/doctor-note-or-sick-notes`, `/medical-certificate` | Keep `/fit-to-fly-certificate` separate (distinct intent). Fold "medical certificate / sick note / work excuse" wording into the winner's copy, H2s and FAQ so the merged intent is still covered. Remove the double `<Route>` at `App.jsx:2267` and `:2871`. |
| Prescription refill | `/online-prescription-refills` | `/prescription-refill` | Keep `/medication-refill-while-traveling` and `/chronic-medication-management` as distinct-intent pages that link up to the winner. |
| Second opinion | `/online-second-medical-opinion` | `/second-medical-opinion`, `/expert-medical-opinion` | The condition children already live under `/online-second-medical-opinion/*` (cancer, surgery, treatment-plan, complex-diagnosis), so this winner also matches the existing hierarchy. |
| Cardiology | `/chronic-care/cardiology` | `/chronic-care-and-expert-opinion/cardiology` | Children already live under `/chronic-care/cardiology/*`. |
| Mental health hub | `/mental-health` | `/mental-health-support` | Fold the service-page content into the hub (or into a section of it). |
| ENT | `/eye-ear-bone/ear-nose-throat` | `/ent` | |
| Asthma | `/chronic-care/pulmonology/asthma` | `/mild-asthma-symptoms` | **Keep `/asthma-flare-up`** as its own page (acute-episode intent) with a self-canonical and a link to the asthma page, and vice versa. |
| Migraine | `/chronic-care/neurology/migraine` | `/chronic-care/neurology/chronic-migraine` | Merge: move the chronic-migraine content (recurring/frequent attacks, prevention, medication-overuse) into a section of the migraine page. The informational blog stays, with a self-canonical and a link to the condition page. |
| UTI | **Approved:** `/urinary-tract-infection` (flat, gender-neutral) | `/mens-health/urology/urinary-tract-infection`, `/bladder-infection` | See 6.3.3. |
| Hair loss | Keep both (distinct intent) | none | See 6.3.2. |

#### 6.3.2 Hair loss: keep both, make the intent distinct

| Page | Intent | Required changes |
|---|---|---|
| `/skin-and-hair-care/dermatology/hair-loss` (`App.jsx:2400`) | **General**: shedding, thinning, patchy loss, telogen effluvium, scalp conditions; all genders | Title/H1 about general hair loss; breadcrumb under Skin & Hair Care; link to the men's page for male-pattern hair loss. |
| `/mens-health/men-health/hair-loss` (`App.jsx:2800`) | **Men-specific**: male-pattern baldness (androgenetic alopecia), receding hairline, treatment options | Title/H1 e.g. "Male Hair Loss / Male Pattern Baldness Treatment Online"; rewrite the body so it is not a duplicate of the general page (check the two components for shared copy); breadcrumb under Men's Health; self-canonical on both; reciprocal links. Do not make unsupported efficacy claims. |

Test: after the rewrite the two pages must have different titles, H1s, descriptions and mostly different body text; otherwise reconsider merging.

#### 6.3.3 UTI: gender-neutral canonical

Today three URLs target the same intent: `/mens-health/urology/urinary-tract-infection` (men-framed hierarchy for a condition that is far more commonly searched by women), `/bladder-infection` (flat), and the blog `/uti-symptoms-causes-treatment-&-when-to-see-a-doctor`.

- **Approved canonical: `/urinary-tract-infection`.** Reasons: gender-neutral; matches the site's flat convention for symptom pages (`/burning-urination`, `/frequent-urination`, `/bladder-infection`); matches `keywords.xlsx` row 296 (`/urinary-tract-infection`, "UTI Treatment Online | Virtual Urinary Tract Infection Care"). Alternative if you prefer hierarchy: `/urinary-health/urinary-tract-infection`, but that needs a new category/specialty node, which is a larger change.
- 301: `/mens-health/urology/urinary-tract-infection` → `/urinary-tract-infection`; `/bladder-infection` → `/urinary-tract-infection` (fold "bladder infection / cystitis" wording into the page copy and FAQ).
- Keep `/mens-health/urology/*` for men-specific urinary pages (`urinary-symptoms-in-men`, `kidney-stones`, `blood-in-urine`, `bladder-problems`) and link to the UTI page.
- The blog stays as the informational "symptoms, causes, when to see a doctor" article, renamed to `/uti-symptoms-causes-treatment-and-when-to-see-a-doctor` (drop the `&`; 301 from the old one), and linked to/from the condition page.
- Breadcrumb: Home › Urinary Health (or Primary Care) › UTI. The price mapping (`useCategoryPrice.js`) and `searchIndex.js` must be updated for the new path.
- Files referencing the old UTI/bladder paths (to update at implementation time): `frontend/src/App.jsx`, `src/data/searchIndex.js`, `src/pages/Blogs/UTI.jsx`, `src/pages/Categories/MenHealth.jsx`, `src/pages/Conditions/Conditions/BladderInfection.jsx`, `src/pages/Specialty/MensHealth/Urology.jsx`, `src/pages/Symptoms.jsx`, `backend/services/search/discoveryRoutes.js`.

#### 6.3.4 Other URL clean-up redirects

| From | To | Note |
|---|---|---|
| `/weight-and-nurtrition` and `/weight-and-nurtrition/*` (about 19 URLs) | `/weight-and-nutrition` and `/weight-and-nutrition/*` | Deferred (see 6.5). |
| `/mental-health/psychiatry/Ocd` | `/mental-health/psychiatry/ocd` | lowercase. React Router matches case-insensitively, so both resolve today; the 301 removes the duplicate URL. |
| `/ServiceDemo` | remove from the app (404/410); internal demo | also drop from sitemap |
| `/uti-symptoms-causes-treatment-&-when-to-see-a-doctor` | `/uti-symptoms-causes-treatment-and-when-to-see-a-doctor` | drop `&`; add the new slug to the blog reserved list |
| `/appointment-booking/form?category=X&specialty=Y&condition=Z` | `/appointment-booking/X/Y/Z` | currently in `public/_redirects`, which Render ignores |
| `www.humancareconnect.co/*`, `http://`, trailing-slash variants | `https://humancareconnect.co/<path-without-slash>` | host-level; verify in the Render dashboard |

Redirect mechanics on Render static: `render.yaml` `routes` entries with `type: redirect` (wildcards supported, e.g. `/weight-and-nurtrition/*` → `/weight-and-nutrition/:splat`; confirm the exact syntax and status-code options against the current Render docs when implementing). Redirects must come before the `/*` rewrite. Keep an in-app `<Navigate replace>` only as a secondary safety net, since it is not a real 301 for crawlers.

### 6.4 `keywords.xlsx` check (does any group flip?)

**The file contains no search-volume data.** It has 313 slug rows with the columns `Sr. No., Slug, Full URL, Page Type, Title, Meta Description, Keywords`: a title/description/keyword plan, not a volume export (286 rows have a title; legal pages and a few others are blank). So **I cannot flip any group on volume, and none has been flipped.** For a data-driven decision, export impressions/clicks per URL from Search Console (or volumes from a keyword tool) for the losing URLs before the 301s ship; flip a group only if a loser clearly has more demand than the winner for the same intent.

What the file does tell us:
- It plans **distinct titles for most duplicate pairs**, so these pages were written as separate targets: `/doctors-note` ("Doctor's Note Online | Telemedicine Medical Documentation"), `/medical-certificate` ("Medical Certificate Online | Doctor's Note & Medical Clearance"), `/doctor-note-or-sick-notes`; `/prescription-refill` vs `/online-prescription-refills`; `/second-medical-opinion`; `/mental-health` vs `/mental-health-support`; `/asthma` vs `/asthma-flare-up` vs `/mild-asthma-symptoms`; `/hair-loss` vs `/hair-loss-mens-health` (the latter has no title yet). Wording from the losers' titles/keywords should be merged into the winner, not dropped.
- Soft signals only, no numbers: "doctor's note" is the dominant US phrase, which supports `/doctors-note`; "medical certificate" is mostly non-US phrasing and the site is US-focused, so folding it in is reasonable. The file lists `/mental-health` as the category hub, supporting it over the service page. **Nothing in the file argues for reversing a draft winner.**
- **The file's slugs do not match the live routes**: it uses flat slugs (`/asthma`, `/urinary-tract-infection`, `/cardiology`, `/migraines`, `/hair-loss`) while the live site uses nested ones (`/chronic-care/pulmonology/asthma`, etc.), a mixed-case slug (`/ADHD-evaluation`) and the typo `/weight-and-nurtrition`. It cannot be imported into the metadata map as-is; it needs a slug-to-route mapping step. Its `/migraines` (plural) differs from the live `/migraine`.
- Its titles/descriptions can seed the central metadata map (section 7) after review. Some titles contain a corrupted apostrophe character (e.g. "Doctor's Note" shows a replacement glyph), so check encoding before reuse.

### 6.5 `weight-and-nurtrition` → `weight-and-nutrition` (deferred; with 301s)

Decision: do the rename **later**, after Phase 1, together with the 301s, in a single release. Affected places found by text search (occurrence counts in brackets):

**Frontend (`connect/frontend/src`)**
- `App.jsx` (18: the category route `/weight-and-nurtrition`, its three specialty children `weight-management`, `lifestyle-medicine`, `nutrition-and-dietetics`, and their condition pages)
- `components/Header.jsx` (1 nav link), `pages/Categories.jsx` (1), `pages/Specialties.jsx` (3), `pages/Symptoms.jsx` (11)
- `data/searchIndex.js` (24: client-side search results link to these paths)
- `hooks/useCategoryPrice.js` (11: path → price-category map; **if these keys aren't updated, the renamed pages silently lose their price**)
- `pages/Categories/WeightNutrition.jsx` (15) and `pages/Specialty/WeightAndNutrition/{LifestyleMedicine,NutritionAndDietetics,WeightManagement}.jsx` (3, 6 and 3)
- Hard-coded `url=` canonicals in these pages (superseded by the central metadata map)

**Backend (`connect/backend`)**
- `services/search/discoveryRoutes.js` (14: category/specialty route table at lines 44–46 and the condition route list at 271–281; the search API returns these URLs to the site)
- `services/search/searchConstants.js:45` (`"Weight & Nutrition": "/weight-and-nurtrition"`)
- `scripts/searchTaxonomy/searchTaxonomyDecisions.js:27` and `scripts/searchTaxonomy/searchTaxonomyMigrationPlan.json:6572` (`legacyId`; one-off migration data, decide whether to rewrite or leave as historical)
- `data/reservedBlogSlugs.js:180`: **add** `weight-and-nutrition` and **keep** the old slug reserved so a blog can never claim it and shadow the redirect

**Other**
- `scripts/generate-sitemap.mjs` reads routes from `App.jsx`, so it follows automatically (or from the metadata map later).
- `connect-mobile` (Flutter): no occurrences found by text search of the repo.
- **Not checkable from code:** MongoDB documents. `HealthcareCategory` (slug/route fields), `CategoryPricing`, stored search-index data, or stored blog/internal links may embed the old slug. The migration plan refers to the category by `liveCategoryId`, so it is probably keyed by id, but verify with a DB query for `nurtrition` across the relevant collections before the rename. Also check Search Console, GTM/GA4 filters and external links/emails using the old URLs (the 301s cover external links).

Order of work: (1) add new routes + 301s from the old ones; (2) update all internal links, search constants/index and the price map; (3) update the sitemap; (4) deploy; (5) verify the old URLs 301 and prices still show via `useCategoryPrice`; (6) keep the redirects permanently.

## 7. Per-page metadata plan

**Single source of truth:** `src/seo/routes.js`, generated/validated at build and used by (a) `Seo.jsx`, (b) the sitemap script, (c) the prerender step, (d) the robots generator.

```js
// src/seo/routes.js (shape)
export const SEO_ROUTES = {
  "/": {
    title: "Online Doctor Consultation in the USA | Humancare Connect",
    description: "…150–160 chars, unique…",
    canonical: "/",                // path; origin prepended centrally
    robots: "index,follow",
    ogImage: "/og/home.jpg",
    schema: ["Organization", "WebSite", "MedicalWebPage"],
    lastmod: "2026-10-01",
  },
  "/chronic-care/cardiology/high-blood-pressure": {
    title: "High Blood Pressure Treatment Online | Humancare Connect",
    description: "…",
    canonical: "/chronic-care/cardiology/high-blood-pressure",
    robots: "index,follow",
    breadcrumb: [["Home","/"],["Chronic Care","/chronic-care"],["Cardiology","/chronic-care/cardiology"],["High Blood Pressure"]],
    schema: ["MedicalWebPage","MedicalCondition","FAQPage","BreadcrumbList"],
    medical: { condition: "Hypertension", reviewedBy: "…", lastReviewed: "…" },
    faqs: [{ q: "…", a: "…" }],
  },
  "/services-prices": { robots: "noindex,nofollow", indexable: false },
  // …
};
```

Rules the build enforces (fail build on violation): unique title, unique description (≤160), canonical equals the route path or an explicit target, lowercase/kebab path, `robots: noindex` for all non-public routes, no route in sitemap unless `indexable !== false`.

| Page type | Title pattern | Robots | Schema |
|---|---|---|---|
| Home | Brand + primary service | index | `Organization` (name, logo, sameAs, contactPoint), `WebSite` (+ SearchAction if a search page exists), `MedicalWebPage` |
| Category / Specialty hub | `{Category} Online Care | Humancare Connect` | index | `MedicalWebPage`, `BreadcrumbList`, `FAQPage` where FAQs are visible |
| Condition | `{Condition} Treatment Online | Humancare Connect` | index | `MedicalWebPage` (+`about: MedicalCondition`, `lastReviewed`, `reviewedBy`), `MedicalCondition` (name, signOrSymptom, possibleTreatment), `FAQPage`, `BreadcrumbList` |
| Service (doctor's note, refills, second opinion) | intent-first | index | `MedicalWebPage`, `Service`/`MedicalProcedure` as applicable, `FAQPage`, `BreadcrumbList` |
| Blog (legacy + API) | article title | index | `Article`/`MedicalWebPage`, `FAQPage`, `BreadcrumbList` (`BlogPost.jsx` already emits FAQPage only) |
| Legal pages | title | index (low priority) | `WebPage` |
| Login/dashboards/pay/video/internal | — | noindex,nofollow | none |

Compliance notes for medical schema: only mark up content visible on the page; `FAQPage` only with real, visible FAQs; do not claim `reviewedBy` unless true.

## 8. Items I could not confirm from code

- **Live browser check (reported by you, after hydration):** the *first* `<link rel="canonical">` on every page is still the homepage, the meta description is still the static one from `index.html`, while the **title does change**. Interpretation: the static tags in `index.html` (`:43` description, `:58` canonical) are winning, and Helmet's tags are either not replacing them or are being added **in addition to them** (duplicate canonical/description tags). With no root `HelmetProvider` (and nested providers in `NotFound.jsx` and ~28 Specialty pages), react-helmet-async runs on a fallback instance, and tags that exist in the static HTML but were not created by Helmet are not necessarily removed. Google treats conflicting canonicals as unreliable and generally uses the first one it finds, which would explain the audit result. **Not yet verified in code:** whether the duplicates come from the missing/nested provider or from Helmet's tag-handling rules; confirm with `document.querySelectorAll('link[rel=canonical]')` in DevTools. **Action for Phase 0/1:** delete the static canonical, `og:url`, description, `og:*` and `twitter:*` tags from `index.html` (keep only truly global tags: charset, viewport, theme-color, icons, site verification, GTM), add a single root `HelmetProvider`, then re-check that exactly one canonical exists and matches the URL. With prerendering (Phase 2) each page's raw HTML carries its own correct tags, which removes this class of problem.
- Actual Render dashboard settings (www redirect, custom headers, which build script is used per environment).
- Live transfer sizes (2.2 MB / 32 JS files); the config explains the cause (#10) but I did not run a build or Lighthouse.
- The `dist/` folder in the repo is stale (no sitemap/robots in it); I did not rely on it.

## 9. Decisions log and open items

| # | Item | Status |
|---|---|---|
| 1 | Rendering path | **Approved:** Option A, build-time prerender, later (Phase 2). |
| 2 | Duplicate winners | **Draft approved:** `/doctors-note`, `/online-prescription-refills`, `/online-second-medical-opinion`, `/chronic-care/cardiology`, `/mental-health`, `/eye-ear-bone/ear-nose-throat`; losers get 301s (§6.3.1). Keep both hair-loss pages with distinct intent; keep `/asthma-flare-up`; `/mild-asthma-symptoms` → asthma; chronic-migraine → migraine; UTI → **`/urinary-tract-infection` (confirmed)**, with `/mens-health/urology/urinary-tract-infection` and `/bladder-infection` 301ing to it. |
| 3 | `keywords.xlsx` flips | The file has no volume data, so no group was flipped. Provide Search Console / keyword-tool numbers if you want any group re-checked (§6.4). |
| 4 | `/services-prices` | **Approved:** guard in place first, move under `/superadmin-dashboard/` later. |
| 5 | `weight-and-nurtrition` rename | **Approved, later,** with 301s; affected files listed in §6.5. Open: MongoDB check for the old slug. |
| 6 | UTI canonical | **Approved:** `/urinary-tract-infection` (flat, gender-neutral). |
| 7 | Open | Decide whether to export Search Console data for the duplicate groups before the 301s ship; confirm Render redirect/`www` settings. |
