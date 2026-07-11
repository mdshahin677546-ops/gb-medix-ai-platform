# DEEPSEEK_PRODUCTION_SMOKE_FINAL_REPORT — GB Medix AI 2.0

日期：2026-07-10　|　模式：**平台负责人执行 · Claude Code 记录与核验**　|　生产候选：`main = a557dc38b86cdf8af881af7bf4580faea0e11df4`　|　结论：**DEEPSEEK_PRODUCTION_SWITCH_BLOCKED**

> 标注约定 —— **[CC 核实]**：Claude Code 在代码/仓库侧可验证。**[负责人明确确认]**：平台负责人就该项给出明确结果。**[待明确确认]**：尚无平台负责人对该项的明确、可核验回报（**不标为通过，不伪造**）。

---

## 1. 真实根因（502）

**[负责人确认]** 生产经 **AIHubMix（AI 网关/中转服务）** 访问 DeepSeek，并由其做**模型路由**（将请求路由到底层模型，如 `deepseek-chat`）。

**根因类别**：结构化 JSON 响应处理。经中转/模型返回的 JSON 可能被 markdown code fence 包裹或带前后文字；旧解析器（朴素 `indexOf/lastIndexOf`）解析失败 → `AIProviderOutputError` → 502，且因失败发生在解析阶段而**无 AIUsage 成功记录**。**[CC 核实]**

**修复（候选 `a557dc3`）**：`extractTopLevelJsonObject` + `scanBalancedObjectEnd`——字符串/转义感知、括号平衡，仅接受唯一顶层 JSON object；提取后仍强制 `JSON.parse` + `ReportSchema.safeParse`，无效仍安全 502、不入库。**[CC 核实]**

AIHubMix 中转已同步补入第三方 AI 隐私说明（页面 + notice）。

---

## 2. 逐项结果（仅标注明确确认项为通过）

| Step | 项 | 状态 | 依据 |
|---|---|---|---|
| 1 | 部署 commit / Ready | ⏳ 待明确确认 | 负责人以 `a557dc3` 为生产候选；**Ready 状态未逐项确认** |
| 1 | `AI_PROVIDER=deepseek` + `DEEPSEEK_*`（经 AIHubMix） | ⏳ 待明确确认 | 中转路由已确认；变量"存在且非空"未逐项回报 |
| 2 | 邮箱验证（active + emailVerifiedAt） | ⏳ 待明确确认 | — |
| 3 | 未同意 → 403 `AI_CONSENT_REQUIRED` | ⏳ 待明确确认（**代码门禁 [CC 核实] 存在**） | `tcm/reports/assistant/consult` 返回 403 + 该 error 码 |
| 4 | 同意后 DeepSeek 不再 502、结构化有效、无诊断/治疗/处方/概率/分诊 | ⏳ 待明确确认 | 负责人总体称"已通过"，但**无逐项证据/数值** |
| 4 | Free Report 生成 | ⏳ 待明确确认 | — |
| 5 | AIUsage：provider=deepseek / model 一致 / endpoint / tokens>0 | ⏳ 待明确确认 | 需 Neon 逐项数值；CC 未观测 |
| 6 | Premium 无权益 → 402（consent 不替代 entitlement） | ⏳ 待明确确认（**402 代码 [CC 核实]**，`reports/generate:90`） | — |
| 7 | 撤回 consent → 再次 403 | ⏳ 待明确确认 | — |
| 8 | 回归（邮箱验证 / Report IDOR / Stripe / Payment / Entitlement / 免费报告读取） | ⏳ 待明确确认（相关约束/隔离 [CC 核实] 未改） | — |
| 9 | 测试数据清理（残留=0） | ⏳ 待办 | 见 §3（CC 无 Neon 访问） |

> 说明：上一版报告曾将 Step 1–8 标为"负责人回报通过"。按本次"只把**明确确认**的项目标为通过"的要求，因缺少逐项、可核验的回报，已统一降级为 **待明确确认**——绝不将未逐项确认的项目标为通过。

## 3. 测试数据清理（Step 9）

**Claude Code 无生产 Neon 访问权**（本机仅 `127.0.0.1/gbmedix_test`，无生产连接串），**无法登录 Neon 控制台清理或统计残留**，不会伪造"残留=0"。需平台负责人在 Neon 控制台删除本次测试用户相关记录（`EmailVerification` / `AIProcessingConsent` / `AIUsage` / `AIReport` / `TCMRecord` / `AssistantSession`·`Conversation`·`Message` / `Payment`·`Entitlement`；未创建则确认不存在；不得删真实用户数据），并**只回报残留数量**（应为 0，不提供连接串）。

## 4. 是否可以开放小流量

**否。** 真实根因已确认且候选代码 [CC 核实] 就位；但功能验收各项**尚无逐项明确确认**，测试数据清理未闭环。需负责人逐项确认（尤其"同意后不再 502"、`AIUsage.provider=deepseek`/tokens>0、清理残留=0）后方可。

## 5. 闭环方式

平台负责人逐项回报（状态 / HTTP 码 / AIUsage 行 / 清理残留数；不含密钥/连接串/健康原文）→ Claude Code 对照本表核验 → 全部明确确认（含残留=0）后更新为 **DEEPSEEK_PRODUCTION_SWITCH_READY** 并判可开放小流量。

*约束遵守：仅改隐私说明 + 诊断日志（allowlist）+ 本报告；未改核心 AI 决策/业务逻辑/schema；未进入 Sprint 2；未打印密钥/连接串/健康原文；未伪造生产结果。*
