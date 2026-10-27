// Screenshots of the public website pages (header and footer included) at 1440 and 390px, for a before/after comparison of two
// builds served against the same API.
//   node tests/regression/publicPagesShots.mjs --base http://localhost:5181 --out <folder> [--doctor 91209-satish-dalvi] [--blog what-is-telemedicine1]
// Nothing outside the base URL is loaded (external widgets and fonts are refused), animations are off and the page is scrolled
// once to the bottom so lazy sections are in. Pair with tests/ui-baseline/compareImages.mjs <before> <after>.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { findBrowser } from "../e2e/adminAppointments/helpers.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg("base").replace(/\/$/, "");
const out = path.resolve(arg("out"));
const doctor = arg("doctor", "91209-satish-dalvi");
const blog = arg("blog", "what-is-telemedicine1");
fs.mkdirSync(out, { recursive: true });

export const PAGES = [
  ["home", "/"],
  ["condition", "/women-health/obstetrics-and-gynaecology/pcos"],
  ["service", "/fit-to-fly-certificate"],
  ["speciality", "/child-and-family-care/adolescent-medicine"],
  ["category", "/mental-health"],
  ["doctor-profile", `/doctors/${doctor}`],
  ["blog-post-admin", `/${blog}`],
  ["blog-article", "/what-is-telemedicine"],
  ["about", "/about-us"],
  ["booking-picker", "/appointment-booking"],
  ["booking-form-loggedout", "/appointment-booking/mental-health/psychiatry/anxiety"],
  ["book-appointment-loggedout", "/book-appointment"],
];
const SIZES = [[1440, 900], [390, 844]];

const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ["--disable-lcd-text", "--force-color-profile=srgb", "--font-render-hinting=none"] });
const lines = [];
try {
  for (const [width, height] of SIZES) {
    for (const [name, route] of PAGES) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("**/*", (r) => (new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort()));
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
      await page.goto(base + route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}" });
      // scroll down in steps so lazy sections render, then back to the top
      await page.evaluate(async () => {
        const step = Math.max(300, window.innerHeight - 100);
        for (let y = 0; y < document.documentElement.scrollHeight + step; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const final = new URL(page.url()).pathname;
      await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
      lines.push(`${String(width).padStart(4)} ${name.padEnd(26)} ${route}${final !== route ? `  -> ${final}` : ""}${errors.length ? `  PAGEERRORS: ${errors.join(" | ")}` : ""}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(lines.join("\n"));
