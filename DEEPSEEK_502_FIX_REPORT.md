# DEEPSEEK_502_FIX_REPORT — GB Medix AI 2.0

日期：2026-07-10　|　执行者：Claude Code（Lead Developer）　|　结论：**DEEPSEEK_502_FIX_READY**（代码修复就绪，待部署 + 生产 smoke 复测确认）

---

## 0. 诚实边界（关于"真实根因"）

任务 Step 1–3（Vercel Function 日志、生产配置核验、真实 DeepSeek 探针）**需要生产平台访问权限与真实 DeepSeek key**，我这个本机环境**均不具备**（无 Vercel 访问、本地 `DEEPSEEK_API_KEY` 为空）。因此我**无法直接观测并确证唯一真实根因**。

我做的是：**代码级定位** + 按任务选项 **B/C** 的**防御性修复** + 本地测试/build 验证。下面对"真实根因"的判断基于代码分析与生产症状的一致性，并明确标注"未经生产日志/探针确证"。

---

## 1. 502 的（最可能）根因

**症状（平台提供）**：同意后 DeepSeek 调用 → 502；`AIUsage.provider/model/tokens` 无成功记录。

**代码路径**（`lib/ai/providers/openai-compatible.ts` `generateStructuredJSON`）：
- 发送 `response_format: { type: "json_object" }`；
- 取 `completion.choices[0].message.content`；
- **`JSON.parse(content)`**（旧实现，脆弱）→ 失败即 `AIProviderOutputError` → `getSafeAIError` → **502**；
- 路由中 `recordAIUsage` 只在解析+校验成功之后执行 → 失败时**无 AIUsage 记录**（与症状一致）。

**最可能根因（未经生产确证）**：DeepSeek（相对 OpenAI）在 json_object 模式下**更常返回被 markdown code fence（```` ```json ... ``` ````）包裹或带前后文字的内容**；旧代码对此直接 `JSON.parse` 失败 → 502。该失败发生在"JSON parse 阶段"，恰好解释"AIUsage 无成功记录"（记录发生在成功之后）。

**注意**：同一症状也可能来自**上游调用直接失败**（例如生产 `DEEPSEEK_MODEL` 配置为不支持 json_object 的模型、key/baseURL 配置问题——即任务选项 A，属 owner-side 配置）。若真因是 A，本代码修复不生效，需在生产日志/探针中排除。见 §5。

---

## 2. 修复位置与类型

**类型：仅代码修复（provider 层），无业务逻辑/配置/Schema 改动。**

| 文件 | 改动 |
|---|---|
| `lib/ai/providers/openai-compatible.ts` | `generateStructuredJSON` 在 `JSON.parse` 前加入防御性 `extractJsonObject(content)`：容忍 markdown code fence 与前后文字，提取 JSON 对象；**仍强制** `JSON.parse` + `schema.safeParse`；任何无效仍抛 `AIProviderOutputError` → 安全 502、**不入库**。新增导出 `extractJsonObject` 辅助函数。 |
| `tests/ai-provider-adapter.test.mjs` | 更新源码断言：由 `JSON.parse(content)` → `JSON.parse(extractJsonObject(content))`（意图不变：JSON 解析门禁仍在）。 |
| `tests/deepseek-structured-json.test.mjs` | **新增**（12 用例）。 |

**对应任务选项**：B（response_format/输出容错，仍要求纯 JSON）+ C（markdown code fence 安全提取，提取后再经 Zod）。

**严格遵守的红线（代码层面已核对）**：
- ✅ 未关闭 Zod：仍 `input.schema.safeParse(rawJson)`。
- ✅ 坏 JSON/schema 不入库：解析/校验失败**在 return 之前抛错**；路由 `recordAIUsage`/`create` 均在成功之后。
- ✅ 未放宽 `ReportSchema`（`report-schema.ts` 未改）。
- ✅ 保留 medical safety prompt（`prompts.ts` 未改）。
- ✅ 无自动 fallback 到其他 Provider。
- ✅ 未改 Stripe/Payment/Entitlement/Email/Consent。
- ✅ 未记录 prompt/健康信息/密钥（`extractJsonObject` 不做任何日志）。

