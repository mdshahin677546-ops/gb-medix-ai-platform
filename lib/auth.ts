import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const cookieName = "gbmedix_session";
const doctorCookieName = "gbmedix_doctor_session";
const merchantCookieName = "gbmedix_merchant_session";

// Development-only fallback. Never allowed in production (see secret()).
const DEV_FALLBACK_SECRET = "dev-only-change-me";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    // Fail loudly rather than silently signing sessions with a public default.
    if (!value || value === DEV_FALLBACK_SECRET) {
      throw new Error(
        "AUTH_SECRET must be set to a strong, non-default value in production. " +
          "Refusing to start/sign with the development fallback."
      );
    }
    return value;
  }
  // Development / test only: a labeled fallback keeps local runs frictionless.
  return value || DEV_FALLBACK_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(value: string, signature: string) {
  const expected = sign(value);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sessionValue(userId: string) {
  return `${userId}.${sign(userId)}`;
}

// User sessions bind the id to a sessionVersion so they can be revoked in bulk
// by bumping User.sessionVersion (see invalidateUserSessions). The signature
// covers "id.version" so neither can be tampered with independently.
export function userSessionValue(userId: string, sessionVersion: number) {
  const payload = `${userId}.${sessionVersion}`;
  return `${payload}.${sign(payload)}`;
}

export function setSessionCookie(
  response: NextResponse,
  userId: string,
  sessionVersion: number
) {
  response.cookies.set(cookieName, userSessionValue(userId, sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser() {
  const raw = cookies().get(cookieName)?.value;
  if (!raw) return null;

  // Format: "userId.sessionVersion.signature" (signature over "userId.sessionVersion").
  // Legacy 2-part cookies no longer validate and are treated as signed out.
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, versionRaw, signature] = parts;
  if (!userId || !versionRaw || !signature) return null;
  if (!verify(`${userId}.${versionRaw}`, signature)) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Revocation check: a bumped User.sessionVersion invalidates older cookies.
  if (user.sessionVersion !== Number(versionRaw)) return null;

  return user;
}

// Revoke every existing session for a user (logout-all / email or credential
// change / security response) by advancing their sessionVersion. Any cookie
// signed with a prior version fails the check in getCurrentUser.
export async function invalidateUserSessions(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { id: true, sessionVersion: true }
  });
  return user.sessionVersion;
}

export function setDoctorSessionCookie(response: NextResponse, doctorId: string) {
  response.cookies.set(doctorCookieName, sessionValue(doctorId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearDoctorSessionCookie(response: NextResponse) {
  response.cookies.set(doctorCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentDoctor() {
  const raw = cookies().get(doctorCookieName)?.value;
  if (!raw) return null;

  const [doctorId, signature] = raw.split(".");
  if (!doctorId || !signature || !verify(doctorId, signature)) return null;

  return prisma.doctor.findUnique({ where: { id: doctorId } });
}

export function setMerchantSessionCookie(response: NextResponse, merchantId: string) {
  response.cookies.set(merchantCookieName, sessionValue(merchantId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearMerchantSessionCookie(response: NextResponse) {
  response.cookies.set(merchantCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentMerchant() {
  const raw = cookies().get(merchantCookieName)?.value;
  if (!raw) return null;

  const [merchantId, signature] = raw.split(".");
  if (!merchantId || !signature || !verify(merchantId, signature)) return null;

  return prisma.merchant.findUnique({ where: { id: merchantId } });
}
