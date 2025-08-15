import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const router = express.Router();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

function signToken(user) {
  const payload = { sub: user._id.toString(), email: user.email };
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) return res.status(409).json({ error: 'email already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), passwordHash });
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
