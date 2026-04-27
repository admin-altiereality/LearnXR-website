/**
 * Question Paper Autofill
 *
 * Reads the current user's profile, school, and (optionally) class documents
 * to prefill the question-paper header. Falls back gracefully when data is
 * missing.
 */

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { getSchoolById } from './schoolManagementService';
import type { Class, School } from '../types/lms';
import type { UserProfile } from '../utils/rbac';
import type { SchoolHeader } from '../types/questionPaper';

export interface AutofillResult {
  school: SchoolHeader;
  class_name?: string;
  class_id?: string;
  curriculum?: string;
  subject?: string;
  teacher_name?: string;
  primary_language?: string;
}

async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { uid, ...(snap.data() as Omit<UserProfile, 'uid'>) };
  } catch (err) {
    console.warn('[questionPaperAutofill] Failed to load user profile:', err);
    return null;
  }
}

async function loadClass(classId: string): Promise<Class | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'classes', classId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Class, 'id'>) } as Class;
  } catch (err) {
    console.warn('[questionPaperAutofill] Failed to load class:', err);
    return null;
  }
}

export interface AutofillOptions {
  /** Optional explicit class id to prefer (from a chapter) */
  classId?: string;
  /** Optional subject hint (from a chapter) */
  subject?: string;
  /** Optional curriculum hint (from a chapter) */
  curriculum?: string;
  /** Optional class name hint (from a chapter) */
  className?: string;
}

export async function getQuestionPaperAutofill(opts: AutofillOptions = {}): Promise<AutofillResult> {
  const uid = auth.currentUser?.uid;
  const email = auth.currentUser?.email ?? undefined;
  const displayName = auth.currentUser?.displayName ?? undefined;

  const profile = uid ? await loadUserProfile(uid) : null;

  // Resolve school details --------------------------------------------------
  let school: School | null = null;
  const schoolId = profile?.school_id || profile?.managed_school_id;
  if (schoolId) {
    school = await getSchoolById(schoolId);
  }

  const schoolHeader: SchoolHeader = school
    ? {
        name: school.name || profile?.school || '',
        address:
          [school.address, school.city, school.state, school.pincode].filter(Boolean).join(', ') || undefined,
        board: school.boardAffiliation || opts.curriculum || undefined,
      }
    : {
        name: profile?.school || '',
        board: opts.curriculum || undefined,
      };

  // Resolve class details ---------------------------------------------------
  let klass: Class | null = null;
  const classId =
    opts.classId ||
    profile?.class_ids?.[0] ||
    profile?.managed_class_ids?.[0] ||
    undefined;
  if (classId) {
    klass = await loadClass(classId);
  }

  const teacherName = profile?.name || profile?.displayName || displayName || (email ?? '').split('@')[0];

  return {
    school: schoolHeader,
    class_name: opts.className || klass?.class_name || profile?.class || undefined,
    class_id: classId,
    curriculum: opts.curriculum || klass?.curriculum || profile?.curriculum || undefined,
    subject: opts.subject || klass?.subject || undefined,
    teacher_name: teacherName,
    primary_language: undefined,
  };
}
