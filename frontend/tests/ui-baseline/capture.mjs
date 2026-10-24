// Screenshots of the dashboards' layouts (real components, stubbed sign-in and API) at desktop and phone widths, and
// a pixel-exact comparison against a saved set.
//
//   node tests/ui-baseline/capture.mjs --out ../docs/ui-baseline            save screenshots + hashes.json
//   node tests/ui-baseline/capture.mjs --out ../docs/ui-after
//   --content-only   save/compare only the page-content area of admin pages (the "+content" shots), not the full screens
//   node tests/ui-baseline/capture.mjs --compare ../docs/ui-baseline [--only doctor,patient,...]
//       renders into a temp folder and exits 1 if any of the chosen screens differs from the saved hashes
//
// Run from frontend/. Needs playwright-core, vite and a Chromium (same lookup as the admin Appointments browser tests).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { findBrowser } from "../e2e/adminAppointments/helpers.mjs";
import stubContexts from "./stubContexts.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SCREENS = [
  { name: "admin", note: "Admin panel, signed in as an admin (real Appointments page)" },
  { name: "admin", drawer: true, phoneOnly: true, note: "Admin panel on a phone with the menu drawer open" },
  { name: "superadmin", drawer: true, phoneOnly: true, note: "Admin panel as a super admin on a phone with the menu drawer open" },
  { name: "superadmin", note: "Admin panel, signed in as a super admin" },
  { name: "paymentadmin", note: "Admin panel, signed in as a payment admin" },
  { name: "adminpage-dashboard", note: "Admin Dashboard page (not the Appointments page)" },
  { name: "adminpage-users", note: "Manage Users page" },
  { name: "adminpage-tickets", note: "Support Tickets page" },
  { name: "adminpage-doctors", note: "Our Doctors page" },
  { name: "portal", note: "Super Admin Portal (/superadmin-dashboard)" },
  { name: "employee", note: "Employee admin layout" },
  { name: "partner", note: "Partner layout" },
  { name: "doctor", note: "Doctor layout" },
  { name: "patient", note: "Patient layout" },
  { name: "doctor", adminCss: true, note: "Doctor layout with the admin stylesheets already loaded (leak check)" },
  { name: "patient", adminCss: true, note: "Patient layout with the admin stylesheets already loaded (leak check)" },
];
const WIDTHS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
];
const fileKey = (s, w) => `${s.name}${s.adminCss ? "+admincss" : ""}${s.drawer ? "+drawer" : ""}-${w.label}`;

