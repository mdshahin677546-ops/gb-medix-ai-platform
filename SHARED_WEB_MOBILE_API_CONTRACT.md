# GB MEDIX AI — Shared Web / Mobile / Agent API Contract

分支：`feature/shared-api-contract`　|　日期：2026-07-10　|　状态：规划（PLANNED；不改现有 API / Schema / 支付 / 权限）

> 品牌 **GB MEDIX AI**。固定 Web/App/Agent 共用契约。标签：EXISTING / PLANNED / BLOCKED / REQUIRES_DECISION。**本轮只规划，不实现。**

---

## 1. 目标
Web、App、Agent 必须共用：账户 · 邮箱验证 · 健康档案 · `familyMemberId` · Consent · Conversation · Report · Entitlement · Product · AIUsage · AI Provider · PostgreSQL 后端。

## 2. 硬规则
1. 不建三套账户体系。2. App 不直接访问数据库。3. App/Web 不直接访问 DeepSeek/AIHubMix。4. Premium 统一由 Entitlement 控制。5. Consent 统一。6. 健康数据按 `userId/familyMemberId` 隔离。7. 公共 migration 独立审核。8. Stripe/Auth/Entitlement/Consent/AIReport 属高风险模块（Codex 审）。

## 3. API 版本
统一前缀 `/api/v1/`（PLANNED；现有路由在 `app/api/**` 无版本前缀，EXISTING）。
- **现有 API 兼容**：保持 `app/api/**` 现路由可用，不破坏生产。
- **渐进迁移**：新增/移动端接口直接落 `/api/v1/`；现有 Web 路由通过适配层/别名逐步指向 v1。
- **BFF**：REQUIRES_DECISION——是否为 App 引入轻 BFF（多数情况直连 `/api/v1/` 即可，暂不引入）。
- **Web 内部 Server Action**：Web 页面可继续用 Server Action 做 SSR 数据装配，但**跨端公共能力**统一走 `/api/v1/`。
- **公共接口边界**：App 与 Web 共享 `/api/v1/*`；Web 私有 SSR 逻辑不暴露给 App。
- **弃用策略**：旧接口标注弃用期限 + 监控调用量，到期下线；高风险接口单独迁移。

## 4. 统一错误结构
统一错误码：
```text
AUTH_REQUIRED · TOKEN_EXPIRED · EMAIL_VERIFICATION_REQUIRED · AI_CONSENT_REQUIRED
ENTITLEMENT_REQUIRED · RATE_LIMITED · AI_PROVIDER_ERROR · AI_OUTPUT_INVALID
SAFETY_ESCALATION_REQUIRED · RESOURCE_NOT_FOUND · ACCESS_DENIED
```
统一响应结构：
```json
{
  "ok": false,
  "error": {
    "code": "AI_CONSENT_REQUIRED",
    "message": "用户可安全展示的通用信息",
    "requestId": "去敏后的请求标识",
    "retryable": false
  }
}
```
**不得返回内部堆栈、上游原始错误或敏感数据。** 与现有映射：`AI_CONSENT_REQUIRED`(403)、Premium 402→`ENTITLEMENT_REQUIRED`、Safe Error(502)→`AI_PROVIDER_ERROR`/`AI_OUTPUT_INVALID`（EXISTING，逐步归一到上表）。

## 5. 认证契约
| 机制 | 说明 | 状态 |
|---|---|---|
| Web Cookie Session | HMAC 签名 cookie，含 `sessionVersion` | EXISTING |
| App Bearer Access Token | 短时效，SecureStore | PLANNED |
| Refresh Session | 可撤销、轮换、**重放检测** | PLANNED |
| `sessionVersion` | 全局吊销（bump 使旧令牌/cookie 失效） | EXISTING |
| 邮箱验证 | 令牌 + Deep Link | EXISTING(链接)/PLANNED(Deep Link) |
| 单设备退出 / 全部设备退出 | logout / logout-all(`sessionVersion+=1`) | EXISTING(全局)/PLANNED(端点) |
| Token Refresh / 轮换 / 重放检测 | 一次性 refresh 旋转 | PLANNED |
| CSRF / CORS / SameSite / Secure Cookie | Web cookie 安全；App 用 Bearer 免 CSRF | EXISTING(部分)/PLANNED |
| 请求设备标识 | 设备/会话 Header | PLANNED |

