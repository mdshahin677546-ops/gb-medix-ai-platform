// GB MEDIX AI Medical Roundtable v1 — tests that execute the REAL implementation.
//
// The real lib/roundtable/v1 sources are compiled (project tsc -> CommonJS in
// a git-ignored repo-local temp dir) and required. Assertions run against the
// actual exported planner / state machine / Zod schemas / gates — no mirrored
// logic, copied schemas, copied transition tables, or source-string asserts.

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
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", ...tsFiles, "--outDir", outDir, "--rootDir", SRC,
   "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck"],
  { stdio: "pipe" }
);
const rt = requireCjs(resolve(outDir, "index.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

// ---------- factories ----------
const makeBudget = (o = {}) => ({
  maximumAgentCalls: 50, maximumEvidenceQueries: 20, maximumTokens: 100000,
  maximumRetries: 3, maximumTranslationLanguages: 2, maximumRuntimeMs: 600000, ...o,
});
const makeTopic = (o = {}) => ({
  id: "t1", title: "维生素D与呼吸道感染的证据讨论",
  normalizedQuestion: "补充维生素d是否降低人群呼吸道感染风险",
  category: "nutrition", riskLevel: "low", sourceHints: ["guideline"],
  freshnessScore: 0.8, evidenceAvailabilityScore: 0.9, publicInterestScore: 0.7,
  duplicateFingerprint: "fp-t1", containsPatientData: false, ...o,
});
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
  unresolvedQuestions: [], evidenceReferences: ["e1"], medicalReviewStatus: "pending",
  version: 1, generatedAt: "2026-07-11T01:00:00.000Z", ...o,
});
const makeGate = (o = {}) => ({
  medicalReviewStatus: "approved", allCriticalClaimsVerified: true, noHighRiskMedicalContent: true,
  privacyCheckPassed: true, evidenceCheckPassed: true, auditComplete: true, versionIsImmutable: true, ...o,
});
const makeAssetContent = (language, o = {}) => ({
  language, title: "维生素D与感冒的循证讨论", summary: "多智能体证据综述摘要",
  seoTitle: "维生素D 呼吸道感染 证据", seoDescription: "关于维生素D与呼吸道感染的循证圆桌讨论",
  socialPost: "今日圆桌讨论了维生素D的人群证据", shortVideoScript: "开场：欢迎来到医学圆桌",
  controversyCards: ["争议点：剂量与效应关系尚不明确"], ...o,
});

// ================= 每日运行 =================
test("daily run: one topic per day — second different topic same day is blocked", () => {
  const store = new rt.InMemoryRunClaimStore();
  const first = rt.planDailyRun(makeInput(), store);
  assert.equal(first.status, "planned");
  const second = rt.planDailyRun(
    makeInput({ candidateTopics: [makeTopic({ id: "t2", title: "间歇性禁食与代谢健康的证据", duplicateFingerprint: "fp-t2" })] }),
    store
  );
  assert.equal(second.status, "blocked");
  assert.equal(second.blockedState, "duplicate_blocked");
  assert.equal(second.operationId, first.operationId);
});

