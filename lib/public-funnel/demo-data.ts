import type {
  RoundtableViewModel,
  RoundtableCategory,
  RoundtablePublicationStatus,
  ConsensusItem,
  Disagreement,
  ClaimEvidence,
  RiskSignal,
  ActionRecommendation,
  Perspective
} from "./types";

/**
 * DEMONSTRATION roundtable fixtures — NOT real, doctor-reviewed medical
 * conclusions and NOT database-backed. Every record is `isDemo: true`. This batch
 * ships no production roundtable table (Prisma is not modified), so the public
 * funnel renders clearly-labeled demo content. No fabricated real evidence, real
 * doctors, real institutions, or real citations are implied — sources below are
 * illustrative placeholders shown only in demo mode.
 */

type LocalizedContent = {
  title: string;
  summary: string;
  coreQuestion: string;
  oneMinute: { conclusion: string; keyLimitation: string; topRiskSignal: string; nextStep: string };
  background: string;
  consensusSummary: string;
  consensusItems: ConsensusItem[];
  disagreements: Disagreement[];
  claims: ClaimEvidence[];
  riskSignals: RiskSignal[];
  actionRecommendations: ActionRecommendation[];
  faqs: { q: string; a: string }[];
};

type DemoRecord = {
  id: string;
  slug: string;
  category: RoundtableCategory;
  reviewStatus: RoundtablePublicationStatus;
  version: number;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  perspectives: Perspective[];
  relatedRoundtables: { slug: string; titleEn: string; titleZh: string }[];
  relatedServices: string[];
  relatedProducts: string[];
  en: LocalizedContent;
  zh: LocalizedContent;
};

const PERSPECTIVES: Perspective[] = [
  { key: "clinical", label: "Clinical" },
  { key: "evidence", label: "Evidence-based" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "tcm", label: "TCM" },
  { key: "nutrition", label: "Nutrition & rehab" },
  { key: "safety", label: "Medical safety" }
];

