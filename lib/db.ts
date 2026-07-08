import { prisma } from "@/lib/prisma";

let ready: Promise<void> | null = null;

export function ensureDatabase() {
  if (!process.env.DATABASE_URL?.startsWith("file:")) {
    return Promise.resolve();
  }

  ready ??= createSQLiteTables();
  return ready;
}

async function createSQLiteTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TCMRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "kind" TEXT NOT NULL DEFAULT 'tcm_analysis',
      "input" TEXT NOT NULL,
      "result" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TCMRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PaymentRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "provider" TEXT NOT NULL DEFAULT 'stripe',
      "product" TEXT NOT NULL DEFAULT 'body_reset_plan',
      "sessionId" TEXT UNIQUE,
      "status" TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL DEFAULT 999,
      "currency" TEXT NOT NULL DEFAULT 'usd',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RFQRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "name" TEXT NOT NULL,
      "company" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "country" TEXT NOT NULL,
      "productInterest" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RFQRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AssistantSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "lang" TEXT NOT NULL,
      "mode" TEXT NOT NULL,
      "input" TEXT NOT NULL,
      "result" TEXT NOT NULL,
      "hasImage" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AssistantSession_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Doctor" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "specialty" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'beta',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConsultationOrder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "doctorId" TEXT,
      "question" TEXT NOT NULL,
      "summary" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConsultationOrder_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "ConsultationOrder_doctorId_fkey"
        FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await addColumnIfMissing("TCMRecord", "userId", "TEXT");
  await addColumnIfMissing("TCMRecord", "kind", "TEXT NOT NULL DEFAULT 'tcm_analysis'");
  await addColumnIfMissing("PaymentRecord", "provider", "TEXT NOT NULL DEFAULT 'stripe'");
  await addColumnIfMissing("PaymentRecord", "product", "TEXT NOT NULL DEFAULT 'body_reset_plan'");
  await addColumnIfMissing("PaymentRecord", "sessionId", "TEXT");
  await addColumnIfMissing("PaymentRecord", "amountCents", "INTEGER NOT NULL DEFAULT 999");
  await addColumnIfMissing("PaymentRecord", "currency", "TEXT NOT NULL DEFAULT 'usd'");
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("${table}")`
  );
  if (rows.some((row) => row.name === column)) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}
