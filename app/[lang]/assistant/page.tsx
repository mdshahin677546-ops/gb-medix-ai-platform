import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { AssistantChat } from "./assistant-chat";

export default function AssistantPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-6">
        <section className="glass-panel rounded-md p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-leaf">
            AI Wellness Companion
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_280px] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold text-ink sm:text-5xl">
                {lang === "zh"
                  ? "GB Medix AI \u5065\u5eb7\u52a9\u624b"
                  : "GB Medix AI Health Assistant"}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-ink/70">
                {lang === "zh"
                  ? "\u53ef\u4ee5\u54a8\u8be2\u7761\u7720\u3001\u75b2\u52b3\u3001\u996e\u98df\u8282\u5f8b\u3001\u8eab\u4f53\u611f\u53d7\uff0c\u4e5f\u53ef\u4ee5\u4e0a\u4f20\u62a5\u544a\u6216\u4ea7\u54c1\u56fe\u7247\u505a\u901a\u4fd7\u89e3\u91ca\u3002\u4ec5\u63d0\u4f9b\u5065\u5eb7\u751f\u6d3b\u65b9\u5f0f\u53c2\u8003\uff0c\u4e0d\u505a\u8bca\u65ad\u6216\u6cbb\u7597\u3002"
                  : "Ask about sleep, energy, diet rhythm, body sensations, report summaries, product images, or TCM-inspired constitution patterns. Wellness guidance only, never diagnosis or treatment."}
              </p>
            </div>
            <div className="dark-panel rounded-md p-4 text-white">
              <p className="text-xs uppercase tracking-[0.16em] text-mint/70">
                Safety Mode
              </p>
              <p className="mt-2 text-2xl font-semibold">No diagnosis</p>
              <p className="mt-2 text-sm text-white/65">
                Wellness, lifestyle, and pattern reflection only.
              </p>
            </div>
          </div>
        </section>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <AssistantChat lang={lang} />
          <aside className="grid content-start gap-4">
            <Panel title="Quick paths">
              <a className="block text-leaf" href={`/${lang}/tcm-check`}>
                Take body type test
              </a>
              <a className="mt-2 block text-leaf" href={`/${lang}/shop`}>
                View wellness products
              </a>
              <a className="mt-2 block text-leaf" href={`/${lang}/rfq`}>
                Submit B2B RFQ
              </a>
            </Panel>
            <Panel title="Supported topics">
              <ul className="grid gap-2 text-sm text-ink/70">
                <li>Sleep and fatigue patterns</li>
                <li>Diet and lifestyle rhythm</li>
                <li>Cold, heat, heaviness signals</li>
                <li>Report explanation in plain language</li>
                <li>Wellness product image recognition</li>
                <li>Family member wellness profiles</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-md p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
