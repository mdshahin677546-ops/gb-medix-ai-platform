// GB MEDIX AI Medical Roundtable — SHOWCASE 1.0 static view-model.
//
// READ-ONLY internal review demonstration data. This module contains ONLY
// static, clearly-labelled mock data. It never runs the real roundtable,
// never calls an AI provider, never touches a database, and never renders a
// real medical conclusion. It does not import or modify the safety
// foundation in lib/roundtable/v1. No patient names, phone numbers, emails,
// MRNs, real diagnoses, prescriptions, doses or treatment plans appear here.

export type ShowcaseLang = "zh" | "en";

/** Every card carries this so the UI can label it unmistakably as a demo. */
export const DEMONSTRATION_DATA = true;

// The exact, mandated safety disclaimer text. Shown on the first screen AND
// inside every core result region — never hidden in a footer.
export const SAFETY_DISCLAIMER: Record<ShowcaseLang, string> = {
  zh: "规则级功能原型，仅用于平台能力展示；非临床验证、非医学诊断、非治疗建议、非生产医疗服务。所有医学内容正式发布前必须经过可信的医生审核流程。",
  en: "Rule-based capability prototype for platform demonstration only. Not clinically validated, not a medical diagnosis, not treatment advice, and not a production medical service. Medical content requires trusted human medical review before publication.",
};

export const DEMO_BADGE: Record<ShowcaseLang, string> = {
  zh: "模拟数据",
  en: "Demonstration Data",
};

export interface PageChrome {
  eyebrow: string;
  title: string;
  intro: string;
  demoBadge: string;
  disclaimer: string;
}

export const PAGE_CHROME: Record<ShowcaseLang, PageChrome> = {
  zh: {
    eyebrow: "GB MEDIX AI 医学圆桌 · 只读评审",
    title: "医学圆桌能力展示",
    intro:
      "以只读方式展示医学圆桌的安全门禁、每日自主运行状态机与循证审核流程。全部为标注清楚的模拟数据，不触发真实运行、不调用 AI、不写数据库、不发布任何医学结论。",
    demoBadge: DEMO_BADGE.zh,
    disclaimer: SAFETY_DISCLAIMER.zh,
  },
  en: {
    eyebrow: "GB MEDIX AI Medical Roundtable · Read-only review",
    title: "Medical Roundtable capability showcase",
    intro:
      "A read-only look at the roundtable's safety gate, daily autonomous-run state machine and evidence-based review flow. Everything shown is clearly-labelled demonstration data — no real run, no AI, no database writes, no published medical conclusions.",
    demoBadge: DEMO_BADGE.en,
    disclaimer: SAFETY_DISCLAIMER.en,
  },
};

// ---------------------------------------------------------------------------
// Section 1 — safety gate demonstration
// ---------------------------------------------------------------------------

export type GateVerdict = "allowed" | "blocked";
export type GateBlockReason = "high_risk" | "privacy" | null;

export interface GateExample {
  id: string;
  /** Category-level descriptor of a mock topic — NOT a real patient sentence. */
  topic: string;
  category: string;
  verdict: GateVerdict;
  blockReason: GateBlockReason;
  detail: string;
  /** Resulting daily-run status label for this mock topic. */
  status: string;
}

export interface GateSection {
  heading: string;
  note: string;
  allowedHeading: string;
  blockedHeading: string;
  columns: { topic: string; category: string; result: string; reason: string; status: string };
  examples: GateExample[];
}

