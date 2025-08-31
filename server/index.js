import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import routeRouter from './routes/route.js';
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
app.use('/profile', profileRouter);
app.use('/route', routeRouter);

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Missing MONGO_URI env');
  process.exit(1);
}

await mongoose.connect(MONGO_URI, { dbName: process.env.DB_NAME || 'portlist' });

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Auth server listening on :${port}`));
