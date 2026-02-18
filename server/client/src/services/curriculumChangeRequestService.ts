/**
 * Curriculum Change Request Service
 *
 * School/Principal requests a curriculum change; Super Admin reviews and approves.
 * Collection: curriculum_change_requests
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../utils/rbac';
import { toast } from 'react-toastify';

const COLLECTION = 'curriculum_change_requests';

export type CurriculumChangeRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Create a curriculum change request for a school.
 * Callable by school admin or principal for their school.
 */
export async function createCurriculumChangeRequest(
  profile: UserProfile | null,
  schoolId: string,
  requestedCurriculum: string,
  reason: string
): Promise<string | null> {
  if (!profile) {
    toast.error('Authentication required');
    return null;
  }

  if (!requestedCurriculum?.trim()) {
    toast.error('Please select a curriculum');
    return null;
  }

  try {
    const ref = await addDoc(collection(db, COLLECTION), {
      schoolId,
      requestedBy: profile.uid,
      requestedByEmail: profile.email ?? null,
      requestedCurriculum: requestedCurriculum.trim(),
      reason: reason?.trim() || null,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    toast.success('Curriculum change request submitted. Super Admin will review.');
    return ref.id;
  } catch (error) {
    console.error('createCurriculumChangeRequest:', error);
    toast.error('Failed to submit curriculum change request');
    return null;
  }
}
