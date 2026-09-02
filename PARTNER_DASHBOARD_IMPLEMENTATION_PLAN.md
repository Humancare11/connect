# Partner Dashboard — Implementation Plan (Revised)

_Date: 2026-08-27 · Supersedes the first draft_

> **What changed in this revision**
> - **No `partnerRole`, no "Partner Admin" / "Partner Payment Admin".** Exactly one new role: `partner`.
> - A **Partner Company** is a first-class entity (`Partner` model). Super Admin creates the company **and its login account** in one step.
> - A partner login is a `User` with `role: "partner"` and a `partner` reference to its company.
> - Billing/assignment/status are **admin-controlled**; the partner sees them **read-only**.
> - Everything else still mirrors the shipped **Employee Admin** dashboard.

---

## 0. Existing architecture (verified against code)

| Concern | Where | Reuse for Partner |
|---|---|---|
| Role enum | `models/User.js` → `role` enum `["user","admin","superadmin","doctor","paymentadmin","employeeadmin"]` | add `"partner"` |
| Token issue/verify | `middleware/verifyToken.js` — `ACCESS_COOKIE_BY_ROLE`, `REFRESH_COOKIE_BY_ROLE`, `roleMap`, `validateDecodedSession()`, `makeVerify()`, generic `verifyToken`, `issueAuthCookies`, `clearAuthCookies`, `buildTokenPayload`/`safeUser` (in `authController.js`) | add a `partner` branch to every map + a `verifyPartnerToken` + `partnerOnly` |
| Separate-portal login | `controllers/authController.js` → `employeeAdminLogin` / `employeeAdminMe` / `employeeAdminLogout`; wired in `routes/auth.js` (`/employee-admin-login` etc.) | copy as `partnerLogin` / `partnerMe` / `partnerLogout` |
| Super Admin CRUD of a role | `routes/superadmin.js` → `/employee-admins` GET/POST/PUT/`toggle-disable`/DELETE, using `assertPasswordAllowed`, `rememberPassword`, `revokeUserSessions` | copy as `/partners` + create flow that also makes the `Partner` doc |
| Feature API for a portal | `routes/employeeAdmin.js` mounted `app.use("/api/employee-admin", …)` in `server.js` (~line 587), guarded `verifyEmployeeAdminToken, employeeAdminOnly`; uses `cleanText`/`cleanAttachments` sanitizers + `utils/s3PresignedUrl` | model `routes/partner.js` on it |
| Frontend auth context | `context/EmployeeAdminContext.jsx`, provider in `main.jsx`; path-scoped `shouldCheckEmployeeAdmin` | copy as `PartnerContext.jsx` |
| Frontend layout/sidebar | `pages/employee/EmployeeLayout.jsx` — reuses `admin/AdminDashboard.css` `ad-*` classes, `EA_NAV_ITEMS` sections | copy as `PartnerLayout.jsx` with 3 nav items |
| Frontend login page | `pages/employee/EmployeeLogin.jsx` → `POST /api/auth/employee-admin-login` → `login()` → navigate | copy as `PartnerLogin.jsx` |
| Routing / guard | `App.jsx` — `EmployeeAdminPrivateRoute`, lazy imports, `/employee-dashboard/*` routes | copy as `PartnerPrivateRoute`, `/partner-dashboard/*` |
| axios role plumbing | `src/api.js` — `AUTH_ROLES`, `authTokens`, `inferAuthRoleFromUrl()` (has an `/api/employee-admin` → `employeeadmin` branch) | add `partner` entries + `/api/partner` + `/api/auth/partner` branches |
| Super Admin page | `pages/admin/SuperAdminDashboard.jsx` — tabbed (`AdminsTab`, `EmployeeAdminsTab`, …), `activeTab` state | add a `PartnerCompaniesTab` |
| Admin sidebar | `pages/admin/AdminLayout.jsx` → `NAV_ITEMS` (sections; items may carry `roles`) | add "Partners Cases" item |
| Sequential IDs | `utils/idSequence.js#nextSequenceValue(name,{initialValue})` on atomic `Counter` (already used for `patientId`) | add `generatePartnerCaseNumber()` |
| Session revocation | `utils/tokenRevocation.js` → `revokeSession`, `revokeUserSessions` | reuse on company deactivate/delete |
| Cases today | `Appointment` (patient bookings), `Gop` (payment guarantees) — **no partner-case concept** | new `PartnerCase` collection |

**Non-negotiable:** all edits to `verifyToken.js` and `api.js` are **additive** — no existing role's map entry, guard, or URL branch is modified.

---

## 1. Database / model changes

