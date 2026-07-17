export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/** Simple TTL response cache for successful GET responses. */
export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly ttlMs: number) {}

  get<T>(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, now = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export function cacheKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
