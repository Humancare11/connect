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

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outArg = process.argv.indexOf("--out");
const outDir = path.resolve(outArg > 0 ? process.argv[outArg + 1] : "../docs/ui-after/appointments-table");
fs.mkdirSync(outDir, { recursive: true });

const ROLES = ["admin", "superadmin"];
const WIDTHS = [1920, 1440, 1280, 1100, 390];

const hex = (n) => `6a2d30014193e6621459${(0xabbd + n).toString(16)}`;
const R = (n, status, patient, country, doctorName, category, booked, date, time, fee, assignedBy, extra = {}) => ({
  id: hex(n),
  shortId: hex(n).slice(-8).toUpperCase(),
  kind: extra.kind || "appointment",
  status,
  patient: { name: patient, country },
  doctorName,
  category,
  bookedAt: booked,
  consultation: date ? { date, time, timezone: "" } : null,
  fee,
  assignedBy: doctorName ? assignedBy : null,
  isTesting: Boolean(extra.testing),
  originalDoctorName: extra.original || null,
});
const items = [
  R(1, "upcoming", "Test Sujal", "IN", null, "Children & Family", "2026-10-16T08:00:00Z", "2026-10-23", "1:30 AM", 10, null),
  R(2, "upcoming", "kedar", "IN", null, "Chronic Care & Expert Opinion", "2026-10-06T08:00:00Z", "2026-10-06", "1:30 PM", 60, null, { testing: true }),
  R(3, "upcoming", "Priya Nair", "AE", null, "Women's Health", "2026-10-09T08:00:00Z", null, "", 49, null, { kind: "category" }),
  R(4, "assigned", "UatT PatientT ShizukaA", "IN", "TestT Shizuka DoctorR", "Children & Family", "2026-08-03T08:00:00Z", "2026-08-03", "5:40 PM", 110, null),
  R(5, "assigned", "Narayan Mestry", "IN", "Satish Dalvi", "Skin & Hair", "2026-06-13T08:00:00Z", "2026-06-20", "8:30 AM", 100, "admin@gmail.com", { original: "Dr Ananya Rao" }),
  R(6, "assigned", "A Patient With A Really Long Full Name Here", "United Arab Emirates", "Satish Dalvi Technical Team Lead", "General & Everyday Care & Wellbeing Checkups", "2026-06-11T08:00:00Z", "2026-06-26", "8:30 AM", 1499, "administrator.on.duty@humancareconnect.co"),
  R(7, "confirmed", "Rohan Mehta", "IN", "Dr Ananya Rao", "Mental Wellbeing", "2026-10-05T08:00:00Z", "2026-10-28", "11:00 AM", 25, "admin@gmail.com"),
  R(8, "confirmed", "Rachel Secemski", "US", "Martin Perlin", "Travel & Global Care", "2026-10-10T08:00:00Z", "2026-10-16", "9:00 AM", 99, "superadmin@humancare.com"),
  R(9, "pending", "Pam Pending", "IN", "Dr Hidayat Khan", "Children & Family", "2026-10-12T08:00:00Z", "2026-10-30", "4:00 PM", 40, "admin@gmail.com"),
  R(10, "complete", "Satish Dalvi", "IN", "satish dalvi", "Children & Family", "2026-10-01T08:00:00Z", "2026-10-02", "3:30 PM", 1234.5, "admin@gmail.com", { testing: true }),
  R(11, "complete", "Piyush Y.", "GB", "Dr Hidayat Khan", "Children & Family", "2026-09-28T08:00:00Z", "2026-09-30", "7:00 PM", 5, null),
  R(12, "cancelled", "Mahek Test", "IN", "Dr Hidayat Khan", "Chronic Care & Expert Opinion", "2026-09-10T08:00:00Z", "2026-09-10", "4:30 PM", 60, "admin@gmail.com"),
];
const counts = { all: items.length, upcoming: 3, assigned: 3, pending: 1, confirmed: 2, complete: 2, cancelled: 1, testing: 2 };

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
          const hasCategory = m.columns.some((c) => c.name === "Category");
          if (hasCategory !== width - 260 >= 1180) problems.push(`Category column ${hasCategory ? "shown" : "hidden"} at ${width}px`);
          const shared = m.columns.filter((c) => ["Patient", "Doctor", "Category"].includes(c.name)).map((c) => c.width);
          if (Math.max(...shared) - Math.min(...shared) > 1) problems.push(`shared columns unequal: ${shared}`);
        }
      }
      const file = path.join(outDir, `${role}-${width}.png`);
      await page.screenshot({ path: file });
      const sharedWidths = m?.columns.filter((c) => ["Patient", "Doctor", "Category"].includes(c.name)).map((c) => Math.round(c.width));
      lines.push(`${role.padEnd(10)} ${String(width).padStart(4)}px  ${(m?.layout || "-").padEnd(5)}  table area ${m?.wrapWidth}px  ${sharedWidths?.length ? `Patient/Doctor${sharedWidths.length === 3 ? "/Category" : ""} ${sharedWidths[0]}px each` : ""}  ${problems.length ? "FAIL " + problems.join(" | ") : "ok"}`);
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
