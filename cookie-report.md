# Cookie and browser-storage report: Humancare Connect

Captured 2026-11-24. This builds on the earlier static audit and adds browser verification. No project code was modified. Test scripts, the scratch database and captured JSON live in the Claude scratchpad folder, outside the repo. Cookie values, tokens and personal data were never recorded or printed. Only name, flags, lifetime, value *shape* (for example "JWT, 283 chars") and length were kept.

---

## 0. How this was measured (and what it can't tell you)

| Item | Detail |
|---|---|
| Browser | Playwright 1.55 with headless Chromium, fresh in-memory profile for every scenario, desktop Chrome user-agent |
| Stack | Frontend: Vite dev server `localhost:5173` (proxies `/api` and `/socket.io` to the backend). Backend: `node server.js` on `:5000` against a **throwaway local MongoDB on :27018**. I confirmed with `netstat` that the backend held connections to `:27018` only, never to the Atlas URI in `backend/.env`. |
| Test data | One seeded patient with random credentials, plus a one-category catalogue (General Care, 50 USD) so the booking page had something to book. No real data was touched. |
| Third parties | Real. GTM, Google Analytics, Clarity, Stripe, PayPal and Google Identity were contacted live from this machine, so the third-party cookies below are genuinely observed, not guessed. |
| Cookie attribution | A read-only hook on `document.cookie` logged which script set each JS cookie (name and attributes only). Response `Set-Cookie` headers were logged by name for network-set cookies. |

Limitations to keep in mind:

1. **Local is not production.** On `localhost` the backend's auth cookies come out `Secure=false; SameSite=Lax`, because `NODE_ENV=development`. In production the code sets `Secure; SameSite=None` ([verifyToken.js:28-37](backend/middleware/verifyToken.js#L28-L37)). First-party analytics cookies are scoped to `localhost` here but would be on the real registrable domain in production.
2. **Geography.** The test machine is not in the EU or India. Currency and geo features that depend on IP were not exercised. **Razorpay** only loads for INR users, so I did not observe it. **Cloudflare Turnstile** is in the CSP but I found no loader in `src`.
3. **The payment itself was not completed.** I stopped at the payment method choice (card and PayPal buttons). Clicking either would have made the backend create a real payment object with Stripe or PayPal.
4. **Headless Chromium** can differ slightly from a real user's Chrome (extensions, Safe Browsing, third-party cookie phase-out settings).

---

## 1. The four states tested

| State | What I did |
|---|---|
| **a** | Fresh profile, home page loaded, waited 10 s, **banner showing, nothing clicked** |
| **b** | Same profile, clicked **Accept All**, waited 10 s, then loaded a second page (`/contact-us`) |
| **c** | **New** fresh profile, home page, waited 10 s (this is identical to a), clicked **Reject**, waited 10 s, loaded a second page |
| **d** | Fresh profile, chose Reject (**d-R**) or Accept All (**d-A**) on the banner, logged in as the patient, went through the booking form up to the payment step (a consent dialog, then the card/PayPal choice). I ran d twice and the cookies were identical apart from the consent key, so one "d" column covers both. |

---

## 2. Cookies

"Observed" lifetimes were measured from the browser's cookie jar. The `a/b/c/d` columns say whether the cookie was present in that state (y/n).

### 2.1 Cookies set before any consent click (state a)

All ten names below appeared **within seconds of the first page load, before the banner was touched**. They were also all present after Reject (c) and after Accept (b).

