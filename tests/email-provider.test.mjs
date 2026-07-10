import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production console email provider is not allowed", () => {
  const source = readFileSync("lib/email/provider.ts", "utf8");

  assert.match(source, /provider === "console" && process\.env\.NODE_ENV !== "production"/);
  assert.match(source, /Email provider is not configured for production\./);
  assert.match(source, /throw new Error\(productionEmailError\)/);
});

test("resend provider constructs the expected API payload", () => {
  const source = readFileSync("lib/email/providers/resend.ts", "utf8");

  assert.match(source, /process\.env\.RESEND_API_KEY/);
  assert.match(source, /process\.env\.EMAIL_FROM/);
  assert.match(source, /https:\/\/api\.resend\.com\/emails/);
  assert.match(source, /Authorization:\s*`Bearer \$\{this\.apiKey\}`/);
  assert.match(source, /from:\s*this\.from/);
  assert.match(source, /to:\s*\[message\.to\]/);
  assert.match(source, /subject:\s*message\.subject/);
  assert.match(source, /text:\s*message\.text/);
  assert.match(source, /html:\s*message\.html/);
});

test("verification email includes a clickable token link", () => {
  const source = readFileSync("lib/email/verification.ts", "utf8");
  const sendRoute = readFileSync("app/api/auth/send-verification/route.ts", "utf8");

  assert.match(source, /\/api\/auth\/verify-email/);
  assert.match(source, /url\.searchParams\.set\("token", token\)/);
  assert.match(source, /Verify your email:/);
  assert.match(source, /AI Health Assessment continues right where you left it/);
  assert.match(sendRoute, /buildVerificationEmail\(\{ token, lang \}\)/);
  assert.match(sendRoute, /html:\s*emailMessage\.html/);
});

test("verify-email route activates user and supports clicked GET links", () => {
  const source = readFileSync("app/api/auth/verify-email/route.ts", "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /searchParams\.get\("token"\)/);
  assert.match(source, /status:\s*"active"/);
  assert.match(source, /emailVerifiedAt:\s*new Date\(\)/);
  assert.match(source, /setSessionCookie\(response, result\.userId, result\.sessionVersion\)/);
  assert.match(source, /NextResponse\.redirect/);
});

test("unverified users cannot call AI assessment", () => {
  const source = readFileSync("app/api/tcm/route.ts", "utf8");

  assert.match(source, /if \(user\.status !== "active"\)/);
  assert.match(source, /Please verify your email before AI assessment\./);
  assert.match(source, /status:\s*403/);
});

test("verified users can continue into assessment flow after session issuance", () => {
  const verifySource = readFileSync("app/api/auth/verify-email/route.ts", "utf8");
  const tcmSource = readFileSync("app/api/tcm/route.ts", "utf8");

  assert.match(verifySource, /setSessionCookie\(response, result\.userId, result\.sessionVersion\)/);
  assert.match(tcmSource, /const user = await getCurrentUser\(\)/);
  assert.match(tcmSource, /await recordAIUsage/);
  assert.match(tcmSource, /prisma\.tCMRecord\.create/);
});
