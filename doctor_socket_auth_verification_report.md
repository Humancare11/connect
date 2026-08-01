# Verification Report — Doctor Socket "unauthenticated" Hypothesis

**Question being verified:** does the doctor's web Socket.IO connection genuinely
become unauthenticated, causing `[socket] appointment room access denied
{ reason: 'unauthenticated', userId: null, role: null }`, and is that really
why the patient's call never connects?

**Verdict: CONFIRMED as the proximate cause of the observed failure — but the
originally-suspected mechanism ("nginx not forwarding cookies on `/socket.io/`")
is not what I found. The actual, fully verified-in-code defect is a dead
fallback-auth path in the web frontend, in `DoctorAuthContext.jsx`, that
applies to essentially every normal doctor session.** No nginx config was
needed to reach this conclusion — the whole chain is provable from the
repository's own source. Every claim below is cited to a file and line; no
code was modified.

---

## 1. The full, verified causal chain

### Step 1 — A doctor's socket connects once, early, from `DoctorLayout`

`frontend/src/pages/doctors/DoctorLayout.jsx:257-272` — this layout wraps
every doctor-dashboard page (including, per routing, `/video-call/*` — see
`App.jsx:1596-1601`). On mount:

```js
useEffect(() => {
  if (!socket.connected) socket.connect();
  if (doctor?._id || doctor?.id) {
    socket.emit("user-online", {
      userId: doctor._id || doctor.id,
      role: "doctor",
      token: getUserAuthToken("doctor"),
    });
  }
}, [doctor]);
```

The socket is a **shared, module-level singleton** (`frontend/src/socket.js`),
`autoConnect: false` (`socket.js:24`), so this is the first place it actually
connects for a doctor session. The developer's own comment here
(`DoctorLayout.jsx:260-265`) explicitly acknowledges the risk being verified
in this report:

> *"Pass an explicit, doctor-scoped token so the server can verify this
> registration fresh instead of relying only on whatever this socket
> connection's cookies looked like when it first connected... it's what
> prevents a stale identity from an earlier role on this same connection
> from sticking."*

So the intended design already assumes the connection-time cookie snapshot
can be wrong or stale, and builds an explicit fresh-token fallback to cover
for it. **Step 2 shows that fallback is dead.**

### Step 2 — The fresh-token fallback depends on `getUserAuthToken("doctor")`, which is empty for any cookie-restored session

`frontend/src/api.js:9-14, 98-100`: `getUserAuthToken(role)` reads from a
**purely in-memory** JS object (`authTokens`), not from `localStorage`, not
from a cookie — it resets to empty on every fresh page load/tab/remount.

It is populated in exactly one automatic way — `api.js:122-133`, the axios
response interceptor:
```js
if (response.data?.accessToken) {
  const role = normalizeAuthRole(response.data.role || response.data.user?.role || (response.data.doctor && "doctor"));
  setAuthTokenForRole(role, response.data.accessToken, response.data.refreshToken || currentRefreshToken);
}
```
This fires **only when a response body contains `accessToken`.**

**Verified: the interactive login response does contain it.**
`POST /api/doctor/login` → `backend/routes/doctorAuth.js:260-287`:
```js
const session = await issueAuthCookies(res, withDoctorRole(doctor));
const tokens = buildTokenPayload(doctor, session);   // { accessToken, refreshToken }
return res.status(200).json({ message: ..., doctor: {...}, ...tokens });
```
So immediately after a doctor fills in the login form **in that browser
tab**, `authTokens.doctor.accessToken` is correctly populated, and
everything downstream (Step 1's `token` field, and the identical pattern in
`VideoCall.jsx`'s `join-appointment-room` payload) works as designed.

**Verified: the session-restore bootstrap does NOT contain it.**
Every doctor-dashboard page load (including opening a link to a specific
call, refreshing the tab, or the SPA simply remounting) runs
`DoctorAuthContext.jsx:23-26`:
```js
api.get("/api/doctor/me", { authRole: "doctor", skipAuthRefresh: true })
  .then((res) => setDoctor(res.data.doctor))
  .catch(() => setDoctor(null))
```
`GET /api/doctor/me` → `backend/routes/doctorAuth.js:388-398`:
```js
return res.status(200).json({
  doctor: { id: doctor._id, doctorId: doctor.doctorId, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
});
```
**No `accessToken` field.** The interceptor's `if (response.data?.accessToken)`
guard never fires for this response. `DoctorAuthContext` also never calls
`setAuthTokenForRole`/`setUserAuthToken` itself anywhere in the file (full
file read, confirmed no such call exists).

**Conclusion of Step 2:** this bootstrap call correctly authenticates the
doctor via the `doctorToken` HttpOnly cookie (that's how `verifyDoctorToken`
on `/api/doctor/me` passes) and correctly populates the `doctor` React state
— the UI legitimately shows the doctor as logged in. But it leaves
`authTokens.doctor.accessToken` at `""` for the rest of that tab's life. This
is true for **every doctor session except the exact tab where the login form
was just submitted** — i.e. any page refresh, any deep link (e.g. clicking
"Join Call" from an email/notification in a new tab), any browser restart
with a persisted cookie session, or the SPA remounting for any reason.

### Step 3 — The empty token disables the server's fallback identity resolution

`backend/server.js:728-750` (`resolveSocketIdentity`):
```js
if (requested.token) {
  const tokenIdentity = await validateSocketAccessToken(requested.token);
  ...
}
```
An empty string is falsy, so this entire branch — the one the `DoctorLayout`
comment (Step 1) says exists specifically to avoid depending on the
connection-time cookie snapshot — is skipped. Identity resolution falls
through to only the connection-time cache.

### Step 4 — The connection-time cache is a one-time snapshot, never refreshed for a live socket

`backend/server.js:887-960` (`io.use`) parses `doctorToken`/`doctorRefreshToken`
cookies **once, when the transport first connects**, and stores whatever it
found into `socket.authIdentities`. `resolveSocketIdentity`'s fast path
(`getRequestedSocketIdentity`, `server.js:672-683`) only reads this cached
array — it does not re-parse cookies or re-check expiry per event. This is
explicitly documented as intentional: `server.js:719-727` — *"`socket.authIdentities`
is a snapshot taken once, when this transport connection was first
established... it is not re-derived per event."* A still-connected socket's
authorization is therefore only ever as good as what its cookies looked like
at that one moment — normally fine, **except that Step 2 just showed the
designed-in fallback for when that snapshot is wrong or absent has no way to
ever activate for a doctor.**

### Step 5 — Result matches the log exactly

`canSocketAccessAppointment` (`server.js:777-825`) calls `resolveSocketIdentity`
first; if it returns `null` (no cached identity, no usable token), it returns
`{ allowed: false, reason: "unauthenticated" }` — no `identity` field at all.
The logging call (`server.js:1038-1044`) then falls back to
`socket.userId || null` / `socket.userRole || null`, which are also unset in
this case, producing exactly:
```
[socket] appointment room access denied {
  reason: 'unauthenticated', userId: null, role: null
}
```
— matching your pasted log precisely, for the same `appointmentId`, in the
same test window where the Flutter patient's own telemetry (which passes
through this same `canSocketAccessAppointment` check, successfully, as
`role: 'user'`) proves the patient side was never the one rejected.

