/**
 * AI Education Routes
 * Personalized Learning (students) and AI Teacher Support (teachers)
 */

import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import { getUserProfile } from '../middleware/rbacMiddleware';
import personalizedLearningService from '../services/personalizedLearningService';
import type { StudentProgressSummary } from '../services/personalizedLearningService';
import teacherSupportService from '../services/teacherSupportService';
import * as mcqGenerationService from '../services/mcqGenerationService';
import { db, isFirebaseInitialized } from '../config/firebase-admin';

const router = express.Router();

router.use(verifyFirebaseToken);

router.use(async (req, res, next) => {
  if (!req.user?.uid) return next();
  try {
    const profile = await getUserProfile(req.user.uid);
    req.userProfile = profile ?? undefined;
  } catch (_) {}
  next();
});

// --- Personalized Learning (students) ---

/**
 * GET /ai-education/personalized-learning/recommendations
 * Returns AI-powered learning recommendations. Students only (own recommendations).
 */
router.get('/personalized-learning/recommendations', async (req, res) => {
  try {
    const profile = req.userProfile;
    const uid = req.user?.uid ?? profile?.uid;
    if (!uid) {
      return res.status(403).json({ success: false, error: 'Authentication required' });
    }
    const roleRaw = (profile?.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (profile && roleRaw !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can access personalized learning recommendations' });
    }
    const studentId = uid;
    const profileForSummary = profile ?? { uid, role: 'student', curriculum: undefined, class_name: undefined, subject: undefined } as NonNullable<typeof profile>;

    let summary: {
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
      incompleteLessons?: Array<{ chapterId: string; topicId: string; subject?: string; curriculum?: string; className?: string; launchedAt?: string; status: string }>;
    };

    const emptySummary = (): typeof summary => ({
      studentId,
      curriculum: profileForSummary.curriculum,
      classLevel: profileForSummary.class_name,
      subject: profileForSummary.subject,
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
      incompleteLessons: Array<{ chapterId: string; topicId: string; subject?: string; curriculum?: string; className?: string; launchedAt?: string; status: string }>;
    } = { subjectsWithLowScores: [], subjectsWithHighScores: [], topicsWithLowScores: [], topicsWithHighScores: [], incompleteLessons: [] };

    if (isFirebaseInitialized() && db) {
      try {
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

        // Per-subject stats: low ( < 70%) vs high ( >= 70%) for personalized dashboard
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

        // Per-topic (chapter + topic) stats: low vs high for dashboard
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

        // Incomplete lessons (in_progress or abandoned)
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
          curriculum: profileForSummary.curriculum,
          classLevel: profileForSummary.class_name,
          subject: profileForSummary.subject,
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
    } else {
      summary = emptySummary();
    }

    let recommendations;
    let usedFallback = false;
    try {
      recommendations = await personalizedLearningService.getRecommendations(summary as StudentProgressSummary);
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
    res.json({ success: true, data: recommendations, meta });
  } catch (error: any) {
    console.error('Personalized learning recommendations error:', error);
    // Never return 5xx: always return 200 with fallback so the UI can show something
    const fallback = {
      recommendedTopicIds: [],
      recommendedChapterIds: [],
      strengths: ['Keep learning at your own pace.'],
      areasToImprove: ['Review lessons and try the quizzes.'],
      studyTips: ['Review before quizzes', 'Take notes', 'Ask your teacher if stuck'],
      nextBestAction: 'Continue with the next lesson in your curriculum.',
      reasoning: 'General recommendations. Progress-based tips will appear once you have more activity.',
    };
    res.json({ success: true, data: fallback, meta: { fallback: true } });
  }
});

// --- Teacher Support ---

/**
 * POST /ai-education/teacher-support/lesson-plan
 * Generate a lesson plan (teachers only)
 */
router.post('/teacher-support/lesson-plan', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, principal, admin).',
      });
    }
    const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!['teacher', 'school', 'principal', 'admin', 'superadmin'].includes(roleNorm)) {
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
    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Lesson plan generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate lesson plan',
      message: error.message,
    });
  }
});

/**
 * POST /ai-education/teacher-support/content-suggestions
 * Get content suggestions (examples, activities, etc.)
 */
router.post('/teacher-support/content-suggestions', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, principal, admin).',
      });
    }
    const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!['teacher', 'school', 'principal', 'admin', 'superadmin'].includes(roleNorm)) {
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
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Content suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get content suggestions',
      message: error.message,
    });
  }
});

/**
 * POST /ai-education/teacher-support/rubric
 * Generate a grading rubric
 */
router.post('/teacher-support/rubric', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Ensure your account has a document in Firestore users collection with role (e.g. teacher, principal, admin).',
      });
    }
    const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!['teacher', 'school', 'principal', 'admin', 'superadmin'].includes(roleNorm)) {
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
    res.json({ success: true, data: rubric });
  } catch (error: any) {
    console.error('Rubric generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate rubric',
      message: error.message,
    });
  }
});

// --- MCQ Generation (teachers / curriculum editors) ---

/**
 * POST /ai-education/generate-mcq
 * Generate MCQs from learning objective or script text. Returns MCQs in ChapterMCQ-like shape (caller saves to chapter_mcqs).
 */
router.post('/generate-mcq', async (req, res) => {
  try {
    const profile = req.userProfile;
    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'User profile not found.',
      });
    }
    const roleNorm = (profile.role ?? '').toString().toLowerCase().replace(/\s+/g, '');
    if (!['teacher', 'school', 'principal', 'admin', 'superadmin'].includes(roleNorm)) {
      return res.status(403).json({ success: false, error: 'Only teachers and above can generate MCQs' });
    }

    const {
      chapterId,
      topicId,
      subject,
      classLevel,
      curriculum,
      learningObjective,
      scriptText,
      count,
      language,
    } = req.body;

    if (!chapterId || !topicId) {
      return res.status(400).json({
        success: false,
        error: 'chapterId and topicId are required',
      });
    }
    const hasContent = [learningObjective, scriptText, subject].some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );
    if (!hasContent) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least one of: learningObjective, scriptText, or subject',
      });
    }

    const mcqs = await mcqGenerationService.generateMcqs({
      chapterId,
      topicId,
      subject,
      classLevel,
      curriculum,
      learningObjective,
      scriptText,
      count,
      language,
    });

    res.json({
      success: true,
      data: {
        chapterId,
        topicId,
        mcqs,
      },
    });
  } catch (error: unknown) {
    console.error('Generate MCQ error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      message,
    });
  }
});

export default router;
