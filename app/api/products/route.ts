import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await ensureDatabase();

  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: {
      merchant: {
        select: {
          storeName: true,
          country: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 24
  });

  return NextResponse.json({ products });
}
