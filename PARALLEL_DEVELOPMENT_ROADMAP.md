# GB MEDIX AI — Parallel Development Roadmap

编制：Claude Code（Lead Developer）　|　日期：2026-07-10　|　基线：`main`（规划分支 `plan/mobile-agent-parallel-roadmap`）

> 本文件为多线并行研发的总排期。**本阶段仅规划，不改业务代码 / Schema / API / 支付 / 权限 / 生产配置。** 所有品牌名统一为 **GB MEDIX AI**（不再使用旧版本号品牌名作为主标题）。

---

## 0. 五条任务线总览

| 线 | 分支 | 目标 | 风险等级 |
|---|---|---|---|
| 生产盈利线 | `main`（仅审核通过改动）+ `fix/production-*` | 小流量持续收费与真实用户验证 | 高（触碰生产） |
| Web 增长线 | `feature/sprint-2a-growth-conversion` | 转化与商业化增长 | 中 |
| 手机 App 线 | `feature/mobile-app-foundation` | iOS/Android 统一 App | 中 |
| AI 智能体线 | `feature/ai-consultation-agent` | 多轮、可追踪、可审计问诊工作流 | 高（AI + 健康数据） |
| 共享契约线 | `feature/shared-api-contract` | 固定 Web/App/Agent 共用 API/Schema/Auth/Consent/Report/Entitlement 契约 | 高（跨端地基） |

**依赖关系**：共享契约线是其余各线的地基，必须**先行并保持稳定**；App 线与 Agent 线均依赖契约线冻结的接口与错误码。

---

## 1. 生产盈利线（Production Profit Line）

### 当前已具备
注册与邮箱验证 · 第三方 AI Consent · DeepSeek / AIHubMix（经中转 + 模型路由）· 免费健康评估 · Free Report · Premium Report · Stripe 支付 · Entitlement · 退款撤权。

### 目标
在不影响研发的前提下，持续小流量收费与真实用户验证，稳定产生营收信号。

### 生产保护规则（硬约束）
1. `main` **仅接受 Codex 审核通过**的改动。
2. **线上 P0 优先于所有新功能**：出现 P0 时，所有研发线暂停协助，集中处置。
3. 生产修复走独立分支 `fix/production-*`，单独审核、单独合并。
4. **功能分支不得直接修改生产配置**（env、Vercel、Neon、Stripe/Resend/Provider 配置）。
5. 高风险模块（Stripe / Auth / Entitlement / Consent / AIReport）改动必须经 Codex 审。
6. 公共数据库 migration 必须**单独评审**，不得夹带在功能 PR 中。

---

## 2. Web 增长线 — `feature/sprint-2a-growth-conversion`

| 任务 | 说明 |
|---|---|
| Analytics 埋点 | 统一事件模型（页面/转化/AI 调用/支付节点），隐私合规 |
| 用户漏斗 | 注册→验证→评估→Free→Premium→复访 全漏斗度量 |
| Landing 转化优化 | 首屏、CTA、信任要素、A/B 结构 |
| Free/Premium 报告转化 | Free→Premium 解锁路径与话术优化 |
| 邮件自动触达 | 验证后、评估后、报告后、复访自动化序列（Resend） |
| 报告复访 | 报告页复访入口与提醒 |
| AI 商品推荐入口 | 报告内商品推荐入口（只从真实 Product 数据） |
| 多语言优化 | 补齐仍复用英文的语言文案 |

---

## 3. 手机 App 线 — `feature/mobile-app-foundation`
目标：iOS / Android 统一 App（React Native + Expo）。详见 `MOBILE_APP_IMPLEMENTATION_PLAN.md`。**App 不另建后端，复用现有 GB MEDIX AI API 与生产数据库。**

## 4. AI 智能体线 — `feature/ai-consultation-agent`
目标：多轮、可追踪、可审计的 AI 健康问诊工作流。详见 `AI_AGENT_CONSULTATION_PLAN.md`。

## 5. 共享契约线 — `feature/shared-api-contract`
目标：固定 Web/App/Agent 共用的 API、Schema、认证、Consent、Report、Entitlement 契约。详见 `SHARED_WEB_MOBILE_API_CONTRACT.md`。

---

## 6. 四周并行排期