const DEMO_RECORDS: DemoRecord[] = [
  {
    id: "rt_sleep_adults",
    slug: "adult-sleep-quality",
    category: "sleep_mood",
    reviewStatus: "approved",
    version: 3,
    publishedAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    readingTimeMinutes: 7,
    perspectives: PERSPECTIVES,
    relatedRoundtables: [{ slug: "home-blood-pressure", titleEn: "Home blood-pressure monitoring", titleZh: "居家血压监测" }],
    relatedServices: ["basic", "deep"],
    relatedProducts: ["sleep"],
    en: {
      title: "Improving adult sleep quality",
      summary: "What most perspectives agree on for everyday sleep difficulty, where they differ, and when to seek care.",
      coreQuestion: "How can adults improve ongoing poor sleep without medication as a first step?",
      oneMinute: { conclusion: "Consistent sleep timing and light exposure help most people with mild, non-medical sleep difficulty.", keyLimitation: "This does not address diagnosed sleep disorders such as sleep apnea.", topRiskSignal: "Loud snoring with pauses in breathing needs professional evaluation.", nextStep: "Track your sleep for two weeks, then consider a consultation." },
      background: "Everyday sleep difficulty is common and often responds to routine and environment changes. It is different from clinical sleep disorders, which need professional assessment.",
      consensusSummary: "Regular schedule, light management and reduced late stimulants are broadly supported for mild difficulty.",
      consensusItems: [
        { claim: "A consistent wake time supports sleep regulation.", support: "strong", scope: "Adults with mild difficulty", limitation: "Not a treatment for sleep disorders.", evidenceStatus: "supported" },
        { claim: "Morning light exposure helps daytime alertness.", support: "moderate", scope: "General adults", limitation: "Effect size varies by individual.", evidenceStatus: "supported_with_limitations" }
      ],
      disagreements: [
        { question: "How useful are wearable sleep scores?", positions: [{ perspective: "Evidence-based", view: "Trends can help; single-night scores are unreliable." }, { perspective: "Clinical", view: "Not a substitute for evaluation when symptoms persist." }], reason: "Consumer devices vary in accuracy.", evidenceSufficient: false, needsClinician: true }
      ],
      claims: [
        { claim: "Caffeine within 6 hours of bedtime can reduce sleep quality.", evidenceStatus: "supported", evidenceLevel: "moderate", sourceTitle: "Illustrative review of caffeine timing (demo)", sourceType: "review", year: 2023, scope: "General adults", limitation: "Individual sensitivity differs.", supportingPerspectives: ["Evidence-based", "Pharmacy"], challengingPerspectives: [] }
      ],
      riskSignals: [
        { tier: "attention", text: "Persistent daytime sleepiness affecting driving or work." },
        { tier: "urgent", text: "Witnessed pauses in breathing, choking or gasping during sleep." }
      ],
      actionRecommendations: [
        { tier: "self_monitor", text: "Keep a two-week sleep and caffeine log." },
        { tier: "continue_consult", text: "Discuss persistent difficulty in a health consultation." },
        { tier: "seek_care_soon", text: "Seek care for breathing pauses during sleep." }
      ],
      faqs: [{ q: "Is this medical advice?", a: "No. It is reviewed educational content and does not replace professional care." }]
    },
    zh: {
      title: "改善成人睡眠质量",
      summary: "关于日常入睡困难，多数视角的共识、分歧，以及何时需要就医。",
      coreQuestion: "成人长期睡眠不佳时，如何优先用非药物方式改善？",
      oneMinute: { conclusion: "规律作息与光照管理，对多数轻度、非疾病性睡眠困难有帮助。", keyLimitation: "不针对睡眠呼吸暂停等已确诊睡眠疾病。", topRiskSignal: "睡眠中大声打鼾并出现呼吸暂停，需要专业评估。", nextStep: "先记录两周睡眠，再考虑问诊。" },
      background: "日常睡眠困难很常见，常可通过作息与环境改善，与需要专业评估的临床睡眠疾病不同。",
      consensusSummary: "规律作息、光照管理、减少睡前刺激物，对轻度困难被广泛支持。",
      consensusItems: [
        { claim: "固定起床时间有助睡眠调节。", support: "strong", scope: "轻度困难成人", limitation: "不是睡眠疾病的治疗。", evidenceStatus: "supported" },
        { claim: "清晨光照有助白天清醒。", support: "moderate", scope: "一般成人", limitation: "个体效果差异较大。", evidenceStatus: "supported_with_limitations" }
      ],
      disagreements: [
        { question: "可穿戴睡眠评分有多大用？", positions: [{ perspective: "循证", view: "看趋势有帮助；单晚评分不可靠。" }, { perspective: "临床", view: "症状持续时不能替代评估。" }], reason: "消费级设备准确度差异大。", evidenceSufficient: false, needsClinician: true }
      ],
      claims: [
        { claim: "睡前 6 小时内摄入咖啡因可能降低睡眠质量。", evidenceStatus: "supported", evidenceLevel: "moderate", sourceTitle: "咖啡因时间的示例综述（演示）", sourceType: "综述", year: 2023, scope: "一般成人", limitation: "个体敏感度不同。", supportingPerspectives: ["循证", "药学"], challengingPerspectives: [] }
      ],
      riskSignals: [
        { tier: "attention", text: "白天持续困倦，影响驾驶或工作。" },
        { tier: "urgent", text: "睡眠中被目击到呼吸暂停、憋气或喘息。" }
      ],
      actionRecommendations: [
        { tier: "self_monitor", text: "记录两周睡眠与咖啡因摄入。" },
        { tier: "continue_consult", text: "在健康问诊中讨论持续困难。" },
        { tier: "seek_care_soon", text: "出现睡眠中呼吸暂停应尽快就医。" }
      ],
      faqs: [{ q: "这是医学建议吗？", a: "不是。这是经审核的科普内容，不能替代专业诊疗。" }]
    }
  },
  {
    id: "rt_home_bp",
    slug: "home-blood-pressure",
    category: "chronic",
    reviewStatus: "approved",
    version: 2,
    publishedAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    readingTimeMinutes: 6,
    perspectives: PERSPECTIVES,
    relatedRoundtables: [{ slug: "adult-sleep-quality", titleEn: "Improving adult sleep quality", titleZh: "改善成人睡眠质量" }],
    relatedServices: ["basic", "human"],
    relatedProducts: ["bp"],
    en: {
      title: "Home blood-pressure monitoring basics",
      summary: "How to measure at home reliably, what readings mean in context, and when readings need professional attention.",
      coreQuestion: "How should adults measure blood pressure at home for meaningful information?",
      oneMinute: { conclusion: "Consistent technique and timing make home readings more useful than one-off checks.", keyLimitation: "Home readings support, but do not replace, professional diagnosis.", topRiskSignal: "Very high readings with chest pain or severe headache are an emergency.", nextStep: "Record morning and evening readings for a week, then review with a professional." },
      background: "Home monitoring can help track trends, but technique strongly affects accuracy and single numbers are easy to misread.",
      consensusSummary: "Standardized technique and repeated readings over time are broadly supported.",
      consensusItems: [
        { claim: "Rest 5 minutes and sit properly before measuring.", support: "strong", scope: "General adults", limitation: "Does not interpret a diagnosis.", evidenceStatus: "supported" }
      ],
      disagreements: [
        { question: "Which home device type is best?", positions: [{ perspective: "Clinical", view: "Validated upper-arm cuffs are generally preferred." }, { perspective: "Evidence-based", view: "Validation status matters more than brand." }], reason: "Device validation varies.", evidenceSufficient: true, needsClinician: false }
      ],
      claims: [
        { claim: "Upper-arm cuffs tend to be more reliable than wrist devices.", evidenceStatus: "supported_with_limitations", evidenceLevel: "moderate", sourceTitle: "Illustrative device-comparison note (demo)", sourceType: "guidance", year: 2022, scope: "Home users", limitation: "Depends on correct cuff size and placement.", supportingPerspectives: ["Clinical"], challengingPerspectives: [] }
      ],
      riskSignals: [
        { tier: "attention", text: "Consistently high readings over several days." },
        { tier: "urgent", text: "Very high reading with chest pain, severe headache, or vision changes." }
      ],
      actionRecommendations: [
        { tier: "self_monitor", text: "Log readings with time and arm used." },
        { tier: "book_professional", text: "Bring your log to a professional for interpretation." },
        { tier: "seek_care_soon", text: "Seek emergency care for very high readings with warning symptoms." }
      ],
      faqs: [{ q: "Can this tell me if I have hypertension?", a: "No. Diagnosis requires professional assessment." }]
    },
    zh: {
      title: "居家血压监测基础",
      summary: "如何在家可靠测量、如何结合情境理解读数，以及何时需要专业关注。",
      coreQuestion: "成人如何在家测血压才能获得有意义的信息？",
      oneMinute: { conclusion: "统一的测量方法与时间，使居家读数比偶测更有价值。", keyLimitation: "居家读数辅助但不替代专业诊断。", topRiskSignal: "极高读数并伴胸痛或剧烈头痛属于急症。", nextStep: "先记录一周早晚读数，再由专业人员评估。" },
      background: "居家监测有助观察趋势，但方法强烈影响准确度，单个数字容易被误读。",
      consensusSummary: "规范测量方法与多次重复读数被广泛支持。",
      consensusItems: [
        { claim: "测量前静坐休息 5 分钟并保持正确姿势。", support: "strong", scope: "一般成人", limitation: "不做诊断解读。", evidenceStatus: "supported" }
      ],
      disagreements: [
        { question: "哪种居家设备更好？", positions: [{ perspective: "临床", view: "经验证的上臂式一般更受推荐。" }, { perspective: "循证", view: "验证状态比品牌更重要。" }], reason: "设备验证情况不一。", evidenceSufficient: true, needsClinician: false }
      ],
      claims: [
        { claim: "上臂式通常比腕式更可靠。", evidenceStatus: "supported_with_limitations", evidenceLevel: "moderate", sourceTitle: "设备对比示例说明（演示）", sourceType: "指南", year: 2022, scope: "居家用户", limitation: "取决于袖带尺寸与放置是否正确。", supportingPerspectives: ["临床"], challengingPerspectives: [] }
      ],
      riskSignals: [
        { tier: "attention", text: "连续数日读数持续偏高。" },
        { tier: "urgent", text: "极高读数并伴胸痛、剧烈头痛或视力变化。" }
      ],
      actionRecommendations: [
        { tier: "self_monitor", text: "记录读数、时间与测量手臂。" },
        { tier: "book_professional", text: "把记录带给专业人员解读。" },
        { tier: "seek_care_soon", text: "极高读数并伴警示症状应急诊就医。" }
      ],
      faqs: [{ q: "这能判断我是否高血压吗？", a: "不能。诊断需要专业评估。" }]
    }
  },
  {
    id: "rt_child_fever",
    slug: "childhood-fever-basics",
    category: "children",
    reviewStatus: "update_required",
    version: 1,
    publishedAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z",
    readingTimeMinutes: 5,
    perspectives: PERSPECTIVES,
    relatedRoundtables: [],
    relatedServices: ["human"],
    relatedProducts: [],
    en: {
      title: "Childhood fever — general comfort basics",
      summary: "General comfort principles and, most importantly, the warning signs that require prompt professional care.",
      coreQuestion: "What general comfort steps and warning signs should caregivers know for childhood fever?",
      oneMinute: { conclusion: "Comfort and hydration matter, but warning signs take priority over any home step.", keyLimitation: "This is not dosing guidance and not a substitute for pediatric care.", topRiskSignal: "A very young infant with fever, or a child who is hard to wake, needs urgent care.", nextStep: "Learn the warning signs; contact a professional when unsure." },
      background: "Fever is common in children. Caregiver decisions should center on warning signs rather than the number alone.",
      consensusSummary: "Prioritize warning signs and hydration; avoid unverified remedies.",
      consensusItems: [
        { claim: "Warning signs matter more than the exact temperature.", support: "strong", scope: "Caregivers", limitation: "Not dosing or diagnostic guidance.", evidenceStatus: "supported" }
      ],
      disagreements: [],
      claims: [
        { claim: "Comfort and fluids are reasonable general steps.", evidenceStatus: "expert_opinion_only", evidenceLevel: "low", sourceTitle: "Illustrative caregiver guidance (demo)", sourceType: "guidance", year: 2021, scope: "General caregivers", limitation: "Age and context change what is appropriate.", supportingPerspectives: ["Clinical", "Medical safety"], challengingPerspectives: [] }
      ],
      riskSignals: [
        { tier: "urgent", text: "Infant under 3 months with any fever." },
        { tier: "urgent", text: "Child difficult to wake, stiff neck, rash that does not fade, or trouble breathing." }
      ],
      actionRecommendations: [
        { tier: "book_professional", text: "Contact a professional when unsure or symptoms persist." },
        { tier: "seek_care_soon", text: "Seek urgent care for any warning sign above." }
      ],
      faqs: [{ q: "Does this include medicine doses?", a: "No. Dosing must come from a professional." }]
    },
    zh: {
      title: "儿童发热——一般护理基础",
      summary: "一般护理原则，以及最重要的、需要及时就医的危险信号。",
      coreQuestion: "面对儿童发热，照护者应了解哪些一般护理与危险信号？",
      oneMinute: { conclusion: "舒适与补水重要，但危险信号优先于任何居家措施。", keyLimitation: "这不是用药剂量指导，也不替代儿科诊疗。", topRiskSignal: "很小的婴儿发热、或孩子难以叫醒，需要紧急就医。", nextStep: "先了解危险信号；不确定时联系专业人员。" },
      background: "发热在儿童中常见。照护决策应以危险信号为核心，而非只看温度数字。",
      consensusSummary: "优先关注危险信号与补水；避免未经证实的偏方。",
      consensusItems: [
        { claim: "危险信号比具体温度更重要。", support: "strong", scope: "照护者", limitation: "非剂量或诊断指导。", evidenceStatus: "supported" }
      ],
      disagreements: [],
      claims: [
        { claim: "保持舒适与补充水分是合理的一般措施。", evidenceStatus: "expert_opinion_only", evidenceLevel: "low", sourceTitle: "照护者指导示例（演示）", sourceType: "指南", year: 2021, scope: "一般照护者", limitation: "年龄与情境会改变合适做法。", supportingPerspectives: ["临床", "医学安全"], challengingPerspectives: [] }
      ],
      riskSignals: [
        { tier: "urgent", text: "3 个月以下婴儿出现任何发热。" },
        { tier: "urgent", text: "孩子难以叫醒、颈部僵硬、皮疹按压不褪色或呼吸困难。" }
      ],
      actionRecommendations: [
        { tier: "book_professional", text: "不确定或症状持续时联系专业人员。" },
        { tier: "seek_care_soon", text: "出现上述任何危险信号应紧急就医。" }
      ],
      faqs: [{ q: "包含用药剂量吗？", a: "不包含。剂量必须由专业人员给出。" }]
    }
  },
  {
    // Retracted — MUST never render as a normal conclusion (used to exercise the gate).
    id: "rt_retracted_demo",
    slug: "retracted-example",
    category: "medication_safety",
    reviewStatus: "retracted",
    version: 1,
    publishedAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
    readingTimeMinutes: 3,
    perspectives: PERSPECTIVES,
    relatedRoundtables: [],
    relatedServices: [],
    relatedProducts: [],
    en: {
      title: "Retracted example (demo)", summary: "Retracted.", coreQuestion: "Retracted.",
      oneMinute: { conclusion: "Retracted.", keyLimitation: "Retracted.", topRiskSignal: "Retracted.", nextStep: "Retracted." },
      background: "Retracted.", consensusSummary: "Retracted.", consensusItems: [], disagreements: [], claims: [], riskSignals: [], actionRecommendations: [], faqs: []
    },
    zh: {
      title: "已撤回示例（演示）", summary: "已撤回。", coreQuestion: "已撤回。",
      oneMinute: { conclusion: "已撤回。", keyLimitation: "已撤回。", topRiskSignal: "已撤回。", nextStep: "已撤回。" },
      background: "已撤回。", consensusSummary: "已撤回。", consensusItems: [], disagreements: [], claims: [], riskSignals: [], actionRecommendations: [], faqs: []
    }
  }
];

