# GB MEDIX AI — Mobile App Implementation Plan

分支：`feature/mobile-app-foundation`　|　日期：2026-07-10　|　状态：规划（PLANNED；不改业务代码 / Schema / API / 支付 / 配置）

> 品牌统一 **GB MEDIX AI**。App **不另建后端**，复用现有 GB MEDIX AI API 与生产数据库。
>
> **Status legend**：`EXISTING_CODE`（可由当前仓库代码验证）· `PLANNED`（尚未实现的设计）· `BLOCKED`（前置满足前不得实施）· `REQUIRES_DECISION`（需产品/法律/平台/架构决定）· `UNVERIFIED_PRODUCTION_CONFIGURATION`（据运行记录存在，但无法仅通过仓库验证）。

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

**GB MEDIX AI 独立品牌与交互语言**：中医体质 + 现代生活方式双轨解读；全球多语言（中/英起步）；Premium 个性化报告与 Web/App 权益同步；健康商品与供应链能力；**非诊断、非处方**语气；自有视觉系统（暗色 token、排版系统，独立于任何参考产品）。

---

## 3. 技术架构

技术：React Native · Expo · TypeScript · Expo Router · EAS Build · Expo SecureStore。iOS + Android。

### Monorepo 现状确认（EXISTING_CODE）
**当前项目不是 monorepo**：单一 Next.js 应用，无 `packages/`、无 workspaces、无 `apps/`。迁移方案（本轮**不移动代码**）：

建议目录（PLANNED）：
```text
apps/mobile/ · packages/api-client/ · packages/shared-types/ · packages/shared-schemas/ · packages/i18n/
```

**迁移选项（REQUIRES_DECISION）**：① 渐进 monorepo（现有 Next.js 移入 `apps/web`，抽取 `packages/shared-*`；改构建/部署路径，需同步 Vercel 根目录）；② 暂缓（`apps/mobile` 先独立子目录，后续收敛）。首个 PR 只**新增** mobile 目录、不移动 `app/`/`lib/`；monorepo 收敛作独立可回滚 PR。**本轮不移动任何代码。**

---

## 4. V1 导航（底部）
```text
首页 · AI 健康 · 健康档案 · 我的
```

## 5. V1 页面

> 每页：目的 · 主要组件 · API · 认证 · Consent · Entitlement · 空/错误/加载 · 埋点 · 验收。API 引用 `SHARED_WEB_MOBILE_API_CONTRACT.md`（`/api/v1/*`，PLANNED）。

| 页面 | 目的 | API | 认证 | Consent | Entitlement | 状态/错误 | 埋点 | 验收 |
|---|---|---|---|---|---|---|---|---|
| 启动页 | 恢复会话 | refresh 校验 | Token | — | — | 加载/失败重试 | app_open | 有效直入，无效去登录 |
| 注册 | 邮箱注册 | `POST /auth/register` | 无 | — | — | 校验错误 | signup_* | 建 pending + 验证邮件 |
| 邮箱验证 | 完成 active | verify-email + `/me` | 无→Token | — | — | 未验证提示 | email_verified | Deep Link 唤起 active |
| 登录 | 邮箱登录 | `POST /auth/login` | 无 | — | — | 认证失败 | login | 签发 Access+Refresh |
| Consent | 采集同意 | `POST /consent/ai` | Token | 采集 | — | 拒绝态 | consent_accept | 同意后可用 AI |
| 对话式首页 | 主动陪伴 | conversations+`/me` | Token | 需 | — | 空会话引导 | home_view | 每次仅追问一个核心问题 |
| AI 智能健康问诊 | 多轮问诊 | conversations/messages | Token | 需 | — | provider 安全态 | consult_* | Web 起可续 |
| 健康评估 | 结构化评估 | `POST /assessments` | Token+active | 需 | — | 草稿/错误 | assessment_* | 与 Web 同结果 |
| Free Report | 免费结果 | `GET /reports/:id` | Token | — | — | 生成中/失败 | free_report_view | 脱敏 Premium |
| Premium Report | 付费报告 | `GET /reports/:id` | Token | — | 需(402) | 未解锁引导 | report_unlocked | 无权益 402、IDOR 安全 |
| 报告历史 | 列表 | `GET /reports` | Token | — | — | 空态 | report_history | 仅本人 |
| 用户中心 | 账户/退出 | `/me`+logout(-all) | Token | — | — | — | profile_view | 单/全设备退出 |
| Entitlement 状态 | 权益展示 | `GET /entitlements` | Token | — | 展示 | 空权益态 | entitlement_view | 后端唯一真相 |
| 中英文切换 | 语言 | locale | 任意 | — | — | — | locale_switch | 与后端 locale 一致 |

