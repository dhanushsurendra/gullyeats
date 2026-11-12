const GENERIC = "Something went wrong. Please try again.";

const errorHandler = (err, req, res, next) => {

  // A malformed id in the URL or body (Mongoose CastError) is a bad request.
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid ID" });
  }

  // Controllers set res.status before throwing; body-parser (400 bad JSON,
  // 413 too large), CORS and validators put a 4xx on the error instead.
  const chosen =
    res.statusCode >= 400
      ? res.statusCode
      : err.status >= 400 && err.status < 500
        ? err.status
        : null;

  // Anything else is unexpected (a database or code error): its text can name
  // internals or whole documents, so it goes to the log, not the client.
  if (!chosen) console.error(`${req.method} ${req.originalUrl}:`, err);

  res.status(chosen || 500).json({
    success: false,
    message: (chosen && err.message) || GENERIC,
  });
};

module.exports = errorHandler;
