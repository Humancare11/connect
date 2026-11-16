const { AsyncLocalStorage } = require("async_hooks");
const mongoose = require("mongoose");

// Temporary, UAT-only help for measuring the Email module's slowness: one log line per request
//   [email-timing] GET /messages 200 total=312ms dbCalls=5 dbMs=290
// dbCalls = database queries (find, count, aggregate ...) the request made, dbMs = the SUM of
// their durations (queries that run in parallel overlap, so it can exceed total).
//
// Off unless EMAIL_TIMING_LOG=true, and refused when NODE_ENV=production. Server log only. It
// logs the method, the route pattern ("/messages/:id", never the real id), the status and the
// numbers: no query, no mail data, no ids, no addresses, no token.
const als = new AsyncLocalStorage();
let patched = false;
let warnedProduction = false;

function timingState(env = process.env) {
  if (env.EMAIL_TIMING_LOG !== "true") return { on: false, reason: "flag_off" };
  if (String(env.NODE_ENV || "").toLowerCase() === "production") {
    if (!warnedProduction) {
      warnedProduction = true;
      console.warn("[email-timing] EMAIL_TIMING_LOG is ignored when NODE_ENV=production.");
    }
    return { on: false, reason: "production" };
  }
  return { on: true, reason: "" };
}

// Counts and times every mongoose query / aggregate that runs inside a timed request.
function installDbCounters() {
  if (patched) return;
  patched = true;
  for (const proto of [mongoose.Query.prototype, mongoose.Aggregate.prototype]) {
    const original = proto.exec;
    proto.exec = function timedExec(...args) {
      const store = als.getStore();
      if (!store) return original.apply(this, args);
      const started = process.hrtime.bigint();
      store.calls += 1;
      const done = () => {
        store.dbMs += Number(process.hrtime.bigint() - started) / 1e6;
      };
      return original.apply(this, args).then(
        (result) => {
          done();
          return result;
        },
        (err) => {
          done();
          throw err;
        }
      );
    };
  }
}

function emailTimingMiddleware({ env = process.env, logger = console.log } = {}) {
  return (req, res, next) => {
    if (!timingState(env).on) return next();
    installDbCounters();
    const store = { calls: 0, dbMs: 0 };
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const total = Number(process.hrtime.bigint() - started) / 1e6;
      const route = String(req.route?.path || "?").replace(/[^\w/:\-.]/g, "").slice(0, 60);
      logger(`[email-timing] ${req.method} ${route} ${res.statusCode} total=${Math.round(total)}ms dbCalls=${store.calls} dbMs=${Math.round(store.dbMs)}`);
    });
    als.run(store, next);
  };
}

module.exports = { emailTimingMiddleware, timingState };
