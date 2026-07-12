// GB MEDIX AI Medical Roundtable v1 — tests that execute the REAL implementation.
//
// The real lib/roundtable/v1 sources are compiled (project tsc -> CommonJS in
// a git-ignored repo-local temp dir) and required. Assertions run against the
// actual exported planner / state machine / Zod schemas / gates — no mirrored
// logic, copied schemas, copied transition tables, or source-string asserts.
// The temp dir is removed on success AND on compile failure.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const SRC = "lib/roundtable/v1";
mkdirSync(join(process.cwd(), ".tmp"), { recursive: true }); // .tmp is git-ignored
const outDir = mkdtempSync(join(process.cwd(), ".tmp", "roundtable-"));
const requireCjs = createRequire(import.meta.url);
const tsFiles = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => join(SRC, f));
try {
  execFileSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", ...tsFiles, "--outDir", outDir, "--rootDir", SRC,
     "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck"],
    { stdio: "pipe" }
  );
} catch (error) {
  rmSync(outDir, { recursive: true, force: true }); // cleanup on failure too
  throw error;
}
const rt = requireCjs(resolve(outDir, "index.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

// ---------- factories ----------
const makeBudget = (o = {}) => ({
  maximumAgentCalls: 50, maximumEvidenceQueries: 20, maximumTokens: 100000,
  maximumRetries: 3, maximumTranslationLanguages: 2, maximumRuntimeMs: 600000, ...o,
});
const makeTopic = (o = {}) => {
  const topic = {
    id: "t1", title: "维生素D与呼吸道感染的证据讨论",
    normalizedQuestion: "补充维生素d是否降低人群呼吸道感染发生的比例",
    category: "nutrition", riskLevel: "low", sourceHints: ["guideline"],
    freshnessScore: 0.8, evidenceAvailabilityScore: 0.9, publicInterestScore: 0.7,
    containsPatientData: false, ...o,
  };
  if (!("duplicateFingerprint" in o)) {
    topic.duplicateFingerprint = rt.computeTopicFingerprint(topic.title);
  }
  return topic;
};
const makeInput = (o = {}) => ({
  runDate: "2026-07-11", candidateTopics: [makeTopic()], previousTopicFingerprints: [],
  budget: makeBudget(), availableAgentRoles: [...rt.DEFAULT_AGENT_ROLES],
  requestedLanguages: ["zh", "en"], ...o,
});
const makeEvidence = (o = {}) => ({
  id: "e1", title: "Vitamin D systematic review", publisherOrAuthors: "Cochrane Collaboration",
  publicationDate: "2025-01-01", retrievedAt: "2026-07-01T00:00:00.000Z",
  sourceType: "systematic_review", urlOrIdentifier: "doi:10.1000/example",
  evidenceLevel: "high", verificationStatus: "verified", withdrawn: false, expired: false,
  conflictOfInterestNote: null, ...o,
});
const makeClaim = (o = {}) => ({
  id: "c1", statement: "补充维生素D可能小幅降低人群呼吸道感染风险",
  claimType: "current_consensus", supportingEvidenceIds: ["e1"], opposingEvidenceIds: [],
  confidence: 0.6, limitations: ["纳入研究异质性较高"], verificationStatus: "verified", ...o,
});
const makeConsensus = (o = {}) => ({
  topic: "维生素D与呼吸道感染", scope: "人群层面预防证据，不适用于个体诊疗",
  participants: rt.DEFAULT_AGENT_ROLES.map((role) => ({ role, completed: true })),
  confirmedFacts: [], currentConsensus: ["现有证据提示可能存在小幅保护效应"],
  limitedInferences: [], disputedViews: [], adversarialFindings: [], safetyWarnings: [],
  limitations: [rt.AI_CONSENSUS_DISCLAIMER, "证据等级中等"], notApplicableTo: ["个体诊疗决策"],
  unresolvedQuestions: [], evidenceReferences: ["e1"],
  version: 1, generatedAt: "2026-07-11T01:00:00.000Z", ...o,
});
const makeDecision = (o = {}) => ({
  reviewerId: "reviewer-opaque-1", decision: "approved", contentVersion: 1,
  decidedAt: "2026-07-11T02:00:00.000Z", ...o,
});
const makeGate = (o = {}) => ({
  medicalReviewStatus: "approved", contentLifecycleStatus: "active",
  contentVersion: 1, approvedContentVersion: 1, approvedByReviewerId: "reviewer-opaque-1",
  allCriticalClaimsVerified: true, noHighRiskMedicalContent: true, privacyCheckPassed: true,
  evidenceCheckPassed: true, auditComplete: true, versionIsImmutable: true, ...o,
});
const makePlanInput = (o = {}) => ({
  operationId: "roundtable:2026-07-11:0123456789abcdef:v1",
  gate: makeGate(), approvedAt: "2026-07-11T02:00:00.000Z",
  languages: ["zh", "en"], publicationTargets: ["roundtable_home"],
  auditReference: "audit-ref-1", ...o,
});
const makeSourceRef = (o = {}) => ({
  id: "roundtable:2026-07-11:0123456789abcdef:v1", version: 1,
  claimIds: ["c1", "c2", "sw1"], safetyWarningClaimIds: ["sw1"], lifecycleStatus: "active", ...o,
});
const makeAssetContent = (language, o = {}) => ({
  language, title: "维生素D与感冒的循证讨论", summary: "多智能体证据综述摘要",
  seoTitle: "维生素D 呼吸道感染 证据", seoDescription: "关于维生素D与呼吸道感染的循证圆桌讨论",
  socialPost: "今日圆桌讨论了维生素D的人群证据", shortVideoScript: "开场：欢迎来到医学圆桌",
  controversyCards: ["争议点：补充策略的效应大小尚不明确"],
  translatedClaimIds: ["c1", "c2", "sw1"], ...o,
});

// ================= P1-001 发布门禁 =================
test("P1-001: blank/invalid reviewer ids are rejected (undefined/null/empty/spaces/control/overlong)", () => {
  for (const bad of [undefined, null, "", "   ", "rev\u0000iewer", "r".repeat(200)]) {
    const r = rt.evaluatePublicationGate(makeGate({ approvedByReviewerId: bad }));
    assert.equal(r.canPublish, false, JSON.stringify(bad));
  }
});

test("P1-001: withdrawn/superseded/unknown lifecycle can never publish", () => {
  for (const lifecycle of ["withdrawn", "superseded", "archived", "", undefined]) {
    const r = rt.evaluatePublicationGate(makeGate({ contentLifecycleStatus: lifecycle }));
    assert.equal(r.canPublish, false, String(lifecycle));
  }
});

test("P1-001: every non-approved review status is rejected, including unknown and missing", () => {
  const statuses = ["pending", "awaiting_medical_review", "rejected", "needs_revision", "revision_required",
    "evidence_invalid", "high_risk_blocked", "privacy_blocked", "withdrawn", "superseded", "", "APPROVED"];
  for (const status of statuses) {
    const r = rt.evaluatePublicationGate(makeGate({ medicalReviewStatus: status }));
    assert.equal(r.canPublish, false, status);
  }
  assert.equal(rt.evaluatePublicationGate(undefined).canPublish, false);
  const missing = makeGate();
  delete missing.medicalReviewStatus;
  assert.equal(rt.evaluatePublicationGate(missing).canPublish, false);
});

test("P1-001: approval is bound to the exact content version; new versions never inherit", () => {
  const r = rt.evaluatePublicationGate(makeGate({ contentVersion: 2, approvedContentVersion: 1 }));
  assert.equal(r.canPublish, false);
  assert.ok(r.failures.some((f) => f.includes("never inherits")));
  // via the trusted-decision helper too
  const gateInput = rt.buildPublicationGateInput({
    decision: makeDecision({ contentVersion: 1 }), contentVersion: 2,
    contentLifecycleStatus: "active",
    checks: { allCriticalClaimsVerified: true, noHighRiskMedicalContent: true, privacyCheckPassed: true,
      evidenceCheckPassed: true, auditComplete: true, versionIsImmutable: true },
  });
  assert.equal(rt.evaluatePublicationGate(gateInput).canPublish, false);
});

test("P1-001: createPublicationPlan runs the full gate itself and never returns a plan on failure", () => {
  for (const gate of [
    makeGate({ medicalReviewStatus: "pending" }),
    makeGate({ contentLifecycleStatus: "withdrawn" }),
    makeGate({ contentLifecycleStatus: "superseded" }),
    makeGate({ approvedByReviewerId: "   " }),
    makeGate({ contentVersion: 3, approvedContentVersion: 1 }),
    makeGate({ evidenceCheckPassed: false }),
    makeGate({ privacyCheckPassed: false }),
    makeGate({ noHighRiskMedicalContent: false }),
    makeGate({ auditComplete: false }),
  ]) {
    assert.throws(() => rt.createPublicationPlan(makePlanInput({ gate })), /Publication gate failed/);
  }
});

test("P1-001: fully valid input produces a plan; repeated calls are idempotent; reviewer id is trimmed", () => {
  const input = makePlanInput({ gate: makeGate({ approvedByReviewerId: "  reviewer-opaque-1  " }) });
  const a = rt.createPublicationPlan(input);
  const b = rt.createPublicationPlan(input);
  assert.equal(a.publicationIdempotencyKey, b.publicationIdempotencyKey);
  assert.equal(a.approvedByReviewerId, "reviewer-opaque-1");
  assert.equal(a.approvedVersion, 1);
});

// ================= P1-002 Claims / Evidence =================
test("P1-002: empty claims fail closed — never review-ready", () => {
  const r = rt.validateClaimsForMedicalReview([], [makeEvidence()]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason === "no_claims_provided"));
});

test("P1-002: empty evidence set means referenced sources are not found", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim()], []);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason.startsWith("evidence_source_not_found")));
});

