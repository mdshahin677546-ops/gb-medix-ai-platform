import { Field } from "@/components/Field";
import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { TCMCheckForm } from "./tcm-check-form";

export default function TCMCheckPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-ink">TCM Body Type Test</h1>
          <p className="mt-2 max-w-2xl text-ink/70">
            Share a few wellness signals to receive a TCM-inspired body pattern
            reflection.
          </p>
        </div>
        <TCMCheckForm lang={lang}>
          <Field label="Sleep quality" name="sleepQuality" />
          <Field label="Fatigue level" name="fatigueLevel">
            <select
              name="fatigueLevel"
              required
              className="rounded-md border border-black/15 bg-white px-3 py-3 outline-none focus:border-leaf"
            >
              <option value="">Select</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </Field>
          <Field label="Emotional state" name="emotionalState" />
          <Field label="Diet habits" name="dietHabits" />
          <Field label="Body sensations" name="bodySensations">
            <select
              name="bodySensations"
              required
              className="rounded-md border border-black/15 bg-white px-3 py-3 outline-none focus:border-leaf"
            >
              <option value="">Select</option>
              <option>Cold</option>
              <option>Heat</option>
              <option>Heaviness</option>
            </select>
          </Field>
        </TCMCheckForm>
      </div>
    </Shell>
  );
}
