# Admin Appointments list: browser tests

Real Chromium drives the real admin Appointments page (`src/pages/admin/AdminAppointments.jsx`) against the real
`/api/admin/bookings` code. Nothing about the page is mocked.

## Run it

```bash
cd frontend
npm run test:e2e:appointments
```

About a minute. Add `E2E_SCREENSHOTS=1` to save a few screenshots to `tests/e2e/adminAppointments/.screenshots/`
(git-ignored) so a person can look at the dialogs.

It needs:

- `playwright-core` and `vite` (already in `frontend/`), and the backend's dependencies (`cd backend && npm install`),
  because the API under test is the backend's own code.
- A Chromium. Either `npx playwright install chromium`, or an installed Chrome/Edge (found automatically), or
  `CHROME_PATH=/path/to/chrome`.
- The first run downloads a MongoDB binary for `mongodb-memory-server`, as the backend tests do.

If a dependency or a browser is missing the tests **skip** and say why.

## What it starts

| Piece | What it is |
|---|---|
| Database | `mongodb-memory-server`: a throwaway MongoDB in memory. The code refuses to start unless its address is local. |
| API | `apiServer.mjs`: the backend's real `routes/adminBookings.js` and models. No login (the auth guard is replaced by a fixed admin). |
| Notifications | Emails and push are **recorded, not sent**; tests read them back from `/__calls`. |
| Page | A Vite dev server serves only this page (`harness/`), with the app's toast and confirm providers. `/api` is proxied to the API above. |

There is no `.env`, no `MONGO_URI`, no Atlas and no real secret anywhere in this folder. The two placeholder keys set in
`apiServer.mjs` exist only so the backend modules load.

## What it covers

- The eight tabs, columns, server-side counts, Hide testing, 25 per page, search, and the table/card layouts from
  phone to wide desktop (no sideways page scroll).
- Assign doctor (including the time for a Next Available category booking, and a doctor who is busy), Alternate
  doctor and Go back, Confirm, Auto complete, Cancel (reason, paid warning naming the gateway), a lost race (409), a
  server error, and testing bookings sending nothing.

## Adding a test

`apiServer.mjs` serves control endpoints the tests use through `helpers.mjs`:

- `make({ kind, status, doctor, paid, gateway, testing, nextAvailable, name, time, date })` creates a booking and
  returns its id. `name` is the patient's name, which is how a test finds its row (`h.search(name)`, `h.row(name)`).
  Give each test its own names. Dates default to a different day per booking so doctors never clash by accident.
- `doc(id)` reads the saved booking, `calls()` reads the emails and pushes that would have gone out, `reset()` clears them.
