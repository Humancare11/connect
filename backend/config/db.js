const mongoose = require("mongoose");

// Mongoose query logging is off unless MONGOOSE_DEBUG=true, and never on in production (queries can carry
// patient data and the output is slow and noisy). The boolean form is used (rather than a custom callback) since
// its signature is stable across driver versions, unlike the callback form.
const debugRequested = process.env.MONGOOSE_DEBUG === "true";
const isProduction = process.env.NODE_ENV === "production";
mongoose.set("debug", debugRequested && !isProduction);
if (debugRequested && isProduction) console.warn("[db] MONGOOSE_DEBUG is ignored in production");

// Warn on slow queries in every environment (production included) — this is
// often the only signal that surfaces a missing index before a user
// notices the API got slow. Registered here, before any model file is
// required elsewhere in the app (see server.js's require order), so this
// plugin applies to every schema — mongoose.plugin() only affects schemas
// compiled after it's called.
const SLOW_QUERY_MS = 100;
mongoose.plugin((schema) => {
  schema.pre(/^find/, function () {
    this.__hcQueryStart = Date.now();
  });
  schema.post(/^find/, function () {
    if (!this.__hcQueryStart) return;
    const duration = Date.now() - this.__hcQueryStart;
    if (duration > SLOW_QUERY_MS) {
      console.warn(
        `[slow-query] ${this.model?.collection?.name || "?"}.${this.op || "?"} ${duration}ms`,
        JSON.stringify(this.getQuery ? this.getQuery() : {})
      );
    }
  });
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;
