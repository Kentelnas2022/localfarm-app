const crypto = require("crypto");

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Generate a cryptographically random Base32 secret key for TOTP (RFC 6238)
 * @param {number} length - Number of bytes of randomness (20 bytes = 160 bits)
 * @returns {string} Base32 encoded secret (32 chars)
 */
function generateBase32Secret(length = 20) {
  const bytes = crypto.randomBytes(length);
  let base32 = "";
  for (let i = 0; i < bytes.length; i++) {
    base32 += BASE32_CHARS[bytes[i] % 32];
  }
  return base32;
}

/**
 * Decode a Base32 string to Buffer
 * @param {string} base32
 * @returns {Buffer}
 */
function base32Decode(base32) {
  const clean = String(base32).toUpperCase().replace(/[\s-]/g, "");
  let bits = "";
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Calculate TOTP 6-digit code for a given secret and time offset
 * @param {string} secret - Base32 secret key
 * @param {number} timeStepOffset - Offset in 30s steps (e.g. -1, 0, +1)
 * @returns {string} 6-digit OTP string
 */
function getTotpToken(secret, timeStepOffset = 0) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;

  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

/**
 * Verify a TOTP 6-digit code against a secret key, with 1 step window tolerance
 * @param {string} token - 6-digit code entered by user
 * @param {string} secret - User's Base32 secret key
 * @returns {boolean}
 */
function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  const cleanToken = String(token).trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  // Allow clock drift of +/- 30 seconds
  for (const offset of [-1, 0, 1]) {
    if (getTotpToken(secret, offset) === cleanToken) {
      return true;
    }
  }
  return false;
}

module.exports = {
  generateBase32Secret,
  verifyTotpToken,
  getTotpToken,
};
