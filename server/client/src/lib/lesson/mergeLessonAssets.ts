/**
 * mergeLessonAssets – the one list of 3D assets a lesson should put in the scene.
 *
 * A lesson describes its models in four different places, and the player has to
 * read all of them: an asset linked only through the topic's ids was invisible
 * when discovery stopped at the first source that returned anything.
 *
 * But merging is only half the job. Two of those sources — the lesson bundle and
 * the topic's asset ids — describe the SAME Firestore documents. The bundle has
 * already normalised them through `pickPlayerGlbUrl`, blanking any URL the
 * player cannot render; a raw re-read of the document has not. De-duplicating on
 * the URL therefore let one asset through twice under two different URLs, which
 * is why the same model appeared several times in the scene.
 *
 * So identity here is the ASSET ID, never the URL. A URL is only a fallback
 * identity for entries that genuinely have no id, and it is the URL itself
 * rather than a position in a list — a positional `asset_url_0` can never match
 * the real id of the same asset arriving from somewhere else.
 *
 * Ordered best-first, first writer wins: the bundle is the most normalised view
 * of an asset, so it should be the one that survives a collision.
 */

import { isRetiredMeshyAsset, pickPlayerGlbUrl } from './assetUrls';

export interface LessonAsset {
  id: string;
  glbUrl: string;
  name: string;
  thumbnailUrl?: string;
}

/** One asset document as it arrives from Firestore, resolved by id. */
export interface ResolvedAssetDoc {
  id: string;
  data: any;
}

export interface MergeInput {
  /** `lessonData.assets3d` — already normalised by getLessonBundle. */
  bundleAssets?: any[];
  /** `topic.asset_urls`, with `topic.asset_ids` alongside where present. */
  assetUrls?: string[];
  assetIds?: string[];
  /** `lessonData.image3dasset`. */
  image3d?: any;
  /** Documents fetched for the topic's and chapter's `meshy_asset_ids`. */
  resolvedDocs?: ResolvedAssetDoc[];
}

/**
 * Asset ids that the topic lists but the bundle did not already carry.
 *
 * Split out from the merge because fetching them is async and the merge is not.
 * Returning the full list rather than the difference would re-read documents the
 * bundle has already resolved, for no gain.
 */
export function unresolvedAssetIds(lessonData: any): string[] {
  const linked: string[] = [
    ...(lessonData?.topic?.meshy_asset_ids || []),
    ...(lessonData?.chapter?.meshy_asset_ids || []),
  ].filter(Boolean).map(String);

  const alreadyBundled = new Set<string>(
    (Array.isArray(lessonData?.assets3d) ? lessonData.assets3d : [])
      .map((asset: any) => String(asset?.id || ''))
      .filter(Boolean)
  );

  return Array.from(new Set(linked)).filter((id) => !alreadyBundled.has(id));
}

/**
 * Whether this asset should be shown at all.
 *
 * A regenerated model keeps its original alongside the replacement: the asset
 * document is retired rather than deleted so old lessons and reports still
 * resolve the id, and nothing ever removes that id from the topic —
 * `arrayRemove` is not used for meshy assets anywhere in the codebase.
 *
 * getLessonBundle has always excluded retired assets, so the replacement comes
 * through the bundle and the original does not. This merge used to fetch the
 * original straight from Firestore precisely BECAUSE the bundle had rejected it,
 * and put it in the scene beside its replacement — the same model, visibly
 * twice, under two different ids pointing at two genuinely different files,
 * which is why de-duplicating on id and on URL both failed to catch it.
 *
 * One rule, applied by every reader.
 */
export function isShowableAsset(asset: any): boolean {
  return !isRetiredMeshyAsset(asset) && Boolean(pickPlayerGlbUrl(asset));
}

/** Everything the lesson knows about, each model exactly once. */
export function mergeLessonAssets(input: MergeInput): LessonAsset[] {
  const byId = new Map<string, LessonAsset>();
  // Two different ids can still name the same file — a topic URL alongside the
  // asset it was copied from. One model in the scene either way.
  const seenUrls = new Set<string>();

  const add = (asset: LessonAsset) => {
    if (!asset.glbUrl || !asset.id) return;
    if (byId.has(asset.id) || seenUrls.has(asset.glbUrl)) return;
    byId.set(asset.id, asset);
    seenUrls.add(asset.glbUrl);
  };

  // Source 1: the lesson bundle. Most normalised, so it wins any collision.
  for (const asset of input.bundleAssets ?? []) {
    if (!isShowableAsset(asset)) continue;
    add({
      id: String(asset?.id || ''),
      glbUrl: pickPlayerGlbUrl(asset),
      name: asset?.name || asset?.prompt || 'Asset',
      thumbnailUrl: asset?.thumbnail_url || asset?.thumbnailUrl || '',
    });
  }

  // Source 2: raw URLs on the topic. ClassLaunchRouter writes `asset_ids`
  // alongside these, so the real id is usually available and the URL fallback
  // rarely fires.
  const urls = input.assetUrls ?? [];
  const ids = input.assetIds ?? [];
  urls.forEach((url, index) => {
    const url_ = String(url || '');
    if (!url_) return;
    add({
      id: String(ids[index] || '') || `url:${url_}`,
      glbUrl: url_,
      name: `Asset ${index + 1}`,
    });
  });

  // Source 3: an image-to-3D conversion attached to the lesson.
  const img3d = input.image3d;
  if (img3d) {
    const url = String(img3d.imagemodel_glb || img3d.imageasset_url || '');
    add({
      id: String(img3d.imageasset_id || '') || (url ? `url:${url}` : ''),
      glbUrl: url,
      name: 'Image 3D Asset',
    });
  }

  // Source 4: documents resolved from the topic's ids. Put through the same
  // picker AND the same retired filter as the bundle — reading the raw fields in
  // a different order is what produced a second URL for an asset already in the
  // list, and skipping the retired check is what put a replaced model in the
  // scene beside the one that replaced it.
  for (const doc of input.resolvedDocs ?? []) {
    if (!isShowableAsset(doc.data)) continue;
    add({
      id: String(doc.id),
      glbUrl: pickPlayerGlbUrl(doc.data),
      name: doc.data?.name || doc.data?.prompt || 'Asset',
      thumbnailUrl: doc.data?.thumbnail_url || doc.data?.thumbnailUrl || '',
    });
  }

  return Array.from(byId.values());
}
