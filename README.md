# Wurlo Landing Page Server

This is the backend server for the Wurlo landing page. It handles waitlist signups, Stripe payments, and email notifications.

## Features

- **Stripe Integration**: Checkout sessions and webhook handling for founder lifetime access purchases
- **Waitlist Management**: Email signup and storage
- **Email Service**: Welcome emails and password setup using Resend
- **Firebase Auth**: User account creation with random passwords
- **Password Setup**: Token-based password reset flow
- **Stats & Reviews**: Dynamic landing page data endpoints

## Endpoints

### Public Endpoints
- `GET /` - Health check
- `POST /api/create-checkout` - Create Stripe checkout session
- `POST /api/webhook` - Stripe webhook handler
- `POST /api/subscribe` - Add email to waitlist
- `GET /api/spots-remaining` - Get remaining founder spots
- `GET /api/reviews` - Get user reviews
- `GET /api/stats` - Get platform statistics
- `POST /api/verify-token` - Verify password reset token
- `POST /api/set-password` - Set new password

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure environment variables:
   - `PORT` - Server port (default: 3000)
   - `DB_HOST` - PostgreSQL connection string
   - `STRIPE_SECRET_KEY` - Stripe secret key
   - `WEBHOOK_SECRET` - Stripe webhook secret
   - `RESEND_KEY` - Resend API key
   - `RESEND_FROM` - Email sender address
   - `FIREBASE_*` - Firebase Admin SDK credentials
   - `CORS_ORIGIN` - Allowed origins (comma-separated)

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Database

This server uses PostgreSQL and shares the database with the app server. Required tables:
- `waitlist` - Email signups
- `user_plans` - User subscription plans
- `users` - User accounts
- `password_tokens` - Password reset tokens
- `reviews` - User reviews

## Independent Operation

This server operates completely independently from the app server. It only handles landing page functionality and does not include:
- Onboarding workflows
- Placement tests
- User authentication/registration
- Course management

For app functionality, see the `app_server` directory.