test("daily run: same date + same topic yields the same idempotency key", () => {
  const a = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  const b = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  assert.equal(a.operationId, b.operationId);
  assert.match(a.operationId, /^roundtable:2026-07-11:[0-9a-f]{16}:v1$/);
  assert.deepEqual(a.auditEvents, b.auditEvents); // deterministic events too
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

test("daily run: duplicate topic (normalized similar title) is blocked", () => {
  const fp = rt.computeTopicFingerprint("维生素D与呼吸道感染的证据讨论");
  assert.equal(fp, rt.computeTopicFingerprint("  维生素D 与呼吸道感染的证据讨论！ ")); // 标准化去重
  const result = rt.planDailyRun(
    makeInput({ previousTopicFingerprints: [fp] }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedState, "duplicate_blocked");
  assert.ok(result.auditEvents.some((e) => e.eventType === "topic_blocked"));
});

test("daily run: privacy topic is blocked", () => {
  const result = rt.planDailyRun(
    makeInput({ candidateTopics: [makeTopic({ containsPatientData: true })] }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedState, "privacy_blocked");
});

test("daily run: high-risk individual medical topic is blocked", () => {
  for (const title of ["我是不是得了糖尿病", "二甲双胍我应该吃多少剂量", "我可以停药吗", "保证治愈高血压的方法"]) {
    const result = rt.planDailyRun(
      makeInput({ candidateTopics: [makeTopic({ title, normalizedQuestion: title })] }),
      new rt.InMemoryRunClaimStore()
    );
    assert.equal(result.status, "blocked", title);
    assert.equal(result.blockedState, "high_risk_blocked", title);
  }
  const highRisk = rt.planDailyRun(
    makeInput({ candidateTopics: [makeTopic({ riskLevel: "high" })] }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(highRisk.blockedState, "high_risk_blocked");
});

test("daily run: schema-invalid input fails loudly", () => {
  assert.throws(() => rt.planDailyRun(makeInput({ runDate: "07/11/2026" }), new rt.InMemoryRunClaimStore()));
  assert.throws(() => rt.planDailyRun(makeInput({ budget: makeBudget({ maximumTokens: -1 }) }), new rt.InMemoryRunClaimStore()));
});

// ================= 智能体邀请 =================
test("agents: default five roles are all invited", () => {
  const planned = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  assert.deepEqual([...planned.invitedAgents].sort(), [...rt.DEFAULT_AGENT_ROLES].sort());
  assert.equal(planned.invitedAgents.length, 5);
});

test("agents: fewer than five distinct roles fails", () => {
  const r = rt.validateAgentPanel(["moderator", "evidence_medicine", "clinical_perspective", "medical_safety_compliance"]);
  assert.equal(r.valid, false);
});

test("agents: duplicate roles do not count toward the minimum", () => {
  const r = rt.validateAgentPanel(["moderator", "moderator", "evidence_medicine", "clinical_perspective", "medical_safety_compliance"]);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("duplicates do not count")));
});

test("agents: missing evidence agent fails to start", () => {
  const r = rt.validateAgentPanel(["moderator", "clinical_perspective", "adversarial_reviewer", "medical_safety_compliance", "cardiology"]);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("evidence agent")));
  assert.throws(
    () => rt.planDailyRun(makeInput({ availableAgentRoles: ["moderator", "clinical_perspective", "adversarial_reviewer", "medical_safety_compliance", "cardiology"] }), new rt.InMemoryRunClaimStore()),
    /evidence_medicine/
  );
});

test("agents: missing safety agent fails to start", () => {
  const r = rt.validateAgentPanel(["moderator", "evidence_medicine", "clinical_perspective", "adversarial_reviewer", "pharmacy"]);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("safety agent")));
});

// ================= 状态机 =================
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

test("state machine: illegal transitions are rejected explicitly", () => {
  assert.throws(() => rt.transition("safety_precheck", "topic_selected"), /Invalid roundtable transition/);
  assert.throws(() => rt.transition("scheduled", "independent_analysis"), /Invalid roundtable transition/);
  assert.throws(() => rt.transition("independent_analysis", "consensus_drafting"), /Invalid roundtable transition/);
  assert.throws(() => rt.transition("consensus_drafting", "published"), /Invalid roundtable transition/);
  assert.equal(rt.canTransition("scheduled", "published"), false);
  // only scheduled may enter topic_selected
  for (const s of rt.ALL_STATES) {
    if (s !== "scheduled") assert.equal(rt.canTransition(s, "topic_selected"), false, s);
  }
});

test("state machine: evidence_invalid can never reach medical review", () => {
  assert.equal(rt.canTransition("evidence_invalid", "awaiting_medical_review"), false);
  assert.equal(rt.canTransition("evidence_invalid", "consensus_drafting"), false);
  assert.ok(rt.isTerminal("evidence_invalid"));
});

test("state machine: pending review / rejected can never publish", () => {
  assert.equal(rt.canTransition("awaiting_medical_review", "published"), false);
  assert.equal(rt.canTransition("review_rejected", "published"), false);
  assert.ok(rt.isTerminal("review_rejected"));
  // published only from approved
  for (const s of rt.ALL_STATES) {
    assert.equal(rt.canTransition(s, "published"), s === "approved", s);
  }
});

test("state machine: high_risk_blocked / privacy_blocked / cancelled are terminal", () => {
  for (const s of ["high_risk_blocked", "privacy_blocked", "cancelled", "duplicate_blocked"]) {
    assert.ok(rt.isTerminal(s), s);
    for (const to of rt.ALL_STATES) assert.equal(rt.canTransition(s, to), false, `${s} -> ${to}`);
  }
});

