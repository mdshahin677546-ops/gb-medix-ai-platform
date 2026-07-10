# PRE_LAUNCH_SECURITY_HARDENING_REPORT — GB Medix AI 2.0

日期：2026-07-10　|　执行：Claude Code（Lead Developer）　|　基线：`9dcac3e`（未提交，待 Codex 审核）

修复上线前两个安全风险：①`AUTH_SECRET` 生产环境不能回退默认值；②会话无法单独失效/吊销。**未修改 Stripe / Entitlement / Payment / AIReport 业务逻辑**；未进入 Sprint 2；未切 `AI_PROVIDER`。

---

## 1. 修改文件

| 文件 | 变更 |
|---|---|
| `lib/auth.ts` | 核心：`secret()` 生产强制校验；新增 `userSessionValue` / `invalidateUserSessions`；`setSessionCookie` 增加 `sessionVersion` 参数；`getCurrentUser` 比对 DB 版本；doctor/merchant 会话不变 |
| `prisma/schema.prisma` | `User` 新增 `sessionVersion Int @default(1)` |
| `prisma/migrations/20260710120000_add_user_session_version/migration.sql` | **新增迁移**（见 §2） |
| `app/api/session/route.ts` | 登录签发传 `sessionVersion`；`DELETE ?scope=all` 走"退出所有设备" |
| `app/api/auth/verify-email/route.ts` | `verifyEmail` 返回 `sessionVersion`；两处 `setSessionCookie` 补参 |
| `app/api/checkout/route.ts` | 两处 `setSessionCookie` 补 `user.sessionVersion` |
| `.env.example` | `AUTH_SECRET` 生产强制说明 + 生成命令 |
| `DEPLOYMENT_CHECKLIST.md` | `AUTH_SECRET` 硬性要求说明 |
| `tests/email-provider.test.mjs` | 更新两处 `setSessionCookie` 签名断言 |
| `tests/session-security.test.mjs` | **新增测试**（14 用例） |

diff stat：8 tracked changed（+87 / −19）+ 2 新增（迁移目录、新测试）。**全部未提交**，供 Codex 审 diff。

---

## 2. Migration 文件

`prisma/migrations/20260710120000_add_user_session_version/migration.sql`：
```sql
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
```
- 非破坏：新增 `NOT NULL DEFAULT 1` 列，已有行自动填 1，与 schema 默认一致 → 现有已签发会话在版本被 bump 前保持有效。
- 已在 `gbmedix_test` 用 `prisma migrate deploy` 成功应用（第 5 个迁移），列存在、默认 1 已核验。

---

## 3. AUTH_SECRET 修复说明

**风险**：`secret()` 原为 `process.env.AUTH_SECRET || "dev-only-change-me"` —— 生产缺失时静默回退公开默认值，会话签名可被伪造。

**修复**（`lib/auth.ts`）：
```
const DEV_FALLBACK_SECRET = "dev-only-change-me";
function secret() {
  const value = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!value || value === DEV_FALLBACK_SECRET) {
      throw new Error("AUTH_SECRET must be set to a strong, non-default value in production. ...");
    }
    return value;
  }
  return value || DEV_FALLBACK_SECRET; // dev/test only
}
```
- 生产 + 缺失 → 抛错（调用即失败，misconfig 显式暴露）。
- 生产 + `dev-only-change-me` → 抛错。
- 开发/测试 → 保留 fallback，本地零摩擦。
- `.env.example` 与 `DEPLOYMENT_CHECKLIST.md` 已同步说明及生成命令。

**验收对照**：production+缺失 → 报错 ✅｜production+默认值 → 报错 ✅｜development → 正常 ✅（见 §5 测试 1–4）。

---

## 4. Session Revoke 设计

**问题**：原会话仅 `userId.sign(userId)`，无法单独失效——轮换 `AUTH_SECRET` 会一刀切失效所有会话，无法针对单用户吊销。

**方案（最小实现）**：
1. `User.sessionVersion Int @default(1)`。
2. 用户会话 cookie 变为 **`userId.sessionVersion.sign("userId.sessionVersion")`**（签名覆盖 id+version，二者均不可单独篡改）。
3. `getCurrentUser`：解析 3 段 → 验签 → 读 `User` → **`user.sessionVersion !== cookie 版本` 则判定失效**（返回 null）。
4. `invalidateUserSessions(userId)`：`sessionVersion += 1`（原子 `increment`），令该用户所有旧 cookie 立即失效。
5. "退出所有设备"：`DELETE /api/session?scope=all` → 调用上述函数并清本机 cookie；默认 DELETE 仍只清本机（非破坏）。

