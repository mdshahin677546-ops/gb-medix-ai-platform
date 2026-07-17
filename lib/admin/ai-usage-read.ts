// BETA-0A — Admin AI-usage read, bound to an immutable audit append.
//
// The read (existing daily aggregates) and the audit append run inside one
// interactive transaction: the audit MUST persist before any data is returned, so
// there is never a "data returned but audit missing" outcome. If the audit write
// fails, the whole boundary rolls back and the error propagates to the caller,
// which fails closed without returning admin data. Response data / user email
// lists / usage detail are deliberately NOT copied into audit metadata.

import { ADMIN_AUDIT_ACTIONS, insertAdminAudit } from "./audit";

type AiUsageAggregate = {
  _sum: { tokens: number | null; cost: number | null };
  _count: number;
};
type AiUsageGroupRow = {
  _sum: { tokens: number | null; cost: number | null };
  _count: number;
} & Record<string, unknown>;

// Structural transaction client covering exactly the reads + audit append this
// operation performs. Keeps the operation decoupled from the concrete generated
// PrismaClient and testable in node:test with a real client instance.
export type AdminAiUsageTxClient = {
  aIUsage: {
    aggregate(args: unknown): Promise<AiUsageAggregate>;
    groupBy(args: unknown): Promise<AiUsageGroupRow[]>;
  };
  adminAuditLog: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
};

export type AdminAiUsagePrisma = {
  $transaction<T>(fn: (tx: AdminAiUsageTxClient) => Promise<T>): Promise<T>;
};

export type AdminAiUsageResult = {
  day: string;
  daily: { calls: number; tokens: number; cost: number };
  byUser: Array<{ userId: string; calls: number; tokens: number; cost: number }>;
  byEndpoint: Array<{ endpoint: string; calls: number; tokens: number; cost: number }>;
  byProvider: Array<{ provider: string; model: string; calls: number; tokens: number; cost: number }>;
};

export async function readAdminAiUsageWithAudit(deps: {
  prisma: AdminAiUsagePrisma;
  actorUserId: string;
  requestId: string;
  now?: () => Date;
}): Promise<AdminAiUsageResult> {
  const now = deps.now ? deps.now() : new Date();
  const dayStart = new Date(now.getTime());
  dayStart.setUTCHours(0, 0, 0, 0);
  const where = { createdAt: { gte: dayStart } };

  return deps.prisma.$transaction(async (tx) => {
    // Sequential reads inside the controlled server-side boundary.
    const daily = await tx.aIUsage.aggregate({
      where,
      _sum: { tokens: true, cost: true },
      _count: true
    });
    const byUser = await tx.aIUsage.groupBy({
      by: ["userId"],
      where,
      _sum: { tokens: true, cost: true },
      _count: true
    });
    const byEndpoint = await tx.aIUsage.groupBy({
      by: ["endpoint"],
      where,
      _sum: { tokens: true, cost: true },
      _count: true
    });
    const byProvider = await tx.aIUsage.groupBy({
      by: ["provider", "model"],
      where,
      _sum: { tokens: true, cost: true },
      _count: true
    });

    // Audit append MUST succeed before data is returned; a failure rolls back the
    // whole boundary and propagates.
    await insertAdminAudit(tx, {
      actorUserId: deps.actorUserId,
      action: ADMIN_AUDIT_ACTIONS.AI_USAGE_READ,
      requestId: deps.requestId,
      outcome: "success"
    });

    return {
      day: dayStart.toISOString(),
      daily: {
        calls: daily._count,
        tokens: daily._sum.tokens || 0,
        cost: daily._sum.cost || 0
      },
      byUser: byUser.map((row) => ({
        userId: String(row.userId),
        calls: row._count,
        tokens: row._sum.tokens || 0,
        cost: row._sum.cost || 0
      })),
      byEndpoint: byEndpoint.map((row) => ({
        endpoint: String(row.endpoint),
        calls: row._count,
        tokens: row._sum.tokens || 0,
        cost: row._sum.cost || 0
      })),
      byProvider: byProvider.map((row) => ({
        provider: String(row.provider),
        model: String(row.model),
        calls: row._count,
        tokens: row._sum.tokens || 0,
        cost: row._sum.cost || 0
      }))
    };
  });
}
