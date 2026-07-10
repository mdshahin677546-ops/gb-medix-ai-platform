# FINAL_PRODUCTION_ACCEPTANCE_REPORT — GB Medix AI 2.0

日期：2026-07-10　|　执行者：Claude Code（Lead Developer，本机本地环境）　|　结论：**FINAL_PRODUCTION_ACCEPTANCE_BLOCKED**

---

## 0. 能力边界（为什么 P0 无法由 Claude Code 关闭）

本次 P0 修复的两项（生产 migrations、Vercel Production 环境变量）**本质上是生产平台运维动作**，需要以下访问权限与凭据，而当前 Claude Code 运行环境**均不具备**：

| 需要 | 现状（已核实） |
|---|---|
| Vercel CLI / 已认证会话 | ❌ 无 Vercel CLI、未认证 → 无法查看/补齐 Production 环境变量、无法触发 redeploy |
| 生产 Neon `DATABASE_URL` | ❌ 本地 `DATABASE_URL` 指向 `127.0.0.1/gbmedix_test`（本地测试库，非生产 Neon）；本地无任何生产 Neon 连接串 |
| 生产密钥（DeepSeek/Stripe/Resend） | ❌ 本地 `.env` 中 `DEEPSEEK_API_KEY`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`RESEND_API_KEY` 均为空 |
| 第三方 AI 启用的书面批准 | ⚠️ 未在本任务中附带；CLAUDE.md 硬约束要求负责人书面放行后方可切 `AI_PROVIDER=deepseek` |

**原则遵守**：未打印/记录/提交任何密钥；未执行 `prisma migrate reset`；未对本地测试库冒充生产库执行迁移；未删除任何数据。

---

## 1. 环境变量完整性（Phase 1）

**状态：无法验证（owner-side）。** 无 Vercel 访问权，无法读取 Production 环境变量的存在性。以下为**需负责人在 Vercel Production 逐项确认"存在且非空"**（不回显值）：

| 变量 | 要求 | Claude Code 可验证? |
|---|---|---|
| `AUTH_SECRET` | 强随机；缺失或 `dev-only-change-me` → 应用拒绝运行 | ❌ owner-side |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 同属一个 Test 或 Live 环境；正式放量须 Live，受控 staging 可 Test | ❌ owner-side |
| `EMAIL_PROVIDER=resend` / `RESEND_API_KEY` / `EMAIL_FROM` | `EMAIL_FROM` 必须属 Resend 已验证域名 | ❌ owner-side |
| `NEXT_PUBLIC_APP_URL=https://ai.gbmedix.com` | 生产域名 | ❌ owner-side |
| `TRUST_PROXY_HEADERS=true` | 可信代理后 | ❌ owner-side |
| `AI_PROVIDER=deepseek` | 需书面批准 | ❌ owner-side + 批准门禁 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL=https://api.deepseek.com` / `DEEPSEEK_MODEL=deepseek-chat` | 真实值 | ❌ owner-side |
| `OPENAI_API_KEY` | 若 `AI_PROVIDER=deepseek` 则非阻断项 | n/a |

---

## 2. Production Migration 状态（Phase 2）

**状态：无法验证（owner-side）。** 无生产 Neon 连接串，不能对生产库执行 `migrate status/deploy`。**不会**对本地测试库执行并冒充生产结果。

**代码/仓库侧已确认（可供平台执行时对照）：** 三个必需迁移文件均在仓库、且此前已在本地测试库成功 `migrate deploy`：
- ✅ `20260709120000_ai_provider_usage_provider`（`AIUsage.provider`）
- ✅ `20260709130000_ai_processing_consent`（`AIProcessingConsent` 表）
- ✅ `20260710120000_add_user_session_version`（`User.sessionVersion`）

**待负责人在生产执行**（DATABASE_URL 指向生产 Neon，勿输出完整串）：
```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```
禁止：`prisma migrate reset` / `prisma db push` / 删除或重建生产库。

---

## 3. Vercel Deployment Commit（Phase 3）

**状态：无法验证（owner-side）。** 无 Vercel 访问权，无法确认当前 Production 部署 commit，也无法触发 redeploy。

- 目标：部署 commit = 当前 `origin/main`（`1f21e00`，含 DeepSeek 切换检查表）或更新版本，状态 Ready。
- 外部可访问性（此前 WebFetch 已确认，非部署 commit 证据）：`https://ai.gbmedix.com` 首页、`/zh|/en/third-party-ai-privacy` 均返回可访问内容。

