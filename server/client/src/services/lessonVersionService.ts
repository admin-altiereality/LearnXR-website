/**
 * Lesson Version Service — create and list lesson versions (Firestore: lesson_versions).
 * Used for History tab (draft + submitted + approved) and approval workflow.
 *
 * NEW: Supports structured `changes[]` array, snapshot_ref to lesson_snapshots,
 *      and standardized tab keys.
 * LEGACY: Still reads old versions with changedSections, diff, bundleSnapshotJSON.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { LessonBundle } from './firestore/getLessonBundle';
import type {
  LessonVersion,
  LessonBundleSnapshot,
  LessonSectionKey,
  CreateLessonVersionInput,
  VersionDiffEntry,
  VersionEditedBy,
  LessonDraftSnapshot,
  LessonSnapshotDocument,
  ChangeRecord,
  EditableTabKey,
} from '../types/lessonVersion';
import { LESSON_SECTION_KEYS, SECTION_TO_TAB } from '../types/lessonVersion';

const COLLECTION_LESSON_VERSIONS = 'lesson_versions';
const COLLECTION_LESSON_SNAPSHOTS = 'lesson_snapshots';
const COLLECTION_CURRICULUM_CHAPTERS = 'curriculum_chapters';
const COLLECTION_CHAPTER_SNAPSHOTS = 'chapter_snapshots';
const VERSIONS_SUBCOLLECTION = 'versions';

/**
 * Recursively remove undefined values (Firestore does not accept undefined).
 * Replaces undefined with null so structure is preserved.
 */
function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) {
        out[k] = null;
      } else {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out;
  }
  return value;
}

// ============================================================================
// NEW: Build LessonDraftSnapshot from LessonBundle (standardized keys)
// ============================================================================

/**
 * Build a LessonDraftSnapshot (new standardized format) from a LessonBundle.
 * This is the snapshot stored in lesson_snapshots and used by the draft store.
 */
export function buildDraftSnapshotFromBundle(
  bundle: LessonBundle,
  topicId: string
): LessonDraftSnapshot {
  const targetTopic = bundle.chapter?.topics?.find(
    (t: { topic_id?: string }) => t.topic_id === topicId
  ) ?? bundle.chapter?.topics?.[0];

  const overview: LessonDraftSnapshot['overview'] = targetTopic
    ? {
        topic_id: targetTopic.topic_id,
        topic_name: targetTopic.topic_name,
        topic_priority: targetTopic.topic_priority,
        scene_type: targetTopic.scene_type,
        learning_objective: targetTopic.learning_objective,
      }
    : {};

  const scene_skybox: LessonDraftSnapshot['scene_skybox'] = targetTopic
    ? {
        in3d_prompt: targetTopic.in3d_prompt,
        camera_guidance: targetTopic.camera_guidance,
        skybox_id: targetTopic.skybox_id,
        skybox_url: bundle.skybox?.imageUrl || bundle.skybox?.file_url || '',
        asset_list: targetTopic.asset_list,
        sharedAssets: targetTopic.sharedAssets,
      }
    : {};

  const avatarScripts = bundle.avatarScripts || {};
  const avatar_script: LessonDraftSnapshot['avatar_script'] = {
    intro: avatarScripts.intro ?? bundle.intro ?? '',
    explanation: avatarScripts.explanation ?? bundle.explanation ?? '',
    outro: avatarScripts.outro ?? bundle.outro ?? '',
  };

  const assets3d: LessonDraftSnapshot['assets3d'] = (bundle.assets3d || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    glb_url: a.glb_url || a.file_url,
    file_url: a.file_url,
    thumbnail_url: a.thumbnail_url,
    status: a.status,
    approval_status: a.approval_status,
    isCore: a.isCore,
    assetTier: a.assetTier,
  }));

  const images: LessonDraftSnapshot['images'] = (bundle.images || []).map((i: any) => ({
    id: i.id,
    name: i.name || i.filename,
    image_url: i.image_url || i.url || i.imageUrl,
    url: i.url || i.image_url || i.imageUrl,
    thumbnail_url: i.thumbnail_url,
    type: i.type,
    caption: i.caption || i.description,
    isCore: i.isCore,
    assetTier: i.assetTier,
  }));

  const mcqs: LessonDraftSnapshot['mcqs'] = (bundle.mcqs || []).map((m: any) => ({
    id: m.id,
    question: m.question || m.question_text,
    options: m.options,
    correct_option_index: m.correct_option_index,
    explanation: m.explanation || m.explanation_text,
    difficulty: m.difficulty,
  }));

  const tts: LessonDraftSnapshot['tts'] = (bundle.tts || []).map((t: any) => ({
    id: t.id,
    script_type: t.script_type,
    audio_url: t.audio_url || t.audioUrl || t.url,
    language: t.language || bundle.lang,
    voice_name: t.voice_name,
  }));

  return {
    lang: bundle.lang,
    overview,
    scene_skybox,
    assets3d,
    images,
    avatar_script,
    mcqs,
    tts,
  };
}

