const test = require("node:test");
const assert = require("node:assert/strict");
const { displaySize, DISPLAY_WIDTH } = require("../utils/signatureDisplay");
const { buildSignatureImageHtml } = require("../services/email/emailHtml");

test("display size: at most 420 wide, proportional, never enlarged", () => {
  assert.equal(DISPLAY_WIDTH, 420);
  assert.deepEqual(displaySize(1000, 330), { width: 420, height: 139 });
  assert.deepEqual(displaySize(600, 200), { width: 420, height: 140 });
  assert.deepEqual(displaySize(400, 100), { width: 400, height: 100 });
  assert.deepEqual(displaySize(0, 0), { width: 0, height: 0 });
});

test("mail HTML: 2x image shown at 420 px with attributes AND css; small gap; nothing cropped", () => {
  const html = buildSignatureImageHtml({ message: "Hello\nKind regards,", notice: "" }, { image: { cid: "x@y", alt: "Signature", width: 1000, height: 330 } });
  assert.match(html, /<img src="cid:x@y" alt="Signature" width="420" height="139" border="0" style="width:420px;max-width:100%;height:auto;display:block;border:0">/);
  assert.match(html, /<div style="margin-top:6px"><img /);
  assert.doesNotMatch(html, /overflow|object-fit|clip/);
});
