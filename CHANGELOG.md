# Changelog

## Latest Updates

### ✅ Users Table Integration
- Created `users` table migration (003_users_table.sql)
- Webhook now stores user info in `users` table with Firebase UID
- Stores: `user_id` (Firebase UID), `email`, `auth_provider` ('firebase')
- Auto-updates `updated_at` timestamp on changes

### ✅ Fixed Email URLs
- Password setup emails now auto-detect environment
- Development (localhost): `http://localhost:3000/setup-password.html`
- Production: `https://wurlolanding.onrender.com/setup-password.html`
- Set `NODE_ENV=production` in production environment

### Database Tables

**waitlist** - Original email collection
```sql
email VARCHAR(255) UNIQUE
created_at TIMESTAMP
```

**users** - User accounts (NEW)
```sql
user_id VARCHAR(125) PRIMARY KEY  -- Firebase UID
email VARCHAR(255) UNIQUE
name VARCHAR(255)
auth_provider VARCHAR(100)        -- 'firebase'
avatar_url VARCHAR(255)
created_at TIMESTAMP
updated_at TIMESTAMP               -- Auto-updated
```

**password_tokens** - Password reset tokens
```sql
email VARCHAR(255) UNIQUE
token VARCHAR(64)
expires_at TIMESTAMP
used BOOLEAN
created_at TIMESTAMP
```

### Flow on Payment

1. ✅ Stripe payment completed
2. ✅ Email added to `waitlist` table
3. ✅ Firebase user created (random password)
4. ✅ User info stored in `users` table (UID, email, provider)
5. ✅ Welcome email sent
6. ✅ Password setup email sent (correct URL based on environment)

### Testing

```bash
# Run migrations (includes users table)
npm run migrate

# Start development server
npm run dev

# Test at http://localhost:3000
# Password setup email will link to http://localhost:3000/setup-password.html
```

### Environment Variables

Make sure your `.env` has:
```env
# For localhost email links during development
NODE_ENV=development

# For production
NODE_ENV=production
```

### What Changed

**Files Modified:**
- `server.js` - Store users in `users` table, auto-detect URL
- `run-migration.js` - Run both password_tokens and users migrations
- `FIREBASE_SETUP.md` - Updated documentation

**Files Created:**
- `migrations/003_users_table.sql` - Users table schema
- `CHANGELOG.md` - This file

### Database Schema Compatibility

The `users` table is compatible with your MySQL schema but converted to PostgreSQL:
- `AUTO_INCREMENT` → `SERIAL`
- `ON UPDATE CURRENT_TIMESTAMP` → Trigger function
- MySQL syntax → PostgreSQL syntax

All other functionality remains the same! ✅
