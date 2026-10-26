// Records the admin sidebar's menu as the browser draws it: every item and submenu entry, in order, with where each one
// goes, for each role. Used to prove a restyle of the sidebar left the menu exactly as it was.
//   node tests/ui-baseline/sidebarItems.mjs --out ../docs/ui-baseline/sidebar-items.json     save
//   node tests/ui-baseline/sidebarItems.mjs --compare ../docs/ui-baseline/sidebar-items.json  exit 1 if it differs
// Run from frontend/. "livechat" = the build with VITE_LIVECHAT_ENABLED=true (the .env default); "nolivechat" = without.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { findBrowser } from "../e2e/adminAppointments/helpers.mjs";
import stubContexts from "./stubContexts.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function record(liveChat) {
  const vite = await createServer({
    root: frontendRoot,
    logLevel: "silent",
    plugins: [stubContexts()],
    define: { "import.meta.env.VITE_LIVECHAT_ENABLED": JSON.stringify(liveChat ? "true" : "false") },
    server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
    optimizeDeps: { entries: ["tests/ui-baseline/harness/index.html"] },
  });
  await vite.listen();
  const base = vite.resolvedUrls.local[0].replace(/\/$/, "");
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  const result = {};
  try {
    for (const role of ["admin", "superadmin", "paymentadmin"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: url.pathname === "/api/admin/bookings" ? JSON.stringify({ items: [], counts: {}, total: 0, totalPages: 1, page: 1 }) : "[]" });
        return route.continue();
      });
      await page.goto(`${base}/tests/ui-baseline/harness/index.html?screen=${role}`);
      await page.waitForSelector("html[data-ready='1']");
      await page.waitForSelector("#ad-sidebar");
      await page.waitForLoadState("networkidle");
      result[role] = await page.evaluate(() => {
        const label = (el) => {
          const copy = el.cloneNode(true);
          copy.querySelectorAll(".ash-nav-arrow, .ash-nav-count, .ash-nav-dot").forEach((n) => n.remove());
          return copy.textContent.replace(/\s+/g, " ").trim();
        };
        const where = (el) => el.getAttribute("href") || null;
        const out = [];
        for (const node of document.querySelector("#ad-sidebar nav").children) {
          const parent = node.querySelector(":scope > button");
          if (parent) {
            out.push({ label: label(parent), children: [...node.querySelectorAll("a")].map((a) => ({ label: label(a), href: where(a), newTab: a.target === "_blank" })) });
          } else {
            out.push({ label: label(node), href: where(node), newTab: node.target === "_blank" });
          }
        }
        return out;
      });
      await context.close();
    }
  } finally {
    await browser.close();
    await vite.close();
  }
  return result;
}

const all = { livechat: await record(true), nolivechat: await record(false) };
const outFile = arg("--out");
const cmpFile = arg("--compare");
if (outFile) {
  fs.writeFileSync(path.resolve(outFile), JSON.stringify(all, null, 2) + "\n");
  for (const [mode, roles] of Object.entries(all)) for (const [role, items] of Object.entries(roles)) console.log(`${mode} ${role}: ${items.map((i) => i.label).join(" | ")}`);
  console.log(`saved ${path.resolve(outFile)}`);
} else if (cmpFile) {
  const saved = JSON.parse(fs.readFileSync(path.resolve(cmpFile), "utf8"));
  let bad = 0;
  for (const mode of Object.keys(saved)) {
    for (const role of Object.keys(saved[mode])) {
      const same = JSON.stringify(saved[mode][role]) === JSON.stringify(all[mode][role]);
      console.log(`${same ? "same     " : "DIFFERENT"}  ${mode} ${role}: ${all[mode][role].length} entries`);
      if (!same) {
        bad++;
        console.log("  before:", JSON.stringify(saved[mode][role]));
        console.log("  after: ", JSON.stringify(all[mode][role]));
      }
    }
  }
  process.exit(bad ? 1 : 0);
} else {
  console.log(JSON.stringify(all, null, 2));
}
