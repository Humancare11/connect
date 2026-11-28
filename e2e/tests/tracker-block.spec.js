// No request from a test browser may reach Google Tag Manager or LiveChat (see
// the --host-resolver-rules launch argument in playwright.config.js).
import { test, expect } from "@playwright/test";

const TRACKER = /^https?:\/\/([a-z0-9-]+\.)*(googletagmanager|livechatinc)\.com\//i;

// Everything the context's pages (popups included) try to load from the tracker.
function watchTracker(context) {
  const seen = { attempted: [], failed: [], answered: [] };
  context.on("request", (r) => TRACKER.test(r.url()) && seen.attempted.push(r.url()));
  context.on("requestfailed", (r) => TRACKER.test(r.url()) && seen.failed.push(r.failure()?.errorText || ""));
  context.on("response", (r) => TRACKER.test(r.url()) && seen.answered.push(r.url()));
  return seen;
}

function expectBlocked(seen, label) {
  // An attempt is required, so this cannot pass just because nothing loaded.
  expect(seen.attempted.length, `${label}: the page did try to load the tracker`).toBeGreaterThan(0);
  expect(seen.answered, `${label}: no response may arrive`).toEqual([]);
  expect(seen.failed.length, `${label}: every attempt failed`).toBe(seen.attempted.length);
  for (const error of seen.failed) expect(error).toContain("ERR_NAME_NOT_RESOLVED");
}

async function settle(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
}

test("Google Tag Manager and LiveChat are blocked in pages, popups and extra contexts", async ({ browser, baseURL }) => {
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  const firstSeen = watchTracker(first);
  const secondSeen = watchTracker(second);
  try {
    const page = await first.newPage();
    await page.goto("/");
    await settle(page);
    const [popup] = await Promise.all([
      first.waitForEvent("page"),
      page.evaluate(() => void window.open("/about-us", "_blank")),
    ]);
    await settle(popup);
    const other = await second.newPage();
    await other.goto("/");
    await settle(other);

    expectBlocked(firstSeen, "page and popup");
    expect(firstSeen.attempted.length, "the popup tried too").toBeGreaterThan(1);
    expectBlocked(secondSeen, "second context");
    for (const host of ["googletagmanager.com", "livechatinc.com"]) {
      expect(firstSeen.attempted.some((url) => url.includes(host)), `${host} was tried`).toBe(true);
    }

    // A direct request from page script is refused as well, whatever the path.
    const direct = await page.evaluate(() =>
      fetch("https://www.googletagmanager.com/gtm.js", { mode: "no-cors" }).then(() => "reached", () => "blocked"),
    );
    expect(direct).toBe("blocked");
  } finally {
    await first.close();
    await second.close();
  }
});
