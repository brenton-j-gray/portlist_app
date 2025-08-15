import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import authRouter from './routes/auth.js';
import syncRouter from './routes/sync.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/sync', syncRouter);

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Missing MONGO_URI env');
  process.exit(1);
}

await mongoose.connect(MONGO_URI, { dbName: process.env.DB_NAME || 'cjp' });

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Auth server listening on :${port}`));
