# GB MEDIX AI 医学圆桌 — Batch 2.2B 离线编排地基

**模块:** `lib/roundtable/v1/orchestration/**`
**定位:** 确定性、可幂等重入的离线医学圆桌编排,复用 Batch 2.2A 安全模块;流程最多运行到 `awaiting_medical_review`。

---

## 1. 能力边界声明(必读)

**已实现(仅限以下内容):**
- 单次**手动触发**的运行协调器 `runOfflineOrchestration`(非 Cron/timer)。
- 模拟 `TopicSource`、五类专家输入、`Evidence`/`Claim`、共识草稿与中英待审资产的**内存适配器**。
- 复用 2.2A 安全模块:选题安全门禁、状态机、智能体面板规则、预算、重试、证据/主张绑定、AI 信任边界、传播资产完整性、审计。
- 幂等重入(同 `operationId` 复用)、可恢复重试、预算/重试/审计 fail-closed。

**未实现(明确不存在):**
- 数据库 / Prisma / migration;跨进程并发、lease/fencing、数据库唯一约束。
- 真实 Cron / 后台调度。
- 真实 AI Provider / network / 真实证据检索 / DOI-PMID 在线核验。
- 医生账号 / 真实审核后台 / 真实发布;**不生成真实 PublicationPlan,不触发任何发布路径**。
- app 展示页、Mobile、Stripe、Auth、生产配置。

**禁止的表述:** 生产就绪、真实自动发布、临床验证、医生已验证、完整 PHI 检测。

## 2. 核心不变量

1. **流程终止于 `awaiting_medical_review`**:协调器永不推进到 `approved`/`published`,`AwaitingReviewResult.publicationAllowed` 恒为 `false`,并附 `publicationBlockReason`;发布需要本协调器从不提供的、可信外部 `MedicalReviewDecision`。
2. **AI 不能自我批准**:共识草稿输入原样交给 2.2A 的 `parseConsensusDraft`——任何携带 `medicalReviewStatus/reviewerId/reviewedAt/approval/publicationStatus/publishedAt/withdrawn/superseded` 或禁止临床字段的输入被拒(`schema_invalid`);解析成功后审核状态固定 `pending`。
3. **≥5 角色且 Evidence 与 Safety 强制**:`validateAgentPanel` 预检不满足即 `cancelled`;`planDailyRun` 只邀请默认五角色。
4. **个体诊断 / 处方 / 剂量 / 疾病概率 / 保证疗效 / 患者数据继续阻断**:选题经 `evaluateTopicSafety` 结构性门禁,命中即 `high_risk_blocked` / `privacy_blocked`。
5. **关键 Claim 必须绑定 verified evidence**:`validateClaimsForMedicalReview` 未就绪(未验证/撤稿/缺失/重复歧义)即 `evidence_invalid`,永不进入共识。
6. **fail-closed**:预算任一维度超限即 `budget_exceeded`;不可重试错误终止;单个专家失败无法形成完整共识(`provider_failed`);失败绝不标记为完成。

## 3. 运行流程(阶段与状态机)

```
scheduled → topic_selected → safety_precheck → agents_assigned
→ independent_analysis → cross_examination → adversarial_review
→ evidence_verification → consensus_drafting → translation_generation
→ awaiting_medical_review   ← 终止于此
```

每步经 2.2A `transition()` 校验合法性;每个外部能力调用消耗预算维度(`agentCalls`/`tokens`/`evidenceQueries`/`translationLanguages`/`retries`/`runtimeMs`),消耗前 `canSpend` 检查,超限抛出并归入 `budget_exceeded`。审计事件用确定性 `sequence` + 摘要 id,`safeMetadata` 严格 allowlist。

## 4. 幂等与恢复

- `operationId` 由 `planDailyRun` 生成(`roundtable:{YYYY-MM-DD}:{fingerprint}:v1`),不含患者信息,不作权限凭证。
- **幂等重入**:`OrchestrationRunStore` 缓存终态结果;同输入再次运行原样重放(`resumedFromStore=true`),不重复专家/证据工作。
- **恢复**:瞬态 Provider 失败(`TransientProviderError`)→ `planRetry` 决策 → 返回 `retry_scheduled`(重试计入预算);以 `attempt+1`、同一 `deps` 重入,`RunClaimStore` 复用同一 `operationId`——**不创建第二个讨论**;重试预算耗尽 → `provider_failed`(fail-closed,非完成)。
- 输入携带确定性 `timestamp`,无环境时钟/随机源,保证同输入同输出。

## 5. 并发与生产要求(未实现)

**本批次仅提供内存测试适配器。** `InMemoryRunClaimStore` 与 `InMemoryOrchestrationRunStore` 是单进程实现,**不保证跨进程并发、真实 Cron 或数据库唯一约束**。生产实现必须由:数据库对 `operationId` 的唯一约束 + 带过期时间的 lease + 每次写入校验的 fencing token 共同保证同一运行的并发唯一执行。数据模型与 migration 必须单独审核。

## 6. 结果类型

- `AwaitingReviewResult` — 成功终止于待审:含 `consensusDraft`(pending)、`assets`(中英,pending)、`budgetUsage`、`auditEvents`、`publicationAllowed:false`。
- `BlockedResult` — 终态阻断:`cancelled` / `duplicate_blocked` / `privacy_blocked` / `high_risk_blocked` / `budget_exceeded` / `provider_failed` / `evidence_invalid` / `schema_invalid`。
- `RetryScheduledResult` — 瞬态失败可恢复:含 `retryPlan`,以 `attempt+1` 重入。

## 7. 测试

`tests/medical-roundtable-orchestration-v1.test.mjs` 编译整棵 `lib/roundtable/v1`(含 `orchestration/`)后执行真实实现——无镜像 Schema/状态机/正则/预算/指纹算法,无源码字符串断言。覆盖:幸福路径终止于待审、无发布路径、确定性、幂等重入(零额外专家调用)、瞬态专家/证据失败恢复、重试预算耗尽 `provider_failed`、预算耗尽、永久专家失败、证据无效、AI 自我批准攻击、禁止临床字段、高风险/隐私选题阻断、面板强制、重复阻断。编译失败与运行结束均清理临时目录。
