/**
 * Firebase Admin SDK Initialization Utility
 * 
 * Shared Firebase initialization logic for both servers.
 * Supports both service account JSON and individual env variables.
 */

import admin from 'firebase-admin';

/**
 * Initialize Firebase Admin SDK if not already initialized
 * @returns {boolean} True if Firebase is enabled and initialized
 */
export function initializeFirebase() {
  try {
    // Skip if already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase already initialized');
      return true;
    }

    // Try to load Firebase config from environment
    const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };
    
    // Only initialize if all required credentials exist
    if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig)
      });
      console.log('✓ Firebase Admin initialized successfully');
      return true;
    } else {
      console.warn('⚠️  Firebase credentials not configured - Firebase Auth disabled');
      return false;
    }
  } catch (err) {
    console.error('❌ Firebase initialization failed:', err.message);
    return false;
  }
}
