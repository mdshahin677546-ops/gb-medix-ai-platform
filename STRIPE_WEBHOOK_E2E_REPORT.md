# Stripe Webhook E2E Test Report

Date: 2026-07-10

## Scope

This report covers Stripe webhook E2E coverage using direct route handler invocation.

The test does not start `next dev`, does not start `next start`, does not require a local HTTP port, does not enable Stripe live mode, and does not modify production environment variables.

## Test File

`tests/stripe-webhook-e2e.test.mjs`

The test invokes:

`app/api/webhooks/stripe/route.ts`

through an in-process signed `Request` object.

## Environment Requirements

The test reads these variables from the process environment:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`

Rules:

- `STRIPE_SECRET_KEY` must be a Stripe test key.
- If `STRIPE_WEBHOOK_SECRET` is not present, the test supplies a local-only `whsec_local_test_secret`.
- No secret values are printed.
- If `STRIPE_SECRET_KEY` or `DATABASE_URL` is missing, the Node test is skipped instead of failing the full suite.

## Event Coverage

The route handler direct invocation test covers:

- `checkout.session.completed`
- `charge.refunded`
- `charge.dispute.created`
- `checkout.session.expired`
- `payment_intent.payment_failed`

For each event, the test signs the payload with:

`stripe.webhooks.generateTestHeaderString()`

and passes the signature in the `stripe-signature` header.

## Expected Results

| Event | Expected Payment State | Expected Entitlement State |
| --- | --- | --- |
| `checkout.session.completed` | `paid` | `active` |
| `charge.refunded` | `refunded` | `revoked` |
| `charge.dispute.created` | `disputed` | `revoked` |
| `checkout.session.expired` | `expired` | no entitlement |
| `payment_intent.payment_failed` | `failed` | no entitlement |

## Verified Result From Direct Run

The direct route handler test previously passed with:

- Signature accepted for all five event types.
- Completed checkout granted the scoped Premium entitlement.
- Refund revoked the scoped Premium entitlement.
- Dispute revoked the scoped Premium entitlement.
- Expired checkout did not grant entitlement.
- Failed payment intent did not grant entitlement.
- Test data cleanup removed the generated `stripe_loop_` user.

## Cleanup

The test deletes all test data linked to users whose email contains:

`stripe_loop_`

Cleanup includes:

- Product recommendations
- Entitlements
- Payment records
- AI reports
- TCM records
- Email verification rows
- AI processing consent rows
- Test users

## Remaining Risks

- This validates webhook route logic and database state transitions, not Stripe Dashboard delivery to the deployed Vercel URL.
- Production still requires a real `STRIPE_WEBHOOK_SECRET` configured in Vercel before live webhook delivery can be trusted.
- This uses Stripe test mode and synthetic signed event payloads; it does not perform a live payment.

## Conclusion

STRIPE_WEBHOOK_E2E_READY

The committed test adds repeatable Stripe webhook E2E coverage for the commercial loop without requiring a local Next.js server.
