# GB MEDIX AI — Mobile App Implementation Plan

分支：`feature/mobile-app-foundation`　|　日期：2026-07-10　|　状态：规划（PLANNED；不改业务代码 / Schema / API / 支付 / 配置）

> 品牌统一 **GB MEDIX AI**。App **不另建后端**，复用现有 GB MEDIX AI API 与生产数据库。标签：EXISTING / PLANNED / BLOCKED / REQUIRES_DECISION。

---

## 1. 产品目标
- 更自然的健康对话体验（对话式首页）
- 健康状态持续跟踪
- 报告历史
- 主动陪伴
- 健康目标
- 复访与提醒
- **Web/App 统一账号与权益**（同一 `userId`、同一 Entitlement）

---

## 2. Ant A-Fu Reference Benchmark
将"蚂蚁阿福"作为**产品逻辑参考**。

**允许参考的产品逻辑**：对话式首页 · 健康状态卡片 · 健康小目标 · 主动陪伴 · 家庭健康档案 · 报告拍照解读 · 每次只追问一个核心问题。

**禁止复制**：品牌名 · Logo · 角色形象 · 图标 · 页面布局原稿 · 文案 · 配色 · 插画 · 视觉资产。

**GB MEDIX AI 独立品牌与交互语言**：中医体质 + 现代生活方式的双轨解读；全球多语言（中/英起步）；Premium 个性化报告与 Web/App 权益同步；健康商品与供应链能力；**非诊断、非处方**的健康管理语气；自有视觉系统（暗色 token、排版系统，独立于任何参考产品）。

---

## 3. 技术架构

技术：React Native · Expo · TypeScript · Expo Router · EAS Build · Expo SecureStore。iOS + Android。

### Monorepo 现状确认（EXISTING）
**当前项目不是 monorepo**：单一 Next.js 应用，无 `packages/`、无 workspaces、无 `apps/` 结构。因此需要迁移方案（本轮**不移动代码**）：

建议目录（PLANNED）：
```text
apps/mobile/          # Expo 应用
packages/api-client/  # 统一 API 客户端
packages/shared-types/# 跨端类型
packages/shared-schemas/# 跨端 Zod schema
packages/i18n/        # 多语言
```

**迁移方案选项（REQUIRES_DECISION）**：
1. **渐进 monorepo（推荐）**：引入 workspaces，把现有 Next.js 应用移入 `apps/web`，抽取 `packages/shared-*`。风险：改动构建/部署路径，需同步 Vercel 根目录配置。
2. **暂缓 monorepo**：`apps/mobile` 先作为**独立子目录**（不改现有 Next.js 结构），通过发布/复制共享类型，后续再收敛为 workspaces。风险：类型/契约短期重复。

**不影响现有 Next.js 生产部署的方法**：无论哪种，**首个 PR 只新增 mobile 相关目录，不移动现有 `app/`/`lib/`**；Vercel 部署根目录保持指向现有 Next.js 应用；monorepo 收敛作为**单独、可回滚**的迁移 PR，独立评审。**本轮不移动任何代码。**

---

## 4. V1 导航（底部）
```text
首页 · AI 健康 · 健康档案 · 我的
```

## 5. V1 页面

> 每页字段：目的 · 主要组件 · API 依赖 · 认证 · Consent · Entitlement · 空/错误/加载态 · 埋点 · 验收。API 依赖引用 `SHARED_WEB_MOBILE_API_CONTRACT.md`（`/api/v1/*`，全部 PLANNED）。

| 页面 | 目的 | 主要组件 | API | 认证 | Consent | Entitlement | 空/错误/加载 | 埋点 | 验收 |
|---|---|---|---|---|---|---|---|---|---|
| 启动页 | 初始化/恢复会话 | Splash | 令牌校验 refresh | Token | — | — | 加载/失败重试 | app_open | 令牌有效直入，无效去登录 |
| 注册 | 邮箱注册 | 表单 | `POST /auth/register` | 无 | — | — | 校验错误 | signup_start/complete | 创建 pending 用户，触发验证邮件 |
| 邮箱验证 | 完成 active | 提示+轮询/Deep Link | verify-email + `/me` | 无→Token | — | — | 未验证提示 | email_verified | Deep Link 唤起完成 active |
| 登录 | 邮箱登录 | 表单 | `POST /auth/login` | 无 | — | — | 认证失败 | login | 签发 Access+Refresh |
| 第三方 AI Consent | 采集同意 | 说明+勾选 | `POST /consent/ai` | Token | 采集 | — | 拒绝态 | consent_accept | 同意后可用 AI |
| 对话式首页 | 主动陪伴/单核问题 | 对话卡+状态卡 | conversations + `/me` | Token | 需 | — | 空会话引导 | home_view | 每次仅追问一个核心问题 |
| AI 智能健康问诊 | 多轮问诊 | 会话流 | conversations/messages | Token | 需(AI_CONSENT_REQUIRED) | — | provider 失败安全态 | consult_* | Web 起可在此续 |
| 健康评估 | 结构化评估 | 问卷 | `POST /assessments` | Token+active | 需 | — | 草稿/提交错误 | assessment_start/complete | 与 Web 同结果 |
| Free Report | 免费结果 | 报告卡 | `GET /reports/:id` | Token | — | — | 生成中/失败 | free_report_view | 脱敏 Premium 字段 |
| Premium Report | 付费报告 | 报告全文 | `GET /reports/:id` | Token | — | 需(ENTITLEMENT_REQUIRED/402) | 未解锁引导 | report_unlocked | 无权益 402、IDOR 安全 |
| 报告历史 | 列表 | 列表 | `GET /reports` | Token | — | — | 空态 | report_history | 仅本人报告 |
| 用户中心 | 账户/退出 | 设置 | `/me` + logout(-all) | Token | — | — | — | profile_view | 单/全设备退出可用 |
| Entitlement 状态 | 权益展示 | 权益卡 | `GET /entitlements` | Token | — | 展示 | 空权益态 | entitlement_view | 以后端为唯一真相 |
| 中英文切换 | 语言 | 切换 | locale | 任意 | — | — | — | locale_switch | 文案与后端 locale 一致 |

