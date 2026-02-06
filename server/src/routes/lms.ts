/**
 * LMS (Learning Management System) API Routes
 * 
 * Provides endpoints for student, teacher, and principal dashboards
 * with strict role-based and school-based access control.
 */

import express from 'express';
import * as admin from 'firebase-admin';
import { db, isFirebaseInitialized } from '../config/firebase-admin';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import {
  requireRole,
  requireSchoolAccess,
  requireClassAccess,
  requireStudentAccess,
  canAccessSchool,
  canAccessStudent,
  canAccessClass,
} from '../middleware/rbacMiddleware';
import * as evaluationService from '../services/evaluationService';

const router = express.Router();

console.log('LMS routes being initialized...');

// All LMS routes require authentication
router.use(verifyFirebaseToken);

/**
 * Get student scores
 * GET /api/lms/students/:studentId/scores
 * Access: Student (own), Teacher (their students), Principal (their school), Admin/Superadmin (all)
 */
router.get('/students/:studentId/scores', requireStudentAccess(), async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const scoresSnapshot = await db
      .collection('student_scores')
      .where('student_id', '==', studentId)
      .orderBy('completed_at', 'desc')
      .get();

    const scores = scoresSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: scores,
    });
  } catch (error: any) {
    console.error('Error fetching student scores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student scores',
      message: error.message,
    });
  }
});

/**
 * Get student progress/lesson launches
 * GET /api/lms/students/:studentId/progress
 * Access: Student (own), Teacher (their students), Principal (their school), Admin/Superadmin (all)
 */
router.get('/students/:studentId/progress', requireStudentAccess(), async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const launchesSnapshot = await db
      .collection('lesson_launches')
      .where('student_id', '==', studentId)
      .orderBy('launched_at', 'desc')
      .get();

    const progress = launchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student progress',
      message: error.message,
    });
  }
});

/**
 * Get student evaluation (aggregated scores, attempts, completion by subject/topic)
 * GET /api/lms/students/:studentId/evaluation
 * Query: fromDate (ISO), toDate (ISO), limit (number, default 200, max 500)
 * Access: Student (own), Teacher (their students), Principal (their school), Admin/Superadmin (all)
 */
router.get('/students/:studentId/evaluation', requireStudentAccess(), async (req, res) => {
  try {
    const { studentId } = req.params;
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
    const limitParam = req.query.limit;
    const limit = limitParam !== undefined ? Math.min(Number(limitParam) || 200, 500) : undefined;

    const evaluation = await evaluationService.getStudentEvaluation(studentId, {
      fromDate,
      toDate,
      limit,
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found',
      });
    }

    res.json({
      success: true,
      data: evaluation,
    });
  } catch (error: unknown) {
    console.error('Error fetching student evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student evaluation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get students in a class
 * GET /api/lms/classes/:classId/students
 * Access: Teacher (their classes), Principal (their school), Admin/Superadmin (all)
 */
router.get('/classes/:classId/students', requireClassAccess(), async (req, res) => {
  try {
    const { classId } = req.params;
    
    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    // Get class document
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Class not found',
      });
    }

    const classData = classDoc.data();
    const studentIds = classData?.student_ids || [];

    if (studentIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Fetch student profiles (in batches if needed)
    const students = [];
    for (const studentId of studentIds) {
      const studentDoc = await db.collection('users').doc(studentId).get();
      if (studentDoc.exists) {
        students.push({
          uid: studentDoc.id,
          ...studentDoc.data(),
        });
      }
    }

    res.json({
      success: true,
      data: students,
    });
  } catch (error: any) {
    console.error('Error fetching class students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class students',
      message: error.message,
    });
  }
});

/**
 * Get class evaluation (aggregated scores, attempts, completion, by-student summaries)
 * GET /api/lms/classes/:classId/evaluation
 * Query: fromDate (ISO), toDate (ISO), limit (number)
 * Access: Teacher (their classes), Principal (their school), Admin/Superadmin (all)
 */
router.get('/classes/:classId/evaluation', requireClassAccess(), async (req, res) => {
  try {
    const { classId } = req.params;
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
    const limitParam = req.query.limit;
    const limit = limitParam !== undefined ? Math.min(Number(limitParam) || 200, 500) : undefined;

    const evaluation = await evaluationService.getClassEvaluation(classId, {
      fromDate,
      toDate,
      limit,
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Class not found',
      });
    }

    res.json({
      success: true,
      data: evaluation,
    });
  } catch (error: unknown) {
    console.error('Error fetching class evaluation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class evaluation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get class analytics
 * GET /api/lms/classes/:classId/analytics
 * Access: Teacher (their classes), Principal (their school), Admin/Superadmin (all)
 */
router.get('/classes/:classId/analytics', requireClassAccess(), async (req, res) => {
  try {
    const { classId } = req.params;
    
    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    // Get all scores for students in this class
    const scoresSnapshot = await db
      .collection('student_scores')
      .where('class_id', '==', classId)
      .get();

    const scores = scoresSnapshot.docs.map(doc => doc.data());

    // Calculate analytics
    const totalAttempts = scores.length;
    const totalStudents = new Set(scores.map(s => s.student_id)).size;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    
    const completionRate = scores.length > 0
      ? (scores.filter(s => s.score?.percentage >= 70).length / scores.length) * 100
      : 0;

    res.json({
      success: true,
      data: {
        classId,
        totalAttempts,
        totalStudents,
        averageScore: Math.round(averageScore),
        completionRate: Math.round(completionRate),
        scores,
      },
    });
  } catch (error: any) {
    console.error('Error fetching class analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class analytics',
      message: error.message,
    });
  }
});

/**
 * Get teacher's classes
 * GET /api/lms/teachers/:teacherId/classes
 * Access: Teacher (own), Principal (their school), Admin/Superadmin (all)
 */
router.get('/teachers/:teacherId/classes', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const profile = req.userProfile;
    
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Check access: teacher can see own, principal/admin can see all in school
    if (profile.role === 'teacher' && profile.uid !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Can only view own classes',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    // If principal, scope to their school
    let query: admin.firestore.Query = db.collection('classes');
    
    if (profile.role === 'principal' && profile.managed_school_id) {
      query = query.where('school_id', '==', profile.managed_school_id);
    } else if (profile.role === 'teacher') {
      query = query.where('teacher_ids', 'array-contains', teacherId);
    } else if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      });
    }

    const classesSnapshot = await query.get();
    const classes = classesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: classes,
    });
  } catch (error: any) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teacher classes',
      message: error.message,
    });
  }
});

