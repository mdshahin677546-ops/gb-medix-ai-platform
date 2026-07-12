# GB MEDIX AI 医学圆桌 — 自主运行地基架构文档

**中文名称**:GB MEDIX AI 医学圆桌
**英文名称**:GB MEDIX AI Medical Roundtable
**定位**:多智能体循证医学讨论平台
**核心运行模式**:`AUTO_DRAFT + REVIEW_REQUIRED`

---

## 1. 能力边界声明(必读)

本模块是**无数据库原型地基**,不是生产系统。下面两张清单是本模块能力的唯一权威描述。

### 已实现(仅限以下内容)

- 无数据库的领域逻辑(纯 TypeScript + Zod,单进程内运行)
- 单进程内存 `RunClaimStore`(仅测试/原型用)
- 每日运行状态机(16 正常态 + 8 异常/阻断态,非法转换显式失败)
- **规则级**选题过滤(隐私/高风险文本模式匹配 + 风险等级 + 类目范围)
- EvidenceSource **结构**验证(含真实日历日期、http(s)/DOI 结构校验)
- EvidenceClaim **结构**绑定(关键 Claim 必须绑定已核验、未撤稿、无 ID 歧义的证据;空 Claim 集合 fail-closed)
- AI 共识草稿解析后由可信代码固定为 `pending`(AI 输入不能携带任何审核/发布状态字段)
- 独立的受信任 `MedicalReviewDecision` 结构与版本绑定的发布门禁(`evaluatePublicationGate`)
- `PublicationPlan` 计划对象生成(幂等键绑定内容 ID + 版本 + 语言集合 + 发布目标集合 + 身份摘要)
- 多语言传播素材的 **Claim ID 结构一致性**(集合严格相等、安全警告完整保留、生命周期同步撤回)
- 预算、失败重试、审计事件(严格 allowlist + 敏感模式拒绝 + 确定性 eventId)与修订触发的结构逻辑

### 未实现(明确不存在的能力)

- 数据库唯一约束、跨进程并发控制、lease/fencing
- Cron / 后台任务 / 任何真实调度
- AI Provider 接入(不调用 DeepSeek、AIHubMix、OpenAI 或任何模型)
- 真实证据检索;DOI/PMID 在线核验;引用与 Claim 的**语义**核验
- 翻译**语义等价**验证(仅结构级 Claim ID 一致性)
- 生产级 PHI/个人健康信息识别(仅规则级文本模式,存在漏检与误检)
- 生产级高风险医学内容分类器(仅规则级模式匹配)
- 医生身份、资质认证、审核后台、医生账号
- API 路由、真实发布、页面渲染、论坛治理
- HIPAA / FDA 或任何法规合规认证

**禁止的误导表述**(本文档及衍生材料不得声称):生产可用、HIPAA 合规、FDA 合规、临床验证、全自动发布、医生已验证、语义级核验、完整 PII 检测。

## 2. 核心安全不变量

1. **医生审核为强制发布门禁**:`evaluatePublicationGate` 要求审核状态为 `approved`、生命周期为 `active`、`contentVersion === approvedContentVersion`(新版本永不继承旧批准)、审核人 ID 结构合法,且关键 Claim 核验/无高风险内容/隐私/证据/审计/版本不可变全部通过。任何一项失败都不能生成 `PublicationPlan`;`createPublicationPlan` 自行重跑完整门禁,不信任调用方。门禁代码对高风险内容、withdrawn、superseded 不提供任何跳过分支;但门禁的输入(如"无高风险内容"判定)来自上游规则级检测,该检测存在漏检可能。**发布安全最终依赖可信的外部上游审核系统,本模块不能独立保证。**
2. **AI 不能自我批准**:AI 草稿输入 Schema 严格禁止 `medicalReviewStatus / reviewerId / reviewedAt / approval / publicationStatus / publishedAt / withdrawn / superseded` 字段;解析成功后由可信代码固定 `pending`;状态变更唯一入口是外部 `MedicalReviewDecision`,且必须精确匹配内容版本。审核决策本身来自外部系统——本模块只校验其结构,不验证审核人真实性;发布安全依赖该可信上游审核系统。
3. **智能体共识不等于科学共识**:每份草稿的 `limitations` 必须包含免责声明「智能体一致意见不等于科学共识。」。
4. **禁止个体医疗输出**:草稿出现 `diagnosis / prescription / medicationDose / stopMedication / diseaseProbability / guaranteedOutcome / patientSpecificTreatment` 即拒绝;传播素材出现诊断、处方、剂量或疗效承诺文案即拒绝。
5. **患者个体问题不得变成论坛议题(规则级防线)**:统一规范化(NFKC、小写、零宽剥离、空白/标点折叠)后进行隐私与高风险匹配;`containsPatientData=false` 与 `riskLevel=low` 都不能覆盖文本检测;`riskLevel=high` 一律阻断;严重度取最严格:privacy > high_risk > duplicate > planned。**这只是规则级防线,不是生产级 PHI 或医疗安全分类器:高风险模式匹配不保证覆盖所有同义词与语言变体,隐私/审计检测也不是完整的 PHI/PII 识别,均存在漏检可能。**
6. **审核人 ID 只是不透明标识**:在任何 trim 之前对原始字符串拒绝控制字符(C0/DEL/C1)、U+2028/U+2029 及除普通 ASCII 空格外的一切 Unicode 空白/分隔符与零宽字符;仅前后 ASCII 空格可被剥离,ID 内部不允许任何空白。它**不是**医生身份或资质已验证的证明——医生认证不存在于本模块。

