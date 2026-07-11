/**
 * Client-side analytics dedup skeleton.
 *
 * - Client events use a UUIDv4 eventId; a retry of the SAME logical event reuses
 *   the same eventId so the ingestion layer can dedupe.
 * - A page render emits a given page event at most once.
 * - sessionKey is short-lived and anonymous; NO long-lived device fingerprint.
 * - Server-authoritative dedup keys (HMAC of internal ids) are computed ONLY on
 *   the server. The HMAC secret must never enter browser code — this module
 *   intentionally contains no secret and no HMAC implementation.
 * Planning: PARALLEL_DEVELOPMENT_ROADMAP.md §9.
 */

export type UuidV4 = () => string;

/** Short-lived, anonymous session key (not a device fingerprint). */
export function createShortLivedSessionKey(uuid: UuidV4): string {
  return `s_${uuid()}`;
}

/**
 * Ensures a given logical event (keyed by eventName + optional pageKey) is
 * emitted at most once, and reuses its eventId across retries.
 */
export class PageEventDeduper {
  private readonly ids = new Map<string, string>();
  private readonly emitted = new Set<string>();

  constructor(private readonly uuid: UuidV4) {}

  private key(eventName: string, pageKey?: string): string {
    return pageKey ? `${eventName}::${pageKey}` : eventName;
  }

  /** Stable eventId for a logical event; identical across retries. */
  eventId(eventName: string, pageKey?: string): string {
    const k = this.key(eventName, pageKey);
    let id = this.ids.get(k);
    if (!id) {
      id = this.uuid();
      this.ids.set(k, id);
    }
    return id;
  }

  /** True the first time only; subsequent calls (re-render) return false. */
  markEmittedOnce(eventName: string, pageKey?: string): boolean {
    const k = this.key(eventName, pageKey);
    if (this.emitted.has(k)) return false;
    this.emitted.add(k);
    return true;
  }
}
