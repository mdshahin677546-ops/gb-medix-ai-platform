/**
 * Mock API client for the batch-1 mobile foundation.
 *
 * - Sends NO real network request.
 * - Uses NO production URL.
 * - Contains NO real user data or tokens.
 * - Returns typed fake data and can simulate error states the UI must handle:
 *   401 (AUTH_REQUIRED), 403 (AI_CONSENT_REQUIRED), 402 (ENTITLEMENT_REQUIRED),
 *   429 (RATE_LIMITED), 502 (AI_PROVIDER_ERROR).
 *
 * Real API calls will use the shared `/api/v1` contract client once the Auth
 * baseline is Codex-approved. This file must never be pointed at production.
 */

export type MockErrorCode =
  | "AUTH_REQUIRED"
  | "AI_CONSENT_REQUIRED"
  | "ENTITLEMENT_REQUIRED"
  | "RATE_LIMITED"
  | "AI_PROVIDER_ERROR";

export type MockResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: MockErrorCode; message: string } };

const MOCK_MESSAGES: Record<MockErrorCode, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  AI_CONSENT_REQUIRED: "Please accept the third-party AI processing notice first.",
  ENTITLEMENT_REQUIRED: "This feature requires an active purchase.",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  AI_PROVIDER_ERROR: "The AI service is temporarily unavailable."
};

export function mockError<T>(code: MockErrorCode): MockResult<T> {
  return { ok: false, error: { code, message: MOCK_MESSAGES[code] } };
}

export const mockApi = {
  me(): MockResult<{ id: string; status: "pending" | "active" }> {
    return { ok: true, data: { id: "mock-user", status: "active" } };
  },
  freeReport(): MockResult<{ id: string; healthScore: number; summary: string }> {
    return { ok: true, data: { id: "mock-report", healthScore: 82, summary: "Sample wellness summary (mock)." } };
  },
  premiumReport(): MockResult<never> {
    // Premium is gated by Entitlement server-side; the mock reflects the locked path.
    return mockError("ENTITLEMENT_REQUIRED");
  },
  aiMessage(): MockResult<{ reply: string }> {
    return { ok: true, data: { reply: "This is a wellness suggestion (mock), not a diagnosis." } };
  }
};