### 1.1 NEW — `backend/models/Partner.js` (the Partner Company)
```js
const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema({
  partnerCode:  { type: String, unique: true, index: true },        // "PTR-0001" via Counter
  companyName:  { type: String, required: true, trim: true },
  slug:         { type: String, unique: true, index: true },

  contactPersonName: { type: String, default: "" },
  contactEmail:      { type: String, default: "", lowercase: true, trim: true },
  contactPhone:      { type: String, default: "" },
  country:           { type: String, default: "" },
  address:           { type: String, default: "" },

  billingCurrency: { type: String, default: "usd" },

  status:      { type: String, enum: ["active", "inactive"], default: "active", index: true },
  deactivatedAt:     { type: Date, default: null },
  deactivatedReason: { type: String, default: "" },

  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // super admin
}, { timestamps: true });

module.exports = mongoose.model("Partner", partnerSchema);
```
- The **login account** is a separate `User` (§1.2). One company **has one** partner `User` today; the schema/endpoints allow adding more later without change (optional, not in scope).

### 1.2 MODIFY — `backend/models/User.js` (additive only)
```js
role: {
  type: String,
  enum: ["user", "admin", "superadmin", "doctor", "paymentadmin", "employeeadmin", "partner"], // + "partner"
  default: "user",
},

// only set when role === "partner"
partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", default: null, index: true },
```
- **No `partnerRole` field.**
- Existing `pre("validate")` patientId hook already early-returns for `role !== "user"` → partners get no `patientId`. No change.
- `email` stays globally unique across all roles (unchanged) — a partner email can't collide with an admin/doctor/user email; create endpoint returns 409 like `superadmin.js` does.

### 1.3 NEW — `backend/models/PartnerCase.js`
```js
const mongoose = require("mongoose");

const partnerCaseSchema = new mongoose.Schema({
  caseNumber: { type: String, required: true, unique: true, index: true }, // "HC-2026-000001"

  // ── Ownership (immutable after creation) ──
  partner:     { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true }, // partner user

  // ── Partner-authored content ──
  serviceType: { type: String, enum: ["teleconsultation", "house-call", "in-clinic"], required: true },
  urgency:     { type: String, enum: ["routine", "urgent", "emergency"], default: "routine", index: true },
  preferredDate: { type: String, default: "" },   // "YYYY-MM-DD"
  preferredTime: { type: String, default: "" },

  patient: {
    name:      { type: String, required: true, trim: true },
    dob:       { type: String, default: "" },
    gender:    { type: String, default: "" },
    phone:     { type: String, default: "" },
    language:  { type: String, default: "" },
    policyId:  { type: String, default: "" },
    complaint: { type: String, default: "" },
  },
  location: {
    country:         { type: String, default: "" },
    state:           { type: String, default: "" },
    pharmacyAddress: { type: String, default: "" },
    clinicName:      { type: String, default: "" },
    address:         { type: String, default: "" },
  },
  attachments: [{ name: String, key: String, url: String, type: String, size: String }],

  // ── Admin-controlled (partner sees read-only) ──
  status: {
    type: String,
    enum: ["submitted", "assigned", "in-progress", "completed", "invoiced", "cancelled"],
    default: "submitted", index: true,
  },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
  assignedBy:     { id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, name: String, at: Date },
  videoLink:      { type: String, default: "" },
  adminNotes:     { type: String, default: "" },      // internal, NEVER serialized to partner

  amountCents: { type: Number, default: null },
  currency:    { type: String, default: "usd" },
  invoice:     { type: mongoose.Schema.Types.ObjectId, ref: "ManualInvoice", default: null },

  linkedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null },

  // ── Shared ──
  messages: [{
    body:      { type: String, required: true },
    authorId:  { type: mongoose.Schema.Types.ObjectId },
    authorName:{ type: String, default: "" },
    authorRole:{ type: String, enum: ["partner", "admin", "system"], required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  statusHistory: [{
    status: String, at: Date,
    byId: mongoose.Schema.Types.ObjectId, byName: String, byRole: String,
  }],
}, { timestamps: true });

partnerCaseSchema.index({ partner: 1, createdAt: -1 });
partnerCaseSchema.index({ status: 1, createdAt: -1 });
partnerCaseSchema.index({ partner: 1, status: 1 });

module.exports = mongoose.model("PartnerCase", partnerCaseSchema);
```

