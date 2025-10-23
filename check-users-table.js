import dotenv from 'dotenv';
import db from './connection.js';

dotenv.config();

async function checkTable() {
  const pool = db();
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Current users table structure:\n');
    result.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`${col.column_name}: ${col.data_type}${length} - ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTable();
