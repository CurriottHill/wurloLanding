# Purchase Flow - Complete Documentation

## What Happens When User Completes Payment

### 1. Stripe Webhook Triggered
When a user completes checkout, Stripe sends a webhook to `/api/webhook`

### 2. Database Updates (in order)

#### A. Waitlist Table
```sql
INSERT INTO waitlist (email) 
VALUES ('user@example.com')
ON CONFLICT (email) DO NOTHING
```

#### B. Firebase Auth
- Creates Firebase user with random secure password
- Returns user with Firebase UID

#### C. Users Table
```sql
INSERT INTO users (user_id, email, auth_provider) 
VALUES ('firebase_uid_here', 'user@example.com', 'firebase')
ON CONFLICT (email) DO UPDATE SET user_id = excluded.user_id
```

#### D. User Plans Table ✨ NEW
```sql
INSERT INTO user_plans (user_id, plan_name, renewal_date)
VALUES ('firebase_uid_here', 'founder', NULL)
```
- `plan_name`: `'founder'` (lifetime access)
- `renewal_date`: `NULL` (no renewal needed)

### 3. Email Notifications

#### Welcome Email
- Confirms purchase
- Thanks user
- Outlines what's next

#### Password Setup Email
- Contains secure token (64-char hex)
- Links to: `http://localhost:3000/setup-password.html?token=...` (dev)
- Or: `https://wurlolanding.onrender.com/setup-password.html?token=...` (prod)
- Token expires in 24 hours

## Database Schema

### user_plans Table
```sql
CREATE TABLE user_plans (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(125) NOT NULL,           -- FK to users(user_id)
  plan_name VARCHAR(100) NOT NULL,         -- 'founder' for lifetime
  renewal_date TIMESTAMP NULL,             -- NULL for lifetime plans
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

### Complete Data Flow

```
Payment Complete
      ↓
Stripe Webhook
      ↓
┌─────────────────────────────────┐
│  1. Add to waitlist             │
│  2. Create Firebase user        │
│  3. Add to users table          │
│  4. Add to user_plans table ✨  │
│     - plan_name: 'founder'      │
│     - renewal_date: NULL        │
│  5. Send welcome email          │
│  6. Send password setup email   │
└─────────────────────────────────┘
      ↓
User receives emails
      ↓
User clicks password setup link
      ↓
Token verified (password_tokens table)
      ↓
User sets password
      ↓
Firebase password updated
      ↓
✅ User can now sign in
```

## Query Examples

### Get all founder users
```sql
SELECT u.user_id, u.email, u.created_at, up.plan_name
FROM users u
JOIN user_plans up ON u.user_id = up.user_id
WHERE up.plan_name = 'founder';
```

### Check if user has active plan
```sql
SELECT *
FROM user_plans
WHERE user_id = 'firebase_uid_here'
AND plan_name = 'founder';
```

### Get user's complete profile
```sql
SELECT 
  u.user_id,
  u.email,
  u.name,
  u.auth_provider,
  up.plan_name,
  up.renewal_date,
  up.created_at as plan_purchased_at
FROM users u
LEFT JOIN user_plans up ON u.user_id = up.user_id
WHERE u.email = 'user@example.com';
```

## Testing

### 1. Run Migration
```bash
npm run migrate
```

### 2. Check Table
```bash
node check-user-plans.js
```

### 3. Start Server
```bash
npm run dev
```

### 4. Make Test Payment
1. Go to `http://localhost:3000`
2. Enter email
3. Use test card: `4242 4242 4242 4242`
4. Complete checkout

### 5. Verify Results

**Server Console Should Show:**
```
✓ Added new email to waitlist from webhook
✓ Created Firebase user: abc123...
✓ Added user to users table: abc123...
✓ Added founder plan for user: abc123...
✓ Password setup URL: http://localhost:3000/setup-password.html?token=...
```

**Database Check:**
```sql
-- Check user was created
SELECT * FROM users WHERE email = 'test@example.com';

-- Check founder plan was added
SELECT * FROM user_plans WHERE user_id = (
  SELECT user_id FROM users WHERE email = 'test@example.com'
);
```

## Production Deployment

### Environment Variables
```env
NODE_ENV=production  # Important for correct email URLs
DB_HOST=postgresql://...
STRIPE_SECRET_KEY=sk_live_...
WEBHOOK_SECRET=whsec_...
RESEND_KEY=re_...
RESEND_FROM=noreply@yourdomain.com
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

### Pre-Deploy Checklist
- [ ] Run migrations on production database
- [ ] Set `NODE_ENV=production`
- [ ] Verify Stripe webhook URL
- [ ] Test email delivery
- [ ] Verify Firebase credentials

## Files Changed

**New Files:**
- `migrations/004_user_plans_table.sql` - User plans schema
- `check-user-plans.js` - Table verification script
- `PURCHASE_FLOW.md` - This documentation

**Modified Files:**
- `server.js` - Added user_plans insert on purchase
- `run-migration.js` - Added 004 migration

## Summary

✅ **user_plans table created**
✅ **Webhook updates user_plans on purchase**
✅ **Plan: 'founder' with NULL renewal_date**
✅ **Foreign key to users table**
✅ **Auto-updating timestamps**

After purchase, users have:
- Firebase Auth account
- Entry in `users` table
- Entry in `user_plans` table with 'founder' plan
- Entry in `waitlist` table
- Password setup email sent

This provides complete tracking of lifetime founder memberships! 🎉