通用：Consent 未过不进 AI；Premium 必经 Entitlement；错误按统一错误码渲染安全文案。

---

## 6. MANDATORY MOBILE AUTH SECURITY BASELINE（阻断开发）

> **BLOCKED**：在以下安全基线形成正式设计记录并经 **Codex 审核通过**前，**不得实施**移动端登录、Token 签发、Refresh、设备 Session 或退出功能。本节仅规划，不改 Prisma Schema。

### 6.1 DeviceSession 服务端模型边界（PLANNED，未来独立高风险 migration PR）
规划字段语义（**当前不存在于 Schema，不得宣称已存在**）：
```text
id · userId · sessionVersionAtIssue · deviceIdHash · refreshTokenHash
refreshTokenFamilyId · tokenVersion · platform · appVersion
createdAt · lastUsedAt · expiresAt · revokedAt · revokedReason
replacedBySessionId · ipRiskMetadata(仅风险级别/去敏,不存完整 IP) · userAgentSummary(去敏)
```
要求：Refresh Token 原文**绝不入库**；仅存**强哈希**（推荐带服务端 pepper 的 HMAC-SHA-256 或经安全评估的等效方案）；`deviceId` 只存**服务端去敏哈希**，不存原始永久硬件标识；Schema 变更走**独立高风险 PR**。

### 6.2 Access Token 规则
```text
Token type: signed access token
Issuer: GB MEDIX AI backend
Audience: GB MEDIX AI mobile API
Recommended TTL: 10 minutes
Maximum planned TTL without renewed security review: 15 minutes
Claims: sub · sid · sv · iss · aud · iat · exp · jti
```
`sub`=用户标识 · `sid`=设备 Session 标识 · `sv`=签发时 sessionVersion · `jti`=唯一 Token 标识 · `iss`/`aud`=固定签发者/移动 API audience。
**验证必查**：签名 · issuer · audience · expiration · DeviceSession 未撤销 · `User.sessionVersion == sv` · 邮箱验证状态 · 账号状态。
**Token 不得含**：健康数据 · email · Consent 内容 · Payment 信息 · Entitlement 详情 · Provider 信息。

### 6.3 Refresh Token 规则
高熵随机不可预测 Token；**仅存客户端 SecureStore**，服务端**只存哈希**；每次成功 Refresh **单次轮换**，旧 Token 成功使用后**立即失效**；新旧同属一个 **token family**；推荐有效期 **30 天**；长期在线用**滑动过期**但不无限续期；定义**最大绝对 Session 生命周期（例如 90 天）**；敏感账号行为可主动缩短/撤销 Session。

### 6.4 Refresh Replay Detection
已使用/已撤销的旧 Refresh Token 再次出现时：① 识别 token family；② 撤销该 family 下所有未撤销 Session/Token；③ 要求该设备重新登录；④ 记录**去敏安全事件**；⑤ **不把** Refresh Token / Authorization Header / 原始请求体写入日志；⑥ 按风险策略决定是否吊销用户全部设备，而非默认静默接受。

### 6.5 Concurrent Refresh 语义
采用：**单次轮换 + 短暂 grace window（5–10 秒）+ 原子数据库事务**。要求：Refresh 经数据库事务/等效原子机制；同一旧 Token 只允许一个请求完成正式轮换；grace window 不让旧 Token 长期重复有效；返回新 Token 唯一；不因并发产生多个长期有效 Refresh Token；不把正常移动端并发误判为永久入侵；**实现前必须有并发测试**。若不采用 grace window，须给出另一种安全且可测试的具体方案（不得模糊）。

### 6.6 Logout 与撤销
- **单设备退出**：服务端将当前 DeviceSession 标记 revoked；客户端清 SecureStore；**仅清客户端不算完成退出**。
- **全部设备退出**：`User.sessionVersion += 1`；撤销所有 DeviceSession；当前及历史 Access Token 因 `sv` 不匹配失效；**Web Session 既有兼容行为须单独验证**。
- **密码/高风险账号事件**：bump sessionVersion + 撤销所有 Refresh Session + 要求重新登录。

### 6.7 SecureStore 与客户端安全
Access/Refresh Token **只入 SecureStore**；禁止 AsyncStorage；禁止 Redux/Zustand 持久化 Token；禁止写 crash log / analytics / 调试 UI / 剪贴板；禁止 Authorization Header 日志；切后台不把 Token 暴露在屏幕快照；Root/Jailbreak 检测仅作风险信号，**不作唯一安全边界**。

