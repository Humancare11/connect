const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// The old admin endpoints that the unified bookings API replaced answer 410 Gone for one release, and say where to go.
// These read the real routers' route tables, so they check what is really mounted (no database needed).
const verifyToken = require("../middleware/verifyToken");
const retiredEndpoint = require("../middleware/retiredEndpoint");
const categoryRouter = require("../routes/categoryConsultation");
const appointmentsRouter = require("../routes/appointments");
const categoryController = require("../controllers/CategoryConsultationController");
const appointmentController = require("../controllers/appointmentController");

const routesOf = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
      path: layer.route.path,
      handlers: layer.route.stack.map((l) => l.handle),
    }));
const find = (router, method, path) => routesOf(router).find((r) => r.method === method && r.path === path);

const run = (handler) => {
  const out = { status: 200, body: null };
  handler({}, { status(code) { out.status = code; return this; }, json(body) { out.body = body; return this; } });
  return out;
};

const RETIRED = [
  { router: categoryRouter, method: "GET", path: "/", use: "GET /api/admin/bookings" },
  { router: categoryRouter, method: "GET", path: "/:id", use: "GET /api/admin/bookings/:id" },
  { router: categoryRouter, method: "PATCH", path: "/:id/status", use: "POST /api/admin/bookings/:id/confirm, /cancel or /auto-complete" },
  { router: categoryRouter, method: "DELETE", path: "/:id", use: "DELETE /api/admin/bookings/:id (super admin only)" },
  { router: categoryRouter, method: "PATCH", path: "/:id/assign-doctor", use: "POST /api/admin/bookings/:id/assign-doctor (or /alternate-doctor)" },
  { router: appointmentsRouter, method: "GET", path: "/admin/all", use: "GET /api/admin/bookings" },
  { router: appointmentsRouter, method: "PUT", path: "/:id/change-doctor", use: "POST /api/admin/bookings/:id/alternate-doctor (or /assign-doctor for a booking with no doctor)" },
];

test("each retired admin endpoint is still mounted, behind the real admin auth, and answers 410 pointing to the new API", () => {
  for (const { router, method, path, use } of RETIRED) {
    const route = find(router, method, path);
    assert.ok(route, `${method} ${path} is still mounted`);
    assert.equal(route.handlers.length, 3, `${method} ${path}: auth, admin check, then the 410`);
    assert.equal(route.handlers[0], verifyToken.verifyAdminToken, `${method} ${path} checks the token first`);
    assert.equal(route.handlers[1], verifyToken.adminOnly, `${method} ${path} checks the role next`);
    const out = run(route.handlers[2]);
    assert.equal(out.status, 410, `${method} ${path}`);
    assert.equal(out.body.code, "endpoint_retired");
    assert.equal(out.body.use, use);
    assert.match(out.body.msg, /retired/);
    assert.ok(out.body.msg.includes(use), "the message says where to go");
  }
});

test("the replacement endpoints the 410 messages point to really exist", () => {
  const bookings = require("../routes/adminBookings");
  const table = routesOf(bookings).map((r) => `${r.method} ${r.path}`);
  for (const expected of ["GET /", "GET /:id", "DELETE /:id", "POST /:id/assign-doctor", "POST /:id/alternate-doctor", "POST /:id/confirm", "POST /:id/cancel", "POST /:id/auto-complete", "POST /bulk", "PATCH /testing"]) {
    assert.ok(table.includes(expected), expected);
  }
});

test("the patient and doctor routes of category consultations are untouched", () => {
  const table = routesOf(categoryRouter).map((r) => `${r.method} ${r.path}`);
  assert.ok(table.includes("GET /mine"));
  assert.ok(table.includes("GET /doctor/mine"));
  assert.ok(table.includes("POST /"));
  assert.ok(table.indexOf("GET /mine") < table.indexOf("GET /:id"), "/mine stays above /:id so it is not read as an id");
  assert.ok(table.indexOf("GET /doctor/mine") < table.indexOf("GET /:id"));
  assert.equal(find(categoryRouter, "POST", "/").handlers[0], verifyToken.verifyUserToken);
  assert.equal(find(categoryRouter, "GET", "/doctor/mine").handlers[0], verifyToken.verifyDoctorToken);
});

test("the category router has no other routes than these", () => {
  assert.deepEqual(
    routesOf(categoryRouter).map((r) => `${r.method} ${r.path}`).sort(),
    ["DELETE /:id", "GET /", "GET /:id", "GET /doctor/mine", "GET /mine", "PATCH /:id/assign-doctor", "PATCH /:id/status", "POST /"].sort()
  );
});

test("the handlers behind the old endpoints are gone, not just unrouted", () => {
  for (const name of ["getAllCategoryConsultations", "getCategoryConsultationById", "updateCategoryConsultationStatus", "deleteCategoryConsultation", "assignDoctor"]) {
    assert.equal(categoryController[name], undefined, name);
  }
  assert.equal(appointmentController.reassignAppointmentDoctor, undefined);
  assert.equal(appointmentController.getAllAppointments, undefined);
  for (const name of ["createCategoryConsultation", "getMyCategoryConsultations", "getDoctorCategoryConsultations"]) {
    assert.equal(typeof categoryController[name], "function", name);
  }
});

test("retiredEndpoint answers 410 with the pointer and nothing else", () => {
  const out = run(retiredEndpoint("POST /somewhere"));
  assert.equal(out.status, 410);
  assert.deepEqual(out.body, { msg: "This endpoint has been retired. Use POST /somewhere instead.", code: "endpoint_retired", use: "POST /somewhere" });
});

test("every hit on a retired endpoint is logged with the path, the caller's role and the app version headers, and nothing else", () => {
  const lines = [];
  const warn = console.warn;
  console.warn = (...args) => lines.push(args);
  try {
    const res = { status() { return this; }, json() { return this; } };
    retiredEndpoint("POST /somewhere")(
      {
        method: "PUT",
        originalUrl: "/api/appointments/64b000000000000000000001/change-doctor?token=secret",
        user: { id: "u1", role: "admin", email: "a@x.co" },
        headers: { "x-client-platform": "android", "x-app-version": "1.0.0+16", authorization: "Bearer secret", cookie: "c=1" },
      },
      res
    );
    retiredEndpoint("POST /somewhere")({}, res); // a bare request does not break it
  } finally {
    console.warn = warn;
  }
  assert.equal(lines.length, 2);
  assert.equal(lines[0][0], "[retired-endpoint]");
  assert.deepEqual(JSON.parse(lines[0][1]), {
    method: "PUT",
    path: "/api/appointments/64b000000000000000000001/change-doctor",
    role: "admin",
    platform: "android",
    appVersion: "1.0.0+16",
    use: "POST /somewhere",
  });
  assert.doesNotMatch(lines[0][1], /secret|a@x\.co|u1|Bearer/, "no token, email, id or auth header in the log");
  assert.deepEqual(JSON.parse(lines[1][1]), { method: "", path: "", role: "", platform: "", appVersion: "", use: "POST /somewhere" });
});
