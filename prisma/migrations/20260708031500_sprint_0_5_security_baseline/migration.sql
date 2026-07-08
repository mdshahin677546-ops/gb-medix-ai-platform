-- Sprint 0.5 security, entitlement, AI usage, doctor verification, conversation, and report baseline.

CREATE TABLE "Entitlement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Entitlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PaymentRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AIUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "tokens" INTEGER NOT NULL,
  "cost" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DoctorVerification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "doctorId" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorVerification_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PatientConsent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "doctorId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'granted',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PatientConsent_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AIReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "assessmentId" TEXT,
  "content" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "recommendations" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AIReport_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TCMRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Entitlement_paymentId_productId_key" ON "Entitlement"("paymentId", "productId");
CREATE INDEX "Entitlement_userId_idx" ON "Entitlement"("userId");
CREATE INDEX "Entitlement_productId_idx" ON "Entitlement"("productId");
CREATE INDEX "Entitlement_status_idx" ON "Entitlement"("status");
CREATE INDEX "Entitlement_expiresAt_idx" ON "Entitlement"("expiresAt");

CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");
CREATE INDEX "AIUsage_model_idx" ON "AIUsage"("model");
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");

CREATE UNIQUE INDEX "DoctorVerification_doctorId_key" ON "DoctorVerification"("doctorId");
CREATE INDEX "DoctorVerification_status_idx" ON "DoctorVerification"("status");
CREATE INDEX "DoctorVerification_country_idx" ON "DoctorVerification"("country");

CREATE INDEX "PatientConsent_userId_idx" ON "PatientConsent"("userId");
CREATE INDEX "PatientConsent_doctorId_idx" ON "PatientConsent"("doctorId");
CREATE INDEX "PatientConsent_status_idx" ON "PatientConsent"("status");
CREATE INDEX "PatientConsent_createdAt_idx" ON "PatientConsent"("createdAt");

CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_role_idx" ON "Message"("role");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

CREATE INDEX "AIReport_userId_idx" ON "AIReport"("userId");
CREATE INDEX "AIReport_assessmentId_idx" ON "AIReport"("assessmentId");
CREATE INDEX "AIReport_score_idx" ON "AIReport"("score");
CREATE INDEX "AIReport_createdAt_idx" ON "AIReport"("createdAt");

CREATE INDEX "Product_merchantId_idx" ON "Product"("merchantId");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_category_idx" ON "Product"("category");

CREATE INDEX "TCMRecord_userId_idx" ON "TCMRecord"("userId");
CREATE INDEX "TCMRecord_createdAt_idx" ON "TCMRecord"("createdAt");

CREATE INDEX "PaymentRecord_userId_idx" ON "PaymentRecord"("userId");
CREATE INDEX "PaymentRecord_product_idx" ON "PaymentRecord"("product");
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");
CREATE INDEX "PaymentRecord_createdAt_idx" ON "PaymentRecord"("createdAt");

CREATE INDEX "RFQRecord_userId_idx" ON "RFQRecord"("userId");
CREATE INDEX "RFQRecord_email_idx" ON "RFQRecord"("email");
CREATE INDEX "RFQRecord_country_idx" ON "RFQRecord"("country");
CREATE INDEX "RFQRecord_createdAt_idx" ON "RFQRecord"("createdAt");

CREATE INDEX "AssistantSession_userId_idx" ON "AssistantSession"("userId");
CREATE INDEX "AssistantSession_mode_idx" ON "AssistantSession"("mode");
CREATE INDEX "AssistantSession_createdAt_idx" ON "AssistantSession"("createdAt");

CREATE INDEX "ConsultationOrder_userId_idx" ON "ConsultationOrder"("userId");
CREATE INDEX "ConsultationOrder_doctorId_idx" ON "ConsultationOrder"("doctorId");
CREATE INDEX "ConsultationOrder_status_idx" ON "ConsultationOrder"("status");
CREATE INDEX "ConsultationOrder_createdAt_idx" ON "ConsultationOrder"("createdAt");
