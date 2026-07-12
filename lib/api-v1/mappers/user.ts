import { meSchema, type Me } from "../../api-contract/v1/auth";

/**
 * Map the authenticated User row to the public `me` DTO.
 *
 * Only allowlisted, non-sensitive fields are emitted and the result is validated
 * by the real shared `meSchema` (.strict()), so passwordHash, sessionVersion,
 * cookies, tokens, and raw email can never leak. `emailVerified` is derived from
 * emailVerifiedAt; the raw timestamp and email string are intentionally dropped.
 */
export type MeInput = {
  id: string;
  status: string;
  emailVerifiedAt: Date | string | null;
};

export function toMeDTO(user: MeInput): Me {
  const status = user.status === "active" ? "active" : "pending";
  return meSchema.parse({
    id: user.id,
    status,
    emailVerified: user.emailVerifiedAt != null
  });
}
