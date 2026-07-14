import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { getFunnelCopy } from "@/lib/public-funnel/i18n";
import { consultMetadata } from "@/lib/public-funnel/consult-context";
import { PublicSiteLayout } from "@/components/public/PublicSiteLayout";
import { Container, Card, ButtonLink, Badge } from "@/components/public/ui";
import { MedicalDisclaimer } from "@/components/public/medical";

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  return consultMetadata(getFunnelCopy(getLang(params.lang)));
}

export default function AiConsultInfoPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  const copy = getFunnelCopy(lang);
  const zh = lang === "zh";

  const blocks: { title: string; body: string }[] = [
    { title: copy.consult.solves, body: zh ? "帮助你把当前健康问题整理清楚：梳理症状与背景、生成结构化的问诊记录、指出何时应寻求专业医疗。" : "Helps you organize a current health question: structure symptoms and background, produce a structured pre-consult record, and flag when to seek professional care." },
    { title: copy.consult.notSolves, body: zh ? "不做医学诊断、不开处方、不替代医生或急救；不判断具体疾病，也不提供个体化治疗方案。" : "It does not diagnose, prescribe, or replace a clinician or emergency care; it does not determine a specific disease or provide individualized treatment." },
    { title: copy.consult.youProvide, body: zh ? "基础信息与当前健康问题的描述。请勿提交身份证号、银行卡等敏感信息。" : "Basic information and a description of your current health concern. Do not submit sensitive data such as ID or card numbers." },
    { title: copy.consult.riskHandling, body: zh ? "识别到危险信号时，会以高可见方式提示你及时联系专业医疗人员或当地急救服务。" : "When a danger signal is detected, you are prompted — with high visibility — to promptly contact a professional or local emergency services." },
    { title: copy.consult.report, body: zh ? "输出结构化的健康问诊记录，便于后续人工复核或就医参考。" : "Produces a structured pre-consult record for later human review or a clinical visit." },
    { title: copy.consult.privacy, body: zh ? "遵循现有隐私政策与第三方 AI 说明。" : "Follows the existing privacy policy and third-party AI notice." }
  ];

  return (
    <PublicSiteLayout lang={lang}>
      <div className="py-10 sm:py-14">
        <Container narrow>
          <Badge tone="info">{zh ? "内测中" : "Beta"}</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">{copy.consult.title}</h1>
          <p className="mt-2 text-sm text-ink/70">{zh ? "AI 预问诊帮助你整理健康问题；医生对接能力已预留、目前内测中。" : "AI pre-consultation helps organize your questions; doctor handoff is reserved and currently in beta."}</p>
          <div className="mt-4"><MedicalDisclaimer copy={copy} full /></div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {blocks.map((b) => (
              <Card key={b.title} className="p-5">
                <h2 className="text-sm font-semibold text-ink">{b.title}</h2>
                <p className="mt-2 text-sm text-ink/75">{b.body}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`/${lang}/consult`} variant="primary" onClickEventName="roundtable_to_consult_click">{copy.consult.start}</ButtonLink>
            <ButtonLink href={`/${lang}/roundtable`} variant="ghost">{copy.nav.roundtable} →</ButtonLink>
          </div>
        </Container>
      </div>
    </PublicSiteLayout>
  );
}
