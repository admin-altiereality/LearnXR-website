/**
 * Regression tests for which 3D assets a lesson puts in the scene.
 *
 * The bug these pin down: asset discovery de-duplicated on the GLB URL, but the
 * lesson bundle and the topic's asset ids describe the SAME Firestore
 * documents. The bundle normalises their URLs through `pickPlayerGlbUrl`,
 * blanking anything the player cannot render; a raw re-read of the document
 * does not. So one asset arrived twice under two different URLs and appeared
 * twice in the scene — and because the player keys its group map on the asset
 * id, the second copy overwrote the first there and became invisible to the
 * model tools. Present on screen, deaf to Explode, Isolate and Section.
 *
 * The other half of the story is that merging still has to happen: an asset
 * linked ONLY through the topic's ids was invisible before, which is what the
 * merge was introduced to fix. Collapsing duplicates must not bring that back.
 *
 * Run: npx tsx --test tests/lessonAssets.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeLessonAssets,
  unresolvedAssetIds,
} from '../server/client/src/lib/lesson/mergeLessonAssets.ts';

/** A URL the player can actually load. */
const renderUrl = (id: string) => `https://example.com/render-asset/${id}/tok/model.glb`;
/** A provider URL the bundle deliberately rejects. */
const rawUrl = (id: string) => `https://assets.meshy.ai/${id}/output/model.glb`;

/** An asset as the bundle emits it: normalised, provider URLs already blanked. */
function bundled(id: string, name = 'Heart') {
  return {
    id,
    name,
    animated_render_url: '',
    animated_glb_url: '',
    render_url: renderUrl(id),
    glb_url: renderUrl(id),
    file_url: renderUrl(id),
    model_urls: { glb: renderUrl(id) },
  };
}

/** The same asset as it sits in Firestore: raw, un-normalised. */
function rawDoc(id: string, name = 'Heart') {
  return {
    id,
    data: {
      name,
      // The field that caused the duplicate: a provider URL the bundle blanks
      // but a raw read would happily take.
      animated_render_url: rawUrl(id),
      stored_glb_url: rawUrl(id),
      render_url: renderUrl(id),
      glb_url: renderUrl(id),
      model_urls: { glb: renderUrl(id) },
    },
  };
}

test('an asset seen through both the bundle and the ids appears once', () => {
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart')],
    resolvedDocs: [rawDoc('heart')],
  });

  assert.equal(merged.length, 1, 'the same asset must not arrive twice');
  assert.equal(merged[0].id, 'heart');
});

test('a provider URL never displaces the renderable one', () => {
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart')],
    resolvedDocs: [rawDoc('heart')],
  });

  assert.equal(
    merged[0].glbUrl,
    renderUrl('heart'),
    'the normalised /render-asset/ URL is the one the player can load'
  );
});

test('an asset the bundle never carried still appears', () => {
  // The manual-upload case: linked on the topic, absent from the bundle. This
  // is what merging was introduced to fix and must not regress.
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart')],
    resolvedDocs: [rawDoc('lungs', 'Lungs')],
  });

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((a) => a.id).sort(),
    ['heart', 'lungs'],
    'both the bundled and the linked-only asset should load'
  );
});

test('an asset whose only URLs are provider links is skipped, not half-loaded', () => {
  const merged = mergeLessonAssets({
    resolvedDocs: [
      { id: 'broken', data: { name: 'Broken', animated_render_url: rawUrl('broken') } },
    ],
  });

  assert.equal(merged.length, 0, 'nothing renderable means nothing to place');
});

test('two ids pointing at the same file collapse to one model', () => {
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart')],
    // ClassLaunchRouter copies bundle URLs onto the topic; the same file under a
    // second identity is still one model in the room.
    assetUrls: [renderUrl('heart')],
    assetIds: ['heart_copy'],
  });

  assert.equal(merged.length, 1, 'one file, one model');
  assert.equal(merged[0].id, 'heart', 'the bundle entry is the one that survives');
});

test('a URL-only asset keeps the id the topic gave it', () => {
  const merged = mergeLessonAssets({
    assetUrls: [renderUrl('solo')],
    assetIds: ['solo'],
  });

  assert.equal(merged.length, 1);
  assert.equal(
    merged[0].id,
    'solo',
    'a real id, so the same asset arriving from elsewhere can be recognised'
  );
});

