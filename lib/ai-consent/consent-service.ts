import { prisma } from "@/lib/prisma";
import { AI_CONSENT_VERSION, requiresAIConsent } from "@/lib/ai-consent/consent-policy";

export class AIConsentRequiredError extends Error {
  code = "AI_CONSENT_REQUIRED";

  constructor() {
    super("Please review and accept the third-party AI processing notice before using AI health features.");
    this.name = "AIConsentRequiredError";
  }
}

export function isAIConsentRequiredError(error: unknown): error is AIConsentRequiredError {
  return error instanceof AIConsentRequiredError;
}

export async function getActiveAIConsent(userId: string, provider: string) {
  return prisma.aIProcessingConsent.findFirst({
    where: {
      userId,
      provider,
      consentVersion: AI_CONSENT_VERSION,
      revokedAt: null
    },
    orderBy: { acceptedAt: "desc" }
  });
}

export async function getAIConsentStatus(userId: string, provider: string) {
  const required = requiresAIConsent(provider);
  const consent = required ? await getActiveAIConsent(userId, provider) : null;

  return {
    provider,
    required,
    accepted: required ? Boolean(consent) : true,
    consentVersion: AI_CONSENT_VERSION,
    acceptedAt: consent?.acceptedAt?.toISOString() || null,
    revokedAt: consent?.revokedAt?.toISOString() || null
  };
}

export async function acceptAIConsent(userId: string, provider: string) {
  if (!requiresAIConsent(provider)) {
    return getAIConsentStatus(userId, provider);
  }

  const active = await getActiveAIConsent(userId, provider);
  if (active) {
    return getAIConsentStatus(userId, provider);
  }

  await prisma.aIProcessingConsent.create({
    data: {
      userId,
      provider,
      consentVersion: AI_CONSENT_VERSION,
      acceptedAt: new Date()
    }
  });

  return getAIConsentStatus(userId, provider);
}

export async function revokeAIConsent(userId: string, provider: string) {
  const now = new Date();
  await prisma.aIProcessingConsent.updateMany({
    where: {
      userId,
      provider,
      consentVersion: AI_CONSENT_VERSION,
      revokedAt: null
    },
    data: { revokedAt: now }
  });

  return getAIConsentStatus(userId, provider);
}

export async function ensureAIConsentForProvider(userId: string, provider: string) {
  if (!requiresAIConsent(provider)) return;

  const consent = await getActiveAIConsent(userId, provider);
  if (!consent) {
    throw new AIConsentRequiredError();
  }
}