// ============================================================================
// LEGACY: Build LessonBundleSnapshot (old format, kept for backward compat)
// ============================================================================

/**
 * Build a normalized snapshot from a LessonBundle for diffing and storage.
 * Maps bundle fields to section keys (overview, scene, mcqs, etc.).
 * @deprecated Use buildDraftSnapshotFromBundle for new versions
 */
export function buildSnapshotFromBundle(
  bundle: LessonBundle,
  topicId: string
): LessonBundleSnapshot {
  const targetTopic = bundle.chapter?.topics?.find(
    (t: { topic_id?: string }) => t.topic_id === topicId
  ) ?? bundle.chapter?.topics?.[0];

  const overview = targetTopic
    ? {
        topic_id: targetTopic.topic_id,
        topic_name: targetTopic.topic_name,
        topic_priority: targetTopic.topic_priority,
        scene_type: targetTopic.scene_type,
        learning_objective: targetTopic.learning_objective,
      }
    : undefined;

  const scene = targetTopic
    ? {
        in3d_prompt: targetTopic.in3d_prompt,
        camera_guidance: targetTopic.camera_guidance,
        skybox_id: targetTopic.skybox_id,
        asset_list: targetTopic.asset_list,
        sharedAssets: targetTopic.sharedAssets,
      }
    : undefined;

  const avatarScript = bundle.avatarScripts
    ? {
        intro: bundle.avatarScripts.intro ?? bundle.intro,
        explanation: bundle.avatarScripts.explanation ?? bundle.explanation,
        outro: bundle.avatarScripts.outro ?? bundle.outro,
      }
    : { intro: bundle.intro, explanation: bundle.explanation, outro: bundle.outro };

  const skybox = bundle.skybox
    ? { id: bundle.skybox.id, imageUrl: bundle.skybox.imageUrl, file_url: bundle.skybox.file_url }
    : null;

  const assets3D = (bundle.assets3d || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    file_url: a.file_url,
    glb_url: a.glb_url || a.file_url,
    approval_status: a.approval_status,
  }));

  const images = (bundle.images || []).map((i: any) => ({
    id: i.id,
    url: i.url || i.image_url,
    image_url: i.image_url || i.url,
    name: i.name,
    caption: i.caption,
    type: i.type,
  }));

  const audio = (bundle.tts || []).map((t: any) => ({
    id: t.id,
    language: t.language,
    script_type: t.script_type,
  }));

  const textTo3dAssets = (bundle.textTo3dAssets || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    approval_status: a.approval_status,
  }));

  const mcqs = (bundle.mcqs || []).map((m: any) => ({
    id: m.id,
    question: m.question || m.question_text,
    options: m.options,
    correct_option_index: m.correct_option_index,
    explanation: m.explanation || m.explanation_text,
  }));

  return {
    lang: bundle.lang,
    overview,
    scene,
    mcqs,
    avatarScript,
    skybox,
    assets3D,
    images,
    audio,
    textTo3dAssets,
  };
}

// ============================================================================
// LEGACY helpers (kept for backward compat)
// ============================================================================

