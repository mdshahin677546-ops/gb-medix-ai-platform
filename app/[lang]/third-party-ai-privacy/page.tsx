import Link from "next/link";
import { Shell } from "@/components/Shell";
import { getLang, type Lang } from "@/lib/lang";

const providers = ["DeepSeek", "Qwen", "Kimi", "GLM", "Doubao"];

const content = {
  en: {
    eyebrow: "Third-party AI processing notice",
    title: "How GB Medix AI uses third-party AI services",
    intro:
      "GB Medix AI may use third-party AI providers to process the health assessment information you submit. This processing is used only to generate health management suggestions, wellness reports, lifestyle guidance, and TCM-inspired body pattern summaries.",
    back: "Back to health assessment",
    sections: [
      {
        title: "Third-party AI services",
        body:
          "This notice currently applies to third-party AI providers including DeepSeek, Qwen, Kimi, GLM, and Doubao. Before these providers process your assessment information, GB Medix asks for your active consent."
      },
      {
        title: "Data types processed",
        body:
          "The provider may process health assessment questionnaire answers, sleep, fatigue, diet, stress, activity, digestion and lifestyle pattern inputs, optional uploaded context summaries, current language, report type, and desensitized health context required to generate a report."
      },
      {
        title: "Processing purpose",
        body:
          "Third-party AI processing is used to support AI health assessment, free health result generation, Premium AI health report generation, lifestyle guidance, and health management recommendations."
      },
      {
        title: "Data minimization",
        body:
          "GB Medix is designed to avoid sending email, user ID, payment ID, Stripe session ID, entitlement ID, IP address, auth session data, raw database records, admin fields, secrets, or API keys to AI providers."
      },
      {
        title: "Withdrawal of consent",
        body:
          "You can revoke consent from your dashboard. After consent is revoked, third-party AI providers cannot be used again for your account until you accept the notice again. Revocation prevents future third-party AI processing, but it does not automatically delete historical reports."
      },
      {
        title: "Non-medical disclaimer",
        body:
          "GB Medix AI provides health management guidance and lifestyle education. It does not provide medical diagnosis, treatment, prescriptions, disease probability, or clinical triage. It is not a replacement for a licensed healthcare professional."
      }
    ]
  },
  zh: {
    eyebrow: "\u7b2c\u4e09\u65b9 AI \u5904\u7406\u8bf4\u660e",
    title: "GB Medix AI \u5982\u4f55\u4f7f\u7528\u7b2c\u4e09\u65b9 AI \u670d\u52a1",
    intro:
      "GB Medix AI \u53ef\u80fd\u4f7f\u7528\u7b2c\u4e09\u65b9 AI Provider \u5904\u7406\u4f60\u63d0\u4ea4\u7684\u5065\u5eb7\u8bc4\u4f30\u4fe1\u606f\u3002\u8be5\u5904\u7406\u4ec5\u7528\u4e8e\u751f\u6210\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae\u3001\u5065\u5eb7\u62a5\u544a\u3001\u751f\u6d3b\u65b9\u5f0f\u6307\u5bfc\u548c\u4e2d\u533b\u542f\u53d1\u7684\u4f53\u8d28\u6a21\u5f0f\u603b\u7ed3\u3002",
    back: "\u8fd4\u56de\u5065\u5eb7\u8bc4\u4f30",
    sections: [
      {
        title: "\u7b2c\u4e09\u65b9 AI \u670d\u52a1",
        body:
          "\u672c\u8bf4\u660e\u5f53\u524d\u9002\u7528\u4e8e DeepSeek\u3001Qwen\u3001Kimi\u3001GLM\u3001Doubao \u7b49\u7b2c\u4e09\u65b9 AI Provider\u3002\u5728\u8fd9\u4e9b Provider \u5904\u7406\u4f60\u7684\u8bc4\u4f30\u4fe1\u606f\u524d\uff0cGB Medix \u4f1a\u8981\u6c42\u4f60\u4e3b\u52a8\u540c\u610f\u3002"
      },
      {
        title: "\u5904\u7406\u7684\u6570\u636e\u7c7b\u578b",
        body:
          "Provider \u53ef\u80fd\u5904\u7406\u5065\u5eb7\u8bc4\u4f30\u95ee\u5377\u7b54\u6848\uff0c\u7761\u7720\u3001\u75b2\u52b3\u3001\u996e\u98df\u3001\u538b\u529b\u3001\u6d3b\u52a8\u3001\u6d88\u5316\u548c\u751f\u6d3b\u65b9\u5f0f\u6a21\u5f0f\u8f93\u5165\uff0c\u53ef\u9009\u4e0a\u4f20\u7684\u4e0a\u4e0b\u6587\u6458\u8981\uff0c\u5f53\u524d\u8bed\u8a00\uff0c\u62a5\u544a\u7c7b\u578b\uff0c\u4ee5\u53ca\u751f\u6210\u62a5\u544a\u6240\u9700\u7684\u53bb\u6807\u8bc6\u5316\u5065\u5eb7\u4e0a\u4e0b\u6587\u3002"
      },
      {
        title: "\u5904\u7406\u76ee\u7684",
        body:
          "\u7b2c\u4e09\u65b9 AI \u5904\u7406\u4ec5\u7528\u4e8e\u652f\u6301 AI \u5065\u5eb7\u8bc4\u4f30\u3001\u514d\u8d39\u5065\u5eb7\u7ed3\u679c\u751f\u6210\u3001Premium AI \u5065\u5eb7\u62a5\u544a\u751f\u6210\u3001\u751f\u6d3b\u65b9\u5f0f\u6307\u5bfc\u548c\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae\u3002"
      },
      {
        title: "\u6570\u636e\u6700\u5c0f\u5316",
        body:
          "GB Medix \u7684\u8bbe\u8ba1\u76ee\u6807\u662f\u907f\u514d\u5411 AI Provider \u53d1\u9001\u90ae\u7bb1\u3001\u7528\u6237 ID\u3001\u652f\u4ed8 ID\u3001Stripe session ID\u3001\u6743\u76ca ID\u3001IP \u5730\u5740\u3001\u767b\u5f55 session \u6570\u636e\u3001\u539f\u59cb\u6570\u636e\u5e93\u8bb0\u5f55\u3001\u7ba1\u7406\u5b57\u6bb5\u3001\u5bc6\u94a5\u6216 API key\u3002"
      },
      {
        title: "\u64a4\u56de\u540c\u610f",
        body:
          "\u4f60\u53ef\u4ee5\u5728\u7528\u6237\u5065\u5eb7\u4e2d\u5fc3\u64a4\u56de\u540c\u610f\u3002\u64a4\u56de\u540e\uff0c\u5728\u4f60\u91cd\u65b0\u540c\u610f\u524d\uff0c\u7b2c\u4e09\u65b9 AI Provider \u4e0d\u4f1a\u518d\u7528\u4e8e\u4f60\u7684\u8d26\u6237\u3002\u64a4\u56de\u4f1a\u963b\u6b62\u672a\u6765\u7684\u7b2c\u4e09\u65b9 AI \u5904\u7406\uff0c\u4f46\u4e0d\u4f1a\u81ea\u52a8\u5220\u9664\u5386\u53f2\u62a5\u544a\u3002"
      },
      {
        title: "\u975e\u533b\u7597\u8bca\u65ad\u58f0\u660e",
        body:
          "GB Medix AI \u4ec5\u63d0\u4f9b\u5065\u5eb7\u7ba1\u7406\u5efa\u8bae\u548c\u751f\u6d3b\u65b9\u5f0f\u6559\u80b2\u3002\u5b83\u4e0d\u63d0\u4f9b\u533b\u7597\u8bca\u65ad\u3001\u6cbb\u7597\u3001\u5904\u65b9\u3001\u75be\u75c5\u6982\u7387\u6216\u4e34\u5e8a\u5206\u8bca\u5efa\u8bae\uff0c\u4e5f\u4e0d\u66ff\u4ee3\u6301\u7167\u533b\u7597\u4e13\u4e1a\u4eba\u5458\u3002"
      }
    ]
  }
} satisfies Record<"en" | "zh", {
  eyebrow: string;
  title: string;
  intro: string;
  back: string;
  sections: Array<{ title: string; body: string }>;
}>;

