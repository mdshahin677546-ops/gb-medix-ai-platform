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
      "input" TEXT NOT NULL,
      "result" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PaymentRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "status" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentRecord_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
}
