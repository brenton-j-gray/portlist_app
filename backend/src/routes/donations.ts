import { Router, type Request, type Response } from 'express';
import { createPaymentSheetParams } from '../stripe.js';

const router = Router();

interface Body {
  amountCents?: number;
  currency?: string;
  email?: string;
}

router.post('/create-payment-sheet', async (req: Request, res: Response) => {
  try {
    const { amountCents, currency, email } = req.body as Body;
    if (typeof amountCents !== 'number') return res.status(400).json({ error: 'amountCents required' });
    if (!currency) return res.status(400).json({ error: 'currency required' });
    const params = await createPaymentSheetParams(amountCents, currency.toLowerCase(), email);
    res.json(params);
  } catch (e: any) {
    console.error('create-payment-sheet error', e);
    res.status(500).json({ error: e?.message || 'internal_error' });
  }
});

export default router;
