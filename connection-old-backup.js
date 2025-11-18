import dotenv from 'dotenv';
import pkg from 'pg';

const { Pool } = pkg;

dotenv.config();

function db() {
  const connectionString = process.env.DB_HOST;

  if (!connectionString) {
    throw new Error('DB_HOST environment variable is not set. Provide your PostgreSQL connection string.');
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  pool
    .connect()
    .then((client) => {
      client.release();
      console.log('Connected to PostgreSQL database');
    })
    .catch((err) => {
      console.error('Error connecting to PostgreSQL:', err);
    });

  return pool;
}

export default db;