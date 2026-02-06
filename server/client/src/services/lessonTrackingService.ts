/**
 * Lesson Tracking Service
 * 
 * Handles tracking of lesson launches and quiz scores in the new LMS collections.
 * Automatically includes school_id and class_id from user profile.
 */

import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../utils/rbac';
import type { LessonLaunch, StudentScore } from '../types/lms';

/**
 * Track lesson launch
 * Creates a lesson_launch record when student starts a lesson
 */
export async function trackLessonLaunch(
  profile: UserProfile | null,
  chapterId: string,
  topicId: string,
  curriculum: string,
  className: string,
  subject: string
): Promise<string | null> {
  if (!profile || profile.role !== 'student' || !profile.school_id) {
    console.warn('Cannot track lesson launch: invalid profile or missing school_id');
    return null;
  }

  try {
    const launchId = `${profile.uid}_${chapterId}_${topicId}_${Date.now()}`;
    const launchRef = doc(db, 'lesson_launches', launchId);

    const launch: Omit<LessonLaunch, 'id'> = {
      student_id: profile.uid,
      school_id: profile.school_id,
      class_id: profile.class_ids?.[0] || null, // Use first class if multiple
      chapter_id: chapterId,
      topic_id: topicId,
      curriculum,
      class_name: className,
      subject,
      launched_at: serverTimestamp() as any,
      completion_status: 'in_progress',
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
  topicObjective?: string
): Promise<string | null> {
  if (!profile || profile.role !== 'student' || !profile.school_id) {
    console.warn('Cannot save quiz score: invalid profile or missing school_id');
    return null;
  }

  try {
    const scoreId = `${profile.uid}_${chapterId}_${topicId}_${attemptNumber}`;
    const scoreRef = doc(db, 'student_scores', scoreId);

    const scoreData: Omit<StudentScore, 'id'> = {
      student_id: profile.uid,
      school_id: profile.school_id,
      class_id: profile.class_ids?.[0] || null, // Use first class if multiple
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
    };

    await setDoc(scoreRef, scoreData, { merge: true });
    console.log('✅ Quiz score saved:', scoreId);

    // Update lesson launch if provided
    if (launchId) {
      await updateLessonLaunch(launchId, 'completed');
    }

    return scoreId;
  } catch (error) {
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
  subject: string
): Promise<string | null> {
  if (!profile || profile.role !== 'student') {
    return null;
  }

  // Check if there's an existing in_progress launch for this lesson
  try {
    // For now, create a new launch each time
    // In the future, we could check for existing in_progress launches
    return await trackLessonLaunch(profile, chapterId, topicId, curriculum, className, subject);
  } catch (error) {
    console.error('Error getting/creating lesson launch:', error);
    return null;
  }
}
