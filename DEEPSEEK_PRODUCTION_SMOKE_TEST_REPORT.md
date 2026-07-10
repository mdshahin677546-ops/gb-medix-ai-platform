# DEEPSEEK_PRODUCTION_SMOKE_TEST_REPORT — GB Medix AI 2.0

日期：2026-07-10　|　执行者：Claude Code（本机本地环境）　|　目标：`https://ai.gbmedix.com`　|　部署 commit（声明）：`5fb35acfc021758dd1c657808bd1274e32b6c497`　|　结论：**DEEPSEEK_PRODUCTION_SWITCH_BLOCKED**

---

## 0. 本轮（后半程）执行结论

平台侧声明的前置条件已通过（Resend 可达、测试用户已 `active`、Production Ready）。但**要由 Claude Code 实际执行步骤 1–10，我这一侧仍缺两个具体凭据/通道**，且本机环境无法自备：

| 需要（执行 smoke test 的具体前提） | 现状（本轮已复核） | 卡住的步骤 |
|---|---|---|
| **已验证测试用户在生产的认证会话**（session cookie 或可登录凭据） | ❌ 未提供；无邮箱读取权，我也无法自行登录该用户 | 1,3,4,6,7,8,11 —— 所有"以该用户身份调用生产 API"的步骤 |
| **生产 Neon 读/写访问** | ❌ 本地 `DATABASE_URL=127.0.0.1/gbmedix_test`，非生产 Neon | 5（查 `AIUsage`）、6/12（查 `Entitlement`）、10（清理测试数据） |
| DeepSeek 是否已在生产启用 | ⚠️ 无 Vercel 访问，无法确认 | 7,9 |

**我没有伪造任何生产观测**。凡"必须真实观测才能填写"的结果（如 `AIUsage.provider=deepseek`、`tokens>0`、403 复现、entitlement 状态），在无生产会话与无生产库访问的情况下**一律不填、不假设**。

**约束遵守**：未打印/保存任何密钥；未改业务代码；未进入 Sprint 2；未向生产写入无法清理的测试数据。

---

## 1. 逐项状态（步骤 1–10）

| # | 步骤 | 状态 | 说明 |
|---|---|---|---|
| 1 | 未同意时调用健康评估 → 403 `AI_CONSENT_REQUIRED` | ⛔ 无法执行 | 需以已验证用户身份对生产发起认证请求（无会话）。**代码侧已确认**门禁：`ensureAIConsentForProvider` → `403 AI_CONSENT_REQUIRED` |
| 2 | 主动接受第三方 AI consent | ⛔ 无法执行 | 需认证会话（`POST /api/ai-consent/accept`） |
| 3 | 再次完成 TCM 评估（DeepSeek 成功、结构化、无诊断/治疗/处方/概率/分诊措辞） | ⛔ 无法执行 | 需会话 + DeepSeek 已启用 |
| 4 | Free Report 生成 | ⛔ 无法执行 | 依赖 3 |
| 5 | 生产 Neon 查 `AIUsage`（provider=deepseek / model 一致 / endpoint 记录 / tokens>0） | ⛔ 无法执行 | 无生产 Neon 访问。**代码侧已确认** `recordAIUsage` 写 `provider`/`model` |
| 6 | Premium 权限：无 Entitlement → 402；consent 不替代 Entitlement | ⛔ 生产未验证 | **代码侧已确认**：`premium_health_report` 前必过 `checkEntitlement`，未过返回 402；consent 与 entitlement 独立 |
| 7 | 撤回 consent | ⛔ 无法执行 | 需会话（`POST /api/ai-consent/revoke`） |
| 8 | 再次调用 → 403 `AI_CONSENT_REQUIRED` | ⛔ 无法执行 | 依赖 7；逻辑对称，本地 `ai-consent-gate` 测试已覆盖 |
| 9 | 无回归（邮箱验证 / Report IDOR / Stripe / Payment / Entitlement） | ⛔ 生产未验证 | 本地/测试模式此前全绿（`AIReport` 按 `userId` 隔离、Stripe 授予/退款撤销） |
| 10 | 清理测试用户及关联数据（EmailVerification/AIProcessingConsent/AIUsage/AIReport/TCMRecord/AssistantSession/Payment/Entitlement），不删真实数据 | ⛔ 无法执行 | 无生产 Neon 访问；本轮也未创建生产数据 |

## 2. 只读探测（本轮，非破坏）

`GET /` → 200 · `/zh/third-party-ai-privacy` → 200 · `/en/third-party-ai-privacy` → 200 · `GET /api/session`（未认证）→ 200 `{"user":null}`。仅证明公开面在线，不能证明部署 commit 或 DeepSeek 已启用。

## 3. 解锁执行所需（平台侧提供其一）

1. **给我一个可用于该已验证测试用户的认证会话**（生产 `gbmedix_session` cookie 或等效登录凭据）**＋一个对生产 `AIUsage`/`Entitlement` 的只读查询入口**（临时只读凭据，或管理员 `/api/admin/ai-usage` 的受控访问）**＋清理入口**；或
2. 平台**自行执行**步骤 1–10，把每步真实结果回报，我负责核对判定；或
3. 一个 **DeepSeek 已启用、可自由建/删数据的受控 staging**，我全流程执行。

## 4. 判定

**DEEPSEEK_PRODUCTION_SWITCH_BLOCKED** —— smoke test 后半程未能由 Claude Code 执行（缺生产认证会话与生产 Neon 访问）。未伪造结果、未打印密钥、未改业务代码、未向生产写入不可清理数据。
