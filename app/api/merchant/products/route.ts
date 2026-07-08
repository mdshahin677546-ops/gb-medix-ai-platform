import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentMerchant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  price: z.string().min(1),
  stock: z.string().min(1),
  imageUrl: z.string().url().or(z.literal("")),
  description: z.string().min(8)
});

export async function GET() {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const input = productSchema.parse(await request.json());
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.create({
    data: {
      merchantId: merchant.id,
      name: input.name,
      category: input.category,
      price: input.price,
      stock: input.stock,
      imageUrl: input.imageUrl || "/assets/shop/clinical-wellness-kit.png",
      description: input.description
    }
  });

  return NextResponse.json({ product, ok: true });
}
