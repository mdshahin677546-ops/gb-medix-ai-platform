/**
 * SecureCredentialStore — abstraction only (batch 1).
 *
 * Real credentials (tokens) must ONLY ever live in Expo SecureStore, never in
 * AsyncStorage, Redux/Zustand persistence, logs, analytics, or the clipboard.
 * This batch defines the interface and a non-persistent in-memory test impl.
 * It stores NO real token and implements NO refresh.
 *
 * BLOCKED: real mobile authentication requires separate Codex-approved
 * DeviceSession and refresh-token implementation (MOBILE_APP_IMPLEMENTATION_PLAN.md §6).
 */

export interface SecureCredentialStore {
  save(key: string, value: string): Promise<void>;
  read(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory test double. NOT for production and NOT persistent — a real
 * implementation will delegate to expo-secure-store. Never logs stored values.
 */
export class InMemoryCredentialStore implements SecureCredentialStore {
  private readonly map = new Map<string, string>();

  async save(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async read(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}
