/**
 * Authentication Service
 * 
 * Handles Firebase user creation and password token management.
 */

import crypto from 'crypto';

/**
 * Create a Firebase user with random password
 * 
 * @param {Object} admin - Firebase Admin instance
 * @param {string} email - User email
 * @returns {Promise<Object>} Firebase user record
 */
export async function createFirebaseUser(admin, email) {
  try {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const userRecord = await admin.auth().createUser({
      email: email,
      password: randomPassword,
      emailVerified: false
    });
    console.log('✅ Firebase user created:', userRecord.uid);
    return userRecord;
  } catch (err) {
    // User might already exist
    if (err.code === 'auth/email-already-exists') {
      console.log('ℹ️  Firebase user already exists:', email);
      const userRecord = await admin.auth().getUserByEmail(email);
      return userRecord;
    }
    throw err;
  }
}

/**
 * Generate and store password reset token in database
 * 
 * @param {Object} pool - PostgreSQL pool instance
 * @param {string} email - User email
 * @returns {Promise<string>} Generated token
 */
export async function createPasswordResetToken(pool, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  try {
    await pool.query(
      'INSERT INTO password_tokens (email, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3, used = false',
      [email, token, expiresAt]
    );
    console.log(`✅ Password token created for ${email}, expires at ${expiresAt}`);
    return token;
  } catch (err) {
    console.error('❌ Error creating password reset token:', err);
    throw err;
  }
}

/**
 * Simple email validation
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
