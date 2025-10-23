import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import crypto from 'crypto';
import db from './connection.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Initialize database and Stripe BEFORE webhook handler
const pool = db();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY not configured');
}
const stripe = new Stripe(stripeSecretKey);

// Initialize Firebase Admin
let firebaseEnabled = false;
try {
  if (!admin.apps.length) {
    const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };
    
    // Only initialize if credentials exist
    if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig)
      });
      firebaseEnabled = true;
      console.log('Firebase Admin initialized');
    } else {
      console.warn('Firebase credentials not configured - Firebase Auth disabled');
    }
  }
} catch (err) {
  console.warn('Firebase initialization failed:', err.message);
}

// Stripe webhook needs raw body (MUST be before express.json())
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    
    if (email) {
      try {
        // Use INSERT ... ON CONFLICT to handle duplicates gracefully
        const result = await pool.query(
          'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING email',
          [email.toLowerCase()]
        );
        
        if (result.rowCount > 0) {
          console.log('Added new email to waitlist from webhook:', email);
        } else {
          console.log('Email already in waitlist, skipping:', email);
        }
        
        // Create Firebase user and store in users table
        createFirebaseUser(email)
          .then(async (userRecord) => {
            if (userRecord) {
              // Store in users table
              try {
                await pool.query(
                  'INSERT INTO users (user_id, email, auth_provider) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET user_id = $1, auth_provider = $3',
                  [userRecord.uid, email, 'firebase']
                );
                console.log('Added user to users table:', userRecord.uid);
              } catch (err) {
                console.error('Failed to add user to users table:', err);
              }
            }
          })
          .catch(err => console.error('Failed to create Firebase user:', err));
        
        // Send welcome and password setup emails (non-blocking)
        sendWelcomeEmail(email).catch(err => console.error('Failed to send welcome email:', err));
        sendPasswordSetupEmail(email).catch(err => console.error('Failed to send password setup email:', err));
      } catch (err) {
        console.error('Error processing webhook:', err);
        // Still return 200 to Stripe so it doesn't retry
        return res.json({ received: true, error: 'Database error but acknowledged' });
      }
    }
  }
  
  res.json({ received: true });
});

app.use(express.json());

// Initialize Resend
const resendApiKey = process.env.RESEND_KEY;
const resendFrom = process.env.RESEND_FROM;
let resend = null;
if (resendApiKey && resendFrom) {
  resend = new Resend(resendApiKey);
} else {
  console.warn('Resend not configured - emails will not be sent');
}

// Email sending functions
async function sendWelcomeEmail(email) {
  if (!resend) return;
  
  try {
    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: 'Welcome to Wurlo - Your Lifetime Access is Active! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(79,70,229,0.15);">
              <div style="background:linear-gradient(135deg, #4F46E5, #06B6D4);padding:32px 40px;color:#fff;">
                <h1 style="margin:0;font-size:28px;font-weight:700;">Welcome to Wurlo! 🎉</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">Your lifetime access is now active.</p>
              </div>
              <div style="padding:32px 40px;">
                <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1f2937;">Thank you for your purchase!</h2>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1f2937;">
                  You now have lifetime access to Wurlo's adaptive learning platform. We'll send you early access before our December 2025 launch.
                </p>
                <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:24px 0;">
                  <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1f2937;">What's next?</h3>
                  <ul style="margin:0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
                    <li style="margin-bottom:8px;">Check your inbox for a password setup email</li>
                    <li style="margin-bottom:8px;">You'll get early access before December 2025</li>
                    <li style="margin-bottom:8px;">Start learning with AI-powered adaptive courses</li>
                  </ul>
                </div>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#475569;">
                  Questions? Just reply to this email and we'll help.
                </p>
              </div>
              <div style="padding:20px 40px;background:#f1f5f9;font-size:12px;line-height:1.6;color:#475569;text-align:center;">
                © ${new Date().getFullYear()} Wurlo. Smarter paths, faster progress.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Welcome to Wurlo! 🎉\n\nYour lifetime access is now active.\n\nThank you for your purchase! You now have lifetime access to Wurlo's adaptive learning platform. We'll send you early access before our December 2025 launch.\n\nWhat's next?\n• Check your inbox for a password setup email\n• You'll get early access before December 2025\n• Start learning with AI-powered adaptive courses\n\nQuestions? Just reply to this email and we'll help.\n\n— The Wurlo Team`
    });
    console.log('Welcome email sent to:', email);
  } catch (err) {
    console.error('Error sending welcome email:', err);
  }
}