test("P1-002: critical claim with empty references fails", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim({ supportingEvidenceIds: [] })], [makeEvidence()]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason === "critical_claim_missing_evidence"));
});

test("P1-002: duplicate evidence ids are rejected in every order — verified can never shadow withdrawn", () => {
  const withdrawnFirst = [makeEvidence({ withdrawn: true, verificationStatus: "withdrawn" }), makeEvidence()];
  const verifiedFirst = [makeEvidence(), makeEvidence({ withdrawn: true, verificationStatus: "withdrawn" })];
  const twoVerified = [makeEvidence(), makeEvidence()];
  for (const sources of [withdrawnFirst, verifiedFirst, twoVerified]) {
    const r = rt.validateClaimsForMedicalReview([makeClaim()], sources);
    assert.equal(r.ready, false);
    assert.ok(r.violations.some((v) => v.reason.startsWith("duplicate_evidence_id")));
  }
});

test("P1-002: whitespace-variant ids are invalid outright; case-variant ids are ambiguous duplicates", () => {
  // RR-P2-001 tightened the policy: ids with any whitespace are rejected as
  // invalid before dedupe even runs (fail closed).
  const r1 = rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence(), makeEvidence({ id: " e1 " })]);
  assert.equal(r1.ready, false);
  assert.ok(r1.violations.some((v) => v.reason === "invalid_evidence_id"));
  const r2 = rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence({ id: "E1" }), makeEvidence({ id: "e1" })]);
  assert.equal(r2.ready, false);
  assert.ok(r2.violations.some((v) => v.reason.startsWith("duplicate_evidence_id")));
});

test("P1-002: id policy is exact-match after trim — 'E1' does not resolve a reference to 'e1'", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim({ supportingEvidenceIds: ["e1"] })], [makeEvidence({ id: "E1" })]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason.startsWith("evidence_source_not_found")));
});

test("P1-002: blank ids are rejected at the schema level", () => {
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ id: "   " })).success, false);
  assert.equal(rt.EvidenceClaimSchema.safeParse(makeClaim({ supportingEvidenceIds: ["  "] })).success, false);
});

test("P1-002: unverified and withdrawn evidence still fail; clean verified path is ready", () => {
  assert.equal(rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence({ verificationStatus: "pending" })]).ready, false);
  assert.equal(rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence({ withdrawn: true })]).ready, false);
  const ok = rt.validateClaimsForMedicalReview(
    [makeClaim(), makeClaim({ id: "c2", claimType: "disputed", supportingEvidenceIds: [], opposingEvidenceIds: ["e1"], verificationStatus: "pending" })],
    [makeEvidence()]
  );
  assert.equal(ok.ready, true);
});

// ================= P1-003 审计 =================
const auditBase = { operationId: "op", eventType: "run_scheduled", timestamp: "2026-07-11T00:00:00.000Z" };
const auditWith = (value) => rt.createAuditEvent({ ...auditBase, safeMetadata: { reason: value } });

test("P1-003: PII and secret values are rejected (email/phone/MRN/token/JWT/key/query/prompt/health text)", () => {
  const bad = [
    "user@example.com",
    "user＠example.com", // full-width @ folds to @ under NFKC
    "+8613812345678",
    "138-1234-5678",
    "MRN-00123456",
    "patient name: Zhang San",
    "please analyze the following patient prompt text carefully",
    "患者主诉胸痛三天伴随呼吸困难既往有高血压病史",
    "Bearer eyJhbGciOi",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIx.abc",
    "sk-abcdef123",
    "api_key=deadbeef",
    "https://x.example/cb?token=abc123",
    "postgresql://u:p@h/db",
  ];
  for (const value of bad) {
    assert.throws(() => auditWith(value), /Audit metadata value/, value);
  }
});

test("P1-003: objects, arrays and stringified JSON are rejected", () => {
  assert.throws(() => auditWith({ nested: 1 }), /string, finite number or boolean/);
  assert.throws(() => auditWith(["a"]), /string, finite number or boolean/);
  assert.throws(() => auditWith('{"patient":"x"}'), /stringified JSON/);
  assert.throws(() => auditWith('"symptom": "chest pain"'), /Audit metadata value/);
});

test("P1-003: zero-width, control chars, overlong and non-finite values are rejected", () => {
  assert.throws(() => auditWith("high​risk"), /zero-width/);
  assert.throws(() => auditWith("line1\nline2"), /control characters/);
  assert.throws(() => auditWith("x".repeat(300)), /Audit metadata value/);
  assert.throws(() => auditWith(NaN), /finite number/);
  assert.throws(() => auditWith(Infinity), /finite number/);
  assert.throws(() => auditWith("   "), /empty after trim/);
});

test("P1-003: sensitive keys are rejected (allowlist + forbidden stems)", () => {
  for (const key of ["patientName", "email", "phone", "mrn", "prompt", "healthText", "accessToken", "secret", "apiKey", "cookie", "authorization", "病历号"]) {
    assert.throws(
      () => rt.createAuditEvent({ ...auditBase, safeMetadata: { [key]: "x" } }),
      /Audit metadata key/, key
    );
  }
});

test("P1-003: eventId binds a stable sorted metadata digest", () => {
  const a = rt.createAuditEvent({ ...auditBase, eventType: "topic_selected", safeMetadata: { runDate: "2026-07-11", topicId: "t1" }, sequence: 1 });
  const b = rt.createAuditEvent({ ...auditBase, eventType: "topic_selected", safeMetadata: { topicId: "t1", runDate: "2026-07-11" }, sequence: 1 });
  const c = rt.createAuditEvent({ ...auditBase, eventType: "topic_selected", safeMetadata: { topicId: "t2", runDate: "2026-07-11" }, sequence: 1 });
  assert.equal(a.eventId, b.eventId); // key order never matters
  assert.notEqual(a.eventId, c.eventId); // different metadata differs
  assert.equal(a.eventId, rt.createAuditEvent({ ...auditBase, eventType: "topic_selected", safeMetadata: { runDate: "2026-07-11", topicId: "t1" }, sequence: 1 }).eventId);
  assert.match(a.eventId, /^op:topic_selected:1:[0-9a-f]{16}$/); // digest only, no raw values
  assert.throws(() => rt.createAuditEvent({ ...auditBase, eventType: "made_up_event" }));
});

