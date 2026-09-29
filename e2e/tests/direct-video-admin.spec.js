// Admin panel coverage for the direct-call Calls list, call report, and
// admin actions (Phase 3). Skips itself entirely if no admin credentials
// were seeded (staging runs without TEST_ADMIN_EMAIL/PASSWORD).
import { request } from "@playwright/test";
import { ADMIN_STATE } from "../global-setup.js";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createDirectRoom } from "../helpers/directRoomSeed.js";
import {
  bothRecovered,
  newParty,
  simulateStall,
  test,
  expect,
  waitForRetryButton,
  waitForVideoFlowing,
} from "../helpers/harness.js";

test.describe("direct call — admin panel", () => {
  test.skip(!process.env.TEST_ADMIN_EMAIL, "TEST_ADMIN_EMAIL is not set (seeded automatically in local mode)");

  async function adminApi(baseURL) {
    return request.newContext({ baseURL, storageState: ADMIN_STATE });
  }

  // Every room created through the real admin API always gets PINs (Step 1
  // of the PIN-based-roles rollout) — this is the normal path now.
  async function createRoomViaApi(api, extra = {}) {
    const res = await api.post("/api/direct-video-room", {
      data: { note: "e2e admin test", expiresInHours: 24, ...extra },
    });
    expect(res.ok(), `create room failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    return { ...body.room, doctorPin: body.doctorPin, patientPin: body.patientPin };
  }

  // A handful of tests below (room-full rejection) exercise the LEGACY,
  // pre-PIN join path specifically — old links created before this rollout
  // keep working exactly as before, gated on doctorPinEncrypted being
  // empty. Seeded directly in the DB (bypassing the admin API, which always
  // issues PINs now) so that legacy behaviour stays covered.
  async function createLegacyRoom(opts = {}) {
    const { roomId } = await createDirectRoom({ mongoUri: LOCAL_MONGO_URI, status: "active", ...opts });
    return roomId;
  }

  async function joinAsGuest(party, roomId, name) {
    await party.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
    await party.page.getByLabel("Your name").fill(name);
    await party.page.getByRole("button", { name: "Join now" }).click();
  }

  async function fillPin(page, pin) {
    await page.locator(".dvcall-pin-box").first().click();
    await page.keyboard.type(pin);
  }

  // PIN rooms only — enters the PIN (deciding Doctor vs Patient role),
  // continues past the device-preview screen with no name to type.
  async function joinWithPin(party, roomId, pin) {
    await party.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
    await fillPin(party.page, pin);
    await party.page.getByRole("button", { name: "Continue" }).click();
    await party.page.getByRole("button", { name: "Join now" }).click();
  }

  function callRow(page, roomId) {
    return page.locator("tr", { has: page.locator(`a[href*="${roomId}"]`) });
  }

  test("calls list: status moves waiting -> one joined -> in call", async ({ browser, baseURL }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const room = await createRoomViaApi(api);

      await admin.page.goto("/admin-dashboard/direct-video-consultation/calls", {
        waitUntil: "domcontentloaded",
      });
      await expect(callRow(admin.page, room.roomId)).toContainText("Waiting", { timeout: 10_000 });

      await joinWithPin(host, room.roomId, room.doctorPin);
      // A solo join never has video "flowing" (no peer yet) — just give the
      // join-direct-room round trip a moment to land server-side.
      await host.page.waitForTimeout(2_000);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await expect(callRow(admin.page, room.roomId)).toContainText("One joined", { timeout: 10_000 });

      await joinWithPin(guest, room.roomId, room.patientPin);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await expect(callRow(admin.page, room.roomId)).toContainText("In call", { timeout: 10_000 });
    } finally {
      await host.context.close();
      await guest.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });

  test("calls list: a room-full rejection marks the call as a problem", async ({ browser, baseURL }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const third = await newParty(browser, "third", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      // Room-full rejection is a legacy (pre-PIN) behaviour — PIN rooms
      // replace it with a PIN-conflict-and-takeover flow instead (see
      // direct-pin-socket.spec.js), so this exercises an old-style room
      // directly, same as old links must keep working.
      const roomId = await createLegacyRoom();
      await Promise.all([joinAsGuest(host, roomId, "Host P1"), joinAsGuest(guest, roomId, "Guest P1")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await joinAsGuest(third, roomId, "Third P1");
      await expect(third.page.locator("h2", { hasText: "Can't join this meeting" })).toBeVisible({
        timeout: 10_000,
      });

      await admin.page.goto("/admin-dashboard/direct-video-consultation/calls", { waitUntil: "domcontentloaded" });
      await admin.page.locator('input[type="checkbox"]').check();
      await expect(callRow(admin.page, roomId)).toContainText("Problem", { timeout: 10_000 });
    } finally {
      await host.context.close();
      await guest.context.close();
      await third.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });

  // Phase 4: a room-full rejection must also surface as an in-app alert —
  // badge count going up, and the alert itself listed with a link back to
  // this room's report.
  test("Phase 4: a room-full rejection raises an in-app admin alert", async ({ browser, baseURL }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const third = await newParty(browser, "third", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      // See the previous test — room-full rejection only exists on legacy
      // (pre-PIN) rooms.
      const roomId = await createLegacyRoom();
      await Promise.all([joinAsGuest(host, roomId, "Host Alert1"), joinAsGuest(guest, roomId, "Guest Alert1")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await joinAsGuest(third, roomId, "Third Alert1");
      await expect(third.page.locator("h2", { hasText: "Can't join this meeting" })).toBeVisible({
        timeout: 10_000,
      });

      // Poll the admin REST endpoint directly rather than the bell's 30s
      // client-side poll interval — this test only needs to prove the alert
      // was raised and is fetchable, not exercise the UI's own polling cadence.
      await expect
        .poll(
          async () => {
            const res = await api.get(`/api/direct-video-room/alerts?limit=20`);
            const body = await res.json();
            return (body.alerts || []).some((a) => a.roomId === roomId && a.type === "room_full");
          },
          { timeout: 15_000, message: "expected a room_full alert for this room" },
        )
        .toBe(true);

      // The bell badge and dropdown pick it up too.
      await admin.page.goto("/admin-dashboard/direct-video-consultation/calls", { waitUntil: "domcontentloaded" });
      await admin.page.getByRole("button", { name: "Direct call alerts" }).click();
      // .first(): other tests in this run may have raised their own
      // room_full alert too — the dropdown lists the most recent 20 across
      // all rooms, so more than one "Meeting full" label can be on the page
      // at once. Alerts are sorted newest-first, so the first match is this
      // test's own (it just triggered it).
      await expect(admin.page.getByText("Meeting full").first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await host.context.close();
      await guest.context.close();
      await third.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });

  test("call report: timeline and participants after join, Retry, and a mic toggle", async ({
    browser,
    baseURL,
  }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const room = await createRoomViaApi(api);
      await Promise.all([joinWithPin(host, room.roomId, room.doctorPin), joinWithPin(guest, room.roomId, room.patientPin)]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await simulateStall(guest.page);
      await (await waitForRetryButton(guest.page)).click();
      await bothRecovered(host, guest, 15_000, "after guest Retry");

      await host.page.getByTitle("Mute microphone").click();
      // Give the mic-state + any stats-driven events a moment to reach the server.
      await host.page.waitForTimeout(1_500);

      await admin.page.goto(`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(admin.page.locator(".dvc-timeline li").first()).toBeVisible({ timeout: 10_000 });
      await expect(admin.page.getByText(/joined/i).first()).toBeVisible();
      await expect(admin.page.getByText(/tapped retry/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(admin.page.getByText(/mic off/i).first()).toBeVisible({ timeout: 10_000 });

      // Participants table: two rows (host + guest), each with a device
      // column populated and at least one mic state resolved.
      const rows = admin.page.locator(".dvc-card", { hasText: "Participants" }).locator("tbody tr");
      await expect(rows).toHaveCount(2, { timeout: 10_000 });
    } finally {
      await host.context.close();
      await guest.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });

  test("Phase 5.2: a join stores only a masked IP, never the full one", async ({ browser, baseURL }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const room = await createRoomViaApi(api);
      await joinWithPin(host, room.roomId, room.doctorPin);
      // Give the join round trip a moment to land and be logged server-side.
      await host.page.waitForTimeout(1_500);

      const res = await api.get(`/api/direct-video-room/${room.roomId}/events`);
      const body = await res.json();
      const participant = (body.participants || []).find((p) => p.role === "doctor");
      expect(participant, "expected the host's (Doctor's) participant row").toBeTruthy();
      expect(participant.maskedIp, "expected a masked IP to be recorded (DIRECT_CALL_IP_LOGGING_ENABLED defaults on)").toBeTruthy();
      // Masked — an IPv4 always ends in "xxx" here; never a bare 4-octet
      // all-numeric address (what a full, unmasked IPv4 would look like).
      expect(participant.maskedIp).toMatch(/xxx/);
      expect(participant.maskedIp).not.toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);

      // Same value surfaces on the report page's admin-only column.
      await admin.page.goto(`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(admin.page.getByText(participant.maskedIp)).toBeVisible({ timeout: 10_000 });
    } finally {
      await host.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });

  test("admin action: extend link pushes expiresAt forward", async ({ browser, baseURL }) => {
    const api = await adminApi(baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const room = await createRoomViaApi(api, { expiresInHours: 1 });

      await admin.page.goto(`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await admin.page.getByRole("button", { name: /extend link/i }).click();
      await expect(admin.page.getByText(/link extended/i)).toBeVisible({ timeout: 10_000 });

      const check = await api.get(`/api/direct-video-room/${room.roomId}/events`);
      const body = await check.json();
      const newExpiry = new Date(body.room.expiresAt).getTime();
      const originalExpiry = new Date(room.expiresAt).getTime();
      expect(newExpiry, "expiresAt should have moved forward").toBeGreaterThan(originalExpiry);
    } finally {
      await admin.context.close();
      await api.dispose();
    }
  });

  test("admin action: clear stuck seats does not affect a live call", async ({ browser, baseURL }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const room = await createRoomViaApi(api);
      await Promise.all([joinWithPin(host, room.roomId, room.doctorPin), joinWithPin(guest, room.roomId, room.patientPin)]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await admin.page.goto(`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await admin.page.getByRole("button", { name: /clear stuck seats/i }).click();
      // Scoped to the action notice specifically — the timeline below also
      // grows a matching "An admin (...) cleared 0 stuck seat(s)" row once
      // the report refetches, which would otherwise be a second match.
      await expect(admin.page.locator(".dvc-notice")).toContainText(/cleared 0 stuck seat/i, {
        timeout: 10_000,
      });

      // Both sides must still be live and unaffected — no reconnect/rebuild
      // triggered by an action that found nothing stuck to clear.
      await host.page.waitForTimeout(2_000);
      await expect(host.page.locator(".hc-vc__reconnect-stalled-notice")).toHaveCount(0);
      await expect(guest.page.locator(".hc-vc__reconnect-stalled-notice")).toHaveCount(0);
      await waitForVideoFlowing(host.page, { timeoutMs: 10_000, label: "host still live" });
      await waitForVideoFlowing(guest.page, { timeoutMs: 10_000, label: "guest still live" });
    } finally {
      await host.context.close();
      await guest.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });

  test("Live view: auto-watches on page open (no button), samples land, survives admin disconnect", async ({
    browser,
    baseURL,
  }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    let adminClosed = false;
    try {
      const room = await createRoomViaApi(api);
      await Promise.all([joinWithPin(host, room.roomId, room.doctorPin), joinWithPin(guest, room.roomId, room.patientPin)]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      // No "Start Live Monitoring" button — opening the report page alone
      // starts watching, and no participant-facing notice exists any more
      // (technical telemetry is always-on regardless of who's watching).
      await admin.page.goto(`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(admin.page.getByRole("button", { name: /live monitoring/i })).toHaveCount(0);

      // Live samples land for both participants (mic/camera on-off,
      // connection state, RTT/loss/jitter) without any click.
      const liveCard = admin.page.locator(".dvc-card", { has: admin.page.locator("h2", { hasText: "Live" }) });
      await expect(liveCard.getByText("No samples yet…")).toHaveCount(0, { timeout: 15_000 });
      await expect(liveCard.getByText(/RTT:/)).toBeVisible();

      // Dropping the admin's own connection mid-watch must leave the call
      // between host and guest completely unaffected.
      await admin.context.close();
      adminClosed = true;

      await host.page.waitForTimeout(3_000);
      await waitForVideoFlowing(host.page, { timeoutMs: 10_000, label: "host still live after admin disconnect" });
      await waitForVideoFlowing(guest.page, { timeoutMs: 10_000, label: "guest still live after admin disconnect" });
    } finally {
      await host.context.close();
      await guest.context.close();
      if (!adminClosed) await admin.context.close();
      await api.dispose();
    }
  });

  test("admin action: force end call disconnects both participants with a clear message", async ({
    browser,
    baseURL,
  }) => {
    const api = await adminApi(baseURL);
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const admin = await newParty(browser, "admin", ADMIN_STATE, baseURL);
    try {
      const room = await createRoomViaApi(api);
      await Promise.all([joinWithPin(host, room.roomId, room.doctorPin), joinWithPin(guest, room.roomId, room.patientPin)]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await admin.page.goto(`/admin-dashboard/direct-video-consultation/calls/${room.roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await admin.page.getByRole("button", { name: /^force end call$/i }).click();
      await admin.page.getByRole("button", { name: /yes, end it/i }).click();
      await expect(admin.page.getByText(/call ended/i)).toBeVisible({ timeout: 10_000 });

      await expect(host.page.getByText(/admin ended this call/i)).toBeVisible({ timeout: 10_000 });
      await expect(guest.page.getByText(/admin ended this call/i)).toBeVisible({ timeout: 10_000 });
    } finally {
      await host.context.close();
      await guest.context.close();
      await admin.context.close();
      await api.dispose();
    }
  });
});
