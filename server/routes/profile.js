import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const profileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String },
    username: { type: String, unique: true, sparse: true, index: true },
    bio: { type: String },
  },
  { timestamps: true }
);

const Profile = mongoose.model('Profile', profileSchema);

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const doc = await Profile.findOne({ userId }).lean();
  res.json({ profile: doc || null });
});

router.put('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { fullName, username, bio } = req.body || {};
  try {
    if (username) {
      const exists = await Profile.findOne({ username, userId: { $ne: userId } }).lean();
      if (exists) return res.status(409).json({ error: 'username_taken' });
    }
    const update = { fullName: fullName || undefined, username: username || undefined, bio: bio || undefined };
    const doc = await Profile.findOneAndUpdate(
      { userId },
      { $set: { userId, ...update } },
      { upsert: true, new: true }
    ).lean();
    res.json({ profile: doc });
  } catch (e) {
    console.error('profile_update_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
