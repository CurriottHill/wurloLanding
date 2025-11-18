import dotenv from 'dotenv';
import pkg from 'pg';

const { Pool } = pkg;

dotenv.config();

/**
 * PostgreSQL connection pool singleton.
 * Provides automatic connection management and prevents connection exhaustion.
 */
let pool = null;

/**
 * Initialize and return the PostgreSQL connection pool.
 * 
 * @returns {Pool} Configured PostgreSQL connection pool
 * @throws {Error} If required environment variables are missing
 */
export default function getPool() {
  if (!pool) {
    const connectionString = process.env.DB_HOST;

    if (!connectionString) {
      throw new Error(
        'Database configuration incomplete. Ensure DB_HOST is set in .env with PostgreSQL connection string'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
    });

    pool.connect()
      .then((client) => {
        client.release();
        console.log('✅ PostgreSQL connection pool initialized');
      })
      .catch((err) => {
        console.error('Error connecting to PostgreSQL:', err);
      });
  }

  return pool;
}
