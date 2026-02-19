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
   */
  static getBundleKey(chapterId: string, topicId: string | undefined, lang: string): string {
    return `bundle:${chapterId}:${topicId || 'first'}:${lang}`;
  }
}

/** TTL for lesson bundle cache (10 minutes) - reduces Firebase reads across lesson pages */
export const LESSON_BUNDLE_CACHE_TTL_MS = 10 * 60 * 1000;

export const cacheManager = new CacheManager();
