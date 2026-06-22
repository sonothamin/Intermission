// =============================================================================
// frontend/src/lib/tmdbCache.ts
//
// Tiny in-memory + sessionStorage cache for TMDB-flavoured edge function calls.
//
// Goal: make the Continue Watching row and other "list of shows" UI render
// quickly after the first visit, without re-hitting Supabase edge functions
// (which themselves proxy TMDB) on every navigation.
//
// Notes:
//   - TTL is short (1h) because the user can mark progress at any time and we
//     don't want to serve wildly stale episode titles / stills.
//   - In-flight requests are de-duped so concurrent callers share one promise.
//   - Falls back to in-memory only if sessionStorage is unavailable
//     (Safari private mode, quota errors, SSR).
// =============================================================================

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_PREFIX = "tmdb-cache:";

interface Entry<T> {
  data: T;
  expiresAt: number;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function safeStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode errors
  }
}

function isExpired(entry: Entry<unknown>): boolean {
  return entry.expiresAt <= Date.now();
}

function readFromStorage<T>(key: string): T | null {
  const raw = safeStorageGet(STORAGE_PREFIX + key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Entry<T>;
    if (isExpired(parsed)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeToStorage<T>(key: string, data: T, ttlMs: number): void {
  const entry: Entry<T> = { data, expiresAt: Date.now() + ttlMs };
  safeStorageSet(STORAGE_PREFIX + key, JSON.stringify(entry));
}

function readFromMemory<T>(key: string): T | null {
  const entry = memory.get(key);
  if (!entry || isExpired(entry)) {
    if (entry) memory.delete(key);
    return null;
  }
  return entry.data as T;
}

function writeToMemory<T>(key: string, data: T, ttlMs: number): void {
  memory.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Drop a cached entry from both memory and sessionStorage. Use after a
 * mutation (e.g. saving a rating) so the next read fetches fresh data.
 * Silently no-ops if the key isn't present or storage is unavailable.
 */
export function invalidateCached(key: string): void {
  memory.delete(key);
  inflight.delete(key);
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore storage errors
  }
}

/**
 * Memoize an async loader with a per-key TTL. Concurrent calls for the same
 * key share a single in-flight promise.
 */
export function cachedFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const memHit = readFromMemory<T>(key);
  if (memHit !== null) return Promise.resolve(memHit);

  const storageHit = readFromStorage<T>(key);
  if (storageHit !== null) {
    writeToMemory(key, storageHit, ttlMs);
    return Promise.resolve(storageHit);
  }

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = loader()
    .then((data) => {
      writeToMemory(key, data, ttlMs);
      writeToStorage(key, data, ttlMs);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Run async tasks with a bounded concurrency window. Returns results in the
 * same order as `items`.
 */
export async function parallelMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
