import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  enforceAIUsageBudget,
  estimateTokens,
  recordAIUsage
} from "@/lib/ai-security";
import {
  PRODUCT_PREMIUM_REPORT,
  RESOURCE_ASSESSMENT,
  checkEntitlement
} from "@/lib/entitlements";
import {
  fallbackStructuredReport,
  ReportSchema,
  reportJsonInstruction,
  toFreeReportPayload
} from "@/lib/report-schema";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  assessmentId: z.string().min(1),
  reportType: z.enum(["free_health_report", "premium_health_report"]).default("free_health_report")
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report generation input." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before generating reports." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json(
      { error: "Please verify your email before generating reports." },
      { status: 403 }
    );
  }

  const assessment = await prisma.tCMRecord.findFirst({
    where: { id: parsed.data.assessmentId, userId: user.id }
  });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const existing = await prisma.aIReport.findUnique({
    where: {
      userId_assessmentId_type: {
        userId: user.id,
        assessmentId: assessment.id,
        type: parsed.data.reportType
      }
    }
  });

  if (existing) {
    return NextResponse.json({
      reportId: existing.id,
      score: existing.score,
      summary: existing.summary,
      status: existing.status
    });
  }

  if (parsed.data.reportType === "premium_health_report") {
    const entitled = await checkEntitlement({
      userId: user.id,
      productId: PRODUCT_PREMIUM_REPORT,
      resourceType: RESOURCE_ASSESSMENT,
      resourceId: assessment.id
    });
    if (!entitled) {
      return NextResponse.json(
        { error: "Premium report access requires a completed payment." },
        { status: 402 }
      );
    }
  }

  const model = "gpt-4o-mini";
  const assessmentInput = safeJson(assessment.input);
  const assessmentResult = safeJson(assessment.result);
  const aiInput = { assessmentInput, assessmentResult, reportType: parsed.data.reportType };
  const estimatedTokens = estimateTokens(aiInput);
  const budgetError = await enforceAIUsageBudget({
    request,
    userId: user.id,
    model,
    estimatedTokens
  });
  if (budgetError) return budgetError;

  const placeholder = await prisma.aIReport.upsert({
    where: {
      userId_assessmentId_type: {
        userId: user.id,
        assessmentId: assessment.id,
        type: parsed.data.reportType
      }
    },
    update: {},
    create: {
      userId: user.id,
      assessmentId: assessment.id,
      type: parsed.data.reportType,
      status:
        parsed.data.reportType === "premium_health_report" ? "premium_generating" : "free_generating",
      score: 0,
      summary: "Report generation is processing.",
      analysis: {},
      recommendations: [],
      lifestylePlan: [],
      productSuggestions: [],
      followUpPlan: []
    }
  });

  if (placeholder.status.endsWith("_ready")) {
    return NextResponse.json({
      reportId: placeholder.id,
      score: placeholder.score,
      summary: placeholder.summary,
      status: placeholder.status
    });
  }

  let report = fallbackStructuredReport();
  let tokens = estimatedTokens;

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      temperature: parsed.data.reportType === "premium_health_report" ? 0.45 : 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You generate structured AI health management reports for GB Medix. " +
            "Never provide medical diagnosis, treatment promises, disease probability, or triage direction. " +
            reportJsonInstruction()
        },
        { role: "user", content: JSON.stringify(aiInput) }
      ]
    });

    const content = completion.choices[0]?.message.content || "";
    let rawReport: unknown;
    try {
      rawReport = JSON.parse(content);
    } catch {
      await prisma.aIReport.update({
        where: { id: placeholder.id },
        data: { status: "failed" }
      });
      return NextResponse.json({ error: "AI report output was not valid JSON." }, { status: 502 });
    }

    const reportParse = ReportSchema.safeParse(rawReport);
    if (!reportParse.success) {
      await prisma.aIReport.update({
        where: { id: placeholder.id },
        data: { status: "failed" }
      });
      return NextResponse.json(
        { error: "AI report output failed schema validation." },
        { status: 502 }
      );
    }

    report = reportParse.data;
    tokens = completion.usage?.total_tokens || estimatedTokens;
  }

  await recordAIUsage({
    request,
    userId: user.id,
    model,
    tokens,
    endpoint: "/api/reports/generate"
  });

  const saved =
    parsed.data.reportType === "premium_health_report"
      ? await savePremiumReport(placeholder.id, user.id, report)
      : await saveFreeReport(placeholder.id, report);

  return NextResponse.json({
    reportId: saved.id,
    score: saved.score,
    summary: saved.summary,
    status: saved.status
  });
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function saveFreeReport(reportId: string, report: z.infer<typeof ReportSchema>) {
  const freeReport = toFreeReportPayload(report);
  return prisma.aIReport.update({
    where: { id: reportId },
    data: {
      status: "free_ready",
      score: report.healthScore,
      summary: report.summary,
      analysis: freeReport,
      recommendations: freeReport.limitedRecommendations,
      lifestylePlan: [],
      productSuggestions: [],
      followUpPlan: []
    }
  });
}

async function savePremiumReport(
  reportId: string,
  userId: string,
  report: z.infer<typeof ReportSchema>
) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.aIReport.update({
      where: { id: reportId },
      data: {
        status: "premium_ready",
        score: report.healthScore,
        summary: report.summary,
        analysis: report,
        recommendations: report.recommendations,
        lifestylePlan: report.lifestylePlan,
        productSuggestions: report.productSuggestions,
        followUpPlan: report.followUpPlan
      }
    });

    await tx.productRecommendation.deleteMany({ where: { reportId } });
    const products = await tx.product.findMany({
      where: { status: "active" },
      take: Math.max(report.productSuggestions.length, 1),
      orderBy: { createdAt: "desc" }
    });

    for (const [index, suggestion] of report.productSuggestions.entries()) {
      await tx.productRecommendation.create({
        data: {
          userId,
          reportId,
          productId: products[index]?.id,
          category: suggestion.category,
          title: suggestion.title,
          reason: suggestion.reason,
          score: suggestion.score
        }
      });
    }

    return saved;
  });
}
