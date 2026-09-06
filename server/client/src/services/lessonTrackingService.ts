/**
 * Lesson Tracking Service
 * 
 * Handles tracking of lesson launches and quiz scores in the new LMS collections.
 * Automatically includes school_id and class_id from user profile.
 */

import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../utils/rbac';
import { canGuestWrite } from '../utils/rbac';
import type { LessonLaunch, StudentScore } from '../types/lms';

/**
 * Track lesson launch
 * Creates a lesson_launch record when student starts a lesson.
 * Guest users are read-only: no write to Firebase.
 */
export async function trackLessonLaunch(
  profile: UserProfile | null,
  chapterId: string,
  topicId: string,
  curriculum: string,
  className: string,
  subject: string,
  platform?: 'web' | 'mobile_vr' | 'vr',
  /**
   * Class this launch belongs to. Pass the live session's class_id when the
   * lesson was taught in a class.
   *
   * Without it this fell back to the student's FIRST enrolment, while
   * saveQuizScore has always taken the class actually taught in. The dashboards
   * filter both collections on class_id, so for a student in more than one class
   * the launch and the score landed in different buckets and the figures
   * disagreed. Optional, and the old fallback remains, so existing callers are
   * unaffected.
   */
  classId?: string | null
): Promise<string | null> {
  if (!profile) return null;
  if (profile.role !== 'student') return null; // Only students get launch records; teachers/admins skip silently
  if (!profile.school_id) {
    console.warn('Cannot track lesson launch: student profile missing school_id');
    return null;
  }
  if (!canGuestWrite(profile)) {
    return null; // Guest: read-only, do not create launch record
  }

  try {
    const launchId = `${profile.uid}_${chapterId}_${topicId}_${Date.now()}`;
    const launchRef = doc(db, 'lesson_launches', launchId);

    const launch: Omit<LessonLaunch, 'id'> & { platform?: string } = {
      student_id: profile.uid,
      school_id: profile.school_id,
      class_id: classId ?? profile.class_ids?.[0] ?? null,
      chapter_id: chapterId,
      topic_id: topicId,
      curriculum,
      class_name: className,
      subject,
      launched_at: serverTimestamp() as any,
      completion_status: 'in_progress',
      ...(platform ? { platform } : {}),
    };

    await setDoc(launchRef, launch);
    console.log('✅ Lesson launch tracked:', launchId);
    return launchId;
  } catch (error) {
    console.error('Error tracking lesson launch:', error);
    return null;
  }
}

/**
 * Update lesson launch completion status
 */
