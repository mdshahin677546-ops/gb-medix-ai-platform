import { z } from "zod";

/**
 * Cursor pagination for /api/v1 list endpoints (pure).
 *
 * Keyset pagination over a stable (createdAt DESC, id DESC) ordering so pages
 * never duplicate or drop rows. The cursor is an opaque base64url of a strict
 * JSON payload { c: createdAtISO, i: id }. It is validated defensively BEFORE
 * decoding (length + charset) and AFTER decoding (strict Zod), never trusting
 * Buffer.from's lenient behavior, and it carries pagination keys only — never a
 * userId, health content, or any authorization signal.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;
// A well-formed cursor is far below this; the cap bounds work before decoding.
export const MAX_CURSOR_LENGTH = 512;

export type PageCursor = { createdAt: string; id: string };

export type ParsedPagination =
  | { ok: true; limit: number; cursor: PageCursor | null }
  | { ok: false };

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

// Strict decoded shape: exactly a createdAt ISO datetime + an opaque id, nothing else.
const cursorPayloadSchema = z
  .object({
    c: z.string().datetime(),
    i: z.string().min(1).max(128)
  })
  .strict();

function isPositiveIntString(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function encodeCursor(cursor: PageCursor): string {
  const json = JSON.stringify({ c: cursor.createdAt, i: cursor.id });
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): PageCursor | null {
  // Bound work and reject anything that is not strict base64url before decoding.
  if (raw.length === 0 || raw.length > MAX_CURSOR_LENGTH) return null;
  if (!BASE64URL_RE.test(raw)) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decoded);
  } catch {
    return null;
  }

  const result = cursorPayloadSchema.safeParse(parsedJson);
  if (!result.success) return null;
  return { createdAt: result.data.c, id: result.data.i };
}

/**
 * Validate raw query params. Rejects unknown / oversized limits and malformed
 * cursors so a caller can map failure to VALIDATION_ERROR (400). A missing limit
 * defaults to DEFAULT_PAGE_LIMIT; a missing/empty cursor means "first page".
 */
export function parsePagination(raw: {
  limit?: string | null;
  cursor?: string | null;
}): ParsedPagination {
  let limit = DEFAULT_PAGE_LIMIT;
  if (raw.limit !== undefined && raw.limit !== null && raw.limit !== "") {
    if (!isPositiveIntString(raw.limit)) return { ok: false };
    const parsed = Number(raw.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_LIMIT) {
      return { ok: false };
    }
    limit = parsed;
  }

  let cursor: PageCursor | null = null;
  if (raw.cursor !== undefined && raw.cursor !== null && raw.cursor !== "") {
    const decoded = decodeCursor(raw.cursor);
    if (!decoded) return { ok: false };
    cursor = decoded;
  }

  return { ok: true, limit, cursor };
}
