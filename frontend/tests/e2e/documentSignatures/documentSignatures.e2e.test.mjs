// Signed and unsigned papers in a real browser: Prescription (both layouts), Medical Certificate and Visit Note.
// For each: the signature is whole (not cut off), stays inside its box, overlaps no text, the "Digitally signed" line is
// there (or absent when unsigned), and the app's own PDF code produces a PDF.
// Run from frontend/:  npm run test:e2e:document-signatures
// E2E_SHOT_DIR=<dir> saves a screenshot and the PDF of every case (the PDFs are raster images, so check them by eye).
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
let skipReason = "";
try {
  ({ chromium } = require("playwright-core"));
  ({ createServer } = await import("vite"));
  reactPlugin = (await import("@vitejs/plugin-react")).default;
  if (!findBrowser()) skipReason = "no Chromium found (npx playwright install chromium, or set CHROME_PATH)";
} catch (error) {
  skipReason = `missing dependency: ${String(error.message).split("\n")[0]}`;
}

// What to check on the page, run inside the browser.
function inspect() {
  const sig = document.querySelector('img[alt="Doctor\'s signature"]');
  const text = document.body.innerText;
  const result = { hasSignature: !!sig, caption: /Digitally signed/.test(text), note: /system-generated certificate/.test(text), problems: [] };
  if (!sig) return result;
  const r = sig.getBoundingClientRect();
  result.box = { w: Math.round(r.width), h: Math.round(r.height), natural: [sig.naturalWidth, sig.naturalHeight] };
  if (!sig.complete || sig.naturalWidth === 0) result.problems.push("signature image did not load");
  if (r.height > 56.5 || r.width > 220.5) result.problems.push(`signature larger than 56x220: ${r.width}x${r.height}`);
  // Contained by the nearest box that clips (overflow hidden) and by the page root.
  let clip = sig.parentElement;
  while (clip && getComputedStyle(clip).overflow !== "hidden") clip = clip.parentElement;
  const within = (inner, outer, label) => {
    if (inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5 || inner.top < outer.top - 0.5 || inner.bottom > outer.bottom + 0.5) {
      result.problems.push(`signature is cut off by ${label}`);
    }
  };
  if (clip) within(r, clip.getBoundingClientRect(), "its box");
  within(r, document.querySelector("#root > div").getBoundingClientRect(), "the page");
  // No text element may overlap the signature.
  for (const el of document.querySelectorAll("#root *")) {
    if (el === sig || el.children.length || !el.textContent.trim()) continue;
    const t = el.getBoundingClientRect();
    const ox = Math.min(r.right, t.right) - Math.max(r.left, t.left);
    const oy = Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top);
    if (ox > 1 && oy > 1) result.problems.push(`signature overlaps text "${el.textContent.trim().slice(0, 30)}"`);
  }
  // The caption sits directly under the image, not over it.
  const captionEl = [...document.querySelectorAll("#root span, #root div")].find((e) => !e.children.length && /^Digitally signed/.test(e.textContent.trim()));
  if (captionEl && captionEl.getBoundingClientRect().top < r.bottom - 1) result.problems.push("caption overlaps the signature");
  return result;
}

