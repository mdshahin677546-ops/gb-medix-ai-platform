import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  enforceAIUsageBudget,
  estimateTokens,
  recordAIUsage
} from "@/lib/ai-security";
import { prisma } from "@/lib/prisma";
import {
  fallbackStructuredReport,
  ReportSchema,
  reportJsonInstruction,
  structuredReportToTCMResult
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

const systemPrompt = `You are GB Medix AI Wellness Assistant.

Rules:
* Never diagnose
* Never treat disease
* Never prescribe
* Never claim medical certainty
* Only provide wellness insights, body pattern analysis, lifestyle suggestions, and TCM-inspired constitution classification.
* Do not provide emergency medical instructions.
* Keep conversion language curious and reflective, not salesy.
* ${reportJsonInstruction()}`;

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
  const model = "gpt-4o-mini";
  const estimatedTokens = estimateTokens(input);
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
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Language: ${input.lang}
Sleep quality: ${input.sleepQuality}
Fatigue level: ${input.fatigueLevel}
Emotional state: ${input.emotionalState}
Diet habits: ${input.dietHabits}
Body sensations: ${input.bodySensations}
Digestion pattern: ${input.digestionPattern}
Thirst and temperature preference: ${input.thirstPattern}
Activity level: ${input.activityLevel}
Stress rhythm: ${input.stressPattern}
Uploaded context: ${input.uploadSummary || "No uploaded file"}
Extra notes: ${input.extraNotes}`
        }
      ]
    });

    const content = completion.choices[0]?.message.content || "";
    let rawReport: unknown;
    try {
      rawReport = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "AI report output was not valid JSON." },
        { status: 502 }
      );
    }
    const parsedReport = ReportSchema.safeParse(rawReport);
    if (!parsedReport.success) {
      return NextResponse.json(
        { error: "AI report output failed schema validation." },
        { status: 502 }
      );
    }
    report = parsedReport.data;
    tokens = completion.usage?.total_tokens || estimatedTokens;
  }

  await recordAIUsage({ request, userId: user.id, model, tokens, endpoint: "/api/tcm" });
  const result = structuredReportToTCMResult(report);

  const record = await prisma.tCMRecord.create({
    data: {
      userId: user.id,
      kind: "tcm_analysis",
      input: JSON.stringify(input),
      result: JSON.stringify(result)
    }
  });
  await prisma.aIReport.create({
    data: {
      userId: user.id,
      assessmentId: record.id,
      type: "tcm_assessment",
      status: "completed",
      score: report.healthScore,
      summary: report.summary,
      analysis: report,
      recommendations: report.recommendations,
      lifestylePlan: report.lifestylePlan,
      productSuggestions: report.productSuggestions
    }
  });

  return NextResponse.json({ id: record.id, result });
}
