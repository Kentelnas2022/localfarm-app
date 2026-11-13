const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();
const { initDB, getPool } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const {
  JWT_SECRET,
  authenticateToken,
  requireAdmin,
  requestLogger,
} = require("./middleware/auth");
const {
  sendSignupOtpEmail,
  send2FAOtpEmail,
  sendPasswordChangedEmail,
} = require("./mailer");
const { generateBase32Secret, verifyTotpToken } = require("./totp");

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(requestLogger);

// Helper: Generate JWT token
function generateToken(user, sessionId = null) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionId || null,
    },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

// Helper: Record active session in user_sessions
async function recordUserSession(userId, req, deviceInfo = null) {
  try {
    const pool = getPool();
    const info = deviceInfo || req.body?.deviceInfo || {};
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const deviceName = (info.deviceName || "").trim() || "LocalFarm Device";
    const deviceType = (info.deviceType || "phone").toLowerCase();
    const osName =
      (info.osName || "").trim() ||
      (req.headers["user-agent"]?.includes("Windows") ? "Windows" : "Mobile");
    const osVersion = (info.osVersion || "").trim();
    const browserOrApp = (info.browserOrApp || "").trim() || "LocalFarm App";
    const location =
      (info.location || "").trim() || "Iligan City, Lanao Del Norte";

    const { rows } = await pool.query(
      `INSERT INTO user_sessions (
        user_id, device_name, device_type, os_name, os_version, browser_or_app, ip_address, location, is_active, last_active_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
      RETURNING id`,
      [
        userId,
        deviceName,
        deviceType,
        osName,
        osVersion,
        browserOrApp,
        ip,
        location,
      ]
    );

    return rows[0]?.id || null;
  } catch (err) {
    console.warn("[Session Recording Warning]", err.message);
    return null;
  }
}

// Helper: Human-readable relative time
function formatRelativeTime(date) {
  if (!date) return "Active recently";
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 2) return "Active now";
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  if (diffHours === 1) return "Active 1 hour ago";
  if (diffHours < 24) return `Active ${diffHours} hours ago`;
  if (diffDays === 1) return "Active yesterday";
  if (diffDays < 7) return `Active ${diffDays} days ago`;
  return `Active on ${new Date(date).toLocaleDateString()}`;
}

// Helper: Format User object for client
function formatUser(row) {
  return {
    id: String(row.id),
    name:
      row.full_name ||
      `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
      row.username ||
      "User",
    fullName:
      row.full_name ||
      `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
      row.username ||
      "User",
    email: row.email,
    role: row.role || "user",
    username: row.username || "",
    phoneNumber: row.phone_number || "",
    gender: row.gender || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    avatarUrl: row.avatar_url || "",
    coverPhotoUrl: row.cover_photo_url || "",
    bio: row.bio || "",
    about: row.bio || "",
    location: row.location || "Iligan City, Philippines",
    farmName: row.farm_name || "",
    farmLocation: row.farm_location || row.location || "",
    primaryCrops: row.primary_crops || "",
    roleId: row.role_id || (row.role === "admin" ? 1 : 2),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    twoFactorMethod: row.two_factor_method || "none",
    createdAt: row.created_at || null,
  };
}

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

// 0. Root & API landing page
app.get(["/", "/api"], (req, res) => {
  res.json({
    status: "ok",
    message: "Welcome to Local Farm PostgreSQL API Server",
    database: "localfarm (PostgreSQL)",
    endpoints: {
      health: "GET /api/health",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      me: "GET /api/auth/me",
      updateProfile: "PUT /api/auth/profile",
      sendSignupOtp: "POST /api/auth/send-signup-otp",
      forgotPassword: "POST /api/auth/forgot-password",
      verifyOtp: "POST /api/auth/verify-otp",
      resetPassword: "POST /api/auth/reset-password",
      adminUsers: "GET /api/admin/users",
    },
  });
});

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Local Farm PostgreSQL API running" });
});

// 2. Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      name,
      username,
      phoneNumber,
      gender,
      role,
    } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const pool = getPool();

    // Check if email already exists
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ message: "An account with this email already exists." });
    }

    // Check if username already exists (if provided)
    if (username) {
      const { rows: existingUser } = await pool.query(
        "SELECT id FROM users WHERE username = $1 LIMIT 1",
        [username.trim()],
      );
      if (existingUser.length > 0) {
        return res
          .status(400)
          .json({ message: "This username is already taken." });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const fName = (firstName || name?.split(" ")[0] || "").trim();
    const lName = (lastName || name?.split(" ").slice(1).join(" ") || "").trim();
    const fullName = `${fName} ${lName}`.trim() || username?.trim() || "User";
    const userRole =
      role === "admin" || email.toLowerCase().includes("admin")
        ? "admin"
        : "user";
    const userRoleId = userRole === "admin" ? 1 : 2;

    const { rows: result } = await pool.query(
      `INSERT INTO users (
        first_name, last_name, full_name, username, email, password, password_hash, 
        phone_number, gender, role, role_id, eula_accepted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING id`,
      [
        fName,
        lName,
        fullName,
        username ? username.trim() : null,
        email.trim().toLowerCase(),
        hashedPassword,
        hashedPassword,
        phoneNumber ? phoneNumber.trim() : null,
        gender || null,
        userRole,
        userRoleId,
      ],
    );

    const newUserId = result[0].id;

    // Mark signup OTP as used
    try {
      await pool.query(
        "UPDATE otps SET is_used = TRUE WHERE email = $1 AND type = 'signup'",
        [email.trim().toLowerCase()]
      );
    } catch {}

    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      newUserId,
    ]);
    const user = formatUser(rows[0]);
    const sessionId = await recordUserSession(user.id, req, req.body.deviceInfo);
    const token = generateToken(user, sessionId);

    res.status(201).json({
      message: "User registered successfully",
      user,
      token,
    });
  } catch (err) {
    console.error("[Register Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to register user." });
  }
});

// 3. Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message:
          "No account found with this email. Please check your email or sign up.",
      });
    }

    const userRow = rows[0];

    // Check password (supports bcrypt and plain text fallback for dev seeds)
    let isMatch = false;
    const userPass = userRow.password || userRow.password_hash;
    if (
      userPass &&
      (userPass.startsWith("$2a$") ||
        userPass.startsWith("$2b$") ||
        userPass.startsWith("$2y$"))
    ) {
      isMatch = await bcrypt.compare(password, userPass);
    } else {
      isMatch = password === userPass;
    }

    if (!isMatch) {
      return res.status(400).json({
        message:
          "Incorrect password. Please check your password and try again.",
      });
    }

    // Two-Factor Authentication Check
    if (userRow.two_factor_enabled) {
      if (userRow.two_factor_method === "authenticator") {
        return res.json({
          requires2FA: true,
          method: "authenticator",
          email: userRow.email,
          message: "Enter the 6-digit code displayed in Google Authenticator.",
        });
      }

      // Default: Email 2FA
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Clear any prior login OTPs for this user
      await pool.query(
        "DELETE FROM otps WHERE email = $1 AND type = '2fa_login'",
        [userRow.email.trim().toLowerCase()]
      );

      await pool.query(
        "INSERT INTO otps (email, otp, type, expires_at) VALUES ($1, $2, '2fa_login', $3)",
        [userRow.email.trim().toLowerCase(), otp, expiresAt]
      );

      console.log(`[2FA Login OTP Generated] Email: ${userRow.email}, OTP: ${otp}`);

      try {
        await send2FAOtpEmail(userRow.email.trim().toLowerCase(), otp, "login");
      } catch (mailErr) {
        console.error("[Mailer Error] Could not deliver 2FA login OTP:", mailErr.message);
      }

      return res.json({
        requires2FA: true,
        method: "email",
        email: userRow.email,
        message: "Two-factor authentication code sent to your email.",
        devOtp: otp,
      });
    }

    const user = formatUser(userRow);
    const sessionId = await recordUserSession(user.id, req, req.body.deviceInfo);
    const token = generateToken(user, sessionId);

    res.json({
      message: "Login successful",
      user,
      token,
    });
  } catch (err) {
    console.error("[Login Error]", err);
    res.status(500).json({ message: err.message || "Failed to sign in." });
  }
});

// 3.1 Verify 2FA Login (Supports Email OTP & Google Authenticator TOTP)
app.post("/api/auth/2fa/verify-login", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and verification code are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const pool = getPool();

    const { rows: userRows } = await pool.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [cleanEmail]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const userRow = userRows[0];

    if (userRow.two_factor_method === "authenticator") {
      const isValid = verifyTotpToken(cleanOtp, userRow.two_factor_secret);
      if (!isValid) {
        return res.status(400).json({
          message: "Invalid code. Please check the 6-digit code in Google Authenticator and try again.",
        });
      }
    } else {
      // Email OTP verification
      const { rows: otpRows } = await pool.query(
        `SELECT * FROM otps 
         WHERE email = $1 AND otp = $2 AND type = '2fa_login' AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, cleanOtp]
      );

      if (otpRows.length === 0) {
        return res.status(400).json({
          message: "Invalid or expired verification code. Please check your email.",
        });
      }

      // Clean up used OTP
      await pool.query("DELETE FROM otps WHERE email = $1 AND type = '2fa_login'", [cleanEmail]);
    }

    const user = formatUser(userRow);
    const sessionId = await recordUserSession(user.id, req, req.body.deviceInfo);
    const token = generateToken(user, sessionId);

    res.json({
      message: "Two-factor authentication verified. Login successful.",
      user,
      token,
    });
  } catch (err) {
    console.error("[2FA Verify Login Error]", err);
    res.status(500).json({ message: err.message || "Failed to verify 2FA code." });
  }
});

// 3.2 Active Sessions Management (Manage Devices)
app.get("/api/auth/sessions", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    const { rows } = await pool.query(
      `SELECT * FROM user_sessions 
       WHERE user_id = $1 AND is_active = TRUE 
       ORDER BY last_active_at DESC`,
      [userId]
    );

    let currentDevice = null;
    const otherDevices = [];

    rows.forEach((row) => {
      const isCur = Boolean(currentSessionId && row.id === currentSessionId);
      const sessionItem = {
        id: row.id,
        name: row.device_name,
        deviceName: row.device_name,
        deviceType: row.device_type || "phone",
        osName: row.os_name || "",
        osVersion: row.os_version || "",
        browserOrApp: row.browser_or_app || "LocalFarm App",
        ipAddress: row.ip_address || "127.0.0.1",
        location: row.location || "Iligan City, Lanao Del Norte",
        lastActive: isCur ? "Active now" : formatRelativeTime(row.last_active_at),
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
        isCurrent: isCur,
      };

      if (isCur) {
        currentDevice = sessionItem;
      } else {
        otherDevices.push(sessionItem);
      }
    });

    // Fallback: If token had no sessionId (e.g. legacy session before migration), treat first as current
    if (!currentDevice && rows.length > 0) {
      currentDevice = {
        id: rows[0].id,
        name: rows[0].device_name,
        deviceName: rows[0].device_name,
        deviceType: rows[0].device_type || "phone",
        osName: rows[0].os_name || "",
        osVersion: rows[0].os_version || "",
        browserOrApp: rows[0].browser_or_app || "LocalFarm App",
        ipAddress: rows[0].ip_address || "127.0.0.1",
        location: rows[0].location || "Iligan City, Lanao Del Norte",
        lastActive: "Active now",
        lastActiveAt: rows[0].last_active_at,
        createdAt: rows[0].created_at,
        isCurrent: true,
      };
      otherDevices.shift();
    } else if (!currentDevice) {
      currentDevice = {
        id: "current",
        name: "This Device",
        deviceName: "This Device",
        deviceType: "phone",
        osName: "Mobile",
        osVersion: "",
        browserOrApp: "LocalFarm App",
        ipAddress: "127.0.0.1",
        location: "Iligan City, Lanao Del Norte",
        lastActive: "Active now",
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isCurrent: true,
      };
    }

    res.json({
      currentDevice,
      otherDevices,
    });
  } catch (err) {
    console.error("[Get Sessions Error]", err);
    res.status(500).json({ message: err.message || "Failed to fetch active sessions." });
  }
});

// Revoke a single device session
app.delete("/api/auth/sessions/:sessionId", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { sessionId } = req.params;

    await pool.query(
      "UPDATE user_sessions SET is_active = FALSE WHERE id = $1 AND user_id = $2",
      [sessionId, userId]
    );

    res.json({ message: "Device session logged out successfully." });
  } catch (err) {
    console.error("[Revoke Session Error]", err);
    res.status(500).json({ message: err.message || "Failed to log out session." });
  }
});

// Revoke all other device sessions
app.post("/api/auth/sessions/revoke-others", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    if (currentSessionId) {
      await pool.query(
        "UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1 AND id != $2",
        [userId, currentSessionId]
      );
    } else {
      await pool.query(
        `UPDATE user_sessions SET is_active = FALSE 
         WHERE user_id = $1 AND id NOT IN (
           SELECT id FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC LIMIT 1
         )`,
        [userId]
      );
    }

    res.json({ message: "All other device sessions have been logged out." });
  } catch (err) {
    console.error("[Revoke Other Sessions Error]", err);
    res.status(500).json({ message: err.message || "Failed to log out other sessions." });
  }
});

// Client Logout
app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    if (req.user?.sessionId) {
      const pool = getPool();
      await pool.query("UPDATE user_sessions SET is_active = FALSE WHERE id = $1", [
        req.user.sessionId,
      ]);
    }
    res.json({ message: "Logged out successfully." });
  } catch {
    res.json({ message: "Logged out." });
  }
});

// 3.1b Google Authenticator Setup (Generate Secret Key)
app.get("/api/auth/2fa/authenticator/setup", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { rows: userRows } = await pool.query("SELECT email FROM users WHERE id = $1 LIMIT 1", [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const userEmail = userRows[0].email;
    const secret = generateBase32Secret(20);
    const otpauthUrl = `otpauth://totp/LocalFarm:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=LocalFarm&algorithm=SHA1&digits=6&period=30`;

    res.json({
      secret,
      otpauthUrl,
      accountName: `Local Farm (${userEmail})`,
    });
  } catch (err) {
    console.error("[Google Auth Setup Error]", err);
    res.status(500).json({ message: err.message || "Failed to generate Authenticator setup." });
  }
});

// 3.1c Google Authenticator Confirm (Verify Code and Enable)
app.post("/api/auth/2fa/authenticator/confirm", authenticateToken, async (req, res) => {
  try {
    const { token, secret } = req.body;
    if (!token || !secret) {
      return res.status(400).json({ message: "Verification code and secret key are required." });
    }

    const cleanToken = String(token).trim();
    const isValid = verifyTotpToken(cleanToken, secret);

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid verification code. Please check the 6-digit code currently shown in Google Authenticator.",
      });
    }

    const pool = getPool();
    const userId = req.user.id;

    await pool.query(
      "UPDATE users SET two_factor_enabled = TRUE, two_factor_method = 'authenticator', two_factor_secret = $1, updated_at = NOW() WHERE id = $2",
      [secret, userId]
    );

    const { rows: updatedRows } = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [userId]);
    const updatedUser = formatUser(updatedRows[0]);

    res.json({
      message: "Google Authenticator enabled successfully!",
      twoFactorEnabled: true,
      twoFactorMethod: "authenticator",
      user: updatedUser,
    });
  } catch (err) {
    console.error("[Google Auth Confirm Error]", err);
    res.status(500).json({ message: err.message || "Failed to confirm Google Authenticator." });
  }
});

// 3.2 Send 2FA Setup OTP
app.post("/api/auth/2fa/send-setup-otp", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { rows: userRows } = await pool.query("SELECT email FROM users WHERE id = $1 LIMIT 1", [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const userEmail = userRows[0].email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query("DELETE FROM otps WHERE email = $1 AND type = '2fa_setup'", [userEmail]);
    await pool.query(
      "INSERT INTO otps (email, otp, type, expires_at) VALUES ($1, $2, '2fa_setup', $3)",
      [userEmail, otp, expiresAt]
    );

    console.log(`[2FA Setup OTP Generated] Email: ${userEmail}, OTP: ${otp}`);

    try {
      await send2FAOtpEmail(userEmail, otp, "setup");
    } catch (mailErr) {
      console.error("[Mailer Error] Could not deliver 2FA setup OTP:", mailErr.message);
    }

    res.json({
      message: `Verification code sent to ${userEmail}.`,
      email: userEmail,
      devOtp: otp,
    });
  } catch (err) {
    console.error("[2FA Send Setup OTP Error]", err);
    res.status(500).json({ message: err.message || "Failed to send 2FA setup code." });
  }
});

// 3.3 Confirm 2FA Setup
app.post("/api/auth/2fa/confirm-setup", authenticateToken, async (req, res) => {
  try {
    const { otp, method = "email" } = req.body;
    if (!otp) {
      return res.status(400).json({ message: "Verification code is required." });
    }

    const pool = getPool();
    const userId = req.user.id;
    const { rows: userRows } = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const userEmail = userRows[0].email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const { rows: otpRows } = await pool.query(
      `SELECT * FROM otps 
       WHERE email = $1 AND otp = $2 AND type = '2fa_setup' AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [userEmail, cleanOtp]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired verification code. Please check your email." });
    }

    await pool.query("DELETE FROM otps WHERE email = $1 AND type = '2fa_setup'", [userEmail]);

    await pool.query(
      "UPDATE users SET two_factor_enabled = TRUE, two_factor_method = $1, updated_at = NOW() WHERE id = $2",
      [method, userId]
    );

    const { rows: updatedRows } = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [userId]);
    const updatedUser = formatUser(updatedRows[0]);

    res.json({
      message: "Two-factor authentication enabled successfully!",
      twoFactorEnabled: true,
      twoFactorMethod: method,
      user: updatedUser,
    });
  } catch (err) {
    console.error("[2FA Confirm Setup Error]", err);
    res.status(500).json({ message: err.message || "Failed to confirm 2FA setup." });
  }
});

// 3.4 Disable 2FA
app.post("/api/auth/2fa/disable", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;

    await pool.query(
      "UPDATE users SET two_factor_enabled = FALSE, two_factor_method = 'none', updated_at = NOW() WHERE id = $1",
      [userId]
    );

    const { rows: updatedRows } = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [userId]);
    const updatedUser = formatUser(updatedRows[0]);

    res.json({
      message: "Two-factor authentication disabled.",
      twoFactorEnabled: false,
      twoFactorMethod: "none",
      user: updatedUser,
    });
  } catch (err) {
    console.error("[2FA Disable Error]", err);
    res.status(500).json({ message: err.message || "Failed to disable 2FA." });
  }
});

// 3.5 Resend 2FA Code (Supports both login flow with email & authenticated setup flow)
app.post("/api/auth/2fa/resend", async (req, res) => {
  try {
    let targetEmail = req.body?.email;
    const type = req.body?.type === "2fa_setup" ? "2fa_setup" : "2fa_login";

    const pool = getPool();

    if (!targetEmail) {
      // Check if bearer token is present
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const { rows } = await pool.query("SELECT email FROM users WHERE id = $1 LIMIT 1", [decoded.id]);
          if (rows.length > 0) targetEmail = rows[0].email;
        } catch {}
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ message: "Email is required to resend 2FA code." });
    }

    const cleanEmail = targetEmail.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query("DELETE FROM otps WHERE email = $1 AND type = $2", [cleanEmail, type]);
    await pool.query(
      "INSERT INTO otps (email, otp, type, expires_at) VALUES ($1, $2, $3, $4)",
      [cleanEmail, otp, type, expiresAt]
    );

    console.log(`[2FA Resend OTP] Email: ${cleanEmail}, Type: ${type}, OTP: ${otp}`);

    try {
      await send2FAOtpEmail(cleanEmail, otp, type === "2fa_setup" ? "setup" : "login");
    } catch (mailErr) {
      console.error("[Mailer Error] Could not resend 2FA OTP:", mailErr.message);
    }

    res.json({
      message: `A new verification code has been sent to ${cleanEmail}.`,
      devOtp: otp,
    });
  } catch (err) {
    console.error("[2FA Resend OTP Error]", err);
    res.status(500).json({ message: err.message || "Failed to resend 2FA code." });
  }
});

// 4. Get Current User Profile (Me)
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      user: formatUser(rows[0]),
    });
  } catch (err) {
    console.error("[Me Error]", err);
    res.status(500).json({ message: err.message || "Failed to fetch user." });
  }
});

// 4.1 Get User Profile by ID (Public or Authenticated)
app.get(
  ["/api/users/:id", "/api/users/profile/:id", "/api/user/:id"],
  optionalAuthenticateToken,
  async (req, res) => {
    try {
      const targetUserId = req.params.id;
      const currentUserId = req.user?.id || null;
      const pool = getPool();

      const { rows } = await pool.query(
        "SELECT * FROM users WHERE id = $1 LIMIT 1",
        [targetUserId],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found." });
      }

      const user = formatUser(rows[0]);

      // Check relationship with requester
      let relationship = "none";
      let connectionId = null;
      if (currentUserId && String(currentUserId) !== String(targetUserId)) {
        const { rows: connRows } = await pool.query(
          `SELECT id, sender_id, receiver_id, status
           FROM connections
           WHERE (sender_id = $1 AND receiver_id = $2)
              OR (sender_id = $2 AND receiver_id = $1)
           LIMIT 1`,
          [currentUserId, targetUserId],
        );
        if (connRows.length > 0) {
          const c = connRows[0];
          connectionId = String(c.id);
          if (c.status === "accepted") {
            relationship = "accepted";
          } else if (c.status === "pending") {
            relationship =
              String(c.sender_id) === String(currentUserId)
                ? "pending_sent"
                : "pending_received";
          } else if (c.status === "blocked") {
            relationship = "blocked";
          }
        }
      }

      // Post count
      const { rows: postCountRows } = await pool.query(
        "SELECT COUNT(*) AS count FROM posts WHERE user_id = $1",
        [targetUserId],
      );
      const postsCount = Number(postCountRows[0]?.count || 0);

      // Friends count
      const { rows: friendsCountRows } = await pool.query(
        `SELECT COUNT(*) AS count
         FROM connections
         WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'`,
        [targetUserId],
      );
      const friendsCount = Number(friendsCountRows[0]?.count || 0);

      res.json({
        user,
        relationship,
        connectionId,
        postsCount,
        friendsCount,
      });
    } catch (err) {
      console.error("[Get User Profile Error]", err);
      res.status(500).json({
        message: err.message || "Failed to fetch user profile.",
      });
    }
  },
);

