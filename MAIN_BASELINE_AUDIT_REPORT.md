# Main Baseline Integrity Audit

Date: 2026-07-09

Scope: verify that `main` at `079635fa6f585532df2ef1d1378f3b6b7fec6ea1` contains the approved release baseline before any PR #5 merge.

## Git Baseline

Current branch during audit:

- `feature/ai-consent-gate`

Main refs:

- `main`: `079635fa6f585532df2ef1d1378f3b6b7fec6ea1`
- `origin/main`: `079635fa6f585532df2ef1d1378f3b6b7fec6ea1`

Result:

- `main` and `origin/main` match.

## Commit Ancestry Checks

Checked with `git merge-base --is-ancestor <commit> main`.

| Commit | Result |
| --- | --- |
| `2105038` | ancestor of `main` |
| `68ad337` | ancestor of `main` |
| `079635f` | ancestor of `main` |

No squash-merge fallback was required for these three refs.

## Required File Checks

All required files exist on `main`.

| File | Status |
| --- | --- |
| `lib/email/providers/resend.ts` | present |
| `lib/ai/provider-factory.ts` | present |
| `lib/ai/providers/openai.ts` | present |
| `lib/ai/providers/deepseek.ts` | present |
| `lib/ai/providers/openai-compatible.ts` | present |
| `lib/ai/providers/types.ts` | present |
| `prisma/migrations/20260709120000_ai_provider_usage_provider/migration.sql` | present |
| `prisma/migrations/20260708190000_sprint_1b_commercial_loop/migration.sql` | present |
| `PRODUCTION_LAUNCH_RUNBOOK.md` | present |
| `ANALYTICS_EVENT_PLAN.md` | present |
| `STRIPE_PRODUCTION_SETUP.md` | present |
| `EMAIL_PROVIDER_SETUP.md` | present |
| `DATABASE_PRODUCTION_SETUP.md` | present |

## Release Content Verification

| Release area | Evidence on `main` | Status |
| --- | --- | --- |
| Sprint 0.5 security hardening | Entitlement, AI usage/security, Stripe webhook refund revoke paths present | present |
| Sprint 1A commercial infrastructure | PostgreSQL Prisma schema/migrations, `AIReport`, `Entitlement`, `AIUsage`, email verification infrastructure present | present |
| Sprint 1B commercial loop | Consumer landing, premium report checkout, Stripe webhook, premium entitlement checks and product id `premium_report` present | present |
| Resend Email Provider fix | `ResendEmailProvider`, `EMAIL_PROVIDER=resend`, production console-provider guard docs and code present | present |
| Production readiness / release docs | production launch, Stripe, email, database, analytics documentation present | present |
| AI Provider Adapter | `AI_PROVIDER`, OpenAI provider, DeepSeek provider, OpenAI-compatible provider, provider factory present | present |

## Functional Checks

| Functionality | Evidence | Status |
| --- | --- | --- |
| Landing is consumer entry | `app/page.tsx` contains `AI Health Assessment` and `Start free health assessment` | present |
| Stripe `premium_report` exists | `PRODUCT_PREMIUM_REPORT = "premium_report"` and checkout defaults/use paths present | present |
| Refund revoke entitlement exists | `app/api/webhooks/stripe/route.ts` handles `charge.refunded` and calls `revokeEntitlement` | present |
| Stripe failure/edge events exist | webhook handles `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.dispute.created` | present |
| AI Provider Adapter exists | `lib/ai/provider-factory.ts` supports `openai` and `deepseek` and validates provider-specific API keys | present |
| Resend provider exists | `lib/email/providers/resend.ts` and `lib/email/provider.ts` select Resend via `EMAIL_PROVIDER=resend` | present |
| AIUsage.provider exists | `prisma/schema.prisma` has `AIUsage.provider String @default("openai")`; migration adds provider indexes | present |
| AI usage recording exists | assistant, consult, report generation, and TCM APIs call `recordAIUsage` | present |

## Notes

- No PR #5 merge was performed.
- No branch deletion was performed.
- No business code was modified during this audit.
- This report file is the only intended repository addition from the audit.
- Working tree already had unrelated untracked local artifacts before this report: `AI_CONSENT_GATE_VALIDATION_REPORT.md` and `design-audit/`.

## Conclusion

MAIN_BASELINE_OK
