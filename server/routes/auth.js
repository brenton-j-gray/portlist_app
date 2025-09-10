import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { authenticator } from 'otplib';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  twoFactorEnabled: { type: Boolean, default: false },
  totpSecret: { type: String },
  totpTempSecret: { type: String },
  backupCodes: { type: [String], default: [] }, // store hashed codes
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Ensure Profile model is available (reuse if already registered)
const Profile = mongoose.models.Profile || mongoose.model('Profile', new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String },
    username: { type: String },
    usernameLower: { type: String, unique: true, sparse: true, index: true },
    bio: { type: String },
  },
  { timestamps: true }
));

function signToken(user) {
  const payload = { sub: user._id.toString(), email: user.email };
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    // If client provided a username at registration, ensure it's unique now to reserve it
    if (username) {
      const uname = String(username).trim();
      if (!/^[a-zA-Z0-9_\.\-]{3,30}$/.test(uname)) {
        return res.status(400).json({ error: 'invalid_username' });
      }
      const exists = await Profile.findOne({ usernameLower: uname.toLowerCase() }).lean();
      if (exists) return res.status(409).json({ error: 'username_taken' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) return res.status(409).json({ error: 'email already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), passwordHash });
    // Create initial profile and reserve username if provided
  if (username) {
      try {
        await Profile.findOneAndUpdate(
          { userId: user._id.toString() },
      { $set: { userId: user._id.toString(), username: String(username).trim(), usernameLower: String(username).trim().toLowerCase() } },
          { upsert: true, new: true }
        );
      } catch (e) {
        // Handle unique index race
        if (e && e.code === 11000) return res.status(409).json({ error: 'username_taken' });
        throw e;
      }
    }
    const token = signToken(user);
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, totp } = req.body || {};
  console.log('[auth/login] incoming', { email, hasPassword: !!password, hasTotp: !!totp });
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    if (user.twoFactorEnabled) {
      if (totp && user.totpSecret && authenticator.check(String(totp), user.totpSecret)) {
        const token = signToken(user);
        return res.json({ token });
      }
      return res.json({ mfaRequired: true });
    }
    const token = signToken(user);
  console.log('[auth/login] success', { email });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

export default router;

// Authenticated account management
router.put('/email', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail, password } = req.body || {};
    if (!newEmail || !password) return res.status(400).json({ error: 'newEmail and password required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'not_found' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const emailLower = String(newEmail).toLowerCase();
    const exists = await User.findOne({ email: emailLower, _id: { $ne: userId } }).lean();
    if (exists) return res.status(409).json({ error: 'email_taken' });
    user.email = emailLower;
    await user.save();
    const token = signToken(user);
    res.json({ token });
  } catch (e) {
    console.error('change_email_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.put('/password', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'weak_password' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'not_found' });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    user.passwordHash = await bcrypt.hash(String(newPassword), 12);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    console.error('change_password_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// 2FA: status
router.get('/2fa/status', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ enabled: !!user.twoFactorEnabled });
});

// 2FA: start setup (generate temp secret and otpauth URI)
router.get('/2fa/setup', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    const secret = authenticator.generateSecret();
    user.totpTempSecret = secret;
    await user.save();
  const otpauthUri = authenticator.keyuri(user.email, 'Portlist', secret);
    res.json({ secret, otpauthUri });
  } catch (e) {
    console.error('2fa_setup_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// 2FA: verify setup
router.post('/2fa/verify-setup', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code_required' });
    const user = await User.findById(req.user.id);
    if (!user || !user.totpTempSecret) return res.status(400).json({ error: 'no_pending_setup' });
    const ok = authenticator.check(String(code), user.totpTempSecret);
    if (!ok) return res.status(401).json({ error: 'invalid_code' });
    // finalize setup
    user.totpSecret = user.totpTempSecret;
    user.totpTempSecret = undefined;
    user.twoFactorEnabled = true;
    // generate backup codes (store hashed, return plain once)
    const plainCodes = Array.from({ length: 8 }).map(() => crypto.randomBytes(4).toString('hex'));
    const hashed = await Promise.all(plainCodes.map(c => bcrypt.hash(c, 10)));
    user.backupCodes = hashed;
    await user.save();
    res.json({ enabled: true, backupCodes: plainCodes });
  } catch (e) {
    console.error('2fa_verify_setup_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// 2FA: disable
router.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const { password } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    if (!password) return res.status(400).json({ error: 'password_required' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    user.twoFactorEnabled = false;
    user.totpSecret = undefined;
    user.totpTempSecret = undefined;
    user.backupCodes = [];
    await user.save();
    res.json({ enabled: false });
  } catch (e) {
    console.error('2fa_disable_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});
