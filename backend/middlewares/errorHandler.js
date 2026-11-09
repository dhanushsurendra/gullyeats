const errorHandler = (err, req, res, next) => {

  // A malformed id in the URL or body (Mongoose CastError) is a bad request.
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid ID" });
  }

  // Controllers set res.status before throwing; body-parser (400 bad JSON,
  // 413 too large), CORS and validators put a 4xx on the error instead.
  const statusCode =
    res.statusCode >= 400
      ? res.statusCode
      : err.status >= 400 && err.status < 500
        ? err.status
        : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

module.exports = errorHandler;
