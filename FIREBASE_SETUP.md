# Firebase Auth Setup Guide

## Quick Setup Steps

### 1. Run Database Migration
First, create the password tokens table:

```bash
cd server
npm run migrate
```

### 2. Configure Firebase

You need to add Firebase Admin SDK credentials to your `.env` file.

**Get your Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file

**Add to .env (Option 1 - Recommended for production):**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nMulti\nLine\nKey\n-----END PRIVATE KEY-----\n"
```

**Add to .env (Option 2 - Single line for development):**
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...full json here..."}
```

### 3. Test the Flow

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Make a test payment:**
   - Go to `http://localhost:3000`
   - Enter an email and click "Join waitlist"
   - Use Stripe test card: `4242 4242 4242 4242`
   - Complete checkout

3. **Check what happens:**
   - ✅ User added to waitlist database
   - ✅ Firebase user created automatically
   - ✅ Welcome email sent
   - ✅ Password setup email sent with secure link

4. **Set up password:**
   - Click link in password setup email
   - Go to `http://localhost:3000/setup-password?token=...`
   - Enter and confirm new password
   - Password is updated in Firebase Auth

5. **Verify in Firebase Console:**
   - Go to Firebase Console → Authentication → Users
   - You should see the new user with email verified

## How It Works

1. **Stripe Webhook** → Creates Firebase user with random password
2. **Password Token** → Secure 64-character token stored in database
3. **Email Link** → User clicks link with token
4. **Verify Token** → `/api/verify-token` checks if valid
5. **Set Password** → `/api/set-password` updates Firebase user
6. **Done** → User can now sign in with their email and password

## API Endpoints

- `POST /api/create-checkout` - Create Stripe checkout session
- `POST /api/webhook` - Stripe webhook (creates Firebase user)
- `POST /api/verify-token` - Verify password reset token
- `POST /api/set-password` - Update user password in Firebase

## Security Features

- ✅ Tokens are cryptographically secure (32 random bytes)
- ✅ Tokens expire after 24 hours
- ✅ Tokens are single-use only
- ✅ Firebase passwords are hashed automatically
- ✅ Email verification happens on password setup

## Troubleshooting

**Migration fails:**
- Check database connection in `.env`
- Ensure PostgreSQL is running

**Firebase errors:**
- Verify credentials in `.env`
- Check Firebase project is active
- Enable Email/Password auth in Firebase Console

**Emails not sending:**
- Check `RESEND_KEY` and `RESEND_FROM` in `.env`
- Verify domain in Resend dashboard