对 OpenAI 无回归：干净 JSON 经 `extractJsonObject` 原样返回，Zod 照常校验。

---

## 3. 测试结果（本地，对 `gbmedix_test`）

| 检查 | 结果 |
|---|---|
| `tsc --noEmit --incremental false` | ✅ 0 类型错误 |
| 新增 `tests/deepseek-structured-json.test.mjs` | ✅ **12/12** |
| `npm test`（全量） | ✅ **60 tests / 59 pass / 0 fail / 1 skip**（skip=Stripe HTTP e2e 无服务器） |
| `test:commercial` / `test:email` / `test:ai-provider` / `test:ai-consent` | ✅ 各 6/6 |
| `npm run build` | ✅ Compiled successfully，39 页 |
| `git diff --check` | ✅ CLEAN |

**新测试覆盖**（对应 Step 5 中可离线验证的项）：
- ✅ 纯 JSON 接受；```` ```json ```` / 裸 ```` ``` ```` fence 接受；前后文字包裹的 JSON 被提取接受。
- ✅ **invalid JSON 仍被拒**（json 阶段，安全 502）。
- ✅ **invalid schema 仍被拒**（schema 阶段，含越界数值/非法 enum）。
- ✅ 空内容不被静默放行。
- ✅ 源码断言：仍 `response_format: json_object`、仍 Zod、仍抛 `AIProviderOutputError`、无 provider fallback、未放宽 schema、保留 medical safety prompt。

**本地无法覆盖（需生产/真实 DeepSeek）**：DeepSeek 最小调用成功、结构化 JSON 真实成功、`AIUsage.provider=deepseek`/model/tokens/endpoint 真实记录——这些需要 Step 3 探针或生产 smoke（无 key/无 Vercel/无生产库，我无法执行）。

---

## 4. 是否需要重新部署

**是。** 这是代码修复（`lib/ai/providers/openai-compatible.ts`），必须重新构建并部署到 Vercel Production 才会生效。部署 commit 应为包含本修复的最新 main/审核分支合并结果。

---

## 5. 是否可以重新执行生产 Smoke Test

**可以，且应在部署后执行**——以确认根因是否即为"JSON 包裹/解析"这一类：

1. 部署含本修复的版本。
2. 复跑 DeepSeek 生产 smoke（同意 → TCM 评估 → Free Report）。
3. 若成功且 `AIUsage.provider=deepseek`/tokens>0 → 根因即本类，**关闭 502**。
4. **若仍 502** → 说明真因是 **选项 A（配置）或上游 response_format 不兼容**：请从 Vercel Function 日志取错误阶段（provider initialization / upstream request / JSON parse / Zod / db write）与 provider error code，并核验 `DEEPSEEK_MODEL` 是否为当前账户支持 json_object 的模型（如 `deepseek-chat`）。这属 owner-side，我可据日志继续定位。

---

## 6. 结论

**DEEPSEEK_502_FIX_READY** —— provider 层防御性修复已实现、测试与 build 全绿、严守所有安全红线、无业务逻辑/schema/配置改动。真实根因未经生产日志/探针确证；本修复针对最可能的代码侧根因（json_object 输出被 fence/文字包裹导致解析失败）。**下一步：部署 + 生产 smoke 复测确认；若仍 502，则为配置/上游（owner-side），据日志再定位。**

*约束遵守：未打印任何密钥/cookie/token/连接串 · 未记录健康原文/prompt · 未关闭 Zod · 未允许坏 JSON 入库 · 无自动 fallback · 未改 Stripe/Payment/Entitlement/Email/Consent · 未进入 Sprint 2。*
