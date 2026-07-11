/**
 * Client-side analytics dedup (tab-scoped, TTL + capacity bounded).
 *
 * - Client events use a UUIDv4 eventId; within the TTL (e.g. after a React
 *   remount) the SAME logical event reuses the SAME eventId; after the TTL a new
 *   eventId is minted.
 * - A page event is emitted at most once per TTL window.
 * - sessionKey is short-lived and anonymous — NO permanent device fingerprint,
 *   NO plaintext/hashed userId, NO permanent localStorage id.
 * - The clock is injectable for tests. Entries are capacity-capped and expired
 *   entries are pruned. Instances are tab/request-scoped — no module-global
 *   state — so SSR never shares state across users.
 * - Server-authoritative dedup (HMAC of internal ids) is server-only; this file
 *   contains no secret and no HMAC.
 * Planning: PARALLEL_DEVELOPMENT_ROADMAP.md §9.
 */

export type UuidV4 = () => string;
export type Clock = () => number;

export function createShortLivedSessionKey(uuid: UuidV4): string {
  return `s_${uuid()}`;
}

type Entry = { id: string; expiresAt: number };

export type TtlDeduperOptions = {
  uuid: UuidV4;
  clock: Clock;
  ttlMs?: number;
  maxEntries?: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

export class TtlEventDeduper {
  private readonly ids = new Map<string, Entry>();
  private readonly emitted = new Map<string, number>();
  private readonly uuid: UuidV4;
  private readonly clock: Clock;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(opts: TtlDeduperOptions) {
    this.uuid = opts.uuid;
    this.clock = opts.clock;
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  private key(eventName: string, pageKey?: string): string {
    return pageKey ? `${eventName}::${pageKey}` : eventName;
  }

  private prune(now: number): void {
    for (const [k, v] of this.ids) if (v.expiresAt <= now) this.ids.delete(k);
    for (const [k, exp] of this.emitted) if (exp <= now) this.emitted.delete(k);
  }

  private capAll(): void {
    while (this.ids.size > this.maxEntries) {
      const oldest = this.ids.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.ids.delete(oldest);
    }
    while (this.emitted.size > this.maxEntries) {
      const oldest = this.emitted.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.emitted.delete(oldest);
    }
  }

  /** Stable eventId within the TTL window; a fresh id after expiry. */
  eventId(eventName: string, pageKey?: string): string {
    const now = this.clock();
    this.prune(now);
    const k = this.key(eventName, pageKey);
    const existing = this.ids.get(k);
    if (existing && existing.expiresAt > now) return existing.id;
    const id = this.uuid();
    this.ids.set(k, { id, expiresAt: now + this.ttlMs });
    this.capAll();
    return id;
  }

  /** True the first time within a TTL window; false on re-render inside it. */
  markEmittedOnce(eventName: string, pageKey?: string): boolean {
    const now = this.clock();
    this.prune(now);
    const k = this.key(eventName, pageKey);
    const exp = this.emitted.get(k);
    if (exp && exp > now) return false;
    this.emitted.set(k, now + this.ttlMs);
    this.capAll();
    return true;
  }

  /** Current tracked entry count (for capacity assertions). */
  size(): number {
    return this.ids.size;
  }
}
