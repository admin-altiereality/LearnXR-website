/**
 * Regression tests for the studio's 3D asset badge.
 *
 * The badge lit up whenever a topic had an asset id linked, which said nothing
 * about whether the asset could still be loaded. Since Meshy's newer release
 * most of the older assets are gone — the proxied link below answers 502 — so a
 * chapter full of dead models looked fully populated and there was no way to see
 * which content needed regenerating.
 *
 * Both URLs here are the real ones from the report, kept verbatim: the test is
 * only worth anything if it classifies the exact links the user is seeing.
 *
 * The judgement is deliberately the same function the players use to decide what
 * they can load, so the badge and the scene cannot disagree.
 *
 * Run: npx tsx --test tests/assetHealth.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assetBadgeState,
  classifyAsset,
  type AssetHealthMap,
} from '../server/client/src/lib/studio/assetHealth.ts';

/** The dead one: proxied Meshy CDN, answers 502. */
const BROKEN_URL =
  'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/proxy-asset?url=' +
  'https%3A%2F%2Fassets.meshy.ai%2F5003f053-5920-4f70-9627-6d12c86e4433%2Ftasks%2F' +
  '019d007b-8903-76e5-8eb1-658d41208689%2Foutput%2Fmodel.glb%3FExpires%3D4927392000';

/** The live one: served by our own render-asset route. */
const WORKING_URL =
  'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/render-asset/' +
  'L6awFFtAlXJX6BPePKcc/LWWzGY-V1jNZKNqtcobCnYhmUvGFbpr_/model.glb';

const health = (entries: Record<string, 'ok' | 'broken'>): AssetHealthMap =>
  new Map(Object.entries(entries));

test('the proxied Meshy link that 502s is broken', () => {
  assert.equal(classifyAsset({ id: 'a', render_url: BROKEN_URL, glb_url: BROKEN_URL }), 'broken');
});

test('the render-asset link is ok', () => {
  assert.equal(classifyAsset({ id: 'a', render_url: WORKING_URL }), 'ok');
});

test('a working URL in any of the fields the player reads counts', () => {
  for (const field of ['animated_render_url', 'render_url', 'glb_url', 'file_url']) {
    assert.equal(classifyAsset({ id: 'a', [field]: WORKING_URL }), 'ok', `via ${field}`);
  }
  assert.equal(classifyAsset({ id: 'a', model_urls: { glb: WORKING_URL } }), 'ok', 'via model_urls');
});

test('a retired asset is broken even with a perfectly good URL', () => {
  // Replaced in the studio: the file still resolves, but the lesson will never
  // show it, so neither should the badge.
  assert.equal(
    classifyAsset({ id: 'a', render_url: WORKING_URL, replaced_by_meshy_asset_id: 'b' }),
    'broken'
  );
  assert.equal(classifyAsset({ id: 'a', render_url: WORKING_URL, active: false }), 'broken');
});

test('an asset with no URL at all is broken', () => {
  assert.equal(classifyAsset({ id: 'a', name: 'Heart' }), 'broken');
  assert.equal(classifyAsset({}), 'broken');
});

test('nothing linked reads as none, not as broken', () => {
  // A topic that never had a model is not a topic that needs fixing.
  assert.equal(assetBadgeState([], health({})), 'none');
});

test('one working asset among broken ones lights the badge', () => {
  const state = assetBadgeState(
    ['a', 'b', 'c', 'd'],
    health({ a: 'broken', b: 'broken', c: 'ok', d: 'broken' })
  );
  assert.equal(state, 'ok', 'the topic has something to show');
});

test('every asset broken is its own state, distinct from having none', () => {
  const state = assetBadgeState(['a', 'b'], health({ a: 'broken', b: 'broken' }));
  assert.equal(state, 'broken');
  assert.notEqual(state, assetBadgeState([], health({})), 'the two must not look alike');
});

test('an id with no health entry counts as broken, not as fine', () => {
  // An id linked to an asset that no longer exists is exactly the reported case;
  // treating an unknown id as usable would keep the badge lit for it.
  assert.equal(assetBadgeState(['missing'], health({})), 'broken');
});

test('an inline image-to-3D model still counts', () => {
  // Stored on the chapter rather than in meshy_assets, so there is no document to
  // classify — its presence is all there is to go on, as before.
  assert.equal(assetBadgeState([], health({}), 'https://example.com/inline.glb'), 'ok');
  assert.equal(
    assetBadgeState(['a'], health({ a: 'broken' }), 'https://example.com/inline.glb'),
    'ok'
  );
});

test('blank ids are ignored rather than counted as broken', () => {
  assert.equal(assetBadgeState(['', null, undefined], health({})), 'none');
});
