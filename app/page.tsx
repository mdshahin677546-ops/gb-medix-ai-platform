import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

const homeCopy = {
  en: {
    signIn: "Sign in",
    startFree: "Start free",
    eyebrow: "AI health management",
    heading: "AI Health Assessment",
    lede: "Understand your body patterns in about 3 minutes, receive a free AI health result, and choose whether to unlock a Premium health management report.",
    primaryCta: "Start free health assessment",
    secondaryCta: "中文免费检测",
    secondaryHref: "/zh/tcm-check",
    steps: ["Verify your email", "Complete the 3-minute intake", "Read your AI report"],
    disclaimer:
      "GB Medix AI provides wellness education and health management suggestions. It is not a medical diagnosis, treatment plan, emergency service, or a replacement for a licensed healthcare professional.",
    freeResult: "Free result",
    readyAfterIntake: "Ready after intake",
    freeScope:
      "Health score, constitution pattern, basic insights, and limited health management suggestions.",
    cards: [
      {
        title: "AI Health Assessment",
        description: "Answer a short wellness intake and receive a free AI health result."
      },
      {
        title: "Health Management Center",
        description: "Review your reports, plans, and next wellness steps in one place."
      },
      {
        title: "Wellness Products",
        description: "Explore health product options after your assessment guidance."
      }
    ]
  },
  zh: {
    signIn: "登录",
    startFree: "免费开始",
    eyebrow: "AI 健康管理",
    heading: "AI 健康评估",
    lede: "约 3 分钟了解你的身体模式,获取免费 AI 健康结果,并自主选择是否解锁 Premium 健康管理报告。",
    primaryCta: "开始免费健康评估",
    secondaryCta: "English version",
    secondaryHref: "/en/tcm-check",
    steps: ["验证邮箱", "完成 3 分钟问卷", "阅读 AI 报告"],
    disclaimer:
      "GB Medix AI 提供健康科普与健康管理建议,不构成医疗诊断、治疗方案、急救服务,也不能替代持证医疗专业人员。",
    freeResult: "免费结果",
    readyAfterIntake: "完成问卷后生成",
    freeScope: "健康评分、体质模式、基础洞察与有限的健康管理建议。",
    cards: [
      {
        title: "AI 健康评估",
        description: "完成简短的健康问卷,获取免费 AI 健康结果。"
      },
      {
        title: "健康管理中心",
        description: "在一处查看你的报告、方案与下一步建议。"
      },
      {
        title: "健康产品",
        description: "在评估建议之后,按需浏览健康产品选项。"
      }
    ]
  }
} as const;

export default function HomePage() {
  const acceptLanguage = headers().get("accept-language") || "";
  const lang = acceptLanguage.toLowerCase().startsWith("zh") ? "zh" : "en";
  const text = homeCopy[lang];
  const cardHrefs = [`/${lang}/tcm-check`, `/${lang}/dashboard`, `/${lang}/shop`];

  return (
    <main className="ambient-grid min-h-screen text-ink">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
          <span className="brand-mark rounded-md text-sm font-bold">GB</span>
          <span>GB Medix AI</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/${lang}/account`} className="rounded-md border border-white/10 px-4 py-2 text-ink/75 hover:text-white">
            {text.signIn}
          </Link>
          <Link href={`/${lang}/tcm-check`} className="premium-button rounded-md px-4 py-2 font-semibold">
            {text.startFree}
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-5 pb-10 pt-4 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">
            {text.eyebrow}
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-white sm:text-6xl">
            {text.heading}
          </h1>
          <p className="mt-5 text-xl leading-8 text-ink/78">{text.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${lang}/tcm-check`} className="premium-button rounded-md px-6 py-3 font-semibold">
              {text.primaryCta}
            </Link>
            <Link href={text.secondaryHref} className="rounded-md border border-mint/30 px-6 py-3 font-semibold text-mint hover:bg-mint/10">
              {text.secondaryCta}
            </Link>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wide text-ink/60">
            {text.steps.map((step, index) => (
              <span key={step}>
                <span className="text-mint">{String(index + 1).padStart(2, "0")}</span> {step}
              </span>
            ))}
          </p>
          <p className="mt-6 rounded-md border border-amber/25 bg-amber/10 p-4 text-sm leading-6 text-ink/72">
            {text.disclaimer}
          </p>
        </div>

        <div className="glass-panel overflow-hidden p-5">
          <div className="relative min-h-[430px] overflow-hidden rounded-md border border-white/10 bg-[#061522]">
            <Image
              src="/assets/medical-body-scan.png"
              alt={text.heading}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-contain p-8 opacity-90"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#061522] to-transparent p-5">
              <div className="grid gap-3 rounded-md border border-white/10 bg-black/30 p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink/65">{text.freeResult}</span>
                  <span className="rounded-md bg-mint/10 px-3 py-1 text-sm text-mint">
                    {text.readyAfterIntake}
                  </span>
                </div>
                <div className="h-2 rounded-md bg-white/10">
                  <div className="h-2 w-3/4 rounded-md bg-mint" />
                </div>
                <p className="text-sm text-ink/68">{text.freeScope}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#030914]/70 px-5 py-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {text.cards.map((card, index) => (
            <Link
              key={card.title}
              href={cardHrefs[index]}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-mint/40 hover:bg-mint/[0.06]"
            >
              <h2 className="text-xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 leading-6 text-ink/65">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
