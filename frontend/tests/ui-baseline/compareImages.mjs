// Compares two folders of same-named PNGs with the screenshot tool's rule (no pixel moved by more than 24/255, at most 150
// moved by more than 2: see README). Exits 1 if any pair differs or a file is missing.
//   node tests/ui-baseline/compareImages.mjs <folderBefore> <folderAfter>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(here, "..", "..", "..", "backend", "package.json"))("sharp");
const [before, after] = process.argv.slice(2).map((p) => path.resolve(p));
const NOISE = 2;
const BIG = 24;
const FEW_MOVED = 150;

let bad = 0;
for (const file of fs.readdirSync(before).filter((f) => f.endsWith(".png")).sort()) {
  if (!fs.existsSync(path.join(after, file))) {
    console.log(`MISSING    ${file}`);
    bad++;
    continue;
  }
  const [A, B] = await Promise.all([before, after].map((d) => sharp(path.join(d, file)).raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    console.log(`DIFFERENT  ${file}  (size ${A.info.width}x${A.info.height} -> ${B.info.width}x${B.info.height})`);
    bad++;
    continue;
  }
  let count = 0;
  let big = 0;
  let max = 0;
  const ch = A.info.channels;
  for (let i = 0; i < A.data.length; i += ch) {
    let d = 0;
    for (let c = 0; c < ch; c++) d = Math.max(d, Math.abs(A.data[i + c] - B.data[i + c]));
    if (d > NOISE) count++;
    if (d > BIG) big++;
    max = Math.max(max, d);
  }
  const same = big === 0 && count <= FEW_MOVED;
  console.log(`${same ? "identical " : "DIFFERENT "} ${file}${count ? `  (${count} pixels moved by more than ${NOISE}, ${big} by more than ${BIG})` : ""}`);
  if (!same) bad++;
}
console.log(bad ? `\n${bad} differ` : "\nall identical");
process.exit(bad ? 1 : 0);