**用途**：改邮箱 / 退出所有设备 / 账号安全异常 / 未来密码或登录方式变更。

**兼容与影响**：
- 不破坏登录流：签发/验证路径全部更新，`user`/`result` 均带 `sessionVersion`。
- 不影响邮箱验证 active 流：`verifyEmail` 事务照常置 `status=active`，并返回 `sessionVersion`（默认 1）；签发的 cookie 版本与 DB 一致，验证通过。
- doctor/merchant 会话保持原 2 段格式（本任务范围仅 User）。
- **一次性影响**：上线部署后，历史 2 段旧 cookie 不再通过校验（用户需重新登录一次）。这是该安全加固的预期效果，等价于强制会话轮换（见 §6）。

---

## 5. 测试结果

新增 `tests/session-security.test.mjs`（14 用例，行为镜像 + 源码断言 + 真实 DB）：

| # | 用例 | 结果 |
|---|---|---|
| 1 | production + 缺失 AUTH_SECRET → 抛错 | ✅ |
| 2 | production + `dev-only-change-me` → 抛错 | ✅ |
| 3 | production + 强随机值 → 接受 | ✅ |
| 4 | development fallback 不阻塞 | ✅ |
| 5 | `lib/auth.ts` 实现了生产守卫（源码断言） | ✅ |
| 6 | sessionVersion 匹配 → 会话有效 | ✅ |
| 7 | sessionVersion 变更 → 旧 cookie 失效 | ✅ |
| 8 | 篡改签名 → 拒绝 | ✅ |
| 9 | 篡改 version（复用签名）→ 拒绝 | ✅ |
| 10 | 旧 2 段 cookie 不再通过 | ✅ |
| 11 | `lib/auth.ts` 实现版本绑定/吊销/DB 比对（源码断言） | ✅ |
| 12 | schema + migration 声明 `sessionVersion`（源码断言） | ✅ |
| 13 | 三处调用点传 `sessionVersion` + 退出所有设备 wiring | ✅ |
| 14 | **真实 Postgres**：`invalidateUserSessions` bump 后旧 cookie 失效、新 cookie 有效 | ✅ |

全量验证（对 `gbmedix_test`）：

| 命令 | 结果 |
|---|---|
| `npx prisma generate` | ✅ v5.22.0 |
| `npx tsc --noEmit --incremental false` | ✅ 0 类型错误 |
| `npm test` | ✅ 48 tests / **47 pass / 1 skip / 0 fail**（skip=Stripe HTTP e2e 无服务器） |
| `npm run test:commercial` | ✅ 6/6 |
| `npm run test:email` | ✅ 6/6（含更新的签名断言） |
| `npm run test:ai-provider` | ✅ 6/6 |
| `npm run test:ai-consent` | ✅ 6/6 |
| `npm run build` | ✅ Compiled successfully，39 页 |
| `git diff --check` | ✅ CLEAN |

---

## 6. 剩余风险 / 注意事项

| 级别 | 项 | 说明 |
|---|---|---|
| 低（预期） | 部署后旧会话一次性失效 | 3 段 cookie 新格式导致历史 2 段 cookie 失效，用户需重登一次；属安全加固预期，建议发布说明中提示。 |
| 低 | doctor / merchant 未纳入版本化 | 本任务范围仅 User 会话；如需医生/商户可吊销，可后续同法扩展（各自加 sessionVersion）。 |
| 低 | 尚无面向用户的"退出所有设备"前端入口 | 服务端已具备（`?scope=all` + `invalidateUserSessions`）；前端按钮可在后续 UI 迭代接入。 |
| 运维 | 轮换 `AUTH_SECRET` 仍会全局失效会话 | 与 per-user 吊销正交；生产轮换密钥属预期的全局登出。 |

未触碰的业务逻辑：Stripe / Entitlement / Payment / AIReport 未修改（改动仅限会话签发/校验与调用点补参）。

---

## 7. 交付状态

- 全部改动**未提交、未 push**，`main` 仍为 `9dcac3e`，等待 **Codex 审核**。
- 审核通过后再由上游决定提交/推送方式。

PRE_LAUNCH_SECURITY_HARDENING_READY
