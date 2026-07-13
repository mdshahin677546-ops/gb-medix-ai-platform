import type { Lang } from "@/lib/lang";

/**
 * Public funnel copy dictionary (en + zh). Other locales fall back to English —
 * matching the project's existing degrade strategy in lib/lang.ts. Components read
 * copy through getFunnelCopy(lang); no large hardcoded strings live in components.
 */
export type FunnelCopy = {
  nav: { roundtable: string; consult: string; services: string; knowledge: string; products: string; search: string; language: string; login: string; startConsult: string; menu: string; close: string };
  brandTagline: string;
  hero: {
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    trust: string[];
  };
  home: {
    featuredTitle: string;
    featuredSubtitle: string;
    howTitle: string;
    howSteps: string[];
    howNoteA: string;
    howNoteB: string;
    funnelTitle: string;
    funnelSteps: string[];
    servicesTitle: string;
    knowledgeTitle: string;
    productsTitle: string;
    productsNote: string;
    trustTitle: string;
  };
  card: { viewRoundtable: string; startConsult: string; disagreements: string; perspectives: string; evidence: string; readingTime: string; updated: string; version: string };
  status: { reviewed: string; updateRequired: string; archived: string; unavailable: string; caveatUpdate: string; caveatArchived: string; caveatUnavailable: string };
  detail: { toc: string; oneMinute: string; background: string; perspectives: string; consensus: string; disagreements: string; claims: string; risk: string; actions: string; faq: string; versionRecord: string; related: string; relatedServices: string; relatedProducts: string; conclusion: string; keyLimitation: string; topRisk: string; nextStep: string; claim: string; evidenceStatus: string; evidenceLevel: string; source: string; scope: string; limitation: string; supportedBy: string; challengedBy: string; ctaMid: string; ctaEnd: string };
  risk: { heading: string; routine: string; info: string; attention: string; urgent: string };
  action: { self_monitor: string; continue_consult: string; book_professional: string; seek_care_soon: string };
  list: { title: string; subtitle: string; searchPlaceholder: string; filters: string; category: string; all: string; popular: string; latest: string; updated: string; controversial: string; needsAttention: string; noResults: string; noResultsBody: string; reviewInfo: string };
  consult: { title: string; solves: string; notSolves: string; youProvide: string; steps: string[]; riskHandling: string; report: string; humanReview: string; privacy: string; start: string; preparing: string };
  services: { title: string; basic: string; deep: string; human: string; forWhom: string; includes: string; aiRole: string; boundary: string; delivery: string; price: string; priceTbd: string; next: string };
  knowledge: { title: string; subtitle: string; vsRoundtable: string; topics: string; latest: string; faq: string; riskKnowledge: string; relatedRoundtables: string };
  products: { title: string; note: string; disclaimer: string; needsGuidance: string; viewDetails: string; demo: string; priceTbd: string; stockTbd: string };
  disclaimer: { short: string; full: string; reviewNote: string };
  footer: { roundtable: string; consult: string; services: string; knowledge: string; products: string; privacy: string; terms: string; medicalDisclaimer: string; reviewProcess: string; copyright: string };
  common: { loading: string; error: string; retry: string; empty: string; demoBadge: string; unavailable: string; startConsult: string; relatedFromMe: string };
};

