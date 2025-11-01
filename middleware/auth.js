import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in environment variables for authentication.');
}

/**
 * Express middleware to verify JWT tokens from Authorization header.
 * Attaches decoded user payload to req.user if valid.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @example
 * router.get('/protected', authenticateToken, (req, res) => {
 *   res.json({ user_id: req.user.user_id });
 * });
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Generate a JWT token for a user.
 * 
 * @param {string} userId - User identifier to encode in the token
 * @param {string} [expiresIn='24h'] - Token expiration time
 * @returns {string} Signed JWT token
 */
export function generateToken(userId, expiresIn = '24h') {
  return jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn });
}