export async function updateLessonLaunch(
  launchId: string,
  status: 'completed' | 'abandoned',
  durationSeconds?: number
): Promise<boolean> {
  try {
    const launchRef = doc(db, 'lesson_launches', launchId);
    const updateData: any = {
      completion_status: status,
      updatedAt: serverTimestamp(),
    };

    if (status === 'completed') {
      updateData.completed_at = serverTimestamp();
    }

    if (durationSeconds !== undefined) {
      updateData.duration_seconds = durationSeconds;
    }

    await setDoc(launchRef, updateData, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating lesson launch:', error);
    return false;
  }
}

/**
 * Why the last saveQuizScore call declined to write, or null if it wrote.
 *
 * Read immediately after an awaited call. A module-level value is enough
 * because a student finishes one quiz at a time, and it keeps the function's
 * return type — which four other players depend on — unchanged.
 */
export let lastQuizScoreRefusal: string | null = null;

/**
 * Save quiz score to student_scores collection
 * Also updates the corresponding lesson_launch if launchId is provided
 */
export async function saveQuizScore(
  profile: UserProfile | null,
  chapterId: string,
  topicId: string,
  curriculum: string,
  className: string,
  subject: string,
  score: { correct: number; total: number; percentage: number },
  answers: Record<string, number>,
  attemptNumber: number = 1,
  timeTakenSeconds?: number,
  launchId?: string,
  topicObjective?: string,
  platform?: 'web' | 'mobile_vr' | 'vr',
  /**
   * Class this score belongs to. Pass the live session's class_id when the lesson
   * was taught in a class — profile.class_ids[0] is wrong for a student enrolled in
   * more than one class, and a mismatched class_id also breaks the teacher's read
   * (firestore.rules requires the teacher to manage resource.data.class_id).
   */
  classId?: string | null,
  /**
   * How many questions the student answered, when that is fewer than were
   * asked. Passed only when a teacher advances the class mid-quiz: the answers
   * given are kept, and the record says plainly that the rest were never seen.
   * Omit for a quiz worked through to the end.
   */
  questionsAttempted?: number
): Promise<string | null> {
  /*
    Every refusal below is now named.

    These four returned a bare `null`, and the players logged nothing on `null`,
    so a quiz that was never recorded looked exactly like one that was. Marks
    then failed to appear on any dashboard with nothing anywhere to say why.
    `lastQuizScoreRefusal` lets a caller tell the student, or the developer,
    which of the four it was.
  */
  if (!profile) {
    lastQuizScoreRefusal = 'no profile loaded';
    console.warn('[saveQuizScore] refused:', lastQuizScoreRefusal);
    return null;
  }
  if (profile.role !== 'student') {
    // Correct, and worth saying out loud: a teacher testing their own lesson
    // produces no score, which is easily mistaken for the feature being broken.
    lastQuizScoreRefusal = `role is "${profile.role}", not student — only students are scored`;
    console.info('[saveQuizScore] refused:', lastQuizScoreRefusal);
    return null;
  }
  if (!profile.school_id) {
    lastQuizScoreRefusal = 'student profile has no school_id';
    console.warn('[saveQuizScore] refused:', lastQuizScoreRefusal);
    return null;
  }
  if (!canGuestWrite(profile)) {
    lastQuizScoreRefusal = 'guest accounts are read-only';
    console.warn('[saveQuizScore] refused:', lastQuizScoreRefusal);
    return null;
  }
  lastQuizScoreRefusal = null;

  try {
    const scoreId = `${profile.uid}_${chapterId}_${topicId}_${attemptNumber}`;
    const scoreRef = doc(db, 'student_scores', scoreId);

    const scoreData: Omit<StudentScore, 'id'> & { platform?: string } = {
      student_id: profile.uid,
      school_id: profile.school_id,
      class_id: classId || profile.class_ids?.[0] || null,
      chapter_id: chapterId,
      topic_id: topicId,
      curriculum,
      class_name: className,
      subject,
      attempt_number: attemptNumber,
      score,
      answers,
      completed_at: serverTimestamp() as any,
      time_taken_seconds: timeTakenSeconds,
      ...(topicObjective != null && topicObjective !== '' ? { topic_objective: topicObjective } : {}),
      ...(platform ? { platform } : {}),
      // A cut-short attempt is recorded as such. Without this a student who
      // answered four of ten correctly before the class moved on is
      // indistinguishable in every report from one who got four out of ten.
      questions_attempted: questionsAttempted ?? score.total,
      completed: questionsAttempted === undefined || questionsAttempted >= score.total,
    };

    await setDoc(scoreRef, scoreData, { merge: true });
    // The class attribution decides whether this score is ever visible: every
    // dashboard section filters on class_id, so one attributed to the wrong
    // class is invisible in all of them at once.
    console.log('✅ Quiz score saved:', scoreId, {
      class_id: scoreData.class_id,
      class_id_source: classId ? 'live session' : 'profile fallback',
      school_id: scoreData.school_id,
    });
    if (!scoreData.class_id) {
      lastQuizScoreRefusal = null;
      console.warn(
        '[saveQuizScore] saved with NO class_id — this score will not appear on any ' +
          'class dashboard. The lesson was taught in a session carrying no class.'
      );
    }

    // Update lesson launch if provided. An attempt the class moved on from is
    // abandoned, not completed — the student never reached the end.
    if (launchId) {
      await updateLessonLaunch(
        launchId,
        scoreData.completed ? 'completed' : 'abandoned'
      );
    }

    return scoreId;
  } catch (error) {
    lastQuizScoreRefusal = `write failed: ${(error as any)?.message || error}`;
    console.error('Error saving quiz score:', error);
    return null;
  }
}

/**
 * Get or create lesson launch for current lesson
 * Returns launchId for tracking
 */
export async function getOrCreateLessonLaunch(
  profile: UserProfile | null,
  chapterId: string,
  topicId: string,
  curriculum: string,
  className: string,
  subject: string,
  platform?: 'web' | 'mobile_vr' | 'vr'
): Promise<string | null> {
  if (!profile || profile.role !== 'student') {
    return null;
  }

  try {
    return await trackLessonLaunch(profile, chapterId, topicId, curriculum, className, subject, platform);
  } catch (error) {
    console.error('Error getting/creating lesson launch:', error);
    return null;
  }
}
