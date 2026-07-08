import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearSessionCookie,
  getCurrentUser,
  setSessionCookie
} from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email()
});

export async function GET() {
  await ensureDatabase();
  const user = await getCurrentUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null
  });
}

export async function POST(request: Request) {
  const { email } = loginSchema.parse(await request.json());
  await ensureDatabase();

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email }
  });

  const response = NextResponse.json({ user: { id: user.id, email: user.email } });
  setSessionCookie(response, user.id);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