// Create Firebase user with random password
async function createFirebaseUser(email) {
  if (!firebaseEnabled) {
    console.warn('Firebase not enabled, skipping user creation');
    return null;
  }
  
  try {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const userRecord = await admin.auth().createUser({
      email: email,
      password: randomPassword,
      emailVerified: false
    });
    console.log('Created Firebase user:', userRecord.uid);
    return userRecord;
  } catch (err) {
    // User might already exist
    if (err.code === 'auth/email-already-exists') {
      console.log('Firebase user already exists:', email);
      const userRecord = await admin.auth().getUserByEmail(email);
      return userRecord;
    }
    throw err;
  }
}

// Generate password reset token and store in database
async function createPasswordResetToken(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  try {
    await pool.query(
      'INSERT INTO password_tokens (email, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3, used = false',
      [email, token, expiresAt]
    );
    console.log(`Created password token for ${email}, expires at ${expiresAt}`);
    return token;
  } catch (err) {
    console.error('Error creating password reset token:', err);
    throw err;
  }
}

async function sendPasswordSetupEmail(email, baseUrl = null) {
  // Generate secure token and store in database (always, even if email fails)
  const setupToken = await createPasswordResetToken(email);
  
  // Always use localhost unless explicitly in production
  const url = baseUrl || (process.env.NODE_ENV === 'production' 
    ? 'https://wurlolanding.onrender.com' 
    : 'http://localhost:3000');
  
  const setupUrl = `${url}/setup-password.html?token=${setupToken}`;
  
  console.log(`Password setup URL: ${setupUrl}`);
  
  // If Resend not configured, just log the URL and return
  if (!resend) {
    console.warn('Resend not configured. Password setup link:', setupUrl);
    return;
  }
  
  try {
    await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: 'Set Up Your Wurlo Account Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(79,70,229,0.15);">
              <div style="background:linear-gradient(135deg, #4F46E5, #06B6D4);padding:32px 40px;color:#fff;">
                <h1 style="margin:0;font-size:28px;font-weight:700;">Set Up Your Password 🔐</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">Complete your Wurlo account setup.</p>
              </div>
              <div style="padding:32px 40px;">
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1f2937;">
                  You're almost ready to start your learning journey! Click the button below to set up your password and access your account.
                </p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${setupUrl}" style="display:inline-block;background:linear-gradient(135deg, #4F46E5, #06B6D4);color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
                    Set Up Password
                  </a>
                </div>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${setupUrl}" style="color:#4F46E5;word-break:break-all;">${setupUrl}</a>
                </p>
                <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;margin:24px 0;border-radius:8px;">
                  <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
                    <strong>Security note:</strong> This link will expire in 24 hours. If you didn't request this, please ignore this email.
                  </p>
                </div>
              </div>
              <div style="padding:20px 40px;background:#f1f5f9;font-size:12px;line-height:1.6;color:#475569;text-align:center;">
                © ${new Date().getFullYear()} Wurlo. Smarter paths, faster progress.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Set Up Your Wurlo Password\n\nYou're almost ready to start your learning journey! Click the link below to set up your password and access your account.\n\n${setupUrl}\n\nSecurity note: This link will expire in 24 hours. If you didn't request this, please ignore this email.\n\n— The Wurlo Team`
    });
    console.log('Password setup email sent to:', email);
  } catch (err) {
    console.error('Error sending password setup email:', err);
  }
}

// Serve the static landing page from the client directory
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Simple email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Get remaining spots endpoint
app.get('/api/spots-remaining', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM waitlist');
    const count = parseInt(result.rows[0].count, 10) || 0;
    const remaining = Math.max(0, 100 - count);
    return res.status(200).json({ remaining, total: 100, subscribed: count });
  } catch (err) {
    console.error('Error fetching spots count:', err);
    // Return default values if database fails
    return res.status(200).json({ remaining: 100, total: 100, subscribed: 0 });
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email.' });
    }

    // Determine base URL (production or local)
    const isLocal = req.headers.origin?.includes('localhost') || req.headers.origin?.includes('127.0.0.1');
    const baseUrl = isLocal ? 'http://localhost:3000' : 'https://wurlolanding.onrender.com';
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Wurlo Lifetime Access',
              description: 'One-time payment for lifetime access to Wurlo',
            },
            unit_amount: 1900, // £19.00 in pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email,
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ message: 'Could not create checkout session. Try again soon.' });
  }
});

// Waitlist endpoint (backup/manual adds)
app.post('/api/subscribe', async (req, res) => {
  try {
    const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email.' });
    }

    await pool.query('INSERT INTO waitlist (email) VALUES ($1)', [email]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Check for duplicate email error
    if (err.code === '23505') {
      return res.status(409).json({ message: "You're already on the waitlist." });
    }
    console.error('Waitlist error:', err);
    return res.status(500).json({ message: 'Could not save your email. Try again soon.' });
  }
});

// Verify password reset token
app.post('/api/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    console.log('Verifying token:', token?.substring(0, 10) + '...');
    
    if (!token) {
      console.log('No token provided');
      return res.status(400).json({ valid: false, message: 'Token required' });
    }
    
    const result = await pool.query(
      'SELECT email, expires_at, used FROM password_tokens WHERE token = $1',
      [token]
    );
    
    console.log('Token lookup result:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      console.log('Token not found in database');
      return res.status(404).json({ valid: false, message: 'Invalid token' });
    }
    
    const tokenData = result.rows[0];
    console.log('Token data:', { email: tokenData.email, used: tokenData.used, expires: tokenData.expires_at });
    
    if (tokenData.used) {
      console.log('Token already used');
      return res.status(400).json({ valid: false, message: 'Token already used' });
    }
    
    if (new Date() > new Date(tokenData.expires_at)) {
      console.log('Token expired');
      return res.status(400).json({ valid: false, message: 'Token expired' });
    }
    
    console.log('Token valid for:', tokenData.email);
    return res.status(200).json({ valid: true, email: tokenData.email });
  } catch (err) {
    console.error('Error verifying token:', err);
    return res.status(500).json({ valid: false, message: 'Server error' });
  }
});

// Set new password
app.post('/api/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    // Verify token
    const result = await pool.query(
      'SELECT email, expires_at, used FROM password_tokens WHERE token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid token' });
    }
    
    const tokenData = result.rows[0];
    
    if (tokenData.used) {
      return res.status(400).json({ success: false, message: 'Token already used' });
    }
    
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ success: false, message: 'Token expired' });
    }
    
    // Update Firebase user password
    if (firebaseEnabled) {
      const userRecord = await admin.auth().getUserByEmail(tokenData.email);
      await admin.auth().updateUser(userRecord.uid, {
        password: password,
        emailVerified: true
      });
    } else {
      return res.status(500).json({ success: false, message: 'Firebase not configured' });
    }
    
    // Mark token as used
    await pool.query(
      'UPDATE password_tokens SET used = true WHERE token = $1',
      [token]
    );
    
    console.log('Password updated for:', tokenData.email);
    
    return res.status(200).json({ success: true, message: 'Password set successfully' });
  } catch (err) {
    console.error('Error setting password:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.listen(PORT, () => {
  console.log(`Wurlo landing running on http://localhost:${PORT}`);
});
