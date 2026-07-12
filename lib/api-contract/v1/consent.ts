import { z } from "zod";

/**
 * AI Consent DTOs. Unified across surfaces. This batch does NOT modify the
 * server-side consent data structure or gate — DTOs only.
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §2.
 */

export const aiProviderScopeSchema = z.enum([
  "deepseek",
  "qwen",
  "kimi",
  "glm",
  "doubao"
]);
export type AiProviderScope = z.infer<typeof aiProviderScopeSchema>;

export const consentStatusSchema = z
  .object({
    accepted: z.boolean(),
    consentVersion: z.string().min(1),
    providerScope: z.array(aiProviderScopeSchema),
    acceptedAt: z.string().datetime().nullable()
  })
  .strict();
export type ConsentStatus = z.infer<typeof consentStatusSchema>;

export const consentAcceptRequestSchema = z
  .object({
    consentVersion: z.string().min(1),
    providerScope: z.array(aiProviderScopeSchema).min(1)
  })
  .strict();
export type ConsentAcceptRequest = z.infer<typeof consentAcceptRequestSchema>;

/**
 * Read-only AI consent status DTO (batch 2.1).
 *
 * Additive to this contract — it does NOT change `consentStatusSchema`. It mirrors
 * what the existing server consent service exposes for a GET (`required`, whether
 * the server-configured provider needs consent; `accepted`; version; accepted/revoked
 * timestamps) while keeping the wire free of internal DB ids, the raw configured
 * provider value, API keys, and env values. The server resolves the provider —
 * clients never supply it. `providerScope` lists only the third-party providers in
 * scope (empty when the configured provider needs no consent, e.g. openai).
 */
export const aiConsentStatusSchema = z
  .object({
    required: z.boolean(),
    accepted: z.boolean(),
    consentVersion: z.string().min(1),
    providerScope: z.array(aiProviderScopeSchema),
    acceptedAt: z.string().datetime().nullable(),
    revokedAt: z.string().datetime().nullable()
  })
  .strict();
export type AiConsentStatus = z.infer<typeof aiConsentStatusSchema>;
