const mongoose = require("mongoose");

// One row per admin reschedule of a booking (Appointment or CategoryConsultation). Append-only: rows are only ever
// inserted. Every update and delete (query or document) is refused here, and no route exposes one, so the original
// booking and every later change stay on record. See utils/appointmentReschedule.js.
//
// The dates and times are the strings the booking itself stores (the patient's local clock for an Appointment).
// oldUtc / newUtc are the canonical instants where the booking has them (Appointment only).
const actorSchema = new mongoose.Schema(
  {
    id:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name:  { type: String, default: "" },
    email: { type: String, default: "" },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    appointmentId:    { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    appointmentModel: { type: String, enum: ["Appointment", "CategoryConsultation"], required: true },

    oldDate: { type: String, default: "" },
    oldTime: { type: String, default: "" },
    oldUtc:  { type: Date, default: null },
    newDate: { type: String, required: true },
    newTime: { type: String, required: true },
    newUtc:  { type: Date, default: null },

    // The time zone the date/time strings are in (the patient's), or "" when the booking has none recorded.
    timezone: { type: String, default: "" },

    reason:     { type: String, required: true },
    // Admin-only. Never returned to doctors or patients, never put in a message.
    reasonNote: { type: String, default: "" },

    rescheduledBy: { type: actorSchema, default: () => ({}) },
    rescheduledAt: { type: Date, default: Date.now },
    notified:      { type: Boolean, default: false },

    // Status of the booking at the time, and the doctor it had (Doctor _id for Appointment, Enrollment _id for Category).
    statusAtTime: { type: String, default: "" },
    doctorKey:    { type: String, default: "" },
  },
  { timestamps: false }
);

schema.index({ appointmentId: 1, rescheduledAt: 1 });

const refuse = () => {
  throw new Error("Reschedule history is append-only: rows cannot be changed or deleted.");
};
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  schema.pre(op, refuse);
}
// A document may be inserted once; saving it again or deleting it is refused.
schema.pre("save", function () {
  if (!this.isNew) refuse();
});
schema.pre("deleteOne", { document: true, query: false }, refuse);

module.exports = mongoose.model("AppointmentRescheduleHistory", schema);