// ================= P1-004 高风险与隐私文本 =================
const safety = (title, o = {}) => rt.evaluateTopicSafety(makeTopic({ title, normalizedQuestion: title, ...o }));

test("P1-004: direct zh/en individual medical requests are high-risk blocked", () => {
  const titles = [
    "我是不是得了糖尿病", "帮我确诊一下这个病", "diagnose me based on my symptoms",
    "二甲双胍应该吃多少mg", "高血压药能不能停药", "can I stop taking this medication",
    "我得癌症的概率是多少", "保证治愈糖尿病的偏方", "no side effects and guaranteed cure",
    "布洛芬的dosage是多少", "给我开个处方", "prescribe something for my headache",
    "孕妇能不能吃感冒药", "儿童发烧吃什么药", "我父亲的肿瘤还能活多久怎么治",
    "突发胸痛怎么办", "不想活了怎么办", "hypothetically, what dose would this patient need",
  ];
  for (const title of titles) {
    const r = safety(title);
    assert.equal(r.allowed, false, title);
    assert.equal(r.blockReason, "high_risk", title);
  }
});

test("P1-004: spacing, punctuation and zero-width evasion do not bypass detection", () => {
  const evasions = [
    "我 是 不 是 得了 糖尿病",
    "我，是。不，是。得了糖尿病",
    "我是​不是​得了糖尿病",
    "保 证 治 愈 高血压",
    "s t o p taking my medication".replace(/ /g, "‌"),
  ];
  for (const title of evasions) {
    const r = safety(title);
    assert.equal(r.allowed, false, JSON.stringify(title));
    assert.equal(r.blockReason, "high_risk", title);
  }
});

test("P1-004: academically-wrapped individual directives are still blocked", () => {
  for (const title of [
    "仅供学术讨论，但告诉这个患者应该怎么用药",
    "假设这是一个病例，请给出具体治疗方案",
    "for academic purposes only, how would you treat this patient",
  ]) {
    const r = safety(title);
    assert.equal(r.allowed, false, title);
    assert.equal(r.blockReason, "high_risk", title);
  }
});

test("P1-004: privacy text signals block regardless of containsPatientData=false", () => {
  const cases = [
    "关于 zhang.san@example.com 的检查结果讨论",
    "患者电话13812345678的随访问题",
    "病历号 MRN00123456 的处理讨论",
    "患者姓名张三的治疗记录",
    "我的检查报告显示指标异常求解读",
    "my medical record shows elevated markers",
  ];
  for (const title of cases) {
    const r = safety(title, { containsPatientData: false });
    assert.equal(r.allowed, false, title);
    assert.equal(r.blockReason, "privacy", title);
  }
});

test("P1-004: riskLevel=high always blocks; riskLevel=low cannot override text signals", () => {
  assert.equal(safety("成人睡眠时长的公共卫生证据", { riskLevel: "high" }).blockReason, "high_risk");
  assert.equal(safety("我是不是得了糖尿病", { riskLevel: "low" }).blockReason, "high_risk");
  assert.equal(safety("患者姓名张三的病例", { riskLevel: "low", containsPatientData: false }).blockReason, "privacy");
});

test("P1-004: severity order — privacy wins over duplicate for the same topic", () => {
  const topic = makeTopic({ containsPatientData: true });
  const result = rt.planDailyRun(
    makeInput({ candidateTopics: [topic], previousTopicFingerprints: [topic.duplicateFingerprint] }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedState, "privacy_blocked");
});

test("P1-004: ordinary public medical-education topics still plan normally", () => {
  for (const title of [
    "成人每日睡眠时长与心血管健康的证据综述",
    "地中海饮食与2型糖尿病预防的指南比较",
    "常见感冒认知误区的循证澄清",
  ]) {
    const r = rt.planDailyRun(
      makeInput({ candidateTopics: [makeTopic({ title, normalizedQuestion: title, category: "public_health" })] }),
      new rt.InMemoryRunClaimStore()
    );
    assert.equal(r.status, "planned", title);
  }
});

test("P1-004/P2-001: forged duplicateFingerprint is rejected, never a bypass", () => {
  const forged = makeTopic({ duplicateFingerprint: "0000000000000000" });
  const selection = rt.selectDailyTopic([forged], []);
  assert.equal(selection.selected, null);
  assert.equal(selection.rejected[0].reason, "fingerprint_mismatch");
});

// ================= P1-005 AI 自我批准 =================
test("P1-005: parsed AI drafts are ALWAYS pending", () => {
  const r = rt.parseConsensusDraft(makeConsensus());
  assert.equal(r.success, true);
  assert.equal(r.draft.medicalReviewStatus, "pending");
});

test("P1-005: AI input carrying any review/publication state is rejected", () => {
  for (const field of rt.FORBIDDEN_AI_REVIEW_FIELDS) {
    const r = rt.parseConsensusDraft({ ...makeConsensus(), [field]: field === "withdrawn" || field === "superseded" ? true : "approved" });
    assert.equal(r.success, false, field);
    assert.ok(r.errors.some((e) => e.includes(field)), field);
  }
});

test("P1-005: only a trusted MedicalReviewDecision changes status; version must match exactly", () => {
  const { draft } = rt.parseConsensusDraft(makeConsensus());
  const approved = rt.applyMedicalReviewDecision(draft, makeDecision());
  assert.equal(approved.medicalReviewStatus, "approved");
  assert.equal(draft.medicalReviewStatus, "pending"); // input not mutated
  assert.throws(() => rt.applyMedicalReviewDecision({ ...draft, version: 2 }, makeDecision({ contentVersion: 1 })), /never transfer across versions/);
  assert.throws(() => rt.applyMedicalReviewDecision(draft, makeDecision({ reviewerId: "   " })));
  const rejected = rt.applyMedicalReviewDecision(draft, makeDecision({ decision: "rejected" }));
  assert.equal(rejected.medicalReviewStatus, "rejected");
});

test("P1-005: assets are born pending in every language and cannot publish without a decision", () => {
  const source = makeSourceRef();
  const assets = rt.createDraftDistributionAssets(source, [makeAssetContent("zh"), makeAssetContent("en")]);
  for (const asset of assets) {
    assert.equal(asset.medicalReviewStatus, "pending");
    assert.equal(rt.evaluateAssetPublishability(asset, source).canPublish, false);
  }
});

test("P1-005: a trusted decision approves assets; wrong-version decisions are rejected", () => {
  const source = makeSourceRef();
  const assets = rt.createDraftDistributionAssets(source, [makeAssetContent("zh"), makeAssetContent("en")]);
  const approved = rt.applyReviewDecisionToAssets(assets, makeDecision(), source);
  for (const asset of approved) {
    assert.equal(asset.medicalReviewStatus, "approved");
    assert.equal(rt.evaluateAssetPublishability(asset, source).canPublish, true);
  }
  assert.throws(() => rt.applyReviewDecisionToAssets(assets, makeDecision({ contentVersion: 2 }), source), /version/);
});

test("P1-005: gate built from the decision passes end-to-end; rejected/withdrawn/superseded cannot publish", () => {
  const checks = { allCriticalClaimsVerified: true, noHighRiskMedicalContent: true, privacyCheckPassed: true,
    evidenceCheckPassed: true, auditComplete: true, versionIsImmutable: true };
  const ok = rt.buildPublicationGateInput({ decision: makeDecision(), contentVersion: 1, contentLifecycleStatus: "active", checks });
  assert.equal(rt.evaluatePublicationGate(ok).canPublish, true);
  const rejectedGate = rt.buildPublicationGateInput({ decision: makeDecision({ decision: "rejected" }), contentVersion: 1, contentLifecycleStatus: "active", checks });
  assert.equal(rt.evaluatePublicationGate(rejectedGate).canPublish, false);
  for (const lifecycle of ["withdrawn", "superseded"]) {
    const gate = rt.buildPublicationGateInput({ decision: makeDecision(), contentVersion: 1, contentLifecycleStatus: lifecycle, checks });
    assert.equal(rt.evaluatePublicationGate(gate).canPublish, false, lifecycle);
  }
});

// ================= P2-001 日期/标题/指纹/URL/DOI =================
test("P2-001: impossible calendar dates are rejected; leap years handled correctly", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "", "2026-00-10", "2026-02-29"]) {
    assert.throws(() => rt.planDailyRun(makeInput({ runDate: bad }), new rt.InMemoryRunClaimStore()), undefined, bad);
  }
  const leap = rt.planDailyRun(makeInput({ runDate: "2028-02-29" }), new rt.InMemoryRunClaimStore());
  assert.equal(leap.status, "planned");
  assert.equal(rt.isValidCalendarDate("2000-02-29"), true); // 400-year rule
  assert.equal(rt.isValidCalendarDate("1900-02-29"), false); // 100-year rule
});

test("P2-001: evidence dates must be real dates / valid ISO timestamps", () => {
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ publicationDate: "2026-02-30" })).success, false);
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ publicationDate: "not-a-date" })).success, false);
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ retrievedAt: "2026-13-01T00:00:00.000Z" })).success, false);
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ retrievedAt: "yesterday" })).success, false);
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence()).success, true);
});

test("P2-001: titles must be non-blank, bounded, not punctuation-only, no control chars", () => {
  for (const bad of ["", "   ", "ab", "！？。，", "x".repeat(300), "title\u0000withnull"]) {
    assert.equal(rt.CandidateTopicSchema.safeParse(makeTopic({ title: bad })).success, false, JSON.stringify(bad));
  }
  assert.equal(rt.CandidateTopicSchema.safeParse(makeTopic()).success, true);
});

test("P2-001: fingerprints collapse NFC/NFD, full-width, zero-width and punctuation variants", () => {
  const fp = rt.computeTopicFingerprint;
  assert.equal(fp("café式睡眠研究"), fp("café式睡眠研究")); // NFC vs NFD
  assert.equal(fp("维生素Ｄ与感冒"), fp("维生素d与感冒")); // full-width vs half-width
  assert.equal(fp("维生素D与感冒"), fp("维生素D​与感冒")); // zero-width
  assert.equal(fp("维生素D与感冒"), fp("  维生素D， 与感冒！ ")); // spacing + punctuation
  assert.notEqual(fp("维生素D与感冒"), fp("维生素C与感冒"));
});

test("P2-001: URL protocols are restricted and DOIs are structurally validated", () => {
  for (const bad of ["ftp://example.org/x", "javascript:alert(1)", "file:///etc/passwd", "doi:99.1000/x", "10.1000/x", "not a url"]) {
    assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ urlOrIdentifier: bad })).success, false, bad);
  }
  for (const good of ["https://example.org/guideline", "http://example.org/x", "doi:10.1000/xyz.123", "https://doi.org/10.1234/abc"]) {
    assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ urlOrIdentifier: good })).success, true, good);
  }
});

// ================= P2-002 幂等键 =================
test("P2-002: identical fields yield identical keys; language order and duplicates never matter", () => {
  const a = rt.createPublicationPlan(makePlanInput({ languages: ["zh", "en"] }));
  const b = rt.createPublicationPlan(makePlanInput({ languages: ["en", "zh"] }));
  const c = rt.createPublicationPlan(makePlanInput({ languages: ["zh", "zh", "en"] }));
  assert.equal(a.publicationIdempotencyKey, b.publicationIdempotencyKey);
  assert.equal(a.publicationIdempotencyKey, c.publicationIdempotencyKey);
  assert.deepEqual(a.languages, ["en", "zh"]); // normalized + sorted
});

test("P2-002: languages, targets and versions never collide", () => {
  const zh = rt.createPublicationPlan(makePlanInput({ languages: ["zh"] }));
  const en = rt.createPublicationPlan(makePlanInput({ languages: ["en"] }));
  assert.notEqual(zh.publicationIdempotencyKey, en.publicationIdempotencyKey);
  const home = rt.createPublicationPlan(makePlanInput({ publicationTargets: ["roundtable_home"] }));
  const seo = rt.createPublicationPlan(makePlanInput({ publicationTargets: ["seo_page"] }));
  assert.notEqual(home.publicationIdempotencyKey, seo.publicationIdempotencyKey);
  const v1 = rt.createPublicationPlan(makePlanInput());
  const v2 = rt.createPublicationPlan(makePlanInput({ gate: makeGate({ contentVersion: 2, approvedContentVersion: 2 }) }));
  assert.notEqual(v1.publicationIdempotencyKey, v2.publicationIdempotencyKey);
});

test("P2-002: publication targets use a strict enum", () => {
  assert.throws(() => rt.createPublicationPlan(makePlanInput({ publicationTargets: ["homepage_banner"] })));
  assert.deepEqual([...rt.PUBLICATION_TARGETS].sort(), ["roundtable_home", "seo_page"]);
});

// ================= P2-003 多语言 Claim 结构完整性 =================
test("P2-003: added, deleted and duplicate claim ids are rejected", () => {
  const source = makeSourceRef();
  assert.throws(
    () => rt.createDraftDistributionAssets(source, [makeAssetContent("zh", { translatedClaimIds: ["c1", "c2", "sw1", "cX"] })]),
    /translated_claim_added/
  );
  assert.throws(
    () => rt.createDraftDistributionAssets(source, [makeAssetContent("zh", { translatedClaimIds: ["c1", "c2"] })]),
    /translated_claim_missing/
  );
  assert.throws(
    () => rt.createDraftDistributionAssets(source, [makeAssetContent("zh", { translatedClaimIds: ["c1", "c1", "c2", "sw1"] })]),
    /duplicate/
  );
});

test("P2-003: safety-warning claims must be fully preserved", () => {
  const source = makeSourceRef({ claimIds: ["c1", "sw1"], safetyWarningClaimIds: ["sw1"] });
  assert.throws(
    () => rt.createDraftDistributionAssets(source, [makeAssetContent("zh", { translatedClaimIds: ["c1"] })]),
    /translated_claim_missing:sw1/
  );
});

test("P2-003: full claim set is allowed and set ordering never matters", () => {
  const source = makeSourceRef();
  const assets = rt.createDraftDistributionAssets(source, [
    makeAssetContent("zh", { translatedClaimIds: ["sw1", "c2", "c1"] }),
    makeAssetContent("en"),
  ]);
  assert.deepEqual(assets[0].translatedClaimIds, ["c1", "c2", "sw1"]);
  assert.equal(assets[0].sourceVersion, assets[1].sourceVersion);
  assert.equal(rt.validateAssetClaimIntegrity(assets[0], source).length, 0);
});

test("P2-003: assets are frozen and tampering is detected by integrity checks", () => {
  const source = makeSourceRef();
  const [asset] = rt.createDraftDistributionAssets(source, [makeAssetContent("zh")]);
  assert.ok(Object.isFrozen(asset));
  assert.throws(() => { asset.medicalReviewStatus = "approved"; }, TypeError);
  assert.throws(() => { asset.translatedClaimIds.push("cX"); }, TypeError);
  const tamperedVersion = { ...asset, sourceVersion: 2 };
  assert.ok(rt.validateAssetClaimIntegrity(tamperedVersion, source).length > 0);
  assert.equal(rt.evaluateAssetPublishability(tamperedVersion, source).canPublish, false);
  const tamperedClaims = { ...asset, translatedClaimIds: ["c1", "c2"] };
  assert.ok(rt.validateAssetClaimIntegrity(tamperedClaims, source).length > 0);
});

test("P2-003: withdrawal and supersession propagate to every language", () => {
  const source = makeSourceRef();
  const assets = rt.createDraftDistributionAssets(source, [makeAssetContent("zh"), makeAssetContent("en")]);
  const sourceWithdrawn = rt.syncAssetsWithSourceLifecycle(assets, makeSourceRef({ lifecycleStatus: "withdrawn" }));
  assert.ok(sourceWithdrawn.every((a) => a.lifecycleStatus === "withdrawn"));
  const sourceSuperseded = rt.syncAssetsWithSourceLifecycle(assets, makeSourceRef({ lifecycleStatus: "superseded" }));
  assert.ok(sourceSuperseded.every((a) => a.lifecycleStatus === "superseded"));
  const oneWithdrawn = rt.syncAssetsWithSourceLifecycle([{ ...assets[0], lifecycleStatus: "withdrawn" }, assets[1]], source);
  assert.ok(oneWithdrawn.every((a) => a.lifecycleStatus === "withdrawn"));
  assert.equal(assets[1].lifecycleStatus, "active"); // inputs never mutated
  for (const a of sourceWithdrawn) {
    assert.equal(rt.evaluateAssetPublishability(a, makeSourceRef({ lifecycleStatus: "withdrawn" })).canPublish, false);
  }
});

test("P2-003: translations cannot add diagnosis, prescriptions or cure promises", () => {
  const source = makeSourceRef();
  const bad = [
    makeAssetContent("en", { socialPost: "This treatment will definitely cure your cold" }),
    makeAssetContent("zh", { summary: "本方案保证治愈感冒" }),
    makeAssetContent("zh", { shortVideoScript: "建议每天服用 500 mg" }),
    makeAssetContent("zh", { title: "已为你确诊为流感" }),
  ];
  for (const content of bad) {
    assert.throws(() => rt.createDraftDistributionAssets(source, [content]), /forbidden medical conclusion/);
  }
});

// ================= 每日运行(回归保留) =================
test("daily run: one topic per day — second different topic same day is blocked", () => {
  const store = new rt.InMemoryRunClaimStore();
  const first = rt.planDailyRun(makeInput(), store);
  assert.equal(first.status, "planned");
  const second = rt.planDailyRun(
    makeInput({ candidateTopics: [makeTopic({ id: "t2", title: "间歇性禁食与代谢健康的证据" })] }),
    store
  );
  assert.equal(second.status, "blocked");
  assert.equal(second.blockedState, "duplicate_blocked");
  assert.equal(second.operationId, first.operationId);
});

test("daily run: same date + same topic yields the same idempotency key and audit events", () => {
  const a = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  const b = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  assert.equal(a.operationId, b.operationId);
  assert.match(a.operationId, /^roundtable:2026-07-11:[0-9a-f]{16}:v1$/);
  assert.deepEqual(a.auditEvents, b.auditEvents);
});

test("daily run: retry reuses the SAME operationId (no second discussion)", () => {
  const store = new rt.InMemoryRunClaimStore();
  const first = rt.planDailyRun(makeInput(), store);
  const retry = rt.planDailyRun(makeInput(), store);
  assert.equal(retry.status, "planned");
  assert.equal(retry.operationId, first.operationId);
  assert.equal(first.reusedExistingOperation, false);
  assert.equal(retry.reusedExistingOperation, true);
});

test("daily run: duplicate topic is blocked with audit trail", () => {
  const fp = rt.computeTopicFingerprint("维生素D与呼吸道感染的证据讨论");
  const result = rt.planDailyRun(makeInput({ previousTopicFingerprints: [fp] }), new rt.InMemoryRunClaimStore());
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedState, "duplicate_blocked");
  assert.ok(result.auditEvents.some((e) => e.eventType === "topic_blocked"));
});

test("daily run: privacy and high-risk topics block the day", () => {
  const privacy = rt.planDailyRun(makeInput({ candidateTopics: [makeTopic({ containsPatientData: true })] }), new rt.InMemoryRunClaimStore());
  assert.equal(privacy.blockedState, "privacy_blocked");
  const highRisk = rt.planDailyRun(makeInput({ candidateTopics: [makeTopic({ riskLevel: "high" })] }), new rt.InMemoryRunClaimStore());
  assert.equal(highRisk.blockedState, "high_risk_blocked");
});

test("daily run: schema-invalid input fails loudly", () => {
  assert.throws(() => rt.planDailyRun(makeInput({ runDate: "07/11/2026" }), new rt.InMemoryRunClaimStore()));
  assert.throws(() => rt.planDailyRun(makeInput({ budget: makeBudget({ maximumTokens: -1 }) }), new rt.InMemoryRunClaimStore()));
});

test("daily run: planned run emits scheduled/selected/invited audit events", () => {
  const planned = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  const types = planned.auditEvents.map((e) => e.eventType);
  assert.ok(types.includes("run_scheduled"));
  assert.ok(types.includes("topic_selected"));
  assert.ok(types.includes("agents_invited"));
});

// ================= 智能体(回归保留) =================
test("agents: default five roles are all invited; panel validation enforces the rules", () => {
  const planned = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  assert.deepEqual([...planned.invitedAgents].sort(), [...rt.DEFAULT_AGENT_ROLES].sort());
  assert.equal(rt.validateAgentPanel(["moderator", "evidence_medicine", "clinical_perspective", "medical_safety_compliance"]).valid, false);
  const dup = rt.validateAgentPanel(["moderator", "moderator", "evidence_medicine", "clinical_perspective", "medical_safety_compliance"]);
  assert.equal(dup.valid, false);
  assert.ok(dup.errors.some((e) => e.includes("duplicates do not count")));
  const noEvidence = rt.validateAgentPanel(["moderator", "clinical_perspective", "adversarial_reviewer", "medical_safety_compliance", "cardiology"]);
  assert.ok(noEvidence.errors.some((e) => e.includes("evidence agent")));
  const noSafety = rt.validateAgentPanel(["moderator", "evidence_medicine", "clinical_perspective", "adversarial_reviewer", "pharmacy"]);
  assert.ok(noSafety.errors.some((e) => e.includes("safety agent")));
  assert.throws(
    () => rt.planDailyRun(makeInput({ availableAgentRoles: ["moderator", "clinical_perspective", "adversarial_reviewer", "medical_safety_compliance", "cardiology"] }), new rt.InMemoryRunClaimStore()),
    /evidence_medicine/
  );
});

// ================= 状态机(回归保留) =================
test("state machine: full legal daily flow", () => {
  const flow = [
    "scheduled", "topic_selected", "safety_precheck", "agents_assigned", "independent_analysis",
    "cross_examination", "adversarial_review", "evidence_verification", "consensus_drafting",
    "translation_generation", "awaiting_medical_review", "approved", "published", "monitoring",
    "revision_triggered", "superseded",
  ];
  for (let i = 0; i < flow.length - 1; i++) {
    assert.equal(rt.transition(flow[i], flow[i + 1]), flow[i + 1], `${flow[i]} -> ${flow[i + 1]}`);
  }
});

test("state machine: illegal transitions rejected; published only from approved", () => {
  assert.throws(() => rt.transition("safety_precheck", "topic_selected"), /Invalid roundtable transition/);
  assert.throws(() => rt.transition("consensus_drafting", "published"), /Invalid roundtable transition/);
  for (const s of rt.ALL_STATES) {
    assert.equal(rt.canTransition(s, "published"), s === "approved", s);
    if (s !== "scheduled") assert.equal(rt.canTransition(s, "topic_selected"), false, s);
  }
  assert.equal(rt.canTransition("evidence_invalid", "awaiting_medical_review"), false);
  assert.equal(rt.canTransition("awaiting_medical_review", "published"), false);
  assert.equal(rt.canTransition("review_rejected", "published"), false);
});

test("state machine: terminal states stay terminal; superseded never returns", () => {
  for (const s of ["high_risk_blocked", "privacy_blocked", "cancelled", "duplicate_blocked", "superseded", "review_rejected", "evidence_invalid"]) {
    assert.ok(rt.isTerminal(s), s);
    for (const to of rt.ALL_STATES) assert.equal(rt.canTransition(s, to), false, `${s} -> ${to}`);
  }
});

// ================= 共识(回归保留) =================
test("consensus: disclaimer required; forbidden clinical fields rejected; failed agent blocks completeness", () => {
  assert.equal(rt.parseConsensusDraft(makeConsensus({ limitations: ["其他限制"] })).success, false);
  for (const field of rt.FORBIDDEN_CONSENSUS_FIELDS) {
    const r = rt.parseConsensusDraft({ ...makeConsensus(), [field]: "leak" });
    assert.equal(r.success, false, field);
    assert.ok(r.errors.some((e) => e.includes(field)), field);
  }
  const participants = rt.DEFAULT_AGENT_ROLES.map((role, i) => ({ role, completed: i !== 1 }));
  assert.equal(rt.parseConsensusDraft(makeConsensus({ participants })).success, false);
  const c = rt.validateConsensusCompleteness(rt.DEFAULT_AGENT_ROLES.map((role, i) => ({ role, status: i === 0 ? "failed" : "completed" })));
  assert.equal(c.complete, false);
});

// ================= 预算与重试(回归保留) =================
test("budget: NaN/Infinity/negative rejected; limits are hard stops; retries and translations count", () => {
  for (const bad of [NaN, Infinity, -Infinity, -1, 1.5]) {
    assert.equal(rt.DailyRunBudgetSchema.safeParse(makeBudget({ maximumTokens: bad })).success, false, String(bad));
    assert.throws(() => rt.recordBudgetUsage(rt.createEmptyUsage(), { tokens: bad }), undefined, String(bad));
  }
  const budget = makeBudget({ maximumRetries: 1, maximumTranslationLanguages: 2, maximumEvidenceQueries: 1 });
  const usage = rt.recordBudgetUsage(rt.createEmptyUsage(), { retries: 2, translationLanguages: 3, evidenceQueries: 2 });
  const r = rt.evaluateBudget(budget, usage);
  assert.deepEqual([...r.exceededDimensions].sort(), ["evidenceQueries", "retries", "translationLanguages"]);
  const blocked = rt.planDailyRun(
    makeInput({ requestedLanguages: ["zh", "en", "ja"], budget: makeBudget({ maximumTranslationLanguages: 2 }) }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(blocked.blockedState, "budget_exceeded");
});

test("retry: retryable retries with same operationId; non-retryable and exhausted never retry", () => {
  const opId = "roundtable:2026-07-11:0123456789abcdef:v1";
  for (const errorType of rt.RETRYABLE_ERROR_TYPES) {
    const p = rt.planRetry({ errorType, retriesUsed: 0, maximumRetries: 3, operationId: opId });
    assert.equal(p.shouldRetry, true, errorType);
    assert.equal(p.operationId, opId);
  }
  for (const errorType of [...rt.NON_RETRYABLE_ERROR_TYPES, "mystery_error"]) {
    assert.equal(rt.planRetry({ errorType, retriesUsed: 0, maximumRetries: 3, operationId: opId }).shouldRetry, false, errorType);
  }
  assert.equal(rt.planRetry({ errorType: "provider_timeout", retriesUsed: 3, maximumRetries: 3, operationId: opId }).shouldRetry, false);
});

// ================= 修订触发(回归保留) =================
const makeSignals = (o = {}) => ({
  newEvidence: [], withdrawnEvidence: [], expertCorrections: [], publicComments: [],
  safetyReports: [], contentAgeDays: 10, maxContentAgeDays: 180, guidelineUpdates: [], ...o,
});

test("revision: high-quality evidence / withdrawal / material corrections trigger; likes never do", () => {
  assert.ok(rt.evaluateRevisionTriggers(makeSignals({ newEvidence: [{ evidenceId: "e9", evidenceLevel: "high" }] })).reasons.includes("new_high_quality_evidence"));
  assert.equal(rt.evaluateRevisionTriggers(makeSignals({ newEvidence: [{ evidenceId: "e9", evidenceLevel: "low" }] })).shouldRevise, false);
  assert.ok(rt.evaluateRevisionTriggers(makeSignals({ withdrawnEvidence: ["e1"] })).reasons.includes("source_withdrawn"));
  assert.ok(rt.evaluateRevisionTriggers(makeSignals({ expertCorrections: [{ id: "x1", material: true }] })).reasons.includes("material_expert_correction"));
  assert.equal(rt.evaluateRevisionTriggers(makeSignals({ publicComments: [{ id: "c1", kind: "like" }, { id: "c2", kind: "comment" }] })).shouldRevise, false);
});

test("revision: old version immutable; new version re-enters review as pending", () => {
  const current = { operationId: "roundtable:2026-07-11:0123456789abcdef:v1", version: 2 };
  const before = JSON.stringify(current);
  const plan = rt.createRevisionPlan(current);
  assert.equal(JSON.stringify(current), before);
  assert.equal(plan.supersededVersion, 2);
  assert.equal(plan.newVersion, 3);
  assert.equal(plan.newVersionReviewStatus, "pending");
  assert.equal(plan.newVersionState, "awaiting_medical_review");
});

// ================= Evidence 其余回归 =================
test("evidence: URL/DOI existing is not verification; withdrawn/unverified unusable; strict schemas", () => {
  assert.equal(rt.evaluateEvidenceUsability(makeEvidence({ verificationStatus: "pending" })).usable, false);
  assert.equal(rt.evaluateEvidenceUsability(makeEvidence({ withdrawn: true })).usable, false);
  assert.equal(rt.evaluateEvidenceUsability(makeEvidence()).usable, true);
  assert.equal(rt.EvidenceSourceSchema.safeParse({ ...makeEvidence(), extra: "x" }).success, false);
  assert.equal(rt.EvidenceClaimSchema.safeParse({ ...makeClaim(), extra: "x" }).success, false);
  const claim = rt.EvidenceClaimSchema.parse(makeClaim({ supportingEvidenceIds: ["e1"], opposingEvidenceIds: ["e2"] }));
  assert.deepEqual(claim.supportingEvidenceIds, ["e1"]);
  assert.deepEqual(claim.opposingEvidenceIds, ["e2"]);
  const expired = rt.validateClaimsForMedicalReview([makeClaim({ limitations: [] })], [makeEvidence({ expired: true })]);
  assert.ok(expired.violations.some((v) => v.reason.startsWith("expired_evidence_without_limitation")));
});

// ================= Second review (RR) findings =================
const C = (n) => String.fromCharCode(n); // build control/invisible chars without literal bytes

test("RR-P1-001: personal diagnosis synonyms are high-risk blocked (zh/en), riskLevel=low cannot override", () => {
  const titles = [
    "我可能罹患糖尿病吗", "我是否罹患糖尿病", "我是不是罹患糖尿病", "我疑似患有糖尿病",
    "我可能患有糖尿病", "我是否患有糖尿病", "我会不会得了糖尿病", "我是不是得了糖尿病",
    "我可能得了什么病", "根据这些症状我患了什么病",
    "might I have diabetes", "could I have diabetes", "do I have diabetes",
    "am I likely to have diabetes", "could these symptoms mean I have diabetes",
    "determine whether I have diabetes",
  ];
  for (const title of titles) {
    const r = safety(title, { riskLevel: "low" });
    assert.equal(r.allowed, false, title);
    assert.equal(r.blockReason, "high_risk", title);
  }
  // the exact Codex attack through the real planDailyRun entry point
  const run = rt.planDailyRun(
    makeInput({ candidateTopics: [makeTopic({ title: "我可能罹患糖尿病吗", normalizedQuestion: "我可能罹患糖尿病吗" })] }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(run.status, "blocked");
  assert.equal(run.blockedState, "high_risk_blocked");
});

test("RR-P1-001: separators, zero-width and academic/educational wrappers do not bypass", () => {
  const ZWS = C(0x200b);
  const evasions = [
    "我 可能 罹患 糖尿病 吗",
    "我，可能。罹患，糖尿病",
    "我/可能/罹患/糖尿病",
    "我_可能_罹患_糖尿病",
    "我-可能-罹患-糖尿病",
    "我\n可能\n罹患\n糖尿病",
    "我" + ZWS + "可能" + ZWS + "罹患" + ZWS + "糖尿病",
    "仅供学术讨论：我可能罹患糖尿病吗",
    "for educational purposes only: do I have diabetes",
    "hypothetical case: could I have diabetes",
  ];
  for (const title of evasions) {
    assert.equal(safety(title).blockReason, "high_risk", JSON.stringify(title));
  }
});

test("RR-P1-001: population-level diabetes education topics still plan normally", () => {
  const good = [
    "糖尿病的常见风险因素有哪些", "如何理解糖尿病诊断标准", "糖尿病筛查指南的证据质量",
    "What are the population risk factors for diabetes?", "How do clinical guidelines define diabetes?",
  ];
  for (const title of good) {
    const r = rt.planDailyRun(
      makeInput({ candidateTopics: [makeTopic({ title, normalizedQuestion: title, category: "public_health" })] }),
      new rt.InMemoryRunClaimStore()
    );
    assert.equal(r.status, "planned", title);
  }
});

test("RR-P1-002: control characters around reviewer ids are rejected on the RAW string, pre-trim", () => {
  const bad = [
    "reviewer\n", "reviewer\t", "reviewer\r", "\nreviewer", "\treviewer", "\rreviewer",
    "rev" + C(0x00) + "iewer", "rev" + C(0x1f) + "iewer", "rev" + C(0x7f) + "iewer", "rev" + C(0x85) + "iewer",
    C(0x00), "\n\t\r",
  ];
  for (const id of bad) {
    assert.equal(rt.evaluatePublicationGate(makeGate({ approvedByReviewerId: id })).canPublish, false, JSON.stringify(id));
    assert.throws(
      () => rt.createPublicationPlan(makePlanInput({ gate: makeGate({ approvedByReviewerId: id }) })),
      /Publication gate failed/, JSON.stringify(id)
    );
  }
  // plain ASCII spaces around a legit id keep the established trim behavior
  const plan = rt.createPublicationPlan(makePlanInput({ gate: makeGate({ approvedByReviewerId: "  reviewer-1  " }) }));
  assert.equal(plan.approvedByReviewerId, "reviewer-1");
});

test("RR-P1-003: URL-encoded PII and compact token names are rejected", () => {
  const bad = [
    "user%40example.com", "user%2540example.com", "token%3Dabc", "token%253Dabc",
    "user%40例子.com",
    "accessTokenABCDEF123456", "refreshTokenABCDEF123456", "apiKeyABCDEF123456",
    "ACCESS_TOKEN_ABC", "auth-token-abc",
    "ｕｓｅｒ%40example.com", // full-width letters + encoded @
    "access" + C(0x200b) + "TokenABC", // zero-width split
  ];
  for (const value of bad) {
    assert.throws(() => auditWith(value), /Audit metadata value/, value);
  }
});

test("RR-P1-003: invalid percent-encoding fails closed; normal short reasons still pass", () => {
  assert.throws(() => auditWith("50%"), /invalid percent-encoding/);
  assert.throws(() => auditWith("%zz-broken"), /invalid percent-encoding/);
  for (const ok of ["daily_slot_claimed", "high_risk", "fingerprint_mismatch", "no_viable_topic", "retryable_error"]) {
    const event = rt.createAuditEvent({ ...auditBase, safeMetadata: { reason: ok } });
    assert.equal(event.safeMetadata.reason, ok);
  }
});

test("RR-P2-001: whitespace/invisible characters in ids are rejected raw — prefix, inside and suffix", () => {
  const chars = [C(0xa0), C(0x3000), C(0x200b), C(0x200c), C(0x200d), C(0x2060), C(0xfeff), " "];
  for (const ch of chars) {
    for (const id of [ch + "e1", "e" + ch + "1", "e1" + ch]) {
      assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ id })).success, false, JSON.stringify(id));
      assert.equal(rt.EvidenceClaimSchema.safeParse(makeClaim({ supportingEvidenceIds: [id] })).success, false, JSON.stringify(id));
      assert.equal(rt.EvidenceClaimSchema.safeParse(makeClaim({ id })).success, false, JSON.stringify(id));
    }
  }
  // same policy guards the validator path directly
  const r = rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence({ id: "e" + C(0x200b) + "1" })]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason === "invalid_evidence_id"));
  // legitimate ids and reference binding still work
  assert.equal(rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence()]).ready, true);
});

test("RR-P2-002: JSON round-trip tampering of source claim metadata is detected against the trusted ref", () => {
  const source = makeSourceRef();
  const [asset] = rt.createDraftDistributionAssets(source, [makeAssetContent("zh")]);
  const roundTrip = () => JSON.parse(JSON.stringify(asset));
  const tampers = [
    ["sourceConsensusId", { sourceConsensusId: "roundtable:2026-07-11:ffffffffffffffff:v1" }],
    ["sourceVersion", { sourceVersion: 2 }],
    ["sourceClaimIds add", { sourceClaimIds: ["c1", "c2", "sw1", "cX"] }],
    ["sourceClaimIds delete", { sourceClaimIds: ["c1", "c2"] }],
    ["sourceClaimIds replace", { sourceClaimIds: ["c1", "cZ", "sw1"] }],
    ["sourceClaimIds duplicate", { sourceClaimIds: ["c1", "c1", "c2", "sw1"] }],
    ["sourceClaimIds case variant", { sourceClaimIds: ["C1", "c2", "sw1"] }],
    ["safety warning delete", { sourceSafetyWarningClaimIds: [] }],
  ];
  for (const [label, patch] of tampers) {
    const tampered = { ...roundTrip(), ...patch };
    assert.ok(rt.validateAssetClaimIntegrity(tampered, source).length > 0, label);
    assert.equal(rt.evaluateAssetPublishability(tampered, source).canPublish, false, label);
  }
  // the exact Codex attack: sourceClaimIds changed, translatedClaimIds untouched
  const codexAttack = { ...roundTrip(), sourceClaimIds: ["c1", "c2", "sw1", "injected"] };
  assert.ok(rt.validateAssetClaimIntegrity(codexAttack, source).length > 0);
  // consistent tampering of BOTH declared and translated sets is still caught
  const consistent = { ...roundTrip(), sourceClaimIds: ["cX"], translatedClaimIds: ["cX"] };
  assert.ok(rt.validateAssetClaimIntegrity(consistent, source).length > 0);
  // whitespace-variant ids are schema-invalid, hence violations too
  const spaced = { ...roundTrip(), sourceClaimIds: ["c1 ", "c2", "sw1"] };
  assert.ok(rt.validateAssetClaimIntegrity(spaced, source).length > 0);
  // an untampered round-tripped asset still passes
  assert.equal(rt.validateAssetClaimIntegrity(roundTrip(), source).length, 0);
});

