# Roundtable → Consultation Safe Conversion Context (Batch 1.1)

Small, safety-first layer that improves context continuity from the public medical
roundtable growth funnel into the AI health-consultation entry, **without touching any
medical diagnosis / prescription / individual-risk logic**.

## What it does

1. **Consult-specific metadata.** The consultation entry pages (`/[lang]/ai-consult`
   and `/[lang]/consult`) use a dedicated `metaTitle` / `metaDescription` via
   `consultMetadata()` — no longer reusing roundtable / knowledge / shop / generic
   copy. The description explicitly states it is **not a medical diagnosis,
   prescription, or individual treatment decision**.

2. **Allowlisted context transfer.** Jumps from roundtable pages to the consultation
   entry are built with `buildConsultHref(lang, { source, topic })`. Only a fixed
   allowlist is ever carried:

   | key | meaning | constraints |
   |-----|---------|-------------|
   | `source` | which surface initiated the jump | `^[a-z0-9_-]{1,40}$` |
   | `topic` | roundtable category/theme | `^[a-z0-9_-]{1,64}$` |
   | `context` | educational-context marker | only ever `education` |

   Everything else is dropped. Patient privacy, symptom free-text, medical records,
   email, phone, tokens, cookies, and Authorization values are **never** forwarded —
   they are not on the allowlist. `sanitizeConsultParams()` is the single authority
   and is covered by real-behavior tests (`tests/roundtable-conversion-context.test.mjs`).

3. **Language switch preserves context.** `swapLocaleInPath(pathname, search, nextLang)`
   swaps only the leading locale segment and preserves the full query string (search +
   active filters), so switching language never drops roundtable search/filter state.

## Safety positioning (unchanged)

The disclaimers and non-diagnostic positioning from Batch 1 remain intact: this is
health-management and medical-knowledge assistance, not automated diagnosis,
prescription, or individual treatment decisions.
