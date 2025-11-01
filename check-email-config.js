import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

console.log('\n🔍 Email Configuration Checker\n');
console.log('================================\n');

// Check environment variables
const resendKey = process.env.RESEND_KEY;
const resendFrom = process.env.RESEND_FROM;

console.log('Environment Variables:');
console.log('  RESEND_KEY:', resendKey ? `✅ Set (${resendKey.substring(0, 10)}...)` : '❌ NOT SET');
console.log('  RESEND_FROM:', resendFrom ? `✅ Set (${resendFrom})` : '❌ NOT SET');

if (!resendKey || !resendFrom) {
  console.log('\n❌ Email configuration incomplete!\n');
  console.log('Required environment variables:');
  console.log('  RESEND_KEY=re_xxxxxxxxxxxxx');
  console.log('  RESEND_FROM=noreply@yourdomain.com\n');
  process.exit(1);
}

// Try to initialize Resend
try {
  const resend = new Resend(resendKey);
  console.log('\n✅ Resend client initialized successfully\n');
  
  console.log('To test sending an email, run:');
  console.log(`  node test-send-email.js your-email@example.com\n`);
} catch (err) {
  console.log('\n❌ Failed to initialize Resend:', err.message, '\n');
  process.exit(1);
}
