# GB MEDIX AI — Mobile App (Expo)

Batch 1: **static foundation only**. Separate Expo project under `apps/mobile/`.
The existing Next.js web app is **not** modified or moved.

## Scope of this batch (implemented)
- Expo + Expo Router + TypeScript scaffold, bottom tab navigation.
- Static screens: splash, login, register, email-verification notice, AI consent
  notice, home, AI health, health records, profile, Free/Premium report
  placeholders, report history placeholder.
- `theme/` base and `i18n/` (en/zh) base.
- `lib/mock-api-client.ts`: typed fake data; can simulate 401 / 403 consent /
  402 entitlement / 429 / 502. No real network, no production URL.
- `lib/secure-credential-store.ts`: `SecureCredentialStore` abstraction only.

## Explicitly NOT in this batch (BLOCKED / forbidden)
- Real registration/login/network requests.
- Real Access Token / Refresh Token / token rotation / replay detection.
- DeviceSession, token issuance, real email verification, real consent write.
- Real payment / App Store IAP / Google Play Billing.
- Direct PostgreSQL / AIHubMix / DeepSeek / OpenAI access.
- Production API base URL. Tokens in AsyncStorage.

> Real mobile authentication requires a separate Codex-approved DeviceSession and
> refresh-token implementation (see MOBILE_APP_IMPLEMENTATION_PLAN.md §6).

## Run (requires its own install)
This project has its own `package.json`; dependencies are declared, not installed
in this batch. To run locally: `cd apps/mobile && npm install && npx expo start`.
