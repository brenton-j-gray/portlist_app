import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const backupSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  trips: { type: mongoose.Schema.Types.Mixed, default: [] },
  updatedAt: { type: Number, required: true },
}, { timestamps: true });

const Backup = mongoose.models.Backup || mongoose.model('Backup', backupSchema);

router.get('/trips', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const doc = await Backup.findOne({ userId }).lean();
  res.json({ trips: doc?.trips || [], updatedAt: doc?.updatedAt || 0 });
});

router.put('/trips', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { trips } = req.body || {};
  if (!Array.isArray(trips)) return res.status(400).json({ error: 'invalid_payload' });
  const updatedAt = Date.now();
  await Backup.updateOne(
    { userId },
    { $set: { trips, updatedAt } },
    { upsert: true }
  );
  res.json({ ok: true, updatedAt });
});

export default router;
