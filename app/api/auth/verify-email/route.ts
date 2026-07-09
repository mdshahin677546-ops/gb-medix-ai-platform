import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  token: z.string().min(20)
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification token." }, { status: 400 });
  }

  return verifyToken(parsed.data.token);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const parsed = requestSchema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification token." }, { status: 400 });
  }

  const result = await verifyEmail(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Verification token is invalid or expired." },
      { status: 400 }
    );
  }

  const redirectUrl = new URL(
    "/en/dashboard?verified=1",
    process.env.NEXT_PUBLIC_APP_URL || request.url
  );
  const response = NextResponse.redirect(redirectUrl);
  setSessionCookie(response, result.userId);
  return response;
}

async function verifyToken(token: string) {
  const result = await verifyEmail(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Verification token is invalid or expired." },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true, status: "active" });
  setSessionCookie(response, result.userId);
  return response;
}

async function verifyEmail(token: string) {
  const verification = await prisma.emailVerification.findUnique({
    where: { token }
  });

  // Reject missing, already-used, or expired tokens (single use).
  if (!verification || verification.verifiedAt || verification.expiresAt <= new Date()) {
    return { ok: false as const };
  }

  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verifiedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: verification.userId },
      data: { status: "active", emailVerifiedAt: new Date() }
    })
  ]);

  return { ok: true as const, userId: verification.userId };
}
