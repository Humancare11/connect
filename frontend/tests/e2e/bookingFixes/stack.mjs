// Shared set-up of the booking-fix browser tests: the stand-in API (apiServer.mjs), a vite dev server serving the harness page, and
// real Chromium. Each test file calls startStack() in before() and stack.close() in after(). Skips (with the reason) when Chromium or a
// dependency is missing, like the other browser suites.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findBrowser } from "../adminAppointments/helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const frontendRoot = path.resolve(here, "..", "..", "..");
const harness = (file) => path.join(here, "harness", file);
const require = createRequire(import.meta.url);

export let skipReason = "";
let chromium;
let createServer;
let reactPlugin;
let startApiServer;
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  ({ startApiServer } = await import("./apiServer.mjs"));
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

// Every non-file, non-API GET gets the harness page, so BrowserRouter URLs work on reload.
const spaFallback = () => ({
  name: "booking-fixes-spa-fallback",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const wantsHtml = req.method === "GET" && String(req.headers.accept || "").includes("text/html");
      if (wantsHtml && !url.startsWith("/api") && !url.startsWith("/@") && !url.startsWith("/tests/") && !/\.[a-z0-9]+(\?|$)/i.test(url)) {
        req.url = "/tests/e2e/bookingFixes/harness/index.html";
      }
      next();
    });
  },
});

const WARM_UP_ROUTES = [
  "/",
  "/other",
  "/login",
  "/category-consultant?category=general",
  "/appointment-booking/category-confirm",
  "/appointment-booking/women-s-health/obstetrics-and-gynaecology/pcos",
];

async function warmUp({ browser, origin }) {
  const context = await browser.newContext();
  await context.route("https://api.country.is/**", (route) => route.abort());
  await context.route("https://flagcdn.com/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: "" }));
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  try {
    for (const route of WARM_UP_ROUTES) {
      await page.goto(`${origin}${route}`, { waitUntil: "load", timeout: 120000 });
      await page.locator("#root > *").first().waitFor({ state: "attached" });
      await page.waitForLoadState("networkidle");
    }
    // pulled in only after a login (Login.jsx: import("../socket")), so no route above loads it
    await page.evaluate(() => import("/src/socket.js")).catch(() => {});
    await page.waitForLoadState("networkidle");
    // a reload Vite does after the last dependency it found has to be over before the first test starts
    await page.goto(`${origin}/login`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
  } finally {
    await context.close();
  }
}

export async function startStack() {
  const api = await startApiServer();
  const vite = await createServer({
    configFile: false,
    root: frontendRoot,
    logLevel: "silent",
    plugins: [reactPlugin(), spaFallback()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(""),
      "import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY": JSON.stringify("pk_test_stub"),
      "import.meta.env.VITE_PAYPAL_CLIENT_ID": JSON.stringify("paypal_stub"),
    },
    resolve: {
      alias: [
        { find: "@stripe/stripe-js", replacement: harness("stripe-js.js") },
        { find: "@stripe/react-stripe-js", replacement: harness("react-stripe-js.jsx") },
        { find: "@paypal/react-paypal-js", replacement: harness("paypal.jsx") },
      ],
    },
    server: {
      port: 0,
      host: "127.0.0.1",
      hmr: false,
      fs: { allow: [path.resolve(frontendRoot, "..")] },
      proxy: { "/api": { target: api.url, changeOrigin: false } },
    },
    optimizeDeps: { entries: ["tests/e2e/bookingFixes/harness/index.html"] },
  });
  await vite.listen();
  const origin = vite.resolvedUrls.local[0].replace(/\/$/, "");
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });

  // Vite bundles each npm dependency the first time a page imports it, and when it finds a new one while a page is open it reloads
  // that page. Left to happen during a test, that reload (or a module that is not ready yet) fails whatever the test was doing. So
  // the stack is not handed out until every route the tests use, and the module the login page imports lazily, has been loaded once
  // and the dev server has gone quiet.
  await warmUp({ browser, origin });

  const post = (p, body = {}) => fetch(`${api.url}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    origin,
    browser,
    state: async () => (await fetch(`${api.url}/__state`)).json(),
    reset: () => post("/__reset"),
    set: (patch) => post("/__set", patch),
    // A fresh browser context (own sessionStorage, own history); collects uncaught page errors.
    async newPage() {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      // the phone widget's "detect my country" lookup and flag images stay offline and quiet
      await context.route("https://api.country.is/**", (route) => route.abort());
      await context.route("https://flagcdn.com/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: "" }));
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      // Explicit waits: every navigation returns once the app has rendered and the network is quiet, not merely once the HTML arrived.
      const rawGoto = page.goto.bind(page);
      page.goto = async (url, options) => {
        const response = await rawGoto(url, { waitUntil: "load", ...options });
        await page.locator("#root > *").first().waitFor({ state: "attached" });
        await page.waitForLoadState("networkidle");
        return response;
      };
      return { page, context, errors };
    },
    async close() {
      await browser?.close();
      await vite?.close();
      await api?.close();
    },
  };
}

// A booking the "Get Help With" intake would have saved, for the tests that start at the confirm page.
export const futureDate = (days = 3) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
export const generalSelection = () => ({
  catId: "general",
  catLabel: "General & Everyday Care",
  specName: "",
  specIco: "stethoscope",
  condName: "Acne",
  condIco: "activity",
  cost: 49,
  currency: "USD",
  isCategoryBooking: true,
  isPcpBooking: false,
  categoryName: "General & Everyday Care",
  specialtyName: "",
  conditionName: "Acne",
  pcpName: "",
});
