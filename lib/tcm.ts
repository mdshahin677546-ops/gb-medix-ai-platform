export type TCMInput = {
  sleepQuality: string;
  fatigueLevel: string;
  emotionalState: string;
  dietHabits: string;
  bodySensations: string;
  lang: string;
};

export type TCMResult = {
  bodyInsight: string;
  constitutionType: string;
  whatYourBodyIsTellingYou: string;
  lifestyleSuggestions: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  hiddenSignals: string[];
  sevenDayPlanPreview: string[];
  upgradeCta: string;
};

export const fallbackResult: TCMResult = {
  bodyInsight:
    "Your answers suggest a stress-and-recovery pattern where energy may fluctuate with sleep rhythm, meals, and emotional load.",
  constitutionType: "TCM-inspired balanced-deficiency pattern",
  whatYourBodyIsTellingYou:
    "This explains your pattern: your body may be asking for steadier rest, warmer routines, and simpler meals so your daily energy feels less scattered.",
  lifestyleSuggestions: [
    "Keep meals regular and favor warm, cooked foods for the next few days.",
    "Add a 10-minute wind-down routine before sleep.",
    "Use light movement after meals instead of intense late workouts."
  ],
  riskLevel: "LOW",
  hiddenSignals: [
    "A timing pattern may be affecting your afternoon energy...",
    "One body sensation may point to how you recover after meals...",
    "Your sleep response may reveal a deeper lifestyle rhythm..."
  ],
  sevenDayPlanPreview: [
    "Day 1: Reset your morning hydration and breakfast rhythm.",
    "Day 2: Add a gentle evening wind-down routine."
  ],
  upgradeCta:
    "Unlock the full 7-day Body Reset Plan for $9.99 to see the remaining daily steps, food suggestions, and sleep reset."
};

export function parseStructuredResult(text: string): TCMResult {
  const section = (title: string) => {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(
      new RegExp(`## ${escaped}\\s*([\\s\\S]*?)(?=\\n## |$)`, "i")
    );
    return match?.[1]?.trim() || "";
  };

  const list = (value: string) =>
    value
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);

  const risk = section("Risk Level").toUpperCase();

  const lifestyleSuggestions = list(section("Lifestyle Suggestions")).slice(0, 5);
  const hiddenSignals = list(
    section("Hidden Signals (3 not fully revealed insights)")
  ).slice(0, 3);
  const sevenDayPlanPreview = list(section("7-Day Plan Preview (30%)")).slice(0, 3);

  return {
    bodyInsight: section("Body Insight") || fallbackResult.bodyInsight,
    constitutionType: section("Constitution Type") || fallbackResult.constitutionType,
    whatYourBodyIsTellingYou:
      section("What Your Body Is Telling You") ||
      fallbackResult.whatYourBodyIsTellingYou,
    lifestyleSuggestions: lifestyleSuggestions.length
      ? lifestyleSuggestions
      : fallbackResult.lifestyleSuggestions,
    riskLevel: risk.includes("HIGH") ? "HIGH" : risk.includes("MEDIUM") ? "MEDIUM" : "LOW",
    hiddenSignals: hiddenSignals.length ? hiddenSignals : fallbackResult.hiddenSignals,
    sevenDayPlanPreview: sevenDayPlanPreview.length
      ? sevenDayPlanPreview
      : fallbackResult.sevenDayPlanPreview,
    upgradeCta: section("Upgrade CTA ($9.99)") || fallbackResult.upgradeCta
  };
}
