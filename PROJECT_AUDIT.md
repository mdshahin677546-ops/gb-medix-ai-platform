# GB Medix AI Project Audit

Sprint: 0 - Project Audit  
Status: Audit only, pending review  
Scope: Current GB Medix AI Health Platform codebase  
Rule: No feature development, no code refactor, no production logic changes

## 1. Current Architecture

### Frontend Technology Stack

The current frontend is built with:

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Server Components and Client Components mixed under `app/`
- Local image assets under `public/assets`

The frontend already has a multi-page product surface:

- `/` current command-center style homepage
- `/[lang]/dashboard` user records dashboard
- `/[lang]/tcm-check` TCM body type intake
- `/[lang]/tcm-result` TCM result display
- `/[lang]/assistant` AI wellness assistant
- `/[lang]/consult` AI pre-consultation flow
- `/[lang]/shop` wellness product shop
- `/[lang]/rfq` B2B RFQ form
- `/[lang]/checkout` payment checkout
- `/[lang]/success` payment success page
- `/merchant/login` and `/merchant/dashboard`
- `/doctor/login` and `/doctor/dashboard`

The frontend has an internationalized route shape through `[lang]`, with supported language codes defined in `lib/lang.ts`. In practice, the content coverage is uneven. English and Chinese are the most developed, while several languages reuse English copy. Some Chinese copy appears to have had encoding issues in earlier files, though key current files now contain readable Chinese in several places.

### Backend Technology Stack

The backend is implemented through Next.js API Routes:

- Runtime: Next.js server route handlers
- Validation: Zod
- ORM: Prisma Client
- Database: SQLite in the current schema
- AI provider: OpenAI SDK
- Payment provider: Stripe SDK, with Alipay placeholder/demo branch
- Session management: custom signed cookie session using HMAC

There is no separate backend service. The application is a monolithic Next.js app where UI, API routes, AI calls, payment logic, and database access live in the same repository.

### Project Directory Structure

Current high-level structure:

