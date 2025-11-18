/**
 * Email Service
 * 
 * Centralized email sending functionality using Resend.
 * Handles welcome emails, password setup, and waitlist confirmations.
 */

/**
 * Send welcome email to new users
 * 
 * @param {Object} resend - Resend client instance
 * @param {string} resendFrom - Sender email address
 * @param {string} email - Recipient email
 */
export async function sendWelcomeEmail(resend, resendFrom, email) {
  if (!resend) {
    console.error('❌ Cannot send welcome email - Resend not configured');
    return;
  }
  
  try {
    const result = await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: 'Welcome to Wurlo - Your Lifetime Access is Active! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(79,70,229,0.15);">
              <div style="background:linear-gradient(135deg, #4F46E5, #06B6D4);padding:32px 40px;color:#fff;">
                <h1 style="margin:0;font-size:28px;font-weight:700;">Welcome to Wurlo! 🎉</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">Your lifetime access is now active.</p>
              </div>
              <div style="padding:32px 40px;">
                <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1f2937;">Thank you for your purchase!</h2>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1f2937;">
                  You now have lifetime access to Wurlo's adaptive learning platform. We'll send you early access before our December 2025 launch.
                </p>
                <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:24px 0;">
                  <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1f2937;">What's next?</h3>
                  <ul style="margin:0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
                    <li style="margin-bottom:8px;">Check your inbox for a password setup email</li>
                    <li style="margin-bottom:8px;">You'll get early access before December 2025</li>
                    <li style="margin-bottom:8px;">Start learning with AI-powered adaptive courses</li>
                  </ul>
                </div>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#475569;">
                  Questions? Just reply to this email and we'll help.
                </p>
              </div>
              <div style="padding:20px 40px;background:#f1f5f9;font-size:12px;line-height:1.6;color:#475569;text-align:center;">
                © ${new Date().getFullYear()} Wurlo. Smarter paths, faster progress.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Welcome to Wurlo! 🎉\n\nYour lifetime access is now active.\n\nThank you for your purchase! You now have lifetime access to Wurlo's adaptive learning platform. We'll send you early access before our December 2025 launch.\n\nWhat's next?\n• Check your inbox for a password setup email\n• You'll get early access before December 2025\n• Start learning with AI-powered adaptive courses\n\nQuestions? Just reply to this email and we'll help.\n\n— The Wurlo Team`
    });
    console.log('✅ Welcome email sent to:', email);
    return result;
  } catch (err) {
    console.error('❌ Error sending welcome email:', err.message);
    throw err;
  }
}

/**
 * Send waitlist confirmation email
 * 
 * @param {Object} resend - Resend client instance
 * @param {string} resendFrom - Sender email address
 * @param {string} email - Recipient email
 */
export async function sendWaitlistConfirmationEmail(resend, resendFrom, email) {
  if (!resend) {
    console.error('❌ Cannot send waitlist email - Resend not configured');
    return;
  }
  
  try {
    const result = await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: "You're on the Wurlo Waitlist! 🚀",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(79,70,229,0.15);">
              <div style="background:linear-gradient(135deg, #4F46E5, #06B6D4);padding:32px 40px;color:#fff;">
                <h1 style="margin:0;font-size:28px;font-weight:700;">You're on the list! 🎉</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">Thanks for joining the Wurlo waitlist.</p>
              </div>
              <div style="padding:32px 40px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1f2937;">
                  We're excited to have you! You'll be among the first to know when Wurlo launches in December 2025.
                </p>
                <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:24px 0;">
                  <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1f2937;">What's Wurlo?</h3>
                  <ul style="margin:0;padding:0 0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
                    <li style="margin-bottom:8px;">AI-powered adaptive learning platform</li>
                    <li style="margin-bottom:8px;">Personalized courses that adapt to your pace</li>
                    <li style="margin-bottom:8px;">Smart placement tests to start at the right level</li>
                  </ul>
                </div>
                <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:16px;margin:24px 0;border-radius:8px;">
                  <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.6;">
                    <strong>Limited Founder Offer:</strong> Get lifetime access for a one-time payment before launch. Early supporters get the best deal!
                  </p>
                </div>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#475569;">
                  Stay tuned for updates. We'll keep you posted on our progress!
                </p>
              </div>
              <div style="padding:20px 40px;background:#f1f5f9;font-size:12px;line-height:1.6;color:#475569;text-align:center;">
                © ${new Date().getFullYear()} Wurlo. Smarter paths, faster progress.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `You're on the list! 🎉\n\nThanks for joining the Wurlo waitlist.\n\nWe're excited to have you! You'll be among the first to know when Wurlo launches in December 2025.\n\nWhat's Wurlo?\n• AI-powered adaptive learning platform\n• Personalized courses that adapt to your pace\n• Smart placement tests to start at the right level\n\nLimited Founder Offer: Get lifetime access for a one-time payment before launch. Early supporters get the best deal!\n\nStay tuned for updates. We'll keep you posted on our progress!\n\n— The Wurlo Team`
    });
    console.log('✅ Waitlist confirmation sent to:', email);
    return result;
  } catch (err) {
    console.error('❌ Error sending waitlist email:', err.message);
    throw err;
  }
}

/**
 * Send password setup email with reset token
 * 
 * @param {Object} resend - Resend client instance
 * @param {string} resendFrom - Sender email address
 * @param {string} email - Recipient email
 * @param {string} setupToken - Password reset token
 * @param {string} frontendUrl - Frontend base URL
 */
export async function sendPasswordSetupEmail(resend, resendFrom, email, setupToken, frontendUrl) {
  const setupUrl = `${frontendUrl}/setup-password?token=${setupToken}`;
  
  console.log('🔐 Password setup URL:', setupUrl);
  
  if (!resend) {
    console.error('❌ Cannot send password setup email - Resend not configured');
    console.warn('   Setup link (for manual sharing):', setupUrl);
    return;
  }
  
  try {
    const result = await resend.emails.send({
      from: resendFrom,
      to: email,
      subject: 'Set Up Your Wurlo Account Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(79,70,229,0.15);">
              <div style="background:linear-gradient(135deg, #4F46E5, #06B6D4);padding:32px 40px;color:#fff;">
                <h1 style="margin:0;font-size:28px;font-weight:700;">Set Up Your Password 🔐</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">Complete your Wurlo account setup.</p>
              </div>
              <div style="padding:32px 40px;">
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1f2937;">
                  You're almost ready to start your learning journey! Click the button below to set up your password and access your account.
                </p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${setupUrl}" style="display:inline-block;background:linear-gradient(135deg, #4F46E5, #06B6D4);color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
                    Set Up Password
                  </a>
                </div>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${setupUrl}" style="color:#4F46E5;word-break:break-all;">${setupUrl}</a>
                </p>
                <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;margin:24px 0;border-radius:8px;">
                  <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
                    <strong>Security note:</strong> This link will expire in 24 hours. If you didn't request this, please ignore this email.
                  </p>
                </div>
              </div>
              <div style="padding:20px 40px;background:#f1f5f9;font-size:12px;line-height:1.6;color:#475569;text-align:center;">
                © ${new Date().getFullYear()} Wurlo. Smarter paths, faster progress.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Set Up Your Wurlo Password\n\nYou're almost ready to start your learning journey! Click the link below to set up your password and access your account.\n\n${setupUrl}\n\nSecurity note: This link will expire in 24 hours. If you didn't request this, please ignore this email.\n\n— The Wurlo Team`
    });
    console.log('✅ Password setup email sent to:', email);
    return result;
  } catch (err) {
    console.error('❌ Error sending password setup email:', err.message);
    throw err;
  }
}
