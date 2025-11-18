/**
 * CORS Configuration Utility
 * 
 * Provides shared CORS configuration for both landing page and app servers.
 * Supports wildcard domains (e.g., https://*.pages.dev) for flexible deployment.
 */

/**
 * Build list of allowed origins from environment variables and defaults
 * @param {string} frontendUrl - Default frontend URL
 * @param {string} backendUrl - Default backend URL
 * @returns {Array<string>} List of allowed origins
 */
export function buildAllowedOrigins(frontendUrl, backendUrl) {
  const defaultOrigins = Array.from(new Set([
    frontendUrl,
    backendUrl
  ].filter(Boolean)));

  const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaultOrigins, ...envOrigins].filter(Boolean)));
}

/**
 * Create CORS options for Express server
 * @param {Array<string>} allowedOrigins - List of allowed origins
 * @param {Array<string>} methods - HTTP methods to allow (default: GET, POST, OPTIONS)
 * @returns {Object} CORS options object
 */
export function createCorsOptions(allowedOrigins, methods = ['GET', 'POST', 'OPTIONS']) {
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, postman, etc.)
      if (!origin) return callback(null, true);
      
      // If no allowed origins configured, allow all
      if (allowedOrigins.length === 0) return callback(null, true);
      
      // Check if origin matches any allowed origins (including wildcards)
      const isAllowed = allowedOrigins.some(allowed => {
        // Exact match
        if (allowed === origin) return true;
        
        // Wildcard match (e.g., https://*.pages.dev)
        if (allowed.includes('*')) {
          const pattern = allowed
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*/g, '.*'); // Replace * with regex .*
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(origin);
        }
        
        return false;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
  };
}
