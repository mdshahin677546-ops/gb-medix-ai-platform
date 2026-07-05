import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";

const days = [
  "Day 1: Warm breakfast, steady hydration, and a gentle evening walk.",
  "Day 2: Reduce late stimulants and add a 10-minute screen-free wind-down.",
  "Day 3: Choose cooked vegetables, balanced protein, and regular meal timing.",
  "Day 4: Add light stretching and observe cold, heat, or heaviness patterns.",
  "Day 5: Protect sleep timing and keep dinner simple.",
  "Day 6: Practice a calm breathing reset after work or study.",
  "Day 7: Review your strongest signals and keep the routines that improved energy."
];

export default function SuccessPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-5">
        <h1 className="text-3xl font-semibold text-ink">
          Your Full 7-Day Body Reset Plan
        </h1>
        <PlanSection title="Full 7-day wellness plan" items={days} />
        <PlanSection
          title="Diet suggestions"
          items={[
            "Favor warm, cooked meals and consistent meal timing.",
            "Pair carbohydrates with protein or healthy fats for steadier energy.",
            "Keep evening meals simple and avoid heavy late snacking."
          ]}
        />
        <PlanSection
          title="Lifestyle reset plan"
          items={[
            "Use short daily walks to support circulation and decompression.",
            "Create a repeatable morning rhythm before checking messages.",
            "Track sleep, meals, and body sensations for seven days."
          ]}
        />
        <PlanSection
          title="Sleep improvement plan"
          items={[
            "Keep a stable bedtime window.",
            "Dim lights 45 minutes before bed.",
            "Use a short breathing routine when your mind feels active."
          ]}
        />
      </div>
    </Shell>
  );
}

function PlanSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-black/10 bg-white p-5">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <ul className="mt-3 grid gap-2 text-ink/75">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
