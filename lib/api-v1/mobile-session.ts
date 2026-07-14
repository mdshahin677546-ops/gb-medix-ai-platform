import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { PrismaDeviceSessionStore } from "../mobile-auth/v1/prisma-store";
import { loadMobileAuthConfig, accessTokenPolicyFromConfig } from "../mobile-auth/v1/config";
import type { MobileUserFacts } from "../mobile-auth/v1/eligibility";
import { newRequestId } from "./request-context";
import { internalFailure } from "./failure";
import { finalize, type HandlerResult } from "./handler-result";
import { createMobileRefreshHandler } from "./handlers/mobile-auth-refresh";
import { createMobileLogoutHandler } from "./handlers/mobile-auth-logout";
import { createMobileLogoutAllHandler } from "./handlers/mobile-auth-logout-all";

/**
 * Real mobile-auth route wiring (imports @/lib/prisma + reads env, so it is kept
 * OUT of the pure barrel and node:test — the pure handler tests inject fakes).
 *
 * The config (signing key, refresh pepper, issuer, audience, TTLs) is loaded
 * LAZILY per request from process.env — never at module load — so `next build`
 * never needs the secrets, and a missing/invalid secret fails closed as a safe
 * INTERNAL_ERROR (no value leaked) rather than crashing the route. The mobile
 * Bearer boundary is fully separate from the Web cookie session.
 */

let storeSingleton: PrismaDeviceSessionStore | null = null;
function getStore(): PrismaDeviceSessionStore {
  if (!storeSingleton) {
    storeSingleton = new PrismaDeviceSessionStore(
      prisma as unknown as ConstructorParameters<typeof PrismaDeviceSessionStore>[0]
    );
  }
  return storeSingleton;
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

async function getUserFacts(userId: string): Promise<MobileUserFacts | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, emailVerifiedAt: true, sessionVersion: true }
  });
  if (!u) return null;
  return {
    exists: true,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    sessionVersion: u.sessionVersion
  };
}

export async function runMobileRefresh(input: { body: unknown }): Promise<HandlerResult> {
  const requestId = newRequestId();
  try {
    const config = loadMobileAuthConfig();
    const store = getStore();
    const handler = createMobileRefreshHandler({
      now: nowSeconds,
      pepper: config.pepper,
      signingKey: config.signingKey,
      issuer: config.issuer,
      audience: config.audience,
      accessTtlSeconds: config.accessTtlSeconds,
      refreshIdleTtlSeconds: config.refreshIdleTtlSeconds,
      revokeFamilyOnReplay: (hash, now) => store.revokeFamilyOnReplay(hash, now),
      findCurrentByHash: (hash) => store.findByRefreshTokenHash(hash),
      rotate: (rotateInput) => store.rotateRefreshTokenAtomically(rotateInput),
      getUserFacts,
      newTokenId: () => randomUUID()
    });
    return await handler(input);
  } catch {
    return finalize(requestId, internalFailure(requestId));
  }
}

export async function runMobileLogout(input: { body: unknown }): Promise<HandlerResult> {
  const requestId = newRequestId();
  try {
    const config = loadMobileAuthConfig();
    const store = getStore();
    const handler = createMobileLogoutHandler({
      now: nowSeconds,
      pepper: config.pepper,
      findCurrentByHash: (hash) => store.findByRefreshTokenHash(hash),
      revokeSession: (id, reason, now) => store.revokeSession(id, reason, now)
    });
    return await handler(input);
  } catch {
    return finalize(requestId, internalFailure(requestId));
  }
}

export async function runMobileLogoutAll(input: { body: unknown; authorization: unknown }): Promise<HandlerResult> {
  const requestId = newRequestId();
  try {
    const config = loadMobileAuthConfig();
    const store = getStore();
    const handler = createMobileLogoutAllHandler({
      now: nowSeconds,
      signingKey: config.signingKey,
      policy: accessTokenPolicyFromConfig(config),
      getUserFacts,
      revokeAllUserSessions: (userId, reason, now) => store.revokeAllUserSessions(userId, reason, now)
    });
    return await handler(input);
  } catch {
    return finalize(requestId, internalFailure(requestId));
  }
}
