import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  enforceAIUsageBudget,
  estimateTokens,
  recordAIUsage
} from "@/lib/ai-security";
import { getAIProvider, getSafeAIError } from "@/lib/ai/provider-factory";
import { buildHealthAssessmentSystemPrompt } from "@/lib/ai/prompts";
import { buildMinimalHealthPayload } from "@/lib/ai/sanitize";
import { prisma } from "@/lib/prisma";
import {
  fallbackStructuredReport,
  structuredReportToTCMResult,
  toFreeReportPayload
} from "@/lib/report-schema";

const inputSchema = z.object({
  sleepQuality: z.string().min(1),
  fatigueLevel: z.string().min(1),
  emotionalState: z.string().min(1),
  dietHabits: z.string().min(1),
  bodySensations: z.string().min(1),
  digestionPattern: z.string().optional().default(""),
  thirstPattern: z.string().optional().default(""),
  activityLevel: z.string().optional().default(""),
  stressPattern: z.string().optional().default(""),
  uploadSummary: z.string().optional().default(""),
  extraNotes: z.string().optional().default(""),
  lang: z.string().default("en")
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid TCM assessment input." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before AI assessment." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json(
      { error: "Please verify your email before AI assessment." },
      { status: 403 }
    );
  }

  const input = parsed.data;
  let provider;
  try {
    provider = getAIProvider();
  } catch (error) {
    const safeError = getSafeAIError(error);
    return NextResponse.json({ error: safeError.message }, { status: safeError.status });
  }

  const model = provider.model;
  const aiInput = buildMinimalHealthPayload(input);
  const estimatedTokens = estimateTokens(aiInput);
  const budgetError = await enforceAIUsageBudget({
    request,
    userId: user.id,
    provider: provider.name,
    model,
    estimatedTokens
  });
  if (budgetError) return budgetError;

  let report = fallbackStructuredReport();
  let tokens = estimatedTokens;

  try {
    const completion = await provider.generateHealthAssessment({
      systemPrompt: buildHealthAssessmentSystemPrompt(),
      input: aiInput,
      temperature: 0.5,
    });
    report = completion.content;
    tokens = completion.usage.totalTokens || estimatedTokens;
  } catch (error) {
    const safeError = getSafeAIError(error);
    return NextResponse.json({ error: safeError.message }, { status: safeError.status });
  }

  await recordAIUsage({
    request,
    userId: user.id,
    provider: provider.name,
    model,
    tokens,
    endpoint: "/api/tcm"
  });
  const result = structuredReportToTCMResult(report);

  const record = await prisma.tCMRecord.create({
    data: {
      userId: user.id,
      kind: "tcm_analysis",
      input: JSON.stringify(input),
      result: JSON.stringify(result)
    }
  });
  const freeReport = toFreeReportPayload(report);
  const savedReport = await prisma.aIReport.create({
    data: {
      userId: user.id,
      assessmentId: record.id,
      type: "free_health_report",
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

  return NextResponse.json({ id: record.id, reportId: savedReport.id, result });
}
