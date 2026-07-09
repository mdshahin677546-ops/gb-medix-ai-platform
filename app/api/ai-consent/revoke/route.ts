import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConfiguredAIProviderName, getSafeAIError } from "@/lib/ai/provider-factory";
import { revokeAIConsent } from "@/lib/ai-consent/consent-service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before managing AI consent." }, { status: 401 });
  }

  try {
    const provider = getConfiguredAIProviderName();
    const status = await revokeAIConsent(user.id, provider);
    return NextResponse.json(status);
  } catch (error) {
    const safeError = getSafeAIError(error);
    return NextResponse.json({ error: safeError.message }, { status: safeError.status });
  }
}
