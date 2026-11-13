const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();

const emailUser = process.env.EMAIL_USER;
const emailPass = (
  process.env.EMAIL_PASS ||
  process.env.EMAIL_PASSWORD ||
  ""
).replace(/\s+/g, "");

let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}

// Create Gmail transporter if credentials and module are available
let transporter = null;
if (nodemailer && emailUser && emailPass) {
  try {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } catch (err) {
    console.warn("[Mailer Warning] Failed to initialize nodemailer transport:", err.message);
  }
}

/**
 * Send Signup Verification OTP Email
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit verification code
 */
async function sendSignupOtpEmail(toEmail, otp) {
  if (!transporter) {
    console.log(`[Dev Mailer] Signup OTP for ${toEmail}: ${otp}`);
    return { devOtp: otp };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #2e7d32; text-align: center; margin-bottom: 8px;">🌱 Local Farm</h2>
      <h3 style="color: #333333; text-align: center; margin-top: 0;">Welcome to Local Farm!</h3>
      <p style="color: #555555; font-size: 15px; line-height: 1.5; text-align: center;">
        Thank you for joining Local Farm! Use the 6-digit verification code below to verify your email and complete your registration:
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2e7d32; background-color: #e8f5e9; padding: 14px 28px; border-radius: 8px; border: 1px dashed #2e7d32;">
          ${otp}
        </span>
      </div>

      <p style="color: #888888; font-size: 13px; text-align: center; line-height: 1.4;">
        ⏱️ This code will expire in <strong>15 minutes</strong>.<br />
        If you did not sign up for Local Farm, please ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0 16px 0;" />

      <p style="color: #666666; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
        Best regards,<br />
        <strong style="color: #2e7d32;">The Local Farm Development Team</strong>
      </p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: `"Local Farm App" <${emailUser}>`,
    to: toEmail,
    subject: "🌱 Local Farm - Verify Your Email",
    html: html,
  });

  console.log(`[Signup OTP Sent] To: ${toEmail} | Message ID: ${info.messageId}`);
  return info;
}

/**
 * Send Two-Factor Authentication (2FA) OTP Email
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit verification code
 * @param {string} purpose - 'login' | 'setup'
 */
async function send2FAOtpEmail(toEmail, otp, purpose = "login") {
  if (!transporter) {
    console.log(`[Dev Mailer] 2FA OTP for ${toEmail} (${purpose}): ${otp}`);
    return { devOtp: otp };
  }

  const isSetup = purpose === "setup";
  const title = isSetup
    ? "Two-Factor Authentication Setup"
    : "Security Verification Code";
  const message = isSetup
    ? "You requested to enable Two-Factor Authentication on your Local Farm account. Use the 6-digit code below to confirm your setup:"
    : "A sign-in attempt was detected on your Local Farm account. Enter the 6-digit security code below to complete your login:";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #2e7d32; text-align: center; margin-bottom: 8px;">🌱 Local Farm</h2>
      <h3 style="color: #333333; text-align: center; margin-top: 0;">${title}</h3>
      <p style="color: #555555; font-size: 15px; line-height: 1.5; text-align: center;">
        ${message}
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2e7d32; background-color: #e8f5e9; padding: 14px 28px; border-radius: 8px; border: 1px dashed #2e7d32;">
          ${otp}
        </span>
      </div>

      <p style="color: #888888; font-size: 13px; text-align: center; line-height: 1.4;">
        ⏱️ This security code will expire in <strong>10 minutes</strong>.<br />
        If you did not initiate this request, someone may be trying to access your account. Please change your password immediately.
      </p>

      <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0 16px 0;" />

      <p style="color: #666666; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
        Best regards,<br />
        <strong style="color: #2e7d32;">The Local Farm Security Team</strong>
      </p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: `"Local Farm Security" <${emailUser}>`,
    to: toEmail,
    subject: `🌱 Local Farm - ${isSetup ? "Confirm 2FA Setup" : "Your Login Verification Code"} [${otp}]`,
    html: html,
  });

  console.log(`[2FA OTP Sent] To: ${toEmail} (${purpose}) | Message ID: ${info.messageId}`);
  return info;
}

async function sendPasswordChangedEmail(toEmail, userName = "User") {
  if (!transporter) {
    return null;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #2e7d32; text-align: center; margin-bottom: 8px;">🌱 Local Farm</h2>
      <h3 style="color: #333333; text-align: center; margin-top: 0;">Password Changed Successfully</h3>
      <p style="color: #555555; font-size: 15px; line-height: 1.5;">
        Hi <strong>${userName}</strong>,
      </p>
      <p style="color: #555555; font-size: 15px; line-height: 1.5;">
        The password for your Local Farm account was recently updated. All other active device sessions have been safely logged out.
      </p>
      <div style="background-color: #f9fbf9; border: 1px solid #dcf0dc; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #2e7d32; font-weight: bold; font-size: 14px;">🔒 Account Security Notice</p>
        <p style="margin: 6px 0 0 0; color: #555555; font-size: 13px; line-height: 1.4;">
          If you made this change, no further action is required. If you did NOT change your password, please contact our support team or use "Forgot Password" to regain control immediately.
        </p>
      </div>
      <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0 16px 0;" />
      <p style="color: #666666; font-size: 13px; text-align: center; margin: 0; line-height: 1.5;">
        Best regards,<br />
        <strong style="color: #2e7d32;">The Local Farm Security Team</strong>
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Local Farm Security" <${emailUser}>`,
      to: toEmail,
      subject: `🌱 Local Farm - Security Notice: Your password was changed`,
      html: html,
    });
    console.log(`[Password Changed Email Sent] To: ${toEmail} | Message ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.warn("[Password Changed Email Error]", err.message);
    return null;
  }
}

module.exports = {
  sendSignupOtpEmail,
  sendOtpEmail: sendSignupOtpEmail,
  send2FAOtpEmail,
  sendPasswordChangedEmail,
};
