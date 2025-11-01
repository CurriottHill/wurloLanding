/**
 * Shared retry utility with exponential backoff.
 * Use this for all external API calls to handle transient failures.
 */

/**
 * Retry an async operation with exponential backoff.
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay in milliseconds (default: 2000)
 * @param {number} options.maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @param {string} options.operationName - Name for logging (default: 'operation')
 * @returns {Promise<any>} Result from the function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 2000,
    maxDelayMs = 30000,
    operationName = 'operation',
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      const errorMessage = error.message?.toLowerCase() || '';
      const isNonRetryable = 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('invalid') && !errorMessage.includes('timeout');
      
      if (isNonRetryable) {
        console.error(`[retryWithBackoff] ${operationName} - Non-retryable error:`, error.message);
        throw error;
      }
      
      if (attempt === maxRetries) {
        console.error(`[retryWithBackoff] ${operationName} failed after ${maxRetries} attempts:`, error.message);
        throw error;
      }
      
      // Exponential backoff: 2s, 4s, 8s, 16s, 30s (capped)
      const delayMs = Math.min(Math.pow(2, attempt) * initialDelayMs, maxDelayMs);
      console.warn(`[retryWithBackoff] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs/1000}s...`);
      console.warn(`[retryWithBackoff] Error: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

/**
 * Convenience wrapper for retrying API calls with sensible defaults.
 * 
 * @param {Function} fn - Async API call to retry
 * @param {string} apiName - Name of the API for logging
 * @returns {Promise<any>} Result from the API call
 */
export async function retryApiCall(fn, apiName = 'API') {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    initialDelayMs: 2000,
    operationName: `${apiName} request`,
  });
}
