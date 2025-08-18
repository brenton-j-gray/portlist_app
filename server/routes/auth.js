import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const router = express.Router();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
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
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const token = signToken(user);
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