/**
 * Get teacher's students
 * GET /api/lms/teachers/:teacherId/students
 * Access: Teacher (own students), Principal (their school), Admin/Superadmin (all)
 */
router.get('/teachers/:teacherId/students', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const profile = req.userProfile;
    
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Check access
    if (profile.role === 'teacher' && profile.uid !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Can only view own students',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    // Get teacher's classes
    const classesSnapshot = await db
      .collection('classes')
      .where('teacher_ids', 'array-contains', teacherId)
      .get();

    const classIds = classesSnapshot.docs.map(doc => doc.id);

    if (classIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Get students in those classes
    const studentsSnapshot = await db
      .collection('users')
      .where('role', '==', 'student')
      .where('class_ids', 'array-contains-any', classIds)
      .get();

    const students = studentsSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: students,
    });
  } catch (error: any) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teacher students',
      message: error.message,
    });
  }
});

/**
 * Get school teachers
 * GET /api/lms/schools/:schoolId/teachers
 * Access: Principal (their school), Admin/Superadmin (all)
 */
router.get('/schools/:schoolId/teachers', requireSchoolAccess(), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const profile = req.userProfile;
    
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Only principal, admin, superadmin can access
    if (profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only principals and admins can view school teachers',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const teachersSnapshot = await db
      .collection('users')
      .where('role', '==', 'teacher')
      .where('school_id', '==', schoolId)
      .get();

    const teachers = teachersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: teachers,
    });
  } catch (error: any) {
    console.error('Error fetching school teachers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch school teachers',
      message: error.message,
    });
  }
});

/**
 * Get school students
 * GET /api/lms/schools/:schoolId/students
 * Access: Principal (their school), Admin/Superadmin (all)
 */
router.get('/schools/:schoolId/students', requireSchoolAccess(), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const profile = req.userProfile;
    
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Only principal, admin, superadmin can access
    if (profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only principals and admins can view school students',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const studentsSnapshot = await db
      .collection('users')
      .where('role', '==', 'student')
      .where('school_id', '==', schoolId)
      .get();

    const students = studentsSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: students,
    });
  } catch (error: any) {
    console.error('Error fetching school students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch school students',
      message: error.message,
    });
  }
});

/**
 * Get school analytics
 * GET /api/lms/schools/:schoolId/analytics
 * Access: Principal (their school), Admin/Superadmin (all)
 */
router.get('/schools/:schoolId/analytics', requireSchoolAccess(), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const profile = req.userProfile;
    
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Only principal, admin, superadmin can access
    if (profile.role !== 'principal' && profile.role !== 'admin' && profile.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only principals and admins can view school analytics',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    // Get all scores for students in this school
    const scoresSnapshot = await db
      .collection('student_scores')
      .where('school_id', '==', schoolId)
      .get();

    const scores = scoresSnapshot.docs.map(doc => doc.data());

    // Get all lesson launches
    const launchesSnapshot = await db
      .collection('lesson_launches')
      .where('school_id', '==', schoolId)
      .get();

    const launches = launchesSnapshot.docs.map(doc => doc.data());

    // Calculate analytics
    const totalStudents = new Set(scores.map(s => s.student_id)).size;
    const totalTeachers = (await db
      .collection('users')
      .where('role', '==', 'teacher')
      .where('school_id', '==', schoolId)
      .get()).size;
    
    const totalAttempts = scores.length;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    
    const completionRate = scores.length > 0
      ? (scores.filter(s => s.score?.percentage >= 70).length / scores.length) * 100
      : 0;

    const totalLessonLaunches = launches.length;
    const completedLessons = launches.filter(l => l.completion_status === 'completed').length;

    res.json({
      success: true,
      data: {
        schoolId,
        totalStudents,
        totalTeachers,
        totalAttempts,
        averageScore: Math.round(averageScore),
        completionRate: Math.round(completionRate),
        totalLessonLaunches,
        completedLessons,
        lessonCompletionRate: totalLessonLaunches > 0
          ? Math.round((completedLessons / totalLessonLaunches) * 100)
          : 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching school analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch school analytics',
      message: error.message,
    });
  }
});

export default router;