// 4.5 Update User Profile (Logged in user - supports PUT and POST)
const profileUpdateHandler = async (req, res) => {
  try {
    const {
      name,
      fullName,
      firstName,
      lastName,
      username,
      phoneNumber,
      gender,
      avatarUrl,
      coverPhotoUrl,
      cover_photo_url,
      location,
      bio,
      about,
      farmName,
      farm_name,
      farmLocation,
      farm_location,
      primaryCrops,
      primary_crops,
    } = req.body;

    const pool = getPool();
    const userId = req.user.id;

    // Check if username is being changed and if it's already taken by someone else
    if (username) {
      const { rows: existing } = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2 LIMIT 1",
        [username.trim(), userId],
      );
      if (existing.length > 0) {
        return res
          .status(400)
          .json({ message: "This username is already taken by another user." });
      }
    }

    const { rows: currentRows } = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    if (currentRows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const current = currentRows[0];
    let newFirstName =
      firstName !== undefined ? firstName.trim() : current.first_name;
    let newLastName =
      lastName !== undefined ? lastName.trim() : current.last_name;

    const passedFullName = fullName || name;
    if (passedFullName && firstName === undefined && lastName === undefined) {
      const parts = passedFullName.trim().split(/\s+/);
      newFirstName = parts[0] || "";
      newLastName = parts.slice(1).join(" ") || "";
    }

    const newUsername =
      username !== undefined ? username.trim() : current.username;
    const newPhoneNumber =
      phoneNumber !== undefined ? phoneNumber.trim() : current.phone_number;
    const newGender = gender !== undefined ? gender : current.gender;
    const newAvatarUrl =
      avatarUrl !== undefined ? avatarUrl : current.avatar_url;
    const newCoverPhotoUrl =
      coverPhotoUrl !== undefined
        ? coverPhotoUrl
        : cover_photo_url !== undefined
          ? cover_photo_url
          : current.cover_photo_url;
    const newLocation =
      location !== undefined ? location : current.location;
    const newBio =
      bio !== undefined ? bio : about !== undefined ? about : current.bio;
    const newFarmName =
      farmName !== undefined
        ? farmName
        : farm_name !== undefined
          ? farm_name
          : current.farm_name;
    const newFarmLocation =
      farmLocation !== undefined
        ? farmLocation
        : farm_location !== undefined
          ? farm_location
          : current.farm_location;
    const newPrimaryCrops =
      primaryCrops !== undefined
        ? primaryCrops
        : primary_crops !== undefined
          ? primary_crops
          : current.primary_crops;

    try {
      await pool.query(
        `UPDATE users
         SET first_name = $1, last_name = $2, username = $3, phone_number = $4,
             gender = $5, avatar_url = $6, bio = $7, cover_photo_url = $8, location = $9,
             farm_name = $10, farm_location = $11, primary_crops = $12,
             updated_at = NOW()
         WHERE id = $13`,
        [
          newFirstName,
          newLastName,
          newUsername,
          newPhoneNumber,
          newGender,
          newAvatarUrl,
          newBio,
          newCoverPhotoUrl,
          newLocation,
          newFarmName,
          newFarmLocation,
          newPrimaryCrops,
          userId,
        ],
      );
    } catch (updateErr) {
      console.warn("[Profile Update Fallback]", updateErr.message);
      await pool.query(
        `UPDATE users
         SET first_name = $1, last_name = $2, username = $3, phone_number = $4, gender = $5, avatar_url = $6, updated_at = NOW()
         WHERE id = $7`,
        [
          newFirstName,
          newLastName,
          newUsername,
          newPhoneNumber,
          newGender,
          newAvatarUrl,
          userId,
        ],
      );
    }

    const { rows: updatedRows } = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    const updatedUser = formatUser(updatedRows[0]);

    res.json({
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (err) {
    console.error("[Update Profile Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to update profile." });
  }
};

app.put(
  [
    "/api/auth/profile",
    "/api/user/profile",
    "/api/users/profile",
    "/auth/profile",
    "/user/profile",
  ],
  authenticateToken,
  profileUpdateHandler,
);
app.post(
  [
    "/api/auth/profile",
    "/api/user/profile",
    "/api/users/profile",
    "/auth/profile",
    "/user/profile",
  ],
  authenticateToken,
  profileUpdateHandler,
);

// 4b. Send Signup Verification OTP
app.post("/api/auth/send-signup-otp", async (req, res) => {
  try {
    const { email, username } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const pool = getPool();

    // Check if email already exists
    const { rows: existingEmail } = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );
    if (existingEmail.length > 0) {
      return res
        .status(400)
        .json({ message: "An account with this email already exists." });
    }

    // Check if username already exists
    if (username) {
      const { rows: existingUser } = await pool.query(
        "SELECT id FROM users WHERE username = $1 LIMIT 1",
        [username.trim()],
      );
      if (existingUser.length > 0) {
        return res
          .status(400)
          .json({ message: "This username is already taken." });
      }
    }

    // Invalidate previous unverified signup OTPs for this email
    try {
      await pool.query(
        "UPDATE otps SET is_used = 1 WHERE email = $1 AND type = 'signup' AND is_used = 0",
        [email.trim().toLowerCase()]
      );
    } catch (e) {}

    // Generate 6-digit random code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    await pool.query(
      "INSERT INTO otps (email, otp, type, expires_at, is_used) VALUES ($1, $2, 'signup', $3, 0)",
      [email.trim().toLowerCase(), otp, expiresAt],
    );

    console.log(`[Signup OTP Generated] Email: ${email}, OTP: ${otp}`);

    // Send verification email via Gmail
    try {
      await sendSignupOtpEmail(email.trim().toLowerCase(), otp);
    } catch (mailErr) {
      console.error(
        "[Mailer Error] Could not deliver OTP email:",
        mailErr.message,
      );
    }

    res.json({
      message: "Verification code sent to your email.",
      devOtp: otp,
    });
  } catch (err) {
    console.error("[Send Signup OTP Error]", err);
    res.status(500).json({
      message: err.message || "Failed to send signup verification code.",
    });
  }
});

// 5. Send Forgot Password OTP
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email.trim().toLowerCase()],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No account found with this email." });
    }

    // Invalidate previous recovery OTPs for this email
    try {
      await pool.query(
        "UPDATE otps SET is_used = 1 WHERE email = $1 AND type = 'recovery' AND is_used = 0",
        [email.trim().toLowerCase()]
      );
    } catch (e) {}

    // Generate 6-digit random code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    await pool.query(
      "INSERT INTO otps (email, otp, type, expires_at, is_used) VALUES ($1, $2, 'recovery', $3, 0)",
      [email.trim().toLowerCase(), otp, expiresAt],
    );

    console.log(`[Recovery OTP Generated] Email: ${email}, OTP: ${otp}`);

    // Send password reset verification email via Gmail
    try {
      await sendSignupOtpEmail(email.trim().toLowerCase(), otp);
    } catch (mailErr) {
      console.error(
        "[Mailer Error] Could not deliver recovery OTP email:",
        mailErr.message,
      );
    }

    res.json({
      message: "OTP code sent to your email.",
      devOtp: otp,
    });
  } catch (err) {
    console.error("[Forgot Password Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to send reset code." });
  }
});

// 6. Verify OTP
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and OTP code are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT id, expires_at FROM otps WHERE email = $1 AND otp = $2 AND is_used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
      [cleanEmail, cleanOtp],
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP code." });
    }

    // Mark OTP as used to prevent replay
    try {
      await pool.query("UPDATE otps SET is_used = 1 WHERE id = $1", [rows[0].id]);
    } catch (uErr) {
      console.warn("Could not mark OTP as used:", uErr.message);
    }

    console.log(`[OTP Verified Successfully] Email: ${cleanEmail}`);
    res.json({ message: "OTP verified successfully." });
  } catch (err) {
    console.error("[Verify OTP Error]", err);
    res.status(500).json({ message: err.message || "Failed to verify OTP." });
  }
});

// 7. Reset Password
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and new password are required." });
    }

    const pool = getPool();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      "UPDATE users SET password = $1, password_hash = $1 WHERE email = $2",
      [hashedPassword, email.trim().toLowerCase()],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[Reset Password Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to reset password." });
  }
});

// 8. Admin: List all users (Requires Admin)
app.get(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        "SELECT id, first_name, last_name, username, email, phone_number, gender, role, created_at FROM users ORDER BY id DESC",
      );
      res.json({ users: rows });
    } catch (err) {
      console.error("[Admin Users Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch users." });
    }
  },
);

// 9. Admin: Update user role (Requires Admin)
app.put(
  "/api/admin/users/:id/role",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      if (!["user", "admin"].includes(role)) {
        return res
          .status(400)
          .json({ message: "Invalid role. Must be 'user' or 'admin'." });
      }
      const pool = getPool();
      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
      res.json({ message: `User ${id} role updated to ${role}` });
    } catch (err) {
      console.error("[Admin Update Role Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update role." });
    }
  },
);

// 10. Change Password (Authenticated user - requires previous password verification)
const changePasswordHandler = async (req, res) => {
  try {
    const {
      currentPassword,
      previousPassword,
      oldPassword,
      newPassword,
      password,
    } = req.body;
    const currentPass = currentPassword || previousPassword || oldPassword;
    const targetPassword = newPassword || password;

    if (!currentPass) {
      return res
        .status(400)
        .json({ message: "Please enter your current password." });
    }

    if (!targetPassword || targetPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters long." });
    }

    if (!/[A-Z]/.test(targetPassword)) {
      return res
        .status(400)
        .json({ message: "New password must contain at least one uppercase letter (A–Z)." });
    }

    if (!/\d/.test(targetPassword)) {
      return res
        .status(400)
        .json({ message: "New password must contain at least one number (0–9)." });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(targetPassword)) {
      return res
        .status(400)
        .json({ message: "New password must contain at least one special character (!@#$)." });
    }

    if (currentPass === targetPassword) {
      return res
        .status(400)
        .json({ message: "New password cannot be the same as your current password." });
    }

    const pool = getPool();
    const userId = req.user.id;

    // Fetch existing user to verify previous password
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const userRow = rows[0];

    // Check previous password
    let isMatch = false;
    const currentStoredPass = userRow.password || userRow.password_hash;
    if (
      currentStoredPass &&
      (currentStoredPass.startsWith("$2a$") ||
        currentStoredPass.startsWith("$2b$") ||
        currentStoredPass.startsWith("$2y$"))
    ) {
      isMatch = await bcrypt.compare(currentPass, currentStoredPass);
    } else {
      isMatch = currentPass === currentStoredPass;
    }

    if (!isMatch) {
      return res.status(400).json({
        message: "Incorrect current password. Please verify and try again.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(targetPassword, salt);

    await pool.query(
      "UPDATE users SET password = $1, password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hashedPassword, userId],
    );

    // Invalidate all OTHER device sessions for security
    const currentSessionId = req.user.sessionId;
    if (currentSessionId) {
      await pool.query(
        "UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1 AND id != $2",
        [userId, currentSessionId],
      );
    } else {
      await pool.query(
        `UPDATE user_sessions SET is_active = FALSE 
         WHERE user_id = $1 AND id NOT IN (
           SELECT id FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC LIMIT 1
         )`,
        [userId],
      );
    }

    // Create in-app security notification
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, is_read)
         VALUES ($1, $1, 'system', 'security_alert', 'Password Changed', 
                 'Your account password was updated successfully. Other device sessions have been logged out.', 'user', FALSE)`,
        [userId],
      );
    } catch (notifErr) {
      console.warn("[Change Password Notification Warning]", notifErr.message);
    }

    // Send email alert to user
    const userName =
      `${userRow.first_name || ""} ${userRow.last_name || ""}`.trim() ||
      userRow.username ||
      "User";
    sendPasswordChangedEmail(userRow.email, userName).catch(() => {});

    res.json({
      message: "Password changed successfully. Other active sessions have been logged out.",
    });
  } catch (err) {
    console.error("[Change Password Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to change password." });
  }
};

app.put(
  [
    "/api/auth/change-password",
    "/api/user/change-password",
    "/auth/change-password",
    "/user/change-password",
  ],
  authenticateToken,
  changePasswordHandler,
);
app.post(
  [
    "/api/auth/change-password",
    "/api/user/change-password",
    "/auth/change-password",
    "/user/change-password",
  ],
  authenticateToken,
  changePasswordHandler,
);

// -----------------------------------------------------------------------------
// 11. CONNECTIONS / FRIENDS API
// -----------------------------------------------------------------------------

function getCoordinatesForLocation(locStr) {
  if (!locStr) return { lat: 8.228, lng: 124.24 }; // Poblacion default
  const lower = locStr.toLowerCase();
  const barangays = [
    { name: "pala-o", lat: 8.2283, lng: 124.2452 },
    { name: "palao", lat: 8.2283, lng: 124.2452 },
    { name: "tubod", lat: 8.209, lng: 124.241 },
    { name: "tibanga", lat: 8.2386, lng: 124.2447 },
    { name: "san miguel", lat: 8.235, lng: 124.252 },
    { name: "hinaplanon", lat: 8.2523, lng: 124.2612 },
    { name: "suarez", lat: 8.1925, lng: 124.225 },
    { name: "tambacan", lat: 8.223, lng: 124.238 },
    { name: "poblacion", lat: 8.228, lng: 124.24 },
    { name: "kiwalan", lat: 8.281, lng: 124.269 },
    { name: "dalipuga", lat: 8.31, lng: 124.275 },
    { name: "buru-un", lat: 8.183, lng: 124.183 },
    { name: "ditucalan", lat: 8.187, lng: 124.195 },
    { name: "santa felomina", lat: 8.256, lng: 124.254 },
    { name: "sta. felomina", lat: 8.256, lng: 124.254 },
    { name: "saray", lat: 8.225, lng: 124.237 },
    { name: "del carmen", lat: 8.226, lng: 124.249 },
    { name: "mahayahay", lat: 8.224, lng: 124.251 },
    { name: "villa verde", lat: 8.231, lng: 124.255 },
    { name: "pugaan", lat: 8.215, lng: 124.27 },
  ];
  for (const b of barangays) {
    if (lower.includes(b.name)) return { lat: b.lat, lng: b.lng };
  }
  return { lat: 8.228, lng: 124.24 };
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km, userIdSeed = 0) {
  if (!km || km < 0.1) {
    const pseudoMeters = 250 + ((userIdSeed * 173) % 850);
    return `${pseudoMeters}m away`;
  }
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters}m away`;
  }
  return `${km.toFixed(1)}km away`;
}

// 11.1 Get Connection Requests (Incoming Pending Requests Only)
app.get(
  ["/api/connections/requests", "/api/friends/requests", "/api/connections"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT c.id AS connection_id, c.status, c.created_at,
                u.id AS user_id, u.first_name, u.last_name, u.username, u.avatar_url, u.role,
                (
                  SELECT COUNT(*)
                  FROM connections c1
                  JOIN connections c2 ON (
                    (CASE WHEN c1.sender_id = $1 THEN c1.receiver_id ELSE c1.sender_id END) =
                    (CASE WHEN c2.sender_id = u.id THEN c2.receiver_id ELSE c2.sender_id END)
                  )
                  WHERE (c1.sender_id = $1 OR c1.receiver_id = $1) AND c1.status = 'accepted'
                    AND (c2.sender_id = u.id OR c2.receiver_id = u.id) AND c2.status = 'accepted'
                ) AS mutual_count
         FROM connections c
         JOIN users u ON c.sender_id = u.id
         WHERE c.receiver_id = $1 AND c.status = 'pending'
         ORDER BY c.id DESC`,
        [userId],
      );

      const requests = rows.map((row) => {
        const mutual = Number(row.mutual_count || 0);
        return {
          id: String(row.connection_id),
          userId: String(row.user_id),
          name:
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            row.username ||
            "User",
          username: row.username || "",
          avatarUrl: row.avatar_url || "",
          mutualFriends:
            mutual > 0
              ? `${mutual} mutual friend${mutual === 1 ? "" : "s"}`
              : "Local Farm member",
          timeAgo: formatTimeAgo(row.created_at),
          status: row.status,
        };
      });

      res.json({ requests, count: requests.length });
    } catch (err) {
      console.error("[Get Requests Error]", err);
      res.status(500).json({
        message: err.message || "Failed to fetch connection requests.",
      });
    }
  },
);

// 11.1b Get Suggestions (Users not connected yet)
app.get(
  ["/api/connections/suggestions", "/api/friends/suggestions"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url, u.role,
                (
                  SELECT COUNT(*)
                  FROM connections c1
                  JOIN connections c2 ON (
                    (CASE WHEN c1.sender_id = $1 THEN c1.receiver_id ELSE c1.sender_id END) =
                    (CASE WHEN c2.sender_id = u.id THEN c2.receiver_id ELSE c2.sender_id END)
                  )
                  WHERE (c1.sender_id = $1 OR c1.receiver_id = $1) AND c1.status = 'accepted'
                    AND (c2.sender_id = u.id OR c2.receiver_id = u.id) AND c2.status = 'accepted'
                ) AS mutual_count
         FROM users u
         WHERE u.id != $1
           AND u.id NOT IN (
             SELECT CASE WHEN sender_id = $2 THEN receiver_id ELSE sender_id END
             FROM connections
             WHERE (sender_id = $3 OR receiver_id = $4) AND status IN ('pending', 'accepted', 'blocked')
           )
         ORDER BY mutual_count DESC, u.id DESC
         LIMIT 20`,
        [userId, userId, userId, userId],
      );

      const suggestions = rows.map((r) => {
        const mutual = Number(r.mutual_count || 0);
        return {
          id: String(r.id),
          name:
            `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
            r.username ||
            "User",
          username: r.username || "",
          avatarUrl: r.avatar_url || "",
          mutualFriends:
            mutual > 0
              ? `${mutual} mutual friend${mutual === 1 ? "" : "s"}`
              : "Local Farm member",
        };
      });

      res.json({ suggestions, count: suggestions.length });
    } catch (err) {
      console.error("[Get Suggestions Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch suggestions." });
    }
  },
);

// 11.1c Get Sent Pending Requests
app.get(
  ["/api/connections/sent", "/api/friends/sent"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT c.id AS connection_id, c.status, c.created_at,
                u.id AS user_id, u.first_name, u.last_name, u.username, u.avatar_url
         FROM connections c
         JOIN users u ON c.receiver_id = u.id
         WHERE c.sender_id = $1 AND c.status = 'pending'
         ORDER BY c.id DESC`,
        [userId],
      );

      const sentRequests = rows.map((row) => ({
        id: String(row.connection_id),
        userId: String(row.user_id),
        name:
          `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
          row.username ||
          "User",
        username: row.username || "",
        avatarUrl: row.avatar_url || "",
        friendsCount: "Local Farm member",
        timeAgo: formatTimeAgo(row.created_at),
      }));

      res.json({ sentRequests, count: sentRequests.length });
    } catch (err) {
      console.error("[Get Sent Requests Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch sent requests." });
    }
  },
);

// 11.1d Get Nearby Users (Calculates distance and fetches connection status)
app.get(
  ["/api/connections/nearby", "/api/friends/nearby"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      // 1. Fetch current user's profile to determine reference location
      const { rows: currentUserRows } = await pool.query(
        "SELECT id, location FROM users WHERE id = $1",
        [userId],
      );
      const currentUserLoc = currentUserRows[0]?.location || "";

      const reqLat = parseFloat(req.query.lat);
      const reqLng = parseFloat(req.query.lng);
      const myCoords =
        !isNaN(reqLat) && !isNaN(reqLng)
          ? { lat: reqLat, lng: reqLng }
          : getCoordinatesForLocation(currentUserLoc);

      // 2. Fetch all other registered users, joining their connection status with the requester
      const { rows } = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url, u.location, u.role,
                c.id AS connection_id, c.sender_id, c.receiver_id, c.status AS connection_status
         FROM users u
         LEFT JOIN connections c ON (
           (c.sender_id = $1 AND c.receiver_id = u.id) OR
           (c.receiver_id = $2 AND c.sender_id = u.id)
         )
         WHERE u.id != $3
           AND (c.status IS NULL OR (c.status != 'blocked' AND c.status != 'accepted'))
         ORDER BY u.id DESC`,
        [userId, userId, userId],
      );

      // 3. Compute distance and relationship for each user
      const users = rows
        .map((row) => {
          let relationship = "none";
          if (row.connection_status === "accepted") {
            relationship = "accepted";
          } else if (row.connection_status === "pending") {
            relationship =
              row.sender_id === userId ? "pending_sent" : "pending_received";
          } else if (row.connection_status === "declined") {
            relationship = "none";
          }

          const targetCoords = getCoordinatesForLocation(row.location);
          const distKm = calculateDistanceKm(
            myCoords.lat,
            myCoords.lng,
            targetCoords.lat,
            targetCoords.lng,
          );

          const distanceStr = formatDistance(distKm, row.id);

          return {
            id: String(row.id),
            connectionId: row.connection_id ? String(row.connection_id) : null,
            name:
              `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
              row.username ||
              "User",
            username: row.username || "",
            avatarUrl: row.avatar_url || "",
            location: row.location || "Iligan City",
            distance: distanceStr,
            distanceKm: distKm,
            relationship,
          };
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);

      res.json({ users, count: users.length });
    } catch (err) {
      console.error("[Get Nearby Users Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch nearby users." });
    }
  },
);

// 11.2 Respond to Connection Request (Confirm / Decline)
app.post(
  [
    "/api/connections/respond",
    "/api/connections/:id/respond",
    "/api/friends/respond",
  ],
  authenticateToken,
  async (req, res) => {
    try {
      const connectionId =
        req.params.id || req.body.connectionId || req.body.id;
      const action = (
        req.body.action ||
        req.body.status ||
        "confirm"
      ).toLowerCase();
      const newStatus =
        action === "confirm" || action === "accepted" ? "accepted" : "declined";

      if (!connectionId) {
        return res.status(400).json({ message: "Connection ID is required." });
      }

      const pool = getPool();
      const userId = req.user.id;

      const result = await pool.query(
        "UPDATE connections SET status = $1 WHERE id = $2 AND receiver_id = $3",
        [newStatus, connectionId, userId],
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ message: "Connection request not found or unauthorized." });
      }

      if (newStatus === "accepted") {
        try {
          const { rows: connRows } = await pool.query(
            "SELECT sender_id FROM connections WHERE id = $1",
            [connectionId],
          );
          if (connRows.length > 0) {
            const requesterId = connRows[0].sender_id;
            const { rows: uRows } = await pool.query(
              "SELECT first_name, last_name, username FROM users WHERE id = $1",
              [userId],
            );
            const userName =
              `${uRows[0]?.first_name || ""} ${uRows[0]?.last_name || ""}`.trim() ||
              uRows[0]?.username ||
              "Someone";

            await pool.query(
              `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
               VALUES ($1, $2, 'user', 'friend_accepted', 'Friend Request Accepted', $3, 'connection', $4, FALSE)`,
              [
                requesterId,
                userId,
                `${userName} accepted your friend request.`,
                connectionId,
              ],
            );
          }
        } catch (notifErr) {
          console.warn(
            "[Accept Connection Notification Warning]",
            notifErr.message,
          );
        }
      }

      res.json({
        message:
          newStatus === "accepted"
            ? "Connection request confirmed!"
            : "Connection request declined.",
        status: newStatus,
      });
    } catch (err) {
      console.error("[Respond Request Error]", err);
      res.status(500).json({
        message: err.message || "Failed to respond to connection request.",
      });
    }
  },
);

// 11.3 Get Confirmed Friends
app.get(
  ["/api/connections/friends", "/api/friends"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const collectionFilter = (req.query.collection || "").trim();

      let sql = `SELECT c.id AS connection_id, c.created_at, c.collection_name,
                u.id AS user_id, u.first_name, u.last_name, u.username, u.avatar_url
         FROM connections c
         JOIN users u ON (CASE WHEN c.sender_id = $1 THEN c.receiver_id = u.id ELSE c.sender_id = u.id END)
         WHERE (c.sender_id = $2 OR c.receiver_id = $3) AND c.status = 'accepted'`;
      const params = [userId, userId, userId];

      if (collectionFilter && collectionFilter !== "All Connections") {
        sql += ` AND c.collection_name = $4`;
        params.push(collectionFilter);
      }

      sql += ` ORDER BY c.updated_at DESC`;

      const { rows } = await pool.query(sql, params);

      const friends = rows.map((row) => ({
        id: String(row.user_id),
        connectionId: String(row.connection_id),
        name:
          `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
          row.username ||
          "User",
        username: row.username || "",
        avatarUrl: row.avatar_url || "",
        collectionName: row.collection_name || "All Connections",
        hasMutual: true,
      }));

      res.json({ friends, count: friends.length });
    } catch (err) {
      console.error("[Get Friends Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch friends." });
    }
  },
);

// 11.4 Search Users to Connect with Status
app.get(
  ["/api/connections/search", "/api/users/search"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const query = (req.query.q || req.query.query || "").trim();

      if (!query) {
        return res.json({ users: [] });
      }

      const searchPattern = `%${query}%`;
      const { rows } = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url, u.role,
                c.id AS connection_id, c.sender_id, c.receiver_id, c.status AS connection_status
         FROM users u
         LEFT JOIN connections c ON (
           (c.sender_id = $1 AND c.receiver_id = u.id) OR
           (c.receiver_id = $2 AND c.sender_id = u.id)
         )
         WHERE u.id != $3 AND (
           CONCAT(u.first_name, ' ', u.last_name) LIKE $4 OR
           u.first_name LIKE $5 OR
           u.last_name LIKE $6 OR
           u.username LIKE $7 OR
           u.email LIKE $8
         )
         ORDER BY u.first_name ASC
         LIMIT 20`,
        [
          userId,
          userId,
          userId,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
        ],
      );

      const users = rows.map((row) => {
        let relationship = "none";
        if (row.connection_status === "accepted") {
          relationship = "accepted";
        } else if (row.connection_status === "pending") {
          relationship =
            row.sender_id === userId ? "pending_sent" : "pending_received";
        } else if (row.connection_status === "declined") {
          relationship = "none";
        }

        return {
          id: String(row.id),
          connectionId: row.connection_id ? String(row.connection_id) : null,
          name:
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            row.username ||
            "User",
          username: row.username || "",
          avatarUrl: row.avatar_url || "",
          role: row.role || "user",
          relationship, // 'none' | 'pending_sent' | 'pending_received' | 'accepted'
        };
      });

      res.json({ users, count: users.length });
    } catch (err) {
      console.error("[Search Users Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to search users." });
    }
  },
);

// 11.5 Send Connection / Friend Request
app.post(
  ["/api/connections/send", "/api/connections/request", "/api/friends/request"],
  authenticateToken,
  async (req, res) => {
    try {
      const targetUserId =
        req.body.targetUserId || req.body.receiverId || req.body.userId;

      if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required." });
      }

      const pool = getPool();
      const senderId = req.user.id;

      if (String(senderId) === String(targetUserId)) {
        return res
          .status(400)
          .json({ message: "You cannot send a friend request to yourself." });
      }

      // Check if connection already exists
      const { rows: existing } = await pool.query(
        "SELECT * FROM connections WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $3 AND receiver_id = $4)",
        [senderId, targetUserId, targetUserId, senderId],
      );

      if (existing.length > 0) {
        const conn = existing[0];
        if (conn.status === "accepted") {
          return res.status(400).json({ message: "You are already friends." });
        }
        if (conn.status === "pending") {
          return res
            .status(400)
            .json({ message: "Friend request is already pending." });
        }
        // Update to pending if it was previously declined
        await pool.query(
          "UPDATE connections SET sender_id = $1, receiver_id = $2, status = 'pending' WHERE id = $3",
          [senderId, targetUserId, conn.id],
        );

        // Fetch sender info for notification
        const { rows: sRows } = await pool.query(
          "SELECT first_name, last_name, username FROM users WHERE id = $1",
          [senderId],
        );
        const senderName =
          `${sRows[0]?.first_name || ""} ${sRows[0]?.last_name || ""}`.trim() ||
          sRows[0]?.username ||
          "Someone";

        await pool.query(
          `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
           VALUES ($1, $2, 'user', 'friend_request', 'Friend Request', $3, 'connection', $4, FALSE)`,
          [
            targetUserId,
            senderId,
            `${senderName} sent you a friend request.`,
            conn.id,
          ],
        );

        return res.json({
          message: "Friend request sent!",
          connectionId: String(conn.id),
          relationship: "pending_sent",
        });
      }

      const { rows: insertRes } = await pool.query(
        "INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, 'pending') RETURNING id",
        [senderId, targetUserId],
      );
      const newConnId = insertRes[0].id;

      // Fetch sender info for notification
      const { rows: sRows } = await pool.query(
        "SELECT first_name, last_name, username FROM users WHERE id = $1",
        [senderId],
      );
      const senderName =
        `${sRows[0]?.first_name || ""} ${sRows[0]?.last_name || ""}`.trim() ||
        sRows[0]?.username ||
        "Someone";

      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
         VALUES ($1, $2, 'user', 'friend_request', 'Friend Request', $3, 'connection', $4, FALSE)`,
        [
          targetUserId,
          senderId,
          `${senderName} sent you a friend request.`,
          newConnId,
        ],
      );

      res.json({
        message: "Friend request sent successfully!",
        connectionId: String(newConnId),
        relationship: "pending_sent",
      });
    } catch (err) {
      console.error("[Send Friend Request Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to send friend request." });
    }
  },
);

