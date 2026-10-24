import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignUrl, buildView, doctorDisplayName, isCurrentDoctor, listUrl, rankDoctors, safeListQuery, savedMessage, scoreDoctor,
} from "./assignPageLogic.js";

test("the list's tab, Hide testing and page travel to the assign page and back; nothing else does", () => {
  assert.equal(safeListQuery("?tab=confirmed&page=3&hideTesting=1"), "tab=confirmed&hideTesting=1&page=3");
  assert.equal(safeListQuery("tab=all&evil=http://x.test&page=../../a"), "tab=all");
  assert.equal(safeListQuery(""), "");
  assert.equal(safeListQuery(null), "");
  assert.equal(listUrl("tab=assigned&page=2"), "/admin-dashboard/appointments?tab=assigned&page=2");
  assert.equal(listUrl(""), "/admin-dashboard/appointments");
  assert.equal(listUrl("tab=<script>"), "/admin-dashboard/appointments");
  assert.equal(assignUrl("abc", "?tab=pending&page=2"), "/admin-dashboard/appointments/abc/assign?from=tab%3Dpending%26page%3D2");
  assert.equal(assignUrl("abc", ""), "/admin-dashboard/appointments/abc/assign");
  // round trip: the link the list builds is read back to the same list address
  const from = new URLSearchParams(assignUrl("abc", "?tab=complete&hideTesting=1&page=4").split("?")[1]).get("from");
  assert.equal(listUrl(from), "/admin-dashboard/appointments?tab=complete&hideTesting=1&page=4");
});

const doctors = [
  { id: "e1", doctorId: 10001, mongoId: "m1", name: "Martin Perlin", specialty: "Cardiology", country: "US" },
  { id: "e2", doctorId: 10002, mongoId: "m2", name: "Nobita Mestry", specialty: "General Medicine", country: "IN", experience: 12 },
  { id: "e3", doctorId: 10003, mongoId: "m3", name: "Farah Siddiqui", specialty: "Dermatology", country: "AE" },
];

test("doctors are ranked by specialty, then country, then licence country, then fit, then name (the old page's order)", () => {
  assert.deepEqual(rankDoctors(doctors, { specialty: "Dermatology", country: "IN" }, "").map((d) => d.name), ["Farah Siddiqui", "Nobita Mestry", "Martin Perlin"]);
  assert.deepEqual(rankDoctors(doctors, { specialty: "", country: "IN" }, "").map((d) => d.name), ["Nobita Mestry", "Farah Siddiqui", "Martin Perlin"]);
  assert.deepEqual(rankDoctors(doctors, {}, "").map((d) => d.name), ["Nobita Mestry", "Farah Siddiqui", "Martin Perlin"], "no fit: 10+ years of experience first, then by name");
  assert.ok(scoreDoctor(doctors[1], { specialty: "general", country: "IN" }).score > scoreDoctor(doctors[1], { specialty: "x", country: "IN" }).score);
});

test("the search matches name, id, specialty and country; an empty list or no match is fine", () => {
  assert.deepEqual(rankDoctors(doctors, {}, "cardio").map((d) => d.id), ["e1"]);
  assert.deepEqual(rankDoctors(doctors, {}, "10003").map((d) => d.id), ["e3"]);
  assert.deepEqual(rankDoctors(doctors, {}, "  IN ").map((d) => d.id).sort(), ["e1", "e2"], "Martin (name) and a doctor in IN (country)");
  assert.deepEqual(rankDoctors(doctors, {}, "zzzz"), []);
  assert.deepEqual(rankDoctors(null, {}, ""), []);
  assert.equal(doctorDisplayName("Nobita Mestry"), "Dr. Nobita Mestry");
  assert.equal(doctorDisplayName("Dr. Nobita Mestry"), "Dr. Nobita Mestry");
  assert.equal(doctorDisplayName(""), "Doctor");
});

const row = (over = {}) => ({ kind: "appointment", status: "assigned", doctorName: "Martin Perlin", originalDoctorName: "", patient: { name: "Rachel", country: "US" }, ...over });

test("a regular appointment is shown from the appointment record, as the old page did", () => {
  const appointment = { patientId: { name: "Rachel S", country: "US" }, category: "Travel", specialty: "Cardiology", condition: "Chest pain", date: "2026-11-01", time: "10:00 AM", doctorId: { _id: "m1", name: "Martin Perlin" } };
  const view = buildView(row(), appointment, undefined);
  assert.equal(view.patientName, "Rachel S");
  assert.equal(view.category, "Travel");
  assert.equal(view.time, "10:00 AM");
  assert.equal(view.hasDoctor, true);
  assert.equal(view.needsTime, false);
  assert.equal(view.closed, false);
  assert.deepEqual(view.fit, { specialty: "Cardiology", category: "Travel", condition: "Chest pain", country: "US" });
  assert.equal(isCurrentDoctor(doctors[0], view), true);
  assert.equal(isCurrentDoctor(doctors[1], view), false);
});

test("a category consultation is shown from its detail; a Next Available one with no doctor needs a time", () => {
  const detail = { concern: "Rash", severity: "mild", supportType: "chat", urgency: "next", timeWindow: "", appointmentType: "NEXT_AVAILABLE", assignedSlot: null, specialtyName: "Dermatology", categoryName: "Skin", assignedDoctorId: null };
  const view = buildView(row({ kind: "category", doctorName: null, status: "upcoming" }), null, detail);
  assert.equal(view.concern, "Rash");
  assert.equal(view.needsTime, true);
  assert.equal(view.hasDoctor, false);
  assert.equal(view.initialTime, "");
  assert.deepEqual(view.fit, { specialty: "Dermatology", category: "Skin", condition: undefined, country: "US" });

  const flexible = buildView(row({ kind: "category", doctorName: null }), null, { ...detail, appointmentType: "FLEXIBLE_TIME", slot: "05:30 PM" });
  assert.equal(flexible.needsTime, false);
  assert.equal(flexible.slotText, "05:30 PM");

  const withDoctor = buildView(row({ kind: "category" }), null, { ...detail, assignedDoctorId: "e2", assignedSlot: "04:00 PM" });
  assert.equal(withDoctor.needsTime, false, "no time is asked when changing the doctor");
  assert.equal(withDoctor.slotText, "04:00 PM");
  assert.equal(isCurrentDoctor(doctors[1], withDoctor), true);
  assert.equal(isCurrentDoctor(doctors[0], withDoctor), false);
});

test("a booking whose doctor no longer exists is treated as having none; a Complete or Cancelled one is closed", () => {
  const view = buildView(row({ doctorName: null }), { doctorId: null }, undefined);
  assert.equal(view.hasDoctor, false);
  assert.equal(isCurrentDoctor(doctors[0], view), false);
  assert.equal(buildView(row({ status: "complete" }), {}, undefined).closed, true);
  assert.equal(buildView(row({ status: "cancelled" }), {}, undefined).closed, true);
  assert.equal(buildView(row({ status: "confirmed" }), {}, undefined).closed, false);
});

test("the original doctor is carried so the page can offer Go back", () => {
  assert.equal(buildView(row({ originalDoctorName: "Old Doc" }), {}, undefined).originalDoctorName, "Old Doc");
  assert.equal(buildView(row(), {}, undefined).originalDoctorName, "");
});

test("the toast after saving says the doctor still has to confirm", () => {
  assert.match(savedMessage("assign"), /need to confirm/);
  assert.match(savedMessage("alternate"), /new doctor needs to confirm/);
  assert.equal(savedMessage("revert", "Dr Old"), "The booking is back with Dr Old. They need to confirm it.");
});
