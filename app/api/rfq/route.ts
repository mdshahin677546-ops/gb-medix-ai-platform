import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rfqSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  email: z.string().email(),
  country: z.string().min(1),
  productInterest: z.string().min(1),
  quantity: z.coerce.number().positive()
});

export async function POST(request: Request) {
  const input = rfqSchema.parse(await request.json());
  const currentUser = await getCurrentUser();

  const user =
    currentUser?.email === input.email
      ? currentUser
      : await prisma.user.upsert({
          where: { email: input.email },
          update: {},
          create: { email: input.email }
        });

  const record = await prisma.rFQRecord.create({
    data: {
      userId: user.id,
      name: input.name,
      company: input.company,
      email: input.email,
      country: input.country,
      productInterest: input.productInterest,
      quantity: input.quantity
    }
  });

  return NextResponse.json({ id: record.id, ok: true });
}
