// Where the admin panel's page content sits, at several window widths: the first element of the page, the sidebar, and
// whether the page scrolls sideways. Used to show that a restyle of the sidebar and top bar did not move the content.
//   node tests/ui-baseline/measure.mjs [screen]        screen: admin (default), superadmin, paymentadmin
// Run from frontend/. Prints one JSON line per width.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { findBrowser } from "../e2e/adminAppointments/helpers.mjs";
import stubContexts from "./stubContexts.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const screen = process.argv[2] || "admin";
const WIDTHS = [1920, 1440, 1280, 1040, 900, 769, 768, 390];

const vite = await createServer({
  root: frontendRoot,
  logLevel: "silent",
  plugins: [stubContexts()],
  server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
  optimizeDeps: { entries: ["tests/ui-baseline/harness/index.html"] },
});
await vite.listen();
const base = vite.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
const rect = (r) => (r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null);
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname.startsWith("/api/")) {
        const body = url.pathname === "/api/admin/bookings" ? { items: [], counts: {}, total: 0, totalPages: 1, page: 1 } : [];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      }
      return route.continue();
    });
    await page.goto(`${base}/tests/ui-baseline/harness/index.html?screen=${screen}`);
    await page.waitForSelector("html[data-ready='1']");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(".ad-content > *");
    await page.waitForTimeout(300);
    const result = await page.evaluate(() => {
      const box = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
      const content = document.querySelector(".ad-content");
      const first = content?.firstElementChild;
      return {
        page: box(first),
        sidebar: box(document.querySelector("#ad-sidebar")),
        sidebarVisible: !document.querySelector("#ad-sidebar")?.hasAttribute("inert"),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });
    console.log(
      JSON.stringify({
        width,
        page: rect(result.page),
        sidebarRight: result.sidebarVisible && result.sidebar ? Math.round(result.sidebar.right) : null,
        sidebarOnScreen: result.sidebar ? result.sidebar.right > 0 : null,
        sidewaysScroll: result.scrollWidth > result.innerWidth,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
  await vite.close();
}
