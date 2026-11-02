const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildEmailHTML } = require("../utils/sendEmail");

test("email-change OTP email uses the branded template with 5-minute expiry", () => {
  const html = buildEmailHTML("123456", "email-change", "Dr. <b>Evil</b> & Co");
  assert.match(html, /logo-email\.png/);
  assert.match(html, /logo-footer\.png/);
  assert.match(html, /Email Verification/);
  assert.match(html, /Confirm your new email/);
  assert.match(html, /change the email address associated with your Humancare Connect doctor account/);
  assert.match(html, /Your one-time secure code/);
  assert.match(html, />123456</);
  assert.match(html, /Valid for <strong>5 minutes<\/strong>/);
  assert.doesNotMatch(html, /10 minutes/);
  assert.match(html, /Do not share this code/);
  assert.match(html, /support@humancareconnect\.co/);
  assert.match(html, /\+1 302-303-9993/);
  assert.match(html, /humancareconnect\.co\/privacy/);
  assert.match(html, /Hello Dr\. &lt;b&gt;Evil&lt;\/b&gt; &amp; Co,/);
  assert.doesNotMatch(html, /<b>Evil/);
});

test("email-change greeting falls back without a name", () => {
  assert.match(buildEmailHTML("111111", "email-change"), /Hello,/);
});

test("registration and reset emails are unchanged (10 minutes)", () => {
  const reg = buildEmailHTML("654321", "register", "Asha");
  assert.match(reg, /Email Verification/);
  assert.match(reg, /Valid for <strong>10 minutes<\/strong>/);
  assert.match(reg, /complete your registration/);
  assert.doesNotMatch(reg, /Confirm your new email/);
  const reset = buildEmailHTML("654321", "reset", "Asha");
  assert.match(reset, /Password Reset/);
  assert.match(reset, /Valid for <strong>10 minutes<\/strong>/);
});
