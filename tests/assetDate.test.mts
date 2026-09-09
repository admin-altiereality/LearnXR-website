/**
 * Regression tests for dates in the studio's asset panels.
 *
 * Every asset showed "Invalid Date" under CREATED. `created_at` arrives as a
 * Firestore Timestamp, and `new Date(timestamp)` is an Invalid Date — the panel
 * printed that string verbatim, on every asset, in three different tabs.
 *
 * A cached or serialised document degrades the Timestamp into a plain
 * `{seconds, nanoseconds}` map, so that shape has to work too.
 *
 * Run: npx tsx --test tests/assetDate.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { formatAssetDate, toDateSafe } from '../server/client/src/utils/relativeTime.ts';

const MILLIS = Date.UTC(2026, 2, 14, 12, 0, 0); // 14 March 2026
const SECONDS = Math.floor(MILLIS / 1000);

test('a Firestore Timestamp resolves', () => {
  // What the SDK actually hands back.
  const timestamp = { seconds: SECONDS, nanoseconds: 0, toDate: () => new Date(MILLIS) };
  assert.equal(toDateSafe(timestamp)?.getTime(), MILLIS);
  assert.notEqual(formatAssetDate(timestamp), 'Invalid Date');
});

test('a Timestamp that lost its methods still resolves', () => {
  // Cached, or round-tripped through JSON: the map survives, toDate does not.
  assert.equal(toDateSafe({ seconds: SECONDS, nanoseconds: 0 })?.getTime(), MILLIS);
  assert.equal(toDateSafe({ _seconds: SECONDS })?.getTime(), MILLIS);
});

test('ISO strings, epoch millis and Dates all work', () => {
  assert.equal(toDateSafe(new Date(MILLIS).toISOString())?.getTime(), MILLIS);
  assert.equal(toDateSafe(MILLIS)?.getTime(), MILLIS);
  assert.equal(toDateSafe(new Date(MILLIS))?.getTime(), MILLIS);
});

test('nothing usable gives an em dash, never "Invalid Date"', () => {
  // "—" says there is no date. "Invalid Date" says something is broken, and
  // only one of those was ever true.
  for (const value of [null, undefined, '', 'not a date', {}, [], NaN]) {
    assert.equal(formatAssetDate(value), '—', `for ${JSON.stringify(value)}`);
    assert.equal(toDateSafe(value), null);
  }
});

test('a real date is formatted, not passed through', () => {
  const formatted = formatAssetDate({ seconds: SECONDS, nanoseconds: 0 });
  assert.match(formatted, /2026/);
  assert.ok(!formatted.includes('Invalid'));
});

test('an out-of-range Date object is treated as no date', () => {
  assert.equal(toDateSafe(new Date('nonsense')), null);
  assert.equal(formatAssetDate(new Date('nonsense')), '—');
});
