// Build guard: fails when a built CSS rule keeps a vendor-prefixed property but lost the standard one.
//
// Why: the CSS minifier collapses `backdrop-filter: X; -webkit-backdrop-filter: X;` (standard first, prefixed
// second) into the prefixed declaration alone. Chrome, Edge and Firefox do not understand
// `-webkit-backdrop-filter`, so every glass/frosted surface (the navbar included) silently lost its blur in
// production builds while looking fine in `npm run dev`. Write the prefixed line BEFORE the standard one and
// the minifier keeps both. See docs in vite.config.js (cssMinify).
//
// Only pairs whose prefixed form is NOT honoured by Chromium/Firefox belong in PAIRS. Properties such as
// -webkit-line-clamp or -webkit-text-fill-color have no standard counterpart in use, and -webkit-mask-*,
// -webkit-user-select and -webkit-background-clip are still understood by Chrome, so a prefixed-only rule for
// those is harmless. Add a pair here when a new one turns out to matter.
//
// Usage: node scripts/check-css-prefixes.mjs [distDir]      (default: dist)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PAIRS = [{ standard: "backdrop-filter", prefixed: "-webkit-backdrop-filter" }];

const hasProperty = (body, property) =>
  new RegExp(`(?:^|;)\\s*${property.replace(/-/g, "\\-")}\\s*:`, "i").test(body);

// Returns one problem per rule that has the prefixed property without its standard counterpart.
export function findProblems(css, pairs = PAIRS) {
  const problems = [];
  // Innermost rule blocks only (declarations never contain braces), so rules inside @media/@supports are included.
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ").slice(0, 80);
    const body = match[2];
    for (const { standard, prefixed } of pairs) {
      if (hasProperty(body, prefixed) && !hasProperty(body, standard)) {
        problems.push({ selector, standard, prefixed });
      }
    }
  }
  return problems;
}

export function checkDist(distDir) {
  const assets = path.join(distDir, "assets");
  if (!fs.existsSync(assets)) throw new Error(`check-css-prefixes: ${assets} does not exist (build first)`);
  const results = [];
  for (const file of fs.readdirSync(assets).filter((name) => name.endsWith(".css"))) {
    for (const problem of findProblems(fs.readFileSync(path.join(assets, file), "utf8"))) {
      results.push({ file, ...problem });
    }
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const distDir = path.resolve(process.argv[2] || "dist");
  const results = checkDist(distDir);
  if (results.length) {
    console.error(`\ncheck-css-prefixes FAILED: ${results.length} built rule(s) have a prefixed property but not the standard one:`);
    for (const r of results.slice(0, 30)) console.error(`  ${r.file}: ${r.selector}  (${r.prefixed} without ${r.standard})`);
    if (results.length > 30) console.error(`  ... and ${results.length - 30} more`);
    console.error("\nPut the -webkit- declaration BEFORE the standard one in the source CSS (see the comment in this file).");
    process.exit(1);
  }
  console.log(`check-css-prefixes passed (${PAIRS.map((p) => p.standard).join(", ")})`);
}
