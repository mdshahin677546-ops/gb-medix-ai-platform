/**
 * Strict `Authorization: Bearer <token>` parsing (pure).
 *
 * Mobile access tokens are accepted ONLY from the Authorization header, never
 * from a query string or cookie. Anything ambiguous is rejected, and the token
 * value never appears in a result reason or error.
 */

export type BearerParseResult =
  | { ok: true; token: string }
  | { ok: false; reason: "missing" | "malformed" };

// Access-token charset: base64url + JWT separators/padding. No spaces/commas.
const TOKEN_RE = /^[A-Za-z0-9._~+/=-]+$/;
const MAX_TOKEN_LENGTH = 4096;

/** Any C0 control char (incl. CR, LF, tab, NUL) or DEL — used to block smuggling. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * @param header the raw Authorization header value. A string is expected; an
 *   array (multiple header instances) is rejected as malformed.
 */
export function parseBearerAuthorization(header: unknown): BearerParseResult {
  if (header === undefined || header === null) return { ok: false, reason: "missing" };
  // Multiple Authorization header values (array) are ambiguous -> reject.
  if (Array.isArray(header)) return { ok: false, reason: "malformed" };
  if (typeof header !== "string") return { ok: false, reason: "malformed" };
  if (header.length === 0) return { ok: false, reason: "missing" };
  if (header.length > MAX_TOKEN_LENGTH + 16) return { ok: false, reason: "malformed" };
  // CR/LF/other control chars (header smuggling) -> reject.
  if (hasControlChars(header)) return { ok: false, reason: "malformed" };
  // Comma-joined multi-credential header -> reject.
  if (header.includes(",")) return { ok: false, reason: "malformed" };

  // Exactly two space-separated parts: scheme + token. Any other shape (missing
  // token, extra tokens, double spaces) is malformed.
  const parts = header.split(" ");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const [scheme, token] = parts;
  // Case-sensitive "Bearer" only; rejects Basic, Token, bearer, etc.
  if (scheme !== "Bearer") return { ok: false, reason: "malformed" };
  if (!token || token.length === 0) return { ok: false, reason: "malformed" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "malformed" };
  if (!TOKEN_RE.test(token)) return { ok: false, reason: "malformed" };

  return { ok: true, token };
}