## 6. API 资源（PLANNED；本轮只规划）

> 每接口：用途 · 请求 Schema · 响应 Schema · 认证 · Consent · Entitlement · `userId/familyMemberId` 隔离 · 限流 · 幂等 · 错误码 · 审计。下表列核心项（完整 Zod schema 在实现分支 `feature/shared-api-contract` 定义）。

```text
POST /api/v1/auth/register        # 注册→pending，触发验证邮件；幂等(email)；错误 AUTH_*
POST /api/v1/auth/login           # 签发 Access+Refresh
POST /api/v1/auth/refresh         # 轮换 refresh，重放检测；TOKEN_EXPIRED
POST /api/v1/auth/logout          # 单设备
POST /api/v1/auth/logout-all      # sessionVersion+=1
GET  /api/v1/me                   # 当前用户；AUTH_REQUIRED

GET  /api/v1/consent/ai           # 读 consent(status/consentVersion/providerScope)
POST /api/v1/consent/ai           # accept
DELETE /api/v1/consent/ai         # revoke

POST /api/v1/conversations        # 建会话；Consent 需
GET  /api/v1/conversations        # 列表(仅本人)
GET  /api/v1/conversations/:id    # 隔离(userId)；RESOURCE_NOT_FOUND/ACCESS_DENIED
POST /api/v1/conversations/:id/messages  # 发消息；幂等(clientMsgId)；Consent 需
POST /api/v1/conversations/:id/cancel    # 取消 run

POST /api/v1/assessments          # 评估；active+Consent 需
GET  /api/v1/reports              # 报告列表(仅本人)
GET  /api/v1/reports/:id          # IDOR 安全({id,userId})
POST /api/v1/reports/:id/premium-unlock  # Premium；ENTITLEMENT_REQUIRED/402

GET  /api/v1/entitlements         # 权益(后端唯一真相)
GET  /api/v1/products             # 真实 Product；locale/availability
GET  /api/v1/health-profile       # 健康档案(userId/familyMemberId)
PATCH /api/v1/health-profile      # 更新档案
```
每接口审计仅记 allowlist（provider/model/endpoint/status/code/requestId/stage/retryable），**不记健康原文/令牌**。

## 7. Shared Packages（PLANNED）
```text
packages/api-client · packages/shared-types · packages/shared-schemas · packages/i18n
```
- **可共享**：API DTO 类型、请求/响应 Zod schema、错误码枚举、i18n key。
- **不得暴露**：服务端内部类型、**Prisma 模型类型不得直接泄露到 App**。
- **Zod 共享边界**：仅共享"API 边界 schema"，不共享数据库/内部 schema。
- **DTO 与数据库模型必须分离**：API DTO ≠ Prisma model（防止内部字段外泄）。

## 8. 数据隔离
所有资源读取必须包含：当前认证用户 · `userId` · 可选 `familyMemberId` · 资源所有权 · Entitlement 状态。
**IDOR 测试（必列）**：
- 用户 A 读用户 B 的 `reports/:id` → 404/`ACCESS_DENIED`。
- A 读 B 的 `conversations/:id` / messages → 拒绝。
- 无权益读 Premium → 402。
- 家庭成员：A 读非本家庭 `familyMemberId` 资源 → 拒绝。
- 直接猜测自增/可枚举 id → 一律经 `{id, userId}` 过滤。

## 9. 幂等与重复请求
至少覆盖：注册 · 邮箱验证 · AI 消息发送(clientMsgId) · Report 生成(userId+assessmentId+type) · Checkout 创建 · Payment webhook(sessionId/paymentIntentId) · Entitlement 创建(paymentId+productId) · Refund · AgentRun 重试(runKey)。（EXISTING 幂等：Report/Entitlement/Webhook；PLANNED：消息/AgentRun。）

## 10. 兼容性与迁移策略
- 现有 Web API **保持运行**。
- 新 App 使用 `/api/v1/`。
- 逐步将 Web 迁移到共享 API Client。
- **不在一次 PR 中重写全部 API**。
- 高风险接口（Auth/Stripe/Entitlement/Consent/AIReport）**单独迁移 + Codex 审**。
- 旧接口弃用需**监控 + 明确期限**。
