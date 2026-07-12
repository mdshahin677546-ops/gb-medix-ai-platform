# GB MEDIX AI 医学圆桌 — 自主运行地基架构文档

**中文名称**:GB MEDIX AI 医学圆桌
**英文名称**:GB MEDIX AI Medical Roundtable
**定位**:多智能体循证医学讨论平台
**核心运行模式**:`AUTO_DRAFT + REVIEW_REQUIRED`

---

## 1. 当前状态声明(必读)

本模块是 **无数据库原型**,不是生产能力:

- **无数据库**:不含任何 Prisma Schema、migration 或数据库表;所有持久化能力仅以接口表达。
- **不调用真实 AI**:不接入 DeepSeek、AIHubMix、OpenAI 或任何 Provider;智能体行为仅以角色、状态与校验规则建模。
- **不是真实 Cron**:没有 Vercel Cron 或后台 Job;"每日运行"由 `planDailyRun` 纯函数表达,由未来调度系统触发。
- **不能公开发布**:发布路径终止于 `PublicationPlan` 计划对象,不写数据库、不渲染页面。
- **Evidence 检索尚未接入**:证据来源通过 `EvidenceSource` Schema 由未来证据服务提供;当前不做真实网络搜索或医学数据库查询。
- **医生资质认证尚未实现**:`approvedByReviewerId` 只是未来外部审核系统提供的不透明标识,本轮不实现医生账号或后台。
- **公开论坛治理尚未实现**:评论/点赞仅作为修订信号建模。
- **数据模型和 migration 必须单独审核**:未来落库的数据模型不属于本轮交付,须另行提交审核。

## 2. 核心安全不变量

1. **医生审核为强制发布门禁**:`evaluatePublicationGate` 要求 `medicalReviewStatus === "approved"` 且全部检查(关键 Claim 核验、无高风险内容、隐私、证据、审计、版本不可变)通过,任何一项失败都不能生成 `PublicationPlan`。高风险医学内容**没有任何绕过路径**。
2. **智能体共识不等于科学共识**:每份循证共识草稿的 `limitations` 必须包含免责声明「智能体一致意见不等于科学共识。」,否则 Schema 拒绝。
3. **禁止个体医疗输出**:共识草稿出现 `diagnosis / prescription / medicationDose / stopMedication / diseaseProbability / guaranteedOutcome / patientSpecificTreatment` 字段即拒绝;传播素材出现诊断、处方、剂量或疗效承诺文案即拒绝。
4. **患者个体问题永远不能变成论坛议题**:选题策略拒绝可识别患者资料、个体诊断/剂量/停药/概率/保证治愈类议题。

## 3. 模块结构(`lib/roundtable/v1/`)

| 文件 | 职责 |
| --- | --- |
| `types.ts` | 模块名称常量、运行模式、稳定指纹与标题标准化 |
| `states.ts` | 每日运行状态机(16 正常态 + 8 异常/阻断态),非法转换显式抛错 |
| `roles.ts` | 5 个默认智能体角色 + 可选角色;五角色齐全/去重/Evidence+Safety 强制校验;单 Agent 失败不得声称完整共识 |
| `topic-policy.ts` | 候选议题 Schema、安全策略(隐私/高风险/无证据/超范围)、优先类目、确定性选题打分、标准化指纹去重 |
| `daily-run.ts` | 每日运行规划器:一天一议题、operationId 幂等、`RunClaimStore` 接口 + 内存测试替身 |
| `budget.ts` | 六维预算 Schema、`evaluateBudget` / `recordBudgetUsage`,拒绝 NaN/Infinity/负数 |
| `retry.ts` | 可重试/不可重试错误分类,重试复用 operationId 并计入预算 |
| `evidence.ts` | `EvidenceSource` 严格 Schema;URL/DOI 存在 ≠ 已核验 |
| `claims.ts` | `EvidenceClaim` 严格 Schema;关键 Claim 绑定证据的审核前置校验 |
| `consensus.ts` | 循证共识草稿(Evidence Consensus Draft)Schema、免责声明、禁止字段显式拒绝 |
| `review-gate.ts` | `evaluatePublicationGate` 医生审核发布门禁 |
| `publication.ts` | `PublicationPlan` 生成与发布幂等键(同版本同键) |
| `distribution.ts` | 中英文传播素材草稿:继承版本/审核/撤回状态,翻译不得新增医学结论,一语言撤回全语言撤回 |
| `monitoring.ts` | `evaluateRevisionTriggers` 修订触发 + 新版本计划(旧版本不可变、新版本重新审核) |
| `audit.ts` | 审计事件:严格 `safeMetadata` allowlist,拒绝疑似密钥/邮箱/连接串,确定性 eventId |
| `index.ts` | 聚合导出 |