test("state machine: published revision creates a new version; superseded never returns", () => {
  assert.equal(rt.transition("published", "monitoring"), "monitoring");
  assert.equal(rt.transition("monitoring", "revision_triggered"), "revision_triggered");
  assert.ok(rt.isTerminal("superseded"));
  for (const to of rt.ALL_STATES) assert.equal(rt.canTransition("superseded", to), false, to);
});

// ================= Evidence =================
test("evidence: critical claim without evidence fails review readiness", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim({ supportingEvidenceIds: [] })], [makeEvidence()]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason === "critical_claim_missing_evidence"));
});

test("evidence: unverified evidence fails (URL/DOI existing is not verification)", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence({ verificationStatus: "pending" })]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason.startsWith("evidence_not_verified")));
  assert.equal(rt.evaluateEvidenceUsability(makeEvidence({ verificationStatus: "pending" })).usable, false);
});

test("evidence: withdrawn evidence fails", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim()], [makeEvidence({ withdrawn: true })]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason.startsWith("evidence_withdrawn")));
});

test("evidence: nonexistent evidence source fails", () => {
  const r = rt.validateClaimsForMedicalReview([makeClaim({ supportingEvidenceIds: ["ghost"] })], [makeEvidence()]);
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason.startsWith("evidence_source_not_found")));
});

test("evidence: expired evidence without limitation note fails", () => {
  const r = rt.validateClaimsForMedicalReview(
    [makeClaim({ limitations: [] })],
    [makeEvidence({ expired: true })]
  );
  assert.equal(r.ready, false);
  assert.ok(r.violations.some((v) => v.reason.startsWith("expired_evidence_without_limitation")));
});

test("evidence: extra fields are rejected by strict schemas", () => {
  assert.equal(rt.EvidenceSourceSchema.safeParse({ ...makeEvidence(), extra: "x" }).success, false);
  assert.equal(rt.EvidenceClaimSchema.safeParse({ ...makeClaim(), extra: "x" }).success, false);
  assert.equal(rt.EvidenceClaimSchema.safeParse(makeClaim({ supportingEvidenceIds: [""] })).success, false); // 空引用
});

test("evidence: supporting and opposing evidence are distinguishable", () => {
  const claim = rt.EvidenceClaimSchema.parse(makeClaim({ supportingEvidenceIds: ["e1"], opposingEvidenceIds: ["e2"] }));
  assert.deepEqual(claim.supportingEvidenceIds, ["e1"]);
  assert.deepEqual(claim.opposingEvidenceIds, ["e2"]);
});

// ================= 共识草稿 =================
test("consensus: valid draft parses and carries the AI-consensus disclaimer", () => {
  const r = rt.parseConsensusDraft(makeConsensus());
  assert.equal(r.success, true);
  assert.ok(r.draft.limitations.includes(rt.AI_CONSENSUS_DISCLAIMER));
});

test("consensus: missing disclaimer is rejected", () => {
  const r = rt.parseConsensusDraft(makeConsensus({ limitations: ["其他限制"] }));
  assert.equal(r.success, false);
});

test("consensus: every forbidden clinical field is rejected explicitly", () => {
  for (const field of rt.FORBIDDEN_CONSENSUS_FIELDS) {
    const r = rt.parseConsensusDraft({ ...makeConsensus(), [field]: "leak" });
    assert.equal(r.success, false, field);
    assert.ok(r.errors.some((e) => e.includes(field)), field);
  }
  for (const f of ["diagnosis", "prescription", "medicationDose", "stopMedication", "diseaseProbability", "guaranteedOutcome", "patientSpecificTreatment"]) {
    assert.ok(rt.FORBIDDEN_CONSENSUS_FIELDS.includes(f), `missing forbidden ${f}`);
  }
});

test("consensus: a failed agent cannot produce a complete consensus", () => {
  const participants = rt.DEFAULT_AGENT_ROLES.map((role, i) => ({ role, completed: i !== 1 }));
  const r = rt.parseConsensusDraft(makeConsensus({ participants }));
  assert.equal(r.success, false);
  const c = rt.validateConsensusCompleteness(rt.DEFAULT_AGENT_ROLES.map((role, i) => ({ role, status: i === 0 ? "failed" : "completed" })));
  assert.equal(c.complete, false);
});