页面通用：Consent 未过不进 AI；Premium 必经 Entitlement；错误按统一错误码渲染安全文案。

---

## 6. 移动端认证（复用 `User.sessionVersion`）
- **不直接复用 Web Cookie。**
- 短期 **Access Token** + 可撤销 **Refresh Session**。
- Token **仅存 SecureStore**，**禁止 AsyncStorage**。
- **Refresh Token 轮换**；**Refresh 重放必须检测**（一次性/旋转失效）。
- 设备级 Session；复用 **`User.sessionVersion`** 做全局吊销（EXISTING 机制）。
- 单设备退出 / **退出所有设备**（`sessionVersion += 1`）。
- 邮箱验证 **Deep Link**。
- Token 泄露后可撤销（bump sessionVersion）。

> 需要的数据库/API 规划见共享契约；**本轮不改 Prisma Schema**（Refresh/设备会话是否需要新表属 REQUIRES_DECISION + 单独 migration 评审）。

---

## 7. App API 层
统一前缀 `/api/v1/`。API Client 规划：
- **Base URL** · **Authorization Header**（Bearer）· **Refresh 流程**（401/TOKEN_EXPIRED 自动 refresh 重试一次）· **超时** · **重试**（幂等 GET/明确幂等键）· **幂等**（写请求带 `Idempotency-Key`）· **错误映射**（统一错误码→本地文案）· **网络离线处理**（队列/提示）· **日志脱敏**（不记健康/令牌）· **App 版本 Header** · **设备 Session Header**。

---

## 8. 支付策略（分析，V1 不落地）
必须区分：Web Stripe Checkout · iOS App Store IAP · Google Play Billing · 实体健康商品 · 数字报告 · 订阅 · **Web 已购权益在 App 展示**。

| 路径 | 规划 | 状态 |
|---|---|---|
| Web 数字内容（Premium/订阅） | Stripe Checkout（现状） | EXISTING |
| App 内数字内容（iOS） | 大概率须走 IAP | REQUIRES_DECISION |
| App 内数字内容（Android） | 大概率须走 Play Billing | REQUIRES_DECISION |
| 实体健康商品/供应链 | Stripe 可用 | PLANNED |
| App 展示 Web 已购权益 | 读后端 Entitlement，不在 App 内发起数字付款 | PLANNED（V1 仅展示） |

**不得假设** Apple/Google 允许 App 内引导外部支付。**需进一步法律 + 商店政策确认**：数字内容是否强制 IAP/Billing、订阅规则、外链付款政策、Beta 阶段合规边界。V1：App **不内置数字内容购买入口**，仅同步展示 Web 已购权益。

---

## 9. V2 范围
Push Notification · 健康日记 · 健康目标 · 家庭成员 · 拍照报告解读 · 7 天计划 · 产品推荐 · **App 内支付**（在政策确认后）。

---

## 10. 测试计划
iOS · Android · Token 过期 · Refresh 轮换 · `sessionVersion` 吊销 · Consent 撤回 · Premium 402 · 网络断开 · 请求重放 · Deep Link · 多语言 · 无障碍 · 弱网 · Provider 失败 · 非法 AI 输出 · 报告 IDOR。每项定义 PASS/FAIL：如"Consent 撤回后 AI 调用必返回 `AI_CONSENT_REQUIRED`"、"无权益访问 Premium 必 402"、"跨用户报告 id 必 404/ACCESS_DENIED"。

---

## 11. 安全要求（硬约束）
Token 不入 AsyncStorage（仅 SecureStore）· 禁止 App 直调 Provider · Consent 不得绕过 · Premium 不得绕过 Entitlement · 家庭成员按 `userId/familyMemberId` 隔离 · 图片上传脱敏并获授权。
