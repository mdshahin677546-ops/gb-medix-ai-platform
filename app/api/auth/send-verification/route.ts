import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/ai-security";
import { getEmailProvider } from "@/lib/email/provider";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  email: z.string().email()
});

const perEmailHourlyLimit = 5;
const perIpHourlyLimit = 15;
const windowMs = 60 * 60 * 1000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  const { email } = parsed.data;

  // Per-IP throttle (in-process burst guard).
  const ip = clientIp(request);
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || hit.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    hit.count += 1;
    if (hit.count > perIpHourlyLimit) {
      return NextResponse.json(
        { error: "Too many verification requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  // Never downgrade an existing user's status. Create a pending user only if absent.
  const existing = await prisma.user.findUnique({ where: { email } });
  const user =
    existing ?? (await prisma.user.create({ data: { email, status: "pending" } }));

  // Per-email throttle (persistent): caps email bombing and unbounded token rows.
  const since = new Date(now - windowMs);
  const recent = await prisma.emailVerification.count({
    where: { email, createdAt: { gte: since } }
  });
  if (recent >= perEmailHourlyLimit) {
    return NextResponse.json(
      { error: "Too many verification requests for this email. Please try again later." },
      { status: 429 }
    );
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now + 30 * 60 * 1000);
  await prisma.emailVerification.create({
    data: { userId: user.id, email, token, expiresAt }
  });

  await getEmailProvider().send({
    to: email,
    subject: "Verify your GB Medix email",
    text: `Use this verification token: ${token}`
  });

  // No session is issued here. A session is granted only after the token is
  // consumed by /api/auth/verify-email.
  return NextResponse.json({
    ok: true,
    status: user.status,
    verificationToken: process.env.NODE_ENV === "production" ? undefined : token
  });
}
