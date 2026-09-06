/**
 * assetUrls – deciding which URL of a 3D asset the player should actually load,
 * and whether an asset should be loaded at all.
 *
 * Lifted out of `services/firestore/getLessonBundle.ts`, where these lived as
 * module-private helpers. The lesson bundle normalised every asset through them
 * while the player, resolving the same assets a second way, used its own
 * hand-written precedence — so the two disagreed about which URL belonged to a
 * given asset, and the same model arrived twice under two different URLs. One
 * shared implementation makes them agree by construction rather than by
 * coincidence.
 */

/**
 * True for a URL the player can actually render.
 *
 * Assets carry several URLs: the provider's own CDN links, intermediate
 * previews, and the app's `/render-asset/` route. Only the last is stable,
 * authenticated and known to be a `.glb`, so it is the only one worth loading —
 * a provider URL may 404, expire, or serve a format the loader cannot read.
 */
export function isRenderAssetUrl(url: string): boolean {
  return typeof url === 'string' && url.includes('/render-asset/') && /\.glb(?:\?|$|\/?$)/i.test(url);
}

/**
 * The URL the player should load for this asset, or '' when it has none.
 *
 * Ordered best-first: an animated render beats a static one, and an explicit
 * `model_urls.glb` beats the looser legacy fields. Every candidate has to pass
 * `isRenderAssetUrl`, so an asset whose only links are provider URLs resolves to
 * '' and is skipped rather than failing halfway through a lesson.
 */
export function pickPlayerGlbUrl(asset: any): string {
  const candidates = [
    asset?.animated_render_url,
    asset?.render_url,
    asset?.model_urls?.glb,
    asset?.glb_url,
    asset?.file_url,
  ];
  const url = candidates.find((candidate) => isRenderAssetUrl(String(candidate || '')));
  return url ? String(url) : '';
}

/**
 * True for an asset that has been superseded and should no longer be shown.
 *
 * Retired assets are kept rather than deleted so existing lessons and reports
 * still resolve their ids, which means every reader has to filter them out.
 */
export function isRetiredMeshyAsset(asset: any): boolean {
  return Boolean(
    asset?.active === false ||
      asset?.status === 'replaced' ||
      asset?.replaced_by_meshy_asset_id ||
      (asset?.asset_repair_status === 'regenerated' && asset?.replaced_by_meshy_asset_id)
  );
}
