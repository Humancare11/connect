// Screenshots and behaviour checks for the admin panel's sidebar and top bar, for admin, super admin and payment admin.
//   node tests/ui-baseline/adminShell.mjs [--out ../docs/ui-after/shell-v2]
// Screenshots: 1920, 1440, 1280 and 390px, sidebar expanded and collapsed (desktop), the phone drawer open, and the profile
// menu open. Then checks (exit 1 if one fails): collapse and expand, the remembered state, names on hover when collapsed,
// a parent expanding the sidebar, the breadcrumb, the profile menu, the drawer's Escape and backdrop, no sideways scroll,
// the page content never under the sidebar. Run from frontend/. Rows and sign-in are stand-ins (see README).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { findBrowser } from "../e2e/adminAppointments/helpers.mjs";
import stubContexts from "./stubContexts.mjs";
import { items, counts } from "./appointmentFixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outArg = process.argv.indexOf("--out");
const outDir = path.resolve(outArg > 0 ? process.argv[outArg + 1] : "../docs/ui-after/shell-v2");
fs.mkdirSync(outDir, { recursive: true });

const ROLES = ["admin", "superadmin", "paymentadmin"];
const ROLE_BADGE = { admin: "ADMIN", superadmin: "SUPER ADMIN", paymentadmin: "PAYMENT ADMIN" };
const WIDTHS = [1920, 1440, 1280, 390];
const KEY = "hc-admin-sidebar-collapsed";

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
const note = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
};

async function open(role, width, { collapsed = false, screen, route } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(([key, value]) => { try { if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value); } catch { /* none */ } }, [KEY, collapsed ? "1" : "0"]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (r) => {
    const url = new URL(r.request().url());
    if (url.origin !== base) return r.abort();
    if (url.pathname === "/api/admin/bookings") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items, counts, total: items.length, totalPages: 1, page: 1 }) });
    if (url.pathname.startsWith("/api/")) return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    return r.continue();
  });
  const start = route || "/admin-dashboard/appointments?tab=all";
  await page.goto(`${base}/tests/ui-baseline/harness/index.html?screen=${screen || role}&path=${encodeURIComponent(start)}`);
  await page.waitForSelector("html[data-ready='1']");
  await page.waitForSelector(".ash-topbar");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return { context, page, errors };
}

