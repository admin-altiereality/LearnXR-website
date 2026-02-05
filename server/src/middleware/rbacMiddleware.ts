/**
 * RBAC (Role-Based Access Control) Middleware
 * 
 * Provides authorization middleware for Express routes to enforce
 * role-based and school-based data access control.
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { getAdminApp } from '../config/firebase-admin';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
      userProfile?: {
        uid: string;
        role: string;
        school_id?: string;
        class_ids?: string[];
        teacher_id?: string;
        managed_class_ids?: string[];
        managed_school_id?: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * User roles in the system
 */
export type UserRole = 'student' | 'teacher' | 'principal' | 'admin' | 'superadmin' | 'school' | 'associate';

/**
 * Interface for user profile
 */
export interface UserProfile {
  uid: string;
  role: UserRole;
  school_id?: string;
  class_ids?: string[];
  teacher_id?: string;
  managed_class_ids?: string[];
  managed_school_id?: string;
  [key: string]: any;
}

/**
 * Fetch user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const adminApp = getAdminApp();
    if (!adminApp) {
      throw new Error('Admin app not initialized');
    }

    const db = admin.firestore(adminApp);
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return null;
    }

    const data = userDoc.data();
    return {
      uid,
      role: data?.role || 'student',
      school_id: data?.school_id,
      class_ids: data?.class_ids,
      teacher_id: data?.teacher_id,
      managed_class_ids: data?.managed_class_ids,
      managed_school_id: data?.managed_school_id,
      ...data,
    } as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Verify user can access school data
 */
export function canAccessSchool(userProfile: UserProfile, schoolId: string): boolean {
  if (!userProfile || !schoolId) return false;
  
  // Superadmin and admin can access all schools
  if (userProfile.role === 'superadmin' || userProfile.role === 'admin') {
    return true;
  }
  
  // Principal can access their managed school
  if (userProfile.role === 'principal' && userProfile.managed_school_id === schoolId) {
    return true;
  }
  
  // Teacher and student can access their own school
  if (userProfile.school_id === schoolId) {
    return true;
  }
  
  return false;
}

/**
 * Verify teacher/principal can access student data
 */
export async function canAccessStudent(
  requesterProfile: UserProfile,
  studentId: string
): Promise<boolean> {
  if (!requesterProfile || !studentId) return false;
  
  // Student can access their own data
  if (requesterProfile.uid === studentId) {
    return true;
  }
  
  // Superadmin and admin can access all students
  if (requesterProfile.role === 'superadmin' || requesterProfile.role === 'admin') {
    return true;
  }
  
  // Fetch student profile
  const studentProfile = await getUserProfile(studentId);
  if (!studentProfile) {
    return false;
  }
  
  // Principal can access students in their school
  if (requesterProfile.role === 'principal' && 
      requesterProfile.managed_school_id === studentProfile.school_id) {
    return true;
  }
  
  // Teacher can access students in their classes
  if (requesterProfile.role === 'teacher' && 
      requesterProfile.school_id === studentProfile.school_id) {
    const teacherClassIds = requesterProfile.managed_class_ids || [];
    const studentClassIds = studentProfile.class_ids || [];
    
    // Check if student is in any of teacher's classes
    return teacherClassIds.some(classId => studentClassIds.includes(classId));
  }
  
  return false;
}

/**
 * Verify user can access class data
 */
export function canAccessClass(userProfile: UserProfile, classId: string, classSchoolId: string): boolean {
  if (!userProfile || !classId || !classSchoolId) return false;
  
  // Check school access first
  if (!canAccessSchool(userProfile, classSchoolId)) {
    return false;
  }
  
  // Superadmin and admin can access all classes
  if (userProfile.role === 'superadmin' || userProfile.role === 'admin') {
    return true;
  }
  
  // Principal can access all classes in their school
  if (userProfile.role === 'principal' && 
      userProfile.managed_school_id === classSchoolId) {
    return true;
  }
  
  // Teacher can access classes they teach
  if (userProfile.role === 'teacher' && 
      userProfile.managed_class_ids?.includes(classId)) {
    return true;
  }
  
  // Student can access classes they're enrolled in
  if (userProfile.role === 'student' && 
      userProfile.class_ids?.includes(classId)) {
    return true;
  }
  
  return false;
}

/**
 * Middleware to require specific roles
 */
export function requireRole(roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const profile = await getUserProfile(req.user.uid);
      if (!profile) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User profile not found',
        });
      }

      if (!roles.includes(profile.role as UserRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Required role: ${roles.join(' or ')}`,
        });
      }

      req.userProfile = profile;
      next();
    } catch (error: any) {
      console.error('Role check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify role',
      });
    }
  };
}

/**
 * Middleware to require school access
 * Expects school_id in req.params or req.query
 */
export function requireSchoolAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const schoolId = req.params.schoolId || req.query.schoolId;
      if (!schoolId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'school_id is required',
        });
      }

      const profile = await getUserProfile(req.user.uid);
      if (!profile) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User profile not found',
        });
      }

      if (!canAccessSchool(profile, schoolId as string)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this school',
        });
      }

      req.userProfile = profile;
      next();
    } catch (error: any) {
      console.error('School access check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify school access',
      });
    }
  };
}

/**
 * Middleware to require class access
 * Expects classId in req.params or req.query, and classSchoolId in the class document
 */
export function requireClassAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const classId = req.params.classId || req.query.classId;
      if (!classId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'class_id is required',
        });
      }

      const profile = await getUserProfile(req.user.uid);
      if (!profile) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User profile not found',
        });
      }

      // Fetch class document to get school_id
      const adminApp = getAdminApp();
      if (!adminApp) {
        throw new Error('Admin app not initialized');
      }

      const db = admin.firestore(adminApp);
      const classDoc = await db.collection('classes').doc(classId as string).get();
      
      if (!classDoc.exists) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Class not found',
        });
      }

      const classData = classDoc.data();
      const classSchoolId = classData?.school_id;

      if (!classSchoolId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Class does not have a school_id',
        });
      }

      if (!canAccessClass(profile, classId as string, classSchoolId)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this class',
        });
      }

      req.userProfile = profile;
      next();
    } catch (error: any) {
      console.error('Class access check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify class access',
      });
    }
  };
}

/**
 * Middleware to require student access
 * Expects studentId in req.params or req.query
 */
export function requireStudentAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const studentId = req.params.studentId || req.query.studentId;
      if (!studentId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'student_id is required',
        });
      }

      const profile = await getUserProfile(req.user.uid);
      if (!profile) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User profile not found',
        });
      }

      const hasAccess = await canAccessStudent(profile, studentId as string);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this student data',
        });
      }

      req.userProfile = profile;
      next();
    } catch (error: any) {
      console.error('Student access check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify student access',
      });
    }
  };
}

/**
 * Helper to scope Firestore query by school
 */
export function scopeQueryBySchool(query: admin.firestore.Query, schoolId: string): admin.firestore.Query {
  return query.where('school_id', '==', schoolId);
}

/**
 * Helper to scope Firestore query by class
 */
export function scopeQueryByClass(query: admin.firestore.Query, classId: string): admin.firestore.Query {
  return query.where('class_id', '==', classId);
}