### 1.4 MODIFY — `backend/utils/idSequence.js`
```js
const PARTNER_SEQUENCE_NAME = "partner";          // for partnerCode
const PARTNER_CASE_SEQUENCE_NAME = "partnerCase"; // for caseNumber

async function generatePartnerCode() {
  const n = await nextSequenceValue(PARTNER_SEQUENCE_NAME, { initialValue: 0 });
  return `PTR-${String(n).padStart(4, "0")}`;
}
async function generatePartnerCaseNumber() {
  const n = await nextSequenceValue(PARTNER_CASE_SEQUENCE_NAME, { initialValue: 0 });
  return `HC-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;
}
module.exports = { …existing, generatePartnerCode, generatePartnerCaseNumber };
```

### 1.5 Migration / seed
- No destructive migration. Enum extension + optional fields are backward-compatible; existing docs unaffected.
- NEW (optional) `backend/scripts/seedPartner.js` — mirror `seedAdmin.js`: create one `Partner` + one linked `User{role:"partner"}` for QA.

---

## 2. Authentication & authorization changes

### 2.1 `backend/middleware/verifyToken.js` — additive
| # | Location | Change |
|---|---|---|
| 1 | `ACCESS_COOKIE_BY_ROLE` | `+ partner: "partnerToken"` |
| 2 | `REFRESH_COOKIE_BY_ROLE` | `+ partner: "partnerRefreshToken"` |
| 3 | `roleMap` | `+ partnerToken: "partner"` |
| 4 | `validateDecodedSession()` — the `["user","admin","superadmin","paymentadmin","employeeadmin"].includes(decoded.role)` User-lookup/`accountDisabled` check | add `"partner"` to that array (partner logins are `User` docs, so **no new collection branch** needed) |
| 5 | generic `verifyToken` candidate list | append `req.cookies?.partnerToken` **after** `adminToken, doctorToken, userToken, employeeAdminToken` (never shadows a higher-priv cookie) |
| 6 | exports | add: |
```js
const verifyPartnerToken = makeVerify("partnerToken");

const partnerOnly = (req, res, next) => {
  if (req.user?.role !== "partner") {
    recordSecurityEvent(req, {
      type: "unauthorized_access", severity: "high",
      title: "Non-partner attempted partner access",
      resource: req.originalUrl,
      metadata: { requiredRole: "partner", actualRole: req.user?.role || "anonymous" },
    });
    return res.status(403).json({ msg: "Access denied. Partners only." });
  }
  next();
};

// Loads the caller's company id once per request. Kept out of the JWT so a
// company deactivation / re-link takes effect immediately (token signing is
// left untouched — zero risk to other portals).
const attachPartnerCompany = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select("partner").lean();
    if (!u?.partner) return res.status(403).json({ msg: "Partner account is not linked to a company." });
    const Partner = require("./../models/Partner");
    const company = await Partner.findById(u.partner).select("status").lean();
    if (!company || company.status !== "active")
      return res.status(403).json({ msg: "Partner company is inactive. Contact support." });
    req.partnerId = String(u.partner);
    next();
  } catch { return res.status(500).json({ msg: "Server error." }); }
};

module.exports = { …existing, verifyPartnerToken, partnerOnly, attachPartnerCompany };
```

### 2.2 `backend/controllers/authController.js`
- Add `partnerLogin`, `partnerMe`, `partnerLogout` — **copy `employeeAdminLogin` / `employeeAdminMe` / `employeeAdminLogout` almost verbatim**, changing `role !== "employeeadmin"` → `role !== "partner"`, portal label `"partner"`, resource `"Partner"`.
- `partnerLogin` success payload: `{ msg, user: safeUser(user), partner: <company summary>, ...tokens }` where company summary = `{ _id, companyName, partnerCode, status }` (fetched via `user.partner`).
- Extend `safeUser` to include `partner: user.partner || null` (harmless for other roles — it's just `null`).
- Export the three functions.

### 2.3 `backend/routes/auth.js`
```js
// ── Partner auth ──────────────────────────────────────────────────────────────
router.post("/partner-login",  loginLimiter, partnerLogin);
router.post("/partner-logout", verifyPartnerToken, partnerLogout);
router.get ("/partner-me",     verifyPartnerToken, partnerMe);
```
- Add `verifyPartnerToken` to the existing `require("../middleware/verifyToken")` destructure.
- Forgot-password for partners = **out of scope** (Super Admin resets by editing the account). Can be added later via the existing OTP infra.

### 2.4 `backend/server.js`
Near line 587 (next to `employee-admin`):
```js
app.use("/api/partner", require("./routes/partner"));
app.use("/api/admin/partner-cases", require("./routes/adminPartnerCases"));
```

### 2.5 Frontend `src/api.js` — additive
- `AUTH_ROLES` → `add "partner"`.
- `authTokens` → `+ partner: { accessToken: "", refreshToken: "" }`.
- **No** `TOKEN_ROLE_ALIASES` entry (partner has its own cookie set, like `doctor`/`employeeadmin`).
- `inferAuthRoleFromUrl()` → add, alongside the employee-admin lines:
```js
if (value.startsWith("/api/auth/partner")) return "partner";
if (value.startsWith("/api/partner"))      return "partner";
```
  (`/api/admin/partner-cases` correctly infers `admin` via the existing `/api/admin` branch — leave it.)

---

## 3. Super Admin — Partner Company management

### 3.1 `backend/routes/superadmin.js` — all `verifyAdminToken, superAdminOnly`
| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/partners` | list companies + `{ userCount, caseCount }` per company |
| `GET` | `/partners/:id` | one company + its linked user(s) (no password) |
| `POST` | `/partners` | **create company + login in one call.** Body: `{ companyName, contactPersonName, contactEmail, contactPhone, country, address, billingCurrency, loginEmail, password }`. Steps: `assertPasswordAllowed`; ensure `loginEmail` unused (409); `generatePartnerCode()` + unique `slug`; `Partner.create({..., createdBy: req.user.id})`; `bcrypt.hash`; `User.create({ name: companyName, email: loginEmail, password, role: "partner", partner: partner._id })`; `rememberPassword`. Roll back the `Partner` doc if user creation throws. |
| `PUT` | `/partners/:id` | edit company profile fields (not status, not credentials) |
| `PUT` | `/partners/:id/login` | update the linked user's `name`/`email`, or reset `password` (`assertPasswordAllowed`, `rememberPassword`, then `revokeUserSessions(userId)`) |
| `PUT` | `/partners/:id/toggle-status` | `active ⇄ inactive`; on → `inactive`, set `deactivatedAt/Reason` **and `revokeUserSessions`** for every `User` with `partner === :id` |
| `DELETE` | `/partners/:id` | block with 409 if `PartnerCase.exists({ partner: id })`; otherwise delete linked `User`(s) + `Partner` doc + `revokeUserSessions` |

