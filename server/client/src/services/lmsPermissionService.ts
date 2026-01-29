/**
 * LMS Permission Service
 * 
 * Provides permission checking functions for the frontend to determine
 * what data a user can access based on their role and school/class assignments.
 */

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../utils/rbac';

/**
 * Check if user can view a specific student's data
 */
export async function canViewStudent(
  profile: UserProfile | null,
  studentId: string
): Promise<boolean> {
  if (!profile) return false;
  
  // Student can view their own data
  if (profile.uid === studentId) {
    return true;
  }
  
  // Superadmin and admin can view all students
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return true;
  }
  
  // Fetch student profile to check school/class access
  try {
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    if (!studentDoc.exists()) {
      return false;
    }
    
    const studentData = studentDoc.data();
    
    // Principal can view students in their school
    if (profile.role === 'principal' && 
        profile.managed_school_id === studentData.school_id) {
      return true;
    }
    
    // Teacher can view students in their classes
    if (profile.role === 'teacher' && 
        profile.school_id === studentData.school_id) {
      const teacherClassIds = profile.managed_class_ids || [];
      const studentClassIds = studentData.class_ids || [];
      
      // Check if student is in any of teacher's classes
      return teacherClassIds.some(classId => studentClassIds.includes(classId));
    }
    
    return false;
  } catch (error) {
    console.error('Error checking student access:', error);
    return false;
  }
}

/**
 * Check if user can view a specific class
 */
export async function canViewClass(
  profile: UserProfile | null,
  classId: string
): Promise<boolean> {
  if (!profile) return false;
  
  // Superadmin and admin can view all classes
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return true;
  }
  
  try {
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
      return false;
    }
    
    const classData = classDoc.data();
    const classSchoolId = classData.school_id;
    
    if (!classSchoolId) {
      return false;
    }
    
    // Principal can view all classes in their school
    if (profile.role === 'principal' && 
        profile.managed_school_id === classSchoolId) {
      return true;
    }
    
    // Teacher can view classes they teach
    if (profile.role === 'teacher' && 
        profile.school_id === classSchoolId &&
        profile.managed_class_ids?.includes(classId)) {
      return true;
    }
    
    // Student can view classes they're enrolled in
    if (profile.role === 'student' && 
        profile.school_id === classSchoolId &&
        profile.class_ids?.includes(classId)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking class access:', error);
    return false;
  }
}

/**
 * Check if user can view a specific school
 */
export function canViewSchool(
  profile: UserProfile | null,
  schoolId: string
): boolean {
  if (!profile || !schoolId) return false;
  
  // Superadmin and admin can view all schools
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    return true;
  }
  
  // Principal can view their managed school
  if (profile.role === 'principal' && profile.managed_school_id === schoolId) {
    return true;
  }
  
  // Teacher and student can view their own school
  if (profile.school_id === schoolId) {
    return true;
  }
  
  return false;
}

/**
 * Get list of student IDs that the user can access
 */
export async function getAccessibleStudents(
  profile: UserProfile | null
): Promise<string[]> {
  if (!profile) return [];
  
  // Superadmin and admin can access all students
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    const studentsSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'student'))
    );
    return studentsSnapshot.docs.map(doc => doc.id);
  }
  
  // Student can only access their own data
  if (profile.role === 'student') {
    return [profile.uid];
  }
  
  // Principal can access all students in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    const studentsSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('school_id', '==', profile.managed_school_id)
      )
    );
    return studentsSnapshot.docs.map(doc => doc.id);
  }
  
  // Teacher can access students in their classes
  if (profile.role === 'teacher' && profile.managed_class_ids) {
    const classIds = profile.managed_class_ids;
    
    // Get all students in teacher's classes
    const studentsSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('class_ids', 'array-contains-any', classIds)
      )
    );
    
    // Filter to ensure students are in teacher's school
    return studentsSnapshot.docs
      .filter(doc => doc.data().school_id === profile.school_id)
      .map(doc => doc.id);
  }
  
  return [];
}

/**
 * Get list of class IDs that the user can access
 */
export async function getAccessibleClasses(
  profile: UserProfile | null
): Promise<string[]> {
  if (!profile) return [];
  
  // Superadmin and admin can access all classes
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    return classesSnapshot.docs.map(doc => doc.id);
  }
  
  // Principal can access all classes in their school
  if (profile.role === 'principal' && profile.managed_school_id) {
    const classesSnapshot = await getDocs(
      query(
        collection(db, 'classes'),
        where('school_id', '==', profile.managed_school_id)
      )
    );
    return classesSnapshot.docs.map(doc => doc.id);
  }
  
  // Teacher can access classes they teach
  if (profile.role === 'teacher' && profile.managed_class_ids) {
    return profile.managed_class_ids;
  }
  
  // Student can access classes they're enrolled in
  if (profile.role === 'student' && profile.class_ids) {
    return profile.class_ids;
  }
  
  return [];
}

/**
 * Get list of school IDs that the user can access
 */
export function getAccessibleSchools(profile: UserProfile | null): string[] {
  if (!profile) return [];
  
  // Superadmin and admin can access all schools
  if (profile.role === 'superadmin' || profile.role === 'admin') {
    // Return empty array - will need to fetch all schools separately
    // This is a placeholder - actual implementation would fetch all schools
    return [];
  }
  
  // Principal can access their managed school
  if (profile.role === 'principal' && profile.managed_school_id) {
    return [profile.managed_school_id];
  }
  
  // Teacher and student can access their own school
  if (profile.school_id) {
    return [profile.school_id];
  }
  
  return [];
}
