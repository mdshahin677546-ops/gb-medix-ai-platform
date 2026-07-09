# First User Journey

## Goal

Map the first user experience from website visit to Premium report unlock, with clear expectations for what users see and what each step should accomplish.

## Journey Overview

```text
Visit website
  ↓
Register
  ↓
Email verification
  ↓
Health assessment
  ↓
Free report
  ↓
Premium upgrade
  ↓
Payment
  ↓
Full report
```

## 1. Visit Website

User sees:

- Consumer Landing page.
- Hero headline for AI Health Assessment.
- Short explanation of free result and Premium report.
- Primary CTA: `Start Free Health Assessment`.
- Friendly wellness disclaimer.

User goal:

- Understand what GB Medix AI does.
- Feel safe enough to start the free assessment.

Business goal:

- Convert `landing_view` into `assessment_start`.

Success signal:

- User clicks assessment CTA.

## 2. Register

User sees:

- Account sign-in or registration page.
- Email input.
- Clear message that an account protects reports and payment access.

User goal:

- Create an account without confusion.

Business goal:

- Associate assessment, report, payment, and entitlement with one user.

Success signal:

- User account is created.

## 3. Email Verification

User sees:

- Message that verification is required before AI assessment.
- Email verification link or token flow.
- Confirmation after verification.

User goal:

- Verify quickly and return to the assessment.

Business goal:

- Reduce abuse and protect AI cost.

Success signal:

- User status becomes `active`.

Risk:

- Current production email provider must be confirmed before public launch.

## 4. Health Assessment

User sees:

- Guided intake form.
- Questions about sleep, stress, diet, energy, activity, digestion, and body sensations.
- Optional upload area.
- CTA: `Analyze My Body Type` or `Start Assessment`.

User goal:

- Complete the assessment with minimal friction.

Business goal:

- Convert `assessment_start` into `assessment_complete`.

Success signal:

- Assessment is saved.
- Free report is generated.

## 5. Free Report

User sees:

- Health score.
- Constitution pattern.
- Basic insights.
- Limited recommendations.
- Premium unlock section.
- Friendly wellness disclaimer.

User goal:

- Get immediate value.
- Understand what Premium adds.

Business goal:

- Convert `free_report_view` into `premium_view`.

Success signal:

- User reads free report and clicks Premium CTA.

## 6. Premium Upgrade

User sees:

- Premium value statement.
- Price: `$9.99`.
- Included sections:
  - Deeper analysis.
  - Lifestyle guidance.
  - Follow-up plan.
  - Product suggestions.
- Secure checkout CTA.

User goal:

- Decide whether Premium is worth paying for.

Business goal:

- Convert `premium_view` into `checkout_start`.

Success signal:

- User opens checkout.

## 7. Payment

User sees:

- Stripe Checkout page.
- Product name: Premium AI Health Management Report.
- Price and payment form.
- Return to success page after payment.

User goal:

- Complete payment safely.

Business goal:

- Convert `checkout_start` into `payment_success`.

Success signal:

- Stripe webhook confirms payment.
- Entitlement is granted.

Failure state:

- Payment failed: user sees checkout failure or stays locked.
- Expired checkout: no entitlement is granted.

## 8. Full Report

User sees:

- Premium report access.
- Generate Premium report CTA if not generated yet.
- Full content after generation:
  - Analysis.
  - Lifestyle guidance.
  - Product suggestions.
  - Follow-up plan.

User goal:

- Receive actionable health management guidance.

Business goal:

- Convert `payment_success` into `report_unlocked`.

Success signal:

- User views Premium report.

## Journey Metrics

- `landing_view`
- `assessment_start`
- `assessment_complete`
- `free_report_view`
- `premium_view`
- `checkout_start`
- `payment_success`
- `report_unlocked`
- `refund`

## Top Friction Points to Watch

- Users do not understand what the assessment includes.
- Registration blocks assessment start.
- Verification email delivery is slow or unavailable.
- Free report feels too generic.
- Premium value is unclear.
- Payment succeeds but report unlock is delayed.
- Users cannot find the Premium report after payment.
