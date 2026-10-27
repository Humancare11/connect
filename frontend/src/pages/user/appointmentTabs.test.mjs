import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentTab, groupAppointments, pendingNote } from "./appointmentTabs.js";

test("Assigned is pending, not confirmed, even when it has a doctor", () => {
  assert.equal(appointmentTab("assigned"), "pending");
  const groups = groupAppointments([{ _id: "a", status: "assigned", doctorId: { _id: "d1" } }]);
  assert.deepEqual(groups.confirmed, []);
  assert.deepEqual(groups.pending.map((a) => a._id), ["a"]);
});

test("only a confirmed booking is in the Confirmed tab (the one with Join)", () => {
  assert.equal(appointmentTab("confirmed"), "confirmed");
  for (const status of ["requested", "upcoming", "pending", "assigned", "complete", "completed", "cancelled", ""]) {
    assert.notEqual(appointmentTab(status), "confirmed", status);
  }
});

test("every status lands in exactly one tab, so the tab counts add up", () => {
  const statuses = ["requested", "upcoming", "pending", "assigned", "confirmed", "complete", "completed"];
  const appointments = statuses.map((status, i) => ({ _id: String(i), status }));
  const groups = groupAppointments(appointments);
  assert.deepEqual(groups.pending.map((a) => a.status), ["requested", "upcoming", "pending", "assigned"]);
  assert.deepEqual(groups.confirmed.map((a) => a.status), ["confirmed"]);
  assert.deepEqual(groups.completed.map((a) => a.status), ["complete", "completed"]);
  assert.equal(groups.pending.length + groups.confirmed.length + groups.completed.length, statuses.length);
});

test("cancelled and unknown statuses are in no tab, as before", () => {
  const groups = groupAppointments([{ status: "cancelled" }, { status: "mystery" }, {}, null]);
  assert.deepEqual(groups, { pending: [], confirmed: [], completed: [] });
});

test("the waiting note: no doctor yet versus waiting for the doctor to confirm", () => {
  assert.equal(pendingNote("upcoming"), "Awaiting admin review and doctor assignment");
  assert.equal(pendingNote("requested"), "Awaiting admin review and doctor assignment");
  assert.equal(pendingNote("assigned"), "Awaiting doctor confirmation");
  assert.equal(pendingNote("pending"), "Awaiting doctor confirmation");
});