// 11.6 Cancel Sent Request
app.post(["/api/connections/cancel"], authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.body.targetUserId || req.body.userId;
    const connectionId = req.body.connectionId;

    const pool = getPool();
    const senderId = req.user.id;

    if (connectionId) {
      await pool.query(
        "DELETE FROM connections WHERE id = $1 AND sender_id = $2 AND status = 'pending'",
        [connectionId, senderId],
      );
    } else if (targetUserId) {
      await pool.query(
        "DELETE FROM connections WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'",
        [senderId, targetUserId],
      );
    }

    res.json({ message: "Friend request canceled.", relationship: "none" });
  } catch (err) {
    console.error("[Cancel Friend Request Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to cancel request." });
  }
});

// -----------------------------------------------------------------------------
// 11.7 GET Connection Collections (unique collection names for user)
// -----------------------------------------------------------------------------
app.get(
  ["/api/connections/collections"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT DISTINCT collection_name
         FROM connections
         WHERE (sender_id = $1 OR receiver_id = $2) AND status = 'accepted'
         ORDER BY collection_name ASC`,
        [userId, userId],
      );

      const collections = rows.map((r) => r.collection_name);
      if (!collections.includes("All Connections")) {
        collections.unshift("All Connections");
      }

      res.json({ collections });
    } catch (err) {
      console.error("[Get Connection Collections Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch collections." });
    }
  },
);

// -----------------------------------------------------------------------------
// 11.8 PUT Update Connection Collection (categorize a friend)
// -----------------------------------------------------------------------------
app.put(
  ["/api/connections/:id/collection"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const connectionId = req.params.id;
      const { collectionName } = req.body;

      if (!collectionName || !collectionName.trim()) {
        return res
          .status(400)
          .json({ message: "Collection name is required." });
      }

      const trimmed = collectionName.trim();

      const { rows: existing } = await pool.query(
        `SELECT id FROM connections
         WHERE id = $1 AND (sender_id = $2 OR receiver_id = $3) AND status = 'accepted'`,
        [connectionId, userId, userId],
      );

      if (existing.length === 0) {
        return res
          .status(404)
          .json({ message: "Connection not found or not accepted." });
      }

      await pool.query(
        "UPDATE connections SET collection_name = $1 WHERE id = $2",
        [trimmed, connectionId],
      );

      res.json({
        message: `Categorized as "${trimmed}".`,
        collectionName: trimmed,
      });
    } catch (err) {
      console.error("[Update Connection Collection Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update collection." });
    }
  },
);

// -----------------------------------------------------------------------------
// 12. CHATS / MESSAGING API
// -----------------------------------------------------------------------------

// Real-time typing registry (Map with 4-second TTL)
const activeTypingMap = new Map();

function setUserTyping(userId, convId, receiverId, isTyping) {
  const now = Date.now();
  const keys = [];
  if (convId) keys.push(`${userId}_conv_${convId}`);
  if (receiverId) keys.push(`${userId}_user_${receiverId}`);
  if (!convId && !receiverId) keys.push(`${userId}`);

  keys.forEach((k) => {
    if (isTyping) {
      activeTypingMap.set(k, now);
    } else {
      activeTypingMap.delete(k);
    }
  });
}

function checkUserTyping(senderUserId, convId, receiverUserId) {
  const now = Date.now();
  const keys = [
    `${senderUserId}_conv_${convId}`,
    `${senderUserId}_user_${receiverUserId}`,
    `${senderUserId}`,
  ];
  for (const k of keys) {
    const t = activeTypingMap.get(k);
    if (t) {
      if (now - t < 4000) {
        return true;
      } else {
        activeTypingMap.delete(k);
      }
    }
  }
  return false;
}

// 12.0 Broadcast Typing Status
app.post("/api/chats/typing", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, receiverId, isTyping } = req.body;
    setUserTyping(userId, conversationId, receiverId, Boolean(isTyping));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to update typing status." });
  }
});

// 12.1 Get Active Users for top story carousel (Only accepted friends)
app.get(
  ["/api/chats/active-users", "/api/users/active"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT DISTINCT u.id, u.first_name, u.last_name, u.username, u.avatar_url
         FROM connections c
         JOIN users u ON (CASE WHEN c.sender_id = $1 THEN c.receiver_id = u.id ELSE c.sender_id = u.id END)
         WHERE (c.sender_id = $2 OR c.receiver_id = $3) AND c.status = 'accepted'
         ORDER BY u.first_name ASC
         LIMIT 20`,
        [userId, userId, userId],
      );

      const users = rows.map((r) => ({
        id: String(r.id),
        name: (r.first_name || r.username || "User").split(" ")[0],
        fullName:
          `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
          r.username ||
          "User",
        avatarUrl: r.avatar_url || "",
        isOnline: true,
      }));

      res.json({ users });
    } catch (err) {
      console.error("[Active Users Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch active users." });
    }
  },
);

// 12.2 Get Conversations List (Based on conversation_id, user1_id, user2_id)
app.get(
  ["/api/chats/conversations", "/api/chats"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const category = (req.query.category || "messages").toLowerCase();

      // Mark incoming messages as delivered to this user
      await pool.query(
        "UPDATE messages SET is_delivered = TRUE WHERE receiver_id = $1 AND is_delivered = FALSE",
        [userId],
      ).catch(() => {});

      let categoryClause = "";
      if (category === "archived") {
        categoryClause = "AND COALESCE(ucs.is_archived, FALSE) = TRUE";
      } else if (category === "spam") {
        categoryClause = "AND COALESCE(ucs.is_spam, FALSE) = TRUE";
      } else if (category === "requests") {
        categoryClause = `
          AND COALESCE(ucs.is_archived, FALSE) = FALSE
          AND COALESCE(ucs.is_spam, FALSE) = FALSE
          AND ru.restricted_user_id IS NULL
          AND COALESCE(ucs.is_accepted, FALSE) = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM connections conn
            WHERE ((conn.sender_id = $1 AND conn.receiver_id = u.id) OR (conn.sender_id = u.id AND conn.receiver_id = $1))
              AND conn.status = 'accepted'
          )
          AND (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) != $1
        `;
      } else {
        // "messages" (default active inbox)
        categoryClause = `
          AND COALESCE(ucs.is_archived, FALSE) = FALSE
          AND COALESCE(ucs.is_spam, FALSE) = FALSE
          AND ru.restricted_user_id IS NULL
          AND (
            COALESCE(ucs.is_accepted, FALSE) = TRUE
            OR EXISTS (
              SELECT 1 FROM connections conn
              WHERE ((conn.sender_id = $1 AND conn.receiver_id = u.id) OR (conn.sender_id = u.id AND conn.receiver_id = $1))
                AND conn.status = 'accepted'
            )
            OR (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id ASC LIMIT 1) = $1
          )
        `;
      }

      const querySql = `
        SELECT c.id AS conversation_id, c.last_message, c.last_message_time,
               u.id AS other_user_id, u.first_name, u.last_name, u.username, u.avatar_url,
               COALESCE(ucs.is_archived, FALSE) AS is_archived,
               COALESCE(ucs.is_spam, FALSE) AS is_spam,
               COALESCE(ucs.is_accepted, FALSE) AS is_accepted,
               COALESCE(ucs.is_muted, FALSE) AS is_muted,
               (ru.restricted_user_id IS NOT NULL) AS is_restricted,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.receiver_id = $1 AND m.is_read = FALSE) AS unread_count,
               (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_sender_id,
               (SELECT m.message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS latest_text,
               (SELECT m.message_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS latest_type,
               (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS latest_created_at,
               (SELECT m.is_read FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS latest_is_read,
               (SELECT m.is_delivered FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS latest_is_delivered,
               EXISTS (
                 SELECT 1 FROM connections conn
                 WHERE ((conn.sender_id = $1 AND conn.receiver_id = u.id) OR (conn.sender_id = u.id AND conn.receiver_id = $1))
                   AND conn.status = 'accepted'
               ) AS is_friend
        FROM conversations c
        JOIN users u ON (CASE WHEN c.user1_id = $1 THEN c.user2_id = u.id ELSE c.user1_id = u.id END)
        LEFT JOIN user_conversation_settings ucs ON (ucs.conversation_id = c.id AND ucs.user_id = $1)
        LEFT JOIN restricted_users ru ON (ru.user_id = $1 AND ru.restricted_user_id = u.id)
        WHERE (c.user1_id = $1 OR c.user2_id = $1)
        ${categoryClause}
        ORDER BY COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1), c.last_message_time) DESC
      `;

      const { rows } = await pool.query(querySql, [userId]);

      const conversations = rows.map((row) => {
        const isMeSender = Number(row.last_sender_id) === Number(userId);
        let rawSnippet = row.latest_text || row.last_message || "";
        const msgType = row.latest_type;

        if (msgType === "sticker" || rawSnippet === "🌸") {
          rawSnippet = "🌸 Sent a sticker";
        } else if (msgType === "image") {
          rawSnippet = "📷 Sent a photo";
        } else if (msgType === "audio") {
          rawSnippet = "🎤 Voice message";
        } else if (msgType === "location") {
          try {
            const parsed = JSON.parse(rawSnippet);
            rawSnippet = `📍 ${parsed.title || "Shared location"}`;
          } catch {
            rawSnippet = "📍 Shared location";
          }
        }

        let snippet = rawSnippet;
        if (isMeSender && snippet) {
          snippet = `You: ${snippet}`;
        }

        // Format time
        let timeStr = "Now";
        const msgDate = row.latest_created_at || row.last_message_time;
        if (msgDate) {
          const d = new Date(msgDate);
          const hours = d.getHours();
          const minutes = d.getMinutes().toString().padStart(2, "0");
          const ampm = hours >= 12 ? "PM" : "AM";
          const formattedHours = hours % 12 || 12;
          timeStr = `${formattedHours}:${minutes} ${ampm}`;
        }

        const isOtherTyping = checkUserTyping(row.other_user_id, row.conversation_id, userId);

        return {
          id: String(row.conversation_id),
          otherUserId: String(row.other_user_id),
          name:
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            row.username ||
            "User",
          username: row.username || "",
          avatarUrl: row.avatar_url || "",
          snippet,
          time: timeStr,
          unread: Number(row.unread_count) || 0,
          isLastSenderMe: isMeSender,
          isDelivered: Boolean(row.latest_is_delivered || row.latest_is_read),
          isSeen: Boolean(row.latest_is_read),
          isTyping: isOtherTyping,
          online: true,
          isArchived: Boolean(row.is_archived),
          isSpam: Boolean(row.is_spam),
          isAccepted: Boolean(row.is_accepted),
          isMuted: Boolean(row.is_muted),
          isRestricted: Boolean(row.is_restricted),
          isFriend: Boolean(row.is_friend),
        };
      });

      res.json({ conversations, count: conversations.length });
    } catch (err) {
      console.error("[Get Conversations Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch conversations." });
    }
  },
);

// Toggle Archive Conversation
app.post(
  "/api/chats/conversations/:id/archive",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const conversationId = req.params.id;
      const { isArchived = true } = req.body;

      await pool.query(
        `INSERT INTO user_conversation_settings (user_id, conversation_id, is_archived, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, conversation_id)
         DO UPDATE SET is_archived = $3, updated_at = NOW()`,
        [userId, conversationId, Boolean(isArchived)],
      );

      res.json({ success: true, isArchived: Boolean(isArchived) });
    } catch (err) {
      console.error("[Archive Conversation Error]", err);
      res.status(500).json({ message: "Failed to update archive status." });
    }
  },
);

// Toggle Spam Conversation
app.post(
  "/api/chats/conversations/:id/spam",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const conversationId = req.params.id;
      const { isSpam = true } = req.body;

      await pool.query(
        `INSERT INTO user_conversation_settings (user_id, conversation_id, is_spam, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, conversation_id)
         DO UPDATE SET is_spam = $3, updated_at = NOW()`,
        [userId, conversationId, Boolean(isSpam)],
      );

      res.json({ success: true, isSpam: Boolean(isSpam) });
    } catch (err) {
      console.error("[Spam Conversation Error]", err);
      res.status(500).json({ message: "Failed to update spam status." });
    }
  },
);

// Toggle Mute Conversation
app.post(
  "/api/chats/conversations/:id/mute",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const conversationId = req.params.id;
      const { isMuted = true } = req.body;

      await pool.query(
        `INSERT INTO user_conversation_settings (user_id, conversation_id, is_muted, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, conversation_id)
         DO UPDATE SET is_muted = $3, updated_at = NOW()`,
        [userId, conversationId, Boolean(isMuted)],
      );

      res.json({ success: true, isMuted: Boolean(isMuted) });
    } catch (err) {
      console.error("[Mute Conversation Error]", err);
      res.status(500).json({ message: "Failed to update mute status." });
    }
  },
);

// Accept Message Request
app.post(
  "/api/chats/conversations/:id/accept-request",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const conversationId = req.params.id;

      await pool.query(
        `INSERT INTO user_conversation_settings (user_id, conversation_id, is_accepted, is_spam, is_archived, updated_at)
         VALUES ($1, $2, TRUE, FALSE, FALSE, NOW())
         ON CONFLICT (user_id, conversation_id)
         DO UPDATE SET is_accepted = TRUE, is_spam = FALSE, is_archived = FALSE, updated_at = NOW()`,
        [userId, conversationId],
      );

      res.json({ success: true, message: "Message request accepted." });
    } catch (err) {
      console.error("[Accept Request Error]", err);
      res.status(500).json({ message: "Failed to accept request." });
    }
  },
);

// Get Restricted Users List
app.get(
  "/api/chats/restricted-users",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url,
                (SELECT c.id FROM conversations c WHERE (c.user1_id = $1 AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = $1) LIMIT 1) AS conversation_id
         FROM restricted_users ru
         JOIN users u ON ru.restricted_user_id = u.id
         WHERE ru.user_id = $1
         ORDER BY ru.created_at DESC`,
        [userId],
      );

      const users = rows.map((r) => ({
        id: String(r.id),
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.username || "User",
        username: r.username || "",
        avatarUrl: r.avatar_url || "",
        conversationId: r.conversation_id ? String(r.conversation_id) : undefined,
      }));

      res.json({ users, count: users.length });
    } catch (err) {
      console.error("[Get Restricted Users Error]", err);
      res.status(500).json({ message: "Failed to fetch restricted users." });
    }
  },
);

// Toggle Restrict User
app.post(
  "/api/chats/users/:userId/restrict",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const currentUserId = req.user.id;
      const targetUserId = req.params.userId;
      const { restrict = true } = req.body;

      if (Number(currentUserId) === Number(targetUserId)) {
        return res.status(400).json({ message: "You cannot restrict yourself." });
      }

      if (Boolean(restrict)) {
        await pool.query(
          `INSERT INTO restricted_users (user_id, restricted_user_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, restricted_user_id) DO NOTHING`,
          [currentUserId, targetUserId],
        );
      } else {
        await pool.query(
          `DELETE FROM restricted_users WHERE user_id = $1 AND restricted_user_id = $2`,
          [currentUserId, targetUserId],
        );
      }

      res.json({ success: true, isRestricted: Boolean(restrict) });
    } catch (err) {
      console.error("[Restrict User Error]", err);
      res.status(500).json({ message: "Failed to update user restriction." });
    }
  },
);

// Toggle Block User
app.post(
  "/api/chats/users/:userId/block",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const currentUserId = req.user.id;
      const targetUserId = req.params.userId;
      const { block = true } = req.body;

      if (Number(currentUserId) === Number(targetUserId)) {
        return res.status(400).json({ message: "You cannot block yourself." });
      }

      if (Boolean(block)) {
        await pool.query(
          `INSERT INTO connections (sender_id, receiver_id, status, created_at, updated_at)
           VALUES ($1, $2, 'blocked', NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [currentUserId, targetUserId],
        );
        await pool.query(
          `UPDATE connections SET status = 'blocked', updated_at = NOW()
           WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
          [currentUserId, targetUserId],
        );
      } else {
        await pool.query(
          `DELETE FROM connections
           WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND status = 'blocked'`,
          [currentUserId, targetUserId],
        );
      }

      res.json({ success: true, isBlocked: Boolean(block) });
    } catch (err) {
      console.error("[Block User Error]", err);
      res.status(500).json({ message: "Failed to update block status." });
    }
  },
);

// Submit User Report
app.post(
  "/api/reports",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const reporterId = req.user.id;
      const {
        reportedUserId,
        conversationId,
        reason,
        statement,
        attachmentUrl,
      } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Reason for reporting is required." });
      }

      if (!statement || !statement.trim()) {
        return res.status(400).json({ message: "Statement is required." });
      }

      const { rows } = await pool.query(
        `INSERT INTO reports (reporter_id, reported_user_id, conversation_id, reason, statement, attachment_url, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
         RETURNING id`,
        [
          reporterId,
          reportedUserId ? Number(reportedUserId) : null,
          conversationId ? Number(conversationId) : null,
          reason.trim(),
          statement.trim(),
          attachmentUrl || null,
        ],
      );

      res.status(201).json({
        success: true,
        reportId: rows[0].id,
        message: "Report submitted successfully.",
      });
    } catch (err) {
      console.error("[Submit Report Error]", err);
      res.status(500).json({ message: "Failed to submit report." });
    }
  },
);

