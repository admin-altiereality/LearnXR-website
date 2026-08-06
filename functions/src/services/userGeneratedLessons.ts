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

/** Max stops per Street View tour — bounds Tile API tile-fetch cost per draft. */
export const MAX_TOUR_STOPS = 12;

export interface TourStopAsset {
  id: string;
  assetId?: string;
  glbUrl: string;
  ath: number;
  atv: number;
  depth?: number;
  scale?: number;
  rotationY?: number;
}

export interface TourStopLink {
  panoId: string;
  heading: number;
  text?: string;
}

export interface TourStopVoiceover {
  script?: string;
  audioUrl?: string;
  language?: string;
}

export interface TourStop {
  id: string;
  order: number;
  panoId: string;
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  label?: string;
  skyboxUrl: string;
  links: TourStopLink[];
  assets: TourStopAsset[];
  voiceover: TourStopVoiceover | null;
  copyright?: string;
}

export type TourTileZoom = 2 | 3 | 4;

export interface StreetViewTour {
  stops: TourStop[];
  tileZoom: TourTileZoom;
}

/** Builds one synthetic curriculum-shaped topic per tour stop, reusing the standard
 * topic fields (`skybox_url`, `asset_urls`/`asset_ids`, inline `ttsAudio`) so the rest
 * of the lesson-playback pipeline (getLessonBundle, VRLessonPlayerKrpano) needs no
 * tour-specific logic — a tour is just a chapter with one topic per stop. */
export function buildTourTopics(lessonId: string, tour: StreetViewTour): Record<string, unknown>[] {
  return tour.stops.map((stop, index) => ({
    topic_id: `${lessonId}__stop_${stop.id}`,
    topic_name: stop.label || `Stop ${index + 1}`,
    topic_priority: stop.order ?? index + 1,
    learning_objective: '',
    skybox_url: stop.skyboxUrl,
    skybox_glb_url: stop.skyboxUrl,
    asset_urls: stop.assets.map((a) => a.glbUrl).filter(Boolean),
    asset_ids: stop.assets.map((a) => a.assetId).filter((v): v is string => !!v),
    assetPlacements: stop.assets.map((a) => ({ assetId: a.assetId, url: a.glbUrl, ath: a.ath, atv: a.atv, depth: a.depth, scale: a.scale, rotationY: a.rotationY })),
    ttsAudio: stop.voiceover?.audioUrl
      ? [{ id: `${stop.id}_voiceover`, script_type: 'intro', audio_url: stop.voiceover.audioUrl, language: stop.voiceover.language || 'en' }]
      : [],
    avatar_intro: stop.voiceover?.script || '',
    streetViewStop: {
      stopId: stop.id,
      panoId: stop.panoId,
      lat: stop.lat,
      lng: stop.lng,
      heading: stop.heading,
      pitch: stop.pitch,
      links: stop.links,
      copyright: stop.copyright || null,
    },
    isTourStop: true,
    isTourStopIndex: index,
    tourStopCount: tour.stops.length,
  }));
}

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

  if (chapterId !== topicId && !(typeof topicId === 'string' && topicId.startsWith(`${chapterId}__stop_`))) {
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
  const now = admin.firestore.FieldValue.serverTimestamp();

  const tour = lessonData.streetViewTour as StreetViewTour | undefined;
  const hasTour = !!tour?.stops?.length;

  const commonMeta = {
    isDemo: options.markAsDemo,
    approval: { approved: true, approvedAt: new Date().toISOString(), approvedBy: options.approvedBy },
    source: 'user_generated_lesson',
    source_lesson_id: lessonId,
  };

  let topics: Record<string, unknown>[];
  let primaryTopicId: string;

  if (hasTour) {
    topics = buildTourTopics(lessonId, tour!).map((t) => ({ ...t, ...commonMeta }));
    primaryTopicId = String(topics[0].topic_id);
  } else {
    const topicId = `ugl_${lessonId}`;
    topics = [
      {
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
        ...commonMeta,
      },
    ];
    primaryTopicId = topicId;
  }

  await chapterRef.set({
    chapter_name: lessonData.title || 'Community Lesson',
    chapter_number: 1,
    curriculum: lessonData.curriculum || 'Community',
    class_name: lessonData.class_name || '',
    subject: lessonData.subject || lessonData.source || 'Community',
    approved: true,
    topics,
    isStreetViewTour: hasTour,
    createdAt: now,
    updatedAt: now,
    source: 'user_generated_lesson',
    source_lesson_id: lessonId,
    source_owner_uid: lessonData.ownerUid || null,
  });

  return { chapterId: chapterRef.id, topicId: primaryTopicId };
}
