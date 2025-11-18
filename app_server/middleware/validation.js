import { AppError } from './errorHandler.js';

/**
 * Validation utilities for request data.
 * Throws AppError with 400 status on validation failure.
 */

/**
 * Validate that required fields exist and are non-empty strings.
 * 
 * @param {Object} data - Data object to validate
 * @param {string[]} fields - Array of required field names
 * @throws {AppError} If any required field is missing or empty
 * 
 * @example
 * validateRequired(req.body, ['email', 'password']);
 */
export function validateRequired(data, fields) {
  for (const field of fields) {
    const value = data[field];
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new AppError(`Field '${field}' is required.`, {
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    }
  }
}

/**
 * Sanitize text input by removing control characters and dangerous symbols.
 * 
 * @param {any} value - Input value to sanitize
 * @returns {string} Sanitized string or empty string if invalid
 */
export function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
    .replace(/[<>`$]/g, '') // Remove potentially dangerous characters
    .trim();
}

/**
 * Normalize an array value from various input formats.
 * 
 * @param {any} value - Value to convert to array
 * @returns {Array} Normalized array
 */
export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON, try splitting
    }
    return trimmed.split(/\s*,\s*/).filter(Boolean);
  }
  return [];
}

/**
 * Clamp a numeric value between min and max, with fallback.
 * 
 * @param {any} value - Value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {number} fallback - Default value if input is invalid
 * @returns {number} Clamped value
 */
export function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Express middleware to validate request body contains required fields.
 * 
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/users', requireFields(['name', 'email']), (req, res) => {
 *   // req.body.name and req.body.email are guaranteed to exist
 * });
 */
export function requireFields(requiredFields) {
  return (req, res, next) => {
    try {
      validateRequired(req.body, requiredFields);
      next();
    } catch (error) {
      next(error);
    }
  };
}
