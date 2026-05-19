"use client";

interface ClientCacheEntry<T> {
  value: T;
  savedAt: number;
  expiresAt: number;
}

const CACHE_PREFIX = "stock-next:";

function getStorage() {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.sessionStorage;
    const testKey = `${CACHE_PREFIX}test`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

function normalizeKey(key: string) {
  return key.startsWith(CACHE_PREFIX) ? key : `${CACHE_PREFIX}${key}`;
}

export function readClientCache<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) return null;

  const normalizedKey = normalizeKey(key);

  try {
    const raw = storage.getItem(normalizedKey);
    if (!raw) return null;

    const entry = JSON.parse(raw) as ClientCacheEntry<T>;
    if (!entry || Date.now() > entry.expiresAt) {
      storage.removeItem(normalizedKey);
      return null;
    }

    return entry.value;
  } catch {
    storage.removeItem(normalizedKey);
    return null;
  }
}

export function writeClientCache<T>(
  key: string,
  value: T,
  ttlMs: number
): void {
  const storage = getStorage();
  if (!storage || ttlMs <= 0) return;

  try {
    const savedAt = Date.now();
    const entry: ClientCacheEntry<T> = {
      value,
      savedAt,
      expiresAt: savedAt + ttlMs,
    };
    storage.setItem(normalizeKey(key), JSON.stringify(entry));
  } catch {
    // Browsers can evict or block storage. Cache misses are safe.
  }
}

export function clearClientCache(key: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(normalizeKey(key));
  } catch {
    // Ignore storage failures.
  }
}

export function clearClientCachePrefix(prefix: string): void {
  const storage = getStorage();
  if (!storage) return;

  const normalizedPrefix = normalizeKey(prefix);

  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(normalizedPrefix)) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage failures.
  }
}
