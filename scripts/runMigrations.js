import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import getPool from '../database/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple database migration runner
 * Executes all .sql files in the migrations directory
 */
async function runMigrations() {
  const pool = getPool();
  const migrationsDir = path.join(__dirname, '../database/migrations');
  
  console.log('🔄 Starting database migrations...\n');
  
  try {
    // Get all SQL files in migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure consistent order
    
    if (files.length === 0) {
      console.log('ℹ️  No migration files found.');
      return;
    }
    
    console.log(`Found ${files.length} migration file(s):\n`);
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`  📄 Executing: ${file}`);
      
      try {
        await pool.query(sql);
        console.log(`  ✅ Success: ${file}\n`);
      } catch (error) {
        console.error(`  ❌ Failed: ${file}`);
        console.error(`     Error: ${error.message}\n`);
        throw error;
      }
    }
    
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();
