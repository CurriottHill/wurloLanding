/**
 * Validation Utilities
 * 
 * Shared validation functions for both servers.
 */

/**
 * Validate email format using regex
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Sanitize and normalize email input
 * @param {string} email - Raw email input
 * @returns {string} Sanitized lowercase email
 */
export function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