// 12.3 Get Messages (Strictly based on conversation_id, sender_id, receiver_id)
app.get(
  ["/api/chats/messages", "/api/chats/conversations/:id/messages"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const conversationId = req.params.id || req.query.conversationId;
      const otherUserId = req.query.userId || req.query.otherUserId;

      let convId = conversationId;

      if (!convId && otherUserId) {
        const u1 = Math.min(userId, Number(otherUserId));
        const u2 = Math.max(userId, Number(otherUserId));
        const { rows: existing } = await pool.query(
          "SELECT id FROM conversations WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $3 AND user2_id = $4)",
          [u1, u2, u2, u1],
        );
        if (existing.length > 0) {
          convId = existing[0].id;
        }
      }

      // Mark incoming messages as delivered and read for this conversation or sender
      if (convId) {
        await pool.query(
          "UPDATE messages SET is_delivered = TRUE, is_read = TRUE WHERE conversation_id = $1 AND receiver_id = $2 AND (is_read = FALSE OR is_delivered = FALSE)",
          [convId, userId],
        ).catch(() => {});
      } else if (otherUserId) {
        await pool.query(
          "UPDATE messages SET is_delivered = TRUE, is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND (is_read = FALSE OR is_delivered = FALSE)",
          [otherUserId, userId],
        ).catch(() => {});
      }

      let rows = [];
      if (convId) {
        const { rows: convRows } = await pool.query(
          `SELECT m.id, m.conversation_id, m.sender_id, m.receiver_id, m.message_text,
                  m.message_type, m.image_url, m.is_read, m.is_delivered, m.created_at,
                  u.avatar_url, u.first_name, u.last_name
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.conversation_id = $1
           ORDER BY m.id ASC`,
          [convId],
        );
        rows = convRows;
      } else if (otherUserId) {
        const { rows: otherRows } = await pool.query(
          `SELECT m.id, m.conversation_id, m.sender_id, m.receiver_id, m.message_text,
                  m.message_type, m.image_url, m.is_read, m.is_delivered, m.created_at,
                  u.avatar_url, u.first_name, u.last_name
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $3 AND m.receiver_id = $4)
           ORDER BY m.id ASC`,
          [userId, otherUserId, otherUserId, userId],
        );
        rows = otherRows;
      }

      const messages = rows.map((m) => {
        const isUser = Number(m.sender_id) === Number(userId);
        const d = new Date(m.created_at);
        const hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        const formattedHours = hours % 12 || 12;
        const timeStr = `${formattedHours}:${minutes} ${ampm}`;

        return {
          id: String(m.id),
          conversationId: String(m.conversation_id || convId || ""),
          sender: isUser ? "user" : "other",
          senderId: String(m.sender_id),
          receiverId: String(m.receiver_id),
          type: m.message_type || "text",
          text: m.message_text,
          imageUrl: m.image_url,
          avatarUrl: m.avatar_url,
          time: timeStr,
          isDelivered: Boolean(m.is_delivered || m.is_read),
          isSeen: Boolean(m.is_read),
        };
      });

      let otherId = otherUserId;
      if (!otherId && convId) {
        const { rows: cInfo } = await pool.query(
          "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
          [convId],
        ).catch(() => ({ rows: [] }));
        if (cInfo && cInfo.length > 0) {
          otherId = cInfo[0].user1_id === userId ? cInfo[0].user2_id : cInfo[0].user1_id;
        }
      }
      const isOtherTyping = Boolean(otherId && checkUserTyping(otherId, convId, userId));

      res.json({
        messages,
        conversationId: convId ? String(convId) : null,
        isTyping: isOtherTyping,
      });
    } catch (err) {
      console.error("[Get Messages Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch messages." });
    }
  },
);

// 12.4 Send Message
app.post(
  ["/api/chats/messages", "/api/chats/send"],
  authenticateToken,
  async (req, res) => {
    try {
      const {
        receiverId,
        conversationId,
        messageText,
        messageType,
        imageUrl,
        autoReplyText,
        autoReplyType,
      } = req.body;
      const text = (messageText || "").trim();

      if (!text && !imageUrl && !autoReplyText) {
        return res
          .status(400)
          .json({ message: "Message content or image is required." });
      }

      const pool = getPool();
      const senderId = req.user.id;

      let targetReceiverId = receiverId;
      let convId = conversationId;

      if (!targetReceiverId && convId) {
        const { rows: convRows } = await pool.query(
          "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
          [convId],
        );
        if (convRows.length > 0) {
          targetReceiverId =
            convRows[0].user1_id === senderId
              ? convRows[0].user2_id
              : convRows[0].user1_id;
        }
      }

      if (!targetReceiverId) {
        return res.status(400).json({ message: "Receiver ID is required." });
      }

      // Clear typing status on message send
      setUserTyping(senderId, convId, targetReceiverId, false);

      // Find or create conversation
      const u1 = Math.min(senderId, Number(targetReceiverId));
      const u2 = Math.max(senderId, Number(targetReceiverId));

      const { rows: convCheck } = await pool.query(
        "SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2",
        [u1, u2],
      );

      if (convCheck.length > 0) {
        let lastSnippet = autoReplyText ? String(autoReplyText).trim() : text;
        if (messageType === "location") {
          try {
            const parsed = JSON.parse(text);
            lastSnippet = `📍 ${parsed.title || "Shared a location pin"}`;
          } catch {
            lastSnippet = "📍 Shared a location pin";
          }
        } else if (!text && imageUrl) {
          lastSnippet = "Sent an image";
        } else if (!text) {
          lastSnippet = "Sent a message";
        }

        convId = convCheck[0].id;
        await pool.query(
          "UPDATE conversations SET last_message = $1, last_message_time = NOW() WHERE id = $2",
          [lastSnippet, convId],
        );
      } else {
        let lastSnippet = autoReplyText ? String(autoReplyText).trim() : text;
        if (messageType === "location") {
          try {
            const parsed = JSON.parse(text);
            lastSnippet = `📍 ${parsed.title || "Shared a location pin"}`;
          } catch {
            lastSnippet = "📍 Shared a location pin";
          }
        } else if (!text && imageUrl) {
          lastSnippet = "Sent an image";
        } else if (!text) {
          lastSnippet = "Sent a message";
        }

        const { rows: cInsert } = await pool.query(
          "INSERT INTO conversations (user1_id, user2_id, last_message, last_message_time) VALUES ($1, $2, $3, NOW()) RETURNING id",
          [u1, u2, lastSnippet],
        );
        convId = cInsert[0].id;
      }

      // Check if recipient is active recently
      const { rows: activeRecv } = await pool.query(
        "SELECT id FROM user_sessions WHERE user_id = $1 AND is_active = TRUE AND last_active_at > NOW() - INTERVAL '5 minutes' LIMIT 1",
        [targetReceiverId],
      ).catch(() => ({ rows: [] }));
      const isInitiallyDelivered = Boolean(activeRecv && activeRecv.length > 0);

      // Insert message
      const { rows: mInsert } = await pool.query(
        "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, image_url, is_read, is_delivered) VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7) RETURNING id",
        [
          convId,
          senderId,
          targetReceiverId,
          text,
          messageType || "text",
          imageUrl || null,
          isInitiallyDelivered,
        ],
      );

      const d = new Date();
      const hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const formattedHours = hours % 12 || 12;
      const timeStr = `${formattedHours}:${minutes} ${ampm}`;

      const createdMessage = {
        id: String(mInsert[0].id),
        conversationId: String(convId),
        sender: "user",
        senderId: String(senderId),
        receiverId: String(targetReceiverId),
        type: messageType || "text",
        text,
        imageUrl: imageUrl || null,
        time: timeStr,
        isDelivered: isInitiallyDelivered,
        isSeen: false,
      };

      let createdAutoReply = null;
      if (autoReplyText) {
        const arText = String(autoReplyText).trim();
        const arType = autoReplyType || "auto_reply";
        const { rows: arInsert } = await pool.query(
          "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, message_type, image_url, is_read, is_delivered) VALUES ($1, $2, $3, $4, $5, NULL, FALSE, TRUE) RETURNING id",
          [convId, targetReceiverId, senderId, arText, arType],
        );
        createdAutoReply = {
          id: String(arInsert[0].id),
          conversationId: String(convId),
          sender: "other",
          senderId: String(targetReceiverId),
          receiverId: String(senderId),
          type: arType,
          text: arText,
          time: timeStr,
          isDelivered: true,
          isSeen: false,
        };
      }

      res.status(201).json({
        message: "Message sent!",
        data: createdMessage,
        autoReply: createdAutoReply,
      });
    } catch (err) {
      console.error("[Send Message Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to send message." });
    }
  },
);

// 12.4 Get Farmer Chat Info & Details
app.get(
  "/api/chats/user/:id/info",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const targetUserId = req.params.id;

      const { rows } = await pool.query(
        `SELECT id, first_name, last_name, username, avatar_url, phone_number,
                farm_name, farm_location, primary_crops, is_verified, bio, created_at
         FROM users
         WHERE id = $1`,
        [targetUserId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Farmer not found." });
      }

      const r = rows[0];
      const fullName = `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.username || "Local Farmer";

      res.json({
        user: {
          id: String(r.id),
          fullName,
          firstName: r.first_name || "",
          lastName: r.last_name || "",
          username: r.username || "",
          avatarUrl: r.avatar_url || "",
          phoneNumber: r.phone_number || "",
          farmName: r.farm_name || "Local Harvest Farm",
          farmLocation: r.farm_location || "Iligan City, Northern Mindanao",
          primaryCrops: r.primary_crops || "Fresh Vegetables & High-Value Crops",
          isVerified: Boolean(r.is_verified),
          bio: r.bio || "Local sustainable farmer growing quality produce for the community.",
          memberSince: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Recent",
        },
      });
    } catch (err) {
      console.error("[Get Chat Farmer Info Error]", err);
      res.status(500).json({ message: err.message || "Failed to fetch farmer info." });
    }
  }
);

// 12.5 Get Shared Media & Links in Conversation
app.get(
  ["/api/chats/conversations/:id/media", "/api/chats/conversations/media"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const currentUserId = req.user.id;
      const conversationId = req.params.id || req.query.conversationId;
      const otherUserId = req.query.userId || req.query.otherUserId;

      let convId =
        conversationId && !isNaN(Number(conversationId))
          ? Number(conversationId)
          : null;
      let targetOtherId =
        otherUserId && !isNaN(Number(otherUserId))
          ? Number(otherUserId)
          : null;

      if (!convId && targetOtherId) {
        const u1 = Math.min(currentUserId, targetOtherId);
        const u2 = Math.max(currentUserId, targetOtherId);
        const { rows } = await pool.query(
          "SELECT id FROM conversations WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $3 AND user2_id = $4)",
          [u1, u2, u2, u1],
        );
        if (rows.length > 0) {
          convId = rows[0].id;
        }
      }

      let mediaRows = [];
      let linkMsgRows = [];

      if (convId) {
        const { rows: mRows } = await pool.query(
          `SELECT id, message_type, image_url, created_at
           FROM messages
           WHERE conversation_id = $1
             AND message_type = 'image'
             AND image_url IS NOT NULL
             AND image_url != ''
           ORDER BY id DESC
           LIMIT 50`,
          [convId],
        );
        mediaRows = mRows;

        const { rows: lRows } = await pool.query(
          `SELECT id, message_text, message_type, created_at
           FROM messages
           WHERE conversation_id = $1
             AND (
               message_text ILIKE '%http://%'
               OR message_text ILIKE '%https://%'
               OR message_text ILIKE '%www.%'
               OR message_type = 'location'
             )
           ORDER BY id DESC
           LIMIT 50`,
          [convId],
        );
        linkMsgRows = lRows;
      } else if (targetOtherId) {
        const { rows: mRows } = await pool.query(
          `SELECT id, message_type, image_url, created_at
           FROM messages
           WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
             AND message_type = 'image'
             AND image_url IS NOT NULL
             AND image_url != ''
           ORDER BY id DESC
           LIMIT 50`,
          [currentUserId, targetOtherId],
        );
        mediaRows = mRows;

        const { rows: lRows } = await pool.query(
          `SELECT id, message_text, message_type, created_at
           FROM messages
           WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
             AND (
               message_text ILIKE '%http://%'
               OR message_text ILIKE '%https://%'
               OR message_text ILIKE '%www.%'
               OR message_type = 'location'
             )
           ORDER BY id DESC
           LIMIT 50`,
          [currentUserId, targetOtherId],
        );
        linkMsgRows = lRows;
      }

      const media = mediaRows.map((r) => ({
        id: String(r.id),
        imageUrl: r.image_url,
        createdAt: r.created_at,
      }));

      const links = [];
      linkMsgRows.forEach((r) => {
        if (r.message_type === "location") {
          try {
            const loc = JSON.parse(r.message_text);
            const lat = loc.latitude || loc.lat || 8.228;
            const lng = loc.longitude || loc.lng || 124.245;
            links.push({
              id: String(r.id),
              url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
              title: `📍 ${loc.title || "Location Pin"}${loc.address ? ` - ${loc.address}` : ""}`,
              createdAt: r.created_at,
            });
          } catch {
            links.push({
              id: String(r.id),
              url: "https://maps.google.com",
              title: "📍 Location Pin",
              createdAt: r.created_at,
            });
          }
        } else {
          const urlMatch = r.message_text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
          if (urlMatch) {
            urlMatch.forEach((rawUrl, idx) => {
              const formattedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
              links.push({
                id: `${r.id}-${idx}`,
                url: formattedUrl,
                title: rawUrl.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
                createdAt: r.created_at,
              });
            });
          }
        }
      });

      res.json({ media, links });
    } catch (err) {
      console.error("[Get Shared Media Error]", err);
      res.status(500).json({ message: err.message || "Failed to fetch shared media." });
    }
  }
);

// Ensure farmer_quick_inquiries table exists
async function ensureFarmerInquiriesTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farmer_quick_inquiries (
        id SERIAL PRIMARY KEY,
        farmer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tag VARCHAR(50) NOT NULL,
        icon VARCHAR(10) NOT NULL DEFAULT '🌾',
        question VARCHAR(255) NOT NULL,
        description TEXT,
        button_text VARCHAR(100) NOT NULL,
        reply_text TEXT NOT NULL,
        reply_type VARCHAR(20) DEFAULT 'auto_reply',
        location_title VARCHAR(255),
        location_address TEXT,
        location_latitude DOUBLE PRECISION,
        location_longitude DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn("ensureFarmerInquiriesTable error:", e.message);
  }
}

// 12.6 Get Dynamic Farmer Quick Inquiries & Auto-Reply Cards
app.get(
  "/api/chats/farmer/:id/inquiries",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const farmerId = req.params.id;

      await ensureFarmerInquiriesTable(pool);

      // Check if farmer has custom inquiries defined
      const { rows: customInquiries } = await pool.query(
        `SELECT id, tag, icon, question, description, button_text, reply_text,
                reply_type, location_title, location_address, location_latitude, location_longitude
         FROM farmer_quick_inquiries
         WHERE farmer_id = $1
         ORDER BY id ASC`,
        [farmerId]
      );

      if (customInquiries.length > 0) {
        const inquiries = customInquiries.map((q) => {
          let locationData = null;
          if (q.reply_type === "location" || q.location_latitude) {
            locationData = {
              title: q.location_title || "Farm Pickup Point",
              address: q.location_address || "",
              latitude: Number(q.location_latitude) || 8.228,
              longitude: Number(q.location_longitude) || 124.2452,
            };
          }
          return {
            id: String(q.id),
            icon: q.icon || "🌾",
            tag: q.tag,
            tagBg:
              q.tag === "WHOLESALE"
                ? "bg-amber-100"
                : q.tag === "DELIVERY"
                ? "bg-purple-100"
                : "bg-[#72AF5B]/15",
            tagText:
              q.tag === "WHOLESALE"
                ? "text-amber-800"
                : q.tag === "DELIVERY"
                ? "text-purple-800"
                : "text-[#2E5E20]",
            title: q.question,
            desc: q.description || "",
            btnText: q.button_text,
            replyText: q.reply_text,
            replyType: q.reply_type || "auto_reply",
            locationData,
          };
        });
        return res.json({ inquiries });
      }

      // If no custom entries yet, dynamically generate cards using the farmer's live database record
      const { rows: userRows } = await pool.query(
        `SELECT id, first_name, last_name, username, farm_name, farm_location, primary_crops, phone_number
         FROM users
         WHERE id = $1`,
        [farmerId]
      );

      const farmer = userRows[0] || {};
      const farmerName =
        `${farmer.first_name || ""} ${farmer.last_name || ""}`.trim() ||
        farmer.username ||
        "Local Farmer";
      const farmName = farmer.farm_name || `${farmerName}'s Farm`;
      const farmLocation =
        farmer.farm_location || "National Highway, Brgy. Pala-o, Iligan City";
      const primaryCrops = farmer.primary_crops || "fresh produce & crops";

      const dynamicInquiries = [
        {
          id: `avail-${farmerId}`,
          icon: "🌾",
          tag: "AVAILABILITY",
          tagBg: "bg-[#72AF5B]/15",
          tagText: "text-[#2E5E20]",
          title: "Available pa po ba ito?",
          desc: `Check if today's harvest of ${primaryCrops} is in stock right now at ${farmName}.`,
          btnText: "Ask Availability",
          replyText: `Opo, available pa po ang ani dito sa ${farmName}! Katatapos lang i-harvest kaninang umaga. Ilang kilo po ang kailangan ninyo? 🥭`,
          replyType: "auto_reply",
        },
        {
          id: `bulk-${farmerId}`,
          icon: "📦",
          tag: "WHOLESALE",
          tagBg: "bg-amber-100",
          tagText: "text-amber-800",
          title: "How much for bulk / wholesale?",
          desc: `Inquire about volume discounts for bulk orders of ${primaryCrops}.`,
          btnText: "Ask Bulk Rates",
          replyText: `May wholesale discount po tayo sa ${farmName} for 50kg above (up to 15% discount)! Sabihin niyo lang po kung ilang kilo ang kailangan ninyo. 📦`,
          replyType: "auto_reply",
        },
        {
          id: `pickup-${farmerId}`,
          icon: "📍",
          tag: "PICKUP POINT",
          tagBg: "bg-[#72AF5B]/15",
          tagText: "text-[#2E5E20]",
          title: "Where is your pickup point?",
          desc: `Get gate pickup coordinates & directions to ${farmLocation}.`,
          btnText: "Ask Pickup Point",
          replyText: `Sa aming pickup gate po sa ${farmLocation}, 6 AM - 5 PM daily! Eto po ang exact farm gate pin: 📍`,
          replyType: "location",
          locationData: {
            title: `${farmName} - Main Gate`,
            address: `${farmLocation}`,
            latitude: 8.228,
            longitude: 124.2452,
          },
        },
        {
          id: `deliver-${farmerId}`,
          icon: "🚚",
          tag: "DELIVERY",
          tagBg: "bg-purple-100",
          tagText: "text-purple-800",
          title: "Do you provide delivery services?",
          desc: `Check morning delivery drop-offs from ${farmName}.`,
          btnText: "Ask Delivery",
          replyText: `Puwede po kami mag-deliver sa central market at pickup hubs tuwing 7:00 AM mula sa ${farmName}! Paki-message lang po ang exact drop-off location ninyo. 🚚`,
          replyType: "auto_reply",
        },
      ];

      res.json({ inquiries: dynamicInquiries });
    } catch (err) {
      console.error("[Get Farmer Inquiries Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch farmer inquiries." });
    }
  }
);