describe("signed / unsigned papers: layout and PDF", { skip: skipReason || false }, () => {
  let vite;
  let browser;
  let page;
  let base;
  const pageErrors = [];
  const shotDir = process.env.E2E_SHOT_DIR || "";

  const open = async (query) => {
    await page.goto(`${base}/tests/e2e/documentSignatures/harness/index.html?${query}`);
    await page.waitForSelector("#root img");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => {}))));
    });
  };
  const capture = async (name) => {
    if (!shotDir) return;
    fs.mkdirSync(shotDir, { recursive: true });
    await page.locator("#root > div").screenshot({ path: path.join(shotDir, `${name}.png`) });
  };
  const pdf = async (name) => {
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.evaluate(() => window.makePdf())]);
    const target = path.join(shotDir || path.join(frontendRoot, "node_modules", ".cache", "document-signatures"), `${name}.pdf`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await download.saveAs(target);
    const bytes = fs.readFileSync(target);
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", `${name}: not a PDF`);
    return { pages: (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, bytes: bytes.length };
  };

  before(async () => {
    vite = await createServer({
      configFile: false,
      root: frontendRoot,
      logLevel: "silent",
      plugins: [reactPlugin()],
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("") },
      server: { port: 0, host: "127.0.0.1", fs: { allow: [path.resolve(frontendRoot, "..")] } },
      optimizeDeps: { entries: ["tests/e2e/documentSignatures/harness/index.html"] },
    });
    await vite.listen();
    base = vite.resolvedUrls.local[0].replace(/\/$/, "");
    browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
    const context = await browser.newContext({ viewport: { width: 900, height: 1300 }, acceptDownloads: true });
    page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
  });

  after(async () => {
    await browser?.close();
    await vite?.close();
  });

  const DOCS = [
    ["rx", "Prescription (certificate-style layout)"],
    ["rx-legacy", "Prescription (classic layout, as the patient sees it)"],
    ["cert", "Medical Certificate"],
    ["visit", "Visit Note"],
  ];

  for (const [doc, label] of DOCS) {
    test(`${label}: signed`, async () => {
      await open(`doc=${doc}&signed=1`);
      const out = await page.evaluate(inspect);
      assert.equal(out.hasSignature, true, "signature is drawn");
      assert.equal(out.caption, true, "'Digitally signed' line is shown");
      assert.deepEqual(out.problems, []);
      if (doc === "cert") assert.equal(out.note, false, "the 'system-generated' note is replaced by the signature");
      await capture(`${doc}-signed`);
      const made = await pdf(`${doc}-signed`);
      assert.ok(made.bytes > 5000, `PDF made (${made.pages} page(s), ${made.bytes} bytes)`);
      // Signing must not push a normal one-page paper onto a second page (the classic Rx layout is a fixed A4 page).
      assert.equal(made.pages, 1, `${doc} signed PDF should stay one page, got ${made.pages}`);
    });

    test(`${label}: unsigned`, async () => {
      await open(`doc=${doc}`);
      const out = await page.evaluate(inspect);
      assert.equal(out.hasSignature, false);
      // (A Visit Note is always signed: without the image it only shows the empty signature area.)
      if (doc !== "visit") assert.equal(out.caption, false, "no 'Digitally signed' line on an unsigned document");
      if (doc === "cert") assert.equal(out.note, true, "the 'system-generated' note stays on an unsigned certificate");
      await capture(`${doc}-unsigned`);
      const made = await pdf(`${doc}-unsigned`);
      assert.ok(made.pages >= 1);
    });
  }

  for (const sig of ["wide", "tall"]) {
    for (const doc of ["rx", "rx-legacy", "cert"]) {
      test(`${doc}: an extreme ${sig} signature image fits its box`, async () => {
        await open(`doc=${doc}&signed=1&sig=${sig}`);
        const out = await page.evaluate(inspect);
        assert.deepEqual(out.problems, []);
        await capture(`${doc}-signed-${sig}`);
      });
    }
  }

  for (const doc of ["rx", "rx-legacy", "cert"]) {
    test(`${doc}: long content runs to a second page and the signature is not split by the page break`, async () => {
      await open(`doc=${doc}&signed=1&long=1`);
      const out = await page.evaluate(inspect);
      assert.deepEqual(out.problems, []);
      await capture(`${doc}-signed-long`);
      const made = await pdf(`${doc}-signed-long`);
      assert.ok(made.pages >= 2, `expected a multi-page PDF, got ${made.pages}`);
    });
  }

  test("no page errors in the browser", () => {
    assert.deepEqual(pageErrors, []);
  });
});
