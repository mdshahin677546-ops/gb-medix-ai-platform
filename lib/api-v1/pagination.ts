/**
 * Cursor pagination for /api/v1 list endpoints (pure).
 *
 * Keyset pagination over a stable (createdAt DESC, id DESC) ordering so pages
 * never duplicate or drop rows. The cursor is an opaque base64 of
 * "createdAtISO|id" — clients treat it as a bare token and never parse it.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export type PageCursor = { createdAt: string; id: string };

export type ParsedPagination =
  | { ok: true; limit: number; cursor: PageCursor | null }
  | { ok: false };

function isPositiveIntString(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): PageCursor | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.indexOf("|");
  if (sep <= 0 || sep === decoded.length - 1) return null;
  const createdAt = decoded.slice(0, sep);
  const id = decoded.slice(sep + 1);
  // createdAt must be a valid ISO timestamp; id a non-empty opaque string.
  if (!id || id.length > 128) return null;
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return null;
  return { createdAt, id };
}

/**
 * Validate raw query params. Rejects unknown / oversized limits and malformed
 * cursors so a caller can map failure to VALIDATION_ERROR (400). A missing limit
 * defaults to DEFAULT_PAGE_LIMIT; a missing cursor means "first page".
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
