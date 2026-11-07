// The Visit Note editor in the video-call panel and on the Notes page, in a real browser against the real /api/notes router:
//   rejoin -> edit -> save, a failed load after a drop, a finalised note stays read-only, no required validation in the panel,
//   Review & Finalise still blocks empty required fields, and the panel scrolls with the app's smooth-scroll running.
// Run from frontend/:  npm run test:e2e:notes-panel   (E2E_SHOT_DIR=<dir> also saves screenshots)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..", "..", "..");
const require = createRequire(import.meta.url);

let chromium;
let createServer;
let reactPlugin;
let startApiServer;
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  ({ startApiServer } = await import("./apiServer.mjs"));
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

describe("visit note editor: call panel and Notes page in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let page;
  let harnessUrl;
  const pageErrors = [];

  const shot = async (name) => {
    if (!process.env.E2E_SHOT_DIR) return;
    fs.mkdirSync(process.env.E2E_SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.E2E_SHOT_DIR, `${name}.png`) });
  };
  const harness = (kind, id) => `${harnessUrl}/tests/e2e/visitNotePanel/harness/index.html?t=${api.token}&start=/${kind}/${id}`;
  const open = async (kind, id) => {
    await page.goto(harness(kind, id));
    await page.waitForSelector(".vne textarea");
    await loaded();
  };
  // The form is usable at once; wait until the saved text has arrived.
  const loaded = () =>
    page.waitForFunction(() => {
      const s = document.querySelector(".vne-save");
      return !s || !/Loading|Retrying/.test(s.textContent);
    });
  const fields = () => page.locator(".vne textarea");
  const server = async (id) => (await fetch(`${api.url}/__note/${id}`)).json();
  const status = () => page.locator(".vne-save").first().innerText();
  const settle = () => page.waitForFunction(() => /Saved|Auto-saved/.test(document.querySelector(".vne-save")?.textContent || ""));
  const saveButton = () => page.getByRole("button", { name: "Save", exact: true });

  before(async () => {
    api = await startApiServer();
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] }, proxy: { "/api": { target: api.url, changeOrigin: false } } },
      optimizeDeps: { entries: ["tests/e2e/visitNotePanel/harness/index.html"] },
    });
    await vite.listen();
    harnessUrl = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource|ERR_|net::/i.test(message.text())) pageErrors.push(message.text());
    });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  test("rejoin, then edit, then Save: the latest saved text is loaded and nothing is lost", async () => {
    await open("panel", api.ids.draft);
    assert.equal(await fields().nth(0).inputValue(), "Saved symptoms");
    await fields().nth(2).fill("Rest and fluids");
    await saveButton().click();
    await settle();
    assert.match(await status(), /^Saved · /);
    assert.equal((await server(api.ids.draft)).plan, "Rest and fluids");

    // The call drops and the doctor rejoins: the panel is mounted again and loads the saved text.
    await page.click("#toggle");
    await page.click("#toggle");
    await page.waitForSelector(".vne textarea");
    await page.waitForFunction(() => document.querySelectorAll(".vne textarea")[2]?.value === "Rest and fluids");
    assert.equal(await fields().nth(0).inputValue(), "Saved symptoms");
    assert.equal(await fields().nth(0).isEditable(), true);
    await fields().nth(3).fill("Follow up in a week");
    await saveButton().click();
    await page.waitForFunction(() => /Saved/.test(document.querySelector(".vne-save")?.textContent || ""));
    const saved = await server(api.ids.draft);
    assert.deepEqual([saved.symptoms, saved.plan, saved.note], ["Saved symptoms", "Rest and fluids", "Follow up in a week"]);
    await shot("1-rejoin-edit-save");
  });

  test("the note cannot be loaded right after a drop: fields stay editable, the load is retried, text is merged and saved", async () => {
    let failLoads = true;
    await page.route("**/api/notes/appointment/*", (route) =>
      failLoads && route.request().method() === "GET" ? route.abort("internetdisconnected") : route.continue(),
    );
    await page.goto(harness("panel", api.ids.draft));
    await page.waitForSelector(".vne textarea");
    assert.equal(await fields().nth(0).isEditable(), true);
    await page.waitForFunction(() => /Retrying/.test(document.querySelector(".vne-save")?.textContent || ""));
    await fields().nth(1).fill("Throat is red");
    await page.waitForTimeout(1300); // longer than the autosave delay: nothing may be saved before the saved text has loaded
    assert.equal((await server(api.ids.draft)).clinicalFindings, "");
    failLoads = false;
    await page.waitForFunction(() => document.querySelectorAll(".vne textarea")[0]?.value === "Saved symptoms", null, { timeout: 15000 });
    await page.waitForFunction(() => /Saved ·/.test(document.querySelector(".vne-save")?.textContent || ""), null, { timeout: 10000 });
    const saved = await server(api.ids.draft);
    assert.deepEqual([saved.symptoms, saved.clinicalFindings, saved.plan], ["Saved symptoms", "Throat is red", "Rest and fluids"]);
    await page.unroute("**/api/notes/appointment/*");
  });

  test("text typed while saves are failing survives closing the panel and is saved after the rejoin", async () => {
    await open("panel", api.ids.lost);
    let blockSaves = true;
    await page.route("**/api/notes/appointment/*", (route) =>
      blockSaves && route.request().method() === "PUT" ? route.abort("internetdisconnected") : route.continue(),
    );
    await fields().nth(0).fill("Typed during the outage");
    await page.waitForFunction(() => /Could not save/.test(document.querySelector(".vne-save")?.textContent || ""), null, { timeout: 8000 });
    await page.click("#toggle"); // the panel goes away while the text is still unsaved
    assert.equal((await server(api.ids.lost))?.symptoms ?? "", "");
    blockSaves = false;
    await page.click("#toggle");
    await page.waitForSelector(".vne textarea");
    await page.waitForFunction(() => document.querySelectorAll(".vne textarea")[0]?.value === "Typed during the outage");
    await page.waitForFunction(() => /Saved ·/.test(document.querySelector(".vne-save")?.textContent || ""), null, { timeout: 10000 });
    assert.equal((await server(api.ids.lost)).symptoms, "Typed during the outage");
    await page.unroute("**/api/notes/appointment/*");
  });

  test("a failed save shows its error in the panel only, keeps the fields editable and Save works again", async () => {
    await open("panel", api.ids.fresh);
    await page.route("**/api/notes/appointment/*", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ msg: "Server problem, try again." }) })
        : route.continue(),
    );
    await fields().nth(3).fill("first attempt");
    await saveButton().click();
    await page.waitForFunction(() => /Server problem/.test(document.querySelector(".vne-save")?.textContent || ""));
    assert.equal(await fields().nth(3).isEditable(), true);
    await page.unroute("**/api/notes/appointment/*");
    await saveButton().click();
    await page.waitForFunction(() => /Saved ·/.test(document.querySelector(".vne-save")?.textContent || ""));
    assert.equal((await server(api.ids.fresh)).note, "first attempt");
  });

  test("a finalised note stays read-only in the panel: no Save button, fields locked, nothing changes", async () => {
    await open("panel", api.ids.finalised);
    assert.match(await page.locator(".vne-badge").innerText(), /^finalised$/i);
    for (let i = 0; i < 4; i += 1) assert.equal(await fields().nth(i).evaluate((e) => e.readOnly), true);
    assert.equal(await saveButton().count(), 0);
    await fields().nth(0).click();
    await page.keyboard.type("tampering");
    assert.equal(await fields().nth(0).inputValue(), "Signed symptoms");
    assert.equal((await server(api.ids.finalised)).symptoms, "Signed symptoms");
    await shot("5-finalised-readonly");
  });

  test("the panel has no required markers or validation; a note with only the Note field saves", async () => {
    await open("panel", api.ids.blank);
    assert.equal(await page.locator(".vne em, .vne-opt").count(), 0, "no * and no (optional) in the panel");
    assert.equal(await page.locator(".vne [aria-required], .vne [required]").count(), 0);
    await fields().nth(3).fill("Only the free note");
    await saveButton().click();
    await page.waitForFunction(() => /Saved ·/.test(document.querySelector(".vne-save")?.textContent || ""));
    assert.equal(await page.locator(".vne-field--bad, .vne-field-error, [role=alert]").count(), 0);
    const saved = await server(api.ids.blank);
    assert.deepEqual([saved.symptoms, saved.clinicalFindings, saved.plan, saved.note], ["", "", "", "Only the free note"]);
    await shot("6-no-required-in-panel");
  });

  test("Review & Finalise (Notes page) still blocks empty required fields, then lets a complete note through", async () => {
    await open("page", api.ids.blank);
    assert.ok((await page.locator(".vne-label em").count()) >= 3, "the page keeps its required markers");
    await page.getByRole("button", { name: /Review & Finalise/ }).click();
    const alert = page.locator("[role=alert]");
    await alert.waitFor();
    assert.match(await alert.innerText(), /Symptoms, Clinical Findings, Plan \/ Treatment/);
    assert.equal(await page.locator("#review-page").count(), 0);
    assert.equal(await page.locator(".vne-field--bad").count(), 3);
    await fields().nth(0).fill("Cough");
    await fields().nth(1).fill("Clear chest");
    await fields().nth(2).fill("Fluids");
    await page.getByRole("button", { name: /Review & Finalise/ }).click();
    await page.waitForSelector("#review-page");
  });

  test("the panel scrolls with the mouse wheel while the app's smooth scroll runs; Save stays in view", async () => {
    await page.setViewportSize({ width: 1200, height: 520 });
    await open("panel", api.ids.draft);
    await page.waitForTimeout(800); // let the smooth-scroll library start
    const box = await page.locator(".vne--panel").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 900);
    await page.waitForFunction(() => document.querySelector(".vne--panel").scrollTop > 20);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const e = document.querySelector(".vne--panel");
      const last = [...e.querySelectorAll(".vne-field")].pop().getBoundingClientRect();
      const save = [...e.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save").getBoundingClientRect();
      const p = e.getBoundingClientRect();
      return { atEnd: e.scrollTop >= e.scrollHeight - e.clientHeight - 2, lastInside: last.bottom <= p.bottom + 1, saveInside: save.top >= p.top && save.bottom <= p.bottom + 1 };
    });
    assert.deepEqual(m, { atEnd: true, lastInside: true, saveInside: true });
    await shot("7-panel-scrolled");
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test("no page errors", () => {
    assert.deepEqual(pageErrors, []);
  });
});
