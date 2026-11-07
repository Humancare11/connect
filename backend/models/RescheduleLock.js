const mongoose = require("mongoose");

// One tiny row per doctor. A reschedule increments it inside its transaction, so two admins moving different
// bookings into the same doctor's calendar at the same moment conflict on this row and one of them retries and then
// sees the other's booking (the clash check alone would let both through). Holds no data of its own.
const schema = new mongoose.Schema({
  doctorKey: { type: String, required: true, unique: true },
  n: { type: Number, default: 0 },
});

module.exports = mongoose.model("RescheduleLock", schema);
