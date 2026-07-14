import { MIN_PEPPER_LENGTH } from "./refresh-token";
import { MIN_ACCESS_TOKEN_SIGNING_KEY_LENGTH } from "./access-token-sign";

/**
 * Mobile auth configuration / env boundary (Batch 2.2C).
 *
 * The signing key + refresh pepper are SECRETS: they are read ONLY from the
 * injected env map (default `process.env`), never hardcoded and never written to
 * a repo file. A missing / short / invalid value fails CLOSED — `loadMobileAuthConfig`
 * throws a fixed, VALUE-FREE error (the offending env name is named, its value is
 * NEVER included). Tests inject a fake env with throwaway test values.
 */

export const MOBILE_AUTH_ENV = {
  signingKey: "MOBILE_AUTH_ACCESS_TOKEN_SIGNING_KEY",
  pepper: "MOBILE_AUTH_REFRESH_TOKEN_PEPPER",
  issuer: "MOBILE_AUTH_ISSUER",
  audience: "MOBILE_AUTH_AUDIENCE",
  accessTtl: "MOBILE_AUTH_ACCESS_TTL_SECONDS",
  refreshIdleTtl: "MOBILE_AUTH_REFRESH_IDLE_TTL_SECONDS",
  refreshAbsoluteTtl: "MOBILE_AUTH_REFRESH_ABSOLUTE_TTL_SECONDS",
  clockSkew: "MOBILE_AUTH_CLOCK_SKEW_SECONDS"
} as const;

/** Sane ceilings so a mis-set env cannot create an absurd token lifetime. */
const ACCESS_TTL_MAX = 3600; // <= 1h access token
const REFRESH_IDLE_TTL_MAX = 60 * 60 * 24 * 90; // <= 90d idle
const REFRESH_ABSOLUTE_TTL_MAX = 60 * 60 * 24 * 400; // <= ~13mo absolute
const CLOCK_SKEW_MAX = 300;

export type MobileAuthConfig = {
  signingKey: string;
  pepper: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshIdleTtlSeconds: number;
  refreshAbsoluteTtlSeconds: number;
  clockSkewSeconds: number;
};

/** Value-free config error — names which setting is wrong, never its value. */
export class MobileAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobileAuthConfigError";
  }
}

type EnvMap = Record<string, string | undefined>;

function requireSecret(env: EnvMap, name: string, minLen: number): string {
  const v = env[name];
  if (typeof v !== "string" || v.length < minLen) {
    throw new MobileAuthConfigError(`Missing or too-short mobile auth secret: ${name}.`);
  }
  return v;
}

function requireString(env: EnvMap, name: string, maxLen: number): string {
  const v = env[name];
  if (typeof v !== "string" || v.length === 0 || v.length > maxLen) {
    throw new MobileAuthConfigError(`Missing or invalid mobile auth setting: ${name}.`);
  }
  return v;
}

function requireIntInRange(env: EnvMap, name: string, min: number, max: number): number {
  const raw = env[name];
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) {
    throw new MobileAuthConfigError(`Missing or invalid mobile auth setting: ${name}.`);
  }
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new MobileAuthConfigError(`Out-of-range mobile auth setting: ${name}.`);
  }
  return n;
}

function optionalIntInRange(env: EnvMap, name: string, min: number, max: number, fallback: number): number {
  if (env[name] === undefined) return fallback;
  return requireIntInRange(env, name, min, max);
}

export function loadMobileAuthConfig(env: EnvMap = process.env): MobileAuthConfig {
  const config: MobileAuthConfig = {
    signingKey: requireSecret(env, MOBILE_AUTH_ENV.signingKey, MIN_ACCESS_TOKEN_SIGNING_KEY_LENGTH),
    pepper: requireSecret(env, MOBILE_AUTH_ENV.pepper, MIN_PEPPER_LENGTH),
    issuer: requireString(env, MOBILE_AUTH_ENV.issuer, 256),
    audience: requireString(env, MOBILE_AUTH_ENV.audience, 256),
    accessTtlSeconds: requireIntInRange(env, MOBILE_AUTH_ENV.accessTtl, 60, ACCESS_TTL_MAX),
    refreshIdleTtlSeconds: requireIntInRange(env, MOBILE_AUTH_ENV.refreshIdleTtl, 300, REFRESH_IDLE_TTL_MAX),
    refreshAbsoluteTtlSeconds: requireIntInRange(env, MOBILE_AUTH_ENV.refreshAbsoluteTtl, 3600, REFRESH_ABSOLUTE_TTL_MAX),
    clockSkewSeconds: optionalIntInRange(env, MOBILE_AUTH_ENV.clockSkew, 0, CLOCK_SKEW_MAX, 0)
  };
  if (config.refreshIdleTtlSeconds > config.refreshAbsoluteTtlSeconds) {
    throw new MobileAuthConfigError("Refresh idle TTL cannot exceed absolute TTL.");
  }
  return config;
}

/** The access-token verification policy derived from config (no secret inside). */
export function accessTokenPolicyFromConfig(config: MobileAuthConfig): {
  issuer: string;
  audience: string;
  maxTtlSeconds: number;
  clockSkewSeconds: number;
} {
  return {
    issuer: config.issuer,
    audience: config.audience,
    maxTtlSeconds: config.accessTtlSeconds,
    clockSkewSeconds: config.clockSkewSeconds
  };
}
