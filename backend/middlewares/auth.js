const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // The apps send a Bearer token; the admin dashboard sends its login
    // cookie (sameSite lax).
    if (!authHeader && !req.cookies?.token) {
      return res.status(401).json({
        message: "Authorization header missing",
      });
    }

    const token = authHeader ? authHeader.split(" ")[1] : req.cookies.token;

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