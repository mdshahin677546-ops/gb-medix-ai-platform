import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const user = await getCurrentUser();
  const admins = adminEmails();
  if (!user || admins.length === 0 || !admins.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const where = { createdAt: { gte: dayStart } };

  const [daily, byUser, byEndpoint] = await Promise.all([
    prisma.aIUsage.aggregate({ where, _sum: { tokens: true, cost: true }, _count: true }),
    prisma.aIUsage.groupBy({
      by: ["userId"],
      where,
      _sum: { tokens: true, cost: true },
      _count: true
    }),
    prisma.aIUsage.groupBy({
      by: ["endpoint"],
      where,
      _sum: { tokens: true, cost: true },
      _count: true
    })
  ]);

  return NextResponse.json({
    day: dayStart.toISOString(),
    daily: {
      calls: daily._count,
      tokens: daily._sum.tokens || 0,
      cost: daily._sum.cost || 0
    },
    byUser: byUser.map((row) => ({
      userId: row.userId,
      calls: row._count,
      tokens: row._sum.tokens || 0,
      cost: row._sum.cost || 0
    })),
    byEndpoint: byEndpoint.map((row) => ({
      endpoint: row.endpoint,
      calls: row._count,
      tokens: row._sum.tokens || 0,
      cost: row._sum.cost || 0
    }))
  });
}