Helpers already imported in that file: `bcrypt`, `assertPasswordAllowed`, `rememberPassword`, `revokeUserSessions`. Add `require("../models/Partner")`, `require("../models/PartnerCase")`, `generatePartnerCode`.

### 3.2 Frontend `src/pages/admin/SuperAdminDashboard.jsx`
- Add `PartnerCompaniesTab()` component (model it on `EmployeeAdminsTab`): create form (company fields + login email/password), list with **Edit / Reset password / Activate-Deactivate / Delete**, inline errors/success using the existing `dash-*` classes.
- Add nav button + `activeTab === "partnerCompanies"` render, next to "Employee Admins".

---

## 4. Partner login flow

```
/partner-login  (PartnerLogin.jsx)
   └─ POST /api/auth/partner-login { email, password }
        └─ authController.partnerLogin
             • User.findOne({email}); require role === "partner"
             • reject if accountDisabled  → 403
             • bcrypt.compare
             • load Partner(company); reject if status !== "active" → 403
             • issueAuthCookies(res, user)   → sets partnerToken + partnerRefreshToken (httpOnly)
             • return { user: safeUser, partner: {companyName, partnerCode, status}, accessToken, refreshToken }
   └─ PartnerContext.login(user, partner)  → setAuthTokenForRole("partner", …)
   └─ navigate("/partner-dashboard")

Session upkeep: identical to every other portal — verifyToken.js validateDecodedSession()
refreshes lastActivityAt; api.js interceptor calls POST /api/auth/refresh with authRole:"partner"
on 401; INACTIVITY_TIMEOUT_MS unchanged.
```

- `PartnerContext.jsx`: `shouldCheckPartner = path === "/partner-login" || path.startsWith("/partner")`; on mount `GET /api/auth/partner-me`; exposes `{ partner /*company*/, partnerUser, loading, login, logout }`; `logout` → `POST /api/auth/partner-logout` + `clearUserAuthToken` + `clearClientSession`.
- Provider added in `main.jsx` in **both** render branches, wrapping like `<EmployeeAdminProvider>`.

---

## 5. Partner Dashboard — frontend structure

```
src/
  context/PartnerContext.jsx                 NEW  (copy EmployeeAdminContext)
  api/partnerApi.js                          NEW  (thin axios wrappers)
  pages/partner/
    PartnerLogin.jsx                         NEW  (copy EmployeeLogin)
    PartnerLogin.css                         NEW  (copy eal-* → ptl-*)
    PartnerLayout.jsx                        NEW  (copy EmployeeLayout; reuse admin/AdminDashboard.css)
    PartnerDashboard.jsx                     NEW  (KPI cards + recent cases table)
    SubmitCare.jsx                           NEW  (4-step wizard)
    AllCases.jsx                             NEW  (search + status filter + table)
    PartnerCaseDetail.jsx                    NEW  (status pipeline + read-only cards + chat)
    partner.css                              NEW  (only deltas beyond ad-*)
```

**`PartnerLayout.jsx` sidebar — exactly three items**, same `ad-sidebar` / `ad-nav-item` markup as `EmployeeLayout`:
```js
const PARTNER_NAV_ITEMS = [
  { section: "Overview", items: [
      { path: "/partner-dashboard",              label: "Dashboard",   icon: DashboardIcon }] },
  { section: "Cases", items: [
      { path: "/partner-dashboard/submit-care",  label: "Submit Care", icon: PlusIcon },
      { path: "/partner-dashboard/cases",        label: "All Cases",   icon: ListIcon }] },
];
```
Profile block shows `partner.companyName` + role label "Partner". Design system, topbar, hamburger, `ad-content` wrapper: unchanged from `EmployeeLayout`.

