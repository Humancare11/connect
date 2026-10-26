# Admin Appointment entries: browser tests

Real Chromium drives the real admin Appointment entries page (`src/pages/admin/AdminEntries.jsx`) inside the real admin layout
(sidebar and top bar, the app's global CSS), against the real `/api/admin/entries` code. Nothing about the page is mocked.

## Run it

```bash
cd frontend
npm run test:e2e:entries
```

About a minute. Add `E2E_SCREENSHOTS=1` to save screenshots to `tests/e2e/adminEntries/.screenshots/` (git-ignored), including
one per layout width (1920, 1440, 1366, 1280, 390).

It needs `playwright-core` and `vite` (already in `frontend/`), the backend's dependencies (`cd backend && npm install`) and a
Chromium (`npx playwright install chromium`, an installed Chrome/Edge, or `CHROME_PATH=/path/to/chrome`). If one is missing the
tests **skip** and say why.

## What it starts

| Piece | What it is |
|---|---|
| Database | `mongodb-memory-server`: a throwaway MongoDB in memory. The code refuses to start unless its address is local. |
| API | `apiServer.mjs`: the backend's real `routes/adminEntries.js`, models and role guard. No login (the token check is replaced; send `x-test-role` to try another role). |
| Page | A Vite dev server serves `harness/`: the real `AdminLayout` + `AdminEntries`, sign-in contexts stubbed (`tests/ui-baseline/stubContexts.mjs`). `/api` is proxied to the API above. |

There is no `.env`, no `MONGO_URI`, no Atlas and no real secret anywhere in this folder.

## What it covers

- The tabs, counts, three boxes, columns, totals row and the pager; the Doctor, Month and search filters.
- Typing a doctor fee, the grey 75% placeholder, Paid (needs a doctor and a fee, fills today's date), the per-cell
  Saving / Saved / Couldn't save state, two fast edits of one row, and a change made by someone else.
- Add manual entry, Edit (locked once Paid), Delete (with a confirmation, never for a Paid row, never for a booking row).
- The CSV download.
- Access: the menu item for admin and super admin only, and a 403 for the payment admin on every entries route.
- Layout at 1920, 1440, 1366, 1280 and 390px: no sideways scroll, Booked only above 1440, cards below 1360, nothing clipped.
