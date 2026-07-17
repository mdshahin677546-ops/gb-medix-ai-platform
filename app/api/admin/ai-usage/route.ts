import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/rbac";
import {
  readAdminAiUsageWithAudit,
  type AdminAiUsagePrisma
} from "@/lib/admin/ai-usage-read";
import { newRequestId } from "@/lib/api-v1/request-context";

export const dynamic = "force-dynamic";

export async function GET() {
  // BETA-0A: authoritative database-role RBAC. ADMIN_EMAILS is no longer consulted
  // at runtime — only User.role === ADMIN (read from the DB by the existing
  // authoritative session resolver) may access this endpoint. There is no
  // email-allowlist fallback.
  const guard = await requireAdmin(() => getCurrentUser());
  if (!guard.ok) {
    return NextResponse.json(guard.body, { status: guard.status });
  }

  const requestId = newRequestId();
  try {
    const data = await readAdminAiUsageWithAudit({
      prisma: prisma as unknown as AdminAiUsagePrisma,
      actorUserId: guard.user.id,
      requestId
    });
    return NextResponse.json(data, { headers: { "X-Request-Id": requestId } });
  } catch {
    // Fail-closed: if the read+audit boundary fails (including an audit-write
    // failure), never return admin data, and never leak internal detail.
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