function topRiskTier(signals: RiskSignal[]): "routine" | "info" | "attention" | "urgent" {
  if (signals.some((s) => s.tier === "urgent")) return "urgent";
  if (signals.some((s) => s.tier === "attention")) return "attention";
  if (signals.some((s) => s.tier === "info")) return "info";
  return "routine";
}

function toViewModel(record: DemoRecord, locale: "en" | "zh"): RoundtableViewModel {
  const c = record[locale];
  return {
    id: record.id,
    slug: record.slug,
    locale,
    isDemo: true,
    title: c.title,
    summary: c.summary,
    category: record.category,
    coreQuestion: c.coreQuestion,
    oneMinute: c.oneMinute,
    background: c.background,
    perspectives: record.perspectives,
    consensusSummary: c.consensusSummary,
    consensusItems: c.consensusItems,
    disagreements: c.disagreements,
    claims: c.claims,
    riskSignals: c.riskSignals,
    actionRecommendations: c.actionRecommendations,
    faqs: c.faqs,
    reviewStatus: record.reviewStatus,
    version: record.version,
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
    readingTimeMinutes: record.readingTimeMinutes,
    relatedRoundtables: record.relatedRoundtables.map((r) => ({ slug: r.slug, title: locale === "zh" ? r.titleZh : r.titleEn })),
    relatedServices: record.relatedServices,
    relatedProducts: record.relatedProducts
  };
}

/** All demo roundtable view models for a locale (BEFORE the public gate). */
export function allDemoRoundtables(locale: "en" | "zh"): RoundtableViewModel[] {
  return DEMO_RECORDS.map((r) => toViewModel(r, locale));
}

export { topRiskTier };