// 12.7 Delete Conversation & Messages
const deleteConversationHandler = async (req, res) => {
  try {
    const pool = getPool();
    const currentUserId = req.user.id;
    const conversationId =
      req.params.id || req.query.conversationId || req.body?.conversationId;
    const otherUserId =
      req.params.userId || req.query.userId || req.body?.userId;

    let convId =
      conversationId && !isNaN(Number(conversationId))
        ? Number(conversationId)
        : null;
    let targetOtherId =
      otherUserId && !isNaN(Number(otherUserId))
        ? Number(otherUserId)
        : null;

    if (!convId && targetOtherId) {
      const u1 = Math.min(currentUserId, targetOtherId);
      const u2 = Math.max(currentUserId, targetOtherId);
      const { rows } = await pool.query(
        "SELECT id FROM conversations WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $3 AND user2_id = $4)",
        [u1, u2, u2, u1],
      );
      if (rows.length > 0) {
        convId = rows[0].id;
      }
    }

    if (convId && !targetOtherId) {
      const { rows: cRows } = await pool.query(
        "SELECT user1_id, user2_id FROM conversations WHERE id = $1",
        [convId],
      );
      if (cRows.length > 0) {
        targetOtherId =
          cRows[0].user1_id === currentUserId
            ? cRows[0].user2_id
            : cRows[0].user1_id;
      }
    }

    if (convId) {
      // 1. Delete all messages with this conversation_id
      await pool.query("DELETE FROM messages WHERE conversation_id = $1", [convId]);
      // 2. Delete the conversation itself
      await pool.query(
        "DELETE FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $3)",
        [convId, currentUserId, currentUserId],
      );
    }

    if (targetOtherId) {
      // Also delete any messages directly between these two users
      await pool.query(
        "DELETE FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)",
        [currentUserId, targetOtherId],
      );
      // Also ensure any conversations between these two users are deleted
      const u1 = Math.min(currentUserId, targetOtherId);
      const u2 = Math.max(currentUserId, targetOtherId);
      await pool.query(
        "DELETE FROM conversations WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)",
        [u1, u2],
      );
    }

    res.json({ message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("[Delete Conversation Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to delete conversation." });
  }
};

app.delete(
  "/api/chats/conversations/with-user/:userId",
  authenticateToken,
  deleteConversationHandler,
);
app.delete(
  "/api/chats/conversations/:id",
  authenticateToken,
  deleteConversationHandler,
);
app.delete(
  "/api/chats/conversations",
  authenticateToken,
  deleteConversationHandler,
);


// 13. NOTIFICATIONS & BADGE COUNTS API
// -----------------------------------------------------------------------------
app.get(
  ["/api/notifications/badge-counts", "/api/badges"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      const { rows: connRows } = await pool.query(
        "SELECT COUNT(*) AS count FROM connections WHERE receiver_id = $1 AND status = 'pending'",
        [userId],
      );
      const connRes = connRows[0];

      const { rows: msgRows } = await pool.query(
        "SELECT COUNT(*) AS count FROM messages WHERE receiver_id = $1 AND is_read = FALSE",
        [userId],
      );
      const msgRes = msgRows[0];

      const { rows: notifRows } = await pool.query(
        "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE AND (actor_id IS NULL OR actor_id != user_id)",
        [userId],
      );
      const notifRes = notifRows[0];

      // Add unread official announcements and scam alerts
      const { rows: announcementRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM announcements a
         WHERE a.is_archived = 0
           AND NOT EXISTS (
             SELECT 1 FROM announcement_reads ar
             WHERE ar.announcement_id = a.id AND ar.user_id = $1
           )`,
        [userId],
      );
      const announcementRes = announcementRows[0];

      const totalUnreadNotifs =
        (Number(notifRes?.count) || 0) + (Number(announcementRes?.count) || 0);

      res.json({
        requestsCount: Number(connRes?.count) || 0,
        unreadMessagesCount: Number(msgRes?.count) || 0,
        unreadNotificationsCount: totalUnreadNotifs,
      });
    } catch (err) {
      console.error("[Badge Counts Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch badge counts." });
    }
  },
);

// 13.1 Get Notifications List
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;

    // Purge any accidental self-notifications (e.g. user commented/reacted to their own post)
    await pool
      .query("DELETE FROM notifications WHERE user_id = actor_id")
      .catch(() => {});

    // Fetch personal user notifications
    const { rows: userNotifRows } = await pool.query(
      `SELECT n.id, n.user_id, n.actor_id, n.type, n.title, n.content,
              n.entity_name, n.target_id, n.is_read, n.created_at,
              u.first_name, u.last_name, u.username, u.avatar_url
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1 AND (n.actor_id IS NULL OR n.actor_id != n.user_id)
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId],
    );

    const personalNotifications = userNotifRows.map((r) => {
      const actorName = r.actor_id
        ? `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
          r.username ||
          "Someone"
        : r.title || "System";

      return {
        id: String(r.id),
        type: r.type || "system",
        title: r.title || "Notification",
        content: r.content || "",
        entityName: r.entity_name || "",
        targetId: r.target_id ? Number(r.target_id) : null,
        time: formatTimeAgo(r.created_at),
        createdAt: r.created_at,
        isUnread: !r.is_read,
        hasActionButtons:
          r.type === "friend_request" || r.type === "group_invite",
        user: {
          id: r.actor_id ? String(r.actor_id) : undefined,
          name: actorName,
          avatarUrl: r.avatar_url || "",
        },
      };
    });

    // Fetch active official bulletins & scam alerts
    const { rows: announcementRows } = await pool.query(
      `SELECT a.id, a.slug, a.title, a.content, a.category, a.priority,
              a.target_audience, a.is_pinned, a.author, a.created_at,
              (CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END) AS is_read
       FROM announcements a
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = $1
       WHERE a.is_archived = 0
       ORDER BY a.is_pinned DESC, a.created_at DESC
       LIMIT 20`,
      [userId],
    );

    const announcementNotifications = announcementRows.map((a) => {
      const notifType =
        a.category === "Scam Alert"
          ? "scam_alert"
          : a.priority === "Urgent"
          ? "emergency"
          : "announcement";

      return {
        id: `announcement_${a.id}`,
        type: notifType,
        title: a.title,
        content: a.content || "",
        entityName: a.category || "Official Notice",
        targetId: a.id,
        time: formatTimeAgo(a.created_at),
        createdAt: a.created_at,
        isUnread: !Boolean(a.is_read),
        hasActionButtons: false,
        user: {
          id: "admin",
          name: a.author || "Local Farm Admin",
          avatarUrl: "",
        },
        announcement: {
          id: String(a.id),
          title: a.title,
          content: a.content,
          category: a.category,
          priority: a.priority,
          targetAudience: a.target_audience,
          isPinned: Boolean(a.is_pinned),
          createdAt: a.created_at,
          author: a.author || "Local Farm Admin",
        },
      };
    });

    // Merge and sort combined notifications with newest first
    const allNotifications = [
      ...announcementNotifications,
      ...personalNotifications,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const unreadCount = allNotifications.filter((n) => n.isUnread).length;
    res.json({
      notifications: allNotifications,
      count: allNotifications.length,
      unreadCount,
    });
  } catch (err) {
    console.error("[Get Notifications Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch notifications." });
  }
});

// 13.2 Mark Single Notification as Read
app.put(
  "/api/notifications/:id/read",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const notificationId = req.params.id;

      if (String(notificationId).startsWith("announcement_")) {
        const announcementId = parseInt(
          String(notificationId).replace("announcement_", ""),
          10,
        );
        if (!isNaN(announcementId)) {
          await pool.query(
            `INSERT IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
             VALUES ($1, $2, NOW())`,
            [announcementId, userId],
          );
        }
      } else {
        await pool.query(
          "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
          [notificationId, userId],
        );
      }

      res.json({
        message: "Notification marked as read.",
        id: String(notificationId),
        isRead: true,
      });
    } catch (err) {
      console.error("[Mark Notification Read Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update notification." });
    }
  },
);

// 13.3 Mark All Notifications as Read
app.put(
  "/api/notifications/read-all",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;

      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1",
        [userId],
      );

      // Also mark all active announcements as read for this user
      await pool.query(
        `INSERT IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
         SELECT a.id, $1, NOW()
         FROM announcements a
         WHERE a.is_archived = 0`,
        [userId],
      );

      res.json({ message: "All notifications marked as read." });
    } catch (err) {
      console.error("[Mark All Notifications Read Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update notifications." });
    }
  },
);

// 13.4 Delete Notification
app.delete(
  "/api/notifications/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const notificationId = req.params.id;

      if (String(notificationId).startsWith("announcement_")) {
        const announcementId = parseInt(
          String(notificationId).replace("announcement_", ""),
          10,
        );
        if (!isNaN(announcementId)) {
          await pool.query(
            `INSERT IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
             VALUES ($1, $2, NOW())`,
            [announcementId, userId],
          );
        }
      } else {
        await pool.query(
          "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
          [notificationId, userId],
        );
      }

      res.json({
        message: "Notification deleted.",
        id: String(notificationId),
      });
    } catch (err) {
      console.error("[Delete Notification Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to delete notification." });
    }
  },
);

// -----------------------------------------------------------------------------
// 14. POSTS & NEWSFEED API
// -----------------------------------------------------------------------------

function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "Just now";
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

function sanitizePostLocation(loc) {
  if (!loc) return "";
  const trimmed = String(loc).trim();
  if (!trimmed || trimmed === "Iligan City, Philippines") return "";
  return trimmed;
}

async function ensureSamplePosts(pool) {
  try {
    // Ensure image_url column is TEXT for full-length image URIs and base64 strings
    await pool.query(
      "ALTER TABLE posts ALTER COLUMN image_url TYPE TEXT;",
    ).catch(() => {});

    // Ensure images column exists for multi-image posts
    await pool.query(
      "ALTER TABLE posts ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;",
    ).catch(() => {});

    // Ensure duration_label column exists for temporary duration and live broadcast duration
    await pool.query(
      "ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration_label VARCHAR(100);",
    ).catch(() => {});

    // Ensure live_streams table exists matching pgAdmin4 schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_streams (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INT REFERENCES posts(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'live',
        viewer_count INT NOT NULL DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      );
    `).catch(() => {});

    // Ensure reaction_type column exists on post_likes
    await pool
      .query(
        "ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) DEFAULT 'like';",
      )
      .catch(() => {});

    // Ensure post_shares table exists matching schema
    await pool
      .query(`
        CREATE TABLE IF NOT EXISTS post_shares (
          id SERIAL PRIMARY KEY,
          post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          share_type VARCHAR(50) NOT NULL DEFAULT 'public',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
      .catch(() => {});

    // Migration: clear out any legacy hardcoded "Iligan City, Philippines" placeholder
    await pool.query(
      "UPDATE posts SET location = NULL WHERE location = 'Iligan City, Philippines'",
    );

    // Keep post counters strictly synchronized with actual interactions
    await pool.query(`
      UPDATE posts SET
        likes_count = (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = posts.id),
        comments_count = (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = posts.id),
        shares_count = (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = posts.id);
    `).catch(() => {});
  } catch (e) {
    console.warn("ensureSamplePosts error:", e.message);
  }
}

// 14.1.0 Get Saved / Bookmarked Posts
app.get("/api/posts/saved", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT sp.id AS saved_id, sp.collection_name, sp.created_at AS saved_at,
                p.id, p.user_id, p.original_post_id, p.content, p.image_url, p.images, p.category, p.privacy, p.location,
                p.latitude, p.longitude,
                (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
                (SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                (SELECT COUNT(*)::int FROM post_shares ps WHERE ps.post_id = p.id) AS shares_count,
                p.created_at,
                u.first_name, u.last_name, u.username, u.avatar_url, u.role,
                EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS is_liked,
                (SELECT pl.reaction_type FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1 LIMIT 1) AS user_reaction,
                EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) AS is_saved,
                orig.id AS orig_id, orig.user_id AS orig_user_id, orig.content AS orig_content, orig.image_url AS orig_image_url,
                orig.images AS orig_images,
                orig.category AS orig_category, orig.location AS orig_location,
                orig.latitude AS orig_latitude, orig.longitude AS orig_longitude,
                orig.created_at AS orig_created_at,
                orig_u.first_name AS orig_first_name, orig_u.last_name AS orig_last_name,
                orig_u.username AS orig_username, orig_u.avatar_url AS orig_avatar_url, orig_u.role AS orig_role
         FROM saved_posts sp
         JOIN posts p ON sp.post_id = p.id
         JOIN users u ON p.user_id = u.id
         LEFT JOIN posts orig ON p.original_post_id = orig.id
         LEFT JOIN users orig_u ON orig.user_id = orig_u.id
         WHERE sp.user_id = $2
         ORDER BY sp.created_at DESC`,
      [userId, userId],
    );

    const savedPosts = rows.map((r) => {
      const isShared = Boolean(r.original_post_id && r.orig_id);
      const parsedImages = Array.isArray(r.images)
        ? r.images
        : (typeof r.images === "string"
            ? (() => { try { return JSON.parse(r.images); } catch { return []; } })()
            : []);
      const finalImages = parsedImages.length > 0
        ? parsedImages
        : (r.image_url ? [r.image_url] : []);

      const parsedOrigImages = Array.isArray(r.orig_images)
        ? r.orig_images
        : (typeof r.orig_images === "string"
            ? (() => { try { return JSON.parse(r.orig_images); } catch { return []; } })()
            : []);
      const finalOrigImages = parsedOrigImages.length > 0
        ? parsedOrigImages
        : (r.orig_image_url ? [r.orig_image_url] : []);

      return {
        savedId: String(r.saved_id),
        collectionName: r.collection_name,
        savedAt: formatTimeAgo(r.saved_at),
        id: String(r.id),
        userId: String(r.user_id),
        authorName:
          `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
          r.username ||
          "Local Farmer",
        authorRole: r.category || (r.role === "admin" ? "Wholesaler" : "Field"),
        avatarUri: r.avatar_url || "",
        location: sanitizePostLocation(r.location),
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        timeAgo: formatTimeAgo(r.created_at),
        content: r.content,
        imageUrl: r.image_url || (finalImages.length > 0 ? finalImages[0] : ""),
        images: finalImages,
        category: r.category,
        privacy: r.privacy,
        likes: Number(r.likes_count) || 0,
        comments: Number(r.comments_count) || 0,
        shares: Number(r.shares_count) || 0,
        isLiked: Boolean(r.is_liked),
        isSaved: true,
        isShared,
        originalPost: isShared
          ? {
              id: String(r.orig_id),
              userId: String(r.orig_user_id),
              authorName:
                `${r.orig_first_name || ""} ${r.orig_last_name || ""}`.trim() ||
                r.orig_username ||
                "Local Farmer",
              authorRole:
                r.orig_category ||
                (r.orig_role === "admin" ? "Wholesaler" : "Field"),
              avatarUri: r.orig_avatar_url || "",
              location: sanitizePostLocation(r.orig_location),
              latitude: r.orig_latitude != null ? Number(r.orig_latitude) : null,
              longitude: r.orig_longitude != null ? Number(r.orig_longitude) : null,
              timeAgo: formatTimeAgo(r.orig_created_at),
              content: r.orig_content,
              imageUrl: r.orig_image_url || (finalOrigImages.length > 0 ? finalOrigImages[0] : ""),
              images: finalOrigImages,
              category: r.orig_category,
            }
          : null,
      };
    });

    res.json({ savedPosts, count: savedPosts.length });
  } catch (err) {
    console.error("[Get Saved Posts Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch saved posts." });
  }
});

// 14.1 Get User's Saved Post Collections
app.get("/api/posts/saved/collections", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT DISTINCT collection_name
         FROM saved_posts
         WHERE user_id = $1
         ORDER BY collection_name ASC`,
      [userId],
    );

    const collections = rows.map((r) => r.collection_name);
    if (!collections.includes("All Saved")) {
      collections.unshift("All Saved");
    }

    res.json({ collections });
  } catch (err) {
    console.error("[Get Saved Collections Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch collections." });
  }
});

async function ensureSavedCollectionsTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_collections (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_saved_collection UNIQUE (user_id, name)
      );
    `).catch(() => {});
  } catch {}
}

// 14.1.1 Get Saved Collections with Details (Cover Image, Item Count, hasCurrentPost)
app.get("/api/posts/saved/collections/details", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const currentPostId = req.query.postId ? String(req.query.postId) : null;

    await ensureSavedCollectionsTable(pool);

    const { rows: colRows } = await pool.query(
      `SELECT name FROM (
         SELECT 'All Saved' AS name
         UNION
         SELECT name FROM saved_collections WHERE user_id = $1
         UNION
         SELECT collection_name AS name FROM saved_posts WHERE user_id = $1
       ) c
       WHERE name IS NOT NULL AND TRIM(name) != ''
       ORDER BY CASE WHEN name = 'All Saved' THEN 0 ELSE 1 END, name ASC`,
      [userId]
    );

    const collections = await Promise.all(
      colRows.map(async (row) => {
        const colName = row.name;
        const isAll = colName === "All Saved";
        const countQuery = isAll
          ? `SELECT COUNT(*)::int AS count FROM saved_posts WHERE user_id = $1`
          : `SELECT COUNT(*)::int AS count FROM saved_posts WHERE user_id = $1 AND collection_name = $2`;
        const countParams = isAll ? [userId] : [userId, colName];
        const { rows: countRes } = await pool.query(countQuery, countParams);
        const itemCount = Number(countRes[0]?.count) || 0;

        const coverQuery = isAll
          ? `SELECT p.image_url, p.images FROM saved_posts sp JOIN posts p ON sp.post_id = p.id WHERE sp.user_id = $1 ORDER BY sp.created_at DESC LIMIT 1`
          : `SELECT p.image_url, p.images FROM saved_posts sp JOIN posts p ON sp.post_id = p.id WHERE sp.user_id = $1 AND sp.collection_name = $2 ORDER BY sp.created_at DESC LIMIT 1`;
        const { rows: coverRes } = await pool.query(coverQuery, countParams);
        let coverImageUrl = "";
        if (coverRes.length > 0) {
          const imgs = coverRes[0].images;
          const parsed = Array.isArray(imgs)
            ? imgs
            : (typeof imgs === "string" ? (() => { try { return JSON.parse(imgs); } catch { return []; } })() : []);
          coverImageUrl = parsed.length > 0 ? parsed[0] : (coverRes[0].image_url || "");
        }

        let hasCurrentPost = false;
        if (currentPostId) {
          const hasQuery = isAll
            ? `SELECT 1 FROM saved_posts WHERE user_id = $1 AND post_id = $2 LIMIT 1`
            : `SELECT 1 FROM saved_posts WHERE user_id = $1 AND post_id = $2 AND collection_name = $3 LIMIT 1`;
          const hasParams = isAll ? [userId, currentPostId] : [userId, currentPostId, colName];
          const { rows: hasRes } = await pool.query(hasQuery, hasParams);
          hasCurrentPost = hasRes.length > 0;
        }

        return {
          name: colName,
          itemCount,
          coverImageUrl,
          hasCurrentPost,
          isDefault: isAll,
        };
      })
    );

    res.json({ collections });
  } catch (err) {
    console.error("[Get Saved Collections Details Error]", err);
    res.status(500).json({ message: err.message || "Failed to fetch collection details." });
  }
});

// 14.1.2 Create New Saved Collection
app.post("/api/posts/saved/collections", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { name, postId } = req.body;
    const trimmed = (name || "").trim();

    if (!trimmed) {
      return res.status(400).json({ message: "Collection name is required." });
    }

    await ensureSavedCollectionsTable(pool);

    await pool.query(
      `INSERT INTO saved_collections (user_id, name) VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO NOTHING`,
      [userId, trimmed]
    );

    if (postId) {
      const { rows: existing } = await pool.query(
        "SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2",
        [userId, postId]
      );
      if (existing.length > 0) {
        await pool.query(
          "UPDATE saved_posts SET collection_name = $1, created_at = NOW() WHERE id = $2",
          [trimmed, existing[0].id]
        );
      } else {
        await pool.query(
          "INSERT INTO saved_posts (user_id, post_id, collection_name) VALUES ($1, $2, $3)",
          [userId, postId, trimmed]
        );
      }
    }

    res.status(201).json({
      message: `Collection "${trimmed}" created!`,
      collectionName: trimmed,
    });
  } catch (err) {
    console.error("[Create Collection Error]", err);
    res.status(500).json({ message: err.message || "Failed to create collection." });
  }
});

// 14.1.3 Rename Saved Collection
app.patch("/api/posts/saved/collections/rename", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { oldName, newName } = req.body;
    const trimmedOld = (oldName || "").trim();
    const trimmedNew = (newName || "").trim();

    if (!trimmedOld || !trimmedNew) {
      return res.status(400).json({ message: "Both old and new collection names are required." });
    }

    if (trimmedOld.toLowerCase() === "all saved") {
      return res.status(400).json({ message: "Default collection cannot be renamed." });
    }

    await ensureSavedCollectionsTable(pool);

    await pool.query(
      "UPDATE saved_collections SET name = $1 WHERE user_id = $2 AND name = $3",
      [trimmedNew, userId, trimmedOld]
    );

    await pool.query(
      "UPDATE saved_posts SET collection_name = $1 WHERE user_id = $2 AND collection_name = $3",
      [trimmedNew, userId, trimmedOld]
    );

    res.json({
      message: `Collection renamed to "${trimmedNew}"!`,
      oldName: trimmedOld,
      newName: trimmedNew,
    });
  } catch (err) {
    console.error("[Rename Collection Error]", err);
    res.status(500).json({ message: err.message || "Failed to rename collection." });
  }
});

// 14.1.4 Delete Saved Collection
app.delete("/api/posts/saved/collections/:name", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const collectionName = decodeURIComponent(req.params.name || "").trim();

    if (!collectionName || collectionName.toLowerCase() === "all saved") {
      return res.status(400).json({ message: "Cannot delete the default collection." });
    }

    await ensureSavedCollectionsTable(pool);

    await pool.query(
      "DELETE FROM saved_collections WHERE user_id = $1 AND name = $2",
      [userId, collectionName]
    );

    await pool.query(
      "UPDATE saved_posts SET collection_name = 'All Saved' WHERE user_id = $1 AND collection_name = $2",
      [userId, collectionName]
    );

    res.json({
      message: `Collection "${collectionName}" deleted. Posts moved to All Saved.`,
      deletedName: collectionName,
    });
  } catch (err) {
    console.error("[Delete Collection Error]", err);
    res.status(500).json({ message: err.message || "Failed to delete collection." });
  }
});

// 14.2 Get News Feed Posts (with category and privacy filtering)
app.get(
  ["/api/posts", "/api/posts/feed"],
  optionalAuthenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const currentUserId = req.user?.id || 0;
      const category = req.query.category;

      await ensureSamplePosts(pool);

      let query = `
        SELECT p.id, p.user_id, p.original_post_id, p.content, p.image_url, p.images, p.category, p.privacy, p.location,
               p.latitude, p.longitude, p.duration_label,
               p.expires_at,
               p.is_pre_harvest, p.expected_harvest_date, p.available_quantity, p.reserved_quantity, p.crop_name, p.unit, p.price_per_unit, p.pickup_hub,
               (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
               (SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
               (SELECT COUNT(*)::int FROM post_shares ps WHERE ps.post_id = p.id) AS shares_count,
               p.created_at,
               u.first_name, u.last_name, u.username, u.avatar_url, u.role,
               EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS is_liked,
               (SELECT pl.reaction_type FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1 LIMIT 1) AS user_reaction,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) AS is_saved,
               COALESCE(
                 (
                   SELECT json_agg(json_build_object(
                     'id', CAST(tu.user_id AS TEXT),
                     'name', COALESCE(NULLIF(TRIM(CONCAT(tu_u.first_name, ' ', tu_u.last_name)), ''), tu_u.username, 'User'),
                     'username', tu_u.username,
                     'avatarUrl', tu_u.avatar_url
                   ))
                   FROM tagged_users tu
                   JOIN users tu_u ON tu.user_id = tu_u.id
                   WHERE tu.post_id = p.id
                 ),
                 '[]'::json
               ) AS tagged_users,
               orig.id AS orig_id, orig.user_id AS orig_user_id, orig.content AS orig_content, orig.image_url AS orig_image_url,
               orig.images AS orig_images,
               orig.category AS orig_category, orig.location AS orig_location,
               orig.latitude AS orig_latitude, orig.longitude AS orig_longitude,
               orig.created_at AS orig_created_at,
               orig_u.first_name AS orig_first_name, orig_u.last_name AS orig_last_name,
               orig_u.username AS orig_username, orig_u.avatar_url AS orig_avatar_url, orig_u.role AS orig_role
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN posts orig ON p.original_post_id = orig.id
        LEFT JOIN users orig_u ON orig.user_id = orig_u.id
      `;

      let whereClauses = [
        // Privacy enforcement
        `(
          p.privacy = 'Public'
          OR p.user_id = $3
          OR EXISTS (SELECT 1 FROM tagged_users tu WHERE tu.post_id = p.id AND tu.user_id = $3)
          OR (
            p.privacy = 'Friends'
            AND EXISTS (
              SELECT 1 FROM connections c
              WHERE c.status = 'accepted'
                AND (
                  (c.sender_id = $4 AND c.receiver_id = p.user_id)
                  OR
                  (c.sender_id = p.user_id AND c.receiver_id = $5)
                )
            )
          )
        )`,
        // Exclude expired temporary posts
        `(p.category != 'Temporary' OR p.expires_at IS NULL OR p.expires_at > NOW())`,
      ];

      const params = [
        currentUserId, // for is_liked
        currentUserId, // for is_saved
        currentUserId, // for p.user_id = ? / tagged user check
        currentUserId, // for friend connection sender
        currentUserId, // for friend connection receiver
      ];

      let paramCounter = 6;
      if (
        category &&
        category.toLowerCase() !== "all" &&
        category.toLowerCase() !== "general"
      ) {
        whereClauses.push("p.category = $" + paramCounter);
        params.push(category);
        paramCounter++;
      }

      const filterUserId = req.query.userId;
      if (filterUserId) {
        whereClauses.push("p.user_id = $" + paramCounter);
        params.push(filterUserId);
        paramCounter++;
      }

      const searchKeyword = (req.query.search || req.query.q || "").trim();
      if (searchKeyword) {
        const pattern = "%" + searchKeyword + "%";
        whereClauses.push(
          "(p.content LIKE $" + paramCounter + " OR p.crop_name LIKE $" + (paramCounter + 1) + " OR p.location LIKE $" + (paramCounter + 2) + " OR u.first_name LIKE $" + (paramCounter + 3) + " OR u.last_name LIKE $" + (paramCounter + 4) + " OR u.username LIKE $" + (paramCounter + 5) + ")"
        );
        params.push(pattern, pattern, pattern, pattern, pattern, pattern);
        paramCounter += 6;
      }

      if (whereClauses.length > 0) {
        query += " WHERE " + whereClauses.join(" AND ");
      }

      query += ` ORDER BY p.created_at DESC ${filterUserId ? "LIMIT 100" : "LIMIT 50"}`;

      const { rows } = await pool.query(query, params);

      const posts = rows.map((r) => {
        const isShared = Boolean(r.original_post_id && r.orig_id);
        const taggedList = Array.isArray(r.tagged_users) ? r.tagged_users : [];

        const parsedImages = Array.isArray(r.images)
          ? r.images
          : (typeof r.images === "string"
              ? (() => { try { return JSON.parse(r.images); } catch { return []; } })()
              : []);
        const finalImages = parsedImages.length > 0
          ? parsedImages
          : (r.image_url ? [r.image_url] : []);

        const parsedOrigImages = Array.isArray(r.orig_images)
          ? r.orig_images
          : (typeof r.orig_images === "string"
              ? (() => { try { return JSON.parse(r.orig_images); } catch { return []; } })()
              : []);
        const finalOrigImages = parsedOrigImages.length > 0
          ? parsedOrigImages
          : (r.orig_image_url ? [r.orig_image_url] : []);

        return {
          id: String(r.id),
          userId: String(r.user_id),
          authorName:
            `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
            r.username ||
            "Local Farmer",
          authorRole:
            r.category || (r.role === "admin" ? "Wholesaler" : "Field"),
          avatarUri: r.avatar_url || "",
          location: sanitizePostLocation(r.location),
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          timeAgo: formatTimeAgo(r.created_at),
          content: r.content,
          imageUrl: r.image_url || (finalImages.length > 0 ? finalImages[0] : ""),
          images: finalImages,
          category: r.category,
          privacy: r.privacy,
          durationLabel: r.duration_label || undefined,
          expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
          isPreHarvest: Boolean(r.is_pre_harvest),
          expectedHarvestDate: r.expected_harvest_date ? new Date(r.expected_harvest_date).toISOString().split('T')[0] : null,
          availableQuantity: r.available_quantity != null ? Number(r.available_quantity) : null,
          reservedQuantity: Number(r.reserved_quantity) || 0,
          cropName: r.crop_name || null,
          unit: r.unit || 'kg',
          pricePerUnit: r.price_per_unit != null ? Number(r.price_per_unit) : null,
          pickupHub: r.pickup_hub || null,
          taggedUsers: taggedList,
          likes: Number(r.likes_count) || 0,
          comments: Number(r.comments_count) || 0,
          shares: Number(r.shares_count) || 0,
          isLiked: Boolean(r.is_liked),
          userReaction: r.user_reaction || null,
          isSaved: Boolean(r.is_saved),
          isShared,
          originalPost: isShared
            ? {
                id: String(r.orig_id),
                userId: String(r.orig_user_id),
                authorName:
                  `${r.orig_first_name || ""} ${r.orig_last_name || ""}`.trim() ||
                  r.orig_username ||
                  "Local Farmer",
                authorRole:
                  r.orig_category ||
                  (r.orig_role === "admin" ? "Wholesaler" : "Field"),
                avatarUri: r.orig_avatar_url || "",
                location: sanitizePostLocation(r.orig_location),
                latitude: r.orig_latitude != null ? Number(r.orig_latitude) : null,
                longitude: r.orig_longitude != null ? Number(r.orig_longitude) : null,
                timeAgo: formatTimeAgo(r.orig_created_at),
                content: r.orig_content,
                imageUrl: r.orig_image_url || (finalOrigImages.length > 0 ? finalOrigImages[0] : ""),
                images: finalOrigImages,
                category: r.orig_category,
              }
            : null,
        };
      });

      res.json({ posts, count: posts.length });
    } catch (err) {
      console.error("[Get Posts Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch posts." });
    }
  },
);

