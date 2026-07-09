-- Sprint 1B: resource-scoped premium report commerce loop.

ALTER TABLE "PaymentRecord"
  ADD COLUMN "paymentIntentId" TEXT,
  ADD COLUMN "resourceType" TEXT,
  ADD COLUMN "resourceId" TEXT;

ALTER TABLE "Entitlement"
  ADD COLUMN "resourceType" TEXT,
  ADD COLUMN "resourceId" TEXT;

ALTER TABLE "AIReport"
  ADD COLUMN "followUpPlan" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE "ProductRecommendation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "productId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRecord_paymentIntentId_idx" ON "PaymentRecord"("paymentIntentId");
CREATE INDEX "PaymentRecord_resourceType_resourceId_idx" ON "PaymentRecord"("resourceType", "resourceId");
CREATE INDEX "Entitlement_resourceType_resourceId_idx" ON "Entitlement"("resourceType", "resourceId");

CREATE UNIQUE INDEX "AIReport_userId_assessmentId_type_key"
  ON "AIReport"("userId", "assessmentId", "type");

CREATE INDEX "ProductRecommendation_userId_idx" ON "ProductRecommendation"("userId");
CREATE INDEX "ProductRecommendation_reportId_idx" ON "ProductRecommendation"("reportId");
CREATE INDEX "ProductRecommendation_productId_idx" ON "ProductRecommendation"("productId");
CREATE INDEX "ProductRecommendation_category_idx" ON "ProductRecommendation"("category");
CREATE INDEX "ProductRecommendation_score_idx" ON "ProductRecommendation"("score");
CREATE INDEX "ProductRecommendation_createdAt_idx" ON "ProductRecommendation"("createdAt");

ALTER TABLE "ProductRecommendation"
  ADD CONSTRAINT "ProductRecommendation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductRecommendation"
  ADD CONSTRAINT "ProductRecommendation_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "AIReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductRecommendation"
  ADD CONSTRAINT "ProductRecommendation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
