import type { AIProviderName } from "@/lib/ai/providers/types";

export const AI_CONSENT_VERSION = "2026-07-09-v1";

export const THIRD_PARTY_AI_PROVIDERS = [
  "deepseek",
  "qwen",
  "kimi",
  "glm",
  "doubao"
] as const satisfies readonly AIProviderName[];

export function requiresAIConsent(provider: string) {
  return THIRD_PARTY_AI_PROVIDERS.includes(provider.toLowerCase() as any);
}
