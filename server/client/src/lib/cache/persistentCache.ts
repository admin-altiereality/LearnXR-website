/**
 * A small IndexedDB key/value cache that survives reloads and browser restarts.
 *
 * Why this exists rather than leaning on Firestore's own persistent cache: enabling
 * `persistentLocalCache` makes the SDK keep documents on disk, which helps latency,
 * offline behaviour and listener resumption — but a one-shot `getDoc`/`getDocs` still
 * goes to the backend for freshness and is still billed for every document it returns.
 * Cutting the *read count* across sessions therefore needs an application-level cache
 * of the assembled result, revalidated against something cheap.
 *
 * Everything here degrades to a no-op when IndexedDB is unavailable (private browsing,
 * some WebViews, storage disabled). Callers must treat a miss as normal.
 */

import { Timestamp } from 'firebase/firestore';

const DB_NAME = 'learnxr-cache';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

/** Entries above this stringified size are not worth the quota; skip rather than evict. */
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;

const TIMESTAMP_MARKER = '__firestoreTimestamp';

interface StoredEntry {
  key: string;
  payload: string;
  storedAt: number;
  ttlMs: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[persistentCache] IndexedDB unavailable:', request.error);
        resolve(null);
      };
      // Firefox in private mode never settles the request; do not hang the caller.
      request.onblocked = () => resolve(null);
    } catch (error) {
      console.warn('[persistentCache] IndexedDB open failed:', error);
      resolve(null);
    }
  });

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const request = work(tx.objectStore(STORE_NAME));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => {
            console.warn('[persistentCache] Request failed:', request.error);
            resolve(null);
          };
        } catch (error) {
          console.warn('[persistentCache] Transaction failed:', error);
          resolve(null);
        }
      })
  );
}

/**
 * Replace Firestore Timestamps with a tagged plain object before serialising.
 *
 * Neither JSON nor the structured-clone algorithm preserves a class prototype, so a
 * Timestamp written naively comes back as `{seconds, nanoseconds}` and every
 * downstream `.toDate()` throws. Tagging them on the way out and rebuilding them on
 * the way in keeps a restored bundle identical in shape to a freshly fetched one.
 */
function encodeValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { [TIMESTAMP_MARKER]: { seconds: value.seconds, nanoseconds: value.nanoseconds } };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = encodeValue(nested);
    }
    return out;
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const tagged = record[TIMESTAMP_MARKER] as { seconds: number; nanoseconds: number } | undefined;
    if (tagged && typeof tagged.seconds === 'number' && typeof tagged.nanoseconds === 'number') {
      return new Timestamp(tagged.seconds, tagged.nanoseconds);
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      out[key] = decodeValue(nested);
    }
    return out;
  }
  return value;
}

/** Read a value, or null when absent, expired, or unreadable. */
export async function persistentGet<T>(key: string): Promise<T | null> {
  const entry = (await runTransaction<StoredEntry>('readonly', (store) =>
    store.get(key) as IDBRequest<StoredEntry>
  )) as StoredEntry | null;

  if (!entry) return null;

  if (entry.ttlMs > 0 && Date.now() - entry.storedAt > entry.ttlMs) {
    void persistentDelete(key);
    return null;
  }

  try {
    return decodeValue(JSON.parse(entry.payload)) as T;
  } catch (error) {
    console.warn('[persistentCache] Corrupt entry, dropping:', key, error);
    void persistentDelete(key);
    return null;
  }
}

/** Write a value. `ttlMs` of 0 means no expiry. Oversized values are skipped. */
export async function persistentSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  let payload: string;
  try {
    payload = JSON.stringify(encodeValue(value));
  } catch (error) {
    console.warn('[persistentCache] Value is not serialisable, not caching:', key, error);
    return;
  }

  if (payload.length > MAX_ENTRY_BYTES) {
    console.warn(`[persistentCache] Skipping ${key}: ${payload.length} bytes exceeds the entry cap.`);
    return;
  }

  await runTransaction('readwrite', (store) =>
    store.put({ key, payload, storedAt: Date.now(), ttlMs } satisfies StoredEntry)
  );
}

/**
 * Read-through cache for a derived lookup that is expensive to recompute.
 *
 * Intended for the "distinct values across a collection" queries: Firestore has no
 * DISTINCT, so answering them means reading documents — in the worst case the whole
 * of curriculum_chapters, whose documents are the largest in the database. The
 * answers change only when a chapter is created or re-tagged.
 */
export async function cachedLookup<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const cached = await persistentGet<T>(key);
  if (cached !== null) return cached;

  const value = await load();
  void persistentSet(key, value, ttlMs);
  return value;
}

export async function persistentDelete(key: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(key) as unknown as IDBRequest<undefined>);
}

/** Delete every entry whose key starts with `prefix`. Used to invalidate a chapter. */
export async function persistentDeleteByPrefix(prefix: string): Promise<void> {
  const keys = (await runTransaction<IDBValidKey[]>('readonly', (store) =>
    store.getAllKeys() as IDBRequest<IDBValidKey[]>
  )) as IDBValidKey[] | null;

  if (!keys) return;

  await Promise.all(
    keys
      .filter((key): key is string => typeof key === 'string' && key.startsWith(prefix))
      .map((key) => persistentDelete(key))
  );
}
