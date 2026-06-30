/** Wrap async route handlers so thrown errors reach Express. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Central error handler. */
function errorHandler(err, req, res, _next) {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal Server Error' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

/** 404 handler for unmatched routes. */
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { asyncHandler, errorHandler, notFound };
