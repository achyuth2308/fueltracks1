// ============================================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// Catches all unhandled errors and returns standard format
// ============================================================

/**
 * Global error handler - must be last middleware registered
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.stack || err.message);

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry. This record already exists.',
      code: 'DUPLICATE_ENTRY',
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced record does not exist.',
      code: 'FK_VIOLATION',
    });
  }

  // JWT errors (already handled in auth middleware, but just in case)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token.',
      code: 'INVALID_TOKEN',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR',
    });
  }

  // Default 500
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  });
}

module.exports = { errorHandler, notFoundHandler };