function sectionHash(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

export function getChangedSections(
  prev: LessonBundleSnapshot | null,
  next: LessonBundleSnapshot
): LessonSectionKey[] {
  const changed: LessonSectionKey[] = [];
  const prevMap = prev ? (prev as unknown) as Record<string, unknown> : null;
  const nextMap = next as unknown as Record<string, unknown>;
  for (const key of LESSON_SECTION_KEYS) {
    const prevVal = prevMap?.[key];
    const nextVal = nextMap[key];
    if (sectionHash(prevVal) !== sectionHash(nextVal)) {
      changed.push(key);
    }
  }
  return changed;
}

function diffValue(val: unknown): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

export function buildChangedTabsFieldsAndDiff(
  prev: LessonBundleSnapshot | null,
  next: LessonBundleSnapshot
): {
  changed_tabs: string[];
  changed_fields: Record<string, string[]>;
  diff: Record<string, VersionDiffEntry>;
} {
  const changed_tabs: string[] = [];
  const changed_fields: Record<string, string[]> = {};
  const diff: Record<string, VersionDiffEntry> = {};
  const prevMap = prev ? (prev as unknown) as Record<string, unknown> : null;
  const nextMap = next as unknown as Record<string, unknown>;

  for (const sectionKey of LESSON_SECTION_KEYS) {
    const tabName = SECTION_TO_TAB[sectionKey] ?? sectionKey;
    const prevVal = prevMap?.[sectionKey];
    const nextVal = nextMap[sectionKey];
    if (sectionHash(prevVal) === sectionHash(nextVal)) continue;

    changed_tabs.push(tabName);

    if (
      prevVal != null &&
      nextVal != null &&
      typeof prevVal === 'object' &&
      typeof nextVal === 'object' &&
      !Array.isArray(prevVal) &&
      !Array.isArray(nextVal)
    ) {
      const prevObj = prevVal as Record<string, unknown>;
      const nextObj = nextVal as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
      const fields: string[] = [];
      for (const k of allKeys) {
        const p = prevObj[k];
        const n = nextObj[k];
        if (JSON.stringify(p) === JSON.stringify(n)) continue;
        fields.push(k);
        const path = `${tabName}.${k}`;
        diff[path] = { old: diffValue(p), new: diffValue(n) };
      }
      if (fields.length > 0) changed_fields[tabName] = fields;
    } else if (Array.isArray(prevVal) || Array.isArray(nextVal)) {
      changed_fields[tabName] = ['items'];
      const path = `${tabName}.items`;
      diff[path] = { old: diffValue(prevVal), new: diffValue(nextVal) };
    } else {
      changed_fields[tabName] = ['value'];
      diff[`${tabName}.value`] = { old: diffValue(prevVal), new: diffValue(nextVal) };
    }
  }

  return { changed_tabs, changed_fields, diff };
}

// ============================================================================
// CHAPTER VERSIONS (curriculum_chapters/{chapterId}/versions)
// Main lesson doc stays untouched until Superadmin approves
// ============================================================================

/**
 * Write a snapshot to chapter_snapshots (for versions subcollection flow).
 */
async function writeChapterSnapshot(
  snapshot: LessonDraftSnapshot,
  meta: { chapterId: string; topicId: string; versionNumber: number }
): Promise<string> {
  const ref = collection(db, COLLECTION_CHAPTER_SNAPSHOTS);
  const docData = {
    chapterId: meta.chapterId,
    topicId: meta.topicId,
    version_number: meta.versionNumber,
    fullLessonBundle: snapshot,
    created_at: new Date().toISOString(),
  };
  const sanitized = sanitizeForFirestore(docData) as Record<string, unknown>;
  const docRef = await addDoc(ref, sanitized);
  return docRef.id;
}

/**
 * Get next version number from curriculum_chapters/{chapterId}/versions for a topic.
 */
async function getNextVersionNumberFromChapter(
  chapterId: string,
  topicId: string
): Promise<number> {
  const versions = await getVersionsFromChapter(chapterId, topicId, { limitCount: 1 });
  if (versions.length === 0) return 1;
  return ((versions[0].versionNumber ?? versions[0].version_number) ?? 0) + 1;
}

/**
 * Create a version in curriculum_chapters/{chapterId}/versions.
 * Core lesson doc stays untouched until Superadmin approves.
 */
export async function createVersionInChapter(input: CreateLessonVersionInput): Promise<string> {
  if (!input.chapterId || !input.topicId) {
    throw new Error('createVersionInChapter: chapterId and topicId are required');
  }

  const versionNumber = await getNextVersionNumberFromChapter(input.chapterId, input.topicId);

  // Step 1: Write snapshot to chapter_snapshots
  let snapshotRef: string | null = null;
  try {
    snapshotRef = await writeChapterSnapshot(input.draftSnapshot, {
      chapterId: input.chapterId,
      topicId: input.topicId,
      versionNumber,
    });
  } catch (e) {
    console.warn('writeChapterSnapshot failed:', e);
  }

  const versionPayload = {
    version_number: versionNumber,
    topicId: input.topicId,
    change_summary: input.changeSummary,
    changed_tabs: input.changed_tabs ?? [],
    changes: input.changes ?? [],
    editor: input.edited_by ?? { uid: input.createdBy, email: input.createdByEmail, role: input.createdByRole },
    status: 'draft',
    approval_required: true,
    approved: false,
    approved_by: null,
    approved_at: null,
    snapshot_ref: snapshotRef ? `${COLLECTION_CHAPTER_SNAPSHOTS}/${snapshotRef}` : null,
    created_at: new Date().toISOString(),
    createdBy: input.createdBy,
    createdByEmail: input.createdByEmail ?? null,
    createdByRole: input.createdByRole ?? null,
    // Legacy compat for History tab
    changed_fields: input.changed_fields ?? {},
    diff: input.diff ?? {},
    changedSections: input.changedSections ?? [],
  };

  const sanitized = sanitizeForFirestore(versionPayload) as Record<string, unknown>;
  const chapterRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, input.chapterId);
  const versionsRef = collection(chapterRef, VERSIONS_SUBCOLLECTION);
  const docRef = await addDoc(versionsRef, sanitized);
  return docRef.id;
}

