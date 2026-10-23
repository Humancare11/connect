// An admin endpoint that the unified bookings API (/api/admin/bookings) has replaced. For one release it
// answers 410 Gone and says where to go, instead of disappearing with a plain 404. Mount it AFTER the auth
// middleware, so only a signed-in admin is told anything.
//
//   router.put("/:id/change-doctor", verifyAdminToken, adminOnly, retiredEndpoint("POST /api/admin/bookings/:id/alternate-doctor"));
const retiredEndpoint = (use) => (req, res) =>
  res.status(410).json({
    msg: `This endpoint has been retired. Use ${use} instead.`,
    code: "endpoint_retired",
    use,
  });

module.exports = retiredEndpoint;
