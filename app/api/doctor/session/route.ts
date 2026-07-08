import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearDoctorSessionCookie,
  getCurrentDoctor,
  setDoctorSessionCookie
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const doctorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).default("Beta Doctor"),
  specialty: z.string().min(1).default("General wellness"),
  licenseNumber: z.string().min(3),
  country: z.string().min(2)
});

export async function GET() {
  const doctor = await getCurrentDoctor();
  const verification = doctor
    ? await prisma.doctorVerification.findUnique({ where: { doctorId: doctor.id } })
    : null;
  return NextResponse.json({
    doctor: doctor
      ? {
          id: doctor.id,
          email: doctor.email,
          name: doctor.name,
          specialty: doctor.specialty,
          status: doctor.status,
          verificationStatus: verification?.status || "missing"
        }
      : null
  });
}

export async function POST(request: Request) {
  const input = doctorSchema.parse(await request.json());

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
  const verification = await prisma.doctorVerification.upsert({
    where: { doctorId: doctor.id },
    update: {
      licenseNumber: input.licenseNumber,
      country: input.country,
      status: "pending"
    },
    create: {
      doctorId: doctor.id,
      licenseNumber: input.licenseNumber,
      country: input.country,
      status: "pending"
    }
  });

  const response = NextResponse.json({
    doctor: {
      id: doctor.id,
      email: doctor.email,
      name: doctor.name,
      specialty: doctor.specialty,
      status: doctor.status,
      verificationStatus: verification.status
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