**Pages port the mockup** (`humancare_partner_dashboard.html`): `dashboardView → PartnerDashboard`, `newCaseView → SubmitCare`, `caseListView → AllCases`, `caseDetailView → PartnerCaseDetail`. Data via TanStack Query (`staleTime` default; add `refetchInterval: 15000` on the detail view for near-live status/chat — sockets optional later).

---

## 6. Partner case submission flow

```
SubmitCare.jsx  (steps: When → What → Where → Patient)
  └─ POST /api/partner/cases  { serviceType, urgency, preferredDate/Time, patient{…}, location{…}, attachments[] }
       verifyPartnerToken → partnerOnly → attachPartnerCompany
         • sanitize every field (cleanText / cleanAttachments — copy from routes/employeeAdmin.js)
         • caseNumber = await generatePartnerCaseNumber()
         • PartnerCase.create({
             caseNumber, partner: req.partnerId, submittedBy: req.user.id,
             status: "submitted",
             statusHistory: [{ status:"submitted", at:now, byId:req.user.id, byRole:"partner" }],
             messages: [{ body:"Case submitted.", authorRole:"system", createdAt:now }],
             …sanitized fields
           })
         • 201 → serializeCaseForPartner(doc)
  └─ navigate("/partner-dashboard/cases/:id")
```
The document is now in the `partnercases` collection. **It appears in the Admin "Partners Cases" page on that page's next fetch — no sync, no queue, no event needed** (same database).

Attachments: `POST /api/partner/cases/:id/attachments` returns an S3 presigned PUT (copy the `employeeAdmin.js` presign pattern); client uploads directly; then patches the case's `attachments[]` (ownership-checked).

---

## 7. Admin "Partners Cases" page

### 7.1 `backend/routes/adminPartnerCases.js` (NEW) — all `verifyAdminToken, adminOnly` (admin **and** superadmin)
| Method | Path | Notes |
|---|---|---|
| `GET` | `/` | list ALL cases; `.populate("partner","companyName partnerCode")` + `assignedDoctor` name; filters `?partner=&status=&urgency=&q=`; pagination `?page=&limit=` |
| `GET` | `/stats` | `{ submitted, assigned, inProgress, completed, invoiced }` counts |
| `GET` | `/:id` | full doc incl. `adminNotes`, billing, history |
| `PATCH` | `/:id/status` | body `{ status }`; validate against `ALLOWED_TRANSITIONS`; push `statusHistory` `{by: admin}` |
| `PATCH` | `/:id/assign` | body `{ doctorId, videoLink? }`; set `assignedDoctor`, `assignedBy`, status → `assigned` |
| `PATCH` | `/:id/billing` | body `{ amountCents, currency }` |
| `POST` | `/:id/invoice` | create `ManualInvoice` for the company, link `invoice`, status → `invoiced` |
| `POST` | `/:id/messages` | body `{ body }`; append `{ authorRole:"admin" }` |
| `PATCH` | `/:id/notes` | set `adminNotes` (internal) |

`ALLOWED_TRANSITIONS = { submitted:["assigned","cancelled"], assigned:["in-progress","cancelled"], "in-progress":["completed","cancelled"], completed:["invoiced"], invoiced:[], cancelled:[] }`

### 7.2 Frontend
| File | Purpose |
|---|---|
| `pages/admin/PartnerCases.jsx` NEW | table of all partner cases; filter by company / status / urgency; row → detail |
| `pages/admin/PartnerCaseDetail.jsx` NEW | admin actions: assign doctor (reuse the doctor picker from `AdminAssignDoctor`), change status, set amount, create invoice, add `adminNotes`, reply in chat |
| `pages/admin/PartnerCases.css` NEW | if needed (prefer existing `ad-*` / table styles) |
| `pages/admin/AdminLayout.jsx` MODIFY | new nav item, e.g. new **"Partners"** section: `{ path:"/admin-dashboard/partner-cases", label:"Partners Cases", roles:["admin","superadmin"], icon:<…/> }` |
| `App.jsx` MODIFY | routes `/admin-dashboard/partner-cases` and `/admin-dashboard/partner-cases/:id` inside `PrivateRoute allowedRoles={["admin","superadmin"]}` + `AdminLayout` |

Optional: add `partnerCasesPending` to `getAdminStats` (`adminController.js`) for a badge on the main Admin overview.

---

## 8. API endpoint summary

### Auth (`routes/auth.js`)
| `POST /api/auth/partner-login` · `POST /api/auth/partner-logout` · `GET /api/auth/partner-me` |