// ================= 发布门禁 =================
test("gate: publication without doctor approval fails (pending/revision_required/rejected/high_risk_blocked)", () => {
  for (const status of ["pending", "revision_required", "rejected", "high_risk_blocked"]) {
    const r = rt.evaluatePublicationGate(makeGate({ medicalReviewStatus: status }));
    assert.equal(r.canPublish, false, status);
    assert.throws(() => rt.createPublicationPlan({
      operationId: "roundtable:2026-07-11:0123456789abcdef:v1",
      gate: makeGate({ medicalReviewStatus: status }),
      approvedVersion: 1, approvedByReviewerId: "reviewer-opaque-1",
      approvedAt: "2026-07-11T02:00:00.000Z", languages: ["zh", "en"],
      homepagePlacement: "standard", auditReference: "audit-ref-1",
    }), /Publication gate failed/, status);
  }
});

test("gate: each failing condition blocks publication", () => {
  const cases = ["allCriticalClaimsVerified", "noHighRiskMedicalContent", "privacyCheckPassed", "evidenceCheckPassed", "auditComplete", "versionIsImmutable"];
  for (const key of cases) {
    const r = rt.evaluatePublicationGate(makeGate({ [key]: false }));
    assert.equal(r.canPublish, false, key);
  }
});

test("gate: all conditions pass -> PublicationPlan; same version -> same idempotency key", () => {
  const input = {
    operationId: "roundtable:2026-07-11:0123456789abcdef:v1",
    gate: makeGate(), approvedVersion: 2, approvedByReviewerId: "reviewer-opaque-1",
    approvedAt: "2026-07-11T02:00:00.000Z", languages: ["zh", "en"],
    homepagePlacement: "featured", auditReference: "audit-ref-1",
  };
  const a = rt.createPublicationPlan(input);
  const b = rt.createPublicationPlan(input);
  assert.equal(a.publicationIdempotencyKey, b.publicationIdempotencyKey);
  assert.equal(a.publicationIdempotencyKey, "publish:roundtable:2026-07-11:0123456789abcdef:v1:v2");
  assert.equal(a.approvedVersion, 2);
  assert.deepEqual(a.languages, ["zh", "en"]);
});

// ================= 预算与重试 =================
test("budget: NaN / Infinity / negative values are rejected", () => {
  for (const bad of [NaN, Infinity, -Infinity, -1, 1.5]) {
    assert.equal(rt.DailyRunBudgetSchema.safeParse(makeBudget({ maximumTokens: bad })).success, false, String(bad));
    assert.throws(() => rt.recordBudgetUsage(rt.createEmptyUsage(), { tokens: bad }), String(bad));
  }
});

test("budget: exceeding any limit stops the run in budget_exceeded", () => {
  const budget = makeBudget({ maximumAgentCalls: 2 });
  let usage = rt.createEmptyUsage();
  usage = rt.recordBudgetUsage(usage, { agentCalls: 3 });
  const r = rt.evaluateBudget(budget, usage);
  assert.equal(r.withinBudget, false);
  assert.deepEqual(r.exceededDimensions, ["agentCalls"]);
  assert.equal(rt.canSpend(budget, rt.recordBudgetUsage(rt.createEmptyUsage(), { agentCalls: 2 }), "agentCalls", 1), false);
});

test("budget: retries, translations and evidence queries all consume budget", () => {
  const budget = makeBudget({ maximumRetries: 1, maximumTranslationLanguages: 2, maximumEvidenceQueries: 1 });
  let usage = rt.createEmptyUsage();
  usage = rt.recordBudgetUsage(usage, { retries: 2, translationLanguages: 3, evidenceQueries: 2 });
  const r = rt.evaluateBudget(budget, usage);
  assert.deepEqual([...r.exceededDimensions].sort(), ["evidenceQueries", "retries", "translationLanguages"]);
});

test("budget: requesting more languages than budget blocks the daily run", () => {
  const r = rt.planDailyRun(
    makeInput({ requestedLanguages: ["zh", "en", "ja"], budget: makeBudget({ maximumTranslationLanguages: 2 }) }),
    new rt.InMemoryRunClaimStore()
  );
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "budget_exceeded");
});