// 14.2 Create New Post
app.post(
  ["/api/posts", "/api/posts/create"],
  authenticateToken,
  async (req, res) => {
    try {
      const {
        content,
        category,
        privacy,
        location,
        photos,
        imageUrl,
        taggedUserIds,
        expiresAt,
        temporaryDuration,
        durationLabel,
        latitude,
        longitude,
        isLiveReplay,
        viewerCount,
        durationSeconds,
      } = req.body;
      const text = (content || "").trim();

      const photosArray = Array.isArray(photos)
        ? photos.filter(Boolean)
        : (imageUrl ? [imageUrl] : []);

      const chosenImage =
        photosArray.length > 0 ? photosArray[0] : (imageUrl || null);

      if (!text && !chosenImage && photosArray.length === 0) {
        return res
          .status(400)
          .json({ message: "Post content or photo is required." });
      }

      const pool = getPool();
      const userId = req.user.id;

      const validCategory = [
        "Field",
        "Wholesaler",
        "Temporary",
        "General",
      ].includes(category)
        ? category
        : "General";

      const validPrivacy = ["Public", "Friends", "Only me"].includes(privacy)
        ? privacy
        : "Public";

      const postLocation = sanitizePostLocation(location);
      const postLat =
        latitude !== undefined && latitude !== null && !isNaN(Number(latitude))
          ? Number(latitude)
          : null;
      const postLng =
        longitude !== undefined && longitude !== null && !isNaN(Number(longitude))
          ? Number(longitude)
          : null;

      // Determine expiration timestamp for Temporary category
      let postExpiresAt = null;
      if (validCategory === "Temporary") {
        if (expiresAt) {
          const d = new Date(expiresAt);
          postExpiresAt = isNaN(d.getTime())
            ? new Date(Date.now() + 24 * 3600 * 1000)
            : d;
        } else if (temporaryDuration) {
          const ms = Number(temporaryDuration) || 24 * 3600 * 1000;
          postExpiresAt = new Date(Date.now() + ms);
        } else {
          postExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
        }
      }

      const { rows: insertRes } = await pool.query(
        `INSERT INTO posts (user_id, content, image_url, images, category, privacy, location, expires_at, latitude, longitude, duration_label, likes_count, comments_count, shares_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, 0) RETURNING id`,
        [
          userId,
          text,
          chosenImage,
          JSON.stringify(photosArray),
          validCategory,
          validPrivacy,
          postLocation || null,
          postExpiresAt,
          postLat,
          postLng,
          durationLabel || null,
        ],
      );

      const postId = insertRes[0].id;

      // Record in live_streams table if this is a live broadcast replay
      if (isLiveReplay || (text && text.includes("[Live Replay]"))) {
        try {
          const pViewers = Number(viewerCount) || 18;
          const durSec = Number(durationSeconds) || 120;
          const startedAt = new Date(Date.now() - durSec * 1000);
          const endedAt = new Date();

          await pool.query(
            `INSERT INTO live_streams (user_id, post_id, status, viewer_count, started_at, ended_at)
             VALUES ($1, $2, 'ended', $3, $4, $5)`,
            [userId, postId, pViewers, startedAt, endedAt],
          );
        } catch (lsErr) {
          console.warn("[live_streams insert notice]:", lsErr.message);
        }
      }

      // Fetch user details to return complete post object
      const { rows: userRows } = await pool.query(
        "SELECT first_name, last_name, username, avatar_url, role FROM users WHERE id = $1",
        [userId],
      );
      const userRow = userRows[0];

      // Handle Tagged Users
      const normalizedTaggedIds = Array.isArray(taggedUserIds)
        ? [
            ...new Set(
              taggedUserIds
                .map((id) => Number(id))
                .filter((id) => !isNaN(id) && id > 0 && id !== Number(userId)),
            ),
          ]
        : [];

      const taggedUsersList = [];
      const authorDisplayName =
        `${userRow?.first_name || ""} ${userRow?.last_name || ""}`.trim() ||
        userRow?.username ||
        "Someone";

      for (const taggedId of normalizedTaggedIds) {
        try {
          await pool.query(
            "INSERT INTO tagged_users (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [postId, taggedId],
          );

          const { rows: tuRows } = await pool.query(
            "SELECT id, first_name, last_name, username, avatar_url FROM users WHERE id = $1",
            [taggedId],
          );
          if (tuRows.length > 0) {
            const tu = tuRows[0];
            taggedUsersList.push({
              id: String(tu.id),
              name:
                `${tu.first_name || ""} ${tu.last_name || ""}`.trim() ||
                tu.username ||
                "User",
              username: tu.username || "",
              avatarUrl: tu.avatar_url || "",
            });
          }

          // Send notification to tagged user (if not author themselves)
          if (String(taggedId) !== String(userId)) {
            await pool.query(
              `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
               VALUES ($1, $2, 'user', 'tag', 'Tagged in a Post', $3, 'post', $4, FALSE)`,
              [
                taggedId,
                userId,
                `${authorDisplayName} tagged you in a post.`,
                postId,
              ],
            );
          }
        } catch (tagErr) {
          console.warn(
            `[Tagging User Error] Could not tag user ${taggedId}:`,
            tagErr.message,
          );
        }
      }

      const newPost = {
        id: String(postId),
        userId: String(userId),
        authorName: authorDisplayName,
        authorRole:
          validCategory || (userRow?.role === "admin" ? "Wholesaler" : "Field"),
        avatarUri: userRow?.avatar_url || "",
        location: postLocation || "",
        latitude: postLat,
        longitude: postLng,
        timeAgo: "Just now",
        content: text,
        imageUrl: chosenImage || "",
        images: photosArray,
        category: validCategory,
        privacy: validPrivacy,
        expiresAt: postExpiresAt ? postExpiresAt.toISOString() : null,
        durationLabel: durationLabel || undefined,
        taggedUsers: taggedUsersList,
        likes: 0,
        comments: 0,
        shares: 0,
        isLiked: false,
      };

      res
        .status(201)
        .json({ message: "Post created successfully!", post: newPost });
    } catch (err) {
      console.error("[Create Post Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to create post." });
    }
  },
);

// 14.2b Record Live Stream Session (For discarded or standalone live broadcasts)
app.post(
  ["/api/live-streams", "/api/live-streams/record"],
  authenticateToken,
  async (req, res) => {
    try {
      const pool = getPool();
      const userId = req.user.id;
      const {
        viewerCount,
        durationSeconds,
        status = "ended",
        postId = null,
      } = req.body;

      const pViewers = Number(viewerCount) || 0;
      const durSec = Number(durationSeconds) || 10;
      const startedAt = new Date(Date.now() - durSec * 1000);
      const endedAt = new Date();

      const { rows } = await pool.query(
        `INSERT INTO live_streams (user_id, post_id, status, viewer_count, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          userId,
          postId ? Number(postId) : null,
          status,
          pViewers,
          startedAt,
          endedAt,
        ],
      );

      console.log(
        `[Live Stream Recorded] user_id=${userId} post_id=${postId || "NULL (discarded)"} viewers=${pViewers}`,
      );

      res.status(201).json({
        message: "Live stream recorded successfully.",
        liveStream: rows[0],
      });
    } catch (err) {
      console.error("[Record Live Stream Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to record live stream." });
    }
  },
);

// 14.2c Get Live Streams History
app.get("/api/live-streams", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT ls.*, u.first_name, u.last_name, u.username, u.avatar_url, p.content as post_content
       FROM live_streams ls
       JOIN users u ON ls.user_id = u.id
       LEFT JOIN posts p ON ls.post_id = p.id
       ORDER BY ls.started_at DESC LIMIT 50`,
    );
    res.json({ liveStreams: rows });
  } catch (err) {
    console.error("[Get Live Streams Error]", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch live streams." });
  }
});

// 14.3 Like / React to Post
app.post(
  [
    "/api/posts/:id/like",
    "/api/posts/like",
    "/api/posts/:id/react",
    "/api/posts/react",
  ],
  authenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.body.postId || req.body.id;
      if (!postId) {
        return res.status(400).json({ message: "Post ID is required." });
      }

      const pool = getPool();
      const userId = req.user.id;
      const requestedReaction = (
        req.body.reactionType ||
        req.body.reaction ||
        "like"
      ).toLowerCase();

      const { rows: existing } = await pool.query(
        "SELECT id, reaction_type FROM post_likes WHERE post_id = $1 AND user_id = $2",
        [postId, userId],
      );

      let isLiked = false;
      let finalReaction = null;

      if (existing.length > 0) {
        const currentReaction = existing[0].reaction_type || "like";
        if (currentReaction === requestedReaction) {
          // Same reaction tapped again -> Unlike / remove reaction
          await pool.query(
            "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
            [postId, userId],
          );
          await pool.query(
            "UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1",
            [postId],
          );
          isLiked = false;
          finalReaction = null;
        } else {
          // Different reaction chosen -> Switch reaction without changing count
          await pool.query(
            "UPDATE post_likes SET reaction_type = $3 WHERE post_id = $1 AND user_id = $2",
            [postId, userId, requestedReaction],
          );
          isLiked = true;
          finalReaction = requestedReaction;
        }
      } else {
        // New reaction
        await pool.query(
          "INSERT INTO post_likes (post_id, user_id, reaction_type) VALUES ($1, $2, $3)",
          [postId, userId, requestedReaction],
        );
        await pool.query(
          "UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1",
          [postId],
        );
        isLiked = true;
        finalReaction = requestedReaction;

        // Notify post author if different user
        try {
          const { rows: pRows } = await pool.query(
            "SELECT user_id FROM posts WHERE id = $1",
            [postId],
          );
          if (pRows.length > 0 && String(pRows[0].user_id) !== String(userId)) {
            const postAuthorId = pRows[0].user_id;
            const { rows: uRows } = await pool.query(
              "SELECT first_name, last_name, username FROM users WHERE id = $1",
              [userId],
            );
            const likerName =
              `${uRows[0]?.first_name || ""} ${uRows[0]?.last_name || ""}`.trim() ||
              uRows[0]?.username ||
              "Someone";

            const reactionLabel =
              requestedReaction === "like"
                ? "liked"
                : `reacted (${requestedReaction}) to`;

            await pool.query(
              `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
               VALUES ($1, $2, 'user', 'like', 'Post Reaction', $3, 'post', $4, FALSE)`,
              [
                postAuthorId,
                userId,
                `${likerName} ${reactionLabel} your post.`,
                postId,
              ],
            );
          }
        } catch (likeNotifErr) {
          console.warn("[Like Notification Warning]", likeNotifErr.message);
        }
      }

      const { rows: postRows } = await pool.query(
        "SELECT likes_count FROM posts WHERE id = $1",
        [postId],
      );
      const postRow = postRows[0];

      res.json({
        message: isLiked
          ? `Reaction (${finalReaction}) saved!`
          : "Reaction removed.",
        isLiked,
        userReaction: finalReaction,
        likesCount: Number(postRow?.likes_count) || 0,
      });
    } catch (err) {
      console.error("[Like Post Error]", err);
      res.status(500).json({ message: err.message || "Failed to like post." });
    }
  },
);

// 14.3.0 Share Post
app.post(
  ["/api/posts/:id/share", "/api/posts/share"],
  authenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.body.postId || req.body.id;
      if (!postId) {
        return res.status(400).json({ message: "Post ID is required." });
      }

      const pool = getPool();
      const userId = req.user.id;
      const { shareType = "public", caption = "", groupName, category, privacy = "Public" } = req.body;

      // Fetch target post to be shared
      const { rows: origRows } = await pool.query(
        `SELECT p.*, u.first_name, u.last_name, u.username, u.avatar_url, u.role
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [postId],
      );
      const targetPost = origRows[0];
      if (!targetPost) {
        return res.status(404).json({ message: "Original post not found." });
      }

      // If user shares a post that is already a shared post, link to the root original post
      const actualOriginalPostId = targetPost.original_post_id
        ? targetPost.original_post_id
        : targetPost.id;

      // 1. Record in post_shares table
      await pool.query(
        "INSERT INTO post_shares (post_id, user_id, share_type) VALUES ($1, $2, $3)",
        [postId, userId, shareType],
      );

      // 2. Increment shares count on the target post
      await pool.query(
        "UPDATE posts SET shares_count = shares_count + 1 WHERE id = $1",
        [postId],
      );

      // Also if targetPost had an original_post_id, increment root post's shares count too
      if (targetPost.original_post_id) {
        await pool.query(
          "UPDATE posts SET shares_count = shares_count + 1 WHERE id = $1",
          [targetPost.original_post_id],
        ).catch(() => {});
      }

      const { rows: postRows } = await pool.query(
        "SELECT shares_count FROM posts WHERE id = $1",
        [postId],
      );
      const sharesCount = Number(postRows[0]?.shares_count) || 1;
      const origAuthorId = targetPost.user_id;

      let sharedPost = null;

      // 3. If public, feed, or group share, create a new shared post entry in posts table
      if (shareType === "public" || shareType === "feed" || shareType === "group") {
        const postCategory = groupName || category || targetPost.category || "General";
        const { rows: newPostRows } = await pool.query(
          `INSERT INTO posts (user_id, content, original_post_id, category, privacy, likes_count, comments_count, shares_count)
           VALUES ($1, $2, $3, $4, $5, 0, 0, 0) RETURNING id, created_at`,
          [userId, (caption || "").trim(), actualOriginalPostId, postCategory, privacy || "Public"],
        );

        const newPostId = newPostRows[0]?.id;

        // Fetch author user info
        const { rows: uRows } = await pool.query(
          "SELECT first_name, last_name, username, avatar_url, role FROM users WHERE id = $1",
          [userId],
        );
        const userRow = uRows[0];

        // Fetch actual root post details
        const { rows: rootOrigRows } = await pool.query(
          `SELECT p.*, u.first_name, u.last_name, u.username, u.avatar_url, u.role
           FROM posts p
           JOIN users u ON p.user_id = u.id
           WHERE p.id = $1`,
          [actualOriginalPostId],
        );
        const orig = rootOrigRows[0] || targetPost;

        sharedPost = {
          id: String(newPostId),
          userId: String(userId),
          authorName:
            `${userRow?.first_name || ""} ${userRow?.last_name || ""}`.trim() ||
            userRow?.username ||
            "You",
          authorRole: postCategory || (userRow?.role === "admin" ? "Wholesaler" : "Field"),
          avatarUri: userRow?.avatar_url || "",
          location: "",
          timeAgo: "Just now",
          content: (caption || "").trim(),
          imageUrl: "",
          category: postCategory,
          privacy: privacy || "Public",
          likes: 0,
          comments: 0,
          shares: 0,
          isLiked: false,
          userReaction: null,
          isSaved: false,
          isShared: true,
          originalPost: orig
            ? {
                id: String(orig.id),
                userId: String(orig.user_id),
                authorName:
                  `${orig.first_name || ""} ${orig.last_name || ""}`.trim() ||
                  orig.username ||
                  "Local Farmer",
                authorRole: orig.category || "Field",
                avatarUri: orig.avatar_url || "",
                location: sanitizePostLocation(orig.location),
                latitude:
                  orig.latitude != null ? Number(orig.latitude) : null,
                longitude:
                  orig.longitude != null ? Number(orig.longitude) : null,
                timeAgo: formatTimeAgo(orig.created_at),
                content: orig.content,
                imageUrl: orig.image_url || "",
                category: orig.category,
              }
            : null,
        };

        // Notify original author if different user
        if (origAuthorId && String(origAuthorId) !== String(userId)) {
          const sharerName =
            `${userRow?.first_name || ""} ${userRow?.last_name || ""}`.trim() ||
            userRow?.username ||
            "Someone";
          await pool
            .query(
              `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
               VALUES ($1, $2, 'user', 'share', 'Post Shared', $3, 'post', $4, FALSE)`,
              [origAuthorId, userId, `${sharerName} shared your post.`, postId],
            )
            .catch(() => {});
        }
      }

      res.status(201).json({
        message:
          shareType === "group"
            ? "Post shared to group!"
            : shareType === "message"
            ? "Post shared in message!"
            : "Post shared successfully to your feed!",
        sharesCount,
        sharedPost,
      });
    } catch (err) {
      console.error("[Share Post Error]", err);
      res.status(500).json({ message: err.message || "Failed to share post." });
    }
  },
);

// 14.2.1 Get Single Post
app.get("/api/posts/:id", optionalAuthenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const pool = getPool();
    const currentUserId = req.user?.id || 0;

    const query = `
        SELECT p.id, p.user_id, p.original_post_id, p.content, p.image_url, p.images, p.category, p.privacy, p.location,
               p.latitude, p.longitude,
               p.expires_at,
               (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
               (SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
               (SELECT COUNT(*)::int FROM post_shares ps WHERE ps.post_id = p.id) AS shares_count,
               p.created_at,
               u.first_name, u.last_name, u.username, u.avatar_url, u.role,
               EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS is_liked,
               (SELECT pl.reaction_type FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1 LIMIT 1) AS user_reaction,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) AS is_saved,
               COALESCE(
                 (
                   SELECT json_agg(json_build_object(
                     'id', CAST(tu.user_id AS TEXT),
                     'name', COALESCE(NULLIF(TRIM(CONCAT(tu_u.first_name, ' ', tu_u.last_name)), ''), tu_u.username, 'User'),
                     'username', tu_u.username,
                     'avatarUrl', tu_u.avatar_url
                   ))
                   FROM tagged_users tu
                   JOIN users tu_u ON tu.user_id = tu_u.id
                   WHERE tu.post_id = p.id
                 ),
                 '[]'::json
               ) AS tagged_users
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = $3
        LIMIT 1
      `;

    const { rows } = await pool.query(query, [
      currentUserId,
      currentUserId,
      postId,
    ]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Post not found." });
    }

    const r = rows[0];
    const taggedList = Array.isArray(r.tagged_users) ? r.tagged_users : [];
    const parsedImages = Array.isArray(r.images)
      ? r.images
      : (typeof r.images === "string"
          ? (() => { try { return JSON.parse(r.images); } catch { return []; } })()
          : []);
    const finalImages = parsedImages.length > 0
      ? parsedImages
      : (r.image_url ? [r.image_url] : []);

    const post = {
      id: String(r.id),
      userId: String(r.user_id),
      authorName:
        `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
        r.username ||
        "Local Farmer",
      authorRole: r.category || (r.role === "admin" ? "Wholesaler" : "Field"),
      avatarUri: r.avatar_url || "",
      location: sanitizePostLocation(r.location),
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      timeAgo: formatTimeAgo(r.created_at),
      content: r.content,
      imageUrl: r.image_url || (finalImages.length > 0 ? finalImages[0] : ""),
      images: finalImages,
      category: r.category,
      privacy: r.privacy,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      taggedUsers: taggedList,
      likes: Number(r.likes_count) || 0,
      comments: Number(r.comments_count) || 0,
      shares: Number(r.shares_count) || 0,
      isLiked: Boolean(r.is_liked),
      userReaction: r.user_reaction || null,
      isSaved: Boolean(r.is_saved),
    };

    res.json({ post });
  } catch (err) {
    console.error("[Get Post Error]", err);
    res.status(500).json({ message: err.message || "Failed to fetch post." });
  }
});

