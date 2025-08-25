# Portlist Backend (Sample)

This optional sample Express + Stripe backend powers the donation PaymentSheet flow in the mobile app.

## Features
* POST `/donations/create-payment-sheet` – returns PaymentSheet initialization parameters
* Mock mode if `STRIPE_SECRET_KEY` is not set (returns a placeholder client secret)
* Ephemeral key + customer creation when an email is provided

## Endpoints
`GET /health` – simple health probe.

`POST /donations/create-payment-sheet`
Request JSON body:
```
{ "amountCents": 500, "currency": "usd", "email": "you@example.com" }
```
Response (success):
```
{
  "paymentIntentClientSecret": "pi_..._secret_...",
  "customerId": "cus_...",           // only if email passed
  "customerEphemeralKeySecret": "ek_test_..." // only if email passed
}
```

## Setup
1. Copy `.env.example` to `.env` and fill in your Stripe secret key:
```
cp .env.example .env
```
2. Install dependencies:
```
cd backend
npm install
```
3. Run in dev (auto‑reload):
```
npm run dev
```
4. The server listens on `http://localhost:4001` by default.

## Environment Variables
`STRIPE_SECRET_KEY` – Required for real charges. Without it the server returns mock data (NOT FOR PRODUCTION).

`STRIPE_WEBHOOK_SECRET` – Placeholder for future webhook validation (not used yet).

`PORT` – Server port (default 4001).

`STRIPE_API_VERSION` – Optional explicit Stripe API version (defaults to 2024-06-20).

## Mobile App Integration
Set `EXPO_PUBLIC_STRIPE_BACKEND` to your backend base URL (e.g. `http://192.168.1.10:4001` on LAN) and `EXPO_PUBLIC_STRIPE_PK` to your publishable key. Rebuild / restart the Expo app so env vars propagate.

Donation screen calls:
```
POST {BACKEND_URL}/donations/create-payment-sheet
```

## Production Notes
* Replace mock customer creation with lookup by hashed email (privacy) or authenticated user id.
* Persist customers and donation records in a database.
* Implement a webhook handler for `payment_intent.succeeded` to verify and record successful donations.
* Remove mock fallback – enforce presence of `STRIPE_SECRET_KEY`.
* Consider rate limiting and basic auth / API key if exposing publicly.

## License
Sample code provided under MIT – adapt freely.
