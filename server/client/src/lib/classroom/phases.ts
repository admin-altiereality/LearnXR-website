/**
 * Lesson phase helpers.
 *
 * There is one phase vocabulary now — `SessionLessonPhase`, the set stored in
 * Firestore — and both players use it directly. This file used to be `phaseMap`
 * and held translation tables between that set and a second vocabulary local to
 * XRLessonPlayerV3; unifying the names removed the translation and, with it, a
 * class of desynchronisation between what a player thought the phase was and
 * what the class was told.
 */

import type { SessionLessonPhase } from '../../types/lms';

/**
 * Phases that describe the player's own startup rather than a point in the
 * lesson. They must never be broadcast to a class or used to lock a student.
 */
export function isTransientPhase(phase: SessionLessonPhase | string | null | undefined): boolean {
  return !phase || phase === 'idle' || phase === 'loading';
}
