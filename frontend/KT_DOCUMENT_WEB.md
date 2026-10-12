# Humancare Connect – Web App KT Document

Quick handover guide for new developers. Everything below was checked against the code in `frontend/`.

---

## 1. Project Overview

A React single-page app for online doctor consultations, with public marketing pages and role-based dashboards.

| Item | Value |
|---|---|
| App name (package.json) | `vite-project` (brand name: Humancare Connect) |
| Description | None in package.json. Page title: "Online Doctor Consultation & Telehealth Services" |
| Version | `0.0.0` (private) |
| Production URL | https://humancareconnect.co (canonical URL in `index.html` and sitemap script) |
| Other URLs | UAT build mode exists; UAT URL [To confirm] |
| Repo folder | `connect/frontend` (git root is `connect/`, which also holds `backend/` and `e2e/`) |

**Who uses it**

| Role | Entry route |
|---|---|
| Public visitor | `/` |
| Patient (`user`) | `/login` → `/user/dashboard` |
| Doctor | `/doctor-login` → `/doctor-dashboard` |
| Admin / Super admin | `/adminauth` → `/admin-dashboard`, `/superadmin-dashboard` |
| Payment admin | `/payment-admin-login` → `/payment-admin` |
| Employee admin | `/employee-login` → `/employee-dashboard` |
| Partner (company) | `/partner-login` → `/partner-dashboard` |

**Main features**

- Public site: categories, specialties, conditions, services, blogs, FAQ, careers, corporates
- Appointment booking by category / specialty / condition
- Payments with Stripe and PayPal, plus pay-by-link (`/pay/:token`)
- Video calls (WebRTC over Socket.IO): appointment calls and direct calls
- In-appointment chat
- Doctor tools: appointments, patients, prescriptions, medical certificates, notes, analytics, enrollment
- Patient tools: appointments, records, payment history, favourite doctors, support tickets
- Admin tools: users, doctors, appointments, pricing, blogs, GOP, manual invoices, deletion requests, tickets, internal email
- Partner portal: submit cases, track cases, billing

---

## 2. Tech Stack

React 19 + Vite 8 SPA in plain JavaScript, styled with Tailwind 4 and per-page CSS files.