/**
 * Fetch versions from curriculum_chapters/{chapterId}/versions for a topic.
 */
export async function getVersionsFromChapter(
  chapterId: string,
  topicId: string,
  options?: { limitCount?: number }
): Promise<LessonVersion[]> {
  if (!chapterId || !topicId) return [];
  const limitCount = Math.min(Math.max(1, options?.limitCount ?? 50), 100);

  try {
    const chapterRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, chapterId);
    const versionsRef = collection(chapterRef, VERSIONS_SUBCOLLECTION);
    const q = query(
      versionsRef,
      where('topicId', '==', topicId),
      orderBy('version_number', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        chapterId,
        topicId: data.topicId ?? topicId,
        versionNumber: data.version_number ?? data.versionNumber,
        createdAt: data.created_at ?? data.createdAt,
        createdBy: data.createdBy,
        createdByEmail: data.createdByEmail,
        createdByRole: data.createdByRole,
        status: data.status,
        changeSummary: data.change_summary ?? data.changeSummary,
        changed_tabs: (data.changed_tabs as string[] | undefined) ?? undefined,
        changes: (data.changes as ChangeRecord[] | undefined) ?? undefined,
        edited_by: (data.editor as VersionEditedBy | undefined) ?? data.edited_by,
        approval: data.approval ?? undefined,
        approved: (data.approved as boolean | undefined) ?? false,
        snapshot_ref: (data.snapshot_ref as string | undefined) ?? undefined,
        changed_fields: (data.changed_fields as Record<string, string[] | undefined>) ?? undefined,
        diff: (data.diff as Record<string, VersionDiffEntry> | undefined) ?? undefined,
        bundleSnapshotJSON: data.bundleSnapshotJSON,
        changedSections: (data.changedSections as LessonVersion['changedSections']) ?? [],
        parentVersionId: data.parentVersionId ?? null,
        reviewedAt: data.reviewed_at ?? data.reviewedAt ?? null,
        reviewedBy: data.approved_by ?? data.reviewedBy ?? null,
      } as LessonVersion;
    });
  } catch (e) {
    console.warn('getVersionsFromChapter failed:', e);
    return [];
  }
}

/**
 * Get the latest version for (chapterId, topicId) from the versions subcollection.
 */
export async function getLatestVersionFromChapter(
  chapterId: string,
  topicId: string
): Promise<LessonVersion | null> {
  const versions = await getVersionsFromChapter(chapterId, topicId, { limitCount: 1 });
  return versions[0] ?? null;
}

/**
 * Get the latest unapproved version created by a specific user for a topic.
 * Used to overlay Associate's draft onto the published bundle on the dashboard.
 */
export async function getLatestUnapprovedVersionForUser(
  chapterId: string,
  topicId: string,
  userId: string
): Promise<LessonVersion | null> {
  const versions = await getVersionsFromChapter(chapterId, topicId, { limitCount: 50 });
  const userDraft = versions.find(
    (v) => v.createdBy === userId && !((v as { approved?: boolean }).approved)
  );
  return userDraft ?? null;
}

/**
 * Get topic IDs that have an unapproved version with a snapshot for the given user.
 * Used for topic-aware admin preview (preview the topic the associate actually edited).
 */
export async function getTopicIdsWithUnapprovedVersionForUser(
  chapterId: string,
  userId: string
): Promise<string[]> {
  const chapterRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, chapterId);
  const chapterSnap = await getDoc(chapterRef);
  if (!chapterSnap.exists()) return [];
  const chapterData = chapterSnap.data() as { topics?: Array<{ topic_id: string }> };
  const topics = chapterData.topics || [];
  const topicIds: string[] = [];
  for (const topic of topics) {
    const topicId = topic.topic_id;
    const version = await getLatestUnapprovedVersionForUser(chapterId, topicId, userId);
    if (version?.snapshot_ref) topicIds.push(topicId);
  }
  return topicIds;
}

/**
 * Fetch a snapshot from chapter_snapshots by ref (e.g. "chapter_snapshots/xxx").
 * Returns fullLessonBundle (LessonDraftSnapshot) or null.
 */
