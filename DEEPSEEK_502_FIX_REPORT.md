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

### v2（按 Codex 反馈强化）

v1 的 `extractJsonObject` 用朴素 `indexOf("{")`→`lastIndexOf("}")`，会错误接受**顶层数组**（如 `[{...}]` 提取出内部对象后竟通过 Zod）、并可能被字符串内部的 `}` 破坏。v2 改为**只接受唯一顶层 JSON object** 的严格提取：

| 文件 | 改动 |
|---|---|
| `lib/ai/providers/openai-compatible.ts` | 移除 `lastIndexOf` 朴素提取，改为 `extractTopLevelJsonObject`（返回 `string \| null`）+ `scanBalancedObjectEnd`：**字符串感知、转义感知、括号平衡**扫描，支持嵌套对象，忽略字符串内 `{}`。拒绝：顶层数组（含单元素）、多个并列对象、对象后追加第二个值、截断/不平衡、空内容。提取后**仍强制** `JSON.parse(candidate)` + `input.schema.safeParse(rawJson)`；`candidate===null` 或解析/校验失败 → `AIProviderOutputError` → 安全 502、**不入库**。 |
| `tests/ai-provider-adapter.test.mjs` | 源码断言更新为 `extractTopLevelJsonObject(content)` + `JSON.parse(candidate)`（意图不变：JSON 解析门禁仍在）。 |
| `tests/deepseek-structured-json.test.mjs` | **重写**（22 用例，覆盖所有要求场景）。 |
| `package.json` | `test:ai-provider` 现同时运行 `tests/deepseek-structured-json.test.mjs`。 |

**对应任务选项**：B（response_format/输出容错，仍要求纯 JSON）+ C（code fence / prose 安全提取，提取后再经 Zod），并按 Codex 要求收紧为"仅顶层单对象"。

### failed placeholder 审计记录（要求 11）

`app/api/reports/generate/route.ts` 在调用模型前 `upsert` 一条 placeholder `AIReport`；当 `generateReport` 失败（含本次 502 路径），在 `catch` 中 `update({ status: "failed" })` 保留该 placeholder 作为**失败审计记录**，随后返回 `getSafeAIError` 的 502。**不写入非法模型原文**（只落 `status:"failed"`）。本次修复**未改动**该审计逻辑。

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
| `npm run test:ai-provider`（含 deepseek 测试） | ✅ **22/22** |
| `npm test`（全量） | ✅ **64 tests / 63 pass / 0 fail / 1 skip**（skip=Stripe HTTP e2e 无服务器） |
| `test:commercial` / `test:email` / `test:ai-consent` | ✅ 各 6/6 |
| `npm run build` | ✅ Compiled successfully，39 页 |
| `git diff --check` | ✅ CLEAN |

**新测试覆盖（要求逐项）**：
- ✅ 顶层数组拒绝；✅ 单元素数组拒绝（含前置 prose）；✅ 嵌套对象通过（保留嵌套）；
- ✅ 字符串内部大括号通过（`{}` 在字符串值内不破坏平衡）；✅ 多个并列对象拒绝；
- ✅ 对象后追加第二个对象拒绝；✅ 截断对象拒绝；✅ code fence 对象通过；
- ✅ prose 包裹单对象通过；✅ invalid schema 拒绝；✅ 空内容拒绝；✅ 纯对象端到端通过。
- ✅ 源码断言：用 `extractTopLevelJsonObject`+`scanBalancedObjectEnd`（字符串/转义感知）、**已移除 `lastIndexOf`**、仍 `json_object`/`JSON.parse`/Zod、仍抛 `AIProviderOutputError`、无 provider fallback、未放宽 schema、保留 medical safety prompt。

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
