# GB Medix AI Analytics Event Plan

## Goal

After launch, the team must quickly see where users drop off in the first commercial funnel:

```text
Landing visit
  ↓
Start assessment
  ↓
Complete assessment
  ↓
View free report
  ↓
Click Premium
  ↓
Start checkout
  ↓
Payment success
  ↓
View Premium report
```

## Funnel Events

| Funnel Step | Event Name | Trigger | Key Properties |
| --- | --- | --- | --- |
| Landing visit | `landing_view` | User visits `/` | `path`, `lang`, `utm_source`, `utm_campaign`, `device_type` |
| Start assessment | `assessment_start` | User opens or starts `/[lang]/tcm-check` | `user_id`, `lang`, `entry_path`, `assessment_type` |
| Complete assessment | `assessment_complete` | `/api/tcm` successfully creates assessment/free report | `user_id`, `assessment_id`, `report_id`, `lang`, `duration_seconds` |
| View free report | `free_report_view` | User views `free_health_report` page | `user_id`, `report_id`, `assessment_id`, `health_score`, `constitution` |
| Click Premium | `premium_view` | User sees/clicks Premium unlock CTA | `user_id`, `assessment_id`, `report_id`, `source` |
| Start checkout | `checkout_start` | `/api/checkout` creates Stripe session | `user_id`, `assessment_id`, `payment_id`, `product_id`, `amount_cents`, `currency` |
| Payment success | `payment_success` | Stripe `checkout.session.completed` marks payment paid | `user_id`, `assessment_id`, `payment_id`, `product_id`, `amount_cents`, `currency`, `stripe_session_id` |
| Report unlocked | `report_unlocked` | Entitlement granted or Premium report becomes accessible | `user_id`, `assessment_id`, `payment_id`, `entitlement_id`, `product_id` |
| Refund | `refund` | Stripe refund/dispute revokes entitlement | `user_id`, `assessment_id`, `payment_id`, `product_id`, `reason`, `stripe_event_type` |

## Required Event Names

- `landing_view`
- `assessment_start`
- `assessment_complete`
- `free_report_view`
- `premium_view`
- `checkout_start`
- `payment_success`
- `report_unlocked`
- `refund`

## Recommended Identity Rules

- Use anonymous ID before login.
- Attach `user_id` after authentication.
- Preserve UTM parameters from Landing through checkout where possible.
- Never send raw symptoms, uploaded report contents, AI report text, email verification tokens, Stripe secrets, or auth cookies to analytics.

## Drop-off Metrics

Track conversion rates:

- `landing_view → assessment_start`
- `assessment_start → assessment_complete`
- `assessment_complete → free_report_view`
- `free_report_view → premium_view`
- `premium_view → checkout_start`
- `checkout_start → payment_success`
- `payment_success → report_unlocked`

Track negative events:

- `checkout_start` without `payment_success`.
- `payment_success` without `report_unlocked`.
- `refund` after `report_unlocked`.

## Dashboard Requirements

Launch dashboard should show:

- Daily funnel conversion.
- Drop-off by step.
- Conversion by language.
- Conversion by device type.
- Checkout success rate.
- Refund count and refund rate.
- Premium unlock delay after payment.
- AI assessment completion rate.

## Implementation Notes

This document is an event plan only. Instrumentation should be implemented in a future approved task without changing medical, payment, or entitlement behavior.