export async function getChapterSnapshot(snapshotRef: string | null): Promise<LessonDraftSnapshot | null> {
  if (!snapshotRef || typeof snapshotRef !== 'string') return null;
  const parts = snapshotRef.split('/');
  const snapshotId = parts[parts.length - 1];
  if (!snapshotId || !parts[0]?.includes('chapter_snapshots')) return null;
  try {
    const ref = doc(db, COLLECTION_CHAPTER_SNAPSHOTS, snapshotId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as { fullLessonBundle?: LessonDraftSnapshot };
    return data.fullLessonBundle ?? null;
  } catch (e) {
    console.warn('getChapterSnapshot failed:', e);
    return null;
  }
}

/**
 * Apply a draft snapshot to the main schema and approve the topic.
 * Called when Superadmin approves a chapter edit request.
 * Merges snapshot into curriculum_chapters, chapter_mcqs, and sets topic approval.
 */
export async function applySnapshotToMainAndApproveTopic(
  chapterId: string,
  topicId: string,
  draft: LessonDraftSnapshot,
  versionId: string,
  reviewedBy: string
): Promise<void> {
  const {
    updateChapterMCQs,
    updateTopicApproval,
    addImageIdToChapterSharedAssets,
    removeImageIdFromChapterSharedAssets,
    deleteChapterImage,
    linkMeshyAssetsToTopic,
    unlinkMeshyAssetFromTopic,
  } = await import('../lib/firestore/updateHelpers');

  const chapterRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, chapterId);
  const chapterSnap = await getDoc(chapterRef);
  if (!chapterSnap.exists()) throw new Error('Chapter not found');

  // Apply asset delete requests from the version's changes (Associate-requested deletions)
  const versionRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, chapterId, VERSIONS_SUBCOLLECTION, versionId);
  const versionSnap = await getDoc(versionRef);
  const versionData = versionSnap.exists() ? (versionSnap.data() as { changes?: ChangeRecord[] }) : null;
  const changes = versionData?.changes ?? [];
  for (const change of changes) {
    if (change.type !== 'asset_delete_request') continue;
    const parts = (change.field_path || '').split('.');
    const itemId = parts.length >= 2 ? parts[1] : null;
    if (!itemId) continue;
    if (change.tab === 'images') {
      try {
        await deleteChapterImage(itemId);
        await removeImageIdFromChapterSharedAssets(chapterId, itemId);
      } catch (err) {
        console.warn('Error applying image delete request:', itemId, err);
      }
    } else if (change.tab === 'assets3d') {
      try {
        await deleteDoc(doc(db, 'meshy_assets', itemId));
        await unlinkMeshyAssetFromTopic({ chapterId, topicId, assetId: itemId, userId: reviewedBy });
      } catch (err) {
        console.warn('Error applying 3D asset delete request:', itemId, err);
      }
    }
  }

  const chapter = chapterSnap.data() as Record<string, unknown> & { topics?: Array<Record<string, unknown>> };
  const topicIndex = chapter.topics?.findIndex((t: Record<string, unknown>) => t.topic_id === topicId);
  if (topicIndex === undefined || topicIndex === -1) throw new Error('Topic not found');

  const updatedTopics = [...(chapter.topics || [])];
  const currentTopic = updatedTopics[topicIndex] as Record<string, unknown>;
  const lang = (draft.lang || 'en') as string;

  // Merge overview
  if (draft.overview) {
    if (draft.overview.topic_name !== undefined) currentTopic.topic_name = draft.overview.topic_name;
    if (draft.overview.learning_objective !== undefined) currentTopic.learning_objective = draft.overview.learning_objective;
    if (draft.overview.topic_priority !== undefined) currentTopic.topic_priority = draft.overview.topic_priority;
    if (draft.overview.scene_type !== undefined) currentTopic.scene_type = draft.overview.scene_type;
  }

  // Merge scene_skybox
  if (draft.scene_skybox) {
    if (draft.scene_skybox.in3d_prompt !== undefined) currentTopic.in3d_prompt = draft.scene_skybox.in3d_prompt;
    if (draft.scene_skybox.camera_guidance !== undefined) currentTopic.camera_guidance = draft.scene_skybox.camera_guidance;
    // Only overwrite skybox when draft has a meaningful value — preserve existing when draft has null/empty
    // (Associate may have edited only avatar/MCQs; draft can have skybox_url: '' or skybox_id: null)
    if (draft.scene_skybox.skybox_id != null && String(draft.scene_skybox.skybox_id).trim() !== '') {
      currentTopic.skybox_id = draft.scene_skybox.skybox_id;
    }
    if (draft.scene_skybox.skybox_url != null && String(draft.scene_skybox.skybox_url).trim() !== '') {
      currentTopic.skybox_url = draft.scene_skybox.skybox_url;
    }
    if (draft.scene_skybox.asset_list) {
      const shared = (currentTopic.sharedAssets as Record<string, unknown>) || {};
      currentTopic.sharedAssets = { ...shared, asset_list: draft.scene_skybox.asset_list };
    }
    // Preserve sharedAssets.skybox when merging draft.sharedAssets — don't overwrite with empty
    if (draft.scene_skybox.sharedAssets && typeof draft.scene_skybox.sharedAssets === 'object') {
      const shared = (currentTopic.sharedAssets as Record<string, unknown>) || {};
      const merged = { ...shared };
      const ds = draft.scene_skybox.sharedAssets as Record<string, unknown>;
      if (ds.skybox_id != null && String(ds.skybox_id).trim() !== '') merged.skybox_id = ds.skybox_id;
      if (ds.skybox_url != null && String(ds.skybox_url).trim() !== '') merged.skybox_url = ds.skybox_url;
      currentTopic.sharedAssets = merged;
    }
  }

  // Merge avatar_script (topic_avatar_scripts[lang])
  if (draft.avatar_script) {
    const scripts = currentTopic.topic_avatar_scripts as Record<string, unknown> || {};
    scripts[lang] = {
      intro: draft.avatar_script.intro ?? '',
      explanation: draft.avatar_script.explanation ?? '',
      outro: draft.avatar_script.outro ?? '',
    };
    currentTopic.topic_avatar_scripts = scripts;
    if (lang === 'en') {
      currentTopic.topic_avatar_intro = draft.avatar_script.intro;
      currentTopic.topic_avatar_explanation = draft.avatar_script.explanation;
      currentTopic.topic_avatar_outro = draft.avatar_script.outro;
    }
  }

  // Apply draft TTS to chapter_tts (Associate-generated; stored in snapshot until approval)
  const TTS_VOICE_NAME = 'female_professional';
  if (Array.isArray(draft.tts) && draft.tts.length > 0) {
    const ttsIds: string[] = [];
    for (const t of draft.tts) {
      const ttsLang = t.language || lang;
      const ttsId = `${topicId}_${t.script_type}_${ttsLang}_${TTS_VOICE_NAME}`;
      ttsIds.push(ttsId);
      await setDoc(
        doc(db, 'chapter_tts', ttsId),
        {
          chapter_id: chapterId,
          topic_id: topicId,
          script_type: t.script_type,
          audio_url: t.audio_url || '',
          language: ttsLang,
          voice_name: t.voice_name || TTS_VOICE_NAME,
          status: 'complete',
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
    }
    const existingByLang = (currentTopic.tts_ids_by_language as Record<string, string[]>) || {};
    currentTopic.tts_ids_by_language = { ...existingByLang, [lang]: ttsIds };
    const otherLang = lang === 'en' ? 'hi' : 'en';
    const otherIds = existingByLang[otherLang] || [];
    currentTopic.tts_ids = [...otherIds, ...ttsIds];
  }

  updatedTopics[topicIndex] = currentTopic;
  await updateDoc(chapterRef, {
    topics: updatedTopics,
    updatedAt: serverTimestamp(),
  });
  const { invalidateLessonBundleCache } = await import('./firestore/getLessonBundle');
  invalidateLessonBundleCache(chapterId);

  // Update MCQs (check which exist to avoid updateDoc on non-existent docs)
  if (Array.isArray(draft.mcqs) && draft.mcqs.length > 0) {
    const mcqsRef = collection(db, 'chapter_mcqs');
    const mcqsQ = query(
      mcqsRef,
      where('chapter_id', '==', chapterId),
      where('topic_id', '==', topicId)
    );
    const existingSnap = await getDocs(mcqsQ);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const mcqPayload = draft.mcqs.map((m, i) => {
      const hasValidId = m.id && existingIds.has(m.id);
      return {
        id: hasValidId ? m.id : undefined,
        _isNew: !hasValidId,
        question: m.question ?? m.question_text ?? '',
        options: Array.isArray(m.options) ? m.options : [],
        correct_option_index: m.correct_option_index ?? 0,
        explanation: m.explanation ?? '',
        difficulty: m.difficulty ?? 'medium',
        order: i,
      };
    });
    const result = await updateChapterMCQs({ chapterId, topicId, mcqs: mcqPayload, userId: reviewedBy });
    if (!result.success) console.warn('updateChapterMCQs failed:', result.error);
  }

  // Link asset IDs to topic (snapshot has full objects; we use their ids)
  if (Array.isArray(draft.assets3d) && draft.assets3d.length > 0) {
    const assetIds = draft.assets3d.map((a) => a.id).filter(Boolean);
    if (assetIds.length > 0) {
      await linkMeshyAssetsToTopic({ chapterId, topicId, assetIds, userId: reviewedBy });
    }
  }

  // Link image IDs to chapter sharedAssets (images assumed to exist in chapter_images from prior publish/approval)
  if (Array.isArray(draft.images) && draft.images.length > 0) {
    for (const img of draft.images) {
      if (img.id) await addImageIdToChapterSharedAssets(chapterId, img.id);
    }
  }

  // Approve the topic so it's visible on Lessons page
  await updateTopicApproval({ chapterId, topicId, approved: true, userId: reviewedBy });

  // Mark version as approved (versionRef already defined above for loading changes)
  await updateDoc(versionRef, {
    approved: true,
    approved_by: reviewedBy,
    approved_at: serverTimestamp(),
  });
}

// ============================================================================
// NEW: Snapshot writer — stores full bundle in lesson_snapshots (legacy)
// ============================================================================

/**
 * Write a snapshot to the lesson_snapshots collection.
 * Returns the snapshot document ID.
 */
export async function writeSnapshot(
  snapshot: LessonDraftSnapshot,
  meta: { chapterId: string; topicId: string; versionNumber: number }
): Promise<string> {
  const ref = collection(db, COLLECTION_LESSON_SNAPSHOTS);
  const docData: Omit<LessonSnapshotDocument, 'created_at'> & { created_at: string } = {
    chapterId: meta.chapterId,
    topicId: meta.topicId,
    version_number: meta.versionNumber,
    lessonBundle: snapshot,
    created_at: new Date().toISOString(),
  };
  const sanitized = sanitizeForFirestore(docData) as Record<string, unknown>;
  const docRef = await addDoc(ref, sanitized);
  return docRef.id;
}

/**
 * Fetch a snapshot from lesson_snapshots by document ID.
 */
export async function getSnapshot(snapshotId: string): Promise<LessonDraftSnapshot | null> {
  try {
    const ref = doc(db, COLLECTION_LESSON_SNAPSHOTS, snapshotId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as LessonSnapshotDocument;
    return data.lessonBundle ?? null;
  } catch (e) {
    console.warn('getSnapshot failed:', e);
    return null;
  }
}

// ============================================================================
// Version number
// ============================================================================

async function getNextVersionNumber(chapterId: string, topicId: string): Promise<number> {
  if (!chapterId || !topicId) return 1;
  try {
    const versions = await getLessonVersions(chapterId, topicId, { limitCount: 1 });
    if (versions.length === 0) return 1;
    return (versions[0].versionNumber ?? 0) + 1;
  } catch {
    return 1;
  }
}

// ============================================================================
// Create version — NEW schema
// ============================================================================

/**
 * Create a new lesson version (draft) with the new schema.
 *
 * - Writes snapshot to lesson_snapshots (separate collection)
 * - Writes lightweight version doc to lesson_versions with changes[], snapshot_ref
 * - Also writes legacy fields for backward compat with existing History tab
 */
export async function createLessonVersion(input: CreateLessonVersionInput): Promise<string> {
  if (!input.chapterId || !input.topicId) {
    throw new Error('createLessonVersion: chapterId and topicId are required');
  }

  const versionNumber = await getNextVersionNumber(input.chapterId, input.topicId);

  // Step 1: Write snapshot to lesson_snapshots (always, for new versions)
  let snapshotRef: string | null = null;
  try {
    snapshotRef = await writeSnapshot(input.draftSnapshot, {
      chapterId: input.chapterId,
      topicId: input.topicId,
      versionNumber,
    });
  } catch (e) {
    console.warn('writeSnapshot failed (will embed in version doc):', e);
  }

  // Step 2: Build legacy diff fields for backward compat
  // (old History tab reads these)
  const legacyChangedFields: Record<string, string[]> = {};
  const legacyDiff: Record<string, VersionDiffEntry> = {};
  if (input.changes && input.changes.length > 0) {
    for (const change of input.changes) {
      const tab = change.tab;
      if (!legacyChangedFields[tab]) legacyChangedFields[tab] = [];
      const fieldName = change.field_path.split('.').slice(1).join('.') || change.field_path;
      legacyChangedFields[tab].push(fieldName);

      legacyDiff[change.field_path] = {
        old: diffValue(change.old_value),
        new: diffValue(change.new_value),
      };
    }
  }

  // Step 3: Create version document (sanitize to strip undefined for Firestore)
  const ref = collection(db, COLLECTION_LESSON_VERSIONS);
  const versionPayload = {
    // Core fields
    chapterId: input.chapterId,
    topicId: input.topicId,
    versionNumber,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    createdByEmail: input.createdByEmail ?? null,
    createdByRole: input.createdByRole ?? null,
    status: 'draft',
    changeSummary: input.changeSummary,

    // NEW schema fields
    changed_tabs: input.changed_tabs,
    changes: input.changes ?? [],
    edited_by: input.edited_by ?? { email: input.createdByEmail, role: input.createdByRole },
    approval: { requested_at: null, reviewed_at: null, reviewed_by: null, notes: null },
    snapshot_ref: snapshotRef ? `${COLLECTION_LESSON_SNAPSHOTS}/${snapshotRef}` : null,

    // LEGACY fields (for backward compat)
    changed_fields: input.changed_fields ?? legacyChangedFields,
    diff: input.diff ?? legacyDiff,
    bundleSnapshotJSON: snapshotRef ? null : (input.bundleSnapshot ?? null),
    changedSections: input.changedSections ?? [],
    parentVersionId: input.parentVersionId ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
  const sanitized = sanitizeForFirestore(versionPayload) as Record<string, unknown>;
  const docRef = await addDoc(ref, sanitized);

  return docRef.id;
}

// ============================================================================
// Read versions
// ============================================================================

/**
 * Fetch lesson versions for a topic, newest first.
 */
export async function getLessonVersions(
  chapterId: string,
  topicId: string,
  options?: { limitCount?: number }
): Promise<LessonVersion[]> {
  if (!chapterId || !topicId) return [];
  const limitCount = Math.min(Math.max(1, options?.limitCount ?? 50), 100);
  const cId = String(chapterId);
  const tId = String(topicId);

  try {
    const ref = collection(db, COLLECTION_LESSON_VERSIONS);
    const q = query(
      ref,
      where('chapterId', '==', cId),
      orderBy('versionNumber', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        chapterId: data.chapterId,
        topicId: data.topicId,
        versionNumber: data.versionNumber,
        createdAt: data.createdAt,
        createdBy: data.createdBy,
        createdByEmail: data.createdByEmail,
        createdByRole: data.createdByRole,
        status: data.status,
        changeSummary: data.changeSummary,

        // NEW fields
        changed_tabs: (data.changed_tabs as string[] | undefined) ?? undefined,
        changes: (data.changes as ChangeRecord[] | undefined) ?? undefined,
        edited_by: (data.edited_by as VersionEditedBy | undefined) ?? undefined,
        approval: data.approval ?? undefined,
        snapshot_ref: (data.snapshot_ref as string | undefined) ?? undefined,

        // LEGACY fields
        changed_fields: (data.changed_fields as Record<string, string[]> | undefined) ?? undefined,
        diff: (data.diff as Record<string, VersionDiffEntry> | undefined) ?? undefined,
        bundleSnapshotJSON: data.bundleSnapshotJSON,
        changedSections: (data.changedSections as LessonVersion['changedSections']) ?? [],
        parentVersionId: data.parentVersionId ?? null,
        diffJSON: data.diffJSON,
        reviewedAt: data.reviewedAt ?? null,
        reviewedBy: data.reviewedBy ?? null,
      } as LessonVersion;
    });
    return all.filter((v) => String(v.topicId) === tId).slice(0, limitCount);
  } catch (e) {
    console.warn('getLessonVersions failed:', e);
    return [];
  }
}

/**
 * Get a single version by id.
 */
export async function getLessonVersionById(versionId: string): Promise<LessonVersion | null> {
  const ref = doc(db, COLLECTION_LESSON_VERSIONS, versionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    chapterId: data.chapterId,
    topicId: data.topicId,
    versionNumber: data.versionNumber,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
    createdByEmail: data.createdByEmail,
    createdByRole: data.createdByRole,
    status: data.status,
    changeSummary: data.changeSummary,
    changed_tabs: (data.changed_tabs as string[] | undefined) ?? undefined,
    changes: (data.changes as ChangeRecord[] | undefined) ?? undefined,
    changed_fields: (data.changed_fields as Record<string, string[]> | undefined) ?? undefined,
    diff: (data.diff as Record<string, VersionDiffEntry> | undefined) ?? undefined,
    edited_by: (data.edited_by as VersionEditedBy | undefined) ?? undefined,
    approval: data.approval ?? undefined,
    bundleSnapshotJSON: data.bundleSnapshotJSON,
    changedSections: (data.changedSections as LessonVersion['changedSections']) ?? [],
    parentVersionId: data.parentVersionId ?? null,
    diffJSON: data.diffJSON,
    reviewedAt: data.reviewedAt ?? null,
    reviewedBy: data.reviewedBy ?? null,
    snapshot_ref: (data.snapshot_ref as string | undefined) ?? undefined,
  } as LessonVersion;
}

/**
 * Get the latest version for (chapterId, topicId) — for computing parent and diff.
 */
export async function getLatestLessonVersion(
  chapterId: string,
  topicId: string
): Promise<LessonVersion | null> {
  if (!chapterId || !topicId) return null;
  const versions = await getLessonVersions(chapterId, topicId, { limitCount: 1 });
  return versions[0] ?? null;
}
