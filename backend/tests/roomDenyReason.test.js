const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DENY_REASONS,
  normalizeDenyReason,
  classifyAppointmentLookupError,
} = require("../utils/roomDenyReason");

test("known reasons pass through unchanged", () => {
  for (const reason of DENY_REASONS) assert.equal(normalizeDenyReason(reason), reason);
});

test("legacy and unknown reasons are normalised", () => {
  assert.equal(normalizeDenyReason("missing_appointment"), "invalid_appointment");
  assert.equal(normalizeDenyReason("something_else"), "server_error");
  assert.equal(normalizeDenyReason(undefined), "server_error");
});

test("malformed ids are permanent, other lookup errors are transient", () => {
  assert.equal(classifyAppointmentLookupError({ name: "CastError" }), "invalid_appointment");
  assert.equal(classifyAppointmentLookupError({ name: "BSONError" }), "invalid_appointment");
  assert.equal(classifyAppointmentLookupError(new Error("connection timed out")), "server_error");
  assert.equal(classifyAppointmentLookupError(null), "server_error");
});
