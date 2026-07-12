import { z } from "zod";

/**
 * Mobile auth security audit events (pure, strict).
 *
 * The schema is a strict allowlist, so a token / refresh token / hash /
 * Authorization header / cookie / pepper / health / email / phone / payment
 * field can NEVER be attached to an audit record — `.strict()` rejects any field
 * not listed, and `buildMobileAuthAuditEvent` throws rather than emit an unsafe
 * event. Only de-identified ids and a coarse reason are allowed.
 */

export const MOBILE_AUTH_AUDIT_EVENTS = [
  "mobile_session_created",
  "mobile_access_token_issued",
  "mobile_refresh_rotated",
  "mobile_refresh_replay_detected",
  "mobile_session_revoked",
  "mobile_all_sessions_revoked",
  "mobile_session_expired",
  "mobile_session_compromised"
] as const;
export type MobileAuthAuditEventName = (typeof MOBILE_AUTH_AUDIT_EVENTS)[number];

/**
 * Fields that must NEVER appear in an audit record. Enforced structurally by the
 * strict schema (they are simply not allowlisted); this list documents intent
 * and backs the tests.
 */
export const FORBIDDEN_AUDIT_FIELDS = [
  "accessToken",
  "refreshToken",
  "refreshTokenHash",
  "authorization",
  "cookie",
  "pepper",
  "email",
  "phone",
  "password",
  "healthData",
  "paymentInfo"
] as const;

/**
 * `reason` is a CONTROLLED enum — never free text. This makes it impossible to
 * smuggle a token / email / health text / newline-injection payload through the
 * audit reason field. Only these fixed, safe codes are accepted.
 */
export const MOBILE_AUTH_AUDIT_REASONS = [
  "created",
  "issued",
  "rotated",
  "replay_detected",
  "user_logout",
  "user_logout_all",
  "session_version_mismatch",
  "token_family_revoked",
  "expired",
  "compromised",
  "admin"
] as const;
export type MobileAuthAuditReason = (typeof MOBILE_AUTH_AUDIT_REASONS)[number];

export const mobileAuthAuditEventSchema = z
  .object({
    event: z.enum(MOBILE_AUTH_AUDIT_EVENTS),
    occurredAt: z.number().int().nonnegative(),
    userId: z.string().min(1).max(128).optional(),
    deviceSessionId: z.string().min(1).max(128).optional(),
    tokenFamilyId: z.string().min(1).max(128).optional(),
    // Controlled enum only — no arbitrary details/message/context escape hatch.
    reason: z.enum(MOBILE_AUTH_AUDIT_REASONS).optional()
  })
  .strict();
export type MobileAuthAuditEvent = z.infer<typeof mobileAuthAuditEventSchema>;

export class AuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditValidationError";
  }
}

/**
 * Build a validated audit event. Throws AuditValidationError (with NO offending
 * value) if the input carries an unknown/forbidden field or otherwise fails the
 * strict schema — nothing sensitive is ever silently kept.
 */
export function buildMobileAuthAuditEvent(input: unknown): MobileAuthAuditEvent {
  const parsed = mobileAuthAuditEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new AuditValidationError("Invalid or forbidden mobile auth audit event.");
  }
  return parsed.data;
}
