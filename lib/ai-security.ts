import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ipWindowMs = 60 * 60 * 1000;
const ipHourlyLimit = 60;
const ipDailyTokenLimit = 200_000;
const userDailyCallLimit = 25;
const userDailyTokenLimit = 20_000;
const requestTokenLimit = 6_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

export function estimateTokens(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(text.length / 4);
}

export function estimateCost(model: string, tokens: number) {
  if (model === "gpt-4o-mini") {
    return (tokens / 1_000_000) * 0.6;
  }

  return 0;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function enforceAIUsageBudget({
  request,
  userId,
  model,
  estimatedTokens
}: {
  request: Request;
  userId: string;
  model: string;
  estimatedTokens: number;
}) {
  if (estimatedTokens > requestTokenLimit) {
    return NextResponse.json(
      { error: "AI request exceeds token budget." },
      { status: 413 }
    );
  }

  const ip = clientIp(request);
  const now = Date.now();
  const windowStart = new Date(now - ipWindowMs);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  // In-process burst guard: catches rapid concurrent floods within a single
  // instance before any usage row is written. Not authoritative on its own.
  const hit = ipHits.get(ip);
  if (!hit || hit.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + ipWindowMs });
  } else {
    hit.count += 1;
    if (hit.count > ipHourlyLimit) {
      return NextResponse.json(
        { error: "Too many AI requests from this IP. Please try again later." },
        { status: 429 }
      );
    }
  }

  const [ipHourlyCalls, ipTokenSum, userCalls, userTokenSum] = await Promise.all([
    prisma.aIUsage.count({
      where: { ip, createdAt: { gte: windowStart } }
    }),
    prisma.aIUsage.aggregate({
      where: { ip, createdAt: { gte: dayStart } },
      _sum: { tokens: true }
    }),
    prisma.aIUsage.count({
      where: { userId, model, createdAt: { gte: dayStart } }
    }),
    prisma.aIUsage.aggregate({
      where: { userId, createdAt: { gte: dayStart } },
      _sum: { tokens: true }
    })
  ]);

  // Persistent, cross-instance IP limits. These hold even when an attacker
  // registers many unverified accounts, because they are keyed on IP.
  if (ipHourlyCalls >= ipHourlyLimit) {
    return NextResponse.json(
      { error: "Too many AI requests from this IP. Please try again later." },
      { status: 429 }
    );
  }

  const ipUsedTokens = ipTokenSum._sum.tokens || 0;
  if (ipUsedTokens + estimatedTokens > ipDailyTokenLimit) {
    return NextResponse.json(
      { error: "Daily AI token budget for this network is reached." },
      { status: 429 }
    );
  }

  // Per-user limits: defense in depth for a single authenticated account.
  if (userCalls >= userDailyCallLimit) {
    return NextResponse.json(
      { error: "Daily AI request limit reached." },
      { status: 429 }
    );
  }

  const userUsedTokens = userTokenSum._sum.tokens || 0;
  if (userUsedTokens + estimatedTokens > userDailyTokenLimit) {
    return NextResponse.json(
      { error: "Daily AI token budget reached." },
      { status: 429 }
    );
  }

  return null;
}

export async function recordAIUsage({
  request,
  userId,
  model,
  tokens,
  endpoint = "unknown"
}: {
  request: Request;
  userId: string;
  model: string;
  tokens: number;
  endpoint?: string;
}) {
  await prisma.aIUsage.create({
    data: {
      userId,
      ip: clientIp(request),
      model,
      tokens,
      cost: estimateCost(model, tokens),
      endpoint
    }
  });
}