const en: FunnelCopy = {
  nav: { roundtable: "Medical Roundtable", consult: "AI Health Consult", services: "Health Services", knowledge: "Medical Knowledge", products: "Health Products", search: "Search", language: "Language", login: "Sign in", startConsult: "Start consultation", menu: "Menu", close: "Close" },
  brandTagline: "Multiple medical perspectives, made clearer",
  hero: {
    title: "Multiple medical perspectives make complex health questions clearer",
    body: "Clinical, evidence-based, pharmacy, TCM, nutrition-rehab and medical-safety perspectives review a question together — showing consensus, disagreements, evidence levels and next steps. Content is published only after medical review. It does not replace professional diagnosis.",
    primaryCta: "Enter the Medical Roundtable",
    secondaryCta: "Start a consultation for my situation",
    trust: ["Medically reviewed", "Evidence you can check", "Risk-first", "Version tracked"]
  },
  home: {
    featuredTitle: "Featured medical roundtables",
    featuredSubtitle: "Multi-perspective, reviewed discussions of common health questions",
    howTitle: "How the Medical Roundtable works",
    howSteps: ["Pose a medical question", "Independent multi-role analysis", "Cross-examination", "Claim & evidence checks", "Medical safety review", "Clinician review", "Publish"],
    howNoteA: "AI discussion finished ≠ medically reviewed",
    howNoteB: "Medically reviewed ≠ valid forever",
    funnelTitle: "From roundtable to your own consultation",
    funnelSteps: ["Read a roundtable", "Find what relates to you", "Provide health info", "Complete a structured consult", "Get a health report", "Choose human review or follow-up"],
    servicesTitle: "Health consultation services",
    knowledgeTitle: "Medical knowledge & topics",
    productsTitle: "Optional support products",
    productsNote: "Products do not affect medical conclusions and cannot replace care.",
    trustTitle: "Trust, privacy & compliance"
  },
  card: { viewRoundtable: "View roundtable", startConsult: "Start personal consult", disagreements: "disagreements", perspectives: "perspectives", evidence: "evidence items", readingTime: "min read", updated: "Updated", version: "v" },
  status: { reviewed: "Medically reviewed", updateRequired: "Update in progress", archived: "Archived", unavailable: "Not available", caveatUpdate: "This roundtable is being updated. Some content may not reflect the latest review.", caveatArchived: "This roundtable is archived and kept for reference. It may not reflect current guidance.", caveatUnavailable: "This content is not available for public display." },
  detail: { toc: "On this page", oneMinute: "One-minute summary", background: "Background", perspectives: "Perspectives", consensus: "Core consensus", disagreements: "Main disagreements", claims: "Claims & evidence", risk: "Danger signals", actions: "What you can do", faq: "FAQ", versionRecord: "Version & review record", related: "Related roundtables", relatedServices: "Related health services", relatedProducts: "Optional products", conclusion: "Conclusion", keyLimitation: "Key limitation", topRisk: "Top danger signal", nextStep: "Your next step", claim: "Claim", evidenceStatus: "Evidence status", evidenceLevel: "Evidence level", source: "Source", scope: "Applies to", limitation: "Limitation", supportedBy: "Supported by", challengedBy: "Challenged by", ctaMid: "This relates to my situation", ctaEnd: "Start a health consultation for my situation" },
  risk: { heading: "If any of the following occur, contact a medical professional or local emergency services promptly", routine: "Routine", info: "Info", attention: "Needs attention", urgent: "Urgent" },
  action: { self_monitor: "You can self-monitor", continue_consult: "You can continue a health consult", book_professional: "Consider booking a professional", seek_care_soon: "Seek medical care soon" },
  list: { title: "Medical Roundtable", subtitle: "Multi-perspective, medically reviewed discussions", searchPlaceholder: "Search a health topic", filters: "Filters", category: "Category", all: "All", popular: "Popular", latest: "Latest", updated: "Updated", controversial: "Debated", needsAttention: "Needs attention", noResults: "No matching roundtables", noResultsBody: "Try another topic, or start a consultation for your situation.", reviewInfo: "How medical review works" },
  consult: { title: "AI Health Consultation", solves: "What this helps with", notSolves: "What this cannot do", youProvide: "What you provide", steps: ["Basic info", "Current health concern", "Health background", "Risk check", "Report or follow-up"], riskHandling: "How danger signals are handled", report: "Report format", humanReview: "Human review", privacy: "Data & privacy", start: "Start consultation", preparing: "Consultation service is being prepared" },
  services: { title: "Health services", basic: "Basic health assessment", deep: "In-depth health report", human: "Professional human review", forWhom: "For whom", includes: "Includes", aiRole: "AI involvement", boundary: "Medical boundary", delivery: "Delivery", price: "Price", priceTbd: "Pricing to be connected", next: "Next step" },
  knowledge: { title: "Medical knowledge", subtitle: "Reviewed explanatory content and topics", vsRoundtable: "Roundtable: multi-perspective discussion with consensus, disagreement and evidence. Knowledge: reviewed explanatory content.", topics: "Topics", latest: "Latest updates", faq: "Common questions", riskKnowledge: "High-risk knowledge", relatedRoundtables: "Related roundtables" },
  products: { title: "Optional support products by health topic", note: "Products are optional support, not part of any medical conclusion.", disclaimer: "Product information is not medical advice and cannot replace professional care.", needsGuidance: "May need professional guidance", viewDetails: "View details", demo: "Demo", priceTbd: "Price to be connected", stockTbd: "Availability to be connected" },
  disclaimer: { short: "Wellness and educational content only — not medical diagnosis or treatment.", full: "This content provides multi-perspective, reviewed health information for education only. It is not a medical diagnosis, prescription, or treatment, and does not replace consultation with a qualified professional. In an emergency, contact local emergency services.", reviewNote: "Published only after medical review; versions are tracked." },
  footer: { roundtable: "Medical Roundtable", consult: "AI Health Consult", services: "Health Services", knowledge: "Medical Knowledge", products: "Health Products", privacy: "Privacy Policy", terms: "Terms of Service", medicalDisclaimer: "Medical Disclaimer", reviewProcess: "Medical Review Process", copyright: "GB Medix AI" },
  common: { loading: "Loading…", error: "Something went wrong.", retry: "Retry", empty: "Nothing to show yet.", demoBadge: "Demo content", unavailable: "Service preparing", startConsult: "Start consultation", relatedFromMe: "Start a consultation for my situation" }
};

