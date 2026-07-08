import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDoctor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const acceptSchema = z.object({
  orderId: z.string().min(1)
});

export async function GET() {
  const doctor = await getCurrentDoctor();
  if (!doctor) {
    return NextResponse.json({ error: "Doctor sign-in required" }, { status: 401 });
  }
  const verification = await prisma.doctorVerification.findUnique({
    where: { doctorId: doctor.id }
  });
  if (verification?.status !== "approved") {
    return NextResponse.json(
      { error: "Doctor verification approval required" },
      { status: 403 }
    );
  }

  const orders = await prisma.consultationOrder.findMany({
    where: {
      OR: [{ status: "pending" }, { doctorId: doctor.id }],
      user: {
        patientConsents: {
          some: {
            status: "granted",
            OR: [{ doctorId: null }, { doctorId: doctor.id }]
          }
        }
      }
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
  const verification = await prisma.doctorVerification.findUnique({
    where: { doctorId: doctor.id }
  });
  if (verification?.status !== "approved") {
    return NextResponse.json(
      { error: "Doctor verification approval required" },
      { status: 403 }
    );
  }
  const { orderId } = acceptSchema.parse(await request.json());

  const updated = await prisma.consultationOrder.updateMany({
    where: {
      id: orderId,
      status: "pending",
      user: {
        patientConsents: {
          some: {
            status: "granted",
            OR: [{ doctorId: null }, { doctorId: doctor.id }]
          }
        }
      }
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

  const order = await prisma.consultationOrder.findUnique({ where: { id: orderId } });
  if (order) {
    await prisma.patientConsent.create({
      data: {
        userId: order.userId,
        doctorId: doctor.id,
        status: "granted"
      }
    });
  }

  return NextResponse.json({ ok: true });
}
