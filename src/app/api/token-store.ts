type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Keeps the API's bearer token in sessionStorage: it survives a refresh of the tab, is gone
 * when the tab closes, and is never shared with other tabs or kept in localStorage.
 * Every access is wrapped because storage can be blocked or full.
 */
export class TokenStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => number = Date.now,
    private readonly key = 'royal-api-session',
  ) {}

  /** The saved token, or null when there is none, it is malformed, or it has expired. */
  read(): string | null {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown };
      if (
        typeof saved.token !== 'string' ||
        typeof saved.expiresAt !== 'string' ||
        !(Date.parse(saved.expiresAt) > this.now())
      ) {
        this.clear();
        return null;
      }
      return saved.token;
    } catch {
      return null;
    }
  }

  write(token: string, expiresAt: string): void {
    try {
      this.storage.setItem(this.key, JSON.stringify({ token, expiresAt }));
    } catch {
      // Storage unavailable: the session still works until the page is reloaded.
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Nothing to clear.
    }
  }
}

/** sessionStorage when the browser allows it, otherwise an in-memory stand-in. */
export function safeSessionStorage(): KeyValueStorage {
  try {
    const probe = '__royal_probe__';
    sessionStorage.setItem(probe, '1');
    sessionStorage.removeItem(probe);
    return sessionStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}
