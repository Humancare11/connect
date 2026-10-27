// An admin endpoint that the unified bookings API (/api/admin/bookings) has replaced. For one release it
// answers 410 Gone and says where to go, instead of disappearing with a plain 404. Mount it AFTER the auth
// middleware, so only a signed-in admin is told anything.
//
//   router.put("/:id/change-doctor", verifyAdminToken, adminOnly, retiredEndpoint("POST /api/admin/bookings/:id/alternate-doctor"));
//
// Every hit is logged (one line, [retired-endpoint]) with the method, the path without its query string, the caller's
// role, and the X-Client-Platform / X-App-Version headers when the caller is an app. Nothing else about the caller is
// logged. The stubs are removed only when these logs show no hits for two weeks after the next mobile and doctor app
// releases are live (see docs/admin-bookings-deploy.md).
const header = (req, name) => {
  const value = req?.headers?.[name];
  return typeof value === "string" ? value.slice(0, 40) : "";
};

const describeHit = (req) => ({
  method: String(req?.method || ""),
  path: String(req?.originalUrl || req?.url || "").split("?")[0].slice(0, 200),
  role: String(req?.user?.role || ""),
  platform: header(req, "x-client-platform"),
  appVersion: header(req, "x-app-version"),
});

const retiredEndpoint = (use) => (req, res) => {
  console.warn("[retired-endpoint]", JSON.stringify({ ...describeHit(req), use }));
  return res.status(410).json({
    msg: `This endpoint has been retired. Use ${use} instead.`,
    code: "endpoint_retired",
    use,
  });
};

retiredEndpoint.describeHit = describeHit;
module.exports = retiredEndpoint;
