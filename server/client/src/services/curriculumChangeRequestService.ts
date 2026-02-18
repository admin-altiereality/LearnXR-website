/**
 * Curriculum Change Request Service
 *
 * Schools can request a curriculum change. Super Admin approves/rejects.
 * Curriculum is fixed at school onboarding (boardAffiliation).
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getSchoolById, updateSchool } from './schoolManagementService';
import type { UserProfile } from '../utils/rbac';
import { toast } from 'react-toastify';

export interface CurriculumChangeRequest {
  id: string;
  school_id: string;
  school_name?: string;
  requested_curriculum: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

export type CurriculumChangeRequestStatus = 'pending' | 'approved' | 'rejected';

const COLLECTION = 'curriculum_change_requests';

/**
 * Create a curriculum change request (School Admin / Principal)
 */
export async function createCurriculumChangeRequest(
  profile: UserProfile | null,
  schoolId: string,
  requestedCurriculum: string,
  reason?: string
): Promise<string | null> {
  if (!profile) {
    toast.error('Authentication required');
    return null;
  }

  const schoolIdForUser =
    profile.role === 'principal'
      ? profile.managed_school_id
      : profile.school_id || profile.managed_school_id;

  if (profile.role !== 'school' && profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Only school administrators and principals can request curriculum changes');
    return null;
  }

  if (profile.role !== 'admin' && profile.role !== 'superadmin' && schoolIdForUser !== schoolId) {
    toast.error('You can only request changes for your own school');
    return null;
  }

  if (!requestedCurriculum?.trim()) {
    toast.error('Requested curriculum is required');
    return null;
  }

  try {
    const school = await getSchoolById(schoolId);
    if (!school) {
      toast.error('School not found');
      return null;
    }

    if ((school.boardAffiliation || '').toUpperCase() === requestedCurriculum.trim().toUpperCase()) {
      toast.error('School already has this curriculum');
      return null;
    }

    const ref = doc(collection(db, COLLECTION));
    await setDoc(ref, {
      school_id: schoolId,
      school_name: school.name,
      requested_curriculum: requestedCurriculum.trim().toUpperCase(),
      reason: reason?.trim() || '',
      status: 'pending',
      requested_by: profile.uid,
      requested_at: serverTimestamp(),
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
    });

    toast.success('Curriculum change request submitted. Super Admin will review.');
    return ref.id;
  } catch (error: any) {
    console.error('Error creating curriculum change request:', error);
    toast.error(`Failed to submit request: ${error.message}`);
    return null;
  }
}

/**
 * Get pending curriculum change requests (Super Admin only)
 */
export async function getPendingCurriculumChangeRequests(
  profile: UserProfile | null
): Promise<CurriculumChangeRequest[]> {
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return [];
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      requested_at: (d.data().requested_at as any)?.toDate?.()?.toISOString?.() || d.data().requested_at,
    })) as CurriculumChangeRequest[];
    requests.sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
    return requests;
  } catch (error) {
    console.error('Error fetching curriculum change requests:', error);
    return [];
  }
}

/**
 * Approve a curriculum change request (Super Admin only)
 */
export async function approveCurriculumChangeRequest(
  profile: UserProfile | null,
  requestId: string,
  reviewNotes?: string
): Promise<boolean> {
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    toast.error('Only Super Admin can approve curriculum change requests');
    return false;
  }

  try {
    const ref = doc(db, COLLECTION, requestId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data()?.status !== 'pending') {
      toast.error('Request not found or already processed');
      return false;
    }

    const data = snap.data();
    const schoolId = data.school_id;
    const requestedCurriculum = data.requested_curriculum;

    await updateSchool(profile, schoolId, { boardAffiliation: requestedCurriculum });

    await updateDoc(ref, {
      status: 'approved',
      reviewed_by: profile.uid,
      reviewed_at: serverTimestamp(),
      review_notes: reviewNotes?.trim() || '',
    });

    toast.success('Curriculum change approved. School updated.');
    return true;
  } catch (error: any) {
    console.error('Error approving curriculum change request:', error);
    toast.error(`Failed to approve: ${error.message}`);
    return false;
  }
}

/**
 * Reject a curriculum change request (Super Admin only)
 */
export async function rejectCurriculumChangeRequest(
  profile: UserProfile | null,
  requestId: string,
  reviewNotes?: string
): Promise<boolean> {
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    toast.error('Only Super Admin can reject curriculum change requests');
    return false;
  }

  try {
    const ref = doc(db, COLLECTION, requestId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data()?.status !== 'pending') {
      toast.error('Request not found or already processed');
      return false;
    }

    await updateDoc(ref, {
      status: 'rejected',
      reviewed_by: profile.uid,
      reviewed_at: serverTimestamp(),
      review_notes: reviewNotes?.trim() || '',
    });

    toast.success('Curriculum change request rejected');
    return true;
  } catch (error: any) {
    console.error('Error rejecting curriculum change request:', error);
    toast.error(`Failed to reject: ${error.message}`);
    return false;
  }
}
