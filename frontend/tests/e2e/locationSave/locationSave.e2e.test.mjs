// Browser-level test of "the country I pick is the country that is saved": the REAL patient signup page and the REAL profile edit page
// (country / state dropdown + phone field), in real Chromium, against the real /api/locations routes, the real updateProfile and the
// real signup location validation (see apiServer.mjs). Germany, United Kingdom and India are picked in the dropdown and the saved
// country is read back.
//   npm run test:e2e:location-save   (from frontend/)
// The test skips itself when Chromium (or Chrome/Edge) or the backend's dependencies are not installed.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
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

const spaFallback = () => ({
  name: "location-save-spa-fallback",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const wantsHtml = req.method === "GET" && String(req.headers.accept || "").includes("text/html");
      if (wantsHtml && !url.startsWith("/api") && !url.startsWith("/@") && !url.startsWith("/tests/") && !/\.[a-z0-9]+(\?|$)/i.test(url)) {
        req.url = "/tests/e2e/locationSave/harness/index.html";
      }
      next();
    });
  },
});

// country picked in the dropdown -> a phone number of that country and the first state offered
const CASES = [
  { country: "Germany", phone: "+4915123456789", dial: "+49" },
  { country: "United Kingdom", phone: "+447911123456", dial: "+44" },
  { country: "India", phone: "+919876543210", dial: "+91" },
];

describe("the country picked is the country saved, in a real browser", { skip: skipReason || false }, () => {
  let api;
  let vite;
  let browser;
  let origin;
  const pageErrors = [];

  before(async () => {
    api = await startApiServer();
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin(), spaFallback()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: {
        port: 0,
        host: "127.0.0.1",
        fs: { allow: [path.resolve(frontendRoot, "..")] },
        proxy: { "/api": { target: api.url, changeOrigin: false } },
      },
      optimizeDeps: { entries: ["tests/e2e/locationSave/harness/index.html"] },
    });
    await vite.listen();
    origin = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
    await api?.close();
  });

  beforeEach(async () => {
    await fetch(`${api.url}/__reset`, { method: "POST" });
    pageErrors.length = 0;
  });

  const newPage = async () => {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    // keep the phone widget's "detect my country" lookup offline and quiet
    await context.route("https://api.country.is/**", (route) => route.abort());
    await context.route("https://flagcdn.com/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: "" }));
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    return { page, context };
  };
  const registers = async () => (await fetch(`${api.url}/__registers`)).json();
  const savedUser = async () => (await fetch(`${api.url}/__user`)).json();

  // Picks a country in the dropdown, waits for its states, picks the first one (or none when the country has none).
  async function pickCountryAndState(page, country) {
    await page.selectOption("#country", { label: country });
    await page.waitForFunction(
      () => {
        const state = document.querySelector("#state");
        return state && !/Loading/.test(state.options[0]?.textContent || "");
      },
      null,
      { timeout: 15000 },
    );
    const stateOptions = await page.locator("#state option").evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
    if (stateOptions.length) await page.selectOption("#state", stateOptions[0]);
    return stateOptions[0] || "";
  }

  async function settle(page) {
    // let every effect that syncs the phone field and the country run (they re-apply each other)
    await page.waitForTimeout(1200);
  }

  for (const { country, phone, dial } of CASES) {
    test(`signup: picking ${country} saves ${country} (and the phone code follows)`, async () => {
      const { page, context } = await newPage();
      try {
        await page.goto(`${origin}/login`);
        await page.getByRole("button", { name: "Sign Up" }).first().click();
        await page.locator("#patient-register-name").waitFor();

        await page.locator("#patient-register-name").fill("Test Patient");
        await page.locator("#patient-register-email").fill(`signup-${Date.now()}@e2e.test`);
        const state = await pickCountryAndState(page, country);
        await settle(page);

        // what the dropdown shows is what was picked, and the phone code matches
        assert.equal(await page.locator("#country").inputValue(), country);
        assert.equal(await page.locator("#state").inputValue(), state);
        const shownDial = (await page.locator(".hc-mobile-field .pif-country-trigger").first().innerText()).replace(/s+/g, " ");
        assert.ok(shownDial.includes(dial.slice(1)), `the phone field shows ${dial} (saw: ${shownDial})`);

        await page.locator("#patient-register-mobile").fill(phone.replace(dial, ""));
        await settle(page);
        assert.equal(await page.locator("#country").inputValue(), country, "typing the phone number does not change the country");

        await page.locator("#patient-register-password").fill("Str0ng!Passw0rd#1");
        await page.locator("#patient-register-terms").check();
        await page.locator("#patient-register-privacy-consent").check();
        await page.locator("#patient-register-hipaa-consent").check();
        await page.getByRole("button", { name: "Create Account" }).last().click();

        await page.locator("[id^='patient-register-otp']").first().waitFor({ timeout: 15000 });
        await page.locator("[id^='patient-register-otp']").first().click();
        await page.keyboard.type("123456");
        await page.getByRole("button", { name: /Verify & Create Account/ }).click();

        const until = Date.now() + 15000;
        let list = [];
        while (Date.now() < until && !list.length) {
          list = await registers();
          if (!list.length) await new Promise((r) => setTimeout(r, 150));
        }
        assert.equal(list.length, 1, "the browser sent one register request");
        const [sent] = list;
        assert.equal(sent.body.country, country, "the browser sent the country that was picked");
        assert.ok(sent.body.mobile.startsWith(dial), `and the phone code ${dial}`);
        assert.equal(sent.error, null, "the server accepts it");
        assert.equal(sent.saved.country, country, "and the server would save exactly that country");
        assert.deepEqual(pageErrors, []);
      } finally {
        await context.close();
      }
    });

    test(`profile edit: picking ${country} saves ${country}`, async () => {
      const { page, context } = await newPage();
      try {
        await page.goto(`${origin}/profile`);
        await page.locator("#country").waitFor();
        await page.waitForFunction(() => document.querySelector("#country")?.value === "India", null, { timeout: 15000 });

        if (country !== "India") {
          await pickCountryAndState(page, country);
          await settle(page);
          assert.equal(await page.locator("#country").inputValue(), country);
        } else {
          // India is already the stored country: pick a different one first, then India again
          await pickCountryAndState(page, "France");
          await settle(page);
          await pickCountryAndState(page, "India");
          await settle(page);
          assert.equal(await page.locator("#country").inputValue(), "India");
        }

        const sentBodies = [];
        page.on("request", (req) => {
          if (req.method() === "PUT" && req.url().endsWith("/api/auth/update-profile")) sentBodies.push(req.postDataJSON());
        });
        await page.getByRole("button", { name: /save/i }).first().click();
        const until = Date.now() + 15000;
        while (Date.now() < until && !sentBodies.length) await new Promise((r) => setTimeout(r, 100));
        assert.equal(sentBodies.length, 1, "the browser sent the profile");
        assert.equal(sentBodies[0].country, country, "the browser sent the country that was picked");

        const saved = await (async () => {
          const u2 = Date.now() + 10000;
          let user = await savedUser();
          while (Date.now() < u2 && user.country !== country) {
            await new Promise((r) => setTimeout(r, 150));
            user = await savedUser();
          }
          return user;
        })();
        assert.equal(saved.country, country, "the country stored is the one that was picked");
        assert.deepEqual(pageErrors, []);
      } finally {
        await context.close();
      }
    });
  }
});
