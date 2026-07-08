import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000)
});

const requestSchema = z.object({
  lang: z.string().default("en"),
  messages: z.array(messageSchema).min(1).max(12)
});

const freeLimit = 3;

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid consultation request" }, { status: 400 });
  }

  await ensureDatabase();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before consultation." }, { status: 401 });
  }

  const used = await prisma.assistantSession.count({
    where: { userId: user.id, mode: "consult" }
  });
  const hasUnlock = await prisma.paymentRecord.findFirst({
    where: {
      userId: user.id,
      product: "consult_pack",
      status: { in: ["paid", "demo_without_stripe_key", "alipay_demo"] }
    }
  });

  if (used >= freeLimit && !hasUnlock) {
    return NextResponse.json(
      {
        error:
          parsed.data.lang === "zh"
            ? "\u4f60\u7684 3 \u6761\u514d\u8d39\u9884\u95ee\u8bca\u5df2\u7528\u5b8c\u3002\u5185\u6d4b\u4ef7 $0.69\uff08\u7ea6 CNY 4.90\uff09\u89e3\u9501\u7ee7\u7eed\u54a8\u8be2\u3002"
            : "Your 3 free pre-consultation messages are used. Beta price is $0.69, about CNY 4.90, to continue.",
        remaining: 0
      },
      { status: 402 }
    );
  }

  const lastUserMessage =
    parsed.data.messages.filter((message) => message.role === "user").at(-1)?.content || "";
  let reply =
    parsed.data.lang === "zh"
      ? "\u6211\u53ef\u4ee5\u5148\u5e2e\u4f60\u628a\u95ee\u9898\u6574\u7406\u6e05\u695a\uff0c\u4f46\u8fd9\u4e0d\u662f\u533b\u751f\u8bca\u65ad\u3002\u5efa\u8bae\u4f60\u8bb0\u5f55\u51fa\u73b0\u65f6\u95f4\u3001\u6301\u7eed\u65f6\u957f\u3001\u4f34\u968f\u611f\u53d7\u548c\u8fd1\u671f\u4f5c\u606f\u996e\u98df\uff0c\u540e\u7eed\u771f\u4eba\u533b\u751f\u5bf9\u63a5\u65f6\u4f1a\u66f4\u6709\u6548\u3002"
      : "I can help organize your question, but this is not a medical diagnosis. Note timing, duration, related sensations, and recent sleep or meal changes so a future licensed doctor can review more efficiently.";

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are GB Medix AI pre-consultation assistant. The online doctor service is in beta and not currently active. Help users organize symptoms/questions for a future licensed doctor handoff. Never diagnose, prescribe, treat, claim certainty, or replace a doctor. For severe, sudden, or urgent symptoms, advise contacting local emergency services or a qualified clinician."
        },
        { role: "user", content: `Language: ${parsed.data.lang}\nUser question: ${lastUserMessage}` }
      ]
    });
    reply = completion.choices[0]?.message.content || reply;
  }

  await prisma.assistantSession.create({
    data: {
      userId: user.id,
      lang: parsed.data.lang,
      mode: "consult",
      input: JSON.stringify({ messages: parsed.data.messages.slice(-4) }),
      result: JSON.stringify({ reply }),
      hasImage: false
    }
  });

  return NextResponse.json({
    reply,
    remaining: hasUnlock ? freeLimit : Math.max(0, freeLimit - used - 1)
  });
}
