const jwt = require("jsonwebtoken");

// Generic auth middleware — tries userToken cookie, then Authorization header
module.exports = function (req, res, next) {
  const token =
    req.cookies?.userToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) return res.status(401).json({ msg: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user ? decoded.user : decoded;
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
};
