const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Enrollment = require("../models/Enrollment");
const { decideAppointmentAccess, deniedMessage } = require("../utils/appointmentRoomAccess");

const STORED = {
  appointment: { upcoming: "upcoming", requested: "requested", pending: "pending", assigned: "assigned", confirmed: "confirmed", complete: "complete", completed: "completed", cancelled: "cancelled" },
  category: { pending: "Pending", assigned: "Assigned", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" },
};

describe("appointment call room access", () => {
  let mongod, patientId, doctorId, enrollment, strangerId;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), Enrollment.deleteMany({})]);
    patientId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    strangerId = new mongoose.Types.ObjectId();
    enrollment = await Enrollment.create({ firstName: "Nobita", surname: "Mestry", doctorId, approvalStatus: "approved" });
  });

  const make = (kind, status) =>
    kind === "appointment"
      ? Appointment.create({ patientId, doctorId, date: "2026-11-01", time: "10:00 AM", status: STORED.appointment[status] })
      : CategoryConsultation.create({
          concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-01", slot: "10:00 AM",
          patientId, assignedDoctorId: enrollment._id, status: STORED.category[status],
        });

  const patient = (id = patientId) => ({ userId: String(id), role: "user" });
  const doctor = (id = doctorId) => ({ userId: String(id), role: "doctor" });
  const decide = (identity, booking) => decideAppointmentAccess(identity, String(booking._id));

  for (const kind of ["appointment", "category"]) {
    describe(kind, () => {
      test("a confirmed booking lets its patient and its doctor in", async () => {
        const b = await make(kind, "confirmed");
        const p = await decide(patient(), b);
        assert.equal(p.allowed, true);
        assert.equal(p.reason, "participant");
        const d = await decide(doctor(), b);
        assert.equal(d.allowed, true);
        assert.equal(d.reason, "participant");
      });

      test("Pending and Assigned are denied with not_confirmed, for patient and doctor", async () => {
        for (const status of ["pending", "assigned"]) {
          const b = await make(kind, status);
          for (const who of [patient(), doctor()]) {
            const result = await decide(who, b);
            assert.equal(result.allowed, false, `${status} ${who.role}`);
            assert.equal(result.reason, "not_confirmed", `${status} ${who.role}`);
          }
        }
      });

      test("Complete and Cancelled are denied as ended", async () => {
        for (const status of ["completed", "cancelled"]) {
          const b = await make(kind, status);
          for (const who of [patient(), doctor()]) {
            const result = await decide(who, b);
            assert.equal(result.allowed, false, `${status} ${who.role}`);
            assert.equal(result.reason, "appointment_ended", `${status} ${who.role}`);
          }
        }
      });

      test("someone who is not on the booking is denied, and learns nothing about its status", async () => {
        for (const status of ["confirmed", "assigned", "pending"]) {
          const b = await make(kind, status);
          for (const who of [patient(strangerId), doctor(strangerId)]) {
            const result = await decide(who, b);
            assert.equal(result.allowed, false, `${status} ${who.role}`);
            assert.equal(result.reason, "not_participant", `${status} ${who.role}`);
          }
        }
      });

      test("a role that is neither patient nor doctor is denied", async () => {
        const b = await make(kind, "confirmed");
        const result = await decide({ userId: String(patientId), role: "admin" }, b);
        assert.equal(result.allowed, false);
        assert.equal(result.reason, "not_participant");
      });
    });
  }

  test("a confirmed category booking is denied to a doctor whose enrollment is not the assigned one", async () => {
    const b = await make("category", "confirmed");
    const otherDoctorId = new mongoose.Types.ObjectId();
    await Enrollment.create({ firstName: "Other", surname: "Doc", doctorId: otherDoctorId, approvalStatus: "approved" });
    const result = await decide(doctor(otherDoctorId), b);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "not_participant");
  });

  test("regular statuses that mean 'not yet' are denied: upcoming and requested", async () => {
    for (const status of ["upcoming", "requested"]) {
      const b = await make("appointment", status);
      assert.equal((await decide(patient(), b)).reason, "not_confirmed", status);
    }
  });

  test("unknown and malformed ids", async () => {
    assert.equal((await decideAppointmentAccess(patient(), String(new mongoose.Types.ObjectId()))).reason, "appointment_not_found");
    assert.equal((await decideAppointmentAccess(patient(), "not-an-id")).reason, "invalid_appointment");
  });

  test("server.js uses this decision for joining, and sends its reason and text with room-access-denied", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
    assert.match(source, /return decideAppointmentAccess\(identity, appointmentId\);/);
    assert.match(
      source,
      /socket\.emit\("room-access-denied", \{\s*msg: deniedMessage\(access\.reason, access\.identity\?\.role\),\s*reason: access\.reason,\s*\}\);/
    );
  });

  test("the denial text is clear for not_confirmed and generic otherwise", () => {
    assert.equal(
      deniedMessage("not_confirmed", "user"),
      "Your doctor hasn't confirmed this appointment yet. You can join once it's confirmed."
    );
    assert.match(deniedMessage("not_confirmed", "doctor"), /Confirm it from your dashboard/);
    for (const reason of ["not_participant", "appointment_ended", "unauthenticated", undefined]) {
      assert.equal(deniedMessage(reason, "user"), "Access to this call room was denied.");
    }
  });
});