### Partner portal (`routes/partner.js`, guard: `verifyPartnerToken, partnerOnly, attachPartnerCompany`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/partner/dashboard` | KPI counts scoped to `req.partnerId` |
| GET | `/api/partner/cases` | own company's cases (`?status=&q=`) |
| POST | `/api/partner/cases` | Submit Care |
| GET | `/api/partner/cases/:id` | detail (404 if not own) — `serializeCaseForPartner` |
| PATCH | `/api/partner/cases/:id/cancel` | only while `status === "submitted"` |
| POST | `/api/partner/cases/:id/messages` | append partner chat message |
| POST | `/api/partner/cases/:id/attachments` | presigned PUT |
| GET | `/api/partner/cases/:id/attachments/access-url?key=` | signed GET (ownership-checked) |

### Admin (`routes/adminPartnerCases.js`, guard: `verifyAdminToken, adminOnly`)
See §7.1 — mounted at `/api/admin/partner-cases`.

### Super Admin (`routes/superadmin.js`, guard: `verifyAdminToken, superAdminOnly`)
See §3.1 — `/api/superadmin/partners*`.

---

## 9. Frontend routes / components

### `src/App.jsx`
```jsx
// lazy imports
const PartnerLogin        = lazy(() => import("./pages/partner/PartnerLogin"));
const PartnerLayout       = lazy(() => import("./pages/partner/PartnerLayout"));
const PartnerDashboard    = lazy(() => import("./pages/partner/PartnerDashboard"));
const SubmitCare          = lazy(() => import("./pages/partner/SubmitCare"));
const AllCases            = lazy(() => import("./pages/partner/AllCases"));
const PartnerCaseDetail   = lazy(() => import("./pages/partner/PartnerCaseDetail"));
const AdminPartnerCases   = lazy(() => import("./pages/admin/PartnerCases"));
const AdminPartnerCaseDetail = lazy(() => import("./pages/admin/PartnerCaseDetail"));

function PartnerPrivateRoute({ children }) {          // copy of EmployeeAdminPrivateRoute
  const { partnerUser, loading } = usePartner();
  if (loading) return null;
  if (!partnerUser) return <Navigate to="/partner-login" replace />;
  return children;
}
```
| Path | Element |
|---|---|
| `/partner-login` | `<PartnerLogin/>` |
| `/partner-dashboard` | `PartnerPrivateRoute` → `PartnerLayout` → `PartnerDashboard` |
| `/partner-dashboard/submit-care` | … `SubmitCare` |
| `/partner-dashboard/cases` | … `AllCases` |
| `/partner-dashboard/cases/:id` | … `PartnerCaseDetail` |
| `/admin-dashboard/partner-cases` | `PrivateRoute ["admin","superadmin"]` → `AdminLayout` → `AdminPartnerCases` |
| `/admin-dashboard/partner-cases/:id` | … `AdminPartnerCaseDetail` |

### `src/main.jsx`
Wrap `<PartnerProvider>` around `<App/>` in both branches (beside `<EmployeeAdminProvider>`).

### `src/utils/session.js` / `SessionTimeoutManager` (in `App.jsx`)
If any role-switch/`switch` there enumerates portals, add a `partner` case (logout → `/partner-login`). Otherwise no change.

---

## 10. Permissions & security rules

| Rule | Enforcement |
|---|---|
| Only `superadmin` manages Partner Companies/accounts | `superAdminOnly` on every `/api/superadmin/partners*` route |
| Partner sees **only** its own company's cases | Every `routes/partner.js` query hard-filters `{ partner: req.partnerId }`; `:id` routes 404 (not 403) on mismatch to avoid enumeration; `req.partnerId` comes from `attachPartnerCompany` (DB), **never** from the request body/query |
| Partner cannot set `status` / `assignedDoctor` / `amountCents` / `invoice` / `videoLink` / `adminNotes` | Those routes don't exist in `routes/partner.js`; `POST /cases` and any partner PATCH run through an **allow-list** of fields (`serviceType, urgency, preferredDate, preferredTime, patient.*, location.*, attachments`) — unknown keys dropped |
| Partner writes limited to: create case, append message, append attachment, cancel-while-submitted | Only those 4 endpoints; `cancel` guarded by `status === "submitted"` |
| `adminNotes` never leaks | `serializeCaseForPartner()` builds an explicit whitelist object; it does **not** spread the doc |
| Inactive company / disabled user cannot act | `attachPartnerCompany` checks `Partner.status === "active"`; `validateDecodedSession` checks `User.accountDisabled`; deactivate/reset-password call `revokeUserSessions` |
| Cookie confusion | `partnerToken` appended **last** in generic `verifyToken` candidate list; `makeVerify("partnerToken")` also pins `decoded.role === "partner"` |
| Case-number race | atomic `Counter.findOneAndUpdate($inc)` (same mechanism as `patientId`) |
| Company delete with history | 409 unless zero `PartnerCase` docs (prefer deactivate) |
| Rate limiting | `loginLimiter` on `/partner-login` (reused); consider a create-case limiter later |
| Admin list performance | indexes `{partner:1,createdAt:-1}`, `{status:1,createdAt:-1}`; paginate |

