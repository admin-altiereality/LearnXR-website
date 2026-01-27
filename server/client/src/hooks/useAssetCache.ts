/**
 * useAssetCache Hook
 * 
 * Hook for caching assets with automatic invalidation
 */

import { useState, useEffect, useCallback } from 'react';
import { cacheManager, CacheManager } from '../utils/cacheManager';
import type { MeshyAssetExtended } from '../types/assets';

/**
 * Hook for asset caching
 */
export function useAssetCache(
  chapterId: string,
  topicId: string,
  language?: string
) {
  const cacheKey = CacheManager.getAssetListKey(chapterId, topicId, language);

  const getCached = useCallback((): MeshyAssetExtended[] | null => {
    return cacheManager.get<MeshyAssetExtended[]>(cacheKey);
  }, [cacheKey]);

  const setCached = useCallback(
    (assets: MeshyAssetExtended[]) => {
      cacheManager.set(cacheKey, assets, 5 * 60 * 1000); // 5 minutes TTL
    },
    [cacheKey]
  );

  const invalidate = useCallback(() => {
    cacheManager.delete(cacheKey);
    // Also invalidate individual asset caches for this topic
    cacheManager.invalidatePattern(`asset:.*`);
  }, [cacheKey]);

  const getCachedAsset = useCallback((assetId: string): MeshyAssetExtended | null => {
    const assetKey = CacheManager.getAssetKey(assetId);
    return cacheManager.get<MeshyAssetExtended>(assetKey);
  }, []);

  const setCachedAsset = useCallback((asset: MeshyAssetExtended) => {
    const assetKey = CacheManager.getAssetKey(asset.id);
    cacheManager.set(assetKey, asset, 10 * 60 * 1000); // 10 minutes TTL
  }, []);

  return {
    getCached,
    setCached,
    invalidate,
    getCachedAsset,
    setCachedAsset,
  };
}
