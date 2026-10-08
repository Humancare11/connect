const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("directPinCrypto", () => {
  let prevEnv;
  let prevKey;

  beforeEach(() => {
    prevEnv = process.env.NODE_ENV;
    prevKey = process.env.DIRECT_PIN_ENC_KEY;
    process.env.NODE_ENV = "development";
    delete process.env.DIRECT_PIN_ENC_KEY;
    delete require.cache[require.resolve("../utils/directPinCrypto")];
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    if (prevKey === undefined) delete process.env.DIRECT_PIN_ENC_KEY;
    else process.env.DIRECT_PIN_ENC_KEY = prevKey;
    delete require.cache[require.resolve("../utils/directPinCrypto")];
  });

  test("generatePin produces a 6-digit, zero-padded string", () => {
    const { generatePin } = require("../utils/directPinCrypto");
    for (let i = 0; i < 50; i++) {
      const pin = generatePin();
      assert.match(pin, /^\d{6}$/);
    }
  });

  test("encrypt then decrypt round-trips the original PIN (dev fallback key)", () => {
    const { encryptPin, decryptPin } = require("../utils/directPinCrypto");
    const pin = "042017";
    const encrypted = encryptPin(pin);
    assert.notEqual(encrypted, pin);
    assert.equal(decryptPin(encrypted), pin);
  });

  test("two encryptions of the same PIN produce different ciphertext (random IV)", () => {
    const { encryptPin } = require("../utils/directPinCrypto");
    const a = encryptPin("123456");
    const b = encryptPin("123456");
    assert.notEqual(a, b);
  });

  test("decryptPin('') returns '' without throwing", () => {
    const { decryptPin } = require("../utils/directPinCrypto");
    assert.equal(decryptPin(""), "");
  });

  test("production with no DIRECT_PIN_ENC_KEY refuses to encrypt", () => {
    process.env.NODE_ENV = "production";
    const { encryptPin } = require("../utils/directPinCrypto");
    assert.throws(() => encryptPin("123456"), /DIRECT_PIN_ENC_KEY/);
  });

  test("a real 32-byte hex key round-trips correctly", () => {
    process.env.DIRECT_PIN_ENC_KEY = "11".repeat(32);
    delete require.cache[require.resolve("../utils/directPinCrypto")];
    const { encryptPin, decryptPin } = require("../utils/directPinCrypto");
    const encrypted = encryptPin("999000");
    assert.equal(decryptPin(encrypted), "999000");
  });

  test("a malformed key length throws a clear error", () => {
    process.env.DIRECT_PIN_ENC_KEY = "not-hex-and-too-short";
    delete require.cache[require.resolve("../utils/directPinCrypto")];
    const { encryptPin } = require("../utils/directPinCrypto");
    assert.throws(() => encryptPin("123456"), /64-character hex/);
  });
});