## 4. 每日运行状态机

正常路径:

```
scheduled → topic_selected → safety_precheck → agents_assigned
→ independent_analysis → cross_examination → adversarial_review
→ evidence_verification → consensus_drafting → translation_generation
→ awaiting_medical_review → approved → published → monitoring
→ revision_triggered → superseded
```

异常/阻断:`duplicate_blocked` `privacy_blocked` `high_risk_blocked` `budget_exceeded` `provider_failed` `evidence_invalid` `review_rejected` `cancelled`。

关键强制规则(均有测试):只有 `scheduled` 可进 `topic_selected`;`published` 只能来自 `approved`;`awaiting_medical_review`/`review_rejected` 不能直达 `published`;`evidence_invalid` 无法进入审核;`superseded` 不可恢复;`cancelled`/`privacy_blocked`/`high_risk_blocked`/`duplicate_blocked` 为终止态;`provider_failed` 是唯一可重试的阻断态。

## 5. 幂等与并发(未来生产要求)

- `operationId = roundtable:{YYYY-MM-DD}:{topicFingerprint}:v1`,由运行日期 + 标准化标题指纹确定性生成,不含患者信息,不作为权限凭证。
- 同一天同一议题永远得到同一 operationId;重试复用同一 operation,不会创建第二个 Discussion。
- `RunClaimStore` 是并发唯一性的接口边界。**本轮未实现生产分布式锁;内存 Map 实现(`InMemoryRunClaimStore`)不能保证跨进程/跨实例的并发安全,仅供测试。** 未来生产实现必须由:
  1. 数据库对运行日期的**唯一约束**;
  2. 带过期时间的 **lease**;
  3. 每次写入校验的单调 **fencing token**
  共同保证同日仅有一次执行。

## 6. 预算与失败重试

- 六维上限:`maximumAgentCalls / maximumEvidenceQueries / maximumTokens / maximumRetries / maximumTranslationLanguages / maximumRuntimeMs`;任何上限突破即进入 `budget_exceeded`,不产生伪完成结果。
- 重试、翻译、Evidence 查询全部计入预算;NaN/Infinity/负数在 Schema 与记账两层都被拒绝。
- 可重试:`provider_timeout / temporary_provider_error / temporary_evidence_service_error`;不可重试:`privacy_blocked / high_risk_blocked / evidence_invalid / medical_review_rejected / budget_exceeded / schema_invalid`;未知错误默认不可重试。

## 7. 证据与共识

- 关键 Claim(`confirmed_fact / current_consensus / safety_warning`)必须绑定已核验、未撤稿的 EvidenceSource;来源缺失、未核验、撤稿、过期无说明的 Claim 集合不得进入医生审核。
- 修订触发:新高质量证据、来源撤稿、专家重大纠错、重大安全报告、指南更新、内容过期;普通点赞/评论只是审核信号,不能直接变成 Evidence,也不触发修订。
- 已发布版本不可变;修订生成 `version + 1` 的新版本并重新进入医生审核,旧版本标记 `superseded`。

## 8. 审计

事件覆盖从 `run_scheduled` 到 `budget_exceeded` 的全生命周期;`safeMetadata` 采用严格 allowlist,禁止记录 Prompt 原文、思维过程、患者健康原文、email、明文 userId、Cookie/Token/API Key、Provider 请求响应体及真实病例身份信息;疑似敏感值直接抛错。

## 9. 测试

`tests/medical-roundtable-v1.test.mjs`(51 个用例)将 `lib/roundtable/v1` 的真实 TS 源码编译到 git 忽略的临时目录后 require 执行——无镜像逻辑、无复制 Schema/状态表、无源码字符串断言;`test.after` 自动清理临时目录。
