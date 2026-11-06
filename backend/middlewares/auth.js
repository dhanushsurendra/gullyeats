const jwt = require("jsonwebtoken");

function isAdminOrigin(origin) {
  if (!origin) return false;
  const admins = (process.env.FRONTEND_URL_ADMIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return admins.includes(origin.replace(/\/+$/, ""));
}

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // The apps send a Bearer token. The admin dashboard sends its login
    // cookie: on reads, or on writes from the dashboard's own origin, so
    // other sites can't use a signed-in admin's cookie to change anything.
    const cookieToken =
      req.method === 'GET' || isAdminOrigin(req.headers.origin)
        ? req.cookies?.token
        : undefined;

    if (!authHeader && !cookieToken) {
      return res.status(401).json({
        message: "Authorization header missing",
      });
    }

    const token = authHeader ? authHeader.split(" ")[1] : cookieToken;

    if (!token) {
      return res.status(401).json({
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      _id: decoded._id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;