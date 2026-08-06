/**
 * User-generated lessons (Street View, Create-page scenes, Spiral scenes).
 *
 * These are Admin-SDK-owned drafts a teacher or partner creates and can
 * immediately launch to their own class without review. A creator may
 * additionally submit a draft for Super Admin review; on approval it is
 * copied into `curriculum_chapters` as a normal topic, using the exact same
 * playback pipeline (getLessonBundle) as any other lesson.
 */

import * as admin from 'firebase-admin';

export const USER_LESSONS_COLLECTION = 'user_generated_lessons';

export type UserGeneratedLessonSource = 'street_view' | 'create_scene' | 'spiral_scene';
export type UserGeneratedLessonStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

const STAFF_ROLES = new Set(['admin', 'superadmin', 'associate']);
const LESSON_AUTHOR_ROLES = new Set(['teacher', 'partner', 'admin', 'superadmin', 'associate']);

export function isLessonAuthorRole(role?: string | null): boolean {
  return !!role && LESSON_AUTHOR_ROLES.has(role);
}

/**
 * Authorizes generation/finalize calls that target a `chapterId`/`topicId` pair:
 * - Staff (admin/superadmin/associate) may target any real curriculum chapter.
 * - Teacher/partner may only target a `user_generated_lessons` draft they own
 *   (identified by `chapterId === topicId === lessonId`).
 */
export async function assertLessonAuthorAccess(params: {
  uid: string;
  role?: string | null;
  chapterId: string;
  topicId: string;
}): Promise<void> {
  const { uid, role, chapterId, topicId } = params;
  if (role && STAFF_ROLES.has(role)) return;

  if (!role || !LESSON_AUTHOR_ROLES.has(role)) {
    const err: any = new Error('You do not have permission to generate 3D assets for this lesson.');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (chapterId !== topicId) {
    const err: any = new Error('Teachers and partners may only generate assets for their own draft lessons.');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const snap = await admin.firestore().collection(USER_LESSONS_COLLECTION).doc(chapterId).get();
  if (!snap.exists || snap.data()?.ownerUid !== uid) {
    const err: any = new Error('This draft lesson does not belong to you.');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

export interface PromoteResult {
  chapterId: string;
  topicId: string;
}

/**
 * Copies an approved user-generated lesson into `curriculum_chapters` as a new
 * chapter with a single topic, reusing the exact fields the normal lesson
 * playback pipeline (getLessonBundle) already understands.
 */
export async function promoteUserGeneratedLesson(
  lessonId: string,
  lessonData: admin.firestore.DocumentData,
  options: { markAsDemo: boolean; approvedBy: string }
): Promise<PromoteResult> {
  const db = admin.firestore();
  const chapterRef = db.collection('curriculum_chapters').doc();
  const topicId = `ugl_${lessonId}`;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const topic: Record<string, unknown> = {
    topic_id: topicId,
    topic_name: lessonData.title || 'Community Lesson',
    topic_priority: 1,
    learning_objective: '',
    skybox_id: lessonData.skybox_id || null,
    skybox_url: lessonData.skybox_url || '',
    skybox_glb_url: lessonData.skybox_glb_url || lessonData.skybox_url || '',
    asset_urls: Array.isArray(lessonData.asset_urls) ? lessonData.asset_urls : [],
    asset_ids: Array.isArray(lessonData.asset_ids) ? lessonData.asset_ids : [],
    sharedAssets: {
      meshy_asset_ids: Array.isArray(lessonData.meshy_asset_ids) ? lessonData.meshy_asset_ids : [],
      asset_ids: Array.isArray(lessonData.asset_ids) ? lessonData.asset_ids : [],
    },
    isDemo: options.markAsDemo,
    approval: { approved: true, approvedAt: new Date().toISOString(), approvedBy: options.approvedBy },
    source: 'user_generated_lesson',
    source_lesson_id: lessonId,
  };

  await chapterRef.set({
    chapter_name: lessonData.title || 'Community Lesson',
    chapter_number: 1,
    curriculum: lessonData.curriculum || 'Community',
    class_name: lessonData.class_name || '',
    subject: lessonData.subject || lessonData.source || 'Community',
    approved: true,
    topics: [topic],
    createdAt: now,
    updatedAt: now,
    source: 'user_generated_lesson',
    source_lesson_id: lessonId,
    source_owner_uid: lessonData.ownerUid || null,
  });

  return { chapterId: chapterRef.id, topicId };
}
