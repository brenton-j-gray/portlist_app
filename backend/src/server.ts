import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import donationsRouter from './routes/donations.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req: express.Request, res: express.Response) => res.json({ ok: true, ts: Date.now() }));
app.use('/donations', donationsRouter);

const port = Number(process.env.PORT || 4001);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