| Item | Value |
|---|---|
| Framework | React 19.2.4 |
| Build tool | Vite 8.0.2 (`@vitejs/plugin-react`) |
| Node.js | `^20.19.0 \|\| >=22.12.0` (Vite's requirement; no `engines` field or `.nvmrc` in repo) |
| Language | JavaScript (JSX). No TypeScript |
| Styling | Tailwind CSS 4.3.0 (`@tailwindcss/vite`) + plain CSS files next to pages |
| Server state | TanStack React Query 5.101.2 (defaults: retry 2, staleTime 5 min, no refetch on focus) |
| Client state | React Context (one per role, plus pricing) |
| Routing | react-router-dom 7.13.2 (`BrowserRouter`, all routes in `src/App.jsx`) |
| HTTP client | axios 1.15.2 (shared instance in `src/api.js`) |
| Folder pattern | Pages / components / context / hooks / utils / api, by type (not by feature) |
| Path alias | `@` → `src` |

**Key packages**

| Package | Version (range) | Purpose |
|---|---|---|
| `axios` | ^1.15.2 | API calls |
| `socket.io-client` | ^4.8.3 | Chat, video-call signalling |
| `@tanstack/react-query` | ^5.101.2 | Data fetching and caching |
| `@stripe/react-stripe-js`, `@stripe/stripe-js` | ^6.3.0, ^9.4.0 | Card payments |
| `@paypal/react-paypal-js` | ^9.2.0 | PayPal payments |
| `@react-oauth/google` | ^0.13.5 | Google sign-in |
| `jspdf`, `html2canvas` | ^4.2.1, ^1.4.1 | PDF export (prescriptions, certificates) |
| `@tiptap/*` | ^3.31.4 | Rich text editor (blog editor) |
| `dompurify` | ^3.4.16 | HTML sanitising |
| `react-helmet-async` | ^3.0.0 | SEO meta tags |
| `framer-motion`, `gsap`, `lenis`, `swiper` | see package.json | Animations, smooth scroll, sliders |
| `fuse.js` | ^7.4.2 | Site search |
| `react-phone-input-2`, `country-state-city`, `country-list` | see package.json | Phone and location inputs |

Declared but not imported anywhere in `src/`: `@emailjs/browser`, `react-apple-signin-auth`.

---

## 3. Setup Guide

Install, add a `.env`, run `npm run dev`.

1. `cd connect/frontend`
2. Use Node 20.19+ or 22.12+.
3. `npm install` (`package-lock.json` is present).
4. Create `.env` with the keys below. Ask a team lead for values.
5. `npm run dev`. Vite default port **5173** (no port set in `vite.config.js`).
6. Dev proxy: `/api` and `/socket.io` (with websocket) are proxied to `VITE_API_URL`. Falls back to `http://localhost:5000`.

**Env keys** (prefix `VITE_`; `.env` is git-ignored)

| Key | Used for |
|---|---|
| `VITE_API_URL` | API base URL (`src/api.js`, `vite.config.js`) |
| `VITE_SOCKET_URL` | Socket.IO server URL (`src/socket.js`) |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in (`src/main.jsx`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe.js |
| `VITE_PAYPAL_CLIENT_ID` | PayPal buttons (not present in `.env` files; PayPal shows "not configured" without it) |
| `VITE_RTC_STUN_URLS`, `VITE_RTC_TURN_URLS`, `VITE_RTC_TURN_USERNAME`, `VITE_RTC_TURN_CREDENTIAL` | WebRTC ICE servers |
| `VITE_RTC_ICE_SERVERS_JSON` | Optional full ICE server override |
| `VITE_RTC_*` (bitrates, timeouts, ICE recovery, stats interval) | Optional WebRTC tuning (`VideoCall.jsx`, `DirectVideoCall.jsx`) |
| `VITE_SOCKET_TRANSPORTS`, `VITE_SOCKET_TIMEOUT_MS`, `VITE_SOCKET_RECONNECTION_DELAY_MS`, `VITE_SOCKET_RECONNECTION_DELAY_MAX_MS` | Optional Socket.IO tuning |
| `VITE_BUILD_SOURCEMAP` | `true` enables sourcemaps (`vite.config.js`) |
| `VITE_RETRY_DEBUG` | Debug logging for retries |

`.env.production` holds `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_STRIPE_PUBLISHABLE_KEY` and the four `VITE_RTC_*` ICE keys.

**Scripts**

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Vite build + sitemap + SPA fallback copy |
| `npm run build:prod` | Same, with `--mode production` |
| `npm run build:uat` | Same, with `--mode uat` |
| `npm run generate:sitemap` | Build `sitemap` from routes in `App.jsx` into `dist/` |
| `npm run copy:spa-fallback` | Copy `dist/index.html` to `dist/200.html` |
| `npm run preview` | Serve the built `dist/` |
| `npm run lint` | ESLint (flat config, `eslint.config.js`) |

There is no `test` script. `tests/searchApi.test.mjs` exists but nothing runs it. Playwright e2e tests live in the sibling `../e2e` folder.

---

## 4. Backend

The web app talks to the shared Node.js backend by REST (`/api/...`) and Socket.IO.

| Item | Value |
|---|---|
| Base URL | `VITE_API_URL` (`src/api.js`). Empty string if unset, so calls go to the same origin |
| Production API | `https://humancareconnect.co/api` [To confirm that `VITE_API_URL` in production equals `https://humancareconnect.co`] |
| Dev fallback | `http://localhost:5000` (dev proxy in `vite.config.js` only) |
| Environments in code | Vite modes `production` and `uat` (npm scripts). Dev uses `.env` |

**Networking** (`src/api.js`)

| Topic | Behaviour |
|---|---|
| Client | One axios instance, `withCredentials: true`, no timeout set |
| Auth header | `Authorization: Bearer <token>` taken from the in-memory token of the role inferred from the URL (or `config.authRole`) |
| Role header | `X-Auth-Role: <role>` on every request |
| 401 handling | Calls `POST /api/auth/refresh` once per role (shared promise), then retries the request |
| Refresh fails | Clears that role's tokens, fires `hc:session-expired` event |
| Skipped for refresh | Login, Google and refresh URLs, or requests with `skipAuthRefresh: true` |
| Response tokens | If a response has `accessToken`, it is stored for that role |
| URL rewrite | Upload paths in responses are rewritten to `<API>/api/uploads/...`. Opt out with `skipUrlNormalize` |
| Errors | Passed to callers. `utils/secureConsole.js` is installed at start-up to keep raw axios errors out of the console |

**Socket.IO** (`src/socket.js`)

| Item | Value |
|---|---|
| URL | `VITE_SOCKET_URL`, else `window.location.origin` |
| Path / transports | `/socket.io/`; polling then websocket by default |
| Auth | Access token in handshake `auth.token`, refreshed on every reconnect attempt. Role set by `setSocketAuthRole` |
| Use | Appointment chat, appointment video calls, direct video calls, admin watching direct calls |
| Main events | `join-appointment-room`, `appointment-message`, `video-offer/answer`, `ice-candidate`, `join-direct-room`, `direct-video-offer/answer`, `direct-ice-candidate`, `verify-direct-pin`, `admin-watch-direct-room` |

**Main API endpoints used**

| Endpoint | Area |
|---|---|
| `/api/auth/login`, `/register`, `/me`, `/logout`, `/refresh` | Patient auth |
| `/api/auth/google`, `/api/auth/google-doctor` | Google sign-in |
| `/api/auth/send-register-otp`, `send-forgot-otp`, `verify-forgot-otp`, `reset-password` | Patient OTP and password reset |
| `/api/doctor/login`, `register`, `me`, `approved`, `enrollment`, `send-*-otp`, `reset-password` | Doctor auth and profile |
| `/api/auth/admin-login`, `admin-me` (also `payment-admin-*`, `employee-admin-*`, `partner-*`) | Staff and partner auth |
| `/api/appointments/*` | Appointments (mine, patient, doctor, confirm/complete/cancel) |
| `/api/appointment-tree/*` | Categories, specialties, conditions |
| `/api/category-consultation/*` | Category consultations |
| `/api/pricing/*`, `/api/services/*` | Pricing and services |
| `/api/payments/*` (`create-intent`, `mine`, `fee`, `payment-links`, `admin`) | Stripe payments |
| `/api/paypal/*` (`create-order`, `capture-order`) | PayPal payments |
| `/api/medical/*` | Prescriptions and certificates |
| `/api/notes/*` | Doctor notes |
| `/api/direct-video-room/*` | Direct video rooms |
| `/api/tickets/*` | Support tickets |
| `/api/upload`, `/api/upload/presign` | File uploads (S3) |
| `/api/rtc/ice-servers` | STUN/TURN config for video calls |
| `/api/contact`, `/api/locations/*` | Contact form, countries/states/cities |
| `/api/admin/*`, `/api/superadmin/*` | Admin: users, doctors, GOP, manual invoices, blogs, partners, healthcare |
| `/api/admin/email/*` | Internal admin email module (`src/api/emailApi.js`) |
| `/api/partner/*`, `/api/employee-admin/*` | Partner and employee portals |

Other API files: `src/api/` (`adminPartnerApi`, `blogApi`, `emailApi`, `locationApi`, `partnerApi`, `searchApi`).

---

## 5. Authentication

Bearer-token auth (access + refresh tokens), held in JavaScript memory, plus httpOnly cookies set by the backend. No token is in localStorage or sessionStorage.

| Topic | Detail |
|---|---|
| Token storage | In-memory object per role in `src/api.js`. Lost on page reload |
| Session restore on reload | Context calls `/api/auth/me`; on failure calls `/api/auth/refresh` (relies on cookie) then `/me` again |
| Cookies | Backend-set cookies named `userToken`, `doctorToken`, `adminToken`, `employeeAdminToken`, `partnerToken` (+ `*RefreshToken`). Set by backend (`middleware/verifyToken.js`) with `httpOnly: true`. In production (`NODE_ENV=production` or `HTTPS=true`): `secure: true`, `sameSite: none`. Otherwise `secure: false`, `sameSite: lax`. Client JS cannot read them; it only tries to clear them |
| Mechanism | JWT-style bearer + refresh. Google login sends a Google token to the backend (`/api/auth/google`) |

**Login methods**

| Role | Methods |
|---|---|
| Patient | Email + password, Google, email OTP for registration, OTP password reset |
| Doctor | Email + password, Google, OTP registration, OTP password reset |
| Admin / payment admin / employee / partner | Email + password |

**Roles and guards**

| Role key | Context | Guard |
|---|---|---|
| `user` | `AuthContext` | `UserLayout` redirects to `/login` if no user |
| `doctor` | `DoctorAuthContext` | `DoctorLayout` redirects to `/doctor-login` |
| `admin`, `superadmin` (also `paymentadmin`) | `AdminContext` | `PrivateRoute` with `allowedRoles` (e.g. `["admin","superadmin"]`, `["superadmin"]`) |
| `employeeadmin` | `EmployeeAdminContext` | `EmployeeAdminPrivateRoute` → `/employee-login` |
| `partner` | `PartnerContext` | `PartnerPrivateRoute` → `/partner-login` |

Role is also derived from the URL prefix in `inferAuthRoleFromUrl`. A browser can hold several role sessions at once.

**Refresh, logout, idle**

| Topic | Detail |
|---|---|
| Refresh | Automatic on 401 (see Section 4) |
| Logout | `POST /api/auth/logout`, clear tokens, clear localStorage, sessionStorage and known cookies, redirect to the role's login |
| Idle logout | `SessionTimeoutManager` in `App.jsx`. Warning 5 min before timeout |
| Idle limits | user 45 min, doctor 60 min, admin 30 min, superadmin 60 min, employeeadmin 30 min, partner 30 min (`utils/session.js`) |
| Session expired | Refresh failure also triggers logout |

`DEV_BYPASS` / `LOGIN_REQUIRED` keys: **none found** in the web code.

---

## 6. Database & Storage

The web app has no database access; all data comes through the API.

| Storage | Keys | Purpose |
|---|---|---|
| localStorage | `cookieConsent` | Cookie banner choice |
| localStorage | `hc_phone_country` | Last phone country |
| localStorage | `hc_enroll_draft_<id>` | Doctor enrollment draft |
| localStorage | `profile-status-seen-<id>` | Profile status notice seen |
| sessionStorage | `ap_booking_pending` | Booking in progress |
| sessionStorage | `hc-vc-role-<id>`, `hc-vc-rx-draft-<id>` | Video-call role and prescription draft |
| Cookies | See Section 5 | Set by backend |
| IndexedDB | none | Not used |

`clearClientSession()` wipes all localStorage and sessionStorage on logout.

**Uploads** (`src/utils/directUpload.js`)

| Step | Detail |
|---|---|
| Limit | 10 MB per file |
| Primary | `POST /api/upload/presign` (backend `routes/upload.js`) returns a private AWS S3 presigned PUT URL. Browser then `PUT`s the file straight to S3. Bucket from backend env `AWS_S3_BUCKET` / `S3_BUCKET_NAME`, region from `AWS_REGION` (`backend/config/s3.js`) |
| Fallback | `POST /api/upload` with multipart `FormData` |
| Other forms | Email attachments, blog images, profile settings, doctor careers use `FormData` |

---

## 7. Third-Party Integrations

| Integration | Package / source | Config location |
|---|---|---|
| Stripe (cards) | `@stripe/stripe-js`, `@stripe/react-stripe-js` | `VITE_STRIPE_PUBLISHABLE_KEY`; `BookAppointment.jsx`, `AppointmentBookingForm.jsx`, `PaymentLinkCheckout.jsx` |
| PayPal | `@paypal/react-paypal-js` | `VITE_PAYPAL_CLIENT_ID`; same three pages |
| Google Sign-In | `@react-oauth/google` | `VITE_GOOGLE_CLIENT_ID`; `main.jsx`, `Login.jsx`, `DoctorLogin.jsx` |
| Video calls | Browser WebRTC + Socket.IO signalling | `VITE_RTC_*`; `utils/rtcIceConfig.js`, `VideoCall.jsx`, `DirectVideoCall.jsx`. `VideoCall.jsx` fetches ICE servers from `GET /api/rtc/ice-servers` (login required). Backend returns Google public STUN plus short-lived TURN credentials built with coturn's TURN REST API (backend env `RTC_TURN_URLS`, `TURN_STATIC_AUTH_SECRET`). TURN is a coturn relay, not a hosted vendor; its host is not named in code |
| Google Tag Manager | Script | `GTM-5DQTLVD4` in `index.html` and `CookieBanner.jsx` |
| Microsoft Clarity | Allowed in CSP only | `index.html` CSP. No init code anywhere in the repo, so it is not active from this code |
| LiveChat | Widget (intended) | `CookieBanner.jsx` calls `loadLiveChat()`, but the function is not defined anywhere in the repo (including `index.html` and `public/`), so the widget does not load from this code. `SECURITY.md` mentions its license ID |
| Google Search Console | Meta tag | `index.html` |
| PDF generation | `jspdf`, `html2canvas` | `RxSlip.jsx`, `MedicalCertificateSlip.jsx` |
| Rich text | `@tiptap/*` | Admin `BlogEditor.jsx` |
| Fonts | Google Fonts (Inter), Fontshare (Satoshi) | `index.html` |
| Error tracking | none found | – |
| Maps | none found | – |
| Push notifications | none found | – |

CSP is set by a `<meta>` tag in `index.html`. Extra security headers are set in `render.yaml`.

---

## 8. Key Pages & User Flow

Public pages are SEO-focused; the dashboards sit behind role logins. All routes are in `src/App.jsx`.

| Route | Page component | What it does |
|---|---|---|
| `/` | `Home` | Landing page |
| `/categories`, `/specialties`, `/conditions` | `Categories`, `Specialties`, `Symptoms` | Browse care areas |
| `/<category>`, `/<category>/<specialty>`, `/<...>/<condition>` | Category / specialty / condition pages | Content pages (many hard-coded routes) |
| `/medical-services`, `/corporates`, `/service-areas`, `/services-prices` | `Services`, `Corporates`, `Serviceareas`, `ServicesPrices` | Services and pricing info |
| `/blogs`, `/:slug` (last catch-all) | `Blogs`, `BlogPost` | Blog list and admin-written blog posts |
| `/contact-us` | `Contact` | Contact form |
| `/login` | `Login` | Patient login / register |
| `/appointment-booking[/:catSlug[/:specSlug]]` | `AppointmentBooking` | Pick category and specialty |
| `/appointment-booking/:category/:specialty/:condition` | `AppointmentBookingForm` | Booking form + payment |
| `/book-appointment` | `BookAppointment` | Booking with Stripe / PayPal |
| `/doctors/:slug` | `DoctorProfileForUser` | Public doctor profile |
| `/pay/:token` | `PaymentLinkCheckout` | Pay via link |
| `/user/dashboard`, `/appointments`, `/my-records`, `/payment-history`, `/profile-settings`, `/change-password`, `/favourite-doctors`, `/lab-appointments`, `/raise-ticket` | `pages/user/*` | Patient area |
| `/video-call/:appointmentId` | `VideoCall` | Appointment video call + chat |
| `/direct-video-call/:roomId` | `DirectVideoCall` | Direct video call |
| `/doctor-login` | `DoctorLogin` | Doctor login / register |
| `/doctor-dashboard/*` | `pages/doctors/*` | Appointments, patients, prescriptions, certificates, messages, notes, analytics, enrollments, settings |
| `/adminauth` | `AdminAuth` | Admin login |
| `/admin-dashboard/*` | `pages/admin/*` | Users, doctors, appointments, consultations, direct calls, tickets, partner cases, email, GOP, manual invoices, deletion requests |
| `/superadmin-dashboard` | `SuperAdminDashboard` | Super admin home |
| `/payment-admin-login`, `/payment-admin/*` | `PaymentAdminLogin`, payment links, history, manual invoices | Payment admin |
| `/employee-login`, `/employee-dashboard/*` | `pages/employee/*` | Employee tasks |
| `/partner-login`, `/partner-dashboard/*` | `pages/partner/*` | Cases, billing |

**Main flow:** Browse → pick category / specialty → log in or register (email OTP or Google) → booking form → pay (Stripe or PayPal) → doctor confirms → patient and doctor join `/video-call/:appointmentId` → doctor writes prescription → patient sees records and payments in `/user/*`.

---

## 9. Build & Deployment

Static Vite build served from `dist/`.

| Item | Detail |
|---|---|
| Build command | `npm run build:prod` (or `npm run build`) |
| Output folder | `dist/` (also contains `200.html` and a sitemap) |
| Chunks | `vendor-react`, `vendor-realtime`, `vendor-animation`, `vendor-payments` |
| Hosting config | `render.yaml` (Render static site: SPA rewrite `/*` → `/index.html` plus security headers). `public/_redirects` (Netlify-style redirects) |
| Which host is live | [To confirm] |
| Docker / Nginx / Vercel | None found |
| CI/CD | None found (no `.github/` folder) |
| Versioning | None. `package.json` version stays `0.0.0`; no tags or changelog found in this folder |

---

## 10. Credentials & Access Checklist

Access to 10 accounts and services is needed (list only, no credentials).

- [ ] Git repository (`connect`)
- [ ] Hosting account for the static site (Render, per `render.yaml`) [To confirm]
- [ ] Domain / DNS for `humancareconnect.co`
- [ ] Backend server / API hosting (shared Node.js backend)
- [ ] Stripe dashboard (publishable key and payments)
- [ ] PayPal developer / business account
- [ ] Google Cloud Console (OAuth client ID for Google sign-in)
- [ ] Google Tag Manager and Search Console
- [ ] AWS account (S3 bucket for uploads)
- [ ] TURN (coturn) server for video calls [To confirm who hosts it]
