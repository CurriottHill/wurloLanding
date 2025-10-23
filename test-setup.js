import dotenv from 'dotenv';
import db from './connection.js';

dotenv.config();

async function testSetup() {
  const pool = db();
  
  console.log('🧪 Testing database setup...\n');
  
  try {
    // Test waitlist table
    const waitlistResult = await pool.query('SELECT COUNT(*) FROM waitlist');
    console.log('✅ waitlist table:', waitlistResult.rows[0].count, 'entries');
    
    // Test users table
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log('✅ users table:', usersResult.rows[0].count, 'users');
    
    // Test password_tokens table
    const tokensResult = await pool.query('SELECT COUNT(*) FROM password_tokens');
    console.log('✅ password_tokens table:', tokensResult.rows[0].count, 'tokens');
    
    console.log('\n📊 Database schema:');
    
    // Show users table structure
    const usersSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('\n   users table columns:');
    usersSchema.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'required'})`);
    });
    
    console.log('\n✅ All tables exist and are ready!');
    console.log('\n📝 Next steps:');
    console.log('   1. Add Firebase credentials to .env');
    console.log('   2. npm run dev');
    console.log('   3. Test payment at http://localhost:3000');
    console.log('   4. Check email for password setup link');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n💡 Did you run migrations?');
    console.log('   npm run migrate');
    process.exit(1);
  }
}

testSetup();
