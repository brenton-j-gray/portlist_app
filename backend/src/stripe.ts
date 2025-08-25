import Stripe from 'stripe';

const apiVersion = (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined) || '2024-06-20';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set – donation endpoint will return mock data');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })
  : (null as unknown as Stripe); // when null we operate in mock mode

export interface PaymentSheetParamsResponse {
  paymentIntentClientSecret: string;
  customerId?: string;
  customerEphemeralKeySecret?: string;
}

export async function createPaymentSheetParams(amountCents: number, currency: string, email?: string): Promise<PaymentSheetParamsResponse> {
  if (!stripe) {
    // Mock response (DO NOT USE IN PROD) – matches shape for the app’s placeholder flow.
    return { paymentIntentClientSecret: 'pi_mock_client_secret' };
  }

  if (amountCents < 100) {
    throw new Error('Minimum amount is 100 (e.g. $1.00)');
  }

  // In a real system you might look up or create a customer by hashed email.
  let customerId: string | undefined;
  if (email) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: { source: 'cjp_donation', email: email || '' }
  });

  let customerEphemeralKeySecret: string | undefined;
  if (customerId) {
  const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion });
    customerEphemeralKeySecret = ephemeralKey.secret;
  }

  return {
    paymentIntentClientSecret: paymentIntent.client_secret!,
    customerId,
    customerEphemeralKeySecret
  };
}
