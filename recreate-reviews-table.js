import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recreateTable() {
  const pool = db();
  
  try {
    console.log('Dropping existing reviews table...');
    await pool.query('DROP TABLE IF EXISTS reviews CASCADE');
    console.log('✅ Table dropped');
    
    console.log('\nCreating new reviews table with correct structure...');
    
    const migrationPath = path.join(__dirname, 'migrations', '005_reviews_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Reviews table created successfully!');
    console.log('✅ Test reviews inserted successfully!');
    
    // Verify the data
    const result = await pool.query('SELECT COUNT(*) as count FROM reviews');
    console.log(`\n📊 Total reviews: ${result.rows[0].count}`);
    
    // Show sample review
    const sample = await pool.query('SELECT name, rating, title FROM reviews LIMIT 1');
    if (sample.rows.length > 0) {
      console.log('\n📝 Sample review:');
      console.log(`   ${sample.rows[0].name} - ${sample.rows[0].rating} stars - "${sample.rows[0].title}"`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

recreateTable();