## 3. 模块结构(`lib/roundtable/v1/`)

| 文件 | 职责 |
| --- | --- |
| `types.ts` | 模块常量、共享枚举(审核状态/生命周期)、稳定指纹、统一文本规范化、真实日历日期校验 |
| `states.ts` | 每日运行状态机,非法转换显式抛错 |
| `roles.ts` | 5 默认智能体角色 + 可选角色;五角色/去重/Evidence+Safety 强制校验 |
| `topic-policy.ts` | 候选议题 Schema(标题长度/控制字符/纯标点拒绝)、隐私与高风险文本策略、指纹一致性(伪造 duplicateFingerprint 直接拒绝)、确定性选题 |
| `daily-run.ts` | 每日运行规划器:真实日历日期、一天一议题、operationId 幂等、`RunClaimStore` 接口 |
| `budget.ts` | 六维预算,拒绝 NaN/Infinity/负数 |
| `retry.ts` | 可重试/不可重试分类,重试复用 operationId 并计入预算 |
| `evidence.ts` | `EvidenceSource` 严格 Schema(真实日期、http(s)/DOI 结构校验);URL/DOI 存在 ≠ 已核验 |
| `claims.ts` | `EvidenceClaim` 严格 Schema;空集合 fail-closed;重复/大小写歧义 ID 拒绝;审核前置校验 |
| `consensus.ts` | AI 草稿信任边界(禁审核字段、固定 pending)、`applyMedicalReviewDecision` 版本绑定状态变更 |
| `review-gate.ts` | `ReviewerIdSchema`、受信任 `MedicalReviewDecision`、生命周期+版本绑定的发布门禁 |
| `publication.ts` | `PublicationPlan`;幂等键绑定 操作ID+版本+语言集合+目标集合+摘要,集合有序化去重 |
| `distribution.ts` | 多语言素材:默认 pending、源绑定、Claim ID 集合严格一致、冻结对象、生命周期全语言同步 |
| `monitoring.ts` | 修订触发 + 新版本计划(旧版本不可变、新版本重新 pending) |
| `audit.ts` | 审计事件:键 allowlist + 禁止键干,值限枚举/短ID/数字/布尔,敏感模式拒绝,eventId 绑定排序 metadata 摘要 |
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

关键强制规则(均有测试):只有 `scheduled` 可进 `topic_selected`;`published` 只能来自 `approved`;`awaiting_medical_review`/`review_rejected` 不能直达 `published`;`evidence_invalid` 无法进入审核;`superseded` 不可恢复;终止态不可离开;`provider_failed` 是唯一可重试的阻断态。

## 5. 幂等与并发(未来生产要求)

