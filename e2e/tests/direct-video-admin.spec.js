// Admin panel coverage for the direct-call Calls list, call report, and
// admin actions (Phase 3). Skips itself entirely if no admin credentials
// were seeded (staging runs without TEST_ADMIN_EMAIL/PASSWORD).
import { request } from "@playwright/test";
import { ADMIN_STATE } from "../global-setup.js";
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

  async function createRoomViaApi(api, extra = {}) {
    const res = await api.post("/api/direct-video-room", {
      data: { note: "e2e admin test", expiresInHours: 24, ...extra },
    });
    expect(res.ok(), `create room failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    return body.room;
  }

  async function joinAsGuest(party, roomId, name) {
    await party.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
    await party.page.getByLabel("Your name").fill(name);
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

      await joinAsGuest(host, room.roomId, "Host Admin1");
      // A solo join never has video "flowing" (no peer yet) — just give the
      // join-direct-room round trip a moment to land server-side.
      await host.page.waitForTimeout(2_000);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await expect(callRow(admin.page, room.roomId)).toContainText("One joined", { timeout: 10_000 });

      await joinAsGuest(guest, room.roomId, "Guest Admin1");
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
      const room = await createRoomViaApi(api);
      await Promise.all([joinAsGuest(host, room.roomId, "Host P1"), joinAsGuest(guest, room.roomId, "Guest P1")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await joinAsGuest(third, room.roomId, "Third P1");
      await expect(third.page.locator("h2", { hasText: "Can't join this meeting" })).toBeVisible({
        timeout: 10_000,
      });

      await admin.page.goto("/admin-dashboard/direct-video-consultation/calls", { waitUntil: "domcontentloaded" });
      await admin.page.locator('input[type="checkbox"]').check();
      await expect(callRow(admin.page, room.roomId)).toContainText("Problem", { timeout: 10_000 });
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
      const room = await createRoomViaApi(api);
      await Promise.all([joinAsGuest(host, room.roomId, "Host Alert1"), joinAsGuest(guest, room.roomId, "Guest Alert1")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await joinAsGuest(third, room.roomId, "Third Alert1");
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
            return (body.alerts || []).some((a) => a.roomId === room.roomId && a.type === "room_full");
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
      await Promise.all([joinAsGuest(host, room.roomId, "Host Report"), joinAsGuest(guest, room.roomId, "Guest Report")]);
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
      await Promise.all([joinAsGuest(host, room.roomId, "Host Clear"), joinAsGuest(guest, room.roomId, "Guest Clear")]);
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
      await Promise.all([joinAsGuest(host, room.roomId, "Host End"), joinAsGuest(guest, room.roomId, "Guest End")]);
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