- `app/`: Next.js routes, pages, layouts, and API route handlers
- `app/api/`: backend endpoints for session, AI, payment, shop, RFQ, doctor, merchant
- `components/`: shared UI components such as shell, nav, logo, field, language switcher
- `lib/`: shared server/client helpers for auth, Prisma, DB bootstrap, language copy, TCM parsing
- `prisma/`: Prisma schema and local SQLite database
- `public/assets/`: static visual assets and product images
- root config: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`, `vercel.json`

### Module Division

Current modules are functionally recognizable but not formally separated into domain layers:

- User/session: `lib/auth.ts`, `app/api/session/route.ts`
- TCM analysis: `app/api/tcm/route.ts`, `lib/tcm.ts`, `app/[lang]/tcm-check`
- AI assistant: `app/api/assistant/route.ts`, `app/[lang]/assistant`
- AI pre-consultation: `app/api/consult/route.ts`, `app/[lang]/consult`
- Doctor beta workflow: `app/api/doctor/*`, `app/doctor/*`
- Merchant workflow: `app/api/merchant/*`, `app/merchant/*`
- Shop: `app/[lang]/shop`, `app/api/products/route.ts`
- RFQ: `app/[lang]/rfq`, `app/api/rfq/route.ts`
- Payment: `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`

There is no dedicated service layer such as `services/health`, `services/payment`, `services/recommendation`, or `services/supply-chain`. Most business logic sits directly inside route handlers or page components.

### API Structure

Current API endpoints:

- `GET/POST/DELETE /api/session`
- `POST /api/tcm`
- `POST /api/assistant`
- `POST /api/consult`
- `POST /api/consult/orders`
- `GET/POST/DELETE /api/doctor/session`
- `GET/POST /api/doctor/orders`
- `GET/POST/DELETE /api/merchant/session`
- `GET/POST /api/merchant/products`
- `GET /api/products`
- `POST /api/rfq`
- `POST /api/checkout`
- `POST /api/webhooks/stripe`

The API is clear enough for an MVP but lacks:

- versioning
- shared response envelope
- shared error code taxonomy
- shared auth middleware
- rate limiting
- request audit logging
- role-based access control
- standardized pagination
- stable domain service boundaries

### Permission System

Current permissions are cookie-based:

- User cookie: `gbmedix_session`
- Doctor cookie: `gbmedix_doctor_session`
- Merchant cookie: `gbmedix_merchant_session`

Each cookie stores `id.signature`, where the signature is an HMAC using `AUTH_SECRET` or a development fallback.

Current role isolation exists at the route level:

- user routes call `getCurrentUser()`
- doctor routes call `getCurrentDoctor()`
- merchant routes call `getCurrentMerchant()`

This is simple and workable for MVP, but insufficient for a global health and commerce platform. It lacks verified login, MFA, email verification, passwordless magic link, role tables, permission tables, admin review workflows, and session revocation.

## 2. Existing Features

### User Registration and Account

Current support:

- Email-based sign in or account creation through `/api/session`
- Session cookie is set after email submission
- User records dashboard can display TCM records, AI sessions, payments, and RFQs

Limitations:

- No email verification
- No password, OAuth, magic link, or MFA
- Anyone with an email address can create or access that email identity
- User profile only stores email and creation time

### Free Health / TCM Assessment

Current support:

- `/[lang]/tcm-check` provides a structured intake questionnaire
- `/api/tcm` validates input and calls OpenAI when `OPENAI_API_KEY` is configured
- Fallback report exists when AI key is not configured
- TCM record is saved in `TCMRecord`
- Result is temporarily passed to the result page through `sessionStorage`

Limitations:

- No structured health profile table
- No reusable assessment object separate from `TCMRecord`
- No longitudinal tracking
- No persisted report retrieval route by ID
- Upload is summarized as metadata only in the TCM flow, not analyzed as an actual file

### AI Wellness Assistant

Current support:

- `/[lang]/assistant` provides chat UI
- Supports modes: chat, report image, product image
- Supports image data for JPG, PNG, WebP
- Supports local family member selector in browser localStorage
- Stores sessions in `AssistantSession`

Limitations:

- No agent abstraction
- No persistent family member model
- No AI call log, token log, model version log, or prompt version log
- No retrieval from user health history
- No recommendation engine integration

### AI Pre-Consultation and Doctor Beta

Current support:

- `/[lang]/consult` allows AI pre-consultation
- First 3 consult messages are free
- Paid unlock is checked through `PaymentRecord`
- User can submit a consultation order
- Doctor can sign in and accept pending orders

Limitations:

- Human doctor service is beta only
- No doctor verification
- No scheduling
- No clinical notes
- No prescription or diagnosis workflow
- No jurisdiction or license validation

### Payment

Current support:

- Stripe Checkout for one-time payment
- Product types: `body_reset_plan`, `consult_pack`
- Stripe webhook updates payment status
- Alipay branch exists as demo or external checkout URL
- Payment record stored in `PaymentRecord`

Limitations:

- No membership subscription
- No entitlement table
- No invoice, refund, cancellation, or renewal model
- No order table for commerce
- Payment success is only loosely connected to product access

### Shop

Current support:

- Shop page displays default products plus merchant-uploaded products
- Merchant can log in and create products
- Public product API returns active products
- Shop UI has category filters, AI match score, and RFQ link

Limitations:

- No product detail page
- No cart
- No product order
- No SKU model
- No inventory quantity
- No real AI recommendation persistence
- No compliance review for products

### Supply Chain

Current support:

- RFQ form exists
- RFQ data saved in `RFQRecord`
- Merchant product management exists
- Shop links to RFQ for B2B intent

Limitations:

- No supplier model
- No quote model
- No purchase order
- No shipment
- No margin/profit model
- No supplier compliance documents
- No global fulfillment workflow

## 3. Technical Debt

### Architecture Debt

- The app is a single Next.js monolith with route-level business logic.
- There is no domain service layer.
- API handlers directly perform validation, AI calls, payment decisions, and database writes.
- UI and business concepts are coupled in several places.
- Current module boundaries are implied by folders, not enforced by architecture.

### Frontend Debt

- The root `/` page is currently a dashboard/command-center experience, not a conversion-first consumer landing page.
- The app shell is optimized for an operations console rather than a first-time health assessment user.
- Some pages are server-rendered dashboards while others rely heavily on browser storage.
- The TCM result flow depends on `sessionStorage`, which breaks cross-device, refresh, and long-term report access.
- Internationalization is incomplete and not managed by a mature i18n framework.

### Backend Debt

- No shared API response format.
- No shared error code strategy.
- No shared authorization middleware.
- No rate limiting.
- No background job system.
- No event system for payment, report generation, recommendation, or fulfillment.
- No admin API for review, compliance, refunds, or content moderation.

### Database Debt

- SQLite is used in current Prisma schema.
- There are no Prisma migrations in the repository.
- `lib/db.ts` creates SQLite tables manually with raw SQL when `DATABASE_URL` starts with `file:`.
- Core health and AI result data is stored as JSON strings in `TCMRecord` and `AssistantSession`.
- There is no structured health profile, subscription, order, recommendation, supplier, quote, or shipment model.

### AI Debt

- Prompts are hardcoded inside route handlers.
- There is no prompt registry or prompt versioning.
- There is no agent orchestration layer.
- There is no model routing layer.
- There is no AI safety middleware before or after model calls.
- There is no evaluation dataset for AI outputs.
- There is no tracking of token usage, latency, cost, or model version per request.

### Commercialization Debt

- The system has individual commercial parts but not a complete closed loop.
- Free assessment exists, but it does not become a structured profile.
- Paid report exists as a concept, but entitlement is not modeled.
- Stripe payment exists, but subscription does not.
- Shop exists, but checkout for physical goods does not.
- RFQ exists, but supplier transaction does not.

## 4. Database Analysis

### Current Database Type

Current Prisma datasource:

- Provider: SQLite
- URL: `env("DATABASE_URL")`
- Local database: `prisma/dev.db`

Deployment documentation recommends PostgreSQL for production, but the current schema is still configured for SQLite.

### Current Data Models

Current Prisma models:

- `User`
- `Merchant`
- `Product`
- `TCMRecord`
- `PaymentRecord`
- `RFQRecord`
- `AssistantSession`
- `Doctor`
- `ConsultationOrder`

### User Table

`User` currently contains:

- `id`
- `email`
- `createdAt`
- relations to payments, TCM records, RFQs, assistant sessions, consultation orders

Assessment:

- Good for MVP identity.
- Not enough for health management.
- Missing name, region, language preference, consent status, onboarding status, membership status, profile completion, and privacy preferences.

### Product Table

`Product` currently contains:

- merchant relation
- name
- category
- price as string
- stock as string
- image URL
- description
- status
- createdAt

Assessment:

- Suitable for catalog display.
- Not suitable for commerce.
- Price and stock should not remain free-text fields in a transaction system.
- Needs SKU, currency, inventory, compliance status, country restrictions, cost basis, margin, and fulfillment metadata.

### Order Table

Current state:

- There is no general commerce order table.
- `ConsultationOrder` exists for doctor queue only.
- `PaymentRecord` exists, but it is not a full order model.

Required future models:

- `Order`
- `OrderItem`
- `Cart`
- `Shipment`
- `Refund`
- `Invoice`
- `FulfillmentEvent`

### AI-Related Data Structures

Current AI-related tables:

- `TCMRecord`: stores input JSON and result JSON for TCM analysis
- `AssistantSession`: stores assistant interaction input and result JSON
- `ConsultationOrder`: stores question and summary for doctor handoff

Assessment:

- Good for early logging.
- Not enough for analytics, personalization, longitudinal health tracking, AI governance, or recommendations.

Recommended future models:

- `HealthProfile`
- `AIReport`
- `AIInteraction`
- `AICallLog`
- `PromptVersion`
- `HealthAssessment`
- `FollowUpTask`
- `HealthTrend`
- `Recommendation`

### Supply Chain Data Structures

Current supply chain-related tables:

- `RFQRecord`
- `Merchant`
- `Product`

Assessment:

- RFQ intake and merchant catalog are present.
- Supplier-side transaction workflow is missing.

Recommended future models:

- `Supplier`
- `SupplierVerification`
- `RFQ`
- `Quote`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `Shipment`
- `ComplianceDocument`
- `Inventory`
- `MarginRecord`

### Required Future Database Additions

Minimum additions for GB Medix AI 2.0:

- `HealthProfile`: structured user health profile
- `AIReport`: durable report object generated by AI
- `Subscription`: membership state and billing lifecycle
- `Payment`: normalized payment transaction, separate from order and entitlement
- `Supplier`: supplier identity and approval status
- `RFQ`: upgraded RFQ workflow object
- `Doctor`: already exists, but should be expanded with verification and jurisdiction
- `Recommendation`: product, plan, and follow-up recommendations linked to AI reports

Suggested staged database direction:

1. Keep existing models for compatibility.
2. Add `HealthProfile` and `AIReport` first.
3. Add `Subscription` and `Entitlement`.
4. Add commerce `Order` and `OrderItem`.
5. Upgrade RFQ into supplier quote workflow.
6. Migrate from SQLite to PostgreSQL before production scale.

## 5. AI Architecture Review

### Current AI Interfaces

Current AI routes:

- `/api/tcm`
- `/api/assistant`
- `/api/consult`

Current AI usage:

- Direct OpenAI SDK calls inside route handlers.
- Model currently uses `gpt-4o-mini`.
- Prompt text is embedded in route files.
- AI output is parsed manually in `lib/tcm.ts` for TCM structured result.

### Prompt Management

Current state:

- Prompts are hardcoded.
- No prompt registry.
- No prompt versioning.
- No environment-based prompt rollout.
- No A/B testing.
- No prompt-level safety test suite.

Impact:

- Difficult to track why AI output changed.
- Difficult to audit medical safety behavior.
- Difficult to compare model or prompt upgrades.

### Model Calling Method

Current state:

- `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` is created inside each route.
- Chat completion calls are made directly.
- No central model gateway.
- No retries, cost tracking, timeout policy, or fallback model policy.

Recommended future state:

- Create a central AI gateway/service.
- Log every model request with user ID, model, prompt version, token usage, latency, cost, and output safety category.
- Add pre-call and post-call safety filters.
- Add structured output validation for reports and recommendations.

### Agent Structure

Current state:

- There is no formal agent system.
- AI behavior is implemented as separate route prompts.
- Existing route prompts approximate three roles:
  - TCM body pattern analyzer
  - General wellness assistant
  - Pre-consultation organizer

### Support for Future Agents

#### HealthAssessmentAgent

Current support: Partial.

Reason:

- TCM questionnaire exists.
- AI report generation exists.
- But health profile, durable AI report, scoring model, risk rules, and longitudinal tracking are missing.

#### TCMAnalysisAgent

Current support: Partial to moderate.

Reason:

- TCM-inspired prompt and parser exist.
- Constitution type, lifestyle suggestions, risk level, hidden signals, and 7-day preview exist.
- But the structure is prompt-dependent and not governed by a formal schema or versioned report model.

#### NutritionAgent

Current support: Low.

Reason:

- Diet habits are collected in TCM intake.
- There is no nutrition-specific prompt, macro/micronutrient model, meal plan model, allergy model, contraindication model, or product interaction policy.

#### ProductRecommendationAgent

Current support: Low to partial.

Reason:

- Shop UI displays AI match scores.
- Assistant has a product-image mode.
- But recommendations are not generated from persisted health profiles and are not saved as recommendation records.

#### FollowUpAgent

Current support: Low.

Reason:

- Assistant sessions are saved.
- No scheduled follow-up, reminders, health trend comparison, recurring check-ins, or care plan adherence tracking exists.

### AI Readiness Summary

The current AI layer is strong enough for a demo and early user testing. It is not yet strong enough for a regulated, global, commercial health management platform. The next architecture step should be an AI orchestration layer with agents, prompt versions, safety gates, structured outputs, report storage, recommendation storage, and evaluation tests.

## 6. Commercialization Review

### User Registration

Current support: Yes, basic.

Email sign-in creates or loads a `User`. This supports MVP account binding but is not production-grade registration.

### Free Detection

Current support: Yes.

The TCM body type test can be completed for free and generates a basic report. It works as a growth entry point, but the root homepage currently does not focus the user into this flow.

### Paid Report

Current support: Partial.

There is a `$9.99` body reset plan checkout concept. Payment can be recorded. However, there is no formal paid AI report model, no entitlement, and no durable report access control.

### Stripe Payment

Current support: Yes, one-time payment.

Stripe Checkout is implemented for:

- `body_reset_plan`
- `consult_pack`

Webhook handling exists for `checkout.session.completed`.

Missing:

- subscriptions
- invoice handling
- refund handling
- failed payment handling
- customer portal
- entitlement sync

### Membership Subscription

Current support: No.

There is no `Subscription`, `MembershipPlan`, or `Entitlement` table. Stripe currently uses payment mode, not subscription mode.

### Shop Conversion

Current support: Partial.

The shop can display products and collect RFQ intent. It does not support consumer product checkout, shopping cart, order tracking, or purchase history.

### Supply Chain Transaction

Current support: Low.

RFQ intake exists, but supply chain transaction does not. There is no supplier quote, purchase order, shipment, or margin capture.

### Commercial Closed Loop Assessment

Target closed loop:

1. User traffic
2. Free AI health assessment
3. AI health report
4. Membership subscription
5. Personalized health plan
6. AI product recommendation
7. Shop purchase
8. Supply chain fulfillment and profit
9. Long-term health management

Current implementation status:

- User traffic: partial
- Free AI health assessment: partial to good
- AI health report: partial
- Membership subscription: missing
- Personalized health plan: partial concept only
- AI product recommendation: UI concept only
- Shop purchase: missing
- Supply chain fulfillment and profit: missing
- Long-term health management: missing

## 7. Security Review

### User Data Security

Current strengths:

- Cookies are HTTP-only.
- Cookies are signed with HMAC.
- Cookies use `sameSite: "lax"`.
- Production cookies use `secure: true`.

Current weaknesses:

- Login is email-only with no verification.
- `AUTH_SECRET` falls back to a development default if not configured.
- No session revocation table.
- No device/session management.
- No brute force or rate limit controls.
- Health data is stored without a clear consent model.

### Privacy Protection

Current state:

- No explicit consent model in database.
- No privacy preference table.
- No data deletion/export workflow.
- No audit log for health data access.
- No retention policy.

For a global AI health platform, this is a major gap. Health-related data should be handled as sensitive data even if the product avoids formal diagnosis.

### Permission Isolation

Current state:

- User, doctor, and merchant sessions are separated by cookie names.
- API routes manually check the relevant role.

Risks:

- No unified role model.
- No admin role.
- No granular permission model.
- Doctor and merchant onboarding are self-serve and not verified.
- No approval gates for doctors, suppliers, or medical/health products.

### Medical Disclaimer

Current state:

- AI prompts include strong disclaimers:
  - never diagnose
  - never treat disease
  - never prescribe
  - do not replace a licensed clinician
  - urgent symptoms should go to qualified medical professionals or emergency services

Frontend copy also includes wellness-only disclaimers in shared shell copy.

Remaining risk:

- The product goal uses "AI diagnosis", which is higher risk than current implementation.
- If marketed globally as diagnosis, the platform may trigger medical device software, telemedicine, or healthcare provider regulations.
- Product recommendations based on health signals may be interpreted as medical advice if wording is not controlled.

### International Compliance Risk

Areas requiring legal review before global launch:

- HIPAA-like health privacy requirements in the US, depending on covered entity/business associate context
- GDPR and special category health data in the EU
- Cross-border transfer of personal health data
- Telemedicine and doctor licensing rules by country/state
- Consumer health app disclosures
- Supplement and wellness product claims
- Medical device / software as medical device classification risk
- Payment, tax, customs, and import/export compliance for global supply chain

### Security Controls Missing for 2.0

Recommended future controls:

- Verified authentication
- Role-based access control
- Rate limiting
- Audit logs
- AI request logging
- Data consent records
- Data deletion/export workflows
- Admin review workflows
- Product compliance review
- Supplier verification
- Webhook signature enforcement for all payment providers
- Secrets management policy

## 8. Recommended Roadmap

### Phase 0: Audit and Approval

Goal:

- Confirm architecture direction before development.

Deliverables:

- `PROJECT_AUDIT.md`
- Business closed-loop approval
- Compliance terminology approval
- Database migration plan approval

### Phase 1: Consumer Entry and Structured Health Profile

Goal:

- Turn the product from a dashboard-first MVP into a health assessment-first growth flow.

Recommended work:

- Replace root `/` with a consumer landing page.
- Make free AI health assessment the primary CTA.
- Add `HealthProfile`.
- Add `AIReport` or `HealthAssessment`.
- Persist assessment results by report ID, not only sessionStorage.
- Add user onboarding state and language preference.

### Phase 2: Membership and Paid Report Entitlements

Goal:

- Convert health reports into recurring revenue.

Recommended work:

- Add `MembershipPlan`.
- Add `Subscription`.
- Add `Entitlement`.
- Convert Stripe from one-time-only payments to subscription support.
- Keep one-time purchase support for consult packs or special reports.
- Add paid report access control.

### Phase 3: AI Agent Layer

Goal:

- Move from route-level prompts to governed AI agents.

Recommended work:

- Add AI gateway.
- Add prompt registry and versioning.
- Add HealthAssessmentAgent.
- Add TCMAnalysisAgent.
- Add ProductRecommendationAgent.
- Add FollowUpAgent.
- Add AI call logs and safety checks.

NutritionAgent should be added only after allergy, contraindication, medical disclaimer, and nutrition scope are reviewed.

### Phase 4: Commerce Platform

Goal:

- Convert recommendations into shop revenue.

Recommended work:

- Add product detail pages.
- Add SKU and inventory fields.
- Add cart.
- Add order and order item.
- Connect Stripe payment to orders.
- Add recommendation-to-order tracking.
- Add merchant product review workflow.

### Phase 5: Supply Chain Platform

Goal:

- Close B2B and global fulfillment loop.

Recommended work:

- Upgrade `RFQRecord` into RFQ workflow.
- Add Supplier.
- Add Quote.
- Add PurchaseOrder.
- Add Shipment.
- Add ComplianceDocument.
- Add margin/profit tracking.
- Add supplier verification.

### Phase 6: Production Hardening

Goal:

- Prepare for real global users and sensitive health data.

Recommended work:

- Move production DB to PostgreSQL.
- Add Prisma migrations.
- Remove manual SQLite bootstrap from production path.
- Add CI build, lint, typecheck, and tests.
- Add rate limits.
- Add monitoring and structured logs.
- Add privacy workflows.
- Add admin dashboard for review and support.

## 9. Risk Assessment

### Architecture Risk

Level: Medium to High

The current monolithic structure is acceptable for MVP, but route-level business logic will become hard to maintain once subscriptions, commerce orders, supplier quotes, health reports, and AI agents are added.

Mitigation:

- Introduce domain service layers before adding many new workflows.
- Standardize API responses and error codes.
- Add role-based access control.

### Scalability Risk

Level: High

SQLite, manual table bootstrap, lack of migrations, and direct route-level AI calls are not suitable for a global health platform.

Mitigation:

- Move to PostgreSQL.
- Add Prisma migrations.
- Centralize AI calls.
- Add queue/background jobs for long-running workflows.

### Commercial Risk

Level: Medium to High

The product has promising pieces but no full monetization loop yet. Subscription, entitlements, commerce orders, and supply chain transactions are missing.

Mitigation:

- Build the user-to-report-to-subscription flow first.
- Then build recommendation-to-order tracking.
- Then build RFQ-to-quote-to-purchase-order.

### AI Risk

Level: High

Current AI behavior is prompt-only and not governed as agents. The term "AI diagnosis" introduces significant regulatory and safety risk.

Mitigation:

- Use safer product language: AI health assessment, AI pre-consultation, AI wellness management, AI-assisted triage.
- Add safety classifiers and output validation.
- Version prompts and log model calls.
- Establish AI evaluation cases.

### Security and Compliance Risk

Level: High

The platform handles health-related data but lacks consent, audit logs, verified authentication, data deletion/export workflows, and mature role permissions.

Mitigation:

- Add verified auth.
- Add consent and privacy records.
- Add audit logging.
- Add admin review and compliance controls.
- Review legal requirements by launch market.

### Operational Risk

Level: Medium

Build and lint workflows need hardening. Current lint script can enter interactive setup. Current local build has shown environment-level file permission issues around Prisma/Next artifacts.

Mitigation:

- Configure non-interactive lint.
- Add CI.
- Rebuild dependencies cleanly.
- Add automated typecheck/build gates.

## Overall Score

Architecture: 5/10

Scalability: 4/10

Commercial: 5/10

AI: 5/10

Security: 4/10

Final audit conclusion:

GB Medix AI currently has a solid MVP foundation for AI wellness assessment, AI assistant, basic payment, product catalog, merchant listing, RFQ intake, and doctor beta queue. It is not yet a complete AI health management, AI diagnosis, health commerce, and global supply chain platform.

The correct next move is not feature expansion immediately. The next move is to approve the 2.0 architecture direction, add structured health and commercial data models, and build the closed loop in controlled phases.
