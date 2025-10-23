import dotenv from 'dotenv';
import db from './connection.js';

dotenv.config();

async function checkTable() {
  const pool = db();
  
  try {
    // Check table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_plans'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ user_plans table structure:\n');
    structure.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`   ${col.column_name}: ${col.data_type}${length} - ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check existing records
    const records = await pool.query('SELECT * FROM user_plans');
    console.log(`\n📊 Total records: ${records.rows.length}\n`);
    
    if (records.rows.length > 0) {
      console.log('Sample records:');
      records.rows.slice(0, 5).forEach(row => {
        console.log(`   User: ${row.user_id} | Plan: ${row.plan_name} | Renewal: ${row.renewal_date || 'NULL (lifetime)'}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTable();
