/**
 * LMS (Learning Management System) API Routes for Firebase Functions
 * 
 * Provides endpoints for student, teacher, and principal dashboards
 * with strict role-based and school-based access control.
 * 
 * Note: This mirrors the server/src/routes/lms.ts implementation
 * for Firebase Functions deployment.
 */

import express from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser } from '../middleware/auth';
import {
  requireSchoolAccess,
  requireStudentAccess,
  requireClassAccess,
} from '../middleware/rbac';
import { getClassEvaluation } from '../services/evaluationService';

const router = express.Router();

console.log('LMS routes (Functions) being initialized...');

// All LMS routes require authentication
router.use(authenticateUser);

/**
 * Get student scores
 * GET /api/lms/students/:studentId/scores
 */
router.get('/students/:studentId/scores', requireStudentAccess(), async (req, res) => {
  try {
    const { studentId } = req.params;
    const db = admin.firestore();

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
 */
router.get('/students/:studentId/progress', requireStudentAccess(), async (req, res) => {
  try {
    const { studentId } = req.params;
    const db = admin.firestore();

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
 * Get class evaluation (aggregated scores, attempts, completion, by-student summaries)
 * GET /api/lms/classes/:classId/evaluation
 * Query: fromDate (ISO), toDate (ISO), limit (number)
 */
router.get('/classes/:classId/evaluation', requireClassAccess(), async (req, res) => {
  try {
    const { classId } = req.params;
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
    const limitParam = req.query.limit;
    const limit = limitParam !== undefined ? Math.min(Number(limitParam) || 200, 500) : undefined;

    const evaluation = await getClassEvaluation(classId, { fromDate, toDate, limit });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Class not found',
      });
    }

    return res.json({
      success: true,
      data: evaluation,
    });
  } catch (error: any) {
    console.error('Error fetching class evaluation:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch class evaluation',
      message: error?.message || 'Unknown error',
    });
  }
});

/**
 * Get school analytics
 * GET /api/lms/schools/:schoolId/analytics
 */
router.get('/schools/:schoolId/analytics', requireSchoolAccess(), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const profile = req.userProfile;
    const db = admin.firestore();
    
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
    const totalStudents = new Set(scores.map((s: any) => s.student_id)).size;
    const totalTeachers = (await db
      .collection('users')
      .where('role', '==', 'teacher')
      .where('school_id', '==', schoolId)
      .get()).size;
    
    const totalAttempts = scores.length;
    const averageScore = scores.length > 0
      ? scores.reduce((sum: number, s: any) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    
    const completionRate = scores.length > 0
      ? (scores.filter((s: any) => s.score?.percentage >= 70).length / scores.length) * 100
      : 0;

    const totalLessonLaunches = launches.length;
    const completedLessons = launches.filter((l: any) => l.completion_status === 'completed').length;

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch school analytics',
      message: error.message,
    });
  }
});

export default router;
