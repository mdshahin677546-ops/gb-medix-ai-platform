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
