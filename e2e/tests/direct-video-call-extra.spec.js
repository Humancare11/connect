// Extra direct (link-based, guest) video call coverage: normal start, Retry
// (guest/host/both), camera+mic off, permission denied/slow, refresh/second
// tab/different-guestId, a real third joiner, host leave+rejoin, clean call
// end, and expired/closed links. Nothing in the app is modified — read-only
// checks against the real running app, same as tests/direct-video-call.spec.js.
//
// Each test mints its OWN fresh room (createDirectRoom) instead of reusing
// the shared TEST_DIRECT_ROOM_ID: the direct-room seat reservation holds a
// disconnected guest's seat for DIRECT_ROOM_SEAT_RESERVATION_MS (60s by
// default) after their context closes, and consecutive tests sharing one
// room mint brand-new guestIds (fresh browser contexts = fresh localStorage)
// well within that window — every later test would then collide with the
// PRIOR test's still-reserved seats. A dedicated room per test avoids that
// cross-test collision entirely, so failures here reflect the app, not test
// ordering. (Tests e1/e2/f deliberately reuse ONE room across multiple
// parties within the SAME test — that in-test sharing is the point.)
import fs from "node:fs";
import path from "node:path";
import { LOCAL_MONGO_URI } from "../helpers/env.js";
import { createDirectRoom } from "../helpers/directRoomSeed.js";
import {
  bothRecovered,
  expect,
  liveMediaTracks,
  newParty,
  overrideGetUserMedia,
  readInbound,
  setGumMode,
  simulateStall,
  test,
  waitForRetryButton,
  waitForVideoFlowing,
} from "../helpers/harness.js";

const RESULTS_DIR = path.resolve("test-results");

async function freshRoom(opts = {}) {
  const { roomId } = await createDirectRoom({ mongoUri: LOCAL_MONGO_URI, status: "active", ...opts });
  return roomId;
}

