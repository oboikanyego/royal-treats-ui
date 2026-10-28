type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Keeps the API's bearer token in one browser storage. SessionService uses two of these:
 * localStorage for "keep me signed in" (survives closing the browser, which phones do to
 * background tabs) and sessionStorage for a sign-in that should end with the tab.
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

/** The given browser storage when it is usable, otherwise an in-memory stand-in. */
export function safeStorage(kind: 'session' | 'local'): KeyValueStorage {
  try {
    const storage = kind === 'local' ? localStorage : sessionStorage;
    const probe = '__royal_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}