test("retry: retryable errors retry within limits, reusing the operationId", () => {
  const opId = "roundtable:2026-07-11:0123456789abcdef:v1";
  for (const errorType of rt.RETRYABLE_ERROR_TYPES) {
    const p = rt.planRetry({ errorType, retriesUsed: 0, maximumRetries: 3, operationId: opId });
    assert.equal(p.shouldRetry, true, errorType);
    assert.equal(p.operationId, opId);
    assert.equal(p.nextRetryNumber, 1);
  }
});

test("retry: non-retryable errors never retry", () => {
  for (const errorType of rt.NON_RETRYABLE_ERROR_TYPES) {
    const p = rt.planRetry({ errorType, retriesUsed: 0, maximumRetries: 3, operationId: "op" });
    assert.equal(p.shouldRetry, false, errorType);
  }
  assert.equal(rt.planRetry({ errorType: "mystery_error", retriesUsed: 0, maximumRetries: 3, operationId: "op" }).shouldRetry, false);
});

test("retry: stops once the maximum is exhausted", () => {
  const p = rt.planRetry({ errorType: "provider_timeout", retriesUsed: 3, maximumRetries: 3, operationId: "op" });
  assert.equal(p.shouldRetry, false);
  assert.equal(p.reason, "retry_budget_exhausted");
});

// ================= 多语言 =================
test("multilingual: drafts inherit consensus version and review status; zh/en share sourceVersion", () => {
  const consensus = { version: 3, medicalReviewStatus: "pending" };
  const assets = rt.createDraftDistributionAssets(consensus, [makeAssetContent("zh"), makeAssetContent("en")]);
  assert.equal(assets.length, 2);
  for (const asset of assets) {
    assert.equal(asset.sourceVersion, 3);
    assert.equal(asset.reviewStatus, "pending");
  }
  assert.equal(assets[0].sourceVersion, assets[1].sourceVersion);
});

test("multilingual: unreviewed assets can never be published", () => {
  const consensus = { version: 1, medicalReviewStatus: "pending" };
  const [asset] = rt.createDraftDistributionAssets(consensus, [makeAssetContent("zh")]);
  const r = rt.evaluateAssetPublishability(asset, consensus);
  assert.equal(r.canPublish, false);
  // even a stale "approved" asset fails if the source consensus is not approved
  const stale = { ...asset, reviewStatus: "approved" };
  assert.equal(rt.evaluateAssetPublishability(stale, consensus).canPublish, false);
  // version mismatch also fails
  const approved = { version: 2, medicalReviewStatus: "approved" };
  assert.equal(rt.evaluateAssetPublishability(stale, approved).canPublish, false);
});

test("multilingual: withdrawal of any language withdraws all languages", () => {
  const consensus = { version: 1, medicalReviewStatus: "approved" };
  const assets = rt.createDraftDistributionAssets(consensus, [makeAssetContent("zh"), makeAssetContent("en")]);
  const withdrawn = rt.propagateWithdrawal([{ ...assets[0], reviewStatus: "withdrawn" }, assets[1]]);
  assert.ok(withdrawn.every((a) => a.reviewStatus === "withdrawn"));
  const sourceWithdrawn = rt.propagateWithdrawal(assets, true);
  assert.ok(sourceWithdrawn.every((a) => a.reviewStatus === "withdrawn"));
  assert.equal(assets[1].reviewStatus, "approved"); // inputs not mutated
});

test("multilingual: translations cannot add diagnosis, prescription or cure promises", () => {
  const consensus = { version: 1, medicalReviewStatus: "pending" };
  const bad = [
    makeAssetContent("en", { socialPost: "This treatment will definitely cure your cold" }),
    makeAssetContent("zh", { summary: "本方案保证治愈感冒" }),
    makeAssetContent("zh", { shortVideoScript: "建议每天服用 500 mg" }),
    makeAssetContent("zh", { title: "已为你确诊为流感" }),
  ];
  for (const content of bad) {
    assert.throws(() => rt.createDraftDistributionAssets(consensus, [content]), /forbidden medical conclusion/);
  }
});

// ================= 修订触发 =================
const makeSignals = (o = {}) => ({
  newEvidence: [], withdrawnEvidence: [], expertCorrections: [], publicComments: [],
  safetyReports: [], contentAgeDays: 10, maxContentAgeDays: 180, guidelineUpdates: [], ...o,
});

