// GB MEDIX AI Medical Roundtable — Batch 2.2B offline orchestration tests.
//
// Executes the REAL implementation: the entire lib/roundtable/v1 tree
// (including orchestration/) is compiled with the project tsc to CommonJS in a
// git-ignored temp dir and required. Assertions run the real coordinator with
// the real 2.2A safety modules and the in-memory adapters — no mirrored
// schema, state machine, regex, budget/fingerprint algorithm, or source-string
// assertions. The temp dir is removed on success AND on compile failure.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const SRC = "lib/roundtable/v1";
mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
const outDir = mkdtempSync(join(process.cwd(), ".tmp", "orchestration-"));
const requireCjs = createRequire(import.meta.url);
const collectTs = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? collectTs(join(dir, d.name)) : d.name.endsWith(".ts") ? [join(dir, d.name)] : []
  );
try {
  execFileSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", ...collectTs(SRC), "--outDir", outDir, "--rootDir", SRC,
     "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--esModuleInterop", "--skipLibCheck"],
    { stdio: "pipe" }
  );
} catch (error) {
  rmSync(outDir, { recursive: true, force: true });
  throw error;
}
const rt = requireCjs(resolve(outDir, "index.js"));
const orch = requireCjs(resolve(outDir, "orchestration", "index.js"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

// ---------- factories ----------
const makeBudget = (o = {}) => ({
  maximumAgentCalls: 50, maximumEvidenceQueries: 20, maximumTokens: 100000,
  maximumRetries: 3, maximumTranslationLanguages: 2, maximumRuntimeMs: 600000, ...o,
});
const makeTopic = (o = {}) => {
  const t = {
    id: "t1", title: "维生素D与呼吸道感染的人群证据讨论",
    normalizedQuestion: "补充维生素d是否降低人群呼吸道感染发生的比例",
    category: "nutrition", riskLevel: "low", sourceHints: ["guideline"],
    freshnessScore: 0.8, evidenceAvailabilityScore: 0.9, publicInterestScore: 0.7,
    containsPatientData: false, ...o,
  };
  if (!("duplicateFingerprint" in o)) t.duplicateFingerprint = rt.computeTopicFingerprint(t.title);
  return t;
};
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
  confidence: 0.6, limitations: ["异质性较高"], verificationStatus: "verified", ...o,
});
const makeDraftInput = (o = {}) => ({
  topic: "维生素D与呼吸道感染", scope: "人群层面预防证据，不适用于个体诊疗",
  participants: rt.DEFAULT_AGENT_ROLES.map((role) => ({ role, completed: true })),
  confirmedFacts: [], currentConsensus: ["现有证据提示可能存在小幅保护效应"],
  limitedInferences: [], disputedViews: [], adversarialFindings: [], safetyWarnings: [],
  limitations: [rt.AI_CONSENSUS_DISCLAIMER, "证据等级中等"], notApplicableTo: ["个体诊疗决策"],
  unresolvedQuestions: [], evidenceReferences: ["e1"], version: 1,
  generatedAt: "2026-07-11T01:00:00.000Z", ...o,
});
const assetContent = () => ({
  zh: { title: "维生素D与感冒", summary: "人群证据综述", seoTitle: "维生素D 感冒 证据", seoDescription: "圆桌讨论", socialPost: "今日圆桌", shortVideoScript: "开场", controversyCards: ["剂量与效应尚不明确"] },
  en: { title: "Vitamin D and colds", summary: "Population evidence review", seoTitle: "Vitamin D evidence", seoDescription: "Roundtable", socialPost: "Today", shortVideoScript: "Intro", controversyCards: ["Dose-response uncertain"] },
});

const makeInput = (o = {}) => ({
  runDate: "2026-07-11", previousTopicFingerprints: [], budget: makeBudget(),
  availableAgentRoles: [...rt.DEFAULT_AGENT_ROLES], requestedLanguages: ["zh", "en"],
  timestamp: "2026-07-11T00:00:00.000Z", attempt: 1, ...o,
});

