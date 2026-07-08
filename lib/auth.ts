import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const cookieName = "gbmedix_session";
const doctorCookieName = "gbmedix_doctor_session";

function secret() {
  return process.env.AUTH_SECRET || "dev-only-change-me";
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

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(cookieName, sessionValue(userId), {
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

  const [userId, signature] = raw.split(".");
  if (!userId || !signature || !verify(userId, signature)) return null;

  return prisma.user.findUnique({ where: { id: userId } });
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
