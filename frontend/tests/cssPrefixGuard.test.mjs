// The build guard that catches the minifier dropping the standard backdrop-filter. Run from frontend/:
//   node --test tests/cssPrefixGuard.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { PAIRS, checkDist, findProblems } from "../scripts/check-css-prefixes.mjs";

test("flags a rule that kept only -webkit-backdrop-filter (what the minifier produced)", () => {
  const css = ".nav-container{-webkit-backdrop-filter:blur(10px)saturate(110%);background:#ffffff2e}";
  const problems = findProblems(css);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].selector, ".nav-container");
  assert.equal(problems[0].standard, "backdrop-filter");
});

test("accepts both declarations, in either order, and rules without either", () => {
  assert.deepEqual(findProblems(".a{-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}"), []);
  assert.deepEqual(findProblems(".a{backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}"), []);
  assert.deepEqual(findProblems(".a{backdrop-filter:blur(4px)}"), []);
  assert.deepEqual(findProblems(".a{color:red}"), []);
});

test("does not confuse a transition list or a longer property name with the declaration", () => {
  const css = ".a{transition:backdrop-filter .4s,-webkit-backdrop-filter .4s;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}";
  assert.deepEqual(findProblems(css), []);
  // a transition that names the property is not a declaration of it
  assert.equal(findProblems(".b{transition:backdrop-filter .4s;-webkit-backdrop-filter:blur(2px)}").length, 1);
});

test("looks inside @media blocks", () => {
  const css = "@media (max-width:600px){.m{-webkit-backdrop-filter:blur(8px)}}";
  assert.equal(findProblems(css).length, 1);
});

test("properties that Chrome still honours with the prefix are not flagged", () => {
  assert.deepEqual(findProblems(".c{-webkit-line-clamp:2;-webkit-text-fill-color:transparent;-webkit-mask-image:none}"), []);
  assert.deepEqual(PAIRS.map((pair) => pair.standard), ["backdrop-filter"]);
});

test("checkDist reads every css file under assets", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cssguard-"));
  try {
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets", "ok.css"), ".a{-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px)}");
    fs.writeFileSync(path.join(dir, "assets", "bad.css"), ".b{-webkit-backdrop-filter:blur(1px)}");
    const results = checkDist(dir);
    assert.equal(results.length, 1);
    assert.equal(results[0].file, "bad.css");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
