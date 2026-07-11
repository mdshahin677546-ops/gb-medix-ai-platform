# GB MEDIX AI — AI Agent Consultation Plan

分支：`feature/ai-consultation-agent`　|　日期：2026-07-10　|　状态：规划（不改业务代码 / Schema / API；不创建 migration）

> 品牌统一 **GB MEDIX AI**。名称：**GB MEDIX AI 智能健康问诊**。

---

## 1. 产品定位

- 健康信息收集
- 健康风险**提示**（非诊断）
- 生活方式建议
- 中医体质管理
- 个性化健康计划

**严禁**：疾病诊断 · 处方 · 治疗承诺 · 疾病概率 · 自动分诊结论 · 以医生口吻替代医生。（与现有 `medicalSafetyPrompt` 一致。）

---

## 2. Agent 架构（多智能体）

| Agent | 职责 |
|---|---|
| **Intake Agent** | 收集：主要问题 / 年龄段 / 性别 / 睡眠 / 饮食 / 压力 / 运动 / 身体感受 / 健康目标。遵循"每次只追问一个核心问题"。 |
| **Safety Agent** | 急症关键词、高风险状态识别；命中即**停止普通工作流**，建议用户寻求专业帮助（进入 `safety_escalated`）。 |
| **TCM Wellness Agent** | 体质倾向、饮食与作息、情绪与压力、**非医疗**健康建议。 |
| **Lifestyle Plan Agent** | 7 天计划、30 天计划、每日任务、健康目标。 |
| **Product Recommendation Agent** | **只从真实 Product 数据库推荐**，禁止模型虚构商品。 |
| **Follow-up Agent** | 每日/每周回访、计划执行状态、动态调整、报告复访、留存。 |

Safety Agent 优先级最高：任何阶段命中高风险都可中断并升级。

---

## 3. 数据模型规划（字段 / 索引 / 用户隔离 / 幂等键 / 状态 / 审计 / 保留策略）

> 以下为**设计草案**，本阶段不建 migration；正式建模走**单独 migration 评审**。所有含健康数据的表按 `userId`（及 `familyMemberId`，若适用）隔离。

| 模型 | 关键字段 | 索引 | 隔离 | 幂等键 | 状态 | 审计 | 保留 |
|---|---|---|---|---|---|---|---|
| `Conversation` | id, userId, familyMemberId?, locale, status, createdAt, updatedAt | userId, status, updatedAt | userId(+familyMemberId) | — | open/closed | 创建/关闭 | 随账户 |
| `Message` | id, conversationId, role, content(脱敏), createdAt | conversationId, createdAt | 经 Conversation | (conversationId, clientMsgId) | — | 追加不可改 | 随会话 |
| `AgentRun` | id, conversationId, agentType, state, inputRef, outputRef, error?, startedAt, endedAt | conversationId, state, agentType | 经 Conversation | (conversationId, agentType, runKey) | 见 §4 | 每次运行 | 随会话 |
| `AgentStep` | id, agentRunId, stepType, status, tokenUsageRef, createdAt | agentRunId, status | 经 Run | (agentRunId, stepIndex) | pending/done/failed | 每步 | 随 Run |
| `ConversationSummary` | id, conversationId, summary, version, createdAt | conversationId, version | 经 Conversation | (conversationId, version) | — | 版本化 | 随会话 |
| `FollowUpTask` | id, userId, conversationId?, dueAt, type, status | userId, dueAt, status | userId | (userId, conversationId, type, dueAt) | pending/done/skipped | 状态变更 | 保留期可配 |
| `HealthGoal` | id, userId, title, target, progress, status | userId, status | userId | (userId, goalKey) | active/paused/done | 变更 | 随账户 |
| `SafetyEvent` | id, userId, conversationId, trigger, severity, action, createdAt | userId, severity, createdAt | userId | (conversationId, trigger) | — | **强审计** | 长期 |
| `AgentArtifact` | id, agentRunId, kind(plan/report/summary), ref, createdAt | agentRunId, kind | 经 Run | (agentRunId, kind) | — | 产物留痕 | 随 Run |

设计要求：每模型必须显式定义**字段、索引、用户隔离、幂等键、状态、审计要求、数据保留策略**（如上表）；健康原文不入日志。

---

## 4. Agent 工作流（状态机）

```text
created
→ intake
→ safety_check
→ analysis
→ plan_generation
→ completed
```
**异常状态**：
```text
safety_escalated
provider_failed
invalid_output
cancelled
```
- 每次状态推进落 `AgentRun` / `AgentStep`，可追踪、可回放。
- `safety_escalated` 由 Safety Agent 触发，终止普通流程。
- `provider_failed` / `invalid_output` 走 Safe Error（复用现有诊断 allowlist 日志）。

---

## 5. 技术约束（必须复用，禁止另起炉灶）

必须复用：**AI Provider Adapter** · **DeepSeek / AIHubMix** · **Zod Schema** · **AI Consent** · **AIUsage** · **数据最小化** · **限流** · **Safe Error** · **Entitlement** · **SessionVersion**。

- **禁止自动跨 Provider fallback**。
- AI 调用顺序沿用现有 `enforceAIUsageBudget → 调用 → recordAIUsage`。
- 结构化输出沿用现有 `extractTopLevelJsonObject` + `JSON.parse` + Zod 校验，无效返回 Safe Error（不入库非法原文）。
- 第三方 provider 前必须过 Consent 门禁（`AI_CONSENT_REQUIRED`）。

---

## 6. Web / App 同步

Web 与 App **必须共享**：Conversation ID · Message · AgentRun 状态 · 报告 · Follow-up · 健康目标。

- 同一用户在 **Web 开始的问诊，可在 App 继续**（同 `conversationId`）。
- 状态以后端为唯一真相；两端通过共享契约端点读写（详见 `SHARED_WEB_MOBILE_API_CONTRACT.md` 的 AI Conversation 部分）。

---

## 7. 交付物（分支 `feature/ai-consultation-agent`）
- W1：Agent 数据模型设计稿（无 migration）+ 状态机骨架。
- W2：Intake + Safety 多轮问诊可跑。
- W3：Lifestyle Plan + Follow-up 回访。
- W4：与 Web/App 联调、安全审查（Safety/审计/隔离）。

**高风险**：涉及 AI + 健康数据 + 新数据模型；migration 与 Safety/Consent 逻辑必须经 Codex 审。
