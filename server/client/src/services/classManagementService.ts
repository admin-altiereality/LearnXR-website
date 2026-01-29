/**
 * Class Management Service
 * 
 * Provides functions for creating classes and assigning students/teachers.
 * Access: School Administrator (their school), Principal (their school), Admin/Superadmin (all)
 */

import { collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { serverTimestamp } from 'firebase/firestore';
import type { Class } from '../types/lms';
import type { UserProfile } from '../utils/rbac';
import { toast } from 'react-toastify';

/**
 * Create a new class
 * Access: Principal (their school), Admin/Superadmin (all)
 */
export async function createClass(
  profile: UserProfile | null,
  classData: {
    school_id: string;
    class_name: string;
    curriculum: string;
    subject?: string;
    academic_year?: string;
  }
): Promise<string | null> {
  if (!profile) {
    toast.error('Authentication required');
    return null;
  }

  // Permission check - school/principal can only create for their school
  const mySchoolId = profile.managed_school_id || profile.school_id;
  if ((profile.role === 'school' || profile.role === 'principal') && mySchoolId !== classData.school_id) {
    toast.error('You can only create classes for your own school');
    return null;
  }

  if (profile.role !== 'school' && profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Only school administrators, principals and admins can create classes');
    return null;
  }

  try {
    const classRef = doc(collection(db, 'classes'));
    const newClass: Omit<Class, 'id'> = {
      school_id: classData.school_id,
      class_name: classData.class_name,
      curriculum: classData.curriculum,
      subject: classData.subject,
      teacher_ids: [],
      student_ids: [],
      academic_year: classData.academic_year,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      createdBy: profile.uid,
    };

    await setDoc(classRef, newClass);
    toast.success(`Class "${classData.class_name}" created successfully`);
    return classRef.id;
  } catch (error: any) {
    console.error('Error creating class:', error);
    toast.error(`Failed to create class: ${error.message}`);
    return null;
  }
}

/**
 * Assign student to class
 * Updates both class.student_ids and user.class_ids
 */
export async function assignStudentToClass(
  profile: UserProfile | null,
  studentId: string,
  classId: string
): Promise<boolean> {
  if (!profile) {
    toast.error('Authentication required');
    return false;
  }

  // Permission check - principal/admin can assign, or teacher if they teach the class
  if (profile.role === 'teacher') {
    if (!profile.managed_class_ids?.includes(classId)) {
      toast.error('You can only assign students to your own classes');
      return false;
    }
  } else if (profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Insufficient permissions to assign students');
    return false;
  }

  try {
    // Get class to verify school_id
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
      toast.error('Class not found');
      return false;
    }

    const classData = classDoc.data();
    
    // Get student to verify school_id
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    if (!studentDoc.exists()) {
      toast.error('Student not found');
      return false;
    }

    const studentData = studentDoc.data();
    
    // Verify same school
    if (classData.school_id !== studentData.school_id) {
      toast.error('Student and class must be in the same school');
      return false;
    }

    // Update class.student_ids
    await updateDoc(doc(db, 'classes', classId), {
      student_ids: arrayUnion(studentId),
      updatedAt: serverTimestamp(),
    });

    // Update user.class_ids
    await updateDoc(doc(db, 'users', studentId), {
      class_ids: arrayUnion(classId),
      updatedAt: serverTimestamp(),
    });

    toast.success('Student assigned to class successfully');
    return true;
  } catch (error: any) {
    console.error('Error assigning student to class:', error);
    toast.error(`Failed to assign student: ${error.message}`);
    return false;
  }
}

/**
 * Remove student from class
 */
