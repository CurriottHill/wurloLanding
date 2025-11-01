# Email Sending Troubleshooting Guide

## ✅ Fixes Applied

### 1. **Resend Initialization Order** (FIXED)
- Moved Resend initialization **before** webhook handler
- Previously initialized after webhooks, causing emails to fail silently
- Now initializes at server startup with clear logging

### 2. **Production URLs Updated** (FIXED)
- Stripe success/cancel URLs: `https://wurlolanding.onrender.com`
- Password setup email links: `https://wurlolanding.onrender.com/setup-password`
- Removed localhost URL logic for consistent production behavior

### 3. **Comprehensive Logging Added** (FIXED)
All email operations now log:
- 📧 Email attempt started
- ✅ Success with email ID
- ❌ Failures with error details

## 🔍 Verify Email Configuration

### Check Environment Variables
```bash
cd server
node check-email-config.js
```

Should show:
```
✅ Resend email service initialized with from: Wurlo <info@wurlo.org>
```

### Check Server Logs
When server starts, you should see:
```
Firebase Admin initialized
Resend email service initialized with from: Wurlo <info@wurlo.org>
Gemini API key loaded: { geminiConfigured: true, geminiLength: 39 }
```

## 📨 Email Flow After Payment

### When Stripe Webhook Fires (`checkout.session.completed`):

1. **Webhook Received**
   ```
   🎯 Webhook received: checkout.session.completed
   💰 Processing checkout.session.completed event
      Customer email: user@example.com
      Session ID: cs_xxxxx
   ```

2. **User Registration**
   ```
   📝 Processing user registration for: user@example.com
   Added new email to waitlist from webhook: user@example.com
   Created Firebase user: abc123xyz
   Added user to users table: abc123xyz
   Added founder plan for user: abc123xyz
   ```

3. **Email Sending Triggered**
   ```
   📨 Triggering email sends for: user@example.com
   
   📧 Attempting to send welcome email to: user@example.com
   ✅ Welcome email sent successfully to: user@example.com
      Email ID: re_xxxxxxxxxxxx
   
   🔐 Attempting to send password setup email to: user@example.com
      Password setup URL: https://wurlolanding.onrender.com/setup-password?token=xxxx
   ✅ Password setup email sent successfully to: user@example.com
      Email ID: re_xxxxxxxxxxxx
   ```

4. **Webhook Complete**
   ```
   ✅ Webhook processed successfully
   ```

## 🚨 Common Issues

### Emails Not Sending

**Check 1: Environment Variables**
```bash
# In .env file:
RESEND_KEY=re_xxxxxxxxxxxxx  # Must start with 're_'
RESEND_FROM=Wurlo <info@wurlo.org>  # Must be verified in Resend dashboard
```

**Check 2: Resend Domain Verification**
- Log into https://resend.com/domains
- Verify your domain is verified (green checkmark)
- Ensure `info@wurlo.org` is authorized

**Check 3: Server Logs**
If you see:
```
⚠️  Resend not configured - emails will NOT be sent
   Missing: RESEND_KEY
```
→ Environment variables not loaded

**Check 4: Webhook Configuration**
- Stripe Dashboard → Developers → Webhooks
- Endpoint URL: `https://your-render-url.onrender.com/api/webhook`
- Events: `checkout.session.completed`
- Webhook signing secret matches `WEBHOOK_SECRET` in .env

## 🧪 Test Email Sending

### Test 1: Manual Email Send
```bash
cd server
node test-send-email.js your-email@example.com
```

Expected output:
```
📧 Testing password setup email to: your-email@example.com
✅ Password setup email sent successfully
   Email ID: re_xxxxxxxxxxxx
```

### Test 2: Test Checkout (Stripe Test Mode)
1. Use test card: `4242 4242 4242 4242`
2. Complete checkout
3. Check server logs for email sending confirmation
4. Check email inbox (may take 1-2 minutes)

### Test 3: Verify Webhook Delivery
- Stripe Dashboard → Developers → Webhooks
- Click on your webhook endpoint
- View "Events" tab to see recent deliveries
- Check for `checkout.session.completed` events

## 📋 Checklist for Production

- [ ] `RESEND_KEY` set in Render environment variables
- [ ] `RESEND_FROM` set in Render environment variables
- [ ] Domain verified in Resend dashboard
- [ ] Webhook endpoint configured in Stripe
- [ ] `WEBHOOK_SECRET` matches Stripe webhook secret
- [ ] Test payment completed successfully
- [ ] Welcome email received
- [ ] Password setup email received
- [ ] Password setup link works

## 🔗 URLs Reference

### Production URLs (Current):
- Frontend: `https://wurlolanding.onrender.com`
- Backend API: `https://wurlolanding.onrender.com/api`
- Webhook: `https://wurlolanding.onrender.com/api/webhook`
- Setup Password: `https://wurlolanding.onrender.com/setup-password`

### Local Development:
- Frontend: `http://localhost:5173` (React dev server)
- Backend API: `http://localhost:3000` (Node server)
- Note: Stripe webhooks cannot reach localhost without tunneling
