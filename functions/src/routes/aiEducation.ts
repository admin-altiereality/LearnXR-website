/**
 * AI Education Routes (Firebase Functions)
 * Personalized Learning (students) and AI Teacher Support (teachers).
 * OPENAI_API_KEY is loaded from Secret Manager (e.g. projects/427897409662/secrets/OPENAI_API_KEY).
 */

import express from 'express';
import * as admin from 'firebase-admin';
import { getUserProfile } from '../middleware/rbac';
import { getRecommendations } from '../services/personalizedLearningService';
import teacherSupportService from '../services/teacherSupportService';

const router = express.Router();

// Attach user profile for routes that need it
router.use(async (req, res, next) => {
  const user = (req as any).user;
  if (user?.uid) {
    try {
      const profile = await getUserProfile(user.uid);
      (req as any).userProfile = profile ?? undefined;
    } catch (_) {}
  }
  next();
});

router.get('/personalized-learning/recommendations', async (req, res) => {
  try {
    const user = (req as any).user;
    const uid = user?.uid;
    if (!uid) {
      return res.status(403).json({ success: false, error: 'Authentication required' });
    }

    let profile = req.userProfile;
    if (!profile) {
      profile = await getUserProfile(uid) ?? undefined;
      (req as any).userProfile = profile;
    }

    const roleRaw = (profile?.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (profile && roleRaw !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can access personalized learning recommendations',
      });
    }

    const studentId = uid;
    type ProfileLike = { uid: string; role?: string; curriculum?: string; class_name?: string; subject?: string };
    const profileForSummary: ProfileLike = profile ?? {
      uid,
      role: 'student',
      curriculum: undefined,
      class_name: undefined,
      subject: undefined,
    };

    type Summary = {
      studentId: string;
      curriculum?: string;
      classLevel?: string;
      subject?: string;
      recentScores: Array<{ chapter_id: string; topic_id: string; percentage: number; subject?: string }>;
      completedTopics: string[];
      totalAttempts: number;
      averageScore: number;
      subjectsWithLowScores?: Array<{ subject: string; averageScore: number; attemptCount: number }>;
      subjectsWithHighScores?: Array<{ subject: string; averageScore: number; attemptCount: number }>;
      topicsWithLowScores?: Array<{ chapterId: string; topicId: string; subject?: string; averageScore: number; attemptCount: number }>;
      topicsWithHighScores?: Array<{ chapterId: string; topicId: string; subject?: string; averageScore: number; attemptCount: number }>;
      incompleteLessons?: Array<{ chapterId: string; topicId: string; subject?: string; curriculum?: string; className?: string; launchedAt?: string; status: 'in_progress' | 'abandoned' }>;
    };

    const emptySummary = (): Summary => ({
      studentId,
      curriculum: profileForSummary?.curriculum,
      classLevel: profileForSummary?.class_name,
      subject: profileForSummary?.subject,
      recentScores: [],
      completedTopics: [],
      totalAttempts: 0,
      averageScore: 0,
    });

    let analytics: { subjectsLearned: string[]; totalMcqsAnswered: number; assessmentAttemptsCount: number } = {
      subjectsLearned: [],
      totalMcqsAnswered: 0,
      assessmentAttemptsCount: 0,
    };

    let learningSummary: {
      subjectsWithLowScores: Array<{ subject: string; averageScore: number; attemptCount: number }>;
      subjectsWithHighScores: Array<{ subject: string; averageScore: number; attemptCount: number }>;
      topicsWithLowScores: Array<{ chapterId: string; topicId: string; subject?: string; averageScore: number; attemptCount: number }>;
      topicsWithHighScores: Array<{ chapterId: string; topicId: string; subject?: string; averageScore: number; attemptCount: number }>;
      incompleteLessons: Array<{ chapterId: string; topicId: string; subject?: string; curriculum?: string; className?: string; launchedAt?: string; status: 'in_progress' | 'abandoned' }>;
    } = { subjectsWithLowScores: [], subjectsWithHighScores: [], topicsWithLowScores: [], topicsWithHighScores: [], incompleteLessons: [] };

    let summary: Summary;

    try {
      const db = admin.firestore();
      const scoresSnapshot = await db
        .collection('student_scores')
        .where('student_id', '==', studentId)
        .orderBy('completed_at', 'desc')
        .limit(50)
        .get();

      const launchesSnapshot = await db
        .collection('lesson_launches')
        .where('student_id', '==', studentId)
        .where('completion_status', '==', 'completed')
        .get();

      const recentScores = scoresSnapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          chapter_id: d.chapter_id,
          topic_id: d.topic_id,
          percentage: d.score?.percentage ?? 0,
          subject: d.subject,
        };
      });

      const completedTopics = launchesSnapshot.docs.map((d) => `${d.data().chapter_id}_${d.data().topic_id}`);
      const totalAttempts = recentScores.length;
      const averageScore =
        recentScores.length > 0
          ? Math.round(recentScores.reduce((sum, s) => sum + s.percentage, 0) / recentScores.length)
          : 0;

      const LOW_SCORE_THRESHOLD = 70;
      const bySubject = new Map<string, { total: number; count: number }>();
      for (const s of recentScores) {
        const sub = s.subject || 'Other';
        const cur = bySubject.get(sub) ?? { total: 0, count: 0 };
        cur.total += s.percentage;
        cur.count += 1;
        bySubject.set(sub, cur);
      }
      const subjectsWithLowScores: Array<{ subject: string; averageScore: number; attemptCount: number }> = [];
      const subjectsWithHighScores: Array<{ subject: string; averageScore: number; attemptCount: number }> = [];
      bySubject.forEach((val, subject) => {
        const avg = Math.round(val.total / val.count);
        const entry = { subject, averageScore: avg, attemptCount: val.count };
        if (avg < LOW_SCORE_THRESHOLD) subjectsWithLowScores.push(entry);
        else subjectsWithHighScores.push(entry);
      });

      const byTopic = new Map<string, { total: number; count: number; subject?: string }>();
      for (const s of recentScores) {
        const key = `${s.chapter_id}|${s.topic_id}`;
        const cur = byTopic.get(key) ?? { total: 0, count: 0, subject: s.subject };
        cur.total += s.percentage;
        cur.count += 1;
        if (s.subject) cur.subject = s.subject;
        byTopic.set(key, cur);
      }
      const topicsWithLowScores: Array<{ chapterId: string; topicId: string; subject?: string; averageScore: number; attemptCount: number }> = [];
      const topicsWithHighScores: Array<{ chapterId: string; topicId: string; subject?: string; averageScore: number; attemptCount: number }> = [];
      byTopic.forEach((val, key) => {
        const [chapterId, topicId] = key.split('|');
        const avg = Math.round(val.total / val.count);
        const entry = { chapterId, topicId, subject: val.subject, averageScore: avg, attemptCount: val.count };
        if (avg < LOW_SCORE_THRESHOLD) topicsWithLowScores.push(entry);
        else topicsWithHighScores.push(entry);
      });

      const incompleteSnap = await db
        .collection('lesson_launches')
        .where('student_id', '==', studentId)
        .where('completion_status', 'in', ['in_progress', 'abandoned'])
        .limit(20)
        .get();
      const incompleteLessons = incompleteSnap.docs.map((d) => {
        const data = d.data();
        const launchedAt = data.launched_at;
        return {
          chapterId: data.chapter_id,
          topicId: data.topic_id,
          subject: data.subject,
          curriculum: data.curriculum,
          className: data.class_name,
          launchedAt: launchedAt?.toDate?.()?.toISOString?.() ?? (typeof launchedAt === 'string' ? launchedAt : undefined),
          status: data.completion_status as 'in_progress' | 'abandoned',
        };
      });

      summary = {
        studentId,
        curriculum: profileForSummary?.curriculum,
        classLevel: profileForSummary?.class_name,
        subject: profileForSummary?.subject,
        recentScores,
        completedTopics,
        totalAttempts,
        averageScore,
        subjectsWithLowScores,
        subjectsWithHighScores,
        topicsWithLowScores,
        topicsWithHighScores,
        incompleteLessons,
      };
      learningSummary = { subjectsWithLowScores, subjectsWithHighScores, topicsWithLowScores, topicsWithHighScores, incompleteLessons };

      // Analytics: subjects learned (from scores) + MCQs done (from assessment_attempts)
      analytics.subjectsLearned = [...new Set(recentScores.map((s) => s.subject).filter(Boolean))] as string[];
      const attemptsSnapshot = await db
        .collection('assessment_attempts')
        .where('studentId', '==', studentId)
        .get();
      analytics.assessmentAttemptsCount = attemptsSnapshot.size;
      analytics.totalMcqsAnswered = attemptsSnapshot.docs.reduce(
        (sum, doc) => sum + Object.keys((doc.data() as { answers?: Record<string, unknown> }).answers || {}).length,
        0
      );
    } catch (dbError: any) {
      console.warn('Personalized learning DB query error, using fallback:', dbError?.message ?? dbError);
      summary = emptySummary();
    }

    let recommendations;
    let usedFallback = false;
    try {
      recommendations = await getRecommendations(summary);
    } catch (serviceError: any) {
      console.warn('Personalized learning service error, using fallback:', serviceError?.message ?? serviceError);
      usedFallback = true;
      recommendations = {
        recommendedTopicIds: [],
        recommendedChapterIds: [],
        strengths: ['You can do it—keep learning at your own pace.'],
        areasToImprove: ['Review lessons regularly and try the quizzes.'],
        studyTips: ['Review lesson content before quizzes', 'Take notes during lessons', 'Ask your teacher if stuck'],
        nextBestAction: 'Continue with the next lesson in your curriculum.',
        reasoning: 'Recommendations are based on your progress. Keep learning!',
      };
    }

    const meta: { fallback?: boolean; analytics?: typeof analytics; learningSummary?: typeof learningSummary } = {};
    if (usedFallback) meta.fallback = true;
    meta.analytics = analytics;
    meta.learningSummary = learningSummary;
    return res.json({ success: true, data: recommendations, meta });
  } catch (error: any) {
    console.error('Personalized learning recommendations error:', error);
    const fallback = {
      recommendedTopicIds: [],
      recommendedChapterIds: [],
      strengths: ['Keep learning at your own pace.'],
      areasToImprove: ['Review lessons and try the quizzes.'],
      studyTips: ['Review before quizzes', 'Take notes', 'Ask your teacher if stuck'],
      nextBestAction: 'Continue with the next lesson in your curriculum.',
      reasoning: 'General recommendations. Progress-based tips will appear once you have more activity.',
    };
    return res.json({ success: true, data: fallback, meta: { fallback: true } });
  }
});

