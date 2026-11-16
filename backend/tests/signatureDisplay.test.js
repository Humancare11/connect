const test = require("node:test");
const assert = require("node:assert/strict");
const { displaySize, DISPLAY_WIDTH } = require("../utils/signatureDisplay");
const { buildSignatureImageHtml } = require("../services/email/emailHtml");

test("display size: at most 500 wide, proportional, never enlarged", () => {
  assert.equal(DISPLAY_WIDTH, 500);
  assert.deepEqual(displaySize(1000, 330), { width: 500, height: 165 });
  assert.deepEqual(displaySize(600, 200), { width: 500, height: 167 });
  assert.deepEqual(displaySize(400, 100), { width: 400, height: 100 });
  assert.deepEqual(displaySize(0, 0), { width: 0, height: 0 });
});

test("mail HTML: 2x image shown at 500 px with attributes AND css; small gap; nothing cropped", () => {
  const html = buildSignatureImageHtml({ message: "Hello\nKind regards,", notice: "" }, { image: { cid: "x@y", alt: "Signature", width: 1000, height: 330 } });
  assert.match(html, /<img src="cid:x@y" alt="Signature" width="500" height="165" border="0" style="width:500px;max-width:100%;height:auto;display:block;border:0">/);
  assert.match(html, /<div style="margin-top:6px"><img /);
  assert.doesNotMatch(html, /overflow|object-fit|clip/);
});