| Cookie | Domain | Set by | Purpose (plain language) | Category | Expiry | HttpOnly / Secure / SameSite / Path | Party | Personal data? | a | b | c | d |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `_ga` | site (`localhost` here) | JS: `googletagmanager.com/gtag/js`, which is loaded by GTM tag *Google tag* ([index.html:42-66](frontend/index.html#L42-L66)) | Google Analytics: random ID that recognises a returning browser | Analytics | 400 d (Chrome's cap) | no / no\* / Lax / `/` | First-party cookie, Google script | Online identifier (pseudonymous random ID). Counts as personal data under GDPR. | y | y | y | y |
| `_ga_0HYC572CP9` | site | same | GA4 session state for property `G-0HYC572CP9` (session ID, counters) | Analytics | 400 d | no / no\* / Lax / `/` | First-party cookie, Google script | Session identifier and visit counters | y | y | y | y |
| `_clck` | site | JS: `scripts.clarity.ms/0.8.79-beta/clarity.js`, loaded by GTM tag *Clarity* | Microsoft Clarity: persistent user ID | Analytics | 365 d | no / no\* / Lax / `/` | First-party cookie, Microsoft script | Pseudonymous user ID | y | y | y | y |
| `_clsk` | site | same | Clarity: session ID and page-view counter, used to stitch a recording together | Analytics | about 1 d | no / no\* / Lax / `/` | First-party cookie, Microsoft script | Pseudonymous session ID | y | y | y | y |
| `CLID` | `www.clarity.ms` | `Set-Cookie` from `https://www.clarity.ms/tag/xux8knx9n3` | Clarity: identifies the visitor across sites that use Clarity | Analytics | 365 d | **yes** / yes / None / `/` | **Third-party** | Pseudonymous cross-site ID | y | y | y | y |
| `MUID` | `.clarity.ms` | `Set-Cookie` from `c.clarity.ms/c.gif` | Microsoft unique visitor ID. Microsoft documents it as used for advertising and analytics across its sites. | **Marketing** | 390 d | no / yes / None / `/` | **Third-party** | Cross-site user identifier | y | y | y | y |
| `MUID` | `.bing.com` | `Set-Cookie` from `c.bing.com/c.gif` (Clarity's sync call) | Same Microsoft ID on Bing's domain | **Marketing** | 390 d | no / yes / None / `/` | **Third-party** | Cross-site user identifier | y | y | y | y |
| `MR` | `.c.clarity.ms` and `.c.bing.com` (2 cookies) | `Set-Cookie` from `c.clarity.ms` and `c.bing.com` | Microsoft: refreshes/syncs the MUID | Marketing | 7 d | no / yes / None / `/` | **Third-party** | Identifier-related flag | y | y | y | y |
| `SRM_B` | `.c.bing.com` | `Set-Cookie` from `c.bing.com/c.gif` | Microsoft/Bing user identifier | Marketing | 390 d | no / yes / None / `/` | **Third-party** | Cross-site user identifier | y | y | y | y |
| `SM` | `.c.clarity.ms` | `Set-Cookie` from `c.clarity.ms/c.gif` | Clarity: cookie-sync flag | Analytics | session | no / yes / None / `/` | **Third-party** | Technical flag | y | y | y | y |
| `ANONCHK` | `.c.clarity.ms` | `Set-Cookie` from `c.clarity.ms/c.gif` | Microsoft: checks whether MUID may be shared with ads | Marketing | about 10 min | no / yes / None / `/` | **Third-party** | Technical flag | y | y | y | y |

\* `Secure=false` is a localhost artefact (plain HTTP). In production these would be set on an HTTPS page.

Category and purpose for the Microsoft cookies come from Microsoft's public documentation. The code can't tell us this, so please treat the "Marketing" label as a conservative classification.

### 2.2 First-party authentication cookies (set by our backend)

These are set only at login (`/api/auth/login` and the other login endpoints). A visitor who hasn't logged in gets **no cookie from our backend**. That is verified, and the only `Set-Cookie` from `localhost` in all my runs was the login response.

| Cookie | Set by | Purpose | Category | Expiry | Flags (local dev / production per code) | Party | Personal data? | a | b | c | d |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `userToken` | [verifyToken.js:98](backend/middleware/verifyToken.js#L98) via `issueAuthCookies` | Patient access token (short JWT) | **Essential** | 15 min (`ACCESS_TOKEN_MS`) | HttpOnly **yes** / Secure no → **yes** / SameSite Lax → **None** / Path `/` / Domain not set | First | **Yes.** The JWT payload holds user id, email, role and session id. It's signed, not encrypted, so anyone who holds it can read them. | n | n | n | y |
| `userRefreshToken` | [verifyToken.js:99](backend/middleware/verifyToken.js#L99) | Patient refresh token | Essential | 8 h (`REFRESH_TOKEN_MS`) | same | First | Yes (same payload plus `type: refresh`) | n | n | n | y |
| `doctorToken`, `doctorRefreshToken` | same, doctor logins | Doctor sessions | Essential | 15 min / 8 h | same | First | Yes | n | n | n | n\*\* |
| `adminToken`, `adminRefreshToken` | same. **One shared pair** for admin, superadmin and paymentadmin | Admin sessions | Essential | 15 min / 8 h | same | First | Yes | n | n | n | n\*\* |
| `employeeAdminToken`, `employeeAdminRefreshToken` | same | Employee-admin sessions | Essential | 15 min / 8 h | same | First | Yes | n | n | n | n\*\* |
| `partnerToken`, `partnerRefreshToken` | same | Partner sessions | Essential | 15 min / 8 h | same | First | Yes | n | n | n | n\*\* |

\*\* Only the patient login was exercised in the browser. The other role cookies come from the same function ([verifyToken.js:39-57](backend/middleware/verifyToken.js#L39-L57)), so their flags are identical by construction.

The frontend also keeps the access and refresh tokens **in JavaScript memory**, sent as `Authorization: Bearer` ([api.js:137-152](frontend/src/api.js#L137-L152)). I found no JWT in localStorage or sessionStorage.

### 2.3 Payment cookies (loaded on the booking pages)

| Cookie | Domain | Set by | Purpose | Category | Expiry | HttpOnly / Secure / SameSite / Path | Party | Personal data? | a | b | c | d |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `__stripe_mid` | site (domain attribute set to the site's domain) | JS: `js.stripe.com/.../stripe.js` | Stripe: fraud-prevention device ID | Essential (fraud prevention) | 365 d | no / no\* / **Strict** / `/` | First-party cookie, Stripe script | Device identifier | n | n | n | y |
| `__stripe_sid` | site | same | Stripe: fraud-prevention session ID | Essential | 30 min | no / no\* / Strict / `/` | First-party cookie, Stripe script | Session identifier | n | n | n | y |
| `m` | `m.stripe.com` | `Set-Cookie` from `https://m.stripe.com/6` | Stripe: fraud and device-recognition ID | Essential (fraud) | 400 d | **yes** / yes / None / `/` | **Third-party** | Device identifier | n | n | n | y |
| `ts`, `ts_c` | `.paypal.com` | `Set-Cookie` from `www.paypal.com/sdk/js` | PayPal: fraud/risk and session tracking | Essential (fraud) | 365 d | `ts` yes, `ts_c` no / yes / None / `/` | **Third-party** | Device and session identifiers | n | n | n | y |
| `tsrce` | `.paypal.com` | same | PayPal: traffic source tag | Essential | 3 d | yes / yes / None / `/` | **Third-party** | Technical | n | n | n | y |
| `l7_az` | `.paypal.com` | same | PayPal: load-balancer routing | Essential | under 1 d | yes / yes / None / `/` | **Third-party** | Technical | n | n | n | y |

Stripe's cookies appear as soon as the **booking form page** loads, because `loadStripe()` runs when that page's code is imported ([AppointmentBookingForm.jsx:35](frontend/src/pages/AppointmentBookingForm.jsx#L35), [BookAppointment.jsx:19](frontend/src/pages/BookAppointment.jsx#L19)). PayPal's cookies appear when the **payment step renders** (PayPal SDK loads before the visitor has picked PayPal). Neither needs a consent click to run today.

### 2.4 Cookies in the code that I did **not** see

| Cookie / source | Why not observed |
|---|---|
| Razorpay cookies | INR-only, loads on click ([razorpayCheckout.js](frontend/src/utils/razorpayCheckout.js)) |
| Google sign-in | `accounts.google.com` was contacted on every page (the Google Identity script via `@react-oauth/google`, [AppProviders.jsx:29](frontend/src/AppProviders.jsx#L29)), but it set no cookie in my jar before sign-in |
| Cloudflare Turnstile | In the CSP only; no loader found |
| Meta / Facebook, Hotjar, Google Ads (`_gcl_*`, `_fbp`) | Not loaded by the GTM container. I saw no such requests. |

---

## 3. localStorage and sessionStorage

"Observed" means seen in the browser in states a/b/c/d (plus a UTM test). "Code only" means the key exists in the source, but my runs never reached the feature. Values are never listed.

### 3.1 Observed

| Key | Storage | Set by | Purpose | Category | Lifetime | Personal data? | a | b | c | d |
|---|---|---|---|---|---|---|---|---|---|---|
| `cookieConsent` | local | [CookieBanner.jsx:47,54](frontend/src/components/CookieBanner.jsx#L47) | Remembers `accepted` or `rejected` | Essential | until cleared | No | n | y | y | y |
| `hcLiveChatVisitorId` | local | [useVisitorTracker.js:50](frontend/src/features/livechat/useVisitorTracker.js#L50) (and the chat, [useLiveChat.js:325](frontend/src/features/livechat/useLiveChat.js#L325)) | Visitor ID for the admin's live-visitor list. It is **consent-gated**: it appears only after Accept. | Analytics (via the tracker) | until cleared, or logout | Random visitor ID | n | y | n | d-A yes, d-R no |
| `hc.bookingSource.touch` | local | [bookingSource.js:19](frontend/src/utils/bookingSource.js#L19) | Remembers the first campaign (`utm_*`) or outside referrer for **30 days** so a booking can be attributed | **Marketing / attribution** | 30 d | UTM values, referrer URL, timestamp. No personal fields by design. | n\*\*\* | n\*\*\* | n\*\*\* | n\*\*\* |
| `_cltk` | **session** | Clarity's `clarity.js` | Clarity: internal session key | Analytics | tab session | Technical | y | y | y | y |
| `hcc_booking_pending` | session | [AppointmentBookingForm.jsx:65](frontend/src/pages/AppointmentBookingForm.jsx#L65) | Holds the booking selection and form data while the visitor logs in mid-booking | Essential/functional | tab session | **Yes. Booking form data, including the free-text health concern.** I saw it present, JSON-shaped. | n | n | n | when login interrupts booking |
| `hcc_booking_resume_after_login` | session | [AppointmentBookingForm.jsx:1020](frontend/src/pages/AppointmentBookingForm.jsx#L1020) | Flag to resume the booking after login | Functional | tab session | No | n | n | n | when login interrupts booking |
| `_ab`, `_mf`, `1`, `id` (origin `m.stripe.network`) | session | Stripe's fraud iframe | Stripe device checks | Essential (fraud) | tab session | Technical | n | n | n | y |

\*\*\* Not present in plain a/b/c/d runs because those visits had no `utm_` parameters. In a separate test I landed on `/?utm_source=…&utm_medium=…&utm_campaign=…` and clicked **Reject**. The key was written anyway (JSON with fields `utm`, `referrer`, `at`; 99 chars).

No IndexedDB databases, Cache Storage caches or service workers were registered in any state.

### 3.2 Code only (not exercised in the browser)

| Key | Storage | Where | Purpose | Category | Personal data? |
|---|---|---|---|---|---|
| `hc.bookingSource.click` | local | [bookingSource.js:18](frontend/src/utils/bookingSource.js#L18) | Which Book button/page started a booking (30 min) | Marketing / attribution | Page names only |
| `hc_phone_country` | local | [PhoneInputField.jsx:345](frontend/src/components/PhoneInputField.jsx#L345) | Default phone country, **from an IP lookup at `api.country.is`** | Functional/preference | Coarse location derived from the visitor's IP |
| `hc:currency:v2` | session | [currencyLoader.js:20](frontend/src/utils/currencyLoader.js#L20) | Cached currency (from IP) for the session | Functional | Derived from IP |
| `hc:chunk-reload` | storage passed by caller | [chunkReload.js:5](frontend/src/utils/chunkReload.js#L5) | Stops a reload loop after a new build | Essential | No |
| `ap_booking_pending` | session | [BookAppointment.jsx:144](frontend/src/pages/BookAppointment.jsx#L144) | Doctor, form, reports and amount saved before a Stripe 3-D Secure redirect | Essential | **Yes. Booking and health information.** |
| `hcLiveChatToken` | local | [useLiveChat.js:324](frontend/src/features/livechat/useLiveChat.js#L324) | Chat session token | Functional | Yes (grants access to that chat) |
| `hcLiveChatOpen`, `hcLiveChatInviteDismissed` | session | [useLiveChat.js:156,518](frontend/src/features/livechat/useLiveChat.js#L156) | Widget open state, dismissed invite | Functional | No |
| `hcLiveChatChimeClaim` | local/session | [chime.js:12](frontend/src/features/livechat/chime.js#L12) | Stops two tabs both playing a sound | Functional | No |
| `hc-livechat-theme`, `hcLiveChatSound`, `hcLiveChatVisitorSound`, `hcLiveChatVoice`, `hcLiveChatNotifyDismissed`, `hcLiveChatPanelOpen`, `hcLiveChatPanelSections`, `hc-admin-sidebar-collapsed` | local | admin live-chat and layout files | Admin interface preferences | Preference | No |
| `hcLiveChatArchiveFilters`, `manage-users:list-scroll` | session | admin pages | Remember filters / scroll position | Preference | Possibly search terms |
| `at:draft:v1` | local | [Assigntask.jsx:211](frontend/src/pages/employee/Assigntask.jsx#L211) | Employee task draft | Functional | Staff-entered text |
| `hcCrossTab` | local | [crossTab.js:40](frontend/src/utils/crossTab.js#L40) | Cross-tab messages (only when BroadcastChannel is missing) | Essential | No |
| `dvc-guest-name`, `dvc-guest-id-<roomId>`, `dvc-session-<roomId>` | local | [DirectVideoCall.jsx:135-183](frontend/src/pages/DirectVideoCall.jsx#L135) | Guest's typed name, random guest ID, and a **session token** for a direct video room | Functional | Name: yes. Token: grants room access. |
| `hc-vc-role-<appointmentId>` | session | [VideoCall.jsx:114](frontend/src/pages/VideoCall.jsx#L114) | Role in the call | Functional | No |
| `hc-vc-rx-draft-<appointmentId>` | session | [VideoCall.jsx:126,159](frontend/src/pages/VideoCall.jsx#L126) | Doctor's prescription draft (diagnosis, medicines, instructions) | Functional | **Yes. Health information.** |
| `hc_enroll_draft_<doctorId>` | local | [DoctorEnrollments.jsx:2432](frontend/src/pages/doctors/DoctorEnrollments.jsx#L2432) | Doctor enrolment form draft | Functional | **Yes. Professional/personal details.** |
| `profile-status-seen-<doctorId>` | local | [DoctorProfile.jsx:1782](frontend/src/pages/doctors/DoctorProfile.jsx#L1782) | Which status banner the doctor has seen | Preference | No |

On logout, `clearClientSession()` ([session.js:38-47](frontend/src/utils/session.js#L38-L47)) wipes localStorage and sessionStorage, keeping only `hc-livechat-theme` and `hcLiveChatSound`. It also wipes `cookieConsent`, so the banner returns after every logout.

---

## 4. Google Tag Manager container GTM-5DQTLVD4

Two sources: (1) the published container, which GTM serves as a public file at `gtm.js?id=GTM-5DQTLVD4` and which includes its tag, trigger and variable definitions; (2) the network traffic I captured. I cannot see GTM's web interface, draft workspaces or tag names and labels. What's below is what the published version actually fires.

| # | Tag (type) | Settings | Fires when | What I saw on the network | Cookies / storage it creates |
|---|---|---|---|---|---|
| 1 | **Google tag** (GA4) | Measurement ID `G-0HYC572CP9` | On every page, on container load (`gtm.js` event) | `googletagmanager.com/gtag/js`, then `www.google-analytics.com/g/collect` with events `page_view`, `scroll`, `form_start` and one more request with no event name | `_ga`, `_ga_0HYC572CP9` |
| 2 | **Microsoft Clarity** (community template) | Project ID `xux8knx9n3` | `gtm.js` **and** the page path matches a list of public pages (`/`, `/blogs…`, `/about-us`, `/corporates`, the service, category and condition pages and similar). A third rule **blocks** it on `/login`. | `www.clarity.ms/tag/xux8knx9n3`, `scripts.clarity.ms/0.8.79-beta/clarity.js`, then beacons to `c.`, `r.`, `a.`, `k.`, `l.clarity.ms` and `c.bing.com/c.gif` | `_clck`, `_clsk`, `CLID`, `MUID` ×2, `MR` ×2, `SRM_B`, `SM`, `ANONCHK`, session key `_cltk` |

- **Triggers:** three conditions: event equals `gtm.js`; page path matches the public-page regex; page path equals `/login`.
- **Variables:** URL parts (path, host, URL), the event, and two variables that read GA's `client_id` and `session_id`, used to link Clarity recordings to GA sessions.
- **Consent:** neither tag has a consent setting or a consent-based trigger. The only strings containing "consent" in the file are GTM's built-in runtime code. So GTM itself will fire both tags whenever the container loads. Whether it loads is decided by [index.html](frontend/index.html), which loads it unconditionally.
- **Not in the container:** Meta Pixel, Google Ads or remarketing, Hotjar, LinkedIn or any other tag. I saw no requests to them.
- **Extra third-party requests (no cookies seen):** `accounts.google.com` (Google Identity), `static.legitscript.com` (certification seal), `flagcdn.com` (flag images), and `api.country.is` is in code but wasn't triggered.

---

## 5. Summary

### 5.1 Cookies set WITHOUT consent that should need consent

All of these were already in the browser **before the banner was touched** (state a):

| Cookie(s) | Vendor | Why consent is needed |
|---|---|---|
| `_ga`, `_ga_0HYC572CP9` | Google Analytics | Analytics identifiers |
| `_clck`, `_clsk`, `CLID`, `SM`, session key `_cltk` | Microsoft Clarity | Analytics and **session recording** on a healthcare site |
| `MUID` (×2), `MR` (×2), `SRM_B`, `ANONCHK` | Microsoft/Bing | Cross-site advertising and identifier cookies, set by Clarity's sync call |

**12 cookie entries (10 distinct names) from 2 vendors are set on first load.**

Not consent-gated and arguably fine to leave ungated, though disclose them: the auth cookies, `cookieConsent`, and Stripe/PayPal fraud cookies (strictly necessary for login and payment). One caveat: PayPal's cookies are set when the payment step *renders*, not when the visitor chooses PayPal.

Also stored regardless of consent: `hc.bookingSource.touch` (30-day campaign and referrer record, written even after **Reject**).

### 5.2 Cookies that survive Reject

**All of them.** After clicking Reject, all 12 analytics and marketing cookie entries were still in the jar. After a second page load they were refreshed (for example, `_ga_0HYC572CP9` was rewritten). Clarity kept sending beacons after Reject (`a.clarity.ms` requests continued in the 10 seconds after the click). Reject only saves `cookieConsent=rejected` and hides the banner ([CookieBanner.jsx:53-57](frontend/src/components/CookieBanner.jsx#L53-L57)). It doesn't stop or remove anything. The cookie set was **identical** for Reject (c) and Accept (b): Accept All adds `hcLiveChatVisitorId` and nothing else.

The only behaviour that really depends on the choice today is the live-chat visitor tracker, which correctly stays off after Reject.

### 5.3 What breaks if the user blocks all cookies

Chromium ignored the "block all cookies" profile preference in this build (cookies were still stored), so I discarded that run. I **emulated** blocking instead: every response's `Set-Cookie` and every request's `Cookie` header was stripped, `document.cookie` became a no-op, and `navigator.cookieEnabled` was `false`. The browser's cookie jar stayed empty for the first-party and analytics cookies. (A few Stripe iframe cookies still slipped through, which is a limit of the emulation.) The token-expiry test used `ACCESS_TOKEN_TTL=20` on the throwaway backend, a dev-only variable that shortens the 15-minute access token and is refused in production.

| Flow | With cookies blocked | Evidence |
|---|---|---|
| Home page, banner, browsing | **Works** | pages render; `cookieConsent` is localStorage |
| Patient login | **Works** | `POST /api/auth/login` returned 200; user reached `/user/dashboard`. The tokens come back in the response body and are held in memory. |
| Staying logged in while navigating inside the app | **Works** | in-app navigation made authenticated calls with no errors |
| Silent token refresh at expiry (in-app) | **Works** | After the 20 s TTL, calls returned 401, then `POST /api/auth/refresh` returned 200 (using the refresh token held in memory), then the retried calls succeeded |
| **Hard reload, new tab, bookmark, email link** | **Breaks: logged out** | `GET /api/auth/me` → 401, `POST /api/auth/refresh` → 401, redirected to `/login`. With cookies allowed, the same reload kept the session. |
| Booking up to the payment step, in-app navigation only | **Works** | card and PayPal choice rendered |
| Booking by opening the booking URL in a full page load | **Breaks** | redirected to `/login` |
| Stripe / PayPal buttons | Render | I did not complete a payment |
| Payment that redirects away and back (Stripe 3-D Secure, PayPal return) | **Very likely breaks** (inferred, **not tested**) | the return is a full page load, which loses the in-memory session, same as the reload above. The booking data is preserved in sessionStorage ([BookAppointment.jsx:144](frontend/src/pages/BookAppointment.jsx#L144)), so the user could log in again and resume. |
| Live chat / socket handshake | Polling handshake returned 200; not tested further | Socket auth reads cookies ([server.js:1855](backend/server.js#L1855)) with a token fallback, so call and chat behaviour is unverified |
| Video calls | Not tested | |

Blocking **only third-party** cookies was not tested. Locally the API is same-origin (Vite proxy), so it wouldn't have shown anything. In production, `SameSite=None` is only needed if the API runs on a different site from the frontend. If it's on the same site (as the empty `VITE_API_URL` suggests), `Lax` would work and would be safer.

---

## 6. New findings from the browser run (beyond the earlier audit)

| # | Severity | Finding | Suggested fix |
|---|---|---|---|
| N1 | **High** | Everything in §5.1 is set before consent, and **Reject does nothing**. This confirms the earlier C1/C3 findings with real cookies. GTM loads unconditionally from [index.html:42-66](frontend/index.html#L42-L66) and the container has no consent logic. | Remove the inline GTM snippet and noscript iframe; load GTM only on Accept (or use Consent Mode v2 with defaults denied). On Reject, delete the cookies listed in §2.1 and stop Clarity (`window.clarity('stop')` or similar). |
| N2 | **High (needs a review)** | Microsoft Clarity records sessions on a telehealth site, on public pages and before consent. I can't see Clarity's masking settings from here. | Check masking in the Clarity project (`xux8knx9n3`), confirm no health data in recordings, and consider keeping Clarity off any page that shows patient content. |
| N3 | Medium | `hc.bookingSource.touch` stores UTM and referrer for 30 days even after Reject ([bookingSource.js](frontend/src/utils/bookingSource.js)). | Gate behind `cookieConsent === "accepted"`, or document it as essential if attribution is truly needed for the service. |
| N4 | Medium | Booking form data, including the free-text health concern, sits unencrypted in sessionStorage (`hcc_booking_pending`, `ap_booking_pending`); doctor prescription drafts in `hc-vc-rx-draft-*`. Session storage clears when the tab closes, so the exposure is limited, but any XSS can read it (and the CSP allows `'unsafe-inline'`). | Keep, but clear immediately after use; avoid `'unsafe-inline'` in the CSP. |
| N5 | Medium | Stripe loads on the booking form page and PayPal on the payment step before any payment-method choice. Both set fraud cookies on arrival. | Acceptable as strictly-necessary for payment, but list them in the Cookie Policy, and consider loading PayPal only after the visitor selects it. |
| N6 | Low | Third-party requests with no cookies but with the visitor's IP: `accounts.google.com` and `static.legitscript.com` on every page; `api.country.is` from the phone field (IP lookup). | Disclose in the privacy notice; consider loading the Google script only on login pages. |
| N7 | Low | `localStorage` item `dvc-session-<roomId>` stores a video-room session token for guests. | Prefer sessionStorage, or an HttpOnly cookie, if the flow allows. |
| N8 | Info | The Cookie Policy page names no cookies. This report's §2 tables can seed one. | Publish a table with names, vendors, purposes and lifetimes. |

The security findings from the earlier audit (S1-S7) are unchanged, and the browser run did not contradict any of them.

---

## 7. Reproducing this

Scripts are in the scratchpad (`…/scratchpad/audit/`): `lib.mjs` (capture helpers), `run.mjs` (states a/b/c/d), `blocked.mjs` and `refresh.mjs` (blocked-cookie tests), `utm.mjs`, `detail.mjs`, `seed.mjs`. They are not part of the project. They assume the stack described in §0 on ports 27018, 5000 and 5173. All servers I started have been stopped, and `git status` is the same as when I began.