export const GATE_SECTION: Record<ShowcaseLang, GateSection> = {
  zh: {
    heading: "① 安全门禁演示",
    note: "以下为模拟议题与门禁判定，展示「允许」与「阻断」两类结果；不接受访客自由文本输入。",
    allowedHeading: "允许进入自主选题",
    blockedHeading: "结构性阻断",
    columns: { topic: "模拟议题", category: "分类", result: "门禁结果", reason: "阻断原因", status: "当前状态" },
    examples: [
      { id: "a1", topic: "人群层面维生素D与呼吸道感染的证据讨论", category: "人群级医学知识", verdict: "allowed", blockReason: null, detail: "人群级、可核验证据、非个体化", status: "planned（模拟）" },
      { id: "a2", topic: "公共卫生:成人睡眠时长与心血管健康", category: "公共卫生议题", verdict: "allowed", blockReason: null, detail: "公共卫生教育范围内", status: "planned（模拟）" },
      { id: "a3", topic: "临床指南对糖尿病诊断标准的定义比较", category: "临床指南比较", verdict: "allowed", blockReason: null, detail: "指南层面比较,非个体诊断", status: "planned（模拟）" },
      { id: "a4", topic: "如何向患者群体沟通诊断不确定性(教育)", category: "循证医学教育", verdict: "allowed", blockReason: null, detail: "面向群体的沟通教育,无个体判断意图", status: "planned（模拟）" },
      { id: "b1", topic: "个体询问自己是否患某病(示例类别)", category: "个体诊断判断", verdict: "blocked", blockReason: "high_risk", detail: "个体主体+诊断判断意图共现", status: "high_risk_blocked（模拟）" },
      { id: "b2", topic: "单一患者的疾病状态判断请求(示例类别)", category: "单一患者判断", verdict: "blocked", blockReason: "high_risk", detail: "单一患者主体的诊断判断", status: "high_risk_blocked（模拟）" },
      { id: "b3", topic: "个体处方或药物剂量请求(示例类别)", category: "处方/剂量", verdict: "blocked", blockReason: "high_risk", detail: "个体化处方与剂量超出范围", status: "high_risk_blocked（模拟）" },
      { id: "b4", topic: "个体停药或换药建议请求(示例类别)", category: "停药/换药", verdict: "blocked", blockReason: "high_risk", detail: "个体化用药调整超出范围", status: "high_risk_blocked（模拟）" },
      { id: "b5", topic: "个体疾病概率或风险百分比请求(示例类别)", category: "个体疾病概率", verdict: "blocked", blockReason: "high_risk", detail: "个体化概率判断超出范围", status: "high_risk_blocked（模拟）" },
      { id: "b6", topic: "含可识别患者信息的议题(示例类别)", category: "可识别患者信息", verdict: "blocked", blockReason: "privacy", detail: "命中隐私信号,拒绝入选", status: "privacy_blocked（模拟）" },
    ],
  },
  en: {
    heading: "① Safety gate demonstration",
    note: "Mock topics and gate verdicts below show both allowed and blocked outcomes. No free-text visitor input is accepted.",
    allowedHeading: "Allowed for autonomous selection",
    blockedHeading: "Structurally blocked",
    columns: { topic: "Mock topic", category: "Category", result: "Gate result", reason: "Block reason", status: "Current status" },
    examples: [
      { id: "a1", topic: "Population-level evidence on vitamin D and respiratory infection", category: "Population-level knowledge", verdict: "allowed", blockReason: null, detail: "Population-level, verifiable evidence, non-individual", status: "planned (mock)" },
      { id: "a2", topic: "Public health: adult sleep duration and cardiovascular health", category: "Public health", verdict: "allowed", blockReason: null, detail: "Within public-health education scope", status: "planned (mock)" },
      { id: "a3", topic: "Guideline comparison of diabetes diagnostic criteria", category: "Clinical guideline comparison", verdict: "allowed", blockReason: null, detail: "Guideline-level comparison, not individual diagnosis", status: "planned (mock)" },
      { id: "a4", topic: "Communicating diagnostic uncertainty to patient populations (education)", category: "EBM education", verdict: "allowed", blockReason: null, detail: "Population-facing communication, no individual judgment intent", status: "planned (mock)" },
      { id: "b1", topic: "An individual asking whether they personally have a disease (example category)", category: "Individual diagnosis", verdict: "blocked", blockReason: "high_risk", detail: "Individual subject + diagnostic-judgment intent co-occur", status: "high_risk_blocked (mock)" },
      { id: "b2", topic: "Single-patient disease-status judgment request (example category)", category: "Single-patient judgment", verdict: "blocked", blockReason: "high_risk", detail: "Diagnostic judgment for a single patient", status: "high_risk_blocked (mock)" },
      { id: "b3", topic: "Individual prescription or medication dose request (example category)", category: "Prescription / dose", verdict: "blocked", blockReason: "high_risk", detail: "Individual prescription and dosing out of scope", status: "high_risk_blocked (mock)" },
      { id: "b4", topic: "Individual stop- or switch-medication advice request (example category)", category: "Stop / switch medication", verdict: "blocked", blockReason: "high_risk", detail: "Individual medication changes out of scope", status: "high_risk_blocked (mock)" },
      { id: "b5", topic: "Individual disease-probability or percentage-risk request (example category)", category: "Individual disease probability", verdict: "blocked", blockReason: "high_risk", detail: "Individual probability judgment out of scope", status: "high_risk_blocked (mock)" },
      { id: "b6", topic: "Topic containing identifiable patient information (example category)", category: "Identifiable patient info", verdict: "blocked", blockReason: "privacy", detail: "Privacy signal detected, rejected from selection", status: "privacy_blocked (mock)" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Section 2 — daily autonomous-run state machine
// ---------------------------------------------------------------------------

export type StageKind = "completed" | "current" | "awaiting_review" | "blocked" | "planned";

export interface Stage {
  id: string;
  label: string;
  kind: StageKind;
  note: string;
}

export interface StateMachineSection {
  heading: string;
  note: string;
  legend: Record<StageKind, string>;
  stages: Stage[];
  blockedHeading: string;
  blocked: Stage[];
}

export const STATE_MACHINE_SECTION: Record<ShowcaseLang, StateMachineSection> = {
  zh: {
    heading: "② 每日自主运行状态机",
    note: "只读展示每日一次自主运行的阶段流转。清楚区分:已完成 / 当前 / 等待医生审核 / 阻断 / 模拟。",
    legend: {
      completed: "已完成",
      current: "当前状态",
      awaiting_review: "等待人工审核",
      blocked: "阻断状态",
      planned: "模拟状态",
    },
    stages: [
      { id: "s1", label: "候选议题", kind: "completed", note: "载入候选议题并标准化(模拟)" },
      { id: "s2", label: "隐私检查", kind: "completed", note: "隐私信号检查通过(模拟)" },
      { id: "s3", label: "高风险检查", kind: "completed", note: "个体诊断/高风险检查通过(模拟)" },
      { id: "s4", label: "重复检查", kind: "completed", note: "指纹去重,非重复议题(模拟)" },
      { id: "s5", label: "智能体面板规划", kind: "completed", note: "≥5 角色,Evidence 与 Safety 强制(模拟)" },
      { id: "s6", label: "独立分析", kind: "completed", note: "各角色独立分析(模拟)" },
      { id: "s7", label: "交叉质疑", kind: "completed", note: "交叉质询与反方审查(模拟)" },
      { id: "s8", label: "Evidence 核验", kind: "completed", note: "结构级证据绑定与核验(模拟)" },
      { id: "s9", label: "共识草稿", kind: "current", note: "生成循证共识草稿,固定为 pending(模拟)" },
      { id: "s10", label: "等待医生审核", kind: "awaiting_review", note: "进入医生审核队列,未审核前不可发布(模拟)" },
      { id: "s11", label: "Approved", kind: "planned", note: "医生批准后才可推进(模拟,尚未发生)" },
      { id: "s12", label: "PublicationPlan", kind: "planned", note: "仅生成发布计划对象,不等于已公开发布(模拟)" },
    ],
    blockedHeading: "阻断状态(模拟)",
    blocked: [
      { id: "x1", label: "Withdrawn", kind: "blocked", note: "内容被撤回,阻断发布(模拟)" },
      { id: "x2", label: "Superseded", kind: "blocked", note: "被新版本取代,不可恢复为当前(模拟)" },
      { id: "x3", label: "Evidence Invalid", kind: "blocked", note: "证据无效,不得进入审核(模拟)" },
      { id: "x4", label: "High-risk Blocked", kind: "blocked", note: "高风险内容,永不绕过(模拟)" },
    ],
  },
  en: {
    heading: "② Daily autonomous-run state machine",
    note: "Read-only view of the once-a-day autonomous run. Clearly separates completed / current / awaiting medical review / blocked / simulated.",
    legend: {
      completed: "Completed",
      current: "Current",
      awaiting_review: "Awaiting human review",
      blocked: "Blocked",
      planned: "Simulated",
    },
    stages: [
      { id: "s1", label: "Candidate topics", kind: "completed", note: "Load and normalize candidate topics (mock)" },
      { id: "s2", label: "Privacy check", kind: "completed", note: "Privacy-signal check passed (mock)" },
      { id: "s3", label: "High-risk check", kind: "completed", note: "Individual-diagnosis / high-risk check passed (mock)" },
      { id: "s4", label: "Duplicate check", kind: "completed", note: "Fingerprint dedupe, not a duplicate (mock)" },
      { id: "s5", label: "Agent panel planning", kind: "completed", note: "≥5 roles, Evidence & Safety mandatory (mock)" },
      { id: "s6", label: "Independent analysis", kind: "completed", note: "Each role analyzes independently (mock)" },
      { id: "s7", label: "Cross-examination", kind: "completed", note: "Cross-examination and adversarial review (mock)" },
      { id: "s8", label: "Evidence verification", kind: "completed", note: "Structural evidence binding and verification (mock)" },
      { id: "s9", label: "Consensus draft", kind: "current", note: "Evidence consensus draft generated, fixed to pending (mock)" },
      { id: "s10", label: "Awaiting medical review", kind: "awaiting_review", note: "Enters doctor review queue; cannot publish before review (mock)" },
      { id: "s11", label: "Approved", kind: "planned", note: "Advances only after a doctor approves (mock, not yet occurred)" },
      { id: "s12", label: "PublicationPlan", kind: "planned", note: "Only a publication-plan object; NOT a public release (mock)" },
    ],
    blockedHeading: "Blocked states (mock)",
    blocked: [
      { id: "x1", label: "Withdrawn", kind: "blocked", note: "Content withdrawn, publication blocked (mock)" },
      { id: "x2", label: "Superseded", kind: "blocked", note: "Replaced by a new version, never restored as current (mock)" },
      { id: "x3", label: "Evidence Invalid", kind: "blocked", note: "Invalid evidence, cannot enter review (mock)" },
      { id: "x4", label: "High-risk Blocked", kind: "blocked", note: "High-risk content, never bypassed (mock)" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Section 3 — evidence-based consensus flow
// ---------------------------------------------------------------------------

export interface RoleCard {
  id: string;
  role: string;
  mandatory: boolean;
  description: string;
}

export interface EvidencePlaceholder {
  id: string;
  label: string;
  stance: "supporting" | "opposing";
  level: string;
}

export interface FlowStep {
  id: string;
  label: string;
  note: string;
}

export interface ConsensusSection {
  heading: string;
  note: string;
  rolesHeading: string;
  mandatoryBadge: string;
  roles: RoleCard[];
  evidenceHeading: string;
  evidence: EvidencePlaceholder[];
  flowHeading: string;
  flow: FlowStep[];
  reviewStatusLabel: string;
  reviewStatusValue: string;
}

export const CONSENSUS_SECTION: Record<ShowcaseLang, ConsensusSection> = {
  zh: {
    heading: "③ 循证共识流程",
    note: "展示多智能体循证讨论结构。全部为流程占位符与结构名称,不含真实医学结论。",
    rolesHeading: "智能体角色(≥5,Evidence 与 Safety 强制)",
    mandatoryBadge: "强制",
    roles: [
      { id: "r1", role: "moderator", mandatory: false, description: "主持与流程编排(模拟)" },
      { id: "r2", role: "evidence_medicine", mandatory: true, description: "循证医学证据评估(模拟,强制存在)" },
      { id: "r3", role: "clinical_perspective", mandatory: false, description: "临床视角(模拟)" },
      { id: "r4", role: "adversarial_reviewer", mandatory: false, description: "反方审查(模拟)" },
      { id: "r5", role: "medical_safety_compliance", mandatory: true, description: "医学安全合规(模拟,强制存在)" },
      { id: "r6", role: "public_health", mandatory: false, description: "公共卫生视角(可选,模拟)" },
    ],
    evidenceHeading: "证据结构(占位符)",
    evidence: [
      { id: "e1", label: "证据项 A(模拟)", stance: "supporting", level: "高" },
      { id: "e2", label: "证据项 B(模拟)", stance: "supporting", level: "中" },
      { id: "e3", label: "证据项 C(模拟)", stance: "opposing", level: "低" },
    ],
    flowHeading: "流程",
    flow: [
      { id: "f1", label: "独立分析", note: "各角色独立给出分析(模拟)" },
      { id: "f2", label: "反方审查", note: "对抗性审查关键主张(模拟)" },
      { id: "f3", label: "证据绑定", note: "关键主张绑定支持/反对证据与等级(模拟)" },
      { id: "f4", label: "共识草稿", note: "生成循证共识草稿(模拟)" },
      { id: "f5", label: "医生审核门禁", note: "强制医生审核,未批准不可发布(模拟)" },
      { id: "f6", label: "版本修订", note: "新证据触发新版本,旧版本不可变(模拟)" },
      { id: "f7", label: "多语言生命周期同步", note: "撤回/取代同步至所有语言(模拟)" },
    ],
    reviewStatusLabel: "医生审核状态",
    reviewStatusValue: "pending — 等待医生审核(模拟,未发布)",
  },
  en: {
    heading: "③ Evidence-based consensus flow",
    note: "Shows the multi-agent evidence-based discussion structure. All flow placeholders and structural names — no real medical conclusions.",
    rolesHeading: "Agent roles (≥5, Evidence & Safety mandatory)",
    mandatoryBadge: "Mandatory",
    roles: [
      { id: "r1", role: "moderator", mandatory: false, description: "Facilitation and orchestration (mock)" },
      { id: "r2", role: "evidence_medicine", mandatory: true, description: "Evidence-based appraisal (mock, mandatory)" },
      { id: "r3", role: "clinical_perspective", mandatory: false, description: "Clinical perspective (mock)" },
      { id: "r4", role: "adversarial_reviewer", mandatory: false, description: "Adversarial review (mock)" },
      { id: "r5", role: "medical_safety_compliance", mandatory: true, description: "Medical safety compliance (mock, mandatory)" },
      { id: "r6", role: "public_health", mandatory: false, description: "Public-health perspective (optional, mock)" },
    ],
    evidenceHeading: "Evidence structure (placeholders)",
    evidence: [
      { id: "e1", label: "Evidence item A (mock)", stance: "supporting", level: "high" },
      { id: "e2", label: "Evidence item B (mock)", stance: "supporting", level: "moderate" },
      { id: "e3", label: "Evidence item C (mock)", stance: "opposing", level: "low" },
    ],
    flowHeading: "Flow",
    flow: [
      { id: "f1", label: "Independent analysis", note: "Each role analyzes independently (mock)" },
      { id: "f2", label: "Adversarial review", note: "Adversarially review key claims (mock)" },
      { id: "f3", label: "Evidence binding", note: "Key claims bind supporting/opposing evidence and level (mock)" },
      { id: "f4", label: "Consensus draft", note: "Generate the evidence consensus draft (mock)" },
      { id: "f5", label: "Doctor review gate", note: "Mandatory doctor review; no publish without approval (mock)" },
      { id: "f6", label: "Version revision", note: "New evidence triggers a new version; old version immutable (mock)" },
      { id: "f7", label: "Multilingual lifecycle sync", note: "Withdrawal/supersession syncs across all languages (mock)" },
    ],
    reviewStatusLabel: "Medical review status",
    reviewStatusValue: "pending — awaiting medical review (mock, not published)",
  },
};

export interface ShowcaseData {
  lang: ShowcaseLang;
  demonstrationData: boolean;
  chrome: PageChrome;
  gate: GateSection;
  stateMachine: StateMachineSection;
  consensus: ConsensusSection;
}

export function isShowcaseLang(value: string): value is ShowcaseLang {
  return value === "zh" || value === "en";
}

/** Resolve a route lang param to a showcase language (default en). */
export function resolveShowcaseLang(value: string | undefined): ShowcaseLang {
  return value && isShowcaseLang(value) ? value : "en";
}

/** The single source of truth the page and tests both consume. */
export function getShowcaseData(lang: ShowcaseLang): ShowcaseData {
  return {
    lang,
    demonstrationData: DEMONSTRATION_DATA,
    chrome: PAGE_CHROME[lang],
    gate: GATE_SECTION[lang],
    stateMachine: STATE_MACHINE_SECTION[lang],
    consensus: CONSENSUS_SECTION[lang],
  };
}
