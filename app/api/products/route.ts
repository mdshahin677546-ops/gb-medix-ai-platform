import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
