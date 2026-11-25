import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dobError, genderError, profileIsComplete, isProfileIncompleteError, todayIst } from "./patientProfile.js";

const NOW = new Date("2026-11-24T10:00:00Z");

describe("dobError", () => {
  test("accepts normal dates, today, and 1900-01-01", () => {
    assert.equal(dobError("1990-05-17", NOW), "");
    assert.equal(dobError("2026-11-24", NOW), "");
    assert.equal(dobError("1900-01-01", NOW), "");
  });
  test("rejects empty, bad format, impossible, future and pre-1900", () => {
    for (const bad of ["", "  ", undefined, null, "17-05-1990", "1990-02-30", "1899-12-31", "2026-11-26"]) {
      assert.notEqual(dobError(bad, NOW), "", `should reject ${bad}`);
    }
    assert.match(dobError("2999-01-01", NOW), /future/);
  });
  test("today is the India date", () => {
    const late = new Date("2026-11-24T19:00:00Z");
    assert.equal(todayIst(late), "2026-11-25");
    assert.equal(dobError("2026-11-25", late), "");
  });
});

describe("profileIsComplete", () => {
  test("needs both a usable DOB and a gender from the list", () => {
    assert.equal(profileIsComplete({ dob: "1990-01-01", gender: "Male" }), true);
    assert.equal(profileIsComplete({ dob: "1990-01-01", gender: "" }), false);
    assert.equal(profileIsComplete({ dob: "", gender: "Female" }), false);
    assert.equal(profileIsComplete({ dob: "bad", gender: "Other" }), false);
    assert.equal(profileIsComplete({ dob: "1990-01-01", gender: "male" }), false);
    assert.equal(profileIsComplete(null), false);
    assert.equal(profileIsComplete({}), false);
  });
  test("genderError", () => {
    assert.equal(genderError("Other"), "");
    assert.notEqual(genderError(""), "");
  });
});

describe("isProfileIncompleteError", () => {
  test("only the 422 PROFILE_INCOMPLETE answer counts", () => {
    assert.equal(isProfileIncompleteError({ response: { status: 422, data: { code: "PROFILE_INCOMPLETE" } } }), true);
    assert.equal(isProfileIncompleteError({ response: { status: 422, data: { code: "OTHER" } } }), false);
    assert.equal(isProfileIncompleteError({ response: { status: 400, data: { code: "PROFILE_INCOMPLETE" } } }), false);
    assert.equal(isProfileIncompleteError(new Error("x")), false);
    assert.equal(isProfileIncompleteError(null), false);
  });
});