const zh: FunnelCopy = {
  nav: { roundtable: "医学圆桌", consult: "AI健康问诊", services: "健康服务", knowledge: "医学知识", products: "健康产品", search: "搜索", language: "语言", login: "登录", startConsult: "开始问诊", menu: "菜单", close: "关闭" },
  brandTagline: "多医学视角，让健康问题更清楚",
  hero: {
    title: "多医学视角，让复杂健康问题更清楚",
    body: "临床、循证、药学、中医、营养康复与医学安全等多种视角共同审视一个健康问题，展示共识、分歧、证据等级与行动建议。内容经医学审核后才会公开，不替代专业医学诊断。",
    primaryCta: "进入医学圆桌",
    secondaryCta: "针对我的情况开始问诊",
    trust: ["医学审核", "证据可查", "风险优先", "版本可追踪"]
  },
  home: {
    featuredTitle: "热门与重点医学圆桌",
    featuredSubtitle: "对常见健康问题的多视角、经审核讨论",
    howTitle: "医学圆桌如何运行",
    howSteps: ["提出医学问题", "多角色独立分析", "交叉质疑", "主张与证据核验", "医学安全审查", "医生审核", "正式发布"],
    howNoteA: "AI 讨论完成 ≠ 医学审核通过",
    howNoteB: "医学审核通过 ≠ 内容永久有效",
    funnelTitle: "从圆桌到个人健康问诊",
    funnelSteps: ["阅读医学圆桌", "发现与自己相关的问题", "填写健康信息", "完成结构化问诊", "获得健康报告", "选择人工复核或后续服务"],
    servicesTitle: "健康问诊服务",
    knowledgeTitle: "医学知识与专题",
    productsTitle: "可选健康产品",
    productsNote: "产品不影响医学结论，也不能替代诊疗。",
    trustTitle: "医学信任、隐私与合规"
  },
  card: { viewRoundtable: "查看圆桌", startConsult: "开始个人问诊", disagreements: "处分歧", perspectives: "个视角", evidence: "条证据", readingTime: "分钟阅读", updated: "更新于", version: "v" },
  status: { reviewed: "已医学审核", updateRequired: "更新中", archived: "已归档", unavailable: "暂不可用", caveatUpdate: "本圆桌正在更新，部分内容可能未反映最新审核。", caveatArchived: "本圆桌已归档、仅供参考，可能不代表当前建议。", caveatUnavailable: "该内容不可公开展示。" },
  detail: { toc: "本页目录", oneMinute: "一分钟看懂", background: "问题背景", perspectives: "参与视角", consensus: "核心共识", disagreements: "主要分歧", claims: "医学主张与证据", risk: "危险信号", actions: "用户行动建议", faq: "常见问题", versionRecord: "版本与审核记录", related: "相关医学圆桌", relatedServices: "相关健康服务", relatedProducts: "可选健康产品", conclusion: "核心结论", keyLimitation: "重要限制", topRisk: "危险信号", nextStep: "下一步", claim: "主张", evidenceStatus: "证据状态", evidenceLevel: "证据等级", source: "来源", scope: "适用范围", limitation: "限制条件", supportedBy: "支持视角", challengedBy: "质疑视角", ctaMid: "这个问题与我的情况相关", ctaEnd: "针对我的情况开始健康问诊" },
  risk: { heading: "出现以下情况时，请及时联系专业医疗人员或当地急救服务", routine: "常规", info: "信息", attention: "需要关注", urgent: "紧急" },
  action: { self_monitor: "可以自行记录", continue_consult: "可以继续健康咨询", book_professional: "建议预约专业人员", seek_care_soon: "建议尽快就医" },
  list: { title: "医学圆桌", subtitle: "多视角、经医学审核的讨论", searchPlaceholder: "搜索健康主题", filters: "筛选", category: "分类", all: "全部", popular: "热门", latest: "最新", updated: "已更新", controversial: "争议话题", needsAttention: "需要关注", noResults: "没有匹配的圆桌", noResultsBody: "换个主题，或针对你的情况开始问诊。", reviewInfo: "医学审核说明" },
  consult: { title: "AI 健康问诊", solves: "服务能解决什么", notSolves: "服务不能解决什么", youProvide: "你需要提供的信息", steps: ["基础信息", "当前健康问题", "健康背景", "风险检查", "报告或后续服务"], riskHandling: "危险信号处理方式", report: "报告形式", humanReview: "人工复核", privacy: "数据与隐私", start: "开始问诊", preparing: "问诊服务准备中" },
  services: { title: "健康服务", basic: "基础健康评估", deep: "深度健康报告", human: "专业人工复核", forWhom: "适合人群", includes: "包含内容", aiRole: "AI 参与方式", boundary: "医疗边界", delivery: "交付形式", price: "价格", priceTbd: "价格待接入", next: "下一步" },
  knowledge: { title: "医学知识", subtitle: "经审核的解释型内容与专题", vsRoundtable: "医学圆桌：多视角讨论、共识、分歧与证据。医学知识：经审核的解释型内容。", topics: "专题分类", latest: "最新更新", faq: "常见问题", riskKnowledge: "高风险知识", relatedRoundtables: "相关圆桌" },
  products: { title: "基于健康主题的可选支持产品", note: "产品为可选支持，不属于任何医学结论。", disclaimer: "产品信息不构成医学建议，不能替代专业诊疗。", needsGuidance: "可能需要专业指导", viewDetails: "查看详情", demo: "演示", priceTbd: "价格待接入", stockTbd: "库存待接入" },
  disclaimer: { short: "仅为健康与科普信息，非医学诊断或治疗。", full: "本内容提供多视角、经审核的健康信息，仅用于科普。它不是医学诊断、处方或治疗，也不能替代与专业人员的沟通。紧急情况请联系当地急救服务。", reviewNote: "内容经医学审核后才发布，版本可追踪。" },
  footer: { roundtable: "医学圆桌", consult: "AI健康问诊", services: "健康服务", knowledge: "医学知识", products: "健康产品", privacy: "隐私政策", terms: "服务条款", medicalDisclaimer: "医疗免责声明", reviewProcess: "医学审核说明", copyright: "GB Medix AI" },
  common: { loading: "加载中…", error: "出现了一些问题。", retry: "重试", empty: "暂无内容。", demoBadge: "演示内容", unavailable: "服务准备中", startConsult: "开始问诊", relatedFromMe: "针对我的情况开始问诊" }
};

export function getFunnelCopy(lang: Lang): FunnelCopy {
  return lang === "zh" ? zh : en;
}

/** The public funnel renders in en or zh; other locales use the en dictionary. */
export function funnelLocale(lang: Lang): "en" | "zh" {
  return lang === "zh" ? "zh" : "en";
}