// 14.3.1 Edit Post / Update Privacy / Category / Content / Location / Photos
app.put(
  ["/api/posts/:id", "/api/posts/update"],
  authenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.body.id || req.body.postId;
      const { content, category, privacy, location, imageUrl, photos, latitude, longitude } =
        req.body;
      const pool = getPool();
      const userId = req.user.id;
      const role = req.user.role;

      const { rows: postRows } = await pool.query(
        "SELECT * FROM posts WHERE id = $1",
        [postId],
      );
      const post = postRows[0];
      if (!post) {
        return res.status(404).json({ message: "Post not found." });
      }

      if (Number(post.user_id) !== Number(userId) && role !== "admin") {
        return res
          .status(403)
          .json({ message: "Unauthorized to modify this post." });
      }

      const validCategory =
        category &&
        ["Field", "Wholesaler", "Temporary", "General"].includes(category)
          ? category
          : post.category;

      const validPrivacy =
        privacy && ["Public", "Friends", "Only me"].includes(privacy)
          ? privacy
          : post.privacy;

      const updatedContent = content !== undefined ? content : post.content;
      const updatedLocation =
        location !== undefined ? sanitizePostLocation(location) : post.location;

      const updatedLat =
        latitude !== undefined
          ? (latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null)
          : (post.latitude != null ? Number(post.latitude) : null);
      const updatedLng =
        longitude !== undefined
          ? (longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null)
          : (post.longitude != null ? Number(post.longitude) : null);

      let updatedImage = post.image_url;
      if (imageUrl !== undefined) {
        updatedImage = imageUrl;
      } else if (Array.isArray(photos)) {
        updatedImage = photos.length > 0 ? photos[0] : null;
      }

      await pool.query(
        "UPDATE posts SET content = $1, category = $2, privacy = $3, location = $4, image_url = $5, latitude = $6, longitude = $7, updated_at = NOW() WHERE id = $8",
        [
          updatedContent,
          validCategory,
          validPrivacy,
          updatedLocation || null,
          updatedImage || null,
          updatedLat,
          updatedLng,
          postId,
        ],
      );

      res.json({
        message: "Post updated successfully!",
        post: {
          id: String(postId),
          content: updatedContent,
          category: validCategory,
          privacy: validPrivacy,
          location: updatedLocation || "",
          latitude: updatedLat,
          longitude: updatedLng,
          imageUrl: updatedImage || "",
        },
      });
    } catch (err) {
      console.error("[Update Post Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update post." });
    }
  },
);

// 14.3.2 Delete Post or Shared Post
app.delete(
  ["/api/posts/:id", "/api/posts/delete"],
  authenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.body.id || req.body.postId;
      const pool = getPool();
      const userId = req.user.id;
      const role = req.user.role;

      const { rows: postRows } = await pool.query(
        "SELECT * FROM posts WHERE id = $1",
        [postId],
      );
      const post = postRows[0];
      if (!post) {
        return res.status(404).json({ message: "Post not found." });
      }

      if (Number(post.user_id) !== Number(userId) && role !== "admin") {
        return res
          .status(403)
          .json({ message: "Unauthorized to delete this post." });
      }

      // If this was a shared post, decrement the original post's shares_count
      if (post.original_post_id) {
        await pool.query(
          "UPDATE posts SET shares_count = GREATEST(0, shares_count - 1) WHERE id = $1",
          [post.original_post_id],
        );
      }

      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

      res.json({ message: "Post deleted successfully!" });
    } catch (err) {
      console.error("[Delete Post Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to delete post." });
    }
  },
);

// 14.3.3 Save / Bookmark Post
app.post(
  ["/api/posts/:id/save", "/api/posts/save"],
  authenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.body.postId || req.body.id;
      const { collectionName } = req.body;
      const pool = getPool();
      const userId = req.user.id;

      const { rows: existing } = await pool.query(
        "SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2",
        [userId, postId],
      );

      let isSaved = false;
      if (collectionName) {
        // Moving/updating to a specific collection
        if (existing.length > 0) {
          await pool.query(
            "UPDATE saved_posts SET collection_name = $1, created_at = NOW() WHERE id = $2",
            [collectionName, existing[0].id],
          );
        } else {
          await pool.query(
            "INSERT INTO saved_posts (user_id, post_id, collection_name) VALUES ($1, $2, $3)",
            [userId, postId, collectionName],
          );
        }
        isSaved = true;
      } else {
        // Toggle save/unsave (no collection specified)
        if (existing.length > 0) {
          await pool.query("DELETE FROM saved_posts WHERE id = $1", [
            existing[0].id,
          ]);
          isSaved = false;
        } else {
          await pool.query(
            "INSERT INTO saved_posts (user_id, post_id, collection_name) VALUES ($1, $2, $3)",
            [userId, postId, "All Saved"],
          );
          isSaved = true;
        }
      }

      res.json({
        message: isSaved
          ? `Post saved to ${collectionName || "All Saved"}!`
          : "Post removed from saved.",
        isSaved,
        collectionName: isSaved ? (collectionName || "All Saved") : null,
      });
    } catch (err) {
      console.error("[Save Post Error]", err);
      res.status(500).json({ message: err.message || "Failed to save post." });
    }
  },
);

// 14.4 Get Post Comments
app.get(
  ["/api/posts/:id/comments", "/api/comments"],
  optionalAuthenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.query.postId;
      if (!postId) {
        return res.status(400).json({ message: "Post ID is required." });
      }

      const pool = getPool();
      const currentUserId = req.user?.id || 0;

      const { rows } = await pool.query(
        `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.likes_count, c.created_at,
                u.first_name, u.last_name, u.username, u.avatar_url,
                EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $1) AS is_liked
         FROM post_comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.post_id = $2
         ORDER BY c.created_at ASC`,
        [currentUserId, postId],
      );

      const comments = rows.map((r) => ({
        id: String(r.id),
        postId: String(r.post_id),
        userId: String(r.user_id),
        authorName:
          `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
          r.username ||
          "Local Farmer",
        avatarUri: r.avatar_url || "",
        timeAgo: formatTimeAgo(r.created_at),
        content: r.content,
        likes: Number(r.likes_count) || 0,
        isLiked: Boolean(r.is_liked),
        parentId: r.parent_id ? String(r.parent_id) : null,
      }));

      res.json({ comments, count: comments.length });
    } catch (err) {
      console.error("[Get Comments Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to fetch comments." });
    }
  },
);

// 14.5 Add Comment to Post
app.post(
  ["/api/posts/:id/comments", "/api/comments"],
  authenticateToken,
  async (req, res) => {
    try {
      const postId = req.params.id || req.body.postId;
      const { content, parentId } = req.body;
      const text = (content || "").trim();

      if (!postId) {
        return res.status(400).json({ message: "Post ID is required." });
      }
      if (!text) {
        return res
          .status(400)
          .json({ message: "Comment content is required." });
      }

      const pool = getPool();
      const userId = req.user.id;
      let parent =
        parentId && !isNaN(Number(parentId)) ? Number(parentId) : null;

      if (parent) {
        try {
          const { rows: parentRows } = await pool.query(
            "SELECT id FROM post_comments WHERE id = $1",
            [parent],
          );
          if (parentRows.length === 0) {
            parent = null;
          }
        } catch {
          parent = null;
        }
      }

      let postNum = postId && !isNaN(Number(postId)) ? Number(postId) : null;
      let commentId = Date.now();

      if (postNum) {
        try {
          const { rows: insertRes } = await pool.query(
            "INSERT INTO post_comments (post_id, user_id, parent_id, content, likes_count) VALUES ($1, $2, $3, $4, 0) RETURNING id",
            [postNum, userId, parent, text],
          );
          commentId = insertRes[0].id;

          // Increment comments_count on posts table
          await pool.query(
            "UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1",
            [postNum],
          );

          // Notify post author if different user
          try {
            const { rows: postAuthorRows } = await pool.query(
              "SELECT user_id FROM posts WHERE id = $1",
              [postNum],
            );
            if (
              postAuthorRows.length > 0 &&
              String(postAuthorRows[0].user_id) !== String(userId)
            ) {
              const postAuthorId = postAuthorRows[0].user_id;
              const { rows: commenterRows } = await pool.query(
                "SELECT first_name, last_name, username FROM users WHERE id = $1",
                [userId],
              );
              const commenterName =
                `${commenterRows[0]?.first_name || ""} ${commenterRows[0]?.last_name || ""}`.trim() ||
                commenterRows[0]?.username ||
                "Someone";

              await pool.query(
                `INSERT INTO notifications (user_id, actor_id, actor_type, type, title, content, entity_name, target_id, is_read)
                 VALUES ($1, $2, 'user', 'comment', 'Post Comment', $3, 'post', $4, FALSE)`,
                [
                  postAuthorId,
                  userId,
                  `${commenterName} commented on your post: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`,
                  postNum,
                ],
              );
            }
          } catch (commentNotifErr) {
            console.warn(
              "[Comment Notification Warning]",
              commentNotifErr.message,
            );
          }
        } catch (dbErr) {
          console.warn("[Add Comment DB Warning]", dbErr.message);
        }
      }

      // Fetch author info
      let userRow = null;
      try {
        const { rows: uRows } = await pool.query(
          "SELECT first_name, last_name, username, avatar_url FROM users WHERE id = $1",
          [userId],
        );
        userRow = uRows[0];
      } catch {}

      const newComment = {
        id: String(commentId),
        postId: String(postId),
        userId: String(userId),
        authorName:
          `${userRow?.first_name || ""} ${userRow?.last_name || ""}`.trim() ||
          userRow?.username ||
          req.user?.username ||
          "Local Farmer",
        avatarUri: userRow?.avatar_url || "",
        timeAgo: "Just now",
        content: text,
        likes: 0,
        isLiked: false,
        parentId: parentId ? String(parentId) : null,
      };

      res.status(201).json({ message: "Comment posted!", comment: newComment });
    } catch (err) {
      console.error("[Add Comment Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to post comment." });
    }
  },
);

// 14.6 Like / Unlike Comment
app.post(
  ["/api/comments/:id/like", "/api/comments/like"],
  authenticateToken,
  async (req, res) => {
    try {
      const commentId = req.params.id || req.body.commentId || req.body.id;
      if (!commentId) {
        return res.status(400).json({ message: "Comment ID is required." });
      }

      const pool = getPool();
      const userId = req.user.id;

      const { rows: existing } = await pool.query(
        "SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
        [commentId, userId],
      );

      let isLiked = false;
      if (existing.length > 0) {
        // Unlike
        await pool.query(
          "DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
          [commentId, userId],
        );
        await pool.query(
          "UPDATE post_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1",
          [commentId],
        );
        isLiked = false;
      } else {
        // Like
        await pool.query(
          "INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)",
          [commentId, userId],
        );
        await pool.query(
          "UPDATE post_comments SET likes_count = likes_count + 1 WHERE id = $1",
          [commentId],
        );
        isLiked = true;
      }

      const { rows: commentRows } = await pool.query(
        "SELECT likes_count FROM post_comments WHERE id = $1",
        [commentId],
      );
      const commentRow = commentRows[0];

      res.json({
        message: isLiked ? "Comment liked!" : "Comment unliked.",
        isLiked,
        likesCount: Number(commentRow?.likes_count) || 0,
      });
    } catch (err) {
      console.error("[Like Comment Error]", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to like comment." });
    }
  },
);



// ============================================================================
// SECTION 15: STORIES API
// ============================================================================

async function ensureSampleStories(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        media_type VARCHAR(20) NOT NULL DEFAULT 'image',
        media_url TEXT NOT NULL,
        text_content TEXT,
        background_color VARCHAR(20) DEFAULT '#72AF5B',
        music_title VARCHAR(255),
        privacy VARCHAR(50) NOT NULL DEFAULT 'Public',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expired_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS story_views (
        id SERIAL PRIMARY KEY,
        story_id INT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        viewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        view_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_story_viewer UNIQUE (story_id, viewer_id)
      );
    `).catch(() => {});
  } catch (e) {
    console.warn("ensureSampleStories error:", e.message);
  }
}

// 15.1 Get Active Stories
app.get("/api/stories", optionalAuthenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const currentUserId = req.user?.id || 0;

    await ensureSampleStories(pool);

    const query = `
      SELECT s.id, s.user_id, s.media_type, s.media_url,
             s.text_content, s.caption,
             s.background_color, s.music_title, s.privacy, s.overlays_json, s.created_at,
             COALESCE(s.expired_at, s.expires_at) AS expired_at,
             u.first_name, u.last_name, u.full_name, u.username, u.avatar_url,
             EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) AS is_seen,
             COALESCE((SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id != s.user_id), 0) AS views_count
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE COALESCE(s.expired_at, s.expires_at) > NOW()
        AND (
          s.privacy = 'Public'
          OR s.user_id = $1
          OR (
            s.privacy = 'Friends'
            AND EXISTS (
              SELECT 1 FROM connections c
              WHERE c.status = 'accepted'
                AND (
                  (c.sender_id = $1 AND c.receiver_id = s.user_id)
                  OR
                  (c.sender_id = s.user_id AND c.receiver_id = $1)
                )
            )
          )
        )
      ORDER BY s.user_id ASC, s.created_at ASC
    `;

    const { rows } = await pool.query(query, [currentUserId]);

    const userStoryMap = new Map();

    for (const r of rows) {
      const uId = String(r.user_id);
      if (!userStoryMap.has(uId)) {
        const userName =
          r.full_name ||
          `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
          r.username ||
          "Local Farmer";
        const isSelf = Boolean(
          currentUserId && String(r.user_id) === String(currentUserId),
        );
        userStoryMap.set(uId, {
          userId: uId,
          userName,
          userAvatar: r.avatar_url || "",
          color: r.background_color || "#72AF5B",
          isSelf,
          stories: [],
        });
      }

      let parsedOverlays = null;
      if (r.overlays_json) {
        try {
          parsedOverlays =
            typeof r.overlays_json === "string"
              ? JSON.parse(r.overlays_json)
              : r.overlays_json;
        } catch (_) {}
      }

      const rawContent = (r.text_content || "").trim();
      const rawCaption = (r.caption || "").trim();
      const displayCaption =
        rawCaption && rawCaption !== rawContent ? rawCaption : "";

      userStoryMap.get(uId).stories.push({
        id: String(r.id),
        imageUrl: r.media_url || "",
        content: rawContent || (!r.media_url ? rawCaption : ""),
        caption: displayCaption,
        isSeen: Boolean(r.is_seen),
        timeAgo: formatTimeAgo(r.created_at),
        backgroundColor: r.background_color,
        mediaType: r.media_type,
        musicTitle: r.music_title || null,
        privacy: r.privacy || "Public",
        viewsCount: parseInt(r.views_count, 10) || 0,
        overlays: parsedOverlays,
      });
    }

    const userStories = Array.from(userStoryMap.values());
    res.json({ stories: userStories, count: userStories.length });
  } catch (err) {
    console.error("[Get Stories Error]", err);
    res.status(500).json({ message: err.message || "Failed to fetch stories." });
  }
});

// 15.2 Create Story
app.post("/api/stories", authenticateToken, async (req, res) => {
  try {
    const {
      mediaUrl,
      textContent,
      caption,
      backgroundColor,
      musicTitle,
      privacy,
      mediaType,
      overlays,
    } = req.body;
    const userId = req.user.id;

    if (!mediaUrl && !textContent && !caption) {
      return res.status(400).json({ message: "Photo or story text is required." });
    }

    const pool = getPool();
    const validPrivacy = ["Public", "Friends", "Only me"].includes(privacy) ? privacy : "Public";
    const storyMediaType = mediaType || (mediaUrl ? "image" : "text");
    const storyText = textContent || (!mediaUrl ? caption : null) || null;
    const storyCaption =
      caption && caption.trim() !== (textContent || "").trim()
        ? caption.trim()
        : null;
    const overlaysJson = overlays ? JSON.stringify(overlays) : null;

    const { rows: insertRes } = await pool.query(
      `INSERT INTO stories (user_id, media_type, media_url, text_content, caption, background_color, music_title, privacy, overlays_json, created_at, expired_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), DATE_ADD(NOW(), INTERVAL 24 HOUR))
       RETURNING id, created_at, expired_at`,
      [
        userId,
        storyMediaType,
        mediaUrl || null,
        storyText,
        storyCaption ? String(storyCaption).slice(0, 255) : null,
        backgroundColor || "#72AF5B",
        musicTitle || null,
        validPrivacy,
        overlaysJson,
      ],
    );

    const newStory = insertRes[0] || {};
    const storyId = newStory.id || insertRes.insertId;

    res.status(201).json({
      message: "Story created successfully!",
      story: {
        id: String(storyId),
        imageUrl: mediaUrl || "",
        content: storyText || "",
        caption: storyCaption || "",
        isSeen: false,
        timeAgo: "Just now",
        backgroundColor: backgroundColor || "#72AF5B",
        musicTitle: musicTitle || null,
        privacy: validPrivacy,
        mediaType: storyMediaType,
        viewsCount: 0,
        overlays: overlays || null,
      },
    });
  } catch (err) {
    console.error("[Create Story Error]", err);
    res.status(500).json({ message: err.message || "Failed to create story." });
  }
});

// 15.3 Mark Story Viewed
app.post("/api/stories/:id/view", authenticateToken, async (req, res) => {
  try {
    const storyId = req.params.id;
    const viewerId = req.user.id;
    const pool = getPool();

    // Do not record the author viewing their own story
    const { rows: storyRows } = await pool.query(
      `SELECT user_id FROM stories WHERE id = $1`,
      [storyId]
    );
    if (storyRows.length > 0 && String(storyRows[0].user_id) === String(viewerId)) {
      return res.json({ message: "Author view not counted." });
    }

    await pool.query(
      `INSERT IGNORE INTO story_views (story_id, viewer_id, viewed_at)
       VALUES ($1, $2, NOW())`,
      [storyId, viewerId],
    );

    await pool
      .query(
        `UPDATE stories SET views_count = (SELECT COUNT(DISTINCT viewer_id) FROM story_views WHERE story_id = $1)
         WHERE id = $1`,
        [storyId],
      )
      .catch(() => {});

    res.json({ message: "Story view recorded." });
  } catch (err) {
    console.error("[Story View Error]", err);
    res.status(500).json({ message: err.message || "Failed to record story view." });
  }
});

// 15.4 Update Story Privacy
app.patch("/api/stories/:id/privacy", authenticateToken, async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user.id;
    const { privacy } = req.body;
    const validPrivacy = ["Public", "Friends", "Only me"].includes(privacy) ? privacy : "Public";
    const pool = getPool();

    const { rowCount } = await pool.query(
      `UPDATE stories SET privacy = $1 WHERE id = $2 AND user_id = $3`,
      [validPrivacy, storyId, userId],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Story not found or unauthorized." });
    }

    res.json({ message: "Story privacy updated successfully.", privacy: validPrivacy });
  } catch (err) {
    console.error("[Update Story Privacy Error]", err);
    res.status(500).json({ message: err.message || "Failed to update story privacy." });
  }
});

// 15.5 Get Story Viewers
app.get("/api/stories/:id/viewers", authenticateToken, async (req, res) => {
  try {
    const storyId = req.params.id;
    const currentUserId = req.user.id;
    const pool = getPool();

    // Verify user owns the story
    const { rows: storyRows } = await pool.query(
      `SELECT user_id FROM stories WHERE id = $1`,
      [storyId],
    );

    if (storyRows.length === 0) {
      return res.status(404).json({ message: "Story not found." });
    }

    if (String(storyRows[0].user_id) !== String(currentUserId)) {
      return res.json({
        viewers: [],
        count: 0,
        message: "Only the story author can view viewers.",
      });
    }

    const { rows: viewers } = await pool.query(
      `SELECT sv.viewer_id, sv.viewed_at,
              u.first_name, u.last_name, u.username, u.avatar_url, u.role
       FROM story_views sv
       JOIN users u ON sv.viewer_id = u.id
       WHERE sv.story_id = $1 AND sv.viewer_id != $2
       ORDER BY sv.viewed_at DESC`,
      [storyId, currentUserId],
    );

    const formattedViewers = viewers.map((v) => ({
      userId: String(v.viewer_id),
      name: `${v.first_name || ""} ${v.last_name || ""}`.trim() || v.username || "User",
      username: v.username || "",
      avatarUrl: v.avatar_url || "",
      role: v.role || "Farmer",
      viewedAt: formatTimeAgo(v.viewed_at),
    }));

    res.json({
      viewers: formattedViewers,
      count: formattedViewers.length,
    });
  } catch (err) {
    console.error("[Get Story Viewers Error]", err);
    res.status(500).json({ message: err.message || "Failed to fetch story viewers." });
  }
});

// 15.6 Delete Story
app.delete("/api/stories/:id", authenticateToken, async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user.id;
    const pool = getPool();

    const { rowCount } = await pool.query(
      `DELETE FROM stories WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')`,
      [storyId, userId, req.user.role || "farmer"],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Story not found or unauthorized." });
    }

    await pool.query("DELETE FROM story_views WHERE story_id = $1", [storyId]).catch(() => {});
    await pool.query("DELETE FROM story_reactions WHERE story_id = $1", [storyId]).catch(() => {});

    res.json({ message: "Story deleted successfully.", id: String(storyId) });
  } catch (err) {
    console.error("[Delete Story Error]", err);
    res.status(500).json({ message: err.message || "Failed to delete story." });
  }
});

// 15.7 React to Story
app.post("/api/stories/:id/react", authenticateToken, async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user.id;
    const { reactionType = "like" } = req.body;
    const pool = getPool();

    await pool.query(
      `INSERT INTO story_reactions (story_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       ON DUPLICATE KEY UPDATE reaction_type = $3`,
      [storyId, userId, reactionType],
    );

    res.json({ message: "Story reaction saved.", reaction: reactionType });
  } catch (err) {
    console.error("[Story Reaction Error]", err);
    res.status(500).json({ message: err.message || "Failed to save story reaction." });
  }
});

// -----------------------------------------------------------------------------
// DYNAMIC FEATURE ENDPOINTS: RSBSA, BLOCKED USERS, PRIVACY, REPORTS, ANNOUNCEMENTS, PRICES
// -----------------------------------------------------------------------------

// RSBSA 1. Get current user's RSBSA accreditation application
app.get("/api/farmers/me/verification", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT fp.*, u.full_name, u.first_name, u.last_name, u.is_verified 
       FROM users u 
       LEFT JOIN farmer_profiles fp ON fp.user_id = u.id 
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    if (!rows || rows.length === 0 || !rows[0].farm_name) {
      return res.json({ application: null });
    }

    const r = rows[0];
    res.json({
      application: {
        fullName: r.full_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Farmer",
        rsbsaNumber: r.rsbsa_number || r.farmer_code || "",
        farmName: r.farm_name || "",
        location: r.farm_location || "",
        crops: r.crops || "",
        documentUri: r.document_uri || r.certifications || "",
        status: r.verification_status || (r.is_verified ? "verified" : "unverified"),
        submittedAt: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
        verifiedAt: r.verification_status === "verified" ? new Date(r.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
      },
    });
  } catch (err) {
    console.error("[GET /api/farmers/me/verification Error]", err);
    res.status(500).json({ message: "Failed to load verification status" });
  }
});

// RSBSA 2. Submit new or update RSBSA verification application
app.post("/api/farmers/apply-verification", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { fullName, rsbsaNumber, farmName, location, crops, documentUri } = req.body;

    if (!rsbsaNumber || !farmName || !location || !crops) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }

    const farmerCode = `FAR-${Math.floor(1000 + Math.random() * 9000)}`;

    await pool.query(
      `INSERT INTO farmer_profiles (
         user_id, farmer_code, rsbsa_number, farm_name, crops, farm_location, document_uri, verification_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON DUPLICATE KEY UPDATE 
         rsbsa_number = VALUES(rsbsa_number),
         farm_name = VALUES(farm_name),
         crops = VALUES(crops),
         farm_location = VALUES(farm_location),
         document_uri = VALUES(document_uri),
         verification_status = 'pending',
         updated_at = NOW()`,
      [userId, farmerCode, rsbsaNumber, farmName, crops, location, documentUri || null]
    );

    // Record audit event in admin logs
    try {
      await pool.query(
        `INSERT INTO admin_activity_logs (action, detail, type, user, ip, status)
         VALUES ('RSBSA Application Submitted', $1, 'security', $2, '127.0.0.1', 'success')`,
        [`Farmer ${fullName || 'User'} (#${userId}) applied for PhilGAP accreditation with RSBSA #${rsbsaNumber}`, req.user.email || 'user@localfarm.com']
      );
    } catch (e) {}

    res.json({
      message: "RSBSA verification application submitted successfully.",
      application: {
        fullName: fullName || req.user.name,
        rsbsaNumber,
        farmName,
        location,
        crops,
        documentUri,
        status: "pending",
        submittedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      },
    });
  } catch (err) {
    console.error("[POST /api/farmers/apply-verification Error]", err);
    res.status(500).json({ message: "Failed to submit verification application" });
  }
});