> 每项标注：**Owner** · **前置依赖** · **输出文件** · **验收标准** · **是否影响数据库** · **是否高风险**。Owner 为执行角色（Claude Code 执行、Codex 审、ChatGPT 验收）。

### 第 1 周 — 地基（共享契约 / App 基础 / Agent 基础 / Web 埋点）

| 任务 | Owner | 前置依赖 | 输出文件 | 验收标准 | 影响 DB | 高风险 |
|---|---|---|---|---|---|---|
| 冻结 API 契约 v1（Auth/Consent/Assessment/Report/Entitlement/Errors） | Claude Code | 无 | `SHARED_WEB_MOBILE_API_CONTRACT.md` + 契约测试骨架 | Codex 通过；错误码固定 | 否 | 是 |
| Mobile Monorepo 脚手架（Expo + packages） | Claude Code | 契约草案 | `apps/mobile/` `packages/*` 骨架 | Expo 启动、类型贯通 | 否 | 否 |
| Agent 数据模型草案（无 migration） | Claude Code | 契约草案 | Agent schema 设计稿（文档） | 模型/索引/隔离/幂等已定义 | 否（仅设计） | 是 |
| Web Analytics 埋点框架 | Claude Code | 无 | 埋点事件表 + 实现 | 关键事件可采集、隐私合规 | 否 | 否 |

### 第 2 周 — App 登录与评估 / Agent 多轮问诊 / Web 转化

| 任务 | Owner | 前置依赖 | 输出文件 | 验收标准 | 影响 DB | 高风险 |
|---|---|---|---|---|---|---|
| Mobile Auth（token/refresh/SecureStore/deep link 验证） | Claude Code | Auth 契约 | mobile auth 模块 | 登录/刷新/吊销/退出全设备可用 | 否（复用现有 User.sessionVersion） | 是 |
| App 健康评估流（Consent→评估→Free Report） | Claude Code | 契约冻结 | mobile 评估页 | 与 Web 同结果、同 Consent 门禁 | 否 | 中 |
| Agent 多轮问诊（Intake+Safety 状态机） | Claude Code | Agent 模型评审 | agent 工作流实现（feature 分支） | 状态机可跑、Safety 拦截生效 | 是（需评审 migration） | 是 |
| Web 转化优化（Landing/Free→Premium） | Claude Code | 埋点 | web 转化改动 | 漏斗指标可对比 | 否 | 中 |

### 第 3 周 — App 报告 / Agent 计划与回访 / 商品推荐

| 任务 | Owner | 前置依赖 | 输出文件 | 验收标准 | 影响 DB | 高风险 |
|---|---|---|---|---|---|---|
| App 报告（Free/Premium + Entitlement 状态 + 历史） | Claude Code | Report 契约 | mobile 报告页 | Premium 经 Entitlement、IDOR 安全 | 否 | 是 |
| Agent 计划生成 + Follow-up 回访 | Claude Code | Agent 多轮 | plan/follow-up 实现 | 7/30 天计划、回访任务可追踪 | 是（评审） | 是 |
| 商品推荐入口（Web+App，仅真实 Product） | Claude Code | Product 契约 | 推荐入口 | 无虚构商品、locale/availability 正确 | 否 | 中 |

### 第 4 周 — 三端联调 / Beta / 权限与安全审查

| 任务 | Owner | 前置依赖 | 输出文件 | 验收标准 | 影响 DB | 高风险 |
|---|---|---|---|---|---|---|
| Web/App/Agent 联调（同一 Conversation/Report/Entitlement） | Claude Code | 三线产物 | 联调报告 | Web 起、App 续、状态一致 | 否 | 是 |
| Beta 打包（EAS Build，内测） | Claude Code | App 完成 | Beta 构建 | iOS/Android 内测可装 | 否 | 中 |
| 权限与安全审查（Codex） | Codex | 全部 | 安全审查报告 | Stripe/Auth/Entitlement/Consent/AIReport 全绿 | — | 是 |

---

## 7. 里程碑验收（ChatGPT）
- W1：契约 v1 冻结 + 三线地基就绪。
- W2：App 可登录并跑通评估；Agent 多轮问诊可用。
- W3：App 报告 + Agent 计划/回访 + 商品推荐入口。
- W4：三端联调通过 + Beta + 安全审查通过。

任何一周若触发线上 P0，按第 1 节规则**优先处置生产**，排期顺延。
