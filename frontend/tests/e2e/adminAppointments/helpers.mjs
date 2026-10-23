// Browser helpers for the admin Appointments tests (see adminAppointments.e2e.test.mjs).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const screenshotDir = path.join(here, ".screenshots");

// Chromium from Playwright's own download, else a Chrome/Edge that is already installed.
// CHROME_PATH overrides both.
export function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), "AppData", "Local", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse();
    for (const dir of dirs) {
      for (const sub of ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-headless-shell-mac-arm64/chrome-headless-shell"]) {
        const candidate = path.join(root, dir, sub);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  const installed = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return installed.find((p) => fs.existsSync(p)) || null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createHelpers({ page, api, harnessUrl }) {
  // The test API's control endpoints.
  const call = async (method, route, body) => {
    const res = await fetch(api.url + route, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const make = async (spec) => (await call("POST", "/__make", spec)).body.id;
  const doc = async (id) => (await call("GET", `/__doc/${id}`)).body;
  const calls = async () => (await call("GET", "/__calls")).body;
  const reset = () => call("POST", "/__reset");
  const remove = (id) => call("DELETE", `/__doc/${id}`);

  const until = async (fn, what, ms = 8000) => {
    const end = Date.now() + ms;
    let last;
    while (Date.now() < end) {
      try {
        last = await fn();
        if (last) return last;
      } catch (error) {
        last = error;
      }
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${what}${last instanceof Error ? `: ${last.message}` : ""}`);
  };

  const open = async (start = "/admin-dashboard/appointments?tab=all") => {
    await page.goto(`${harnessUrl}/tests/e2e/adminAppointments/harness/index.html?start=${encodeURIComponent(start)}`);
    await page.waitForSelector("table.adp-bk tbody tr, .adp-empty");
  };

  const rowsLocator = () => page.locator("table.adp-bk tbody tr");
  const row = (name) => page.locator("table.adp-bk tbody tr", { hasText: name }).first();
  const rowText = async (name) => (await row(name).innerText()).replace(/\s+/g, " ");

  // Types in the page's search box and waits until every row shown matches (rows are found by patient name).
  const search = async (text) => {
    await page.fill(".adp-search input", text);
    await until(
      () => page.evaluate((t) => {
        const rows = [...document.querySelectorAll("table.adp-bk tbody tr")];
        return rows.length > 0 && rows.every((r) => r.textContent.includes(t));
      }, text),
      `rows for "${text}"`,
    );
    await sleep(150);
  };

  const tabCount = async (label) => Number(await page.locator(`[role="tab"]:has-text("${label}") .adp-tab-count`).first().innerText());
  const tabs = async () => page.$$eval('[role="tab"]', (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  const headers = async () => page.$$eval("table.adp-bk thead th", (els) => els.map((e) => e.textContent.trim()));
  const toasts = async () => (await page.locator(".hc-toasts").innerText().catch(() => "")).replace(/\s+/g, " ");
  const modal = () => page.locator(".hc-modal");
  const confirmDialog = () => page.locator('[role="alertdialog"]');
  const doctorNames = async () => page.$$eval(".adp-bk-docitem b", (els) => els.map((e) => e.textContent));
  const pickDoctor = (name) => page.locator(".adp-bk-docitem", { hasText: name }).click();
  const chooseReason = (label) => page.selectOption(".hc-modal select", { label });

  // A screenshot for a person to look at; only taken when E2E_SCREENSHOTS=1.
  const shot = async (name) => {
    if (process.env.E2E_SCREENSHOTS !== "1") return;
    fs.mkdirSync(screenshotDir, { recursive: true });
    await sleep(450); // let the dialog's fade-in finish
    await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
  };

  return { call, make, doc, calls, reset, remove, until, sleep, open, rowsLocator, row, rowText, search, tabCount, tabs, headers, toasts, modal, confirmDialog, doctorNames, pickDoctor, chooseReason, shot };
}