export async function removeStudentFromClass(
  profile: UserProfile | null,
  studentId: string,
  classId: string
): Promise<boolean> {
  if (!profile) {
    toast.error('Authentication required');
    return false;
  }

  // Permission check
  if (profile.role === 'teacher') {
    if (!profile.managed_class_ids?.includes(classId)) {
      toast.error('You can only remove students from your own classes');
      return false;
    }
  } else if (profile.role !== 'school' && profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Insufficient permissions');
    return false;
  }

  try {
    // Update class.student_ids
    await updateDoc(doc(db, 'classes', classId), {
      student_ids: arrayRemove(studentId),
      updatedAt: serverTimestamp(),
    });

    // Update user.class_ids
    await updateDoc(doc(db, 'users', studentId), {
      class_ids: arrayRemove(classId),
      updatedAt: serverTimestamp(),
    });

    toast.success('Student removed from class successfully');
    return true;
  } catch (error: any) {
    console.error('Error removing student from class:', error);
    toast.error(`Failed to remove student: ${error.message}`);
    return false;
  }
}

/**
 * Assign teacher to class
 * Updates both class.teacher_ids and user.managed_class_ids
 */
export async function assignTeacherToClass(
  profile: UserProfile | null,
  teacherId: string,
  classId: string
): Promise<boolean> {
  if (!profile) {
    toast.error('Authentication required');
    return false;
  }

  // Only principal/admin can assign teachers
  if (profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Only principals and admins can assign teachers');
    return false;
  }

  try {
    // Get class to verify school_id
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
      toast.error('Class not found');
      return false;
    }

    const classData = classDoc.data();
    
    // Get teacher to verify school_id
    const teacherDoc = await getDoc(doc(db, 'users', teacherId));
    if (!teacherDoc.exists()) {
      toast.error('Teacher not found');
      return false;
    }

    const teacherData = teacherDoc.data();
    
    // Verify same school
    if (classData.school_id !== teacherData.school_id) {
      toast.error('Teacher and class must be in the same school');
      return false;
    }

    // Verify teacher role
    if (teacherData.role !== 'teacher') {
      toast.error('User is not a teacher');
      return false;
    }

    // Update class.teacher_ids
    await updateDoc(doc(db, 'classes', classId), {
      teacher_ids: arrayUnion(teacherId),
      updatedAt: serverTimestamp(),
    });

    // Update user.managed_class_ids
    await updateDoc(doc(db, 'users', teacherId), {
      managed_class_ids: arrayUnion(classId),
      updatedAt: serverTimestamp(),
    });

    toast.success('Teacher assigned to class successfully');
    return true;
  } catch (error: any) {
    console.error('Error assigning teacher to class:', error);
    toast.error(`Failed to assign teacher: ${error.message}`);
    return false;
  }
}

/**
 * Remove teacher from class
 */
export async function removeTeacherFromClass(
  profile: UserProfile | null,
  teacherId: string,
  classId: string
): Promise<boolean> {
  if (!profile) {
    toast.error('Authentication required');
    return false;
  }

  // School administrator, principal, or admin can remove teachers
  if (profile.role !== 'school' && profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    toast.error('Insufficient permissions');
    return false;
  }

  try {
    // Update class.teacher_ids
    await updateDoc(doc(db, 'classes', classId), {
      teacher_ids: arrayRemove(teacherId),
      updatedAt: serverTimestamp(),
    });

    // Update user.managed_class_ids
    await updateDoc(doc(db, 'users', teacherId), {
      managed_class_ids: arrayRemove(classId),
      updatedAt: serverTimestamp(),
    });

    toast.success('Teacher removed from class successfully');
    return true;
  } catch (error: any) {
    console.error('Error removing teacher from class:', error);
    toast.error(`Failed to remove teacher: ${error.message}`);
    return false;
  }
}

/**
 * Get all classes for a school
 */
export async function getSchoolClasses(
  profile: UserProfile | null,
  schoolId: string
): Promise<Class[]> {
  if (!profile) return [];

  // Permission check - school/principal can only get their school's classes
  const mySchoolId = profile.managed_school_id || profile.school_id;
  if ((profile.role === 'school' || profile.role === 'principal') && mySchoolId !== schoolId) {
    return [];
  }

  if (profile.role !== 'school' && profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
    return [];
  }

  try {
    const classesQuery = query(
      collection(db, 'classes'),
      where('school_id', '==', schoolId)
    );
    const snapshot = await getDocs(classesQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Class[];
  } catch (error) {
    console.error('Error fetching school classes:', error);
    return [];
  }
}
