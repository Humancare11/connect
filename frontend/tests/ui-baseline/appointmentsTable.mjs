// Screenshots of the admin Appointments page inside the real admin layout (sidebar and header included), as an admin and as
// a super admin, at 1920, 1440, 1280, 1100 and 390px, with the checks the redesign promises:
//   no sideways scroll, no clipped date / fee / action cell, every row's buttons on one line, the fixed column widths.
//   node tests/ui-baseline/appointmentsTable.mjs [--out ../docs/ui-after/appointments-table]
// Run from frontend/. Exits 1 if a check fails. The rows are made up (the reference page's rows plus a few long ones).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { findBrowser } from "../e2e/adminAppointments/helpers.mjs";
import stubContexts from "./stubContexts.mjs";
import { FIXED_WIDTHS, measureTable } from "./tableChecks.mjs";
import { items, counts } from "./appointmentFixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outArg = process.argv.indexOf("--out");
const outDir = path.resolve(outArg > 0 ? process.argv[outArg + 1] : "../docs/ui-after/appointments-table");
fs.mkdirSync(outDir, { recursive: true });
// --content-out DIR also saves the page-content area alone (no sidebar, no top bar), for before/after comparisons.
const contentArg = process.argv.indexOf("--content-out");
const contentDir = contentArg > 0 ? path.resolve(process.argv[contentArg + 1]) : null;
if (contentDir) fs.mkdirSync(contentDir, { recursive: true });

const ROLES = ["admin", "superadmin"];
// --widths 1920,1440,1280,390 limits the widths (default: all five).
const widthsArg = process.argv.indexOf("--widths");
const WIDTHS = widthsArg > 0 ? process.argv[widthsArg + 1].split(",").map(Number) : [1920, 1440, 1280, 1100, 390];


const vite = await createServer({
  root: frontendRoot,
  logLevel: "silent",
  plugins: [stubContexts()],
  server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
  optimizeDeps: { entries: ["tests/ui-baseline/harness/index.html"] },
});
await vite.listen();
const base = vite.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ["--disable-lcd-text", "--force-color-profile=srgb", "--font-render-hinting=none"] });
const failures = [];
const lines = [];
try {
  for (const role of ROLES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/api/admin/bookings") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items, counts, total: items.length, totalPages: 1, page: 1 }) });
        }
        if (url.pathname === "/api/call-reports/summaries") {
          // the Call column: a few bookings with a recorded call, the rest none
          const summaries = {
            [items[3].id]: { connected: true, durationLabel: "12m 4s", hasProblem: false, problemCount: 0 },
            [items[4].id]: { connected: true, durationLabel: "3m 10s", hasProblem: true, problemCount: 2, firstProblem: "Video froze" },
            [items[6].id]: { connected: false, durationLabel: "0s", hasProblem: false, problemCount: 0 },
          };
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summaries }) });
        }
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return route.continue();
      });
      await page.goto(`${base}/tests/ui-baseline/harness/index.html?screen=${role}&path=${encodeURIComponent("/admin-dashboard/appointments?tab=all")}`);
      await page.waitForSelector("html[data-ready='1']");
      await page.waitForSelector("table.adp-bk tbody tr");
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      const m = await measureTable(page);
      const expectCards = width - 260 < 1000 && width > 768 ? true : width <= 768;
      const problems = [];
      if (!m) problems.push("no table");
      else {
        if ((m.layout === "cards") !== expectCards) problems.push(`layout is ${m.layout}`);
        if (m.docOverflow > 1) problems.push(`page scrolls sideways by ${m.docOverflow}px`);
        if (m.wrapOverflow > 1) problems.push(`table scrolls sideways by ${m.wrapOverflow}px`);
        if (m.clipped.length) problems.push(`clipped: ${m.clipped.join("; ")}`);
        if (m.multiLine.length && m.layout === "table") problems.push(`actions on two lines: ${m.multiLine.join("; ")}`);
        if (m.layout === "table") {
          for (const c of m.columns) if (FIXED_WIDTHS[c.name] && Math.abs(c.width - FIXED_WIDTHS[c.name]) > 1) problems.push(`${c.name} is ${c.width}px, wanted ${FIXED_WIDTHS[c.name]}`);
          const hasSource = m.columns.some((c) => c.name === "Source page");
          if (!hasSource) problems.push(`Source page column hidden at a table area of ${m.wrapWidth}px`);
          const hasCall = m.columns.some((c) => c.name === "Call");
          if (hasCall !== m.wrapWidth >= 1280) problems.push(`Call column ${hasCall ? "shown" : "hidden"} at a table area of ${m.wrapWidth}px`);
          const hasBooked = m.columns.some((c) => c.name === "Booked");
          if (hasBooked !== m.wrapWidth >= 1180) problems.push(`Booked column ${hasBooked ? "shown" : "hidden"} at a table area of ${m.wrapWidth}px`);
          const shared = m.columns.filter((c) => ["Patient", "Doctor", "Source page"].includes(c.name)).map((c) => c.width);
          if (Math.max(...shared) - Math.min(...shared) > 1) problems.push(`shared columns unequal: ${shared}`);
        }
      }
      const file = path.join(outDir, `${role}-${width}.png`);
      await page.screenshot({ path: file });
      if (contentDir) await page.locator(".ad-content").screenshot({ path: path.join(contentDir, `${role}-${width}.png`) });
      const sharedWidths = m?.columns.filter((c) => ["Patient", "Doctor", "Source page"].includes(c.name)).map((c) => Math.round(c.width));
      lines.push(`${role.padEnd(10)} ${String(width).padStart(4)}px  ${(m?.layout || "-").padEnd(5)}  table area ${m?.wrapWidth}px  ${sharedWidths?.length ? `Patient/Doctor${sharedWidths.length === 3 ? "/Source page" : ""} ${sharedWidths[0]}px each` : ""}  ${problems.length ? "FAIL " + problems.join(" | ") : "ok"}`);
      if (problems.length) failures.push(`${role} ${width}px: ${problems.join(" | ")}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await vite.close();
}
console.log(lines.join("\n"));
console.log(failures.length ? `\n${failures.length} failing` : "\nall checks pass");
console.log(`screenshots in ${outDir}`);
process.exit(failures.length ? 1 : 0);
