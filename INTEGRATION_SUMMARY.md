# WurloServer Integration Summary

## Overview
Successfully integrated all files from `wurloServer` into the main `server` folder, combining two separate Express applications into one unified backend.

## Changes Made

### 1. Directory Structure
**Moved from `wurloServer/` to `server/`:**
- ✅ `auth/` - Authentication routes (register, login)
- ✅ `database/` - Database connection pool and service layer
- ✅ `middleware/` - Auth, error handling, and validation middleware
- ✅ `services/` - Gemini, Grok, placement test, and PDF services
- ✅ `routes/` - Onboarding routes
- ✅ `utils/` - Retry and parser utilities
- ✅ `scripts/` - Migration scripts
- ✅ `fonts/` - PDF generation fonts
- ✅ `images/` - Uploaded user images

### 2. Package.json Dependencies Added
```json
"jsonwebtoken": "^9.0.2",
"marked": "^12.0.2",
"mysql2": "^3.15.1",  // Note: Used for compatibility but converted to PostgreSQL
"pdfkit": "^0.15.2",
"puppeteer": "^23.8.0",
"youtube-transcript": "^1.2.1"
```

### 3. Database Migration (MySQL → PostgreSQL)

**Updated Files:**
- `database/pool.js` - Now uses PostgreSQL connection pool
- `database/service.js` - Converts `?` placeholders to `$1, $2, etc.`
- `auth/authRoutes.js` - Updated to use `ON CONFLICT` instead of `ON DUPLICATE KEY UPDATE`
- `routes/onboardingRoutes.js` - Updated SQL syntax for PostgreSQL
- `services/placementTestService.js` - Changed `insertId` to `RETURNING id`
- All migration files (`*.sql`) - Converted to PostgreSQL syntax

**Key Conversions:**
- `AUTO_INCREMENT` → `BIGSERIAL`
- `JSON` → `JSONB`
- `NOW()` → `CURRENT_TIMESTAMP`
- `CURDATE()` → `CURRENT_DATE`
- `MODIFY COLUMN` → `ALTER COLUMN TYPE`
- `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE`
- `ENGINE=InnoDB` → Removed (PostgreSQL default)
- `insertId` → `RETURNING id` clause

### 4. Server.js Integration

**Added Routes:**
```javascript
app.use('/onboarding', onboardingRoutes);  // Placement tests and moderation
app.use('/auth', authRoutes);              // User registration and login
```

**Added Endpoints:**
- `GET /` - Health check with user list
- `GET /me` - Protected user profile endpoint (requires JWT)

**Added Middleware:**
- Global error handler from `middleware/errorHandler.js`
- Server timeout configuration for long-running AI requests

### 5. Environment Variables

**Added to .env.example:**
```
JWT_SECRET=your-secret-jwt-key-here-replace-with-random-string
GEMINI_API_KEY=your-gemini-api-key-here
XAI_API_KEY=your-xai-grok-api-key-here
```

### 6. Base URLs Verified

**All URLs maintained correctly:**
- Production backend: `https://wurlolanding.onrender.com`
- Production frontend: `https://wurlo.org`
- Password setup redirect: `https://wurlo.org/setup-password?token=...`
- Client API base: Configured in `client-react/src/utils/api.js`

## File Structure After Integration

```
server/
├── auth/
│   └── authRoutes.js
├── database/
│   ├── pool.js
│   ├── service.js
│   └── migrations/
│       ├── 001_create_course_jobs.sql
│       ├── 002_fix_user_onboarding_question_type.sql
│       └── 003_alter_placement_tests_experience_level.sql
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── validation.js
├── services/
│   ├── geminiClient.js
│   ├── grokClient.js
│   ├── apiCost.js
│   ├── placementTestService.js
│   ├── placementSummaryService.js
│   ├── textAnswerEvaluator.js
│   └── geminiUtils.js
├── routes/
│   └── onboardingRoutes.js
├── utils/
│   ├── retry.js
│   └── parsers.js
├── scripts/
│   └── runMigrations.js
├── fonts/ (for PDF generation)
├── images/ (user uploads)
├── server.js (main integrated server)
├── connection.js (PostgreSQL pool)
├── package.json (merged dependencies)
└── .env.example (updated with new vars)
```

## Testing Checklist

Before deploying to Render, ensure:

- [ ] All environment variables are set in Render dashboard
  - `JWT_SECRET` (generate a secure random string)
  - `GEMINI_API_KEY`
  - `XAI_API_KEY`
  - All existing variables (DB_HOST, STRIPE_SECRET_KEY, etc.)

- [ ] Database tables exist for new features:
  - `placement_tests`
  - `placement_questions`
  - `placement_attempts`
  - `placement_attempt_questions`
  - `user_onboarding`
  - `api_usage`
  - `course_jobs`

- [ ] Run migrations if needed:
  ```bash
  node scripts/runMigrations.js
  ```

- [ ] Test endpoints:
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login
  - `GET /me` - Protected profile (with JWT token)
  - `POST /onboarding/moderate` - Content moderation
  - `POST /onboarding/submit` - Onboarding submission
  - `POST /onboarding/answer` - Placement test answers

## Port Configuration

- **Server**: Runs on port 3000 (or PORT env var)
- **Client**: Runs on port 5173 (Vite dev server)

## Notes

1. **Database**: All queries now use PostgreSQL syntax. The `database/service.js` automatically converts MySQL-style `?` placeholders to PostgreSQL `$1, $2, etc.`

2. **CORS**: Configured to allow requests from:
   - `https://wurlolanding.onrender.com`
   - `https://wurlo.org`
   - Any domain matching `https://*.pages.dev`

3. **Authentication**: Uses JWT tokens with configurable expiration (default 24h)

4. **AI Services**: 
   - Gemini for content moderation and placement summaries
   - Grok (X.AI) for placement test generation

5. **Render Deployment**: The app is designed to be hosted on Render with:
   - Frontend: `wurlo.org`
   - Backend: `wurlolanding.onrender.com`

## Success Criteria

✅ All files successfully moved from wurloServer
✅ Package dependencies merged
✅ MySQL → PostgreSQL conversion complete
✅ Routes integrated into main server.js
✅ Base URLs preserved (wurlo.org, wurlolanding.onrender.com)
✅ Environment variables documented
✅ Migration files updated to PostgreSQL syntax
✅ No duplicate code or conflicting imports