- `operationId = roundtable:{YYYY-MM-DD}:{topicFingerprint}:v1`,运行日期为真实日历日期,指纹由标准化标题重算;不含患者信息,不作权限凭证。
- 调用方提供的 `duplicateFingerprint` 必须与系统重算一致,否则该议题直接拒绝——伪造指纹不是去重绕过入口。
- 同日同议题同 operationId;重试复用 operation,不创建第二个 Discussion。
- 发布幂等键:`publish:{operationId}:v{version}:{语言集合}:{目标集合}:{身份摘要}`,语言/目标排序去重后入键;不同语言、不同目标、不同版本永不同键。
- `RunClaimStore` 是并发唯一性的接口边界。**本轮未实现生产分布式锁;`InMemoryRunClaimStore` 不能保证跨进程/跨实例的并发安全,仅供测试。** 未来生产实现必须由:(1) 数据库对运行日期的唯一约束;(2) 带过期时间的 lease;(3) 每次写入校验的单调 fencing token 共同保证同日仅一次执行。

## 6. 预算与失败重试

- 六维上限;任何突破即 `budget_exceeded`,不产生伪完成结果;重试/翻译/Evidence 查询全部计入预算;NaN/Infinity/负数双层拒绝。
- 可重试:`provider_timeout / temporary_provider_error / temporary_evidence_service_error`;不可重试:`privacy_blocked / high_risk_blocked / evidence_invalid / medical_review_rejected / budget_exceeded / schema_invalid`;未知错误默认不可重试。

## 7. 证据、共识与多语言

- 关键 Claim(`confirmed_fact / current_consensus / safety_warning`)必须绑定存在、已核验、未撤稿、无 ID 歧义的 EvidenceSource;空 Claim 集合永不 ready;Evidence ID 重复(含仅大小写差异)整体拒绝;引用为 trim 后精确匹配。
- 多语言素材与源共识绑定(`sourceConsensusId/sourceVersion/sourceClaimIds/sourceSafetyWarningClaimIds`);`translatedClaimIds` 必须与源集合严格相等(不增、不删、不重复,安全警告完整保留);对象冻结防篡改。**仅保证结构级完整性,不保证语义等价。**
- 原文 withdrawn/superseded 同步全部语言;任一语言撤回则全语言撤回;素材默认 `pending`,无外部审核决策不能 approved/published。
- 修订触发:新高质量证据、来源撤稿、专家重大纠错、重大安全报告、指南更新、内容过期;普通点赞/评论永不触发;旧版本不可变,新版本重新 pending。

## 8. 审计

`safeMetadata` 键采用严格 allowlist + 禁止键干(name/email/phone/MRN/prompt/token/secret 等变体);值仅允许受限短字符串(NFKC、trim、限长、禁控制/零宽字符、禁长自然语言与 CJK 长文、禁 JSON 字符串)、有限数字与布尔;拒绝邮箱(含 Unicode 变体)、电话、MRN、Bearer/JWT、API key、URL 敏感查询参数等模式。`eventId = {operationId}:{eventType}:{sequence}:{排序metadata摘要}`——相同逻辑事件与 metadata 得到相同 ID,键顺序无关,不含原文,不作鉴权凭证。禁止记录 Prompt 原文、思维过程、患者健康原文、email、明文 userId、Cookie/Token/API Key、Provider 请求响应体及真实病例身份信息。

## 9. 测试

`tests/medical-roundtable-v1.test.mjs`(74 个用例)将 `lib/roundtable/v1` 的真实 TS 源码编译到 git 忽略的随机临时目录后 require 执行——无镜像逻辑、无复制 Schema/状态表/正则/算法、无源码字符串断言;编译失败与运行结束均清理临时目录。

## 10. 复审后的剩余限制(必读)

- 高风险/隐私文本检测为**规则级模式匹配**,不保证覆盖所有同义词、方言表达或跨语言变体;不是生产级医疗安全分类器。选题另设**结构性首期安全门禁**:文本同时出现"个体/单一患者主体信号"与"医学状态/诊断判断意图信号"时直接 `high_risk_blocked`,无需识别具体疾病名。该门禁刻意保守,**允许一定误报**(个别群体/教育主题可能被拦),优先防止个体诊断语境自动选题。
- 审计 metadata 检测(含最多 5 层有界循环百分号解码并逐层扫描、token 形态、邮箱/电话/MRN 模式;超深或非法编码 fail-closed)**不是完整的 PHI/PII 识别**。
- `reviewerId` 仅为外部系统提供的不透明标识,不代表医生身份或资质;医生认证、审核后台均未实现。
- 发布路径终止于 `PublicationPlan`,真实发布与发布安全**依赖可信的上游审核系统**。
- 当前没有生产级分类器、没有医生认证、没有真实证据检索、没有真实发布。
