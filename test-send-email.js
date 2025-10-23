import dotenv from 'dotenv';
import { Resend } from 'resend';
import crypto from 'crypto';
import db from './connection.js';

dotenv.config();

const resend = new Resend(process.env.RESEND_KEY);
const resendFrom = process.env.RESEND_FROM;

async function testSendEmail() {
  const pool = db();
  const email = process.argv[2] || 'test@example.com';
  
  console.log(`\n📧 Testing password setup email to: ${email}\n`);
  
  // Create token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  try {
    await pool.query(
      'INSERT INTO password_tokens (email, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3, used = false',
      [email, token, expiresAt]
    );
    console.log('✅ Token created in database');
    
    const setupUrl = `http://localhost:3000/setup-password.html?token=${token}`;
    console.log(`🔗 Password setup URL: ${setupUrl}\n`);
    
    // Send email
    console.log('📤 Sending email...');
    const result = await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: 'Set Up Your Wurlo Account Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Set Up Your Password</h2>
            <p>Hi there,</p>
            <p>Thanks for joining Wurlo! Click the button below to set up your account password:</p>
            <p style="margin: 30px 0;">
              <a href="${setupUrl}" style="background: linear-gradient(to right, #4F46E5, #06B6D4); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Set Up Password
              </a>
            </p>
            <p>Or copy and paste this link:</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${setupUrl}
            </p>
            <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
            <p>— The Wurlo Team</p>
          </body>
        </html>
      `,
      text: `Set Up Your Wurlo Account Password\n\nThanks for joining Wurlo! Click this link to set up your password:\n\n${setupUrl}\n\nThis link expires in 24 hours.\n\n— The Wurlo Team`
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Email ID:', result.data?.id);
    console.log('\n📬 Check your inbox at:', email);
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.response) {
      console.error('Response:', await err.response.text());
    }
    process.exit(1);
  }
}

testSendEmail();
