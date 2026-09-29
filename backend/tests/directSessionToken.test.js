const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { signSessionToken, verifySessionToken } = require("../utils/directSessionToken");

describe("directSessionToken", () => {
  let prevSecret;
  beforeEach(() => {
    prevSecret = process.env.DIRECT_SESSION_SECRET;
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.DIRECT_SESSION_SECRET;
    else process.env.DIRECT_SESSION_SECRET = prevSecret;
  });

  test("a signed token verifies back to the same payload", () => {
    const token = signSessionToken({ roomId: "room1", role: "doctor", sessionId: "sess-abc" });
    const decoded = verifySessionToken(token);
    assert.deepEqual(decoded, { roomId: "room1", role: "doctor", sessionId: "sess-abc" });
  });

  test("a tampered payload fails verification", () => {
    const token = signSessionToken({ roomId: "room1", role: "doctor", sessionId: "sess-abc" });
    const [body, sig] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ roomId: "room1", role: "patient", sessionId: "sess-abc" }), "utf8").toString("base64url");
    assert.equal(verifySessionToken(`${tamperedPayload}.${sig}`), null);
  });

  test("a tampered signature fails verification", () => {
    const token = signSessionToken({ roomId: "room1", role: "doctor", sessionId: "sess-abc" });
    const [body] = token.split(".");
    assert.equal(verifySessionToken(`${body}.wrongsignature`), null);
  });

  test("garbage input never throws, just returns null", () => {
    assert.equal(verifySessionToken(""), null);
    assert.equal(verifySessionToken(null), null);
    assert.equal(verifySessionToken(undefined), null);
    assert.equal(verifySessionToken("not-a-token-at-all"), null);
    assert.equal(verifySessionToken("a.b.c"), null);
  });

  test("tokens signed with different secrets don't cross-verify", () => {
    process.env.DIRECT_SESSION_SECRET = "secret-one";
    const token = signSessionToken({ roomId: "room1", role: "doctor", sessionId: "sess-abc" });
    process.env.DIRECT_SESSION_SECRET = "secret-two";
    assert.equal(verifySessionToken(token), null);
  });
});