async function joinAsGuest(party, room, name) {
  await party.page.goto(`/direct-video-call/${room}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
  await party.page.getByLabel("Your name").fill(name);
  await party.page.getByRole("button", { name: "Join now" }).click();
}

async function writeLogs(name, ...parties) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  for (const p of parties) {
    fs.writeFileSync(path.join(RESULTS_DIR, `${name}-${p.role}.log`), await p.logs.text());
  }
}

test.describe("direct call — extra coverage", () => {
  test.skip(
    !process.env.TEST_DIRECT_ROOM_ID,
    "TEST_DIRECT_ROOM_ID is not set (local-mode-only: these tests mint their own DB rooms)",
  );

  test("a: normal call start — both flowing quickly, no rebuild", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      const startedAt = Date.now();
      await Promise.all([joinAsGuest(host, roomId, "Host A"), joinAsGuest(guest, roomId, "Guest A")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 30_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 30_000, label: "guest" }),
      ]);
      // Generous margin: a cold first connection (fresh browser contexts,
      // ICE gathering, DTLS handshake) on a loaded machine has been observed
      // to legitimately take into the mid-20s range here, not just the
      // sub-5s typical of a warm run — this checks "connects promptly", not
      // a tight performance budget.
      expect(Date.now() - startedAt, "time to first video on both sides").toBeLessThan(30_000);
      expect(await host.logs.count(/requestPcRebuild:START/), "host rebuilds on plain start").toBe(0);
      expect(await guest.logs.count(/requestPcRebuild:START/), "guest rebuilds on plain start").toBe(0);
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  // Split into three independent tests (each with its own fresh room/parties
  // and a normal timeout budget) rather than one long sequential test: a
  // single simulateStall() call is a raw, unprotected page.evaluate() (unlike
  // readInbound(), which races itself against a timeout — see its own doc
  // comment on this environment's occasional CDP stalls), so one flaky call
  // deep in a 3-round test used to be able to eat the ENTIRE budget and mask
  // whether the other two rounds actually passed.
  test("b1: guest Retry — video resumes on both sides", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host B1"), joinAsGuest(guest, roomId, "Guest B1")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await simulateStall(guest.page);
      await (await waitForRetryButton(guest.page)).click();
      await bothRecovered(host, guest, 15_000, "after guest Retry");
    } finally {
      await writeLogs("b1-guest-retry", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("b2: host Retry — video resumes on both sides", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host B2"), joinAsGuest(guest, roomId, "Guest B2")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await simulateStall(host.page);
      await (await waitForRetryButton(host.page)).click();
      await bothRecovered(host, guest, 15_000, "after host Retry");
    } finally {
      await writeLogs("b2-host-retry", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("b3: both tap Retry within 1s — no rebuild loop, video resumes", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host B3"), joinAsGuest(guest, roomId, "Guest B3")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await Promise.all([simulateStall(host.page), simulateStall(guest.page)]);
      const [hostBtn, guestBtn] = await Promise.all([
        waitForRetryButton(host.page),
        waitForRetryButton(guest.page),
      ]);
      await Promise.all([hostBtn.click(), guestBtn.click()]);
      await bothRecovered(host, guest, 20_000, "after both Retry");
    } finally {
      await writeLogs("b3-both-retry", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("c: camera+mic off both sides for 60s — no rebuild, call stays up", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host C"), joinAsGuest(guest, roomId, "Guest C")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await Promise.all([
        host.page.getByTitle("Turn camera off").click(),
        host.page.getByTitle("Mute microphone").click(),
        guest.page.getByTitle("Turn camera off").click(),
        guest.page.getByTitle("Mute microphone").click(),
      ]);
      await host.page.waitForTimeout(60_000);
      const hostState = await readInbound(host.page);
      const guestState = await readInbound(guest.page);
      expect(hostState.state, "host pc still connected").toBe("connected");
      expect(guestState.state, "guest pc still connected").toBe("connected");
      expect(await host.logs.count(/requestPcRebuild:START/), "host rebuilds").toBe(0);
      expect(await guest.logs.count(/requestPcRebuild:START/), "guest rebuilds").toBe(0);
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test("d1: guest camera/mic denied — still joins receive-only, sees/hears host; manual Retry attaches media", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    await overrideGetUserMedia(guest.page, { kind: "deny" });
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host D1"), joinAsGuest(guest, roomId, "Guest D1")]);
      // Guest still SEES/HEARS the host despite sending nothing.
      await waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest (recvonly)" });
      // Host must know the guest actually connected, not stuck waiting.
      await expect(host.page.locator(".hc-vc__waiting")).toBeHidden({ timeout: 20_000 });

      await setGumMode(guest.page, { kind: "allow" });
      await guest.page.locator(".hc-vc__local-audio-retry").click();
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host (after guest grants media)" });
    } finally {
      await writeLogs("d1-guest-denied", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("d2: guest permission prompt answered after 10s — call still connects, media attaches automatically", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    // Longer than MEDIA_ACQUIRE_TIMEOUT_MS (8s) so this exercises the
    // "continue without media, attach late" path against a real delayed
    // device, not a synthetic stall.
    await overrideGetUserMedia(guest.page, { kind: "delay", delayMs: 12_000 });
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host D2"), joinAsGuest(guest, roomId, "Guest D2")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 30_000, label: "host (late guest media)" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 30_000, label: "guest" }),
      ]);
    } finally {
      await writeLogs("d2-guest-slow-prompt", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("d3: guest's in-call media Retry does not hang when the permission prompt never answers", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    await overrideGetUserMedia(guest.page, { kind: "deny" });
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host D3"), joinAsGuest(guest, roomId, "Guest D3")]);
      await waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest (recvonly)" });

      // Longer than RETRY_MEDIA_TIMEOUT_MS (10s): the prompt never answers.
      await setGumMode(guest.page, { kind: "delay", delayMs: 20_000 });
      const retryBtn = guest.page.locator(".hc-vc__local-audio-retry");
      await retryBtn.click();
      await expect(retryBtn).toHaveText("Retrying…");
      // Must give up and hand control back within ~10s, not the full 20s the
      // prompt is still pretending to think about.
      await expect(retryBtn).toHaveText("Retry", { timeout: 12_000 });
      await expect(retryBtn).toBeEnabled();
      // Still shows the mic-missing banner — the guest never actually got
      // real media, so the UI must keep offering a way to retry.
      await expect(guest.page.locator(".hc-vc__local-audio-notice")).toBeVisible();
    } finally {
      await writeLogs("d3-incall-retry-timeout", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("d4: pre-join preview does not hang when the permission prompt never answers; Join now still works", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    // Longer than RETRY_MEDIA_TIMEOUT_MS (10s) — the prompt never answers
    // during the pre-join preview.
    await overrideGetUserMedia(guest.page, { kind: "delay", delayMs: 30_000 });
    try {
      await guest.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      // Must show an error (not stay blank forever) within ~12s, not the
      // full 30s the prompt is still pretending to think about.
      await expect(guest.page.locator(".dvcall-prejoin-preview__error")).toBeVisible({ timeout: 12_000 });
      await expect(guest.page.getByRole("button", { name: "Retry Camera/Mic" })).toBeVisible();

      // "Join now" isn't gated on the preview promise — the guest can still
      // proceed and join receive-only despite the still-pending prompt (Step
      // 3's own 8s timeout/recvonly fallback, already covered by d1/d2, takes
      // over from here).
      await guest.page.getByLabel("Your name").fill("Guest D4");
      await guest.page.getByRole("button", { name: "Join now" }).click();

      await joinAsGuest(host, roomId, "Host D4");
      await waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest (recvonly, prompt still pending)" });
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" });
    } finally {
      await writeLogs("d4-prejoin-preview-timeout", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  // FIXED: was the confirmed root cause of a real "2 participants already
  // joined" incident. A guest who reconnects with a different guestId (any
  // new browser/app — e.g. a WhatsApp in-app browser handing off to Chrome)
  // used to be wrongly rejected as long as the old guestId's seat was still
  // reserved (DIRECT_ROOM_SEAT_RESERVATION_MS, server.js). Fixed by
  // tryTakeOverDeadSeat: a seat with zero live sockets is freed instantly.
  test("e1: guest reopens the link with a DIFFERENT guestId after disconnecting — dead seat taken over instantly", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest1 = await newParty(browser, "guest1", null, baseURL);
    try {
      // Baseline: how long an ORDINARY join takes right now, on this
      // machine, under whatever load happens to exist this run — used below
      // instead of a fixed wall-clock bound, which was flaky under heavy
      // concurrent test-suite load (a plain join alone can take >8s then,
      // with nothing wrong at all).
      const baselineStart = Date.now();
      await Promise.all([joinAsGuest(host, roomId, "Host E1"), joinAsGuest(guest1, roomId, "Guest E1a")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 30_000, label: "host" }),
        waitForVideoFlowing(guest1.page, { timeoutMs: 30_000, label: "guest1" }),
      ]);
      const baselineJoinMs = Date.now() - baselineStart;

      // Abrupt disconnect (no "Leave call") — the server only learns via the
      // socket "disconnect" event, exactly like a WhatsApp in-app-browser ->
      // Chrome/Safari handoff or the app being backgrounded/killed. No live
      // socket remains for guest1's guestId at all, so this is the "dead
      // seat, no wait" path — see e3 for the "frozen but still connected"
      // path, which does wait out the ~3s presence check.
      const startedAt = Date.now();
      await guest1.context.close();

      // A brand-new browser context has no localStorage for this roomId, so
      // it mints a completely different guestId automatically — simulating
      // the same human opening the link in a different browser/app.
      const guest2 = await newParty(browser, "guest2", null, baseURL);
      try {
        await joinAsGuest(guest2, roomId, "Guest E1b");
        await expect(
          guest2.page.locator("h2", { hasText: "Can't join this meeting" }),
          "a guest joining with a fresh guestId was wrongly rejected as room full",
        ).toBeHidden({ timeout: 5_000 });
        await waitForVideoFlowing(guest2.page, { timeoutMs: 40_000, label: "guest2 (new guestId)" });
        const takeoverMs = Date.now() - startedAt;
        // Instant takeover — no presence-check wait needed for a seat with
        // no live socket at all. Compared against THIS RUN's own baseline
        // join time (not an absolute constant): a dead-seat takeover must
        // not cost meaningfully more than an ordinary join already does —
        // the ~3s presence-check budget is the thing it must NOT be paying,
        // whatever the machine's current baseline happens to be.
        expect(
          takeoverMs,
          `takeover (${takeoverMs}ms) should track this run's own baseline join time ` +
            `(${baselineJoinMs}ms), not add the ~3s presence-check budget on top of it`,
        ).toBeLessThan(baselineJoinMs + 3_000);
        await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host (after guest2 rejoins)" });
      } finally {
        await writeLogs("e1-different-guestid", host, guest2);
        await guest2.context.close();
      }
    } finally {
      await host.context.close();
    }
  });

  test("e3: guest's tab freezes during the presence check — seat is taken over after ~3s, frozen tab shows the message once it wakes", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest1 = await newParty(browser, "guest1", null, baseURL);
    let guest2;
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host E3"), joinAsGuest(guest1, roomId, "Guest E3a")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest1.page, { timeoutMs: 20_000, label: "guest1" }),
      ]);

      // Freeze guest1's JS main thread so it genuinely cannot ack a
      // presence-ping — its WebSocket connection stays fully open the whole
      // time (unlike guest1.context.close() in e1, which tears the
      // connection down entirely — the "dead socket, no wait" path). This is
      // a faithful stand-in for a backgrounded/frozen tab: the transport is
      // alive, but nothing running in the page can respond right now.
      //
      // Long enough to comfortably outlast guest2's own page-load/socket-
      // connect time PLUS the ~3s presence-check itself — a shorter freeze
      // can finish before the server-side check even starts, in which case
      // guest1 acks normally and this test would wrongly look like it
      // passed via the "genuinely full" path instead of exercising the
      // takeover at all. Sized generously (not just for the 2-4s page-load
      // observed on a quiet machine) since this whole join pipeline has been
      // observed taking well into the double-digit seconds under heavy
      // concurrent test-suite load — the busy-wait itself is immune to that
      // load (it targets real wall-clock time), so erring long here costs
      // only this test's own duration, never correctness.
      const freezeGuest1 = guest1.page.evaluate(() => {
        const start = Date.now();
        while (Date.now() - start < 18_000) {
          /* busy-wait: blocks this page's event loop only */
        }
      });

      guest2 = await newParty(browser, "guest2", null, baseURL);
      const startedAt = Date.now();
      await joinAsGuest(guest2, roomId, "Guest E3b");
      await expect(
        guest2.page.locator("h2", { hasText: "Can't join this meeting" }),
        "a guest joining while the old tab is merely frozen (not dead) was wrongly rejected as room full",
      ).toBeHidden({ timeout: 5_000 });
      await waitForVideoFlowing(guest2.page, {
        timeoutMs: 45_000,
        label: "guest2 (after presence-check takeover)",
      });
      // Must have actually waited for the presence check (not taken the
      // instant dead-seat path) — loose lower bound, not a tight timing
      // assertion, just enough to catch "always instant" as a regression.
      expect(
        Date.now() - startedAt,
        "join should take at least as long as one presence check, not be instant",
      ).toBeGreaterThan(2000);
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host (after guest2 takes over)" });

      // Let guest1's page resume, then it should show why it lost its seat
      // — the message was delivered to the browser while frozen (the
      // network layer buffers it independently of the page's JS), it just
      // couldn't be dispatched/rendered until the main thread was free.
      await freezeGuest1;
      await expect(
        guest1.page.locator(".hc-vc__gate p"),
        "the tab that lost its seat should show why",
      ).toContainText("This call is now open in another browser or device.", { timeout: 10_000 });
    } finally {
      await writeLogs("e3-frozen-tab-takeover", host, guest1, ...(guest2 ? [guest2] : []));
      await host.context.close();
      await guest1.context.close();
      if (guest2) await guest2.context.close();
    }
  });

  test("e2: guest opens the link in a second tab — original tab evicted, new tab takes the seat (not room full)", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host E2"), joinAsGuest(guest, roomId, "Guest E2")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      // Same browser context => same localStorage => same guestId, just a
      // second tab — the server's duplicate-session eviction path, not a
      // brand-new participant.
      const secondTab = await guest.context.newPage();
      await secondTab.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      await secondTab.getByLabel("Your name").fill("Guest E2 tab2");
      await secondTab.getByRole("button", { name: "Join now" }).click();

      await expect(guest.page.getByText(/opened in another tab/i)).toBeVisible({ timeout: 10_000 });
      await waitForVideoFlowing(secondTab, { timeoutMs: 20_000, label: "guest second tab" });
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host (after guest tab switch)" });
      await secondTab.close();
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test("f: a real third person is rejected while host and guest are both live", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    const third = await newParty(browser, "third", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host F"), joinAsGuest(guest, roomId, "Guest F")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await joinAsGuest(third, roomId, "Third F");
      // Scoped to the error gate specifically (not "p" generally) — the
      // in-call "waiting for peer" UI also renders <p> elements, and a plain
      // "p" locator matches those too while the direct-room-error socket
      // event is still in flight, which is a strict-mode violation rather
      // than a real assertion failure.
      await expect(
        third.page.locator("h2", { hasText: "Can't join this meeting" }),
        "third person should land on the rejection gate",
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        third.page.locator(".hc-vc__gate p"),
        "third person should see a clear rejection message",
      ).toContainText("This meeting already has two participants.");
    } finally {
      await writeLogs("f-third-person-rejected", third);
      await host.context.close();
      await guest.context.close();
      await third.context.close();
    }
  });

  test("g1: host refreshes mid-call — both recover", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host G1"), joinAsGuest(guest, roomId, "Guest G1")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await host.page.reload({ waitUntil: "domcontentloaded" });
      await host.page.getByLabel("Your name").fill("Host G1");
      await host.page.getByRole("button", { name: "Join now" }).click();
      await bothRecovered(host, guest, 30_000, "after host refresh");
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test("g2: host leaves and rejoins — video resumes", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host G2"), joinAsGuest(guest, roomId, "Guest G2")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);
      await host.page.getByTitle("Leave call").click();
      await host.page.locator(".hc-vc__confirm-btn--danger").click();
      await expect(host.page.locator("h2", { hasText: "Call ended" })).toBeVisible({ timeout: 10_000 });

      await joinAsGuest(host, roomId, "Host G2 rejoin");
      await bothRecovered(host, guest, 30_000, "after host rejoin");
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test("h: call end — clean cleanup on both sides", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host H"), joinAsGuest(guest, roomId, "Guest H")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await guest.page.getByTitle("Leave call").click();
      await guest.page.locator(".hc-vc__confirm-btn--danger").click();
      await expect(guest.page.locator("h2", { hasText: "Call ended" })).toBeVisible({ timeout: 10_000 });

      const tracksStillLive = await guest.page.evaluate(() => {
        const pcs = (window.__e2e && window.__e2e.pcs) || [];
        const pc = pcs[pcs.length - 1];
        if (!pc) return false;
        return pc.getSenders().some((s) => s.track && s.track.readyState === "live");
      });
      expect(tracksStillLive, "a local track is still live after Leave Call").toBe(false);

      // Broader than the getSenders() check above: also catches a track
      // that was never attached to the peer connection at all, e.g. the
      // always-enabled clone setupMutedReminderMeter keeps for the "You are
      // muted" reminder — a leaked clone there is exactly what would leave
      // the browser's mic-in-use indicator lit after the call ends.
      const stillLive = await liveMediaTracks(guest.page);
      expect(stillLive, "no MediaStreamTrack (real or cloned) should still be live after Leave Call").toEqual([]);

      const pcClosed = await guest.page.evaluate(() => {
        const pcs = (window.__e2e && window.__e2e.pcs) || [];
        const pc = pcs[pcs.length - 1];
        return !pc || pc.signalingState === "closed";
      });
      expect(pcClosed, "peer connection closed after Leave Call").toBe(true);

      await expect(host.page.getByText(/left|waiting/i).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  });

  test("i1: opening an EXPIRED link shows a clear message, no crash", async ({ browser, baseURL }) => {
    const expiredRoomId = await freshRoom({ expiresInMs: -60_000 }); // already in the past
    const party = await newParty(browser, "expired", null, baseURL);
    try {
      await party.page.goto(`/direct-video-call/${expiredRoomId}`, {
        timeout: 20_000,
        waitUntil: "domcontentloaded",
      });
      await expect(party.page.locator("p")).toContainText("This meeting link has expired.", {
        timeout: 10_000,
      });
      expect(await party.logs.count(/pageerror/), "no page errors").toBe(0);
    } finally {
      await party.context.close();
    }
  });

  test("i2: opening a CLOSED link shows a clear message, no crash", async ({ browser, baseURL }) => {
    const closedRoomId = await freshRoom({ status: "closed" });
    const party = await newParty(browser, "closed", null, baseURL);
    try {
      await party.page.goto(`/direct-video-call/${closedRoomId}`, {
        timeout: 20_000,
        waitUntil: "domcontentloaded",
      });
      await expect(party.page.locator("p")).toContainText("This meeting has ended.", { timeout: 10_000 });
      expect(await party.logs.count(/pageerror/), "no page errors").toBe(0);
    } finally {
      await party.context.close();
    }
  });

  test("i3: opening a NONEXISTENT room id shows a clear message, no crash", async ({ browser, baseURL }) => {
    const party = await newParty(browser, "missing", null, baseURL);
    try {
      await party.page.goto(`/direct-video-call/${"a".repeat(32)}`, {
        timeout: 20_000,
        waitUntil: "domcontentloaded",
      });
      await expect(party.page.locator("p")).toContainText("This meeting link is invalid.", {
        timeout: 10_000,
      });
      expect(await party.logs.count(/pageerror/), "no page errors").toBe(0);
    } finally {
      await party.context.close();
    }
  });

  test("j1: WhatsApp in-app browser UA shows the banner, Join still works, call connects", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    // A real WhatsApp-for-Android in-app browser UA token.
    const guest = await newParty(browser, "guest", null, baseURL, {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.24.76",
    });
    try {
      await guest.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      await expect(guest.page.locator(".dvcall-inapp-banner")).toBeVisible({ timeout: 10_000 });
      await expect(guest.page.getByText(/WhatsApp browser/i)).toBeVisible();
      // Android UA => the "Open in Chrome" intent link should be offered too.
      await expect(guest.page.getByRole("link", { name: "Open in Chrome" })).toBeVisible();

      // Never blocks joining.
      await guest.page.getByLabel("Your name").fill("Guest WA");
      await guest.page.getByRole("button", { name: "Join now" }).click();

      await joinAsGuest(host, roomId, "Host WA");
      await waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest (WhatsApp UA)" });
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" });
    } finally {
      await writeLogs("j1-whatsapp-ua", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("j2: Instagram (iOS) in-app browser UA shows copy-link guidance, banner is dismissible", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const guest = await newParty(browser, "guest", null, baseURL, {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.114",
    });
    try {
      await guest.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      const banner = guest.page.locator(".dvcall-inapp-banner");
      await expect(banner).toBeVisible({ timeout: 10_000 });
      // iOS: no forced-open mechanism exists — copy-link + instructions only.
      await expect(guest.page.getByRole("link", { name: "Open in Chrome" })).toHaveCount(0);
      await expect(guest.page.getByText(/paste the link into safari/i)).toBeVisible();

      await guest.page.locator(".dvcall-inapp-banner__dismiss").click();
      await expect(banner).toBeHidden();
    } finally {
      await guest.context.close();
    }
  });

  test("k1: mic level meter responds to the fake audio device during the pre-join preview", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const party = await newParty(browser, "guest", null, baseURL);
    try {
      await party.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      // Playwright's fake audio device emits a synthetic tone — the meter's
      // fill width should move off zero within a few seconds.
      const fill = party.page.locator(".dvcall-mic-meter__fill");
      await expect(fill).toBeVisible({ timeout: 10_000 });
      await expect
        .poll(
          async () => {
            const style = await fill.getAttribute("style");
            const match = style && style.match(/width:\s*(\d+)%/);
            return match ? Number(match[1]) : 0;
          },
          { timeout: 8_000, message: "mic level meter never moved off zero" },
        )
        .toBeGreaterThan(0);
    } finally {
      await party.context.close();
    }
  });

  test("k2: pre-join network check shows a result without blocking anything", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const party = await newParty(browser, "guest", null, baseURL);
    try {
      await party.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      await expect(party.page.locator(".dvcall-network-check")).toBeVisible({ timeout: 10_000 });
      await expect(party.page.locator(".dvcall-network-check")).toContainText(/Reachable/i);
    } finally {
      await party.context.close();
    }
  });

  test("k3: Join now still works when /ice-servers is slow", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await guest.page.route("**/api/direct-video-room/*/ice-servers", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 8_000));
        await route.continue();
      });
      await guest.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      await guest.page.getByLabel("Your name").fill("Guest K3");
      // "Join now" is clickable immediately — never disabled while the
      // network check (or the real ICE-config fetch it shares a route
      // with) is still pending.
      await expect(guest.page.getByRole("button", { name: "Join now" })).toBeEnabled();
      await guest.page.getByRole("button", { name: "Join now" }).click();

      await joinAsGuest(host, roomId, "Host K3");
      await waitForVideoFlowing(guest.page, { timeoutMs: 30_000, label: "guest (slow /ice-servers)" });
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" });
    } finally {
      await writeLogs("k3-slow-ice-servers", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("k4: Join now still works when /ice-servers is down", async ({ browser, baseURL }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await guest.page.route("**/api/direct-video-room/*/ice-servers", (route) => route.abort());
      await guest.page.goto(`/direct-video-call/${roomId}`, { timeout: 20_000, waitUntil: "domcontentloaded" });
      await expect(guest.page.locator(".dvcall-network-check--error")).toBeVisible({ timeout: 10_000 });

      await guest.page.getByLabel("Your name").fill("Guest K4");
      await guest.page.getByRole("button", { name: "Join now" }).click();

      await joinAsGuest(host, roomId, "Host K4");
      // Falls back to the static/STUN config in fetchDirectRoomIceConfig —
      // still connects on this test's unrestricted network.
      await waitForVideoFlowing(guest.page, { timeoutMs: 30_000, label: "guest (/ice-servers down)" });
      await waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" });
    } finally {
      await writeLogs("k4-ice-servers-down", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("m1: peer mic/camera badges — toggle shows on the other side, late joiner sees correct state", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await joinAsGuest(host, roomId, "Host M1");
      // Host mutes/cam-off BEFORE the guest ever joins — the guest (a late
      // joiner) must see the correct state immediately on arrival, not a
      // stale "on" default.
      await host.page.getByTitle("Mute microphone").click();
      await host.page.getByTitle("Turn camera off").click();

      await joinAsGuest(guest, roomId, "Guest M1");
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      await expect(guest.page.getByText(/Host M1's mic is off/i)).toBeVisible({ timeout: 10_000 });
      await expect(guest.page.getByText(/Host M1's camera is off/i)).toBeVisible({ timeout: 10_000 });

      // Host un-mutes — the mic badge must clear on the guest's side, no
      // flicker, and the still-off camera badge must remain.
      await host.page.getByTitle("Unmute").click();
      await expect(guest.page.getByText(/Host M1's mic is off/i)).toBeHidden({ timeout: 10_000 });
      await expect(guest.page.getByText(/Host M1's camera is off/i)).toBeVisible();

      // Host turns the camera back on — that badge clears too.
      await host.page.getByTitle("Turn camera on").click();
      await expect(guest.page.getByText(/Host M1's camera is off/i)).toBeHidden({ timeout: 10_000 });
    } finally {
      await writeLogs("m1-peer-media-badges", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });

  test("m2: 'You are muted' toast appears when speaking while muted, not when unmuted", async ({
    browser,
    baseURL,
  }) => {
    const roomId = await freshRoom();
    const host = await newParty(browser, "host", null, baseURL);
    const guest = await newParty(browser, "guest", null, baseURL);
    try {
      await Promise.all([joinAsGuest(host, roomId, "Host M2"), joinAsGuest(guest, roomId, "Guest M2")]);
      await Promise.all([
        waitForVideoFlowing(host.page, { timeoutMs: 20_000, label: "host" }),
        waitForVideoFlowing(guest.page, { timeoutMs: 20_000, label: "guest" }),
      ]);

      // Not muted yet — the fake device's tone must NOT trigger the toast.
      await host.page.waitForTimeout(3_000);
      await expect(host.page.locator(".dvcall-muted-toast")).toBeHidden();

      // Mute — the same fake-device tone ("speaking") must now trigger it,
      // reading levels off the always-enabled clone (see
      // setupMutedReminderMeter), not the now-disabled real track. Generous
      // timeout: the sustain check is a decaying credit, not a strict
      // every-frame timer (see MUTED_REMINDER_SUSTAIN_MS's comment) — real
      // speech has a much higher loud/quiet duty cycle than this synthetic
      // test tone, so real wall-clock time to trigger can run well past the
      // nominal 1s sustain window here specifically.
      await host.page.getByTitle("Mute microphone").click();
      await expect(host.page.locator(".dvcall-muted-toast")).toBeVisible({ timeout: 15_000 });
      await expect(host.page.getByText(/You're muted/i)).toBeVisible();

      // Never sent to the peer or server — the guest's UI has no such toast.
      await expect(guest.page.locator(".dvcall-muted-toast")).toHaveCount(0);
    } finally {
      await writeLogs("m2-muted-toast", host, guest);
      await host.context.close();
      await guest.context.close();
    }
  });
});
