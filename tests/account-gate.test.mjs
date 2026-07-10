import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Mirrors the gate derivation in app/[lang]/tcm-check/tcm-check-form.tsx:
// submission stays blocked until the session user is active and consent
// (when required) has been accepted.
function deriveGate({ sessionLoading, user, consentRequired, consentLoading, submitting }) {
  const accountReady = user?.status === "active";
  return {
    accountReady,
    submitDisabled:
      submitting || sessionLoading || !accountReady || consentLoading || consentRequired
  };
}

test("account gate blocks submission until the account is active", () => {
  const base = {
    sessionLoading: false,
    user: null,
    consentRequired: false,
    consentLoading: false,
    submitting: false
  };

  // Anonymous visitor: blocked.
  assert.equal(deriveGate(base).submitDisabled, true);

  // Signed in but unverified: blocked.
  assert.equal(
    deriveGate({ ...base, user: { status: "pending" } }).submitDisabled,
    true
  );

  // Active but third-party AI consent still required: blocked.
  assert.equal(
    deriveGate({ ...base, user: { status: "active" }, consentRequired: true })
      .submitDisabled,
    true
  );

  // While the session check is in flight: blocked.
  assert.equal(
    deriveGate({ ...base, sessionLoading: true, user: { status: "active" } })
      .submitDisabled,
    true
  );

  // Active and consent settled: allowed.
  assert.equal(
    deriveGate({ ...base, user: { status: "active" } }).submitDisabled,
    false
  );
});

test("tcm-check form wires the account gate end to end", () => {
  const source = readFileSync("app/[lang]/tcm-check/tcm-check-form.tsx", "utf8");

  // Gate state derives from the verified account status.
  assert.match(source, /status === "active"/);
  // The inline gate can actually send the verification email.
  assert.match(source, /\/api\/auth\/send-verification/);
  // Server-side auth failures resync the gate instead of dead-ending.
  assert.match(source, /response\.status === 401 \|\| response\.status === 403/);
  // Returning from the email link is acknowledged in place.
  assert.match(source, /get\("verified"\)/);
});

test("verify-email link returns users to the assessment in their language", () => {
  const route = readFileSync("app/api/auth/verify-email/route.ts", "utf8");
  assert.match(route, /tcm-check\?verified=1/);
  assert.match(route, /langParam === "zh"/);
});
