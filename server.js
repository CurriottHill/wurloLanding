import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Resend } from 'resend';
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
};

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
const pool = db();

let emailEnabled = false;
const emailTestToken = (process.env.EMAIL_TEST_TOKEN || '').trim();
const resendApiKey = (process.env.RESEND_KEY || '').trim();
const resendFrom = (process.env.RESEND_FROM || '').trim();
let resendClient = null;

try {
  if (resendApiKey && resendFrom) {
    resendClient = new Resend(resendApiKey);
    emailEnabled = true;
  }
} catch (err) {
  console.error('Failed to configure email transport:', err);
  emailEnabled = false;
}

async function sendWaitlistEmail(toEmail) {
  if (!emailEnabled) return;
  const subject = "You're on the Wurlo waitlist";
  const html = buildWaitlistEmailHtml();
  const text = buildWaitlistEmailText();
  const { data, error } = await resendClient.emails.send({
    from: resendFrom,
    to: toEmail,
    subject,
    html,
    text,
    headers: {
      'X-Entity-Ref-ID': 'randomstring123',
      Precedence: 'bulk',
    },
  });
  if (error) {
    throw error;
  }
  console.log('Waitlist email send result:', {
    id: data && data.id,
  });
}

function buildWaitlistEmailHtml() {
  const primary = '#4F46E5';
  const accent = '#06B6D4';
  const slate = '#0F172A';
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Wurlo Waitlist</title>
    </head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${slate};">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(79,70,229,0.15);">
              <tr>
                <td style="background:linear-gradient(135deg, ${primary}, ${accent});padding:32px 40px;color:#fff;">
                  <h1 style="margin:0;font-size:28px;font-weight:700;">You're on the Wurlo waitlist 🎉</h1>
                  <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">We'll send you a pre-release beta link as soon as it's ready.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 40px;">
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1f2937;">Keep an eye on your inbox — early access arrives before the December 2025 launch.</p>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Questions? Reply to this email and we'll help.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 40px;background:#f1f5f9;font-size:12px;line-height:1.6;color:#475569;text-align:center;">
                  © ${new Date().getFullYear()} Wurlo. Smarter paths, faster progress.<br/>
                  You’re receiving this email because you joined the Wurlo waitlist.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function buildWaitlistEmailText() {
  return `You're on the Wurlo waitlist! We'll send you a pre-release beta link as soon as it's ready. Keep an eye on your inbox for early access before the December 2025 launch.\n\nQuestions? Just reply to this email and we'll help.\n\n— The Wurlo Team`;
}

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

    if (emailEnabled) {
      sendWaitlistEmail(email).catch((err) => {
        console.error('Failed to send waitlist email:', err);
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.code === '23505')) {
      return res.status(409).json({ message: "You're already on the waitlist." });
    }
    console.error('Waitlist error:', err);
    return res.status(500).json({ message: 'Could not save your email. Try again soon.' });
  }
});

if (emailTestToken) {
  app.post('/api/internal/send-test-email', async (req, res) => {
    try {
      const providedToken = String(req.headers['x-email-test-token'] || '').trim();
      if (providedToken !== emailTestToken) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ message: 'Enter a valid email.' });
      }
      if (!emailEnabled) {
        return res.status(503).json({ message: 'Email transport is not configured.' });
      }
      await sendWaitlistEmail(email);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Internal test email error:', err);
      return res.status(500).json({ message: 'Failed to send test email.' });
    }
  });
}

// Fallback to index.html for unmatched GETs (optional, helps when deep-linking)
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexPath = path.join(clientPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not found');
});

const cliArgs = process.argv.slice(2);

if (cliArgs[0] === '--send-test-email') {
  const targetEmail = (cliArgs[1] || '').trim().toLowerCase();
  if (!targetEmail || !isValidEmail(targetEmail)) {
    console.error('Usage: node server.js --send-test-email someone@example.com');
    process.exit(1);
  }
  if (!emailEnabled) {
    console.error('Email transport is not configured.');
    process.exit(1);
  }
  sendWaitlistEmail(targetEmail)
    .then(() => {
      console.log(`Test email sent to ${targetEmail}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to send test email:', err);
      process.exit(1);
    });
} else {
  app.listen(PORT, () => {
    console.log(`Wurlo landing running on http://localhost:${PORT}`);
  });
}
