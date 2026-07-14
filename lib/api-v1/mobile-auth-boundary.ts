import {
  mobileLogoutAllRequestSchema,
  mobileLogoutRequestSchema,
  mobileRefreshRequestSchema
} from "../api-contract/v1/mobile-auth";
import { failure } from "./failure";
import { finalize, type HandlerResult } from "./handler-result";
import { newRequestId } from "./request-context";
import {
  type MobileAuthEndpoint,
  parseIdempotencyKey
} from "../mobile-auth/v1/security-controls";

const MAX_JSON_BYTES = 8192;
const JSON_CONTENT_TYPE_RE = /^application\/json(?:\s*;\s*charset=utf-8)?$/i;
const FORBIDDEN_BODY_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "userId",
  "deviceSessionId",
  "tokenFamilyId",
  "email",
  "phone",
  "health",
  "healthData",
  "medicalData",
  "payment",
  "paymentInfo",
  "provider",
  "providerPayload"
]);

export type PreparedMobileAuthRequest =
  | {
      ok: true;
      input: {
        endpoint: MobileAuthEndpoint;
        body: Record<string, unknown>;
        authorization?: string;
        idempotencyKey: string;
      };
    }
  | { ok: false; result: HandlerResult };

function boundaryFailure(): PreparedMobileAuthRequest {
  const requestId = newRequestId();
  return { ok: false, result: finalize(requestId, failure("VALIDATION_ERROR", requestId)) };
}

function isAmbiguousHeaderValue(value: string): boolean {
  return value.includes(",") || /[\u0000-\u001f\u007f]/.test(value) || value !== value.trim();
}

function singletonHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name) ?? undefined;
  if (value && isAmbiguousHeaderValue(value)) return "__ambiguous__";
  return value;
}

async function readBodyText(request: Request): Promise<{ ok: true; text: string } | { ok: false }> {
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
}

function assertPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasForbiddenTopLevelKey(body: Record<string, unknown>): boolean {
  return Object.keys(body).some((key) => FORBIDDEN_BODY_KEYS.has(key));
}

function parseEndpointBody(endpoint: MobileAuthEndpoint, value: unknown): Record<string, unknown> | null {
  if (!assertPlainObject(value) || hasForbiddenTopLevelKey(value)) return null;
  if (endpoint === "refresh") {
    const parsed = mobileRefreshRequestSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  if (endpoint === "logout") {
    const parsed = mobileLogoutRequestSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  const parsed = mobileLogoutAllRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function prepareMobileAuthRequest(
  request: Request,
  endpoint: MobileAuthEndpoint
): Promise<PreparedMobileAuthRequest> {
  const url = new URL(request.url);
  if (url.search.length > 0) return boundaryFailure();

  const contentType = request.headers.get("content-type");
  if (!contentType || contentType.includes(",") || !JSON_CONTENT_TYPE_RE.test(contentType.trim())) {
    return boundaryFailure();
  }

  const authorization = singletonHeader(request.headers, "authorization");
  const idempotencyHeader = singletonHeader(request.headers, "idempotency-key");
  if (authorization === "__ambiguous__" || idempotencyHeader === "__ambiguous__") return boundaryFailure();
  const idempotency = parseIdempotencyKey(idempotencyHeader);
  if (!idempotency.ok) return boundaryFailure();

  const bodyText = await readBodyText(request);
  if (!bodyText.ok || bodyText.text.length === 0) return boundaryFailure();

  let raw: unknown;
  try {
    raw = JSON.parse(bodyText.text);
  } catch {
    return boundaryFailure();
  }

  const body = parseEndpointBody(endpoint, raw);
  if (!body) return boundaryFailure();

  return {
    ok: true,
    input: {
      endpoint,
      body,
      ...(authorization ? { authorization } : {}),
      idempotencyKey: idempotency.key
    }
  };
}