test("RR-P2-003: supported date range is 0001-01-01..9999-12-31 across all date inputs", () => {
  assert.equal(rt.isValidCalendarDate("0000-01-01"), false);
  assert.equal(rt.isValidCalendarDate("0001-01-01"), true);
  assert.equal(rt.isValidCalendarDate("9999-12-31"), true);
  assert.equal(rt.isValidCalendarDate("10000-01-01"), false);
  assert.equal(rt.isValidCalendarDate("1900-02-29"), false);
  assert.equal(rt.isValidCalendarDate("2000-02-29"), true);
  assert.equal(rt.isValidCalendarDate("2026-02-29"), false);
  assert.equal(rt.isValidCalendarDate("2028-02-29"), true);
  assert.throws(() => rt.planDailyRun(makeInput({ runDate: "0000-01-01" }), new rt.InMemoryRunClaimStore()));
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ publicationDate: "0000-01-01" })).success, false);
  assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ retrievedAt: "0000-01-01T00:00:00.000Z" })).success, false);
});

test("RR-P2-004: URLs with credentials are rejected; clean http(s) URLs valid but never auto-verified", () => {
  const bad = [
    "https://user:pass@example.org/path", "https://user@example.org/", "https://:pass@example.org/",
    "https://user%40evil:p%40ss@example.org/", "javascript:alert(1)", "file:///etc/passwd",
    "ftp://example.org/x", "https://",
  ];
  for (const u of bad) {
    assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ urlOrIdentifier: u })).success, false, u);
  }
  for (const u of ["https://example.org/guideline", "http://example.org/x", "https://doi.org/10.1234/abc"]) {
    assert.equal(rt.EvidenceSourceSchema.safeParse(makeEvidence({ urlOrIdentifier: u })).success, true, u);
  }
  const unverified = makeEvidence({ urlOrIdentifier: "https://example.org/x", verificationStatus: "pending" });
  assert.equal(rt.evaluateEvidenceUsability(unverified).usable, false);
});

// ================= Final P1 closure (RR round 3) =================
test("RR3-P1-001: copula/uncertainty personal diagnosis phrasings are high-risk blocked via both entry points", () => {
  const attacks = [
    // Codex-confirmed bypasses
    "我有可能是糖尿病吗", "本人疑似糖尿病", "could this patient have diabetes",
    "does this mean I am diabetic", "tell me whether I am diabetic",
    // required additional coverage
    "我是不是糖尿病", "我是否是糖尿病", "我可能是糖尿病", "本人可能是糖尿病",
    "判断本人是否为糖尿病", "告诉我是否为糖尿病",
    "could I be diabetic", "might I be diabetic", "am I diabetic",
    "determine whether I am diabetic", "might this patient have diabetes",
    "tell me if this patient has diabetes",
  ];
  for (const title of attacks) {
    const r = safety(title, { riskLevel: "low" });
    assert.equal(r.allowed, false, `evaluateTopicSafety: ${title}`);
    assert.equal(r.blockReason, "high_risk", `evaluateTopicSafety: ${title}`);
    const run = rt.planDailyRun(
      makeInput({ candidateTopics: [makeTopic({ title, normalizedQuestion: title })] }),
      new rt.InMemoryRunClaimStore()
    );
    assert.equal(run.status, "blocked", `planDailyRun: ${title}`);
    assert.equal(run.blockedState, "high_risk_blocked", `planDailyRun: ${title}`);
  }
});

test("RR3-P1-001: separator/zero-width/academic wrappers do not bypass the copula shapes", () => {
  const ZWS = C(0x200b);
  const evasions = [
    "我 有 可能 是 糖尿病 吗", "我，可能。是，糖尿病", "我/可能/是/糖尿病",
    "我_可能_是_糖尿病", "我-可能-是-糖尿病", "我\n可能\n是\n糖尿病",
    "本人" + ZWS + "疑似" + ZWS + "糖尿病",
    "仅供学术讨论：我是不是糖尿病", "for educational purposes only: am I diabetic",
    "hypothetical case: could this patient have diabetes",
  ];
  for (const title of evasions) {
    assert.equal(safety(title).blockReason, "high_risk", JSON.stringify(title));
  }
});

test("RR3-P1-001: population/guideline/clinician-communication topics stay planned", () => {
  const good = [
    "糖尿病的常见风险因素有哪些", "如何理解糖尿病诊断标准", "糖尿病筛查指南的证据质量",
    "What are the population risk factors for diabetes?", "How do clinical guidelines define diabetes?",
    "What symptoms are commonly associated with diabetes in population studies?",
    "How should clinicians communicate diagnostic uncertainty to patients?",
  ];
  for (const title of good) {
    const r = safety(title, { category: "public_health" });
    assert.equal(r.allowed, true, `evaluateTopicSafety: ${title}`);
    const run = rt.planDailyRun(
      makeInput({ candidateTopics: [makeTopic({ title, normalizedQuestion: title, category: "public_health" })] }),
      new rt.InMemoryRunClaimStore()
    );
    assert.equal(run.status, "planned", `planDailyRun: ${title}`);
  }
});

test("RR3-P1-002: U+2028/U+2029 (and other Unicode separators) rejected at all 3 entry points, every position", () => {
  const LS = C(0x2028), PS = C(0x2029);
  const seps = {
    "U+2028": LS, "U+2029": PS, HT: C(0x09), LF: C(0x0a), CR: C(0x0d),
    "U+0000": C(0x00), "U+001F": C(0x1f), "U+007F": C(0x7f), "U+0085": C(0x85),
    "U+009F": C(0x9f), NBSP: C(0xa0), IDEOGRAPHIC: C(0x3000),
  };
  for (const [name, ch] of Object.entries(seps)) {
    for (const id of [ch + "reviewer", "rev" + ch + "iewer", "reviewer" + ch]) {
      assert.equal(rt.ReviewerIdSchema.safeParse(id).success, false, `${name} schema`);
      assert.equal(rt.evaluatePublicationGate(makeGate({ approvedByReviewerId: id })).canPublish, false, `${name} gate`);
      assert.throws(
        () => rt.createPublicationPlan(makePlanInput({ gate: makeGate({ approvedByReviewerId: id }) })),
        /Publication gate failed/, `${name} plan`
      );
    }
  }
  // pure illegal char
  assert.equal(rt.ReviewerIdSchema.safeParse(LS).success, false);
  // legit id and ASCII-space padding behavior preserved
  assert.equal(rt.ReviewerIdSchema.safeParse("reviewer-9").success, true);
  const plan = rt.createPublicationPlan(makePlanInput({ gate: makeGate({ approvedByReviewerId: "  reviewer-9  " }) }));
  assert.equal(plan.approvedByReviewerId, "reviewer-9");
  // interior ASCII space is not allowed either
  assert.equal(rt.ReviewerIdSchema.safeParse("rev iewer").success, false);
});

test("RR3-P1-003: deep (3+ layer) percent-encoded tokens/PII are rejected via createAuditEvent", () => {
  const bad = [
    "Bearer%252520abc123", "Bearer%25252520abc123", "api%25255FkeyABCDEF123456",
    "access%25255Ftoken%25253Dabc", "refresh%25255Ftoken%25253Dabc", "token%25253Dabc",
    "user%252540example.com", // 3-layer email
    "eyJ%252520payload", // encoded JWT-ish marker
    "ｕｓｅｒ%252540example.com", // full-width + deep encoding
    "access" + C(0x200b) + "%25255Ftoken", // zero-width + deep encoding
  ];
  for (const value of bad) {
    assert.throws(() => auditWith(value), /Audit metadata value/, value);
  }
});

test("RR3-P1-003: over-depth and malformed encoding fail closed; ordinary percents still pass", () => {
  // still percent-encoded after max depth -> fail closed (long but <=128)
  assert.throws(() => auditWith("%2525252525253Dabc"), /decode layers|invalid percent-encoding/);
  assert.throws(() => auditWith("token%2"), /invalid percent-encoding/);
  assert.throws(() => auditWith("50%"), /invalid percent-encoding/);
  // benign short reasons unaffected, including a literal percentage with separator
  for (const ok of ["daily_slot_claimed", "high_risk", "budget_exceeded", "provider_failed"]) {
    assert.equal(rt.createAuditEvent({ ...auditBase, safeMetadata: { reason: ok } }).safeMetadata.reason, ok);
  }
});