test("revision: new high-quality evidence triggers", () => {
  const r = rt.evaluateRevisionTriggers(makeSignals({ newEvidence: [{ evidenceId: "e9", evidenceLevel: "high" }] }));
  assert.equal(r.shouldRevise, true);
  assert.ok(r.reasons.includes("new_high_quality_evidence"));
  // low-quality new evidence alone does not trigger
  const low = rt.evaluateRevisionTriggers(makeSignals({ newEvidence: [{ evidenceId: "e9", evidenceLevel: "low" }] }));
  assert.equal(low.shouldRevise, false);
});

test("revision: source withdrawal and material expert correction trigger", () => {
  assert.ok(rt.evaluateRevisionTriggers(makeSignals({ withdrawnEvidence: ["e1"] })).reasons.includes("source_withdrawn"));
  assert.ok(rt.evaluateRevisionTriggers(makeSignals({ expertCorrections: [{ id: "x1", material: true }] })).reasons.includes("material_expert_correction"));
  assert.equal(rt.evaluateRevisionTriggers(makeSignals({ expertCorrections: [{ id: "x1", material: false }] })).shouldRevise, false);
});

test("revision: ordinary likes/comments never trigger", () => {
  const r = rt.evaluateRevisionTriggers(makeSignals({
    publicComments: [{ id: "c1", kind: "like" }, { id: "c2", kind: "comment" }, { id: "c3", kind: "like" }],
  }));
  assert.equal(r.shouldRevise, false);
  assert.deepEqual(r.reasons, []);
});

test("revision: old version is never overwritten; new version re-enters medical review", () => {
  const current = { operationId: "roundtable:2026-07-11:0123456789abcdef:v1", version: 2 };
  const before = JSON.stringify(current);
  const plan = rt.createRevisionPlan(current);
  assert.equal(JSON.stringify(current), before); // input untouched
  assert.equal(plan.supersededVersion, 2);
  assert.equal(plan.previousVersionMarkedAs, "superseded");
  assert.equal(plan.newVersion, 3);
  assert.equal(plan.newVersionReviewStatus, "pending");
  assert.equal(plan.newVersionState, "awaiting_medical_review");
});

// ================= 审计事件 =================
test("audit: metadata keys are strictly allowlisted", () => {
  assert.throws(
    () => rt.createAuditEvent({ operationId: "op", eventType: "run_scheduled", timestamp: "2026-07-11T00:00:00.000Z", safeMetadata: { promptText: "全文" } }),
    /not allowlisted/
  );
});

test("audit: values that look like PII or secrets are rejected", () => {
  for (const value of ["user@example.com", "Bearer eyJhbGciOi", "sk-abcdef", "postgresql://u:p@h/db"]) {
    assert.throws(
      () => rt.createAuditEvent({ operationId: "op", eventType: "run_scheduled", timestamp: "2026-07-11T00:00:00.000Z", safeMetadata: { reason: value } }),
      /forbidden sensitive pattern/, value
    );
  }
});

test("audit: deterministic event ids; unknown event types rejected", () => {
  const e = rt.createAuditEvent({ operationId: "op", eventType: "topic_selected", timestamp: "2026-07-11T00:00:00.000Z", safeMetadata: { runDate: "2026-07-11" }, sequence: 4 });
  assert.equal(e.eventId, "op:topic_selected:4");
  assert.throws(() => rt.createAuditEvent({ operationId: "op", eventType: "made_up_event", timestamp: "2026-07-11T00:00:00.000Z" }));
  for (const t of ["run_scheduled", "topic_blocked", "agents_invited", "medical_review_approved", "publication_planned", "revision_triggered", "budget_exceeded"]) {
    assert.ok(rt.AUDIT_EVENT_TYPES.includes(t), t);
  }
});

test("audit: planned daily run emits scheduled/selected/invited events", () => {
  const planned = rt.planDailyRun(makeInput(), new rt.InMemoryRunClaimStore());
  const types = planned.auditEvents.map((e) => e.eventType);
  assert.ok(types.includes("run_scheduled"));
  assert.ok(types.includes("topic_selected"));
  assert.ok(types.includes("agents_invited"));
});
