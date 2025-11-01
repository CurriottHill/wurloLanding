import { Router } from 'express';
import { transaction } from '../database/service.js';
import { generateToken } from '../middleware/auth.js';
import { AppError, asyncHandler, mapDatabaseError } from '../middleware/errorHandler.js';
import { validateRequired, sanitizeText } from '../middleware/validation.js';

const router = Router();

// AuthError replaced by AppError from middleware/errorHandler.js

/**
 * Ensure user has a plan and initial payment record.
 * Creates free plan with completed payment if none exists.
 * 
 * @param {Function} run - Transaction query runner
 * @param {string} userId - User identifier
 * @returns {Promise<number>} Plan ID
 */
async function ensureUserPlanAndPayment(run, userId) {
  const existingPlans = await run('SELECT id FROM user_plans WHERE user_id = ? LIMIT 1', [userId]);
  if (existingPlans.length > 0) {
    return existingPlans[0].id;
  }

  const planResult = await run(
    `INSERT INTO user_plans (user_id, plan_name, status, start_date, payment_method)
     VALUES (?, 'free', 'active', CURRENT_DATE, ?) RETURNING id`,
    [userId, 'free']
  );
  const planId = planResult[0].id;

  const paymentResult = await run(
    `INSERT INTO payments (user_id, plan_id, amount, currency, payment_status)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    [userId, planId, 0.0, 'GBP', 'completed']
  );

  if (paymentResult[0]?.id) {
    await run(
      `UPDATE user_plans SET last_payment_id = ? WHERE id = ?`,
      [paymentResult[0].id, planId]
    );
  }

  return planId;
}

// createQueryRunner removed - using database/service.js transaction API

/**
 * Extract and normalize user payload from request body.
 * 
 * @param {Object} body - Request body
 * @returns {Object} Normalized user data
 */
function extractUserPayload(body) {
  const { user_id: userId, name, email, auth_provider: authProvider, avatar_url: avatarUrl } = body || {};
  return {
    userId: sanitizeText(userId),
    name: sanitizeText(name),
    email: sanitizeText(email),
    authProvider: authProvider || 'firebase',
    avatarUrl: avatarUrl || null,
  };
}

/**
 * Validate user registration/login payload.
 * 
 * @param {Object} payload - User data to validate
 * @throws {AppError} If validation fails
 */
function validateUserPayload({ userId, name, email }) {
  if (!userId || typeof userId !== 'string') {
    throw new AppError('We could not verify your account. Please try again.', {
      status: 400,
      code: 'INVALID_USER_ID',
    });
  }
  if (!name || typeof name !== 'string' || name.length === 0) {
    throw new AppError('Name is required.', {
      status: 400,
      code: 'INVALID_NAME',
    });
  }
  if (!email || typeof email !== 'string' || email.length === 0) {
    throw new AppError('Email address is required.', {
      status: 400,
      code: 'INVALID_EMAIL',
    });
  }
}

router.post('/register', asyncHandler(async (req, res) => {
  const userPayload = extractUserPayload(req.body);
  validateUserPayload(userPayload);

  await transaction(async (run) => {
    await run(
      `INSERT INTO users (user_id, name, email, auth_provider, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET 
         name = EXCLUDED.name, 
         email = EXCLUDED.email, 
         auth_provider = EXCLUDED.auth_provider, 
         avatar_url = EXCLUDED.avatar_url, 
         updated_at = CURRENT_TIMESTAMP`,
      [
        userPayload.userId,
        userPayload.name,
        userPayload.email,
        userPayload.authProvider,
        userPayload.avatarUrl,
      ]
    );

    await ensureUserPlanAndPayment(run, userPayload.userId);
  });

  const token = generateToken(userPayload.userId);
  res.json({
    message: 'User registered',
    token,
    user: {
      user_id: userPayload.userId,
      name: userPayload.name,
      email: userPayload.email,
      auth_provider: userPayload.authProvider,
      avatar_url: userPayload.avatarUrl,
    },
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const userPayload = extractUserPayload(req.body);
  validateUserPayload(userPayload);

  await transaction(async (run) => {
    await run(
      `INSERT INTO users (user_id, name, email, auth_provider, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET 
         name = EXCLUDED.name, 
         email = EXCLUDED.email, 
         auth_provider = EXCLUDED.auth_provider, 
         avatar_url = EXCLUDED.avatar_url, 
         updated_at = CURRENT_TIMESTAMP`,
      [
        userPayload.userId,
        userPayload.name,
        userPayload.email,
        userPayload.authProvider,
        userPayload.avatarUrl,
      ]
    );

    await ensureUserPlanAndPayment(run, userPayload.userId);
  });

  const token = generateToken(userPayload.userId);
  res.json({
    message: 'User logged in',
    token,
    user: {
      user_id: userPayload.userId,
      name: userPayload.name,
      email: userPayload.email,
      auth_provider: userPayload.authProvider,
      avatar_url: userPayload.avatarUrl,
    },
  });
}));

export default router;
