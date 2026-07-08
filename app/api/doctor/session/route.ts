import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearDoctorSessionCookie,
  getCurrentDoctor,
  setDoctorSessionCookie
} from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const doctorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).default("Beta Doctor"),
  specialty: z.string().min(1).default("General wellness")
});

export async function GET() {
  await ensureDatabase();
  const doctor = await getCurrentDoctor();
  return NextResponse.json({
    doctor: doctor
      ? {
          id: doctor.id,
          email: doctor.email,
          name: doctor.name,
          specialty: doctor.specialty,
          status: doctor.status
        }
      : null
  });
}

export async function POST(request: Request) {
  const input = doctorSchema.parse(await request.json());
  await ensureDatabase();

  const doctor = await prisma.doctor.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      specialty: input.specialty
    },
    create: {
      email: input.email,
      name: input.name,
      specialty: input.specialty
    }
  });

  const response = NextResponse.json({
    doctor: {
      id: doctor.id,
      email: doctor.email,
      name: doctor.name,
      specialty: doctor.specialty,
      status: doctor.status
    }
  });
  setDoctorSessionCookie(response, doctor.id);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearDoctorSessionCookie(response);
  return response;
}
