import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getConfiguredAIProviderName, getSafeAIError } from "@/lib/ai/provider-factory";
import { acceptAIConsent } from "@/lib/ai-consent/consent-service";

const acceptSchema = z.object({
  accepted: z.literal(true)
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before managing AI consent." }, { status: 401 });
  }

  const parsed = acceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Explicit AI processing consent is required." }, { status: 400 });
  }

  try {
    const provider = getConfiguredAIProviderName();
    const status = await acceptAIConsent(user.id, provider);
    return NextResponse.json(status);
  } catch (error) {
    const safeError = getSafeAIError(error);
    return NextResponse.json({ error: safeError.message }, { status: safeError.status });
  }
}
