const { test } = require("node:test");
const assert = require("node:assert/strict");
const { encryptEmailContent, decryptEmailContent, encryptSnippet, decryptSnippet } = require("../utils/emailCrypto");

test("the snippet envelope round-trips, is not plain text, and is different every time", () => {
  const a = encryptSnippet("Hello, a short snippet");
  const b = encryptSnippet("Hello, a short snippet");
  assert.equal(decryptSnippet(a), "Hello, a short snippet");
  assert.ok(!JSON.stringify(a).includes("Hello"));
  assert.notEqual(a.cipherText, b.cipherText);
  assert.equal(decryptSnippet(null), "");
  assert.equal(decryptSnippet({}), "");
});

test("a snippet envelope cannot be read as a body, and a body envelope cannot be read as a snippet", () => {
  assert.throws(() => decryptEmailContent(encryptSnippet("x")));
  assert.throws(() => decryptSnippet(encryptEmailContent({ text: "t", html: "", snippet: "s" })));
});

test("a tampered snippet envelope is refused", () => {
  const env = encryptSnippet("secret-ish text");
  const bytes = Buffer.from(env.cipherText, "base64");
  bytes[0] ^= 1;
  assert.throws(() => decryptSnippet({ ...env, cipherText: bytes.toString("base64") }));
});