### 6.8 Deep Link 邮箱验证
Deep Link **不携带**长期 Access/Refresh Token；只携带**单次、短期、可消费**的邮箱验证凭证；凭证必须过期、成功后立即失效、重复消费返回安全状态；**URL 不暴露** email 或健康信息；防止恶意 App 抢占 Scheme；优先 **Universal Links / Android App Links**（需域名关联文件 + 回退 Web 页）。

### 6.9 Auth 日志 Allowlist
允许：`requestId · endpoint · HTTP status · safe error code · session state transition · token family event type · timestamp · appVersion · platform`。
禁止：`Authorization Header · Access Token · Refresh Token · Token hash · Cookie · email · 健康数据 · 完整 deviceId · 完整 IP · 请求体 · 响应体`。

### 6.10 强制门禁
```text
BLOCKED:
移动端 Auth 编码必须等待：
1. DeviceSession 设计审查
2. Token claim 与 TTL 审查
3. Refresh rotation/replay 设计审查
4. Prisma migration 独立审查
5. Codex PASS
```

---

## 7. App API 层
统一前缀 `/api/v1/`。API Client 规划：Base URL · Authorization Header(Bearer) · Refresh 流程(401/TOKEN_EXPIRED 自动 refresh 重试一次) · 超时 · 重试(幂等 GET/明确幂等键) · 幂等(写请求带 `Idempotency-Key`) · 错误映射(统一码→本地文案) · 网络离线处理 · 日志脱敏(不记健康/令牌) · App 版本 Header · 设备 Session Header。

---

## 8. 支付策略 + EntitlementSource（分析，V1 不落地）

必须区分：Web Stripe Checkout · iOS IAP · Google Play Billing · 实体健康商品 · 数字报告 · 订阅 · **Web 已购权益在 App 展示**。

| 路径 | 规划 | 状态 |
|---|---|---|
| Web 数字内容（Premium/订阅） Stripe Checkout | 代码已具备 | EXISTING_CODE（生产实际运营为 UNVERIFIED_PRODUCTION_CONFIGURATION） |
| App 内数字内容（iOS） | 大概率须走 IAP | REQUIRES_DECISION |
| App 内数字内容（Android） | 大概率须走 Play Billing | REQUIRES_DECISION |
| 实体健康商品/供应链 | Stripe 可用 | PLANNED |
| App 展示 Web 已购权益 | 读后端 Entitlement，不在 App 内发起数字付款 | PLANNED（V1 仅展示） |

**不得假设** Apple/Google 允许 App 内引导外部支付；需法律 + 商店政策确认。V1：App **不内置数字内容购买入口**，仅同步展示 Web 已购权益。

### EntitlementSource（PLANNED 枚举，不得声称已存在）
候选来源：`stripe · apple · google · admin · promotion`。**支付事实 ≠ 权益事实；客户端购买成功提示 ≠ 服务端权益已激活；Consent ≠ Entitlement。** 客户端 receipt / Purchase Token 仅作**待验证输入**，未经**服务端验证**不得激活 Entitlement。统一字段/状态与各来源映射详见 `SHARED_WEB_MOBILE_API_CONTRACT.md` §Entitlement。

---

## 9. V2 范围
Push Notification · 健康日记 · 健康目标 · 家庭成员 · 拍照报告解读 · 7 天计划 · 产品推荐 · **App 内支付**（政策确认后）。

---

## 10. 测试计划
iOS · Android · Token 过期 · Refresh 轮换 · **并发 Refresh** · **Replay 检测** · `sessionVersion` 吊销 · Consent 撤回 · Premium 402 · 网络断开 · 请求重放 · Deep Link · 多语言 · 无障碍 · 弱网 · Provider 失败 · 非法 AI 输出 · 报告 IDOR。PASS/FAIL 例：Consent 撤回后 AI 必 `AI_CONSENT_REQUIRED`；无权益访问 Premium 必 402；跨用户报告 id 必 404/`ACCESS_DENIED`；重放旧 Refresh Token 必触发 family 撤销 + 重新登录。

---

## 11. 安全要求（硬约束）
Token 仅 SecureStore（禁 AsyncStorage）· 禁 App 直调 Provider · Consent 不得绕过 · Premium 不得绕过 Entitlement · 家庭成员按 `userId/familyMemberId` 隔离 · 图片上传脱敏并获授权。