// --- Teacher Support (teachers and above) ---

const TEACHER_ROLES = ['teacher', 'school', 'principal', 'admin', 'superadmin'];

function canUseTeacherSupport(profile: { role?: string } | null | undefined): boolean {
  if (!profile) return false;
  const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
  return TEACHER_ROLES.includes(roleNorm);
}

/**
 * POST /ai-education/teacher-support/lesson-plan
 */
router.post('/teacher-support/lesson-plan', async (req, res) => {
  try {
    const profile = (req as any).userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, principal, admin).',
      });
    }
    if (!canUseTeacherSupport(profile)) {
      return res.status(403).json({ success: false, error: 'Only teachers and above can use this feature' });
    }

    const { subject, classLevel, curriculum, topic, durationMinutes } = req.body;
    if (!subject || !topic) {
      return res.status(400).json({ success: false, error: 'subject and topic are required' });
    }

    const plan = await teacherSupportService.generateLessonPlan({
      subject,
      classLevel: classLevel || '8',
      curriculum,
      topic,
      durationMinutes,
    });
    return res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Lesson plan generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate lesson plan',
      message: error?.message ?? 'Unknown error',
    });
  }
});

/**
 * POST /ai-education/teacher-support/content-suggestions
 */
router.post('/teacher-support/content-suggestions', async (req, res) => {
  try {
    const profile = (req as any).userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, principal, admin).',
      });
    }
    if (!canUseTeacherSupport(profile)) {
      return res.status(403).json({ success: false, error: 'Only teachers and above can use this feature' });
    }

    const { subject, classLevel, topic, type } = req.body;
    if (!subject || !topic || !type) {
      return res.status(400).json({ success: false, error: 'subject, topic, and type are required' });
    }

    const result = await teacherSupportService.getContentSuggestions({
      subject,
      classLevel: classLevel || '8',
      topic,
      type: type || 'examples',
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Content suggestions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get content suggestions',
      message: error?.message ?? 'Unknown error',
    });
  }
});

/**
 * POST /ai-education/teacher-support/rubric
 */
router.post('/teacher-support/rubric', async (req, res) => {
  try {
    const profile = (req as any).userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, principal, admin).',
      });
    }
    if (!canUseTeacherSupport(profile)) {
      return res.status(403).json({ success: false, error: 'Only teachers and above can use this feature' });
    }

    const { subject, classLevel, assignmentType, criteriaCount } = req.body;
    if (!subject || !assignmentType) {
      return res.status(400).json({ success: false, error: 'subject and assignmentType are required' });
    }

    const rubric = await teacherSupportService.generateRubric({
      subject,
      classLevel: classLevel || '8',
      assignmentType,
      criteriaCount,
    });
    return res.json({ success: true, data: rubric });
  } catch (error: any) {
    console.error('Rubric generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate rubric',
      message: error?.message ?? 'Unknown error',
    });
  }
});

export default router;