export default function ThirdPartyAIPrivacyPage({
  params
}: {
  params: { lang: string };
}) {
  const lang = getLang(params.lang);
  const text = lang === "zh" ? content.zh : content.en;

  return (
    <Shell lang={lang}>
      <article className="glass-panel rounded-md p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-leaf">
          {text.eyebrow}
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-ink sm:text-5xl">
          {text.title}
        </h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-ink/70">
          {text.intro}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {providers.map((provider) => (
            <span
              key={provider}
              className="rounded-md border border-mint/25 bg-mint/10 px-3 py-1 text-sm text-mint"
            >
              {provider}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-4">
          {text.sections.map((section) => (
            <section key={section.title} className="rounded-md border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
              <p className="mt-3 leading-7 text-ink/68">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-md border border-amber/25 bg-amber/10 p-4 text-sm leading-6 text-ink/72">
          {lang === "zh"
            ? "\u5982\u679c\u4f60\u6709\u7d27\u6025\u5065\u5eb7\u95ee\u9898\u6216\u9700\u8981\u533b\u7597\u51b3\u7b56\uff0c\u8bf7\u8054\u7cfb\u6301\u7167\u533b\u7597\u4e13\u4e1a\u4eba\u5458\u6216\u5f53\u5730\u7d27\u6025\u670d\u52a1\u3002"
            : "If you have urgent health concerns or need medical decisions, contact a licensed healthcare professional or local emergency services."}
        </div>

        <Link
          href={`/${lang}/tcm-check`}
          className="mt-6 inline-flex rounded-md border border-mint/30 px-5 py-3 font-semibold text-mint transition hover:bg-mint/10"
        >
          {text.back}
        </Link>
      </article>
    </Shell>
  );
}