const CONTENT_ONLY = process.argv.includes("--content-only");
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const emptyList = { items: [], counts: { all: 0, upcoming: 0, assigned: 0, pending: 0, confirmed: 0, complete: 0, cancelled: 0, testing: 0 }, total: 0, totalPages: 1, page: 1 };
function answerApi(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  if (/\/api\/doctor\/enrollment\//.test(p)) return json(route, { approvalStatus: "approved", formCompleted: true, isOnline: true });
  if (p === "/api/admin/bookings") return json(route, emptyList);
  if (/alerts\/unread-count/.test(p)) return json(route, { count: 0 });
  return json(route, []);
}

async function render(outDir, only) {
  fs.mkdirSync(outDir, { recursive: true });
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
  const hashes = {};
  const errors = [];
  try {
    for (const screen of SCREENS) {
      if (only && !only.includes(screen.name)) continue;
      for (const w of WIDTHS) {
        if (screen.phoneOnly && w.width > 500) continue;
        const context = await browser.newContext({ viewport: { width: w.width, height: w.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(`${fileKey(screen, w)}: ${e}`));
        // Only the harness origin is reachable; every API call is answered here, never by a real server.
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== base) return route.abort();
          if (url.pathname.startsWith("/api/")) return answerApi(route);
          return route.continue();
        });
        await page.goto(`${base}/tests/ui-baseline/harness/index.html?screen=${screen.name}${screen.adminCss ? "&adminCss=1" : ""}`);
        await page.waitForSelector("html[data-ready='1']");
        await page.waitForLoadState("networkidle");
        if (screen.drawer) await page.click(".ad-menu-btn");
        await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        const file = path.join(outDir, `${fileKey(screen, w)}.png`);
        const hashOf = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
        if (!CONTENT_ONLY) {
          await page.screenshot({ path: file });
          hashes[fileKey(screen, w)] = hashOf(file);
        }
        // The page-content area on its own (admin pages), so a change to the sidebar or top bar can be shown to leave it alone.
        if (!screen.drawer && /^(admin|superadmin|paymentadmin)/.test(screen.name) && (await page.locator(".ad-content").count()) === 1) {
          const contentFile = path.join(outDir, `${fileKey(screen, w)}+content.png`);
          await page.locator(".ad-content").screenshot({ path: contentFile });
          hashes[`${fileKey(screen, w)}+content`] = hashOf(contentFile);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await vite.close();
  }
  return { hashes, errors };
}

// Chromium re-renders the SAME page with a few pixels different each time: gradients and blurs move by 1-2 levels (out
// of 255) and anti-aliased edges of rounded, translucent boxes by up to about 16 (measured by comparing re-renders of
// unchanged code). A saved hash that no longer matches is therefore compared pixel by pixel. A screen counts as
// unchanged only if no pixel moved by more than BIG and at most FEW_MOVED pixels moved at all by more than NOISE.
// A real change (a colour, a shifted line of text, a new border) moves hundreds or thousands of pixels by far more.
const NOISE = 2;
const BIG = 24;
const FEW_MOVED = 150;
async function pixelsMoved(fileA, fileB) {
  let sharp;
  try {
    sharp = createRequire(path.join(frontendRoot, "..", "backend", "package.json"))("sharp");
  } catch {
    return null;
  }
  const [A, B] = await Promise.all([fileA, fileB].map((f) => sharp(f).raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { count: Infinity, max: 255, big: Infinity };
  let count = 0;
  let max = 0;
  let big = 0;
  const { channels } = A.info;
  for (let i = 0; i < A.data.length; i += channels) {
    let d = 0;
    for (let c = 0; c < channels; c++) d = Math.max(d, Math.abs(A.data[i + c] - B.data[i + c]));
    if (d > NOISE) count++;
    if (d > BIG) big++;
    max = Math.max(max, d);
  }
  return { count, max, big };
}

const only = arg("--only")?.split(",");
const compareDir = arg("--compare");
if (compareDir) {
  const saved = JSON.parse(fs.readFileSync(path.join(path.resolve(compareDir), "hashes.json"), "utf8"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-compare-"));
  const { hashes, errors } = await render(tmp, only);
  const different = [];
  for (const k of Object.keys(hashes)) {
    if (hashes[k] === saved[k]) {
      console.log(`identical  ${k}`);
      continue;
    }
    const moved = await pixelsMoved(path.join(path.resolve(compareDir), `${k}.png`), path.join(tmp, `${k}.png`));
    if (moved && moved.big === 0 && moved.count <= FEW_MOVED) console.log(`identical  ${k}  (render noise only: ${moved.count} edge pixels moved by more than ${NOISE}, at most ${moved.max}/255)`);
    else {
      different.push(k);
      console.log(`DIFFERENT  ${k}${moved ? `  (${moved.count} pixels moved by more than ${NOISE}, ${moved.big} by more than ${BIG}; up to ${moved.max}/255)` : ""}`);
    }
  }
  if (errors.length) console.log("page errors:\n" + errors.join("\n"));
  console.log(different.length ? `\n${different.length} of ${Object.keys(hashes).length} differ (images in ${tmp})` : `\nall ${Object.keys(hashes).length} identical`);
  process.exit(different.length ? 1 : 0);
} else {
  const out = path.resolve(arg("--out") || "../docs/ui-baseline");
  const { hashes, errors } = await render(out, only);
  // With --only, add to the hashes already saved instead of replacing them.
  const hashFile = path.join(out, "hashes.json");
  const kept = only && fs.existsSync(hashFile) ? JSON.parse(fs.readFileSync(hashFile, "utf8")) : {};
  fs.writeFileSync(hashFile, JSON.stringify({ ...kept, ...hashes }, null, 2) + "\n");
  console.log(`saved ${Object.keys(hashes).length} screenshots to ${out}`);
  if (errors.length) console.log("page errors:\n" + errors.join("\n"));
}
