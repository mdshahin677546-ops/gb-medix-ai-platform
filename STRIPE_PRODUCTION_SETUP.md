# Stripe Production Setup

## 1. Product

Create a Stripe product:

- Name: `Premium AI Health Management Report`
- Internal SKU: `premium_report`
- Description: Premium AI health management report unlocked for one completed assessment.

The application sends line item data dynamically today. Keep the Stripe dashboard product aligned with the app naming for finance and support workflows.

## 2. Price

Current application amount:

- USD `9.99`
- `amountCents = 999`
- One-time payment.

If using Stripe dashboard Price IDs later, add a `STRIPE_PREMIUM_REPORT_PRICE_ID` variable and update checkout code in a future sprint. Sprint 1B currently uses `price_data` at checkout creation time.

## 3. Required Environment Variables

```env
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_APP_URL="https://your-production-domain.example"
```

Never reuse test mode keys in production.

## 4. Webhook Endpoint

Create production webhook endpoint:

```text
POST https://your-production-domain.example/api/webhooks/stripe
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Copy the signing secret into:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## 5. Payment Flow

Expected happy path:

1. User completes free assessment.
2. User clicks Premium unlock.
3. App creates `PaymentRecord` with:
   - `product = premium_report`
   - `resourceType = assessment`
   - `resourceId = assessmentId`
4. Stripe Checkout completes.
5. Stripe sends `checkout.session.completed`.
6. Webhook marks payment as paid.
7. Webhook grants resource-scoped Entitlement.
8. User generates Premium report.

Refund/dispute path:

1. Stripe sends `charge.refunded` or `charge.dispute.created`.
2. App updates `PaymentRecord.status`.
3. App revokes Entitlement tied to the payment.
4. Premium report access is locked.

## 6. Testing Flow

Before production launch, run in Stripe test mode against staging:

```bash
stripe listen --forward-to https://staging.example.com/api/webhooks/stripe
```

Test cases:

- Successful checkout grants entitlement.
- Free user cannot generate Premium without payment.
- Repeated Premium generation returns the same report.
- Refund revokes entitlement.
- Expired checkout does not grant entitlement.
- Failed payment intent does not grant entitlement.
- Dispute revokes entitlement.

Local mock test:

```bash
npm run test:commercial
```

## 7. Operational Checks

- Monitor webhook delivery failures in Stripe Dashboard.
- Alert on repeated `payment_intent.payment_failed`.
- Alert if paid PaymentRecords do not have matching active Entitlements.
- Alert if refunded/disputed PaymentRecords retain active Entitlements.

## 8. Known Limitations

- Sprint 1B does not use Stripe dashboard Price IDs.
- Sprint 1B does not implement subscriptions.
- Alipay is separate redirect configuration and is not covered by Stripe webhooks.
