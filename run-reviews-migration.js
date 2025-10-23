import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const pool = db();
  
  try {
    console.log('Running reviews table migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', '005_reviews_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Reviews table created successfully!');
    console.log('✅ Test reviews inserted successfully!');
    
    // Verify the data
    const result = await pool.query('SELECT COUNT(*) as count FROM reviews');
    console.log(`📊 Total reviews: ${result.rows[0].count}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
