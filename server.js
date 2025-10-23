import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './connection.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
const pool = db();

// Serve the static landing page from the client directory
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Simple email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Get remaining spots endpoint
app.get('/api/spots-remaining', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM waitlist');
    const count = parseInt(result.rows[0].count, 10) || 0;
    const remaining = Math.max(0, 100 - count);
    return res.status(200).json({ remaining, total: 100, subscribed: count });
  } catch (err) {
    console.error('Error fetching spots count:', err);
    // Return default values if database fails
    return res.status(200).json({ remaining: 100, total: 100, subscribed: 0 });
  }
});

// Waitlist endpoint
app.post('/api/subscribe', async (req, res) => {
  try {
    const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email.' });
    }

    await pool.query('INSERT INTO waitlist (email) VALUES ($1)', [email]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Waitlist error:', err);
    return res.status(500).json({ message: 'Could not save your email. Try again soon.' });
  }
});

// Fallback to index.html for unmatched GETs (optional, helps when deep-linking)
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexPath = path.join(clientPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Wurlo landing running on http://localhost:${PORT}`);
});
