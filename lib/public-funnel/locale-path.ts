import { sanitizeConsultParams } from "./consult-context";

/**
 * Locale-preserving path helper (Batch 1.1, hardened in 1.1.1).
 *
 * Swaps ONLY the leading locale segment of an App Router path. The query string is
 * NOT preserved blindly — it is sanitized in a route-aware way so a language switch
 * can never smuggle sensitive data (PHI, symptoms, full prompt, email, phone, token,
 * cookie, Authorization) into the consultation surfaces:
 *
 *  - /consult and /ai-consult: ONLY the consultation allowlist
 *    (source / topic / context=education) survives — everything else is dropped,
 *    reusing the single authority `sanitizeConsultParams` (no duplicated allowlist).
 *  - /roundtable (list/detail): only safe search/filter state (query/category/sort).
 *  - any other route: the query is dropped entirely (safe default).
 */

/** Safe roundtable list/detail search + filter state preserved across a locale switch. */
export const ROUNDTABLE_QUERY_ALLOWLIST = ["query", "category", "sort"] as const;

type LocaleRouteKind = "consult" | "roundtable" | "other";

function localeRouteKind(pathname: string): LocaleRouteKind {
  const seg = (pathname || "").split("/").filter(Boolean); // e.g. ["en","consult",...]
  const top = seg[1];
  if (top === "consult" || top === "ai-consult") return "consult";
  if (top === "roundtable") return "roundtable";
  return "other";
}

function toQuery(search: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search.slice(1) : search;
}

/**
 * Route-aware sanitization of the query string preserved during a locale switch.
 * Returns a query string WITHOUT a leading "?" ("" when nothing is safe to keep).
 */
export function sanitizeLocaleSwitchSearch(pathname: string, search: string): string {
  const sp = new URLSearchParams(toQuery(search));
  const kind = localeRouteKind(pathname);

  if (kind === "consult") {
    const raw: Record<string, string> = {};
    for (const [k, v] of sp.entries()) raw[k] = v;
    const safe = sanitizeConsultParams(raw);
    return new URLSearchParams(safe as Record<string, string>).toString();
  }

  if (kind === "roundtable") {
    const out = new URLSearchParams();
    for (const [k, v] of sp.entries()) {
      if ((ROUNDTABLE_QUERY_ALLOWLIST as readonly string[]).includes(k) && v !== "") out.append(k, v);
    }
    return out.toString();
  }

  return "";
}

export function swapLocaleInPath(pathname: string, search: string, nextLang: string): string {
  const parts = (pathname || "/").split("/");
  // parts[0] is "" (leading slash); parts[1] is the locale segment when present.
  let base: string;
  if (parts.length > 1 && parts[1]) {
    parts[1] = nextLang;
    base = parts.join("/") || `/${nextLang}`;
  } else {
    base = `/${nextLang}`;
  }
  const safe = sanitizeLocaleSwitchSearch(pathname, search);
  return `${base}${safe ? `?${safe}` : ""}`;
}
