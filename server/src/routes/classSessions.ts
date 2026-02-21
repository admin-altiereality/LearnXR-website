/**
 * Class Session Routes (Express Server)
 * Secure join-by-code flow using Admin SDK.
 */

import express from 'express';
import * as admin from 'firebase-admin';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { getAdminApp } from '../config/firebase-admin';

const router = express.Router();

router.use(verifyFirebaseToken);

/**
 * POST /class-sessions/join
 * Body: { sessionCode: string }
 * Requires authenticated student.
 */
router.post('/join', requireRole(['student']), async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const rawCode = req.body?.sessionCode;
    const sessionCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    if (!sessionCode) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'sessionCode is required',
      });
    }

    const adminApp = getAdminApp();
    if (!adminApp) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Firebase Admin is not configured',
      });
    }

    const db = admin.firestore(adminApp);

    const sessionSnap = await db
      .collection('class_sessions')
      .where('session_code', '==', sessionCode)
      .where('status', 'in', ['waiting', 'active'])
      .limit(1)
      .get();

    if (sessionSnap.empty) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invalid or expired session code',
      });
    }

    const sessionDoc = sessionSnap.docs[0];
    const sessionData = sessionDoc.data();
    const sessionId = sessionDoc.id;
    const sessionSchoolId = sessionData.school_id;
    const sessionClassId = sessionData.class_id;

    if (!sessionSchoolId || !sessionClassId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Session is missing school_id or class_id',
      });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User profile not found',
      });
    }

    const userData = userDoc.data() || {};
    if (userData.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only students can join a class session',
      });
    }

    if (userData.school_id && userData.school_id !== sessionSchoolId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Session is for a different school',
      });
    }

    const classRef = db.collection('classes').doc(sessionClassId);
    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Class not found for this session',
      });
    }

    const classData = classDoc.data() || {};
    if (classData.school_id && classData.school_id !== sessionSchoolId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Class school does not match session school',
      });
    }
    const userClassIds: string[] = Array.isArray(userData.class_ids) ? userData.class_ids : [];
    const classStudentIds: string[] = Array.isArray(classData.student_ids) ? classData.student_ids : [];
    const inClass = userClassIds.includes(sessionClassId) || classStudentIds.includes(uid);

    // If user is not yet linked to the class, link them now (session code is the shared secret)
    const batch = db.batch();
    let needsUpdate = false;

    if (!userData.school_id) {
      batch.update(userRef, { school_id: sessionSchoolId, updatedAt: new Date().toISOString() });
      needsUpdate = true;
    }

    if (!userClassIds.includes(sessionClassId)) {
      batch.update(userRef, {
        class_ids: admin.firestore.FieldValue.arrayUnion(sessionClassId),
        updatedAt: new Date().toISOString(),
      });
      needsUpdate = true;
    }

    if (!classStudentIds.includes(uid)) {
      batch.update(classRef, {
        student_ids: admin.firestore.FieldValue.arrayUnion(uid),
        updatedAt: new Date().toISOString(),
      });
      needsUpdate = true;
    }

    if (!inClass && needsUpdate) {
      await batch.commit();
    } else if (needsUpdate) {
      await batch.commit();
    }

    return res.json({
      success: true,
      data: {
        sessionId,
      },
    });
  } catch (error: any) {
    console.error('Class session join error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error?.message || 'Failed to join session',
    });
  }
});

/**
 * POST /class-sessions/:sessionId/remove-student
 * Body: { studentUid: string }
 * Requires authenticated teacher who owns the session.
 */
router.post('/:sessionId/remove-student', requireRole(['teacher']), async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const sessionId = req.params?.sessionId;
    const studentUid = typeof req.body?.studentUid === 'string' ? req.body.studentUid.trim() : '';
    if (!sessionId || !studentUid) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'sessionId and studentUid are required',
      });
    }

    const adminApp = getAdminApp();
    if (!adminApp) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Firebase Admin is not configured',
      });
    }

    const db = admin.firestore(adminApp);
    const sessionRef = db.collection('class_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    const sessionData = sessionSnap.data() || {};
    if (sessionData.teacher_uid !== uid) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only the session owner can remove students',
      });
    }

    if (sessionData.status === 'ended') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Session has already ended',
      });
    }

    await sessionRef.update({
      removed_student_uids: admin.firestore.FieldValue.arrayUnion(studentUid),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: 'Student removed from session',
    });
  } catch (error: any) {
    console.error('Class session remove-student error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error?.message || 'Failed to remove student',
    });
  }
});

export default router;
