import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { TCMCheckForm } from "./tcm-check-form";

const options = {
  sleepQuality: [
    "Deep and refreshing",
    "Light sleep",
    "Hard to fall asleep",
    "Wake up often",
    "Wake too early",
    "Dream-heavy sleep"
  ],
  fatigueLevel: ["Low", "Mild", "Medium", "High", "Exhausted after meals", "Afternoon crash"],
  emotionalState: [
    "Calm",
    "Stressed",
    "Anxious",
    "Irritable",
    "Low motivation",
    "Emotionally sensitive"
  ],
  dietHabits: [
    "Regular meals",
    "Irregular meals",
    "Often skips breakfast",
    "Craves sweets",
    "Heavy late dinners",
    "Cold/raw foods often",
    "Spicy foods often"
  ],
  bodySensations: [
    "Cold hands or feet",
    "Heat sensation",
    "Heaviness",
    "Bloating",
    "Dryness",
    "Sweating easily",
    "Tension in neck/shoulders"
  ],
  digestionPattern: [
    "Comfortable digestion",
    "Bloating after meals",
    "Low appetite",
    "Heavy after eating",
    "Acidic feeling",
    "Loose stool pattern",
    "Dry stool pattern"
  ],
  thirstPattern: [
    "Normal thirst",
    "Low thirst",
    "Dry mouth",
    "Prefers warm drinks",
    "Prefers cold drinks",
    "Thirst at night"
  ],
  activityLevel: [
    "Mostly sitting",
    "Light walking",
    "Regular workouts",
    "Intense workouts",
    "Low movement recently",
    "Feels worse after exertion"
  ],
  stressPattern: [
    "Low stress",
    "Work pressure",
    "Family pressure",
    "Screen fatigue",
    "Overthinking at night",
    "Tight schedule"
  ]
};

export default function TCMCheckPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-6">
        <section className="glass-panel rounded-md p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-leaf">
            Body Pattern Intake
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-ink">
            {lang === "zh" ? "\u4f53\u8d28\u5206\u6790\u95ee\u5377" : "TCM Body Type Test"}
          </h1>
          <p className="mt-3 max-w-3xl text-ink/70">
            {lang === "zh"
              ? "\u9009\u62e9\u8d8a\u4e30\u5bcc\uff0cAI \u62a5\u544a\u8d8a\u80fd\u63cf\u8ff0\u4f60\u7684\u7761\u7720\u3001\u75b2\u52b3\u3001\u996e\u98df\u3001\u51b7\u70ed\u548c\u751f\u6d3b\u8282\u5f8b\u6a21\u5f0f\u3002"
              : "Choose the options that match your daily patterns. Richer input creates a more useful wellness report."}
          </p>
        </section>
        <TCMCheckForm lang={lang}>
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField label="Sleep quality" name="sleepQuality" items={options.sleepQuality} />
            <SelectField label="Fatigue level" name="fatigueLevel" items={options.fatigueLevel} />
            <SelectField label="Emotional state" name="emotionalState" items={options.emotionalState} />
            <SelectField label="Activity level" name="activityLevel" items={options.activityLevel} />
          </div>

          <CheckboxGroup label="Diet habits" name="dietHabits" items={options.dietHabits} />
          <CheckboxGroup
            label="Body sensations"
            name="bodySensations"
            items={options.bodySensations}
          />
          <CheckboxGroup
            label="Digestion pattern"
            name="digestionPattern"
            items={options.digestionPattern}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <CheckboxGroup
              label="Thirst and temperature preference"
              name="thirstPattern"
              items={options.thirstPattern}
            />
            <CheckboxGroup
              label="Stress rhythm"
              name="stressPattern"
              items={options.stressPattern}
            />
          </div>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Extra notes
            <textarea
              name="extraNotes"
              rows={4}
              placeholder="Anything else about your daily rhythm?"
              className="premium-input rounded-md px-3 py-3"
            />
          </label>
        </TCMCheckForm>
      </div>
    </Shell>
  );
}

function SelectField({
  label,
  name,
  items
}: {
  label: string;
  name: string;
  items: string[];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      {label}
      <select name={name} required className="premium-input rounded-md px-3 py-3">
        <option value="">Select one</option>
        {items.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGroup({
  label,
  name,
  items
}: {
  label: string;
  name: string;
  items: string[];
}) {
  return (
    <fieldset className="rounded-md border border-black/10 bg-white/45 p-4">
      <legend className="px-1 text-sm font-semibold text-ink">{label}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <label
            key={item}
            className="flex items-center gap-2 rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm text-ink/75 transition hover:border-leaf"
          >
            <input name={name} value={item} type="checkbox" className="accent-leaf" />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
