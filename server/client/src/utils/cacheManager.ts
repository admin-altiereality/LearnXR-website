/**
 * Cache Manager
 * 
 * Simple in-memory cache for assets with TTL
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Delete cached data
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache key for assets
   */
  static getAssetListKey(chapterId: string, topicId: string, language?: string): string {
    return `assets:${chapterId}:${topicId}:${language || 'en'}`;
  }

  /**
   * Get cache key for single asset
   */
  static getAssetKey(assetId: string): string {
    return `asset:${assetId}`;
  }

  /**
   * Get cache key for lesson bundle (getLessonBundle).
   * Use topicId || 'first' when no specific topic.
   *
   * `source` is part of the identity because a curriculum chapter and a
   * user-generated lesson are different documents in different collections that can
   * share an id, and they build materially different bundles.
   *
   * The viewer's role deliberately is NOT part of the key: the cached bundle is the
   * published one, and an Associate's draft is overlaid onto a copy at read time
   * (see cloneBundleForOverlay in getLessonBundle.ts) rather than being cached.
   */
  static getBundleKey(
    chapterId: string,
    topicId: string | undefined,
    lang: string,
    source: string = 'curriculum'
  ): string {
    return `bundle:${chapterId}:${topicId || 'first'}:${lang}:${source}`;
  }

  /** Cache key for the licensed-content links attached to a lesson. */
  static getLicensedLinksKey(chapterId: string, topicId: string): string {
    return `licensed:${chapterId}:${topicId}`;
  }
}

/** TTL for lesson bundle cache (10 minutes) - reduces Firebase reads across lesson pages */
export const LESSON_BUNDLE_CACHE_TTL_MS = 10 * 60 * 1000;

export const cacheManager = new CacheManager();
