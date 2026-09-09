/**
 * sameProfile – whether two profile objects say the same thing.
 *
 * The signed-in user's document is watched with `onSnapshot`, and every snapshot
 * built a brand-new profile object. A new object identity meant every screen
 * depending on `profile` re-ran its effects — tearing down and re-subscribing
 * every dashboard query, each of which set `loading` back to true, which put a
 * full-page spinner over a page whose data was already correct. Anything that
 * touched the user document did that: an approval, a class assignment, a field
 * no screen even displays.
 *
 * Worse, one of those effects wrote `school_id` back to the very document it was
 * watching, so a teacher without one re-mounted their own dashboard on load.
 *
 * Comparing here lets the previous object survive a snapshot that changed
 * nothing, which is the difference between a live subscription that updates in
 * place and one that rebuilds the page.
 *
 * A shallow comparison is enough and stays cheap: the profile is flat apart from
 * two id arrays, and those are compared element by element rather than by
 * reference — Firestore rebuilds arrays on every read, so a reference check
 * would report a change on every snapshot and defeat the whole exercise.
 */

import type { UserProfile } from '../../utils/rbac';

/** Array fields, which need their contents compared rather than their identity. */
const ARRAY_FIELDS = ['class_ids', 'managed_class_ids'] as const;

function sameIds(a: unknown, b: unknown): boolean {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  // Order matters: these are stored lists, and a reorder is a real edit even
  // though it changes nothing about membership.
  return left.every((value, index) => value === right[index]);
}

/**
 * True when `next` carries the same values as `prev`.
 *
 * Both null is the same; one null is not. Extra keys on either side count as a
 * difference, so a field added to the profile later cannot be silently ignored
 * by a comparison that predates it.
 */
export function sameProfile(prev: UserProfile | null, next: UserProfile | null): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;

  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of keys) {
    if ((ARRAY_FIELDS as readonly string[]).includes(key)) {
      if (!sameIds((prev as any)[key], (next as any)[key])) return false;
      continue;
    }
    if ((prev as any)[key] !== (next as any)[key]) return false;
  }

  return true;
}
