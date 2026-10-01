const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { maskIp, resolveMaskedIp } = require("../utils/maskIp");

describe("maskIp", () => {
  test("masks the last IPv4 octet", () => {
    assert.equal(maskIp("92.84.12.55"), "92.84.12.xxx");
  });

  test("masks an IPv4-mapped IPv6 address as IPv4", () => {
    assert.equal(maskIp("::ffff:203.0.113.9"), "203.0.113.xxx");
  });

  test("truncates IPv6 to the first 4 hextets", () => {
    assert.equal(maskIp("2001:db8:1234:5678:9abc:def0:1234:5678"), "2001:db8:1234:5678::xxxx");
  });

  test("empty/invalid input returns empty string, never throws", () => {
    assert.equal(maskIp(""), "");
    assert.equal(maskIp(undefined), "");
    assert.equal(maskIp("not-an-ip"), "");
  });

  test("never returns a value equal to the raw input IP", () => {
    const raw = "203.0.113.9";
    assert.notEqual(maskIp(raw), raw);
  });
});

describe("resolveMaskedIp", () => {
  let prevFlag;
  beforeEach(() => {
    prevFlag = process.env.DIRECT_CALL_IP_LOGGING_ENABLED;
  });
  afterEach(() => {
    process.env.DIRECT_CALL_IP_LOGGING_ENABLED = prevFlag;
  });

  function fakeSocket(address, headers = {}) {
    return { handshake: { address, headers } };
  }

  test("flag ON (default): returns a masked IP, never the full one", () => {
    delete process.env.DIRECT_CALL_IP_LOGGING_ENABLED;
    const result = resolveMaskedIp(fakeSocket("203.0.113.9"));
    assert.equal(result, "203.0.113.xxx");
    assert.notEqual(result, "203.0.113.9");
  });

  test("flag OFF: returns empty string (caller must store nothing)", () => {
    process.env.DIRECT_CALL_IP_LOGGING_ENABLED = "false";
    const result = resolveMaskedIp(fakeSocket("203.0.113.9"));
    assert.equal(result, "");
  });

  test("honors X-Forwarded-For only when TRUST_PROXY is set", () => {
    delete process.env.DIRECT_CALL_IP_LOGGING_ENABLED;
    const prevTrust = process.env.TRUST_PROXY;

    process.env.TRUST_PROXY = "false";
    const untrusted = resolveMaskedIp(
      fakeSocket("10.0.0.1", { "x-forwarded-for": "203.0.113.9" }),
    );
    // Not trusted: falls back to the raw socket address (a private IP here,
    // masked the same way) rather than the spoofable header.
    assert.equal(untrusted, "10.0.0.xxx");

    process.env.TRUST_PROXY = "1";
    const trusted = resolveMaskedIp(
      fakeSocket("10.0.0.1", { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
    );
    assert.equal(trusted, "203.0.113.xxx");

    process.env.TRUST_PROXY = prevTrust;
  });
});
