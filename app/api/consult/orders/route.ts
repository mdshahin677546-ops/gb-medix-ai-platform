import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const orderSchema = z.object({
  question: z.string().min(5).max(2000),
  summary: z.string().max(4000).optional()
});

export async function POST(request: Request) {
  const input = orderSchema.parse(await request.json());
  await ensureDatabase();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  const order = await prisma.consultationOrder.create({
    data: {
      userId: user.id,
      question: input.question,
      summary: input.summary || null,
      status: "pending"
    }
  });

  return NextResponse.json({ id: order.id, status: order.status });
}
