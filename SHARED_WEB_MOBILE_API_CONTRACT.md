# GB MEDIX AI — Shared Web / Mobile / Agent API Contract

分支：`feature/shared-api-contract`　|　日期：2026-07-10　|　状态：规划（不改现有 API / Schema / 支付 / 权限）

> 品牌统一 **GB MEDIX AI**。本文件固定 Web、App、Agent **共用**的 API、Schema、认证、Consent、Report、Entitlement 契约。契约冻结后其余各线依赖它。**本阶段仅规划，不落地实现。**

---

## 0. 通用约定
- 传输 JSON；请求体经 Zod 校验。
- **App 不直接访问数据库、不直接调用模型 Provider**；一切经后端。
- 权益（Entitlement）与 Consent 以**后端为唯一真相**。
- 健康数据按 `userId` / `familyMemberId` 隔离；报告读取必须 IDOR 安全（按 `{ id, userId }`）。

---

## 1. Auth（移动令牌，复用 `User.sessionVersion` 吊销）

| 端点 | 说明 |
|---|---|
| `POST /api/mobile/auth/login` | 邮箱登录，签发 Access + Refresh（含 `sessionVersion`） |
| `POST /api/mobile/auth/refresh` | 用 Refresh 换新 Access；校验 `sessionVersion` |
| `POST /api/mobile/auth/logout` | 单设备退出 |
| `POST /api/mobile/auth/logout-all` | 退出所有设备（`sessionVersion += 1`，令旧令牌失效） |
| 邮箱验证 Deep Link | 验证链接携带 token，唤起 App 完成 `status=active` |

- Access Token 短时效；Refresh 走轮换；令牌存 SecureStore。
- `sessionVersion` 校验与 Web 一致：cookie/token 内版本 ≠ DB 版本 → 失效。

---

## 2. Consent（统一）
统一字段与操作：`status` · `accept` · `revoke` · `consentVersion` · `providerScope`。
- 使用第三方/跨境 provider（deepseek/qwen/kimi/glm/doubao，经 AIHubMix 中转）前必须 `accept` 且 `providerScope` 覆盖；未同意返回 `AI_CONSENT_REQUIRED`。
- `revoke` 后再次调用第三方 AI 必须返回 `AI_CONSENT_REQUIRED`。

---

## 3. Health Assessment（统一）
`assessment create` · `save draft` · `submit` · `result` · `report link`。
- submit 前需 `status=active`（邮箱已验证）+ Consent。
- result 返回结构化报告；report link 指向报告资源（IDOR 安全）。

---

## 4. AI Conversation（统一，Web/App 共享）
`create conversation` · `list conversations` · `get messages` · `send message` · `agent status` · `retry failed run` · `cancel run`。
- 共享 `conversationId` / `Message` / `AgentRun 状态`：Web 起、App 续。
- `retry failed run` 幂等；`cancel run` 进入 `cancelled`。
- 状态机与 Agent 定义见 `AI_AGENT_CONSULTATION_PLAN.md`。

---

## 5. Report（统一）
- Free / Premium 字段统一（Free 脱敏 Premium 字段）。
- Premium 必须经 `Entitlement`（`ENTITLEMENT_REQUIRED` / 402）。
- **IDOR 防护**：一律按 `{ id, userId }` 读取。
- 报告历史列表统一。
- 后续 PDF 导出约束：导出同样受 Entitlement 与 IDOR 约束，脱敏规则一致（V2）。

---

## 6. Product Recommendation（统一）
字段：`productId` · `reason` · `category` · `score` · `locale` · `availability`。
- **只从真实 Product 数据库**产生，禁止模型虚构。
- 按 `locale` 与 `availability` 过滤。

---

## 7. Error Codes（固定）
统一错误码（跨 Web/App/Agent）：
```text
AUTH_REQUIRED
TOKEN_EXPIRED
EMAIL_VERIFICATION_REQUIRED
AI_CONSENT_REQUIRED
ENTITLEMENT_REQUIRED
RATE_LIMITED
AI_PROVIDER_ERROR
AI_OUTPUT_INVALID
SAFETY_ESCALATION_REQUIRED
RESOURCE_NOT_FOUND
ACCESS_DENIED
```
- 与现有实现映射：现有 `AI_CONSENT_REQUIRED`(403)、Premium 402、Safe Error(502) 沿用；新增码在契约层统一，逐步落地。

---

## 8. API 版本与迁移
- 规划统一前缀：`/api/v1/`。
- **渐进迁移，禁止一次性大重构**：
  1. 新增/移动端接口直接落在 `/api/v1/`（如 `/api/mobile/auth/*` 归入 v1 命名空间）。
  2. 现有 Web 路由保持可用，通过**适配层/别名**逐步指向 v1，不破坏线上。
  3. 每次迁移单独 PR + Codex 审；高风险模块（Auth/Stripe/Entitlement/Consent/AIReport）单独评审。
  4. 契约测试（错误码、字段、鉴权）作为回归护栏。

---

## 9. 跨线硬约束（与 Roadmap 一致）
1. 不建三套账户体系。2. App 不直连 DB。3. App/Web 不直调 DeepSeek/AIHubMix。4. Premium 统一由 Entitlement 控制。5. Consent 统一。6. 健康数据按 `userId`/`familyMemberId` 隔离。7. 公共 migration 单独评审。8. Stripe/Auth/Entitlement/Consent/AIReport 高风险，必须 Codex 审。
