# GB MEDIX AI — Shared Web / Mobile / Agent API Contract

分支：`feature/shared-api-contract`　|　日期：2026-07-10　|　状态：规划（PLANNED；不改现有 API / Schema / 支付 / 权限）

> 品牌 **GB MEDIX AI**。固定 Web/App/Agent 共用契约。**本轮只规划，不实现。**
>
> **Status legend**：`EXISTING_CODE`（仓库可验证）· `PLANNED` · `BLOCKED` · `REQUIRES_DECISION` · `UNVERIFIED_PRODUCTION_CONFIGURATION`。

---

## 1. 目标
Web、App、Agent 必须共用：账户 · 邮箱验证 · 健康档案 · `familyMemberId` · Consent · Conversation · Report · Entitlement · Product · AIUsage · AI Provider · PostgreSQL 后端。

## 2. 硬规则
1. 不建三套账户体系。2. App 不直接访问数据库。3. App/Web 不直接访问 DeepSeek/AIHubMix。4. Premium 统一由 Entitlement 控制。5. Consent 统一。6. 健康数据按 `userId/familyMemberId` 隔离。7. 公共 migration 独立审核。8. Stripe/Auth/Entitlement/Consent/AIReport 属高风险模块（Codex 审）。

## 3. API 版本
统一前缀 `/api/v1/`（PLANNED；现有路由在 `app/api/**` 无版本前缀，EXISTING_CODE）。
- 现有 API 兼容：保持 `app/api/**` 可用，不破坏生产。
- 渐进迁移：新增/移动端接口直接落 `/api/v1/`；现有 Web 路由通过适配层/别名逐步指向 v1。
- BFF：REQUIRES_DECISION（多数情况直连 `/api/v1/`，暂不引入）。
- Web 内部 Server Action：可继续用于 SSR 装配；**跨端公共能力**统一走 `/api/v1/`。
- 公共接口边界：App 与 Web 共享 `/api/v1/*`；Web 私有 SSR 逻辑不暴露给 App。
- 弃用策略：旧接口标注弃用期限 + 监控调用量，到期下线；高风险接口单独迁移。

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
**不得返回内部堆栈、上游原始错误或敏感数据。** 现有映射（EXISTING_CODE）：`AI_CONSENT_REQUIRED`(403)、Premium 402→`ENTITLEMENT_REQUIRED`、Safe Error(502)→`AI_PROVIDER_ERROR`/`AI_OUTPUT_INVALID`，逐步归一到上表。

## 5. 认证契约

> **移动端认证受强制安全基线约束（BLOCKED）**：DeviceSession 模型、Token claim、TTL、Refresh 轮换/重放/并发、退出与撤销等**完整设计见 `MOBILE_APP_IMPLEMENTATION_PLAN.md` §6 MANDATORY MOBILE AUTH SECURITY BASELINE**。在该基线经 Codex PASS 前，不得实施移动端 Auth 编码。

| 机制 | 说明 | 状态 |
|---|---|---|
| Web Cookie Session | HMAC 签名 cookie，含 `sessionVersion` | EXISTING_CODE |
| App Bearer Access Token | 短时效（推荐 10 分钟，最大 15 分钟）；claims `sub·sid·sv·iss·aud·iat·exp·jti`；SecureStore | PLANNED（BLOCKED 直至 Auth 基线 PASS） |
| Refresh Session | 高熵、仅存哈希、单次轮换、**重放检测**、并发单轮换+grace window | PLANNED（BLOCKED） |
| `sessionVersion` | 全局吊销（bump 使旧令牌/cookie 失效） | EXISTING_CODE |
| DeviceSession 模型 | 设备级会话、`refreshTokenHash`、`refreshTokenFamilyId`、撤销 | PLANNED（独立高风险 migration，不得声称已存在） |
| 邮箱验证 | 令牌 + Deep Link（单次短期凭证，不带长期 Token） | EXISTING_CODE(链接)/PLANNED(Deep Link) |
| 单设备退出 / 全部设备退出 | logout / logout-all(`sessionVersion+=1`+撤销所有 DeviceSession) | EXISTING_CODE(全局)/PLANNED(端点) |
| Token Refresh / 轮换 / 重放检测 | 一次性 refresh 旋转 + family 失效 | PLANNED（BLOCKED） |
| CSRF / CORS / SameSite / Secure Cookie | Web cookie 安全；App 用 Bearer 免 CSRF | EXISTING_CODE(部分)/PLANNED |
| 请求设备标识 | 设备/会话 Header（去敏） | PLANNED |

