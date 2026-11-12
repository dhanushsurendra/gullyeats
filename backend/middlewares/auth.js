const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Cart = require("../models/Cart");

const DISABLED = "This account has been disabled. Please contact GullyEats support.";

// Tokens last 30 days, so a vendor GullyEats disables (and their staff) are
// refused here, not only at login.
async function isDisabled({ _id, role }) {
  if (!mongoose.isValidObjectId(String(_id))) return true;
  const user = await User.findById(_id).select("disabledAt cartId").lean();
  if (!user) return true;
  if (user.disabledAt) return true;
  if (role !== "staff" || !user.cartId) return false;
  const cart = await Cart.findById(user.cartId).select("userId").lean();
  const owner = cart && (await User.findById(cart.userId).select("disabledAt").lean());
  return Boolean(owner?.disabledAt);
}

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
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }

  if (req.user.role === "admin") return next();
  // 401, not 403: the session itself is over, so the apps sign out (they do
  // on 401). Logging in again then shows the disabled message (403).
  isDisabled(req.user).then(
    (disabled) =>
      disabled ? res.status(401).json({ success: false, message: DISABLED }) : next(),
    next,
  );
};

module.exports = authMiddleware;