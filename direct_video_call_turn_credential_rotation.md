# Direct Video Call — TURN credential rotation (ops task, not yet actioned)

This is a documentation-only handoff. No `.env` file, secret, or credential
was changed as part of this task — the code changes in this session only
added a new backend endpoint that *mints* short-lived TURN credentials; they
did not touch how the underlying coturn server or its secrets are configured.

## What was found

While hardening the Direct Video Call module's reconnect reliability, a
review of the current ICE/TURN configuration turned up three separate,
pre-existing issues in `connect/frontend/.env` and `connect/backend/.env` /
`.env.production`. None of these were introduced by this session's code
changes — they were already the deployed configuration.

### 1. A permanent TURN credential is compiled into the frontend bundle

`connect/frontend/.env` and `.env.production` both set:

```
VITE_RTC_TURN_USERNAME=rtcuser
VITE_RTC_TURN_CREDENTIAL=StrongPassword123
```

These are consumed by `frontend/src/utils/rtcIceConfig.js` at **module load
time**, unconditionally — meaning this username/password pair is baked into
the built JS bundle and is readable by anyone who opens devtools on the site,
regardless of whether that code path ever actually executes at runtime.

This is the exact anti-pattern the rest of the codebase has already fixed
once, for the authenticated flow: `backend/utils/turnCredentials.js` and
`GET /api/rtc/ice-servers` exist specifically so a permanent TURN
username/password never has to leave the server. As of this session, Direct
Video Call also has its own equivalent endpoint
(`GET /api/direct-video-room/:roomId/ice-servers`, added in
`backend/controllers/directVideoRoomController.js`) that mints a short-lived,
per-room credential the same way — `rtcIceConfig.js`'s static config is now
only used as a last-resort fallback if that endpoint is unreachable after
retries, not the primary path. But the static credential is still physically
present in the shipped bundle, so it should still be rotated and, ideally,
the fallback should stop shipping a TURN entry at all (STUN-only fallback —
a pure code change, tracked separately, not a secret rotation).

**Action needed:** rotate the value of `VITE_RTC_TURN_CREDENTIAL` (and
ideally `VITE_RTC_TURN_USERNAME`) in your coturn user database / auth config
and in `connect/frontend/.env` + `.env.production`, then rebuild and redeploy
the frontend. Treat the current value (`StrongPassword123`, which reads like
a placeholder that was never rotated after initial setup) as already
compromised, since it has been shipped in every production build to date.

### 2. The two TURN regions share the same static-auth-secret

`connect/backend/.env` and `.env.production` configure two independent TURN
regions:

```
RTC_TURN_URLS   / TURN_STATIC_AUTH_SECRET
RTC_TURN_URLS_2 / TURN_STATIC_AUTH_SECRET_2
```

`TURN_STATIC_AUTH_SECRET` and `TURN_STATIC_AUTH_SECRET_2` are currently set
to the **identical** value. The code in `backend/routes/rtc.js` (and the new
`backend/utils/iceServerRegions.js` it now shares with the direct-video-room
endpoint) explicitly documents the reasoning for keeping these independent:

> "Deliberately never share one secret across physically separate machines
> you don't operate as a single trust unit — if one region's secret ever
> leaked, a shared secret would compromise every region at once, where a
> per-region secret only compromises that one."

With both regions on the same secret today, that isolation doesn't actually
exist — a leak or compromise of either TURN deployment compromises both.

**Action needed:** generate a second, independent random secret for
`TURN_STATIC_AUTH_SECRET_2`, update the coturn config on the second region
(`turn2.humancareconnect.co`) to use `use-auth-secret` with that new value,
then update `TURN_STATIC_AUTH_SECRET_2` in the backend `.env`/`.env.production`
and restart the backend.

### 3. `.env.production` has a duplicated `TURN_STATIC_AUTH_SECRET` line

`connect/backend/.env.production` currently defines `TURN_STATIC_AUTH_SECRET`
twice (same value both times — harmless today since dotenv just takes the
last one, but worth cleaning up during the rotation above so the file has a
single source of truth).

## Suggested rotation order (to avoid a mid-rotation outage)

1. Generate two new random secrets (e.g. `openssl rand -hex 32`) — one for
   region 1, one for region 2. Do not reuse either for both regions.
2. Generate a new random TURN username/password pair for the frontend-bundled
   fallback credential (or, better, ship the STUN-only-fallback code change
   referenced above first, which removes the need for this pair entirely).
3. Update each coturn instance's `use-auth-secret` / static user config to
   accept the *new* secret, ideally supporting both old and new briefly if
   your coturn setup allows dual secrets during rollover — otherwise plan a
   short maintenance window.
4. Update `connect/backend/.env` and `.env.production` with the new
   `TURN_STATIC_AUTH_SECRET` / `TURN_STATIC_AUTH_SECRET_2` values, and
   `connect/frontend/.env` / `.env.production` with the new
   `VITE_RTC_TURN_USERNAME` / `VITE_RTC_TURN_CREDENTIAL` (if item 1's static
   fallback is being kept rather than removed).
5. Redeploy backend, then rebuild + redeploy frontend.
6. Revoke/remove the old secrets from coturn once the new deploy is confirmed
   healthy (both appointment Video Consultation and Direct Video Call calls
   connecting successfully with TURN relay candidates present in
   `pc.getStats()`).

None of the above requires any further code change beyond what's already
merged — it's purely a secrets-rotation and coturn-configuration task.
