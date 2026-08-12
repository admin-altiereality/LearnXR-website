/**
 * Class Session Routes (Firebase Functions)
 * Secure join-by-code flow using Admin SDK.
 */

import express from 'express';
import * as admin from 'firebase-admin';

const router = express.Router();
const guestJoinAttempts = new Map<string, { count: number; resetAt: number }>();

function canAttemptGuestJoin(key: string): boolean {
  const now = Date.now();
  const current = guestJoinAttempts.get(key);
  if (!current || current.resetAt < now) {
    guestJoinAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

/**
 * POST /class-sessions/join
 * Body: { sessionCode: string }
 * Requires authenticated student.
 */
router.post('/join', async (req, res) => {
  try {
    const uid = (req as any).user?.uid as string | undefined;
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

    const db = admin.firestore();

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
    if (userData.isGuest === true && !canAttemptGuestJoin(uid)) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Too many join attempts. Please wait before trying another code.',
      });
    }
    const isGuestPartnerJoin =
      userData.isGuest === true && sessionData.hosted_by_partner === true;

    if (userData.isGuest === true && sessionData.hosted_by_partner !== true) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Guests can only join partner demo sessions with a valid code.',
      });
    }

    // Guests may move between partner demo schools via session code; enrolled students stay school-bound.
    if (
      !isGuestPartnerJoin &&
      userData.school_id &&
      userData.school_id !== sessionSchoolId
    ) {
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

    const removedUids: string[] = Array.isArray(sessionData.removed_student_uids) ? sessionData.removed_student_uids : [];
    const isRemoved = removedUids.includes(uid);
    let requiresApproval = false;

    const batch = db.batch();

    if (isRemoved) {
      batch.update(db.collection('class_sessions').doc(sessionId), {
        join_requests: admin.firestore.FieldValue.arrayUnion(uid),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      requiresApproval = true;
      await batch.commit();
    } else {
      let needsUserUpdate = false;
      let needsClassUpdate = false;
      const userUpdates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (isGuestPartnerJoin) {
        if (userData.school_id !== sessionSchoolId) {
          userUpdates.school_id = sessionSchoolId;
          needsUserUpdate = true;
        }
        if (!userClassIds.includes(sessionClassId) || userClassIds.length !== 1) {
          userUpdates.class_ids = [sessionClassId];
          needsUserUpdate = true;
        }
        userUpdates.last_partner_demo_session_id = sessionId;
        userUpdates.last_partner_demo_joined_at = new Date().toISOString();
        needsUserUpdate = true;
      } else {
        if (!userData.school_id) {
          userUpdates.school_id = sessionSchoolId;
          needsUserUpdate = true;
        }

        if (!userClassIds.includes(sessionClassId)) {
          userUpdates.class_ids = admin.firestore.FieldValue.arrayUnion(sessionClassId);
          needsUserUpdate = true;
        }
      }

      if (!classStudentIds.includes(uid)) {
        batch.update(classRef, {
          student_ids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: new Date().toISOString(),
        });
        needsClassUpdate = true;
      }

      if (needsUserUpdate) {
        batch.update(userRef, userUpdates);
      }

      if (needsUserUpdate || needsClassUpdate) {
        await batch.commit();
      }
    }

    return res.json({
      success: true,
      data: {
        sessionId,
        requiresApproval,
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
router.post('/:sessionId/remove-student', async (req, res) => {
  try {
    const uid = (req as any).user?.uid as string | undefined;
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

    const db = admin.firestore();
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

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const role = userSnap.data()?.role as string | undefined;
    const isPartnerSessionOwner = role === 'partner' && sessionData.hosted_by_partner === true && sessionData.teacher_uid === uid;
    if (userSnap.exists && role !== 'teacher' && !isPartnerSessionOwner) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only the session host can remove students from a session',
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

    // Drop their live progress doc so the host roster does not keep showing them
    try {
      await db.collection('class_sessions').doc(sessionId).collection('progress').doc(studentUid).delete();
    } catch (progressErr) {
      console.warn('Failed to delete removed student progress doc:', progressErr);
    }

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

/**
 * POST /class-sessions/:sessionId/approve-join
 * Body: { studentUid: string }
 * Requires authenticated teacher who owns the session.
 */
router.post('/:sessionId/approve-join', async (req, res) => {
  try {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Authentication required' });
    }

    const sessionId = req.params?.sessionId;
    const studentUid = typeof req.body?.studentUid === 'string' ? req.body.studentUid.trim() : '';
    if (!sessionId || !studentUid) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'sessionId and studentUid are required' });
    }

    const db = admin.firestore();
    const sessionRef = db.collection('class_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return res.status(404).json({ success: false, error: 'Not Found', message: 'Session not found' });

    const sessionData = sessionSnap.data() || {};
    if (sessionData.teacher_uid !== uid) {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'Only the session owner can approve join requests' });
    }

    await sessionRef.update({
      removed_student_uids: admin.firestore.FieldValue.arrayRemove(studentUid),
      join_requests: admin.firestore.FieldValue.arrayRemove(studentUid),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: 'Student join request approved' });
  } catch (error: any) {
    console.error('Class session approve-join error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: error?.message || 'Failed to approve join request' });
  }
});

export default router;
