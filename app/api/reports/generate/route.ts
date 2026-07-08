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
  fallbackStructuredReport,
  ReportSchema,
  reportJsonInstruction
} from "@/lib/report-schema";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  assessmentId: z.string().optional(),
  assessmentResult: z.unknown()
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

  let assessmentId: string | undefined;
  if (parsed.data.assessmentId) {
    // The assessment must belong to the requesting user.
    const assessment = await prisma.tCMRecord.findFirst({
      where: { id: parsed.data.assessmentId, userId: user.id }
    });
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }
    assessmentId = assessment.id;
  }

  const model = "gpt-4o-mini";
  const estimatedTokens = estimateTokens(parsed.data.assessmentResult);
  const budgetError = await enforceAIUsageBudget({
    request,
    userId: user.id,
    model,
    estimatedTokens
  });
  if (budgetError) return budgetError;

  let report = fallbackStructuredReport();
  let tokens = estimatedTokens;

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You generate structured wellness reports for GB Medix. Never diagnose, prescribe, or claim medical certainty. " +
            reportJsonInstruction()
        },
        { role: "user", content: JSON.stringify(parsed.data.assessmentResult) }
      ]
    });

    const content = completion.choices[0]?.message.content || "";
    let rawReport: unknown;
    try {
      rawReport = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI report output was not valid JSON." }, { status: 502 });
    }

    const reportParse = ReportSchema.safeParse(rawReport);
    if (!reportParse.success) {
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

  const saved = await prisma.aIReport.create({
    data: {
      userId: user.id,
      assessmentId,
      type: "health_assessment",
      status: "completed",
      score: report.healthScore,
      summary: report.summary,
      analysis: report,
      recommendations: report.recommendations,
      lifestylePlan: report.lifestylePlan,
      productSuggestions: report.productSuggestions
    }
  });

  return NextResponse.json({
    reportId: saved.id,
    score: saved.score,
    summary: saved.summary,
    status: saved.status
  });
}