---

## 11. Case status / ownership flow

```
Super Admin  ──creates──▶  Partner Company (+ login User{role:"partner", partner})
                                   │
                       Partner logs in → Partner Dashboard
                                   │
                       Submit Care  →  PartnerCase { status:"submitted", partner, submittedBy }
                                   │           (saved to partnercases collection)
                                   ▼
        Admin Dashboard → "Partners Cases"  (GET /api/admin/partner-cases — same DB, no sync)
                                   │
   admin: assign doctor ─▶ assigned ─▶ in-progress ─▶ completed ─▶ invoiced
                                   │                                   (ManualInvoice linked)
                        (cancelled: from submitted by partner, or any pre-invoiced state by admin)
                                   ▼
        Partner Dashboard → "All Cases"  shows read-only status + statusHistory + chat + invoice
```

**Ownership contract**
- Immutable after creation: `partner`, `submittedBy`, `caseNumber`.
- Partner-writable: `messages[]` (append), `attachments[]` (append), `status → "cancelled"` **iff** currently `"submitted"`.
- Admin-writable: `status` (per `ALLOWED_TRANSITIONS`), `assignedDoctor`, `assignedBy`, `videoLink`, `amountCents`, `currency`, `invoice`, `adminNotes`, `messages[]` (append).
- Every status change appends to `statusHistory` with actor id/name/role.

---

## 12. Exact files to create / modify

### Backend — CREATE
- `models/Partner.js`
- `models/PartnerCase.js`
- `routes/partner.js`
- `routes/adminPartnerCases.js`
- `scripts/seedPartner.js` _(optional)_

### Backend — MODIFY
- `models/User.js` — `role` enum `+ "partner"`; `+ partner` ref
- `middleware/verifyToken.js` — 3 cookie/role maps, `validateDecodedSession` role list, generic candidate list, `verifyPartnerToken`, `partnerOnly`, `attachPartnerCompany`
- `controllers/authController.js` — `partnerLogin` / `partnerMe` / `partnerLogout`; `safeUser` `+ partner`; exports
- `routes/auth.js` — 3 partner routes + import `verifyPartnerToken`
- `routes/superadmin.js` — `/partners*` CRUD + create-with-login
- `utils/idSequence.js` — `generatePartnerCode`, `generatePartnerCaseNumber`
- `server.js` — mount `/api/partner`, `/api/admin/partner-cases`
- `controllers/adminController.js` — _(optional)_ partner-case count in `getAdminStats`

### Frontend — CREATE
- `context/PartnerContext.jsx`
- `api/partnerApi.js`
- `pages/partner/PartnerLogin.jsx` + `PartnerLogin.css`
- `pages/partner/PartnerLayout.jsx`
- `pages/partner/PartnerDashboard.jsx`
- `pages/partner/SubmitCare.jsx`
- `pages/partner/AllCases.jsx`
- `pages/partner/PartnerCaseDetail.jsx`
- `pages/partner/partner.css`
- `pages/admin/PartnerCases.jsx` + `PartnerCaseDetail.jsx` (+ `.css` if needed)

### Frontend — MODIFY
- `main.jsx` — `<PartnerProvider>`
- `App.jsx` — lazy imports, `PartnerPrivateRoute`, partner routes, admin partner-cases routes
- `api.js` — `AUTH_ROLES`, `authTokens`, `inferAuthRoleFromUrl` (`partner`)
- `pages/admin/AdminLayout.jsx` — "Partners Cases" nav item
- `pages/admin/SuperAdminDashboard.jsx` — `PartnerCompaniesTab` + nav button
- `utils/session.js` — `partner` case _(only if it enumerates roles)_

---

## 13. Implementation order + checkpoints

### Phase 1 — Auth & company management (no cases)
1. `models/Partner.js`; `User.js` enum + `partner` ref; `idSequence.js` helpers.
2. `verifyToken.js` additive changes + `verifyPartnerToken` / `partnerOnly` / `attachPartnerCompany`.
3. `authController.js` `partnerLogin/Me/Logout` + `safeUser`; `routes/auth.js`.
4. `routes/superadmin.js` `/partners*` (create company + login, edit, reset pw, toggle-status, delete).
5. `api.js` role registration; `PartnerContext.jsx` + `main.jsx`.
6. `PartnerLogin.jsx`, `PartnerLayout.jsx`, empty `PartnerDashboard.jsx`; `App.jsx` route + guard.
7. `SuperAdminDashboard.jsx` → `PartnerCompaniesTab`.
   - ✅ **Checkpoint A:** Super Admin creates a company; that account logs in at `/partner-login`, lands on an empty dashboard; deactivating the company forces logout. Regression pass: admin, superadmin, payment admin, doctor, employee admin all still log in and use their dashboards; `/api/auth/refresh` still works per role.

