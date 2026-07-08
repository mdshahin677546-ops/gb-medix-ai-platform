import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDoctor } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const acceptSchema = z.object({
  orderId: z.string().min(1)
});

export async function GET() {
  await ensureDatabase();
  const doctor = await getCurrentDoctor();
  if (!doctor) {
    return NextResponse.json({ error: "Doctor sign-in required" }, { status: 401 });
  }

  const orders = await prisma.consultationOrder.findMany({
    where: {
      OR: [{ status: "pending" }, { doctorId: doctor.id }]
    },
    include: {
      user: {
        select: { email: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  return NextResponse.json({
    doctor,
    orders: orders.map((order) => ({
      id: order.id,
      userEmail: order.user.email,
      question: order.question,
      summary: order.summary,
      status: order.status,
      mine: order.doctorId === doctor.id,
      createdAt: order.createdAt
    }))
  });
}

export async function POST(request: Request) {
  const doctor = await getCurrentDoctor();
  if (!doctor) {
    return NextResponse.json({ error: "Doctor sign-in required" }, { status: 401 });
  }
  const { orderId } = acceptSchema.parse(await request.json());
  await ensureDatabase();

  const updated = await prisma.consultationOrder.updateMany({
    where: {
      id: orderId,
      status: "pending"
    },
    data: {
      doctorId: doctor.id,
      status: "accepted"
    }
  });

  if (!updated.count) {
    return NextResponse.json(
      { error: "This order is no longer available" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
