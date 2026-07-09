import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PRODUCT_PREMIUM_REPORT,
  RESOURCE_ASSESSMENT,
  checkEntitlement
} from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before viewing reports." }, { status: 401 });
  }

  // Scope by both id and userId: a report id alone must never expose another user's report.
  const report = await prisma.aIReport.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const isPremium = report.type === "premium_health_report";
  if (isPremium) {
    const entitled = await checkEntitlement({
      userId: user.id,
      productId: PRODUCT_PREMIUM_REPORT,
      resourceType: RESOURCE_ASSESSMENT,
      resourceId: report.assessmentId
    });
    if (!entitled) {
      return NextResponse.json(
        { error: "Premium report access requires an active entitlement." },
        { status: 402 }
      );
    }
  }

  if (report.type === "free_health_report") {
    return NextResponse.json({
      report: {
        id: report.id,
        userId: report.userId,
        assessmentId: report.assessmentId,
        type: report.type,
        status: report.status,
        score: report.score,
        summary: report.summary,
        analysis: report.analysis,
        recommendations: report.recommendations,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }
    });
  }

  return NextResponse.json({ report });
}
