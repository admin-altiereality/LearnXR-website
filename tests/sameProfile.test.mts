/**
 * Regression tests for profile identity stability.
 *
 * The app flickered because the signed-in user's document is watched with
 * `onSnapshot` and every snapshot built a brand-new profile object. A dozen
 * effects across six dashboards depended on that object, so any write to the
 * user document — an approval, a class assignment, a field nothing displays —
 * tore down and re-subscribed every dashboard query, each of which set `loading`
 * back to true, putting a full-page spinner over a page whose data was already
 * correct.
 *
 * One of those effects wrote `school_id` back to the very document it watched,
 * so a teacher without one re-mounted their own dashboard on load.
 *
 * These tests pin the comparison that lets an unchanged snapshot change nothing.
 *
 * Run: npx tsx --test tests/sameProfile.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { sameProfile } from '../server/client/src/lib/auth/sameProfile.ts';

const profile = (overrides: Record<string, any> = {}) =>
  ({
    uid: 'u1',
    email: 'teacher@example.com',
    displayName: 'A Teacher',
    name: 'A Teacher',
    role: 'teacher',
    approvalStatus: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    school_id: 'school1',
    class_ids: ['c1', 'c2'],
    managed_class_ids: ['c1'],
    isGuest: false,
    isDemo: false,
    ...overrides,
  }) as any;

test('two snapshots of an unchanged document compare equal', () => {
  // Firestore rebuilds the object every time; nothing about it changed.
  assert.equal(sameProfile(profile(), profile()), true);
});

test('arrays are compared by contents, not by identity', () => {
  // The reason this matters: Firestore rebuilds arrays on every read, so a
  // reference check would report a change on every single snapshot and defeat
  // the entire exercise.
  const a = profile({ class_ids: ['c1', 'c2'] });
  const b = profile({ class_ids: ['c1', 'c2'] });
  assert.notEqual(a.class_ids, b.class_ids, 'the fixtures really are separate arrays');
  assert.equal(sameProfile(a, b), true);
});

test('a real edit is not mistaken for noise', () => {
  const base = profile();
  assert.equal(sameProfile(base, profile({ school_id: 'school2' })), false, 'school_id');
  assert.equal(sameProfile(base, profile({ role: 'principal' })), false, 'role');
  assert.equal(sameProfile(base, profile({ approvalStatus: 'pending' })), false, 'approvalStatus');
  assert.equal(sameProfile(base, profile({ class_ids: ['c1'] })), false, 'a class removed');
  assert.equal(sameProfile(base, profile({ class_ids: ['c1', 'c2', 'c3'] })), false, 'one added');
});

test('reordering a class list counts as a change', () => {
  // These are stored lists; a reorder is a real edit even though membership is
  // identical, and pretending otherwise would hide it from every screen.
  assert.equal(
    sameProfile(profile({ class_ids: ['c1', 'c2'] }), profile({ class_ids: ['c2', 'c1'] })),
    false
  );
});

test('a field appearing or disappearing is a change', () => {
  const withField = profile({ managed_school_id: 'school9' });
  const without = profile();
  assert.equal(sameProfile(withField, without), false);
  assert.equal(sameProfile(without, withField), false);
});

test('a field added to the profile later cannot be silently ignored', () => {
  // The comparison walks the union of both key sets, so a field this test does
  // not know about still counts.
  const a = profile();
  const b = profile({ some_future_field: 'x' });
  assert.equal(sameProfile(a, b), false);
});

test('null handling', () => {
  assert.equal(sameProfile(null, null), true, 'signed out stays signed out');
  assert.equal(sameProfile(null, profile()), false, 'signing in is a change');
  assert.equal(sameProfile(profile(), null), false, 'signing out is a change');
});

test('the same object is trivially itself', () => {
  const p = profile();
  assert.equal(sameProfile(p, p), true);
});

test('a missing array reads the same as an empty one', () => {
  // Firestore omits empty arrays, so a teacher with no classes arrives as
  // undefined on one snapshot and [] on another. Treating that as a change
  // would re-subscribe every query for nothing.
  assert.equal(
    sameProfile(profile({ class_ids: undefined }), profile({ class_ids: [] })),
    true
  );
});
