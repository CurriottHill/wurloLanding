import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './connection.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const pool = db();
  
  try {
    const migrations = [
      '002_password_tokens.sql',
      '003_users_table.sql'
    ];
    
    for (const migration of migrations) {
      const migrationFile = path.join(__dirname, 'migrations', migration);
      
      if (fs.existsSync(migrationFile)) {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log(`Running migration: ${migration}`);
        await pool.query(sql);
        console.log(`✅ ${migration} completed`);
      } else {
        console.log(`⚠️  Skipping ${migration} (not found)`);
      }
    }
    
    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
