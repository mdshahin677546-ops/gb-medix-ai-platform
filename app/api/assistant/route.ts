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
  mode: z.enum(["chat", "report", "product"]).default("chat"),
  imageData: z
    .string()
    .max(5_600_000)
    .refine(
      (value) =>
        value === "" ||
        value.startsWith("data:image/jpeg") ||
        value.startsWith("data:image/png") ||
        value.startsWith("data:image/webp"),
      "Only JPG, PNG, or WebP images are supported"
    )
    .optional()
    .or(z.literal("")),
  familyMember: z
    .object({
      name: z.string().optional(),
      age: z.string().optional(),
      note: z.string().optional()
    })
    .optional(),
  messages: z.array(messageSchema).min(1).max(12)
});

const systemPrompt = `You are GB Medix AI Wellness Assistant.

Product position:
* You are an original AI wellness companion for GB Medix, not a clone of any other brand.
* You can explain wellness patterns, lifestyle rhythm, sleep, energy, diet, stress, and TCM-inspired constitution signals.
* You can explain uploaded report images in plain language, but you must not interpret them as a diagnosis.
* You can identify supplement, nutrition, or wellness product images, but you must not prescribe use, dosage, or treatment.
* You may invite users to take the body type test when it helps them get a structured report.

Safety rules:
* Never diagnose diseases.
* Never treat conditions.
* Never prescribe medicine, herbs, supplements, or dosages.
* Never claim medical certainty.
* Never provide emergency medical instructions.
* Do not replace a licensed clinician.
* For severe, sudden, persistent, or concerning symptoms, advise the user to contact a qualified medical professional or local emergency services.

Style:
* Warm, concise, reflective, and practical.
* Use plain language.
* Keep answers under 180 words.
* End with one useful next step.`;

const fallbackReply =
  "I can reflect on this as a wellness pattern, not a diagnosis. Your signal may relate to sleep rhythm, meal timing, stress load, hydration, or recovery habits. A useful next step is to track sleep quality, energy level, meals, and body sensations for 3 days, then take the body type test for a structured TCM-inspired report.";

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Check text length and image size/type." },
      { status: 400 }
    );
  }

  const input = parsed.data;
  let reply =
    input.lang === "zh"
      ? "\u6211\u53ef\u4ee5\u4ece\u5065\u5eb7\u751f\u6d3b\u65b9\u5f0f\u89d2\u5ea6\u5e2e\u4f60\u68b3\u7406\uff0c\u4f46\u8fd9\u4e0d\u662f\u8bca\u65ad\u3002\u8fd9\u4e2a\u4fe1\u53f7\u53ef\u80fd\u548c\u7761\u7720\u8282\u5f8b\u3001\u996e\u98df\u65f6\u95f4\u3001\u538b\u529b\u8d1f\u8377\u3001\u8865\u6c34\u6216\u6062\u590d\u4e60\u60ef\u6709\u5173\u3002\u4e0b\u4e00\u6b65\u53ef\u4ee5\u8fde\u7eed 3 \u5929\u8bb0\u5f55\u7761\u7720\u3001\u75b2\u52b3\u3001\u996e\u98df\u548c\u8eab\u4f53\u51b7\u70ed\u6c89\u91cd\u611f\uff0c\u518d\u505a\u4f53\u8d28\u6d4b\u8bd5\u751f\u6210\u7ed3\u6784\u5316\u62a5\u544a\u3002"
      : fallbackReply;

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const lastUserMessage =
      input.messages.filter((message) => message.role === "user").at(-1)?.content || "";
    const context = `Language: ${input.lang}
Mode: ${input.mode}
Family member: ${input.familyMember?.name || "Self"}
Family note: ${input.familyMember?.note || "N/A"}
User message: ${lastUserMessage}`;
    const userContent = input.imageData
      ? [
          { type: "text", text: context },
          { type: "image_url", image_url: { url: input.imageData } }
        ]
      : context;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        ...input.messages.slice(0, -1).map((message) => ({
          role: message.role,
          content: message.content
        })),
        { role: "user", content: userContent as any }
      ]
    });

    reply = completion.choices[0]?.message.content || fallbackReply;
  }

  await ensureDatabase();
  const user = await getCurrentUser();
  await prisma.assistantSession.create({
    data: {
      userId: user?.id,
      lang: input.lang,
      mode: input.mode,
      input: JSON.stringify({
        familyMember: input.familyMember?.name || "Self",
        messages: input.messages.slice(-4)
      }),
      result: JSON.stringify({
        reply,
        familyMember: input.familyMember?.name || "Self"
      }),
      hasImage: Boolean(input.imageData)
    }
  });

  return NextResponse.json({ reply });
}
