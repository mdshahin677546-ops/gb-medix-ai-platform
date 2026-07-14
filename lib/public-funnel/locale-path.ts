/**
 * Locale-preserving path helper (Batch 1.1).
 *
 * Swaps ONLY the leading locale segment of an App Router path while preserving the
 * rest of the path AND the entire query string (search text + active filters), so a
 * user switching language does not lose roundtable search/filter state or the entry
 * context they arrived with.
 */

function normalizeSearch(search: string): string {
  if (!search) return "";
  const s = search.startsWith("?") ? search : `?${search}`;
  return s === "?" ? "" : s;
}

export function swapLocaleInPath(pathname: string, search: string, nextLang: string): string {
  const parts = (pathname || "/").split("/");
  // parts[0] is "" (leading slash); parts[1] is the locale segment when present.
  if (parts.length > 1 && parts[1]) {
    parts[1] = nextLang;
    const base = parts.join("/") || `/${nextLang}`;
    return `${base}${normalizeSearch(search)}`;
  }
  return `/${nextLang}${normalizeSearch(search)}`;
}
