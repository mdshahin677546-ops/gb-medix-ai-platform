CREATE TABLE "AIProcessingConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProcessingConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIProcessingConsent_userId_idx" ON "AIProcessingConsent"("userId");
CREATE INDEX "AIProcessingConsent_provider_idx" ON "AIProcessingConsent"("provider");
CREATE INDEX "AIProcessingConsent_consentVersion_idx" ON "AIProcessingConsent"("consentVersion");
CREATE INDEX "AIProcessingConsent_revokedAt_idx" ON "AIProcessingConsent"("revokedAt");
CREATE INDEX "AIProcessingConsent_userId_provider_consentVersion_revokedAt_idx" ON "AIProcessingConsent"("userId", "provider", "consentVersion", "revokedAt");

ALTER TABLE "AIProcessingConsent" ADD CONSTRAINT "AIProcessingConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
