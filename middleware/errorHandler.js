/**
 * Custom error class for application-specific errors.
 * Extends Error with HTTP status code and error code support.
 */
export class AppError extends Error {
  /**
   * @param {string} message - User-friendly error message
   * @param {Object} options - Error configuration
   * @param {number} [options.status=500] - HTTP status code
   * @param {string} [options.code='ERROR'] - Machine-readable error code
   */
  constructor(message, { status = 500, code = 'ERROR' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
  }
}

/**
 * Map database errors to user-friendly responses.
 * 
 * @param {Error} error - Database error object
 * @param {string} [context='operation'] - Context for error message
 * @returns {Object} Mapped error with status, code, and message
 */
export function mapDatabaseError(error, context = 'operation') {
  if (error?.code === 'ER_DUP_ENTRY') {
    return {
      status: 409,
      code: 'DUPLICATE_ENTRY',
      message: 'This record already exists.',
    };
  }

  if (error?.code === 'PROTOCOL_CONNECTION_LOST' || error?.code === 'ECONNREFUSED') {
    return {
      status: 503,
      code: 'DB_UNAVAILABLE',
      message: 'Database is temporarily unavailable. Please try again.',
    };
  }

  if (error?.message?.toLowerCase().includes('timeout')) {
    return {
      status: 504,
      code: 'TIMEOUT',
      message: 'The request took too long. Please try again.',
    };
  }

  return {
    status: 500,
    code: 'DATABASE_ERROR',
    message: `Unable to complete ${context}. Please try again.`,
  };
}

/**
 * Global Express error handler middleware.
 * Catches all errors and returns consistent JSON responses.
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function globalErrorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('[Error]', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
  }

  // Handle database errors
  if (err.code && err.code.startsWith('ER_')) {
    const mapped = mapDatabaseError(err, 'database operation');
    return res.status(mapped.status).json({
      error: mapped.message,
      code: mapped.code,
    });
  }

  // Default to 500 Internal Server Error
  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred.';

  return res.status(status).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
  });
}

/**
 * Async route wrapper to catch promise rejections.
 * Eliminates need for try/catch in every route handler.
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped route handler
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await db.query('SELECT * FROM users');
 *   res.json(users);
 * }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
