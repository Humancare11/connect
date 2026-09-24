# Video-call reconnect e2e tests (Playwright)

Two real Chromium browsers (a doctor and a patient, in separate contexts, with
a fake camera/mic) join the same call; the tests break one side's connection
and check that **inbound video frames keep increasing on both sides**. Nothing
in the app is modified.

## Run it (one command)

```bash
cd connect/e2e
npm install
npx playwright install chromium     # first time only
npx playwright test
```

That single `npx playwright test` starts the whole local stack itself, seeds
it, logs in, runs the tests and tears everything down:

| Piece | How |
|---|---|
| MongoDB | a **throwaway** `mongod` on port 27018 in a fresh temp dir (needs `mongod` on PATH, or set `MONGOD_BIN`) |
| Backend | `node server.js` in `../backend`, on port 5000, with `MONGO_URI` overridden to the throwaway DB (your `backend/.env` is otherwise used, e.g. for `JWT_SECRET`; mail is pointed at a dead port) |
| Frontend | `npm run dev` in `../frontend` on port 5173 (proxies `/api` and `/socket.io` to `:5000`) |
| Data | a doctor, a patient, a `confirmed` appointment and a direct-call room, created by `helpers/seed.js` |
| Credentials | generated randomly per run in local mode (nothing hardcoded) |

**Safety:** the seed step refuses to run unless the Mongo host is localhost, and
the run aborts if ports 5000/5173/27018 are already busy, so it can never end
up using (or writing to) your real database. Stop any running dev backend or
frontend first.

If you'd rather start the stack yourself, the equivalent manual commands are:

```bash
mongod --dbpath <empty-dir> --port 27018 --bind_ip 127.0.0.1
cd connect/backend  && MONGO_URI=mongodb://127.0.0.1:27018/hcc_e2e PORT=5000 node server.js
cd connect/frontend && npm run dev -- --port 5173 --strictPort
```

### Against an existing environment (e.g. staging)

```bash
E2E_BASE_URL=https://staging.example.com \
TEST_DOCTOR_EMAIL=... TEST_DOCTOR_PASSWORD=... \
TEST_PATIENT_EMAIL=... TEST_PATIENT_PASSWORD=... \
TEST_APPOINTMENT_ID=<confirmed appointment linking those two users> \
TEST_DIRECT_ROOM_ID=<active direct-call room id>   # optional; the direct-call test is skipped without it
npx playwright test
```

No servers are started and nothing is seeded. Create the appointment with a
normal booking (status must be `confirmed`, doctor and patient assigned); the
direct room via the admin "direct video room" tool. The repo has no seed script
for these, so `helpers/seed.js` (local only) is the reference for the shape.

## Output

- `test-results/<test-title>-doctor.log` / `-patient.log` (direct call: `-host` / `-guest`) — every console line from each page
- `test-results/summary.md` — pass/fail table (also printed at the end)
- `test-results/html-report/` — `npm run report`

## How the tests work (and their limits)

- **Video check:** an init script subclasses `window.RTCPeerConnection` in the
  *test* browser to keep a handle on each pc; `helpers/harness.js` reads
  `inbound-rtp` `framesDecoded` via `getStats()` and requires it to increase.
- **"Retry" is real, the connection drop is simulated.** The Retry button only
  appears after the app decides its pc is stuck. `simulateStall()` fakes the
  pc's `connectionState`/`iceConnectionState` and calls the app's own
  state-change handlers, so the app runs its real stall logic and shows its real
  Retry button ~12s later; clicking it performs a genuine teardown/rebuild and
  the *other* side reacts to the real fresh offer. What is **not** covered is the
  network itself failing.
- **Real network-drop test: skipped.** Chromium's offline emulation doesn't
  affect WebRTC media, and two local browsers connect over loopback/LAN, so
  cutting traffic needs OS-level tooling (firewall rules needing admin, or
  toxiproxy/iptables in Docker plus a TURN-only ICE config). That isn't simple
  or portable here (no Docker on this machine), so it's left out.
- The assertions on `[RETRY-DEBUG]` log lines need the app's debug logging on.
  `RETRY_DEBUG` in `frontend/src/utils/retryDebug.js` now reads
  `VITE_RETRY_DEBUG` (off by default); `playwright.config.js` sets
  `VITE_RETRY_DEBUG=true` for the Vite dev server it starts. If you point the
  suite at some other server, that build needs the same variable, or those
  tests will fail on their log assertions by design.
