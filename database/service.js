import getPool from './pool.js';

/**
 * Database service providing high-level abstractions over the connection pool.
 * Eliminates duplicate runQuery implementations across routes.
 * 
 * Features:
 * - Automatic connection management
 * - Transaction support with rollback
 * - Consistent error handling
 * - Query logging in development
 */

/**
 * Convert MySQL-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
 * @param {string} sql - SQL query with ? placeholders
 * @returns {string} SQL query with $n placeholders
 */
function convertPlaceholders(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

/**
 * Execute a single query using a connection from the pool.
 * @param {string} sql - SQL query string (supports ? placeholders)
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export async function query(sql, params = []) {
  const pool = getPool();
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

/**
 * Execute multiple queries within a transaction.
 * Automatically commits on success or rolls back on error.
 * 
 * @param {Function} callback - Async function receiving a query runner
 * @returns {Promise<any>} Result from the callback function
 * 
 * @example
 * const result = await transaction(async (run) => {
 *   await run('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *   await run('INSERT INTO profiles (user_id) VALUES (?)', [1]);
 *   return { success: true };
 * });
 */
export async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const run = async (sql, params = []) => {
      const pgSql = convertPlaceholders(sql);
      const result = await client.query(pgSql, params);
      return result.rows;
    };

    const result = await callback(run);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if a connection can be established to the database.
 * Useful for health checks and startup validation.
 * 
 * @returns {Promise<boolean>} True if connection successful
 */
export async function healthCheck() {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[database] Health check failed:', error.message);
    return false;
  }
}