**验证 Access Token 必查**：签名 · issuer · audience · expiration · DeviceSession 未撤销 · `User.sessionVersion == sv` · 邮箱验证状态 · 账号状态。**Token 不得含**健康数据/email/Consent/Payment/Entitlement/Provider 信息。
**Auth 日志 allowlist**：`requestId · endpoint · HTTP status · safe error code · session state transition · token family event type · timestamp · appVersion · platform`；**禁止** Authorization Header / Access/Refresh Token / Token hash / Cookie / email / 健康数据 / 完整 deviceId / 完整 IP / 请求体 / 响应体。

## 6. API 资源（PLANNED）
```text
POST /api/v1/auth/register · login · refresh · logout · logout-all      # 见 §5 认证基线
GET  /api/v1/me
GET/POST/DELETE /api/v1/consent/ai                                       # status/consentVersion/providerScope
POST /api/v1/conversations · GET (list/:id) · POST :id/messages · :id/cancel   # Consent 需；幂等 clientMsgId
POST /api/v1/assessments                                                 # active+Consent
GET  /api/v1/reports · GET /reports/:id                                  # IDOR 安全 {id,userId}
POST /api/v1/reports/:id/premium-unlock                                  # ENTITLEMENT_REQUIRED/402
GET  /api/v1/entitlements                                                # 后端唯一真相；见 §7
GET  /api/v1/products                                                    # 真实 Product；locale/availability
GET/PATCH /api/v1/health-profile                                         # userId/familyMemberId
```
每接口：用途 · 请求/响应 Schema · 认证 · Consent · Entitlement · `userId/familyMemberId` 隔离 · 限流 · 幂等 · 错误码 · 审计（仅 allowlist）。完整 Zod schema 在实现分支定义。

## 7. Entitlement 契约 + EntitlementSource（PLANNED）

> **当前 `Entitlement` 未含 `source` 字段**；以下为规划枚举，不得声称已存在。App/Web **只读统一 Entitlement**，不直接读支付渠道结果作为最终权限。

- **EntitlementSource**：`stripe · apple · google · admin · promotion`。
- 统一字段（规划）：`source · sourceReferenceId · productCode · resourceType · resourceId · status · startsAt · expiresAt · revokedAt · revokeReason · cancelAtPeriodEnd · environment · verifiedAt`。
- 统一状态：`pending · active · expired · revoked · refunded · disputed · cancelled`。
- **服务端验证**：Apple/Google 的 receipt/Purchase Token 仅作**待验证输入**，未经服务端验证不激活；Stripe 由服务端或已验签 webhook 激活。
- **统一撤权**：`refund · dispute · revocation · subscription expiration · admin revoke · promotion expiration · fraud/security` 任一发生都更新统一 Entitlement。
- **原则**：支付事实 ≠ 权益事实；客户端购买成功提示 ≠ 服务端权益已激活；Consent ≠ Entitlement。
（生命周期细节与来源映射见 `PARALLEL_DEVELOPMENT_ROADMAP.md` §8。）

## 8. Shared Packages（PLANNED）
`packages/api-client · packages/shared-types · packages/shared-schemas · packages/i18n`。
- 可共享：API DTO 类型、边界 Zod schema、错误码枚举、i18n key。
- 不得暴露：服务端内部类型；**Prisma 模型类型不得直接泄露到 App**。
- **API DTO ≠ Prisma model**（防内部字段外泄）。

## 9. 数据隔离
资源读取必须含：当前认证用户 · `userId` · 可选 `familyMemberId` · 资源所有权 · Entitlement 状态。
**IDOR 测试**：A 读 B 的 `reports/:id` → 404/`ACCESS_DENIED`；A 读 B 的 `conversations/:id`/messages → 拒绝；无权益读 Premium → 402；A 读非本家庭 `familyMemberId` 资源 → 拒绝；可枚举 id 一律经 `{id,userId}` 过滤。

## 10. 幂等与重复请求
覆盖：注册 · 邮箱验证 · AI 消息(clientMsgId) · Report 生成(userId+assessmentId+type) · Checkout 创建 · Payment webhook(sessionId/paymentIntentId) · Entitlement 创建(paymentId+productId) · Refund · AgentRun 重试(runKey)。EXISTING_CODE：Report/Entitlement/Webhook；PLANNED：消息/AgentRun。

## 11. 兼容性与迁移策略
现有 Web API 保持运行 · 新 App 用 `/api/v1/` · 逐步迁移 Web 到共享 Client · **不在一次 PR 重写全部 API** · 高风险接口（Auth/Stripe/Entitlement/Consent/AIReport）单独迁移 + Codex 审 · 旧接口弃用需监控 + 明确期限。
