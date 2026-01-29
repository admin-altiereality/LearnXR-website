/**
 * Data Scoping Utilities
 * 
 * Provides functions to scope data queries and filter results based on
 * user role and school/class assignments.
 */

import { Query, query, where, collection, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../utils/rbac';
import type { Student, Teacher, Principal } from '../types/lms';

/**
 * Scope students array by role
 * Filters students based on what the user can access
 */
export function scopeStudentsByRole(
  students: Student[],
  profile: UserProfile | null
): Student[] {
  if (!profile) return [];
  
  // Superadmin and admin can see all students
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return students;
  }
  
  // Student can only see themselves
  if (profile.role === 'student') {
    return students.filter(s => s.uid === profile.uid);
  }
  
  // Principal can see all students in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return students.filter(s => s.school_id === profile.managed_school_id);
  }
  
  // Teacher can see students in their classes
  if (profile.role === 'teacher' && profile.managed_class_ids) {
    const teacherClassIds = profile.managed_class_ids;
    return students.filter(s => 
      s.school_id === profile.school_id &&
      s.class_ids?.some(classId => teacherClassIds.includes(classId))
    );
  }
  
  return [];
}

/**
 * Scope classes array by role
 * Filters classes based on what the user can access
 */
export function scopeClassesByRole(
  classes: any[],
  profile: UserProfile | null
): any[] {
  if (!profile) return [];
  
  // Superadmin and admin can see all classes
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return classes;
  }
  
  // Principal can see all classes in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return classes.filter(c => c.school_id === profile.managed_school_id);
  }
  
  // Teacher can see classes they teach
  if (profile.role === 'teacher' && profile.managed_class_ids) {
    return classes.filter(c => profile.managed_class_ids?.includes(c.id));
  }
  
  // Student can see classes they're enrolled in
  if (profile.role === 'student' && profile.class_ids) {
    return classes.filter(c => profile.class_ids?.includes(c.id));
  }
  
  return [];
}

/**
 * Scope scores array by role
 * Filters scores based on what the user can access
 */
export function scopeScoresByRole(
  scores: any[],
  profile: UserProfile | null
): any[] {
  if (!profile) return [];
  
  // Superadmin and admin can see all scores
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return scores;
  }
  
  // Student can only see their own scores
  if (profile.role === 'student') {
    return scores.filter(s => s.student_id === profile.uid);
  }
  
  // Principal can see all scores in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return scores.filter(s => s.school_id === profile.managed_school_id);
  }
  
  // Teacher can see scores for students in their classes
  if (profile.role === 'teacher' && profile.managed_class_ids) {
    // This requires checking if the student is in teacher's classes
    // For now, filter by school_id - actual implementation would need
    // to cross-reference with student profiles
    return scores.filter(s => 
      s.school_id === profile.school_id &&
      (s.class_id && profile.managed_class_ids?.includes(s.class_id))
    );
  }
  
  return [];
}

/**
 * Build student query based on user profile
 * Returns a Firestore query scoped to accessible students
 */
export function buildStudentQuery(profile: UserProfile | null): Query | null {
  if (!profile) return null;
  
  const studentsRef = collection(db, 'users');
  
  // Superadmin and admin can query all students
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return query(studentsRef, where('role', '==', 'student'));
  }
  
  // Student can only query themselves
  if (profile.role === 'student') {
    return query(studentsRef, where('__name__', '==', profile.uid));
  }
  
  // Principal can query students in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return query(
      studentsRef,
      where('role', '==', 'student'),
      where('school_id', '==', profile.managed_school_id)
    );
  }
  
  // Teacher can query students in their classes
  if (profile.role === 'teacher' && profile.managed_class_ids && profile.school_id) {
    return query(
      studentsRef,
      where('role', '==', 'student'),
      where('school_id', '==', profile.school_id),
      where('class_ids', 'array-contains-any', profile.managed_class_ids)
    );
  }
  
  return null;
}

/**
 * Build class query based on user profile
 * Returns a Firestore query scoped to accessible classes
 */
export function buildClassQuery(profile: UserProfile | null): Query | null {
  if (!profile) return null;
  
  const classesRef = collection(db, 'classes');
  
  // Superadmin and admin can query all classes
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return query(classesRef);
  }
  
  // Principal can query classes in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return query(
      classesRef,
      where('school_id', '==', profile.managed_school_id)
    );
  }
  
  // Teacher can query classes they teach
  if (profile.role === 'teacher' && profile.managed_class_ids) {
    // Firestore doesn't support array-contains-any on document IDs
    // So we need to query by school_id and filter client-side
    if (profile.school_id) {
      return query(
        classesRef,
        where('school_id', '==', profile.school_id)
      );
    }
  }
  
  // Student can query classes they're enrolled in
  if (profile.role === 'student' && profile.class_ids) {
    // Similar limitation - query by school_id and filter client-side
    if (profile.school_id) {
      return query(
        classesRef,
        where('school_id', '==', profile.school_id)
      );
    }
  }
  
  return null;
}

/**
 * Build scores query based on user profile
 * Returns a Firestore query scoped to accessible scores
 */
export function buildScoresQuery(profile: UserProfile | null): Query | null {
  if (!profile) return null;
  
  const scoresRef = collection(db, 'student_scores');
  
  // Superadmin and admin can query all scores
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return query(scoresRef, orderBy('completed_at', 'desc'));
  }
  
  // Student can only query their own scores
  if (profile.role === 'student') {
    return query(
      scoresRef,
      where('student_id', '==', profile.uid),
      orderBy('completed_at', 'desc')
    );
  }
  
  // Principal can query scores in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return query(
      scoresRef,
      where('school_id', '==', profile.managed_school_id),
      orderBy('completed_at', 'desc')
    );
  }
  
  // Teacher can query scores for students in their classes
  if (profile.role === 'teacher' && profile.managed_class_ids && profile.school_id) {
    return query(
      scoresRef,
      where('school_id', '==', profile.school_id),
      where('class_id', 'in', profile.managed_class_ids),
      orderBy('completed_at', 'desc')
    );
  }
  
  return null;
}

/**
 * Build lesson launches query based on user profile
 * Returns a Firestore query scoped to accessible lesson launches
 */
export function buildLessonLaunchesQuery(profile: UserProfile | null): Query | null {
  if (!profile) return null;
  
  const launchesRef = collection(db, 'lesson_launches');
  
  // Superadmin and admin can query all launches
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return query(launchesRef, orderBy('launched_at', 'desc'));
  }
  
  // Student can only query their own launches
  if (profile.role === 'student') {
    return query(
      launchesRef,
      where('student_id', '==', profile.uid),
      orderBy('launched_at', 'desc')
    );
  }
  
  // Principal can query launches in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return query(
      launchesRef,
      where('school_id', '==', profile.managed_school_id),
      orderBy('launched_at', 'desc')
    );
  }
  
  // Teacher can query launches for students in their classes
  if (profile.role === 'teacher' && profile.managed_class_ids && profile.school_id) {
    return query(
      launchesRef,
      where('school_id', '==', profile.school_id),
      where('class_id', 'in', profile.managed_class_ids),
      orderBy('launched_at', 'desc')
    );
  }
  
  return null;
}
