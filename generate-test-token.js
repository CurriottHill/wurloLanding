import dotenv from 'dotenv';
import crypto from 'crypto';
import db from './connection.js';

dotenv.config();

async function generateTestToken() {
  const pool = db();
  
  const email = process.argv[2] || 'test@example.com';
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  try {
    await pool.query(
      'INSERT INTO password_tokens (email, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3, used = false',
      [email, token, expiresAt]
    );
    
    console.log('\n✅ Test token created!\n');
    console.log('Email:', email);
    console.log('Expires:', expiresAt.toLocaleString());
    console.log('\n🔗 Test URL:');
    console.log(`http://localhost:3000/setup-password.html?token=${token}\n`);
    console.log('📋 Copy and paste this URL into your browser to test!\n');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

generateTestToken();
