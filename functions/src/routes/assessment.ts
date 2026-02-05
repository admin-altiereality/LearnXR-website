/**
 * Automated Assessment & Evaluation Routes (Firebase Functions)
 * Create assessments, list by class/student, submit attempts, auto-grade
 */

import express from 'express';
import * as admin from 'firebase-admin';
import { getUserProfile, canAccessClass, type UserProfile } from '../middleware/rbac';
import * as assessmentService from '../services/assessmentService';

const router = express.Router();

// Attach user profile for all assessment routes
router.use(async (req, res, next) => {
  if (!req.user?.uid) return next();
  try {
    const profile = await getUserProfile(req.user.uid);
    req.userProfile = profile ?? undefined;
  } catch (_) {}
  next();
});

/**
 * POST /assessment
 * Create a new assessment (teacher or admin for their class)
 */
router.post('/', async (req, res) => {
  try {
    if (!req.user?.uid) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const profile = req.userProfile ?? await getUserProfile(req.user.uid);
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, student).',
      });
    }

    const { title, description, classId, schoolId, subject, curriculum, questions, passingPercentage } = req.body;
    if (!classId || !schoolId) {
      return res.status(400).json({ success: false, error: 'classId and schoolId are required' });
    }
    const db = admin.firestore();
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return res.status(404).json({ success: false, error: 'Class not found' });
    const classSchoolId = classDoc.data()?.school_id;
    if (!classSchoolId) return res.status(400).json({ success: false, error: 'Class has no school_id' });
    if (!canAccessClass(profile as UserProfile, classId, classSchoolId)) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'title, classId, schoolId, and questions (array) are required',
      });
    }

    const assessment = await assessmentService.createAssessment({
      title,
      description,
      classId,
      schoolId,
      createdBy: profile.uid,
      subject,
      curriculum,
      questions,
      passingPercentage: passingPercentage ?? 70,
    });
    return res.status(201).json({ success: true, data: assessment });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Create assessment error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create assessment',
      message: err.message,
    });
  }
});

/**
 * GET /assessment/class/:classId
 */
router.get('/class/:classId', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found.',
      });
    }
    const classId = req.params.classId;
    const db = admin.firestore();
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return res.status(404).json({ success: false, error: 'Class not found' });
    const classSchoolId = classDoc.data()?.school_id;
    if (!classSchoolId) return res.status(400).json({ success: false, error: 'Class has no school_id' });
    if (!canAccessClass(profile as UserProfile, classId, classSchoolId)) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }
    const list = await assessmentService.listAssessmentsByClass(classId);
    return res.json({ success: true, data: list });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('List assessments by class error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to list assessments',
      message: err.message,
    });
  }
});

/**
 * GET /assessment/student/me
 */
router.get('/student/me', async (req, res) => {
  try {
    const profile = req.userProfile;
    const roleNorm = (profile?.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!profile || roleNorm !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can use this endpoint' });
    }
    const classIds = profile.class_ids || [];
    const list = await assessmentService.listAssessmentsForStudent(classIds);
    return res.json({ success: true, data: list });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('List assessments for student error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to list assessments',
      message: err.message,
    });
  }
});

/**
 * GET /assessment/student/me/attempts
 */
router.get('/student/me/attempts', async (req, res) => {
  try {
    const profile = req.userProfile;
    const roleNorm = (profile?.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!profile || roleNorm !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can use this endpoint' });
    }
    const attempts = await assessmentService.getAttemptsByStudent(profile.uid);
    return res.json({ success: true, data: attempts });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get student attempts error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch attempts',
      message: err.message,
    });
  }
});

/**
 * GET /assessment/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found.',
      });
    }
    const assessment = await assessmentService.getAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }
    const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (roleNorm === 'student') {
      const classIds = profile.class_ids || [];
      if (!classIds.includes(assessment.classId)) {
        return res.status(403).json({ success: false, error: 'You do not have access to this assessment' });
      }
    } else {
      const teacherClassIds = profile.managed_class_ids || [];
      const principalSchool = profile.managed_school_id;
      const canSee =
        ['admin', 'superadmin'].includes(roleNorm) ||
        teacherClassIds.includes(assessment.classId) ||
        (roleNorm === 'principal' && principalSchool === assessment.schoolId);
      if (!canSee) {
        return res.status(403).json({ success: false, error: 'You do not have access to this assessment' });
      }
    }
    return res.json({ success: true, data: assessment });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get assessment error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch assessment',
      message: err.message,
    });
  }
});

/**
 * POST /assessment/:id/submit
 */
router.post('/:id/submit', async (req, res) => {
  try {
    const profile = req.userProfile;
    const roleNorm = (profile?.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!profile || (roleNorm !== 'student' && roleNorm !== 'superadmin')) {
      return res.status(403).json({ success: false, error: 'Only students and super admins can submit attempts' });
    }
    const assessment = await assessmentService.getAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }
    const classIds = profile.class_ids || [];
    const isSuperadmin = roleNorm === 'superadmin';
    if (!isSuperadmin && !classIds.includes(assessment.classId)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this assessment' });
    }
    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, error: 'answers object is required' });
    }
    const attempt = await assessmentService.submitAttempt(
      req.params.id,
      profile.uid,
      assessment.classId,
      assessment.schoolId,
      answers
    );
    return res.status(201).json({ success: true, data: attempt });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Submit attempt error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit attempt',
      message: err.message,
    });
  }
});

/**
 * GET /assessment/:id/attempts
 */
router.get('/:id/attempts', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found.',
      });
    }
    const assessment = await assessmentService.getAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }
    const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    const teacherClassIds = profile.managed_class_ids || [];
    const canSee =
      ['admin', 'superadmin'].includes(roleNorm) ||
      teacherClassIds.includes(assessment.classId) ||
      (roleNorm === 'principal' && profile.managed_school_id === assessment.schoolId);
    if (!canSee) {
      return res.status(403).json({ success: false, error: 'You do not have access to this assessment' });
    }
    const attempts = await assessmentService.getAttemptsByAssessment(req.params.id);
    return res.json({ success: true, data: attempts });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get assessment attempts error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch attempts',
      message: err.message,
    });
  }
});

export default router;
