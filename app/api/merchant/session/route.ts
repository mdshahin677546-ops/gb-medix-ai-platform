import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearMerchantSessionCookie,
  getCurrentMerchant,
  setMerchantSessionCookie
} from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const merchantSchema = z.object({
  email: z.string().email(),
  storeName: z.string().min(2),
  contactName: z.string().min(1),
  country: z.string().min(1)
});

export async function GET() {
  await ensureDatabase();
  const merchant = await getCurrentMerchant();

  return NextResponse.json({
    merchant: merchant
      ? {
          id: merchant.id,
          email: merchant.email,
          storeName: merchant.storeName,
          contactName: merchant.contactName,
          country: merchant.country,
          status: merchant.status
        }
      : null
  });
}

export async function POST(request: Request) {
  const input = merchantSchema.parse(await request.json());
  await ensureDatabase();

  const merchant = await prisma.merchant.upsert({
    where: { email: input.email },
    update: {
      storeName: input.storeName,
      contactName: input.contactName,
      country: input.country
    },
    create: input
  });

  const response = NextResponse.json({
    merchant: {
      id: merchant.id,
      email: merchant.email,
      storeName: merchant.storeName,
      contactName: merchant.contactName,
      country: merchant.country,
      status: merchant.status
    }
  });
  setMerchantSessionCookie(response, merchant.id);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearMerchantSessionCookie(response);
  return response;
}