test('a URL with no id falls back to the URL, never to its position', () => {
  const first = mergeLessonAssets({ assetUrls: [renderUrl('a'), renderUrl('b')] });
  const reordered = mergeLessonAssets({ assetUrls: [renderUrl('b'), renderUrl('a')] });

  // A positional id (`asset_url_0`) would make the same asset look different
  // depending on where it happened to sit in the list.
  assert.deepEqual(
    first.map((a) => a.id).sort(),
    reordered.map((a) => a.id).sort(),
    'identity must not depend on ordering'
  );
});

test('only ids the bundle has not already resolved are fetched', () => {
  const lessonData = {
    assets3d: [bundled('heart')],
    topic: { meshy_asset_ids: ['heart', 'lungs'] },
    chapter: { meshy_asset_ids: ['lungs', 'brain'] },
  };

  assert.deepEqual(
    unresolvedAssetIds(lessonData).sort(),
    ['brain', 'lungs'],
    'the bundled asset needs no second read, and a duplicate id is read once'
  );
});

test('an image-to-3D conversion is included alongside the rest', () => {
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart')],
    image3d: { imageasset_id: 'img1', imagemodel_glb: renderUrl('img1') },
  });

  assert.equal(merged.length, 2);
  assert.ok(
    merged.some((a) => a.id === 'img1'),
    'the image conversion is a model like any other'
  );
});

// ---------------------------------------------------------------------------
// Retired assets.
//
// A regenerated model keeps its original: the document is retired rather than
// deleted so old lessons and reports still resolve the id, and nothing ever
// removes that id from the topic. getLessonBundle excludes retired assets, so
// the replacement arrives through the bundle and the original does not — which
// is exactly why the merge then fetched the original straight from Firestore and
// put it in the scene beside its replacement. Two different ids, two genuinely
// different files, so neither the id nor the URL guard could catch it.
// ---------------------------------------------------------------------------

/** The original, after being regenerated: still linked, no longer showable. */
function retiredDoc(id: string, replacementId: string) {
  const doc = rawDoc(id);
  (doc.data as any).replaced_by_meshy_asset_id = replacementId;
  (doc.data as any).asset_repair_status = 'regenerated';
  return doc;
}

test('a replaced model does not appear beside its replacement', () => {
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart_v2')],
    resolvedDocs: [retiredDoc('heart_v1', 'heart_v2')],
  });

  assert.equal(merged.length, 1, 'one model, not the old one and the new one');
  assert.equal(merged[0].id, 'heart_v2', 'and it is the replacement');
});

test('every way of retiring an asset is honoured', () => {
  for (const retire of [
    { replaced_by_meshy_asset_id: 'other' },
    { active: false },
    { status: 'replaced' },
    { asset_repair_status: 'regenerated', replaced_by_meshy_asset_id: 'other' },
  ]) {
    const doc = rawDoc('old');
    Object.assign(doc.data as any, retire);
    const merged = mergeLessonAssets({ resolvedDocs: [doc] });
    assert.equal(
      merged.length,
      0,
      `an asset marked ${JSON.stringify(retire)} must not reach the scene`
    );
  }
});

test('a retired asset in the bundle is refused there too', () => {
  // The bundle already filters, but the player must not depend on that: one rule
  // applied by every reader is what stops the two drifting apart again.
  const stale = bundled('old');
  (stale as any).active = false;
  assert.equal(mergeLessonAssets({ bundleAssets: [stale] }).length, 0);
});

test('a lesson whose only asset was replaced shows nothing, not the old model', () => {
  const merged = mergeLessonAssets({
    resolvedDocs: [retiredDoc('only_v1', 'only_v2')],
  });
  assert.equal(merged.length, 0, 'an empty dock beats a model the studio retired');
});

test('retiring one asset does not hide the others', () => {
  const merged = mergeLessonAssets({
    bundleAssets: [bundled('heart'), bundled('lungs', 'Lungs')],
    resolvedDocs: [retiredDoc('heart_v0', 'heart')],
  });
  assert.deepEqual(merged.map((a) => a.id).sort(), ['heart', 'lungs']);
});