const geometry = (page) =>
  page.evaluate(() => {
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect().toJSON() ?? null;
    return {
      sidebar: box("#ad-sidebar"),
      content: box(".ad-content"),
      topbar: box(".ash-topbar"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

try {
  // ── screenshots ──
  for (const role of ROLES) {
    for (const width of WIDTHS) {
      const states = width > 900 ? ["expanded", "collapsed"] : ["expanded", "drawer"];
      for (const state of states) {
        const { context, page, errors } = await open(role, width, { collapsed: state === "collapsed" });
        if (state === "drawer") await page.click(".ash-menu-btn");
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(outDir, `${role}-${width}-${state === "expanded" && width <= 900 ? "closed" : state}.png`) });
        const g = await geometry(page);
        const label = `${role} ${width}px ${state}`;
        note(g.overflow <= 1, `${label}: no sideways scroll`);
        if (width > 900) {
          const sideRight = g.sidebar.right;
          note(g.content.left >= sideRight - 0.5, `${label}: page content starts right of the sidebar (${Math.round(g.content.left)} >= ${Math.round(sideRight)})`);
          note(Math.round(g.sidebar.width) === (state === "collapsed" ? 76 : width <= 1024 ? 220 : 260), `${label}: sidebar width ${Math.round(g.sidebar.width)}px`);
        }
        note(errors.length === 0, `${label}: no page errors${errors.length ? " " + errors[0] : ""}`);
        await context.close();
      }
    }
    // profile menu open
    const { context, page } = await open(role, 1440);
    await page.click(".ash-chip");
    await page.waitForSelector(".ash-menu");
    await page.screenshot({ path: path.join(outDir, `${role}-1440-profile-menu.png`) });
    const menuText = (await page.locator(".ash-menu").innerText()).replace(/\s+/g, " ");
    note(/Test/.test(menuText) && /example\.test/.test(menuText) && /Sign out/.test(menuText), `${role}: profile menu shows name, email and Sign out ("${menuText}")`);
    note(!/My profile/i.test(menuText), `${role}: no "My profile" (the app has no admin profile page)`);
    note((await page.locator(".ash-role").innerText()).trim() === ROLE_BADGE[role], `${role}: role badge reads ${ROLE_BADGE[role]}`);
    await page.keyboard.press("Escape");
    note((await page.locator(".ash-menu").count()) === 0, `${role}: Escape closes the profile menu`);
    await context.close();
  }

  // ── behaviour (admin, 1440px) ──
  {
    const { context, page } = await open("admin", 1440);
    const side = () => page.locator("#ad-sidebar");
    const w = async () => Math.round((await side().boundingBox()).width);
    note((await w()) === 260, "expanded sidebar is 260px");
    note((await page.locator(".ash-brand-text").innerText()).replace(/\s+/g, " ").includes("ADMIN CONSOLE"), "brand reads Humancare / ADMIN CONSOLE");
    note((await page.locator(".ash-nav .ash-nav-item.active").count()) === 1, "exactly one active page");
    note((await page.locator(".ash-nav .ash-nav-item.active").innerText()).trim() === "Appointments", "the active page is Appointments");
    const bar = await page.locator(".ash-nav .ash-nav-item.active").evaluate((el) => { const s = getComputedStyle(el, "::before"); return [s.width, s.backgroundColor]; });
    note(bar[0] === "3px" && bar[1] === "rgb(165, 180, 252)", `active item has the 3px light-indigo bar (${bar.join(" ")})`);
    note(!(await page.locator(".ash-profile, .ash-profile-name").count()), "no profile block in the sidebar");
    note((await page.locator(".ash-foot .ash-signout").innerText()).trim() === "Sign out", "Sign out sits at the bottom of the sidebar");
    note((await page.locator(".ash-crumb").innerText()).replace(/\s+/g, " ").trim() === "Workspace Appointments", "breadcrumb: Workspace > Appointments");
    note((await page.locator(".ash-topbar").boundingBox()).height === 64, "top bar is 64px");
    note((await page.locator(".ash-menu-btn").isVisible()) === false, "no burger on desktop");
    note((await page.locator("input[type=search], .ash-topbar input").count()) === 0, "no search box in the top bar (the app has no global search to wire it to)");

    // submenu: chevron rotates, thin line
    await page.click('.ash-nav-parent:has-text("Doctors")');
    const sub = page.locator("#ad-submenu-doctors");
    note(await sub.isVisible(), "Doctors submenu opens");
    note((await sub.evaluate((el) => getComputedStyle(el).borderLeftWidth)) === "1px", "submenu has a thin vertical line");
    note((await page.locator('.ash-nav-parent:has-text("Doctors") .ash-nav-arrow').evaluate((el) => getComputedStyle(el).transform)) !== "none", "chevron rotates when open");
    note((await sub.locator(".ash-nav-icon svg").count()) === 2, "sub-items keep their icons");

    // collapse
    await page.click(".ash-collapse");
    await page.waitForTimeout(100);
    note((await w()) === 76, "collapse: sidebar is 76px");
    note(!(await page.locator(".ash-logo").isVisible()), "collapse: the logo hides");
    note((await page.locator(".ash-collapse").getAttribute("aria-label")) === "Expand sidebar", "collapse: the arrow now expands");
    note((await page.evaluate((k) => window.localStorage.getItem(k), KEY)) === "1", "collapsed state is remembered in localStorage");
    const titles = await page.locator(".ash-nav > .ash-nav-item, .ash-nav > .ash-nav-group > .ash-nav-item").evaluateAll((els) => els.map((e) => e.getAttribute("title")));
    note(titles.length >= 10 && titles.every(Boolean), `collapse: every icon has a hover name (${titles.length} items)`);
    const g = await geometry(page);
    note(g.content.left >= 76 && g.content.left < 140, `collapse: page content follows the narrower sidebar (starts at ${Math.round(g.content.left)})`);
    await page.reload();
    await page.waitForSelector(".ash-topbar");
    note((await w()) === 76, "reload: still collapsed");
    // a parent click expands and opens it
    await page.click('.ash-nav-parent[title="Users"]');
    await page.waitForTimeout(100);
    note((await w()) === 260, "clicking a parent in collapsed mode expands the sidebar");
    note(await page.locator("#ad-submenu-users").isVisible(), "…and opens its submenu");
    note((await page.evaluate((k) => window.localStorage.getItem(k), KEY)) === "0", "…and that is remembered too");
    await page.click(".ash-collapse");
    await page.click(".ash-collapse");
    note((await w()) === 260, "the arrow expands it again");

    // breadcrumb for a sub-page
    await context.close();
    const sub2 = await open("admin", 1440, { screen: "adminpage-doctors", route: "/admin-dashboard/our-doctors" });
    note((await sub2.page.locator(".ash-crumb").innerText()).replace(/\s+/g, " ").trim() === "Doctors Our Doctors", "breadcrumb for a sub-page: Doctors > Our Doctors");
    await sub2.page.screenshot({ path: path.join(outDir, "admin-1440-subpage.png") });
    await sub2.context.close();

    // storage that throws must not break the layout
    const broken = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await broken.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
    const bp = await broken.newPage();
    const be = [];
    bp.on("pageerror", (e) => be.push(String(e)));
    await bp.route("**/*", (r) => (new URL(r.request().url()).origin !== base ? r.abort() : new URL(r.request().url()).pathname.startsWith("/api/") ? r.fulfill({ status: 200, contentType: "application/json", body: "[]" }) : r.continue()));
    await bp.goto(`${base}/tests/ui-baseline/harness/index.html?screen=admin`);
    await bp.waitForSelector(".ash-topbar");
    await bp.addStyleTag({ content: "*,*::before,*::after{transition:none!important}" });
    await bp.click(".ash-collapse");
    await bp.waitForTimeout(400);
    note(be.length === 0 && (await bp.locator("#ad-sidebar").boundingBox()).width === 76, `blocked localStorage: the sidebar still works (not remembered) [errors: ${be.join(" | ").slice(0, 300)}; width ${(await bp.locator("#ad-sidebar").boundingBox()).width}]`);
    await broken.close();
  }

  // ── phone drawer ──
  {
    const { context, page } = await open("admin", 390);
    const inert = () => page.locator("#ad-sidebar").evaluate((el) => el.hasAttribute("inert"));
    note(await inert(), "phone: the closed drawer is inert (out of the tab order)");
    await page.click(".ash-menu-btn");
    note(!(await inert()), "phone: the burger opens the drawer");
    note((await page.locator(".ash-menu-btn").getAttribute("aria-expanded")) === "true", "phone: aria-expanded true while open");
    note((await page.locator(".ash-collapse").isVisible()) === false, "phone: no collapse arrow");
    note(await page.locator(".ash-brand-text").isVisible(), "phone: the drawer is always the full sidebar");
    await page.keyboard.press("Escape");
    note(await inert(), "phone: Escape closes the drawer");
    note(await page.evaluate(() => document.activeElement?.classList.contains("ash-menu-btn")), "phone: focus returns to the burger");
    await page.click(".ash-menu-btn");
    await page.mouse.click(370, 500);
    note(await inert(), "phone: the backdrop closes the drawer");
    await page.click(".ash-menu-btn");
    await page.click('.ash-nav-item:has-text("Direct Video Consultation")', { trial: true }).catch(() => {});
    await context.close();
  }
  // Below 1100px the profile chip is the avatar alone
  {
    const { context, page } = await open("superadmin", 1000);
    note(!(await page.locator(".ash-chip-text").isVisible()), "below 1100px: the chip shows the avatar only");
    note((await page.locator(".ash-avatar").innerText()).trim() === "TS", "…initials from the real name (Test Super Admin -> TS)");
    await context.close();
  }
} finally {
  await browser.close();
  await vite.close();
}
console.log(failures.length ? `\n${failures.length} FAILING` : "\nall shell checks pass");
console.log(`screenshots in ${outDir}`);
process.exit(failures.length ? 1 : 0);