---

## 4. Resend 邮箱验证（Phase 4 步骤 1–4）

**状态：无法验证（owner-side）。** 需真实 `RESEND_API_KEY` + 已验证域名 + 生产环境，本机不具备，无法触发/接收真实验证邮件、无法观测用户 `pending→active`。

**代码侧已确认**：`verify-email` 流程置 `status=active` 并签发会话（本地测试通过）。

---

## 5. DeepSeek Consent 403 / 放行 / 撤回（Phase 4 步骤 5–7、17–18）

**状态：生产未验证（owner-side）。** 需生产 DeepSeek 已启用 + 真实用户流程。

**代码侧已确认**（本地/静态）：
- 第三方 provider 前置 `ensureAIConsentForProvider(...)`；未同意时返回 `403` + `error: "AI_CONSENT_REQUIRED"`（见 `app/api/assistant/route.ts`、`app/api/consult/route.ts`；`tcm`/`reports/generate` 亦有 403 门禁）。
- 撤回同意后再次调用应复现 403（逻辑对称，本地已由 `ai-consent-gate` 测试覆盖）。

生产实测（403 → 同意放行 → 撤回再 403）**待平台在启用 DeepSeek 后执行**。

---

## 6. AIUsage.provider 结果（Phase 4 步骤 10–11）

**状态：生产未验证（owner-side）。**

**代码侧已确认**：`lib/ai-security.ts` 的 `recordAIUsage` 写入 `provider` 与 `model` 字段。生产切 DeepSeek 后，实际 `AIUsage.provider=deepseek` 与 `AIUsage.model` 一致性**需在生产库查询确认**（本机无生产库访问权）。

---

## 7. Stripe 支付与退款撤权（Phase 4 步骤 12–16）

**状态：生产未验证（owner-side）。** 需生产/受控 Stripe 环境与真实事件投递。

**已有等价证据（此前会话，非生产）**：本地真实 Stripe **测试模式**已端到端跑通托管支付 → `checkout.session.completed` 授予 `Entitlement=active` → 退款 `charge.refunded` 撤销 `Entitlement=revoked`（见 `STRIPE_LIVE_HOSTED_FLOW_REPORT.md`）。Premium 仍强制经 `checkEntitlement`（代码约束未变）。生产/受控 staging 实测**待执行**。

---

## 8. 测试数据清理（Phase 4 步骤 19）

**状态：不适用（未执行生产 smoke test）。** 未在生产创建任何测试数据，故无需清理；正式用户数据未触碰。

---

## 9. 回退验证（Phase 5）

**状态：路径已文档化，生产可操作性待 owner 确认。** 回退方案：将 `AI_PROVIDER` 恢复为原 Provider（openai）→ redeploy → 不改数据库历史、不删 consent/AIUsage 记录。runbook `§4.5` + `§8` + DeepSeek 检查表已含。**仅验证步骤可执行，不在 smoke 成功后擅自回退**——本次未触发切换，无需回退。

---

## 10. 是否可以开放小流量

**否 —— FINAL_PRODUCTION_ACCEPTANCE_BLOCKED。**

两个 P0 属生产平台侧，Claude Code 本机环境无法关闭：
- **P0-1 生产 migrations**：需负责人用生产 Neon `DATABASE_URL` 执行 `migrate deploy` 并回报 `migrate status`。
- **P0-2 Vercel Production 环境变量**：需负责人补齐并回报每项"存在且非空"。

附加前置：**负责人书面批准启用第三方 AI Provider**（DeepSeek）。

### 解锁路径（按角色）
1. **平台负责人**（Vercel/Neon 权限）：
   - 逐项配置并确认第 1 节环境变量（只回报状态）。
   - 生产执行第 2 节迁移三连并回报 `migrate status`。
   - redeploy 至 `1f21e00`+ 并确认 Ready、首页/隐私页 200。
2. **负责人/ChatGPT**：书面批准 DeepSeek 启用。
3. 上述完成后 → 由 Claude Code 依据本报告 Phase 4 执行受控生产 smoke test（若届时提供受控执行通道/凭据），或指导平台执行并核对结果。

---

*约束遵守：未开发新功能 · 未进入 Sprint 2 · 未打印/记录/提交任何密钥 · 未执行 migrate reset · 未删除生产数据 · 未擅自切换 DeepSeek。*
