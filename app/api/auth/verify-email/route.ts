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

  const verification = await prisma.emailVerification.findUnique({
    where: { token: parsed.data.token }
  });

  // Reject missing, already-used, or expired tokens (single use).
  if (!verification || verification.verifiedAt || verification.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "Verification token is invalid or expired." },
      { status: 400 }
    );
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

  // Issuing the session here is correct: identity has now been proven.
  const response = NextResponse.json({ ok: true, status: "active" });
  setSessionCookie(response, verification.userId);
  return response;
}
