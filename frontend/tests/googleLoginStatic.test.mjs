// Without VITE_GOOGLE_CLIENT_ID there is no GoogleOAuthProvider, and the library's hooks throw "Google OAuth components must be used
// within GoogleOAuthProvider" (the login page crashed). Source checks that the pages never call them then and hide the button.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isGoogleEnabled } from "../src/utils/googleAuth.js";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sources = walk(SRC).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f));

test("Google is enabled only by a non-empty client id", () => {
  for (const id of ["abc.apps.googleusercontent.com", " 123 "]) assert.equal(isGoogleEnabled(id), true, id);
  for (const id of ["", "   ", undefined, null]) assert.equal(isGoogleEnabled(id), false, String(id));
});

test("the library hooks are imported in one place only (the guarded hook); no page calls them directly", () => {
  const importers = sources.filter((f) => /from "@react-oauth\/google"/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(SRC, f).replace(/\\/g, "/"));
  assert.deepEqual(importers.sort(), ["AppProviders.jsx", "hooks/useGoogleSignIn.js"]);
});

test("the guarded hook is the real hook only when there is a client id, and does nothing otherwise", () => {
  const hook = read("hooks", "useGoogleSignIn.js");
  assert.ok(hook.includes("googleEnabled ? useGoogleLogin : startNothing"));
  assert.ok(/const startNothing = \(\) => \(\) => \{\};/.test(hook));
});

test("the provider is added only with a client id, and the rest of the tree is the same either way (EmployeeAdmin included)", () => {
  const src = read("AppProviders.jsx");
  assert.ok(src.includes("googleEnabled ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>"));
  assert.equal((src.match(/<EmployeeAdminProvider>/g) || []).length, 1, "one tree, not two that can differ");
  assert.equal((src.match(/<PartnerProvider>/g) || []).length, 1);
});

test("every Google button is hidden when there is no client id (patient login and register, doctor login and register)", () => {
  for (const [file, buttons] of [[["pages", "Login.jsx"], 2], [["pages", "doctors", "DoctorLogin.jsx"], 2]]) {
    const src = read(...file).replace(/\r\n/g, "\n");
    assert.ok(src.includes("useGoogleSignIn({"), file.join("/"));
    assert.equal(/useGoogleLogin/.test(src), false, file.join("/"));
    const all = (src.match(/<GoogleIcon \/> Continue with Google/g) || []).length;
    const guarded = (src.match(/\{googleEnabled && \(\s*\n\s*<div className="(?:hc-)?social-links">\s*\n\s*<button[\s\S]*?<GoogleIcon \/> Continue with Google/g) || []).length;
    assert.equal(all, buttons, file.join("/"));
    assert.equal(guarded, all, `${file.join("/")}: every Google button sits inside {googleEnabled && ...}`);
    assert.ok(src.includes("{googleEnabled && <"), "the 'or use your email' divider goes with the button");
  }
});
