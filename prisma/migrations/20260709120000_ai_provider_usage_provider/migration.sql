ALTER TABLE "AIUsage" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'openai';

CREATE INDEX "AIUsage_provider_idx" ON "AIUsage"("provider");
CREATE INDEX "AIUsage_provider_model_idx" ON "AIUsage"("provider", "model");