// MAP 1. Get live registered farmer locations
app.get("/api/farmers/locations", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.first_name, u.last_name, u.username, u.avatar_url, u.is_verified,
              fp.farm_name, fp.crops, fp.farm_location, fp.verification_status
       FROM users u
       JOIN farmer_profiles fp ON fp.user_id = u.id
       WHERE fp.verification_status IN ('verified', 'pending')`
    );

    const locations = rows.map((r) => {
      const baseLat = 8.2250 + (((r.id * 17) % 30) - 15) * 0.0015;
      const baseLng = 124.2450 + (((r.id * 23) % 30) - 15) * 0.0015;
      return {
        id: `db-farmer-${r.id}`,
        latitude: parseFloat(baseLat.toFixed(4)),
        longitude: parseFloat(baseLng.toFixed(4)),
        title: r.farm_name || `${r.full_name || "Farmer"}'s Farm`,
        farmerName: r.full_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.username || "Producer",
        type: "Farm",
        produce: r.crops || "Fresh Farm Produce",
        priceRange: "₱45 - ₱95/kg",
        distance: `${(1.2 + (r.id % 5) * 0.4).toFixed(1)}km away • ${r.farm_location || "Iligan City"}`,
        rating: parseFloat((4.7 + (r.id % 3) * 0.1).toFixed(1)),
        description: `Accredited local producer cultivating ${r.crops || "fresh produce"} in ${r.farm_location || "local region"}. Verification status: ${r.verification_status}.`,
        imageUrl: r.avatar_url || "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=400&q=80",
      };
    });

    res.json({ locations, farmers: rows });
  } catch (err) {
    console.error("[GET /api/farmers/locations Error]", err);
    res.status(500).json({ message: "Failed to load farm locations" });
  }
});

// BLOCKED USERS 1. Get blocked users list
app.get("/api/users/blocked", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT bu.id as block_id, bu.created_at as blocked_at, u.id, u.full_name, u.first_name, u.last_name, u.username, u.avatar_url
       FROM blocked_users bu
       JOIN users u ON u.id = bu.blocked_user_id
       WHERE bu.user_id = $1
       ORDER BY bu.created_at DESC`,
      [userId]
    );

    const blockedUsers = rows.map((r) => ({
      id: String(r.id),
      name: r.full_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.username || "User",
      username: r.username || "",
      avatarUrl: r.avatar_url || "",
      blockedAt: formatRelativeTime(r.blocked_at),
    }));

    res.json({ blockedUsers });
  } catch (err) {
    console.error("[GET /api/users/blocked Error]", err);
    res.status(500).json({ message: "Failed to fetch blocked users" });
  }
});

// BLOCKED USERS 2. Block a user
app.post("/api/users/block", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { blockedUserId } = req.body;
    if (!blockedUserId || Number(blockedUserId) === Number(userId)) {
      return res.status(400).json({ message: "Invalid target user." });
    }
    await pool.query(
      `INSERT IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2)`,
      [userId, blockedUserId]
    );
    await pool.query(
      `UPDATE connections SET status = 'blocked' 
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [userId, blockedUserId]
    );
    res.json({ message: "User blocked successfully." });
  } catch (err) {
    console.error("[POST /api/users/block Error]", err);
    res.status(500).json({ message: "Failed to block user" });
  }
});

// BLOCKED USERS 3. Unblock a user
app.delete("/api/users/unblock/:blockedUserId", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { blockedUserId } = req.params;
    await pool.query(
      `DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2`,
      [userId, blockedUserId]
    );
    res.json({ message: "User unblocked successfully." });
  } catch (err) {
    console.error("[DELETE /api/users/unblock Error]", err);
    res.status(500).json({ message: "Failed to unblock user" });
  }
});

// PRIVACY 1. Get privacy settings
app.get("/api/user/privacy", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT * FROM user_privacy_settings WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.json({
        settings: {
          profileVisibility: "Public",
          postAudience: "Public",
          storyAudience: "Public",
          taggingPermission: "Everyone",
          connectionsListVisibility: "Public",
          pricingVisibility: "Public",
          preciseLocation: true,
          mapDiscovery: true,
          messagingScope: "everyone",
          showOnlineStatus: true,
        },
      });
    }

    const r = rows[0];
    res.json({
      settings: {
        profileVisibility: r.profile_visibility || "Public",
        postAudience: r.post_audience || "Public",
        storyAudience: r.story_audience || "Public",
        taggingPermission: r.tagging_permission || "Everyone",
        connectionsListVisibility: r.connections_list_visibility || "Public",
        pricingVisibility: r.pricing_visibility || "Public",
        preciseLocation: Boolean(r.precise_location),
        mapDiscovery: Boolean(r.map_discovery),
        messagingScope: r.messaging_scope || "everyone",
        showOnlineStatus: Boolean(r.show_online_status),
      },
    });
  } catch (err) {
    console.error("[GET /api/user/privacy Error]", err);
    res.status(500).json({ message: "Failed to load privacy settings" });
  }
});

// PRIVACY 2. Update privacy settings
app.put("/api/user/privacy", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const s = req.body;
    await pool.query(
      `INSERT INTO user_privacy_settings (
         user_id, profile_visibility, post_audience, story_audience, tagging_permission,
         connections_list_visibility, pricing_visibility, precise_location, map_discovery,
         messaging_scope, show_online_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON DUPLICATE KEY UPDATE
         profile_visibility = VALUES(profile_visibility),
         post_audience = VALUES(post_audience),
         story_audience = VALUES(story_audience),
         tagging_permission = VALUES(tagging_permission),
         connections_list_visibility = VALUES(connections_list_visibility),
         pricing_visibility = VALUES(pricing_visibility),
         precise_location = VALUES(precise_location),
         map_discovery = VALUES(map_discovery),
         messaging_scope = VALUES(messaging_scope),
         show_online_status = VALUES(show_online_status),
         updated_at = NOW()`,
      [
        userId,
        s.profileVisibility || "Public",
        s.postAudience || "Public",
        s.storyAudience || "Public",
        s.taggingPermission || "Everyone",
        s.connectionsListVisibility || "Public",
        s.pricingVisibility || "Public",
        s.preciseLocation !== undefined ? (s.preciseLocation ? 1 : 0) : 1,
        s.mapDiscovery !== undefined ? (s.mapDiscovery ? 1 : 0) : 1,
        s.messagingScope || "everyone",
        s.showOnlineStatus !== undefined ? (s.showOnlineStatus ? 1 : 0) : 1,
      ]
    );
    res.json({ message: "Privacy settings updated successfully." });
  } catch (err) {
    console.error("[PUT /api/user/privacy Error]", err);
    res.status(500).json({ message: "Failed to update privacy settings" });
  }
});

// REPORTS 1. Create a support dispute / violation report
app.post("/api/reports", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const reporterId = req.user.id;
    const { reason, statement, severity = "medium", reportedUserId, conversationId, attachmentUrl } = req.body;

    const reportCode = `RPT-${Math.floor(1000 + Math.random() * 9000)}`;
    const reporterName = req.user.name || req.user.email || "Local Farm User";

    let reportedUserName = "Unspecified User";
    if (reportedUserId) {
      const { rows: uRows } = await pool.query(`SELECT full_name, username FROM users WHERE id = $1`, [reportedUserId]);
      if (uRows.length > 0) reportedUserName = uRows[0].full_name || uRows[0].username || "User";
    }

    const dateReported = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    await pool.query(
      `INSERT INTO reports (
         report_code, reporter_id, reporter_name, reported_user_id, reported_user_name,
         report_type, reason, statement, date_reported, severity, status, conversation_id, attachment_url
       ) VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, $8, $9, 'pending', $10, $11)`,
      [
        reportCode, reporterId, reporterName, reportedUserId || null, reportedUserName,
        reason || "Community Dispute", statement || "", dateReported, severity,
        conversationId || null, attachmentUrl || null
      ]
    );

    res.json({
      message: "Ticket created successfully and escalated to admin moderation queue.",
      ticket: {
        id: reportCode,
        category: reason,
        subject: statement ? statement.split("\n")[0] : reason,
        description: statement,
        status: "Under Review",
        date: dateReported,
      },
    });
  } catch (err) {
    console.error("[POST /api/reports Error]", err);
    res.status(500).json({ message: "Failed to file report" });
  }
});

// REPORTS 2. Get my submitted reports / tickets
app.get("/api/reports/my-tickets", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const reporterId = req.user.id;
    const { rows } = await pool.query(
      `SELECT * FROM reports WHERE reporter_id = $1 ORDER BY created_at DESC`,
      [reporterId]
    );
    const tickets = rows.map((r) => ({
      id: r.report_code,
      category: r.reason,
      subject: r.statement ? r.statement.split("\n")[0] : r.reason,
      description: r.statement,
      status: r.status === "resolved" ? "Resolved" : r.status === "dismissed" ? "Rejected" : "Under Review",
      priority: r.severity === "high" || r.severity === "critical" ? "Urgent" : "Normal",
      date: r.date_reported || new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }));
    res.json({ tickets });
  } catch (err) {
    console.error("[GET /api/reports/my-tickets Error]", err);
    res.status(500).json({ message: "Failed to fetch user tickets" });
  }
});

// ANNOUNCEMENTS 1. Get active official announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM announcements 
       WHERE is_archived = 0 
       ORDER BY is_pinned DESC, created_at DESC 
       LIMIT 10`
    );
    const announcements = rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      content: r.content,
      category: r.category,
      priority: r.priority,
      targetAudience: r.target_audience,
      isPinned: Boolean(r.is_pinned),
      createdAt: r.created_at,
      author: r.author || "System Admin",
    }));
    res.json({ announcements });
  } catch (err) {
    console.error("[GET /api/announcements Error]", err);
    res.status(500).json({ message: "Failed to fetch announcements" });
  }
});

// COMMODITY PRICES 1. Get SRP benchmarks
app.get("/api/prices", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM commodity_prices ORDER BY category ASC, commodity_name ASC`
    );
    res.json({ commodities: rows, prices: rows });
  } catch (err) {
    console.error("[GET /api/prices Error]", err);
    res.status(500).json({ message: "Failed to fetch prices" });
  }
});

// =============================================================================
// HARVEST RESERVATIONS & DIGITAL PICKUP RECEIPTS API
// =============================================================================

// 1. Get user's reservations (as buyer, seller, or both)
app.get("/api/reservations/my-reservations", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const role = req.query.role || "all"; // 'buyer' | 'seller' | 'all'
    const status = req.query.status || "all";

    let filterClause = "(hr.buyer_id = $1 OR hr.seller_id = $1)";
    const params = [userId];

    if (role === "buyer") {
      filterClause = "hr.buyer_id = $1";
    } else if (role === "seller") {
      filterClause = "hr.seller_id = $1";
    }

    if (status && status !== "all") {
      params.push(status);
      filterClause += ` AND hr.status = $${params.length}`;
    }

    if (req.query.postId) {
      params.push(req.query.postId);
      filterClause += ` AND hr.post_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT 
        hr.*,
        buyer.full_name as buyer_name,
        buyer.username as buyer_username,
        buyer.email as buyer_email,
        buyer.phone_number as buyer_phone,
        buyer.avatar_url as buyer_avatar,
        seller.full_name as seller_name,
        seller.username as seller_username,
        seller.email as seller_email,
        seller.phone_number as seller_phone,
        seller.avatar_url as seller_avatar,
        fp.farm_name,
        fp.farmer_code
       FROM harvest_reservations hr
       LEFT JOIN users buyer ON hr.buyer_id = buyer.id
       LEFT JOIN users seller ON hr.seller_id = seller.id
       LEFT JOIN farmer_profiles fp ON hr.seller_id = fp.user_id
       WHERE ${filterClause}
       ORDER BY hr.created_at DESC`,
      params
    );

    res.json({ success: true, reservations: rows });
  } catch (err) {
    console.error("[GET /api/reservations/my-reservations Error]", err);
    res.status(500).json({ message: "Failed to fetch reservations." });
  }
});

// 2. Create pre-harvest reservation
app.post("/api/reservations", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const buyerId = req.user.id;
    const { postId, quantity, buyerNotes } = req.body;

    if (!postId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: "Valid post ID and quantity are required." });
    }

    // Verify post
    const { rows: postRows } = await pool.query(
      `SELECT p.*, u.full_name as seller_name, fp.farm_name 
       FROM posts p 
       LEFT JOIN users u ON p.user_id = u.id 
       LEFT JOIN farmer_profiles fp ON u.id = fp.user_id 
       WHERE p.id = $1`,
      [postId]
    );

    if (postRows.length === 0) {
      return res.status(404).json({ message: "Produce post not found." });
    }

    const post = postRows[0];
    const sellerId = post.user_id;

    if (buyerId === sellerId) {
      return res.status(400).json({ message: "You cannot reserve your own harvest post." });
    }

    const cropName = post.crop_name || post.content.split("\n")[0].substring(0, 50) || "Farm Fresh Produce";
    const unit = post.unit || "kg";
    const pricePerUnit = Number(post.price_per_unit) || 40.00;
    const reservedQty = Number(quantity);
    const totalEstAmount = reservedQty * pricePerUnit;
    const harvestDate = post.expected_harvest_date || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const pickupLoc = post.pickup_hub || post.location || "Bogo City Public Market Hub";

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reservationCode = `LF-RES-${randomSuffix}`;
    const qrToken = `QR_LF_${randomSuffix}_${Date.now()}`;

    const { rows: inserted } = await pool.query(
      `INSERT INTO harvest_reservations (
        reservation_code, post_id, seller_id, buyer_id, crop_name, quantity,
        unit, price_per_unit, total_estimated_amount, harvest_date, pickup_location,
        status, qr_token, buyer_notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, NOW())
      RETURNING *`,
      [
        reservationCode,
        postId,
        sellerId,
        buyerId,
        cropName,
        reservedQty,
        unit,
        pricePerUnit,
        totalEstAmount,
        harvestDate,
        pickupLoc,
        qrToken,
        buyerNotes || null,
      ]
    );

    const createdId = inserted[0]?.id;

    // Fetch full reservation record for complete client response
    let createdReservation = null;
    if (createdId) {
      try {
        const { rows: fetchedRows } = await pool.query(
          `SELECT hr.*, 
                  buyer.full_name as buyer_name,
                  buyer.username as buyer_username,
                  seller.full_name as seller_name,
                  seller.username as seller_username
           FROM harvest_reservations hr
           LEFT JOIN users buyer ON hr.buyer_id = buyer.id
           LEFT JOIN users seller ON hr.seller_id = seller.id
           WHERE hr.id = $1`,
          [createdId]
        );
        createdReservation = fetchedRows[0] || null;
      } catch (fetchErr) {
        console.warn("[Reservation Fetch Warning]", fetchErr.message);
      }
    }

    if (!createdReservation) {
      createdReservation = {
        id: createdId,
        reservation_code: reservationCode,
        post_id: postId,
        seller_id: sellerId,
        buyer_id: buyerId,
        crop_name: cropName,
        quantity: reservedQty,
        unit,
        price_per_unit: pricePerUnit,
        total_estimated_amount: totalEstAmount,
        harvest_date: harvestDate,
        pickup_location: pickupLoc,
        status: "pending",
        qr_token: qrToken,
        buyer_notes: buyerNotes || null,
        created_at: new Date().toISOString(),
      };
    }

    // Update reserved_quantity on post
    try {
      await pool.query(
        `UPDATE posts 
         SET reserved_quantity = COALESCE(reserved_quantity, 0) + $1 
         WHERE id = $2`,
        [reservedQty, postId]
      );
    } catch {}

    // Dispatch notification to seller
    try {
      const { rows: buyerRows } = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [buyerId]);
      const buyerName = buyerRows[0]?.full_name || "A buyer";
      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, is_read, created_at)
         VALUES ($1, $2, 'order', 'New Harvest Reservation', $3, $4, 0, NOW())`,
        [
          sellerId,
          buyerId,
          `${buyerName} placed an advance reservation of ${reservedQty} ${unit} for ${cropName} (${reservationCode}).`,
          createdId || null,
        ]
      );
    } catch (notifErr) {
      console.warn("[Reservation Notif Warning]", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Harvest reservation created successfully!",
      reservation: createdReservation
    });
  } catch (err) {
    console.error("[POST /api/reservations Error]", err);
    res.status(500).json({ message: "Failed to create harvest reservation." });
  }
});

// 3. Verify pickup & weigh-in (Farmer or Hub Officer)
app.post("/api/reservations/verify-pickup", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const verifierId = req.user.id;
    const { qrToken, reservationCode, actualWeighedQuantity, sellerNotes } = req.body;

    if (!qrToken && !reservationCode) {
      return res.status(400).json({ message: "QR token or reservation code is required." });
    }

    let searchSql = "qr_token = $1";
    let searchParam = qrToken;
    if (!qrToken && reservationCode) {
      searchSql = "reservation_code = $1";
      searchParam = reservationCode.trim().toUpperCase();
    }

    const { rows } = await pool.query(
      `SELECT hr.*, buyer.full_name as buyer_name, seller.full_name as seller_name
       FROM harvest_reservations hr
       LEFT JOIN users buyer ON hr.buyer_id = buyer.id
       LEFT JOIN users seller ON hr.seller_id = seller.id
       WHERE ${searchSql}`,
      [searchParam]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invalid or unrecognized reservation code/QR token." });
    }

    const reservation = rows[0];

    if (reservation.status === "completed") {
      return res.status(400).json({ 
        message: `This reservation (${reservation.reservation_code}) was already completed on ${new Date(reservation.completed_at).toLocaleString()}.`,
        alreadyCompleted: true,
        reservation 
      });
    }

    const weighed = Number(actualWeighedQuantity) > 0 ? Number(actualWeighedQuantity) : Number(reservation.quantity);
    const finalAmount = weighed * Number(reservation.price_per_unit);

    await pool.query(
      `UPDATE harvest_reservations
       SET status = 'completed',
           actual_weighed_quantity = $1,
           final_settled_amount = $2,
           seller_notes = COALESCE($3, seller_notes),
           weighed_at = NOW(),
           completed_at = NOW()
       WHERE id = $4`,
      [weighed, finalAmount, sellerNotes || null, reservation.id]
    );

    const { rows: refreshedWeighed } = await pool.query(
      `SELECT hr.*, buyer.full_name as buyer_name, seller.full_name as seller_name
       FROM harvest_reservations hr
       LEFT JOIN users buyer ON hr.buyer_id = buyer.id
       LEFT JOIN users seller ON hr.seller_id = seller.id
       WHERE hr.id = $1`,
      [reservation.id]
    );

    const updatedReceipt = refreshedWeighed[0] || {
      ...reservation,
      status: 'completed',
      actual_weighed_quantity: weighed,
      final_settled_amount: finalAmount,
      seller_notes: sellerNotes || reservation.seller_notes,
      completed_at: new Date().toISOString(),
    };

    // Notify buyer that pickup is stamped
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, is_read, created_at)
         VALUES ($1, $2, 'order', 'Pickup & Weigh-in Verified', $3, $4, 0, NOW())`,
        [
          reservation.buyer_id,
          verifierId,
          `Your order for ${reservation.crop_name} (${reservation.reservation_code}) has been weighed (${weighed} ${reservation.unit}) and marked Completed at ₱${finalAmount.toFixed(2)}.`,
          reservation.id,
        ]
      );
    } catch {}

    res.json({
      success: true,
      message: `Pickup verified! Weighed: ${weighed} ${reservation.unit} • Final: ₱${finalAmount.toFixed(2)}`,
      receipt: updatedReceipt
    });
  } catch (err) {
    console.error("[POST /api/reservations/verify-pickup Error]", err);
    res.status(500).json({ message: "Failed to verify reservation pickup." });
  }
});

// 4. Update reservation status (Confirm, Mark Ready, Cancel)
app.patch("/api/reservations/:id/status", authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.id;
    const reservationId = req.params.id;
    const { status, sellerNotes } = req.body;

    const validStatuses = ["confirmed", "ready_for_pickup", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status update." });
    }

    const { rows: current } = await pool.query(
      `SELECT * FROM harvest_reservations WHERE id = $1`,
      [reservationId]
    );

    if (current.length === 0) {
      return res.status(404).json({ message: "Reservation not found." });
    }

    const reservation = current[0];
    if (reservation.buyer_id !== userId && reservation.seller_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized to update this reservation." });
    }

    await pool.query(
      `UPDATE harvest_reservations
       SET status = $1,
           seller_notes = COALESCE($2, seller_notes)
       WHERE id = $3`,
      [status, sellerNotes || null, reservationId]
    );

    const { rows: refreshedRows } = await pool.query(
      `SELECT hr.*, buyer.full_name as buyer_name, seller.full_name as seller_name
       FROM harvest_reservations hr
       LEFT JOIN users buyer ON hr.buyer_id = buyer.id
       LEFT JOIN users seller ON hr.seller_id = seller.id
       WHERE hr.id = $1`,
      [reservationId]
    );

    const updatedRes = refreshedRows[0] || {
      ...reservation,
      status,
      seller_notes: sellerNotes || reservation.seller_notes,
    };

    // Notify counterpart
    const targetUserId = userId === reservation.seller_id ? reservation.buyer_id : reservation.seller_id;
    let notifTitle = "Reservation Status Updated";
    let notifMsg = `Reservation ${reservation.reservation_code} status updated to: ${status.replace(/_/g, " ")}.`;

    if (status === "ready_for_pickup") {
      notifTitle = "Harvest Ready for Pickup! 🌾";
      notifMsg = `Good news! Your pre-harvest batch of ${reservation.crop_name} is ready for pickup at ${reservation.pickup_location}.`;
    }

    try {
      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, is_read, created_at)
         VALUES ($1, $2, 'order', $3, $4, $5, 0, NOW())`,
        [targetUserId, userId, notifTitle, notifMsg, reservation.id]
      );
    } catch {}

    res.json({
      success: true,
      message: `Reservation status updated to ${status}.`,
      reservation: updatedRes
    });
  } catch (err) {
    console.error("[PATCH /api/reservations/:id/status Error]", err);
    res.status(500).json({ message: "Failed to update reservation status." });
  }
});

// Start server
initDB().then(() => {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`=======================================================`);
    console.log(`Local Farm API Server running on port ${PORT}`);
    console.log(`Database: Connected to MySQL localfarm on 127.0.0.1:3306`);
    console.log(`Local:    http://localhost:${PORT}/api`);
    console.log(`Health:   http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n[Server Error] Port ${PORT} is already in use by another running process.`);
      console.error(`To free port ${PORT}, run: npm run server:kill`);
      console.error(`Or run: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
      process.exit(1);
    } else {
      console.error("[Server Error]", err);
      process.exit(1);
    }
  });
});