function makeDeps(o = {}) {
  const claimStore = o.claimStore ?? new rt.InMemoryRunClaimStore();
  const runStore = o.runStore ?? new orch.InMemoryOrchestrationRunStore();
  const basePanel = new orch.InMemoryExpertPanel({ roles: [...rt.DEFAULT_AGENT_ROLES], ...(o.panelConfig ?? {}) });
  let calls = 0;
  const expertPanel = {
    roles: () => basePanel.roles(),
    runIndependentAnalysis: (r, a) => { calls++; return basePanel.runIndependentAnalysis(r, a); },
    get calls() { return calls; },
  };
  const deps = {
    claimStore, runStore, expertPanel,
    topicSource: new orch.InMemoryTopicSource(o.topics ?? [makeTopic()]),
    evidenceService: new orch.InMemoryEvidenceService({
      sources: o.sources ?? [makeEvidence()], claims: o.claims ?? [makeClaim()],
      failUntilAttempt: o.evidenceFailUntilAttempt ?? 0,
    }),
    consensusComposer: new orch.InMemoryConsensusComposer(o.draft ?? makeDraftInput()),
    translationService: new orch.InMemoryTranslationService({ byLanguage: o.translation ?? assetContent() }),
  };
  return deps;
}

const run = (input, deps) => orch.runOfflineOrchestration(input, deps);

// ================= happy path: stops at awaiting_medical_review =================
test("happy path reaches awaiting_medical_review with a pending draft and pending assets", () => {
  const deps = makeDeps();
  const r = run(makeInput(), deps);
  assert.equal(r.status, "awaiting_medical_review");
  assert.equal(r.finalStage, "awaiting_medical_review");
  assert.equal(r.consensusDraft.medicalReviewStatus, "pending");
  assert.equal(r.assets.length, 2);
  assert.ok(r.assets.every((a) => a.medicalReviewStatus === "pending"));
  assert.deepEqual([...r.assets.map((a) => a.language)].sort(), ["en", "zh"]);
  assert.match(r.operationId, /^roundtable:2026-07-11:[0-9a-f]{16}:v1$/);
  const types = r.auditEvents.map((e) => e.eventType);
  assert.ok(types.includes("consensus_drafted"));
  assert.ok(types.includes("translation_drafted"));
  assert.ok(types.includes("medical_review_requested"));
});

// ================= no publication path =================
test("publication is never reached: no approved/published/publication_planned, gate closed", () => {
  const r = run(makeInput(), makeDeps());
  assert.equal(r.publicationAllowed, false);
  assert.ok(r.publicationBlockReason.length > 0);
  assert.equal("publicationPlan" in r, false);
  const types = r.auditEvents.map((e) => e.eventType);
  assert.equal(types.includes("medical_review_approved"), false);
  assert.equal(types.includes("publication_planned"), false);
  assert.equal(types.includes("published"), false);
});

// ================= determinism =================
test("same input yields same operationId and identical audit events (deterministic)", () => {
  const a = run(makeInput(), makeDeps());
  const b = run(makeInput(), makeDeps());
  assert.equal(a.operationId, b.operationId);
  assert.deepEqual(a.auditEvents, b.auditEvents);
});

// ================= idempotent re-entry =================
test("idempotent re-entry replays the cached result with no extra expert work", () => {
  const deps = makeDeps();
  const first = run(makeInput(), deps);
  const callsAfterFirst = deps.expertPanel.calls;
  const second = run(makeInput(), deps);
  assert.equal(second.resumedFromStore, true);
  assert.equal(second.operationId, first.operationId);
  assert.equal(deps.expertPanel.calls, callsAfterFirst); // no re-run of experts
  const { resumedFromStore: _a, ...restFirst } = first;
  const { resumedFromStore: _b, ...restSecond } = second;
  assert.deepEqual(restSecond, restFirst);
});

// ================= recovery from a transient provider failure =================
test("transient expert failure schedules a retry, then recovers on attempt 2 with the SAME operationId", () => {
  const deps = makeDeps({ panelConfig: { failRoles: ["clinical_perspective"], failUntilAttempt: 1 } });
  const r1 = run(makeInput({ attempt: 1 }), deps);
  assert.equal(r1.status, "retry_scheduled");
  assert.equal(r1.retryPlan.shouldRetry, true);
  assert.equal(r1.budgetUsage.retries, 1); // retry counted against budget
  const r2 = run(makeInput({ attempt: 2 }), deps);
  assert.equal(r2.status, "awaiting_medical_review");
  assert.equal(r2.operationId, r1.operationId); // no second discussion
});

test("transient evidence failure is retryable and recovers on attempt 2", () => {
  const deps = makeDeps({ evidenceFailUntilAttempt: 1 });
  assert.equal(run(makeInput({ attempt: 1 }), deps).status, "retry_scheduled");
  assert.equal(run(makeInput({ attempt: 2 }), deps).status, "awaiting_medical_review");
});

