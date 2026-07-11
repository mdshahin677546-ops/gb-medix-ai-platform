# GB MEDIX AI — Mobile App Implementation Plan

分支：`feature/mobile-app-foundation`　|　日期：2026-07-10　|　状态：规划（不改业务代码 / Schema / API / 支付 / 配置）

> 品牌统一 **GB MEDIX AI**。App **不另建后端**，必须复用现有 GB MEDIX AI API 与生产数据库。

---

## 1. 技术方案

- **React Native + Expo + TypeScript**
- **Expo Router**（文件路由）
- **EAS Build**（iOS + Android 出包）
- **Expo SecureStore**（令牌安全存储）
- 目标平台：iOS + Android

### 建议目录（Monorepo）
```text
apps/mobile/          # Expo 应用（Expo Router 页面、原生集成）
packages/api-client/  # 统一 API 客户端（对齐 SHARED_WEB_MOBILE_API_CONTRACT）
packages/shared-types/# 跨端 TypeScript 类型
packages/shared-schemas/# 跨端 Zod schema（校验与序列化）
packages/i18n/        # 多语言资源（中/英，可扩展）
```
- `apps/mobile` 通过 `packages/api-client` 访问后端；**不直接访问数据库、不直接调用模型 Provider**。
- `packages/shared-*` 同时供 Web 与 App 复用，避免三套定义分叉。

---

## 2. Ant A-Fu 参考基准（Reference Benchmark）

将"蚂蚁阿福"作为**产品逻辑参考**，**严禁复制**其品牌、Logo、角色、图标、文案、配色、具体页面。

### 借鉴方向（仅交互/产品逻辑）
1. 对话式首页；2. 健康状态卡片；3. 健康小目标；4. 主动健康陪伴；5. 家庭健康档案；6. 报告拍照解读；7. 每次只追问一个核心问题；8. 健康计划与每日任务。

### GB MEDIX AI 差异化
- 中医体质 + 现代生活方式结合
- 全球多语言
- Premium 个性化健康报告
- Web/App 报告与权益同步
- 健康商品与供应链能力
- **非诊断、非处方**健康管理定位

---

## 3. App V1 页面

**底部导航**：首页 · AI 健康 · 健康档案 · 我的

**页面清单**：启动页 · 注册 · 邮箱验证 · 登录 · Consent · 对话式首页 · AI 智能问诊 · 健康评估 · Free Report · Premium Report · 报告历史 · 用户中心 · Entitlement 状态 · 中英文切换。

页面原则：
- Consent 未通过不得进入 AI 功能（与 Web 同门禁，错误码 `AI_CONSENT_REQUIRED`）。
- Premium 内容必须经 `Entitlement`（错误码 `ENTITLEMENT_REQUIRED`）。
- 对话式首页遵循"每次只追问一个核心问题"。

---

## 4. 移动认证（Mobile Auth）

**不得直接复用 Web Cookie。** 采用面向移动的令牌方案，复用后端已有的 `User.sessionVersion` 吊销能力（详见共享契约文档）。

- **Access Token**（短时效）
- **Refresh Session**（换取新 Access Token）
- **Expo SecureStore** 存储令牌（不落 AsyncStorage）
- **Token 轮换**
- **`sessionVersion` 吊销**（复用现有机制，与 Web 一致）
- **单设备退出** / **退出所有设备**（`sessionVersion += 1`）
- **Token 过期恢复**（refresh 流）
- **App Deep Link 邮箱验证**（验证链接唤起 App 完成 active）

契约端点见 `SHARED_WEB_MOBILE_API_CONTRACT.md`（`/api/mobile/auth/*`）。

---

## 5. App V2（后续）
- Push Notification
- 健康日记
- 健康目标
- 家庭成员档案
- 拍照报告解读
- 7 天健康计划
- 产品推荐
- App Store / Google Play 支付策略

---

## 6. App 支付边界（必须先分析，V1 不落地实现）

| 议题 | 规划结论 |
|---|---|
| Web 已购 Entitlement 同步 | App 读取后端 Entitlement，**权益以后端为唯一真相**；Web 购买在 App 生效 |
| iOS 数字内容购买规则 | Apple 要求 App 内数字内容走 IAP；Premium 报告属数字内容，**iOS 内购买需评估 IAP** |
| Google Play Billing | Android 数字内容同理需 Play Billing 评估 |
| Stripe 适用范围 | Stripe 可用于**实体商品 / 供应链服务**路径与 Web 端；App 内数字内容购买不得绕过平台内购 |
| Beta 阶段合规 | Beta 阶段 App **不内置数字内容购买入口**，仅同步/展示 Web 已购权益，规避支付违规 |

> 结论：V1 阶段 App 仅**同步与展示** Entitlement，不在 App 内发起数字内容付款；付款策略在 V2 明确 IAP / Play Billing / Stripe 分工后再实现。

---

## 7. App 安全要求（硬约束）
- Token **不得**存在 AsyncStorage（仅 SecureStore）。
- 禁止 App **直接调用模型 Provider**（DeepSeek/AIHubMix）——一律经后端。
- **Consent 不得绕过**。
- **Premium 不得绕过 Entitlement**。
- **家庭成员必须数据隔离**（按 `userId` / `familyMemberId`）。
- 图片上传必须**脱敏并获得授权**。

---

## 8. 交付物（分支 `feature/mobile-app-foundation`）
- W1：Monorepo 脚手架（`apps/mobile` + `packages/*`）+ Expo 启动。
- W2：Auth 模块 + 评估流（Consent→评估→Free Report）。
- W3：报告页（Free/Premium + Entitlement 状态 + 历史）。
- W4：联调 + EAS Beta 构建 + 安全审查。

**跨线约束**：不建第二套账户体系、不直接访问 DB、不直接调 Provider、Premium 统一由 Entitlement 控制、Consent 统一（详见 `PARALLEL_DEVELOPMENT_ROADMAP.md` 第三节等价约束）。
