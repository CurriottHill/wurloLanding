/**
 * Wurlo Landing Page Server
 * 
 * Pre-launch landing page and waitlist management server.
 * 
 * Features:
 * - Stripe payment integration for founder plan
 * - Waitlist management
 * - Firebase user creation
 * - Email notifications (welcome, password setup, waitlist confirmation)
 * - Password reset functionality
 * 
 * Port: 3000 (configurable via PORT env variable)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import crypto from 'crypto';
import pkg from 'pg';
import { sendWelcomeEmail, sendWaitlistConfirmationEmail, sendPasswordSetupEmail } from './services/emailService.js';
import { createFirebaseUser as createFirebaseUserHelper, createPasswordResetToken, isValidEmail } from './services/authService.js';

const { Pool } = pkg;

// Load environment variables
dotenv.config();

// Configuration
const DEFAULT_FRONTEND_URL = (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/?$/, '');
const DEFAULT_BACKEND_URL = (process.env.BACKEND_BASE_URL || 'http://localhost:3000').replace(/\/?$/, '');
const PORT = process.env.PORT || 3000;

const app = express();

// Build CORS allowed origins list
const defaultOrigins = [DEFAULT_FRONTEND_URL, DEFAULT_BACKEND_URL].filter(Boolean);
const allowedOrigins = Array.from(new Set([
  ...defaultOrigins,
  ...((process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean))
]));

/**
 * CORS configuration with wildcard support
 * Allows requests from configured origins and supports patterns like https://*.pages.dev
 */
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow requests with no origin
    if (allowedOrigins.length === 0) return callback(null, true); // Allow all if none configured
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === origin) return true; // Exact match
      if (allowed.includes('*')) { // Wildcard match
        const pattern = allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply security and CORS settings
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DB_HOST,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(client => {
    client.release();
    console.log('✅ PostgreSQL connected');
  })
  .catch(err => console.error('❌ PostgreSQL connection error:', err));

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not configured');
}

/**\n * Initialize Firebase Admin SDK\n * Handles user creation and authentication\n */
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
    
    if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      admin.initializeApp({ credential: admin.credential.cert(firebaseConfig) });
      firebaseEnabled = true;
      console.log('✅ Firebase Admin initialized');
    } else {
      console.warn('⚠️  Firebase credentials not configured');
    }
  }
} catch (err) {
  console.warn('❌ Firebase initialization failed:', err.message);
}

/**
 * Initialize Resend email service
 * Handles welcome emails, password setup, and waitlist confirmations
 */
const resendApiKey = process.env.RESEND_KEY;
const resendFrom = process.env.RESEND_FROM;
let resend = null;
if (resendApiKey && resendFrom) {
  resend = new Resend(resendApiKey);
  console.log('✅ Resend initialized:', resendFrom);
} else {
  console.warn('⚠️  Resend not configured - emails disabled');
}

/**
 * Stripe Webhook Handler
 * 
 * MUST be registered before express.json() to access raw body.
 * Handles successful checkout sessions and creates users with founder plan.
 */
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('❌ WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('🎯 Webhook received:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    
    if (email) {
      try {
        // Add to waitlist (idempotent)
        await pool.query(
          'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
          [email.toLowerCase()]
        );
        
        // Create Firebase user and store in database (non-blocking)
        if (firebaseEnabled) {
          createFirebaseUserHelper(admin, email)
            .then(async (userRecord) => {
              if (userRecord) {
                await pool.query(
                  'INSERT INTO users (user_id, email, auth_provider) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET user_id = $1, auth_provider = $3',
                  [userRecord.uid, email, 'firebase']
                );
                await pool.query(
                  'INSERT INTO user_plans (user_id, plan_name, renewal_date) VALUES ($1, $2, $3)',
                  [userRecord.uid, 'founder', null]
                );
                console.log('✅ User created with founder plan:', userRecord.uid);
              }
            })
            .catch(err => console.error('❌ Firebase user creation failed:', err));
        }
        
        // Send welcome and password setup emails (non-blocking)
        const emailBaseUrl = 'https://wurlolanding.onrender.com';
        sendWelcomeEmail(resend, resendFrom, email).catch(err => console.error('❌ Welcome email failed:', err));
        
        // Create password token and send setup email
        createPasswordResetToken(pool, email)
          .then(token => sendPasswordSetupEmail(resend, resendFrom, email, token, emailBaseUrl))
          .catch(err => console.error('❌ Password setup email failed:', err));
      } catch (err) {
        console.error('❌ Webhook processing error:', err);
        return res.json({ received: true, error: 'Database error but acknowledged' });
      }
    }
  }
  
  res.json({ received: true });
});

// Body parsing middleware (MUST be after webhook handler)
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/', async (req, res) => {
  res.json({ status: 'ok', service: 'wurlo-landing-server' });
});

/**
 * Get remaining waitlist spots
 * Returns count of remaining free-for-life spots out of 20 total
 */
app.get('/api/spots-remaining', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM waitlist');
    const waitlistCount = parseInt(result.rows[0].count, 10) || 0;
    const totalSpots = 20;
    const remaining = Math.max(0, totalSpots - waitlistCount);
    return res.json({ remaining, total: totalSpots, subscribed: waitlistCount });
  } catch (err) {
    console.error('❌ Error fetching waitlist count:', err);
    return res.json({ remaining: 20, total: 20, subscribed: 0 });
  }
});

