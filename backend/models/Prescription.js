const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  dosage:    { type: String, default: "" },
  frequency: { type: String, default: "" },
  duration:  { type: String, default: "" },
  notes:     { type: String, default: "" },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",      required: true },
    patientId:     { type: mongoose.Schema.Types.ObjectId, ref: "User",        required: true },
    diagnosis:     { type: String, required: true },
    medicines:     { type: [medicineSchema], default: [] },
    instructions:  { type: String, default: "" },
    followUpDate:  { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