### Phase 2 — Cases end-to-end
8. `models/PartnerCase.js`.
9. `routes/partner.js` — dashboard, `GET/POST /cases`, `GET /cases/:id`, `messages`, `cancel`, attachments; `serializeCaseForPartner`; mount in `server.js`.
10. `routes/adminPartnerCases.js` — list, stats, detail, status, assign, messages; mount.
11. Partner pages: `SubmitCare`, `AllCases`, `PartnerCaseDetail`, real `PartnerDashboard`; `partnerApi.js`.
12. Admin pages: `PartnerCases.jsx`, `PartnerCaseDetail.jsx`; `AdminLayout` nav; `App.jsx` routes.
    - ✅ **Checkpoint B:** Partner submits a case → visible in Admin → "Partners Cases" on refresh. Admin assigns a doctor + advances status → Partner's "All Cases" shows the new status + history. Partner cannot hit any admin mutation (manual 403/404 checks). Partner B cannot open Partner A's case id (404).

### Phase 3 — Billing & polish
13. Admin billing: `PATCH /:id/billing`, `POST /:id/invoice` → `ManualInvoice` linked, status `invoiced`.
14. Partner detail shows invoice + download (read-only) via signed URL.
15. `adminNotes`; optional `getAdminStats` badge.
16. _(Optional)_ Socket.IO room `partner-case:<id>` for live chat/status; _(optional)_ partner forgot-password.
    - ✅ **Checkpoint C:** full lifecycle submitted→invoiced; partner sees invoice, cannot see `adminNotes` (verify serializer output); load test admin list with ~1–2k cases.

---

## 14. Backward-compatibility risks & testing

| Risk | Likelihood | Mitigation | Test |
|---|---|---|---|
| New enum value rejected by old in-flight validators | low | additive enum; deploy backend before frontend | create each existing role after the change |
| `validateDecodedSession` role-array edit breaks a portal | low | append-only; keep doctor branch untouched | log in + navigate as user/doctor/admin/superadmin/paymentadmin/employeeadmin |
| Generic `verifyToken` cookie precedence | med | append `partnerToken` **after** all others | with both `adminToken` + `partnerToken` cookies present, hit an admin route → still admin |
| `api.js` `inferAuthRoleFromUrl` mis-route | med | new prefixes don't overlap; `/api/admin/partner-cases` stays `admin` | unit-check the matcher for the 3 new prefixes + the admin one |
| Partner data isolation bug | high impact | mandatory `{partner: req.partnerId}` filter from `attachPartnerCompany`; 404 on mismatch; never read org id from client | automated: 2 companies, cross-access attempts on every `/api/partner/cases/:id*` route |
| `adminNotes` / internal fields leak to partner | high impact | explicit-whitelist `serializeCaseForPartner`; no doc spread | snapshot test of serializer; grep responses for `adminNotes` |
| Partner escalar via body (`partner`, `status`, `submittedBy`) | high impact | field allow-list on create/patch; ownership fields set server-side only | send malicious payloads → assert ignored |
| Company delete orphans cases | med | 409 unless zero cases; prefer deactivate | attempt delete with cases → 409 |
| Deactivation doesn't kick active sessions | med | `revokeUserSessions` on toggle-status→inactive & password reset | deactivate while partner is logged in → next request 401 |
| Session/refresh regressions | low | no change to token signing, cookie opts, `Session` schema, `INACTIVITY_TIMEOUT_MS` | idle-timeout + refresh flow for partner and one existing role |
| SuperAdminDashboard bundle/route change | low | new tab is isolated; no change to existing tabs | open every existing tab after adding `PartnerCompaniesTab` |
| Build breakage from lazy imports | low | follow existing `lazy(() => import(...))` pattern | `npm run build` (frontend) + `npm run lint` |

### Test checklist
- **Unit/route:** partner CRUD (superadmin), partner login (valid / disabled user / inactive company / wrong role), `POST /api/partner/cases` sanitization + allow-list, cross-company 404, admin status-transition validation, serializer whitelist.
- **Integration (happy path):** create company → login → submit case → admin sees it → admin assigns + advances → partner sees status/history → admin invoices → partner sees invoice.
- **Regression:** full login + one core action for admin, superadmin, paymentadmin, doctor, employeeadmin; `/api/auth/refresh` for each; existing SuperAdminDashboard tabs.
- **Security:** cookie-precedence test, IDOR sweep on all `/api/partner/*/:id`, privilege-escalation payloads, deactivated-company lockout, `adminNotes` non-disclosure.
- **Build:** frontend `npm run build` + `npm run lint`; backend boots with the two new `app.use` mounts.
