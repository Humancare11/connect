// The live Privacy Policy carries the counsel-approved "Website Chat and AI Assistant" section under #website-chat
// (the chat widget's AI notice links to it). Static checks on the component and the app's scroll handling.
// Run: node --test tests/  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const policy = read("../src/pages/PrivacyPolicies/PrivacyPolicy1.jsx");
const app = read("../src/App.jsx");

test("the section has id=website-chat and sits between 'How We Share Your Information' and 'Health Information and HIPAA'", () => {
  assert.equal((policy.match(/id="website-chat"/g) || []).length, 1);
  const share = policy.indexOf("How We Share Your Information");
  const chat = policy.indexOf("Website Chat and AI Assistant");
  const hipaa = policy.indexOf("Health Information and HIPAA");
  assert.ok(share > 0 && share < chat && chat < hipaa);
});

test("no placeholders are left and the contact address is the support mailbox", () => {
  assert.ok(!/\[privacy contact email\]|\[publish date\]/.test(policy));
  assert.ok(policy.includes('href="mailto:support@humancareconnect.co"'));
  assert.match(policy, /Last updated: October 16, 2026/);
});

test("the geolocation credit is DB-IP, not MaxMind", () => {
  assert.ok(!/MaxMind|GeoLite/i.test(policy));
  assert.match(policy, /IP geolocation by DB-IP \(<a href="https:\/\/db-ip\.com"[^>]*>https:\/\/db-ip\.com<\/a>\)\./);
});

test("/privacy-policy#website-chat scrolls to the section: the page does it after mounting, and the app's scroll-to-top leaves an anchor already on the page alone", () => {
  assert.match(policy, /useEffect\(\(\) => \{[\s\S]*window\.location\.hash[\s\S]*scrollIntoView\(\)/);
  const scroll = app.slice(app.indexOf("function ScrollToTop()"), app.indexOf("// First focusable element on every page"));
  assert.match(scroll, /const \{ pathname, hash \} = useLocation\(\)/);
  assert.match(scroll, /document\.getElementById\(id\)\) return;/);
  assert.match(scroll, /window\.scrollTo\(0, 0\)/);
});
