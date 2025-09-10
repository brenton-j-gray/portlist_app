import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const profileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String },
    username: { type: String }, // original case for display
    usernameLower: { type: String, unique: true, sparse: true, index: true }, // normalized for uniqueness
    bio: { type: String },
  },
  { timestamps: true }
);

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const doc = await Profile.findOne({ userId }).lean();
  res.json({ profile: doc || null });
});

router.put('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { fullName, username, bio } = req.body || {};
  try {
    // Build update operators to correctly clear fields when empty
    const $set = { userId };
    const $unset = {};

    if (typeof fullName !== 'undefined') {
      if (fullName && String(fullName).trim()) {
        $set.fullName = String(fullName).trim();
      } else {
        $unset.fullName = '';
      }
    }
    if (typeof bio !== 'undefined') {
      if (bio && String(bio).trim()) {
        $set.bio = String(bio).trim();
      } else {
        $unset.bio = '';
      }
    }
    if (typeof username !== 'undefined') {
      if (username) {
        const uname = String(username).trim();
        if (!/^[a-zA-Z0-9_\.\-]{3,30}$/.test(uname)) {
          return res.status(400).json({ error: 'invalid_username' });
        }
        const unameLower = uname.toLowerCase();
        const exists = await Profile.findOne({ usernameLower: unameLower, userId: { $ne: userId } }).lean();
        if (exists) return res.status(409).json({ error: 'username_taken' });
        $set.username = uname;
        $set.usernameLower = unameLower;
      } else {
        // Clearing the username
        $unset.username = '';
        $unset.usernameLower = '';
      }
    }
    const doc = await Profile.findOneAndUpdate(
      { userId },
      { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) },
      { upsert: true, new: true }
    ).lean();
    res.json({ profile: doc });
  } catch (e) {
    console.error('profile_update_error', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