/**
 * Get all reviews
 */
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, rating, title, review_text, is_verified, created_at FROM reviews ORDER BY created_at DESC'
    );
    return res.json({ reviews: result.rows });
  } catch (err) {
    console.error('❌ Error fetching reviews:', err);
    return res.json({ reviews: [] });
  }
});

/**
 * Get stats (user count and average rating)
 */
app.get('/api/stats', async (req, res) => {
  try {
    const userCountResult = await pool.query('SELECT COUNT(*) as count FROM user_plans');
    const userCount = parseInt(userCountResult.rows[0].count, 10) || 0;
    
    const ratingResult = await pool.query('SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews');
    const avgRating = ratingResult.rows[0].review_count > 0 
      ? parseFloat(ratingResult.rows[0].avg_rating).toFixed(1) 
      : 0;
    const reviewCount = parseInt(ratingResult.rows[0].review_count, 10) || 0;
    
    return res.json({ 
      userCount, 
      avgRating: parseFloat(avgRating),
      reviewCount 
    });
  } catch (err) {
    console.error('❌ Error fetching stats:', err);
    return res.json({ userCount: 0, avgRating: 0, reviewCount: 0 });
  }
});

/**
 * Create Stripe checkout session
 */
app.post('/api/create-checkout', async (req, res) => {
  try {
    const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email.' });
    }

    // Check if spots are still available (max 25 founder plans)
    const founderCountResult = await pool.query(
      "SELECT COUNT(*) as count FROM user_plans WHERE plan_name = 'founder'"
    );
    const founderCount = parseInt(founderCountResult.rows[0].count, 10) || 0;
    
    if (founderCount >= 25) {
      return res.status(400).json({ message: 'Sorry! All 25 lifetime access spots have been claimed.' });
    }

    const baseUrl = DEFAULT_FRONTEND_URL;
    
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
            unit_amount: 2900, // £29.00 in pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe checkout error:', err);
    return res.status(500).json({ message: 'Could not create checkout session. Try again soon.' });
  }
});

/**
 * Waitlist signup handler (shared logic for both endpoints)
 */
const handleWaitlistSignup = async (req, res) => {
  try {
    // Extract all form data
    const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();
    const firstName = (req.body?.first_name ?? req.body?.firstName ?? '').trim();
    const lastName = (req.body?.last_name ?? req.body?.lastName ?? '').trim();
    const phoneNumber = (req.body?.phone_number ?? req.body?.phoneNumber ?? '').trim();
    const contactConsentRaw = req.body?.contact_consent ?? req.body?.contactConsent;
    const contactConsent = typeof contactConsentRaw === 'boolean'
      ? contactConsentRaw
      : ['true', '1', 'yes', 'on'].includes(String(contactConsentRaw).toLowerCase());

    // Validate required fields
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email.' });
    }

    if (!firstName) {
      return res.status(400).json({ message: 'First name is required.' });
    }

    // Create table if it doesn't exist with all columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone_number VARCHAR(20),
        contact_consent BOOLEAN DEFAULT FALSE
      )
    `);

    // Insert into waitlist with all data
    const result = await pool.query(
      `INSERT INTO waitlist (email, first_name, last_name, phone_number, contact_consent) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (email) DO NOTHING 
       RETURNING email, first_name`,
      [
        email,
        firstName || null,
        lastName || null,
        phoneNumber || null,
        contactConsent,
      ]
    );

    // Send confirmation email (non-blocking)
    if (result.rowCount > 0) {
      console.log('📝 New waitlist signup:', email, '-', firstName, lastName);
      sendWaitlistConfirmationEmail(resend, resendFrom, email).catch(err => 
        console.error('❌ Failed to send waitlist confirmation:', err)
      );
    } else {
      console.log('📝 Duplicate waitlist signup:', email);
    }

    return res.json({ ok: true, message: 'Successfully joined the waitlist!' });
  } catch (err) {
    // Check for duplicate email error
    if (err.code === '23505') {
      return res.status(409).json({ message: "You're already on the waitlist." });
    }
    console.error('❌ Waitlist error:', err);
    return res.status(500).json({ message: 'Could not save your email. Try again soon.' });
  }
};

// Waitlist endpoints (both /subscribe and /join-waitlist for compatibility)
app.post('/api/subscribe', handleWaitlistSignup);
app.post('/api/join-waitlist', handleWaitlistSignup);

/**
 * Verify password reset token
 */
app.post('/api/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token required' });
    }
    
    const result = await pool.query(
      'SELECT email, expires_at, used FROM password_tokens WHERE token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Invalid token' });
    }
    
    const tokenData = result.rows[0];
    
    if (tokenData.used) {
      return res.status(400).json({ valid: false, message: 'Token already used' });
    }
    
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ valid: false, message: 'Token expired' });
    }
    
    return res.json({ valid: true, email: tokenData.email });
  } catch (err) {
    console.error('❌ Error verifying token:', err);
    return res.status(500).json({ valid: false, message: 'Server error' });
  }
});

/**
 * Set new password
 */
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
    
    console.log('✅ Password updated for:', tokenData.email);
    
    return res.json({ success: true, message: 'Password set successfully' });
  } catch (err) {
    console.error('❌ Error setting password:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Wurlo landing page server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Firebase: ${firebaseEnabled ? 'enabled' : 'disabled'}`);
  console.log(`   Resend: ${resend ? 'enabled' : 'disabled'}`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? 'enabled' : 'disabled'}\n`);
});

// Disable timeouts for long-running requests
server.timeout = 0;
server.keepAliveTimeout = 0;
server.headersTimeout = 0;