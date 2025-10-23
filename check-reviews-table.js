import db from './connection.js';

async function checkTable() {
  const pool = db();
  
  try {
    console.log('Checking reviews table structure...\n');
    
    // Get table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reviews'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current reviews table columns:');
    structure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Get data count
    const count = await pool.query('SELECT COUNT(*) as count FROM reviews');
    console.log(`\n📊 Total reviews: ${count.rows[0].count}`);
    
    // Show sample data if exists
    const sample = await pool.query('SELECT * FROM reviews LIMIT 1');
    if (sample.rows.length > 0) {
      console.log('\n📝 Sample row:');
      console.log(sample.rows[0]);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkTable();