---

## 2. What this confirms vs. rejects from the original hypothesis

| Original hypothesis element | Verdict |
|---|---|
| "Doctor's socket becomes unauthenticated, causing room-access-denied" | **Confirmed**, fully traced in code, Steps 1-5 above. |
| "Root cause is nginx not forwarding cookies on `/socket.io/` differently than `/api/`" | **Not verified, and not necessary to explain the symptom.** I did not have access to the nginx config, but the investigation no longer depends on it: even if cookies reach the socket handshake perfectly, the *designed safety net* for whenever they don't (Step 1-2) is unconditionally broken by the `DoctorAuthContext` gap. nginx may or may not also be a factor in why one *specific* connection-time snapshot lacked a valid identity, but the real, fixable defect is that there is no working fallback regardless of the reason. |
| "Cookie SameSite/Secure attributes are misconfigured" | **Rejected.** `middleware/verifyToken.js:11-17`: `isSecureCookie = NODE_ENV==="production" || HTTPS==="true"`, and your pasted UAT env has `HTTPS=true`, so cookies are correctly issued with `sameSite:"none", secure:true` — the correct configuration for the cross-subdomain `uat.humancareconnect.co` → `uat-api.humancareconnect.co` setup. |
| "Refresh-token cookies aren't accepted as a valid socket identity" | **Rejected.** `server.js:945-958` explicitly validates and accepts `doctorRefreshToken` (8-hour TTL) into `authIdentities`, independent of the 15-minute `doctorToken` access cookie (`verifyToken.js:8-9`) — so short access-token TTL alone does not explain the failure; a valid refresh cookie at connection time would still authenticate. |

---

## 3. What remains genuinely open

I can prove the fallback is dead and that this fully explains the log's
`reason: 'unauthenticated'` shape. I cannot, from static code alone, prove
the exact real-world trigger of the one specific connection-time snapshot
that failed in your test (Step 4) — that would require either the nginx
config or a packet-level capture of that socket's handshake request headers.
Plausible triggers, none of them mutually exclusive, and none of them
changing the fix:
- The socket connected/reconnected in the narrow window after the 15-minute
  `doctorToken` access cookie expired but before any REST call happened to
  trigger the interceptor's silent refresh (which rotates the cookie but,
  per Step 4, would not retroactively fix an already-open socket's cached
  identity anyway — only a *reconnect* would re-read cookies).
- A transient reconnect (tab backgrounding, sleep/wake, brief network drop)
  at a moment when cookies were in an inconsistent state.
- Some proxy/infra-level cookie-forwarding gap specific to the WebSocket
  upgrade path — still unverified, still possible, just not required to
  explain what's already fully explained by Steps 1-5.

---

## 4. Scope note

This defect lives entirely in `connect/frontend` (`DoctorAuthContext.jsx`)
and `connect/backend` (the one-time-snapshot design in `server.js`, which is
reasonable on its own but has no working redundancy given the frontend gap).
**Nothing in `connect-mobile` (Flutter) is implicated by this finding** —
consistent with the earlier live-log evidence showing the Flutter patient
client behaved correctly throughout (joined its own room fine, gathered TURN
relay candidates, sent offers and ICE-restarts on schedule). No code was
changed as part of this verification, per your instructions.