// ================= retry budget exhausted -> provider_failed (fail closed) =================
test("retries stop at the budget and fail closed to provider_failed (never completed)", () => {
  const deps = makeDeps({ panelConfig: { failRoles: ["moderator"], failUntilAttempt: 9 } });
  const input = () => makeInput({ budget: makeBudget({ maximumRetries: 1 }) });
  assert.equal(run({ ...input(), attempt: 1 }, deps).status, "retry_scheduled");
  const final = run({ ...input(), attempt: 2 }, deps);
  assert.equal(final.status, "blocked");
  assert.equal(final.blockedState, "provider_failed");
});

// ================= budget exhaustion =================
test("agent-call budget exhaustion blocks with budget_exceeded and audits it", () => {
  const deps = makeDeps();
  const r = run(makeInput({ budget: makeBudget({ maximumAgentCalls: 2 }) }), deps);
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "budget_exceeded");
  assert.ok(r.auditEvents.some((e) => e.eventType === "budget_exceeded"));
});

// ================= permanent provider failure =================
test("a permanently failed agent cannot form a complete consensus (provider_failed)", () => {
  const deps = makeDeps({ panelConfig: { permanentlyFailRoles: ["adversarial_reviewer"] } });
  const r = run(makeInput(), deps);
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "provider_failed");
});

// ================= evidence invalid =================
test("unverified evidence blocks review readiness (evidence_invalid), never reaching consensus", () => {
  const deps = makeDeps({ sources: [makeEvidence({ verificationStatus: "pending" })] });
  const r = run(makeInput(), deps);
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "evidence_invalid");
  assert.ok(r.auditEvents.some((e) => e.eventType === "evidence_rejected"));
  assert.equal(r.auditEvents.some((e) => e.eventType === "consensus_drafted"), false);
});

test("withdrawn evidence also blocks as evidence_invalid", () => {
  const deps = makeDeps({ sources: [makeEvidence({ withdrawn: true })] });
  assert.equal(run(makeInput(), deps).blockedState, "evidence_invalid");
});

// ================= AI self-approval attack =================
test("AI draft carrying review/approval state is rejected (schema_invalid), never approved", () => {
  for (const field of ["medicalReviewStatus", "reviewerId", "approval", "publishedAt", "withdrawn"]) {
    const draft = makeDraftInput({ [field]: field === "withdrawn" ? true : "approved" });
    const r = run(makeInput(), makeDeps({ draft }));
    assert.equal(r.status, "blocked", field);
    assert.equal(r.blockedState, "schema_invalid", field);
    assert.equal("consensusDraft" in r, false, field);
  }
});

test("AI draft carrying a forbidden clinical field is rejected (schema_invalid)", () => {
  const r = run(makeInput(), makeDeps({ draft: makeDraftInput({ diagnosis: "x" }) }));
  assert.equal(r.blockedState, "schema_invalid");
});

// ================= high-risk / privacy topic blocking =================
test("individual-diagnosis topic is blocked high_risk before any run work", () => {
  const topic = makeTopic({ title: "我可能罹患糖尿病吗", normalizedQuestion: "我可能罹患糖尿病吗" });
  const r = run(makeInput(), makeDeps({ topics: [topic] }));
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "high_risk_blocked");
});

test("patient-data topic is blocked privacy", () => {
  const topic = makeTopic({ containsPatientData: true });
  const r = run(makeInput(), makeDeps({ topics: [topic] }));
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "privacy_blocked");
});

// ================= panel enforcement =================
test("fewer than five roles or missing Evidence/Safety is cancelled before planning", () => {
  const missingSafety = ["moderator", "evidence_medicine", "clinical_perspective", "adversarial_reviewer", "public_health"];
  const r = run(makeInput({ availableAgentRoles: missingSafety }), makeDeps());
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "cancelled");
});

// ================= duplicate blocking =================
test("a duplicate topic (fingerprint already seen) is blocked", () => {
  const topic = makeTopic();
  const r = run(makeInput({ previousTopicFingerprints: [rt.computeTopicFingerprint(topic.title)] }), makeDeps({ topics: [topic] }));
  assert.equal(r.status, "blocked");
  assert.equal(r.blockedState, "duplicate_blocked");
});
