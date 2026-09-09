/**
 * assetHealth – whether a linked 3D asset will actually appear in a lesson.
 *
 * The studio's 3D badge lit up whenever a topic had an asset id linked, which
 * said nothing about whether that asset could still be loaded. Since Meshy's
 * newer release most of the older assets are gone: a link of the shape
 *
 *   /api/proxy-asset?url=https%3A%2F%2Fassets.meshy.ai%2F…%2Fmodel.glb
 *
 * now answers 502, while a working one looks like
 *
 *   /api/render-asset/{assetId}/{token}/model.glb
 *
 * so a chapter full of dead models looked fully populated, and there was no way
 * to see which content needed regenerating.
 *
 * The judgement here is deliberately the SAME function the players use to decide
 * what they can load — `isShowableAsset`, which is `pickPlayerGlbUrl` (requiring
 * a `/render-asset/` `.glb`) plus the retired check. A badge that answered this
 * question its own way would be a fourth copy of the rule, and the last time
 * there were three copies the one that was missed put a replaced model in the
 * scene beside its replacement.
 *
 * It is structural, not a probe: the shape of the URL, not a request to it.
 * That is what makes it cheap enough to run for every row of a content list. The
 * deep scan in TextTo3DUnified stays as it is for actually reaching out to the
 * endpoints.
 */

import { isShowableAsset } from '../lesson/mergeLessonAssets';

const COLLECTION_MESHY_ASSETS = 'meshy_assets';

export type AssetHealth = 'ok' | 'broken';

/** How a whole topic's worth of assets reads on the badge. */
export type AssetBadgeState = 'none' | 'broken' | 'ok';

/** id -> health, for every id that was asked about. */
export type AssetHealthMap = Map<string, AssetHealth>;

/** Whether this one asset document would reach a lesson. */
export function classifyAsset(asset: any): AssetHealth {
  return isShowableAsset(asset) ? 'ok' : 'broken';
}

/**
 * Classify a set of linked asset ids.
 *
 * An id with no document counts as **broken** rather than being left out: a
 * topic linked to an asset that no longer exists is exactly the case being
 * reported, and dropping it would make the topic look like it had nothing linked
 * at all.
 */
export async function fetchAssetHealth(ids: string[]): Promise<AssetHealthMap> {
  const wanted = Array.from(new Set(ids.filter(Boolean).map(String)));
  const health: AssetHealthMap = new Map();
  if (wanted.length === 0) return health;

  // Every id starts broken and is promoted only by a document that passes.
  for (const id of wanted) health.set(id, 'broken');

  // Imported here rather than at the top so the classification above stays
  // free of Firestore — and therefore of the Vite environment it reads at
  // import time. `classifyAsset` and `assetBadgeState` are the parts worth
  // testing, and they should not need a browser to run.
  const { fetchDocsByIds } = await import('../firestore/fetchDocsByIds');
  const docs = await fetchDocsByIds(COLLECTION_MESHY_ASSETS, wanted, 'assetHealth');
  for (const asset of docs) {
    const id = String(asset?.id || '');
    if (id) health.set(id, classifyAsset(asset));
  }

  return health;
}

/**
 * How the badge should read for one topic.
 *
 * `none` and `broken` are kept apart on purpose. A topic that never had a model
 * and one whose models have all died look identical when both are simply dim,
 * and only the second needs someone to do something about it.
 */
export function assetBadgeState(
  linkedIds: Array<string | null | undefined>,
  health: AssetHealthMap,
  /** An inline image-to-3D model, which is a model like any other. */
  inlineAssetUrl?: string | null
): AssetBadgeState {
  const ids = linkedIds.filter(Boolean).map(String);
  if (ids.length === 0 && !inlineAssetUrl) return 'none';
  if (ids.some((id) => health.get(id) === 'ok')) return 'ok';
  // An inline asset is stored on the chapter rather than in meshy_assets, so
  // there is no document to classify; its presence is all we have.
  if (inlineAssetUrl) return 'ok';
  // Ids present, none of them usable — and, importantly, this also covers ids
  // the health map has never heard of, which are unresolved rather than fine.
  return 'broken';
}
