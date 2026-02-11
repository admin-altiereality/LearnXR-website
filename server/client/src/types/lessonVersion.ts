/**
 * Lesson Version History — Git-style versioning per topic (lesson).
 * Used by History tab, draft store, diff engine, and Associate → Admin approval workflow.
 *
 * STANDARDIZED TAB KEYS (used everywhere: store, diff, Firestore, UI):
 *   overview, scene_skybox, assets3d, images, avatar_script, mcqs
 *
 * Non-editable tabs (never appear in diffs): history, source
 */

// ============================================================================
// Tab Keys & Labels
// ============================================================================

/** The 6 editable tab keys used across diff engine, store, and Firestore. */
export const EDITABLE_TAB_KEYS = [
  'overview',
  'scene_skybox',
  'assets3d',
  'images',
  'avatar_script',
  'mcqs',
] as const;

export type EditableTabKey = (typeof EDITABLE_TAB_KEYS)[number];

/** Human-readable display labels for tabs */
export const TAB_LABELS: Record<EditableTabKey, string> = {
  overview: 'Overview',
  scene_skybox: 'Scene & Skybox',
  assets3d: '3D Assets',
  images: 'Images',
  avatar_script: 'Avatar Script',
  mcqs: 'MCQs',
};

/** All tab IDs used by the TopicEditor (includes read-only tabs) */
export const ALL_TAB_IDS = [
  'overview',
  'scene',       // UI tab id (maps to scene_skybox in version schema)
  'assets',      // UI tab id (maps to assets3d in version schema)
  'images',
  'avatar',      // UI tab id (maps to avatar_script in version schema)
  'mcqs',
  'history',
  'source',
] as const;

/** Map editor UI tab ID → standard version tab key */
export const UI_TAB_TO_VERSION_KEY: Record<string, EditableTabKey> = {
  overview: 'overview',
  scene: 'scene_skybox',
  assets: 'assets3d',
  images: 'images',
  avatar: 'avatar_script',
  mcqs: 'mcqs',
};

/** Map standard version tab key → editor UI tab ID */
export const VERSION_KEY_TO_UI_TAB: Record<EditableTabKey, string> = {
  overview: 'overview',
  scene_skybox: 'scene',
  assets3d: 'assets',
  images: 'images',
  avatar_script: 'avatar',
  mcqs: 'mcqs',
};

// ============================================================================
// Legacy Section Keys (backward compat with existing versions)
// ============================================================================

/** Legacy section keys that we track for "which tab changed" and for diffing */
export const LESSON_SECTION_KEYS = [
  'overview',
  'scene',
  'mcqs',
  'avatarScript',
  'skybox',
  'assets3D',
  'images',
  'audio',
  'textTo3dAssets',
] as const;

export type LessonSectionKey = (typeof LESSON_SECTION_KEYS)[number];

/** Legacy: Map our old section keys to old standard tab names for Firestore */
export const SECTION_TO_TAB: Record<LessonSectionKey, string> = {
  overview: 'overview',
  scene: 'scene',
  mcqs: 'mcqs',
  avatarScript: 'avatar',
  skybox: 'skybox',
  assets3D: 'assets3D',
  images: 'images',
  audio: 'audio',
  textTo3dAssets: 'textTo3dAssets',
};

// ============================================================================
// Lesson Bundle Snapshot
// ============================================================================

/** Status of a lesson version */
export type LessonVersionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

/**
 * Snapshot of a lesson (one topic) for a single language.
 * NEW standardized keys matching EDITABLE_TAB_KEYS.
 * Stored in lesson_snapshots/{id}.lessonBundle.
 */
export interface LessonDraftSnapshot {
  lang: string;
  overview: {
    topic_id?: string;
    topic_name?: string;
    topic_priority?: number;
    scene_type?: string;
    learning_objective?: string;
    [key: string]: unknown;
  };
  scene_skybox: {
    in3d_prompt?: string;
    camera_guidance?: string;
    skybox_id?: string;
    skybox_url?: string;
    asset_list?: string[];
    sharedAssets?: Record<string, unknown>;
    [key: string]: unknown;
  };
  assets3d: Array<{
    id: string;
    name?: string;
    glb_url?: string;
    file_url?: string;
    thumbnail_url?: string;
    status?: string;
    approval_status?: boolean;
    isCore?: boolean;
    assetTier?: string;
    [key: string]: unknown;
  }>;
  images: Array<{
    id: string;
    name?: string;
    image_url?: string;
    url?: string;
    thumbnail_url?: string;
    type?: string;
    caption?: string;
    isCore?: boolean;
    assetTier?: string;
    [key: string]: unknown;
  }>;
  avatar_script: {
    intro?: string;
    explanation?: string;
    outro?: string;
    [key: string]: unknown;
  };
  mcqs: Array<{
    id?: string;
    question?: string;
    options?: string[];
    correct_option_index?: number;
    explanation?: string;
    difficulty?: string;
    [key: string]: unknown;
  }>;
}

/**
 * Legacy snapshot shape (existing versions stored with these keys).
 * Kept for backward compatibility in HistoryTab rendering.
 */
export interface LessonBundleSnapshot {
  lang: string;
  overview?: Record<string, unknown>;
  scene?: Record<string, unknown>;
  mcqs?: unknown[];
  avatarScript?: Record<string, unknown>;
  skybox?: Record<string, unknown> | null;
  assets3D?: unknown[];
  images?: unknown[];
  audio?: unknown[];
  textTo3dAssets?: unknown[];
}

// ============================================================================
// Change Records (NEW — used in version.changes array)
// ============================================================================

/** Type of change in a diff */
export type ChangeType =
  | 'edit'                  // A field value changed (string, number, etc.)
  | 'add'                   // An array item was added (new MCQ, etc.)
  | 'remove'                // An array item was removed
  | 'reorder'               // An array was reordered
  | 'asset_add'             // An image or 3D asset was added (includes asset_url)
  | 'asset_delete_request'; // Associate requested deletion (includes asset_url, needs admin approval)

/**
 * A single atomic change, stored in version.changes[].
 * This is the core of the diff system.
 */
export interface ChangeRecord {
  /** Which tab: "overview", "scene_skybox", "assets3d", "images", "avatar_script", "mcqs" */
  tab: EditableTabKey;
  /** Dot-path within that tab section: "overview.topic_name", "mcqs.2.question", "images.5" */
  field_path: string;
  /** What kind of change */
  type: ChangeType;
  /** Previous value (null for adds) — stored as JSON string for Firestore safety */
  old_value: unknown;
  /** New value (null for removes/delete requests) — stored as JSON string for Firestore safety */
  new_value: unknown;
  /** Only for asset_add / asset_delete_request — the URL of the asset */
  asset_url?: string;
}

// ============================================================================
// Version Document (NEW schema)
// ============================================================================

/** Edited-by info for version doc */
export interface VersionEditedBy {
  uid?: string;
  email?: string;
  role?: string;
}

/** Approval info for version doc */
export interface VersionApproval {
  requested_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  notes?: string | null;
}

/** Legacy field-level diff entry (old vs new, stored as strings for Firestore) */
export interface VersionDiffEntry {
  old: string;
  new: string;
}

/**
 * Lesson version document (Firestore: lesson_versions).
 *
 * NEW versions use: changed_tabs (standardized keys), changes[] array, snapshot_ref.
 * LEGACY versions may use: changedSections, diff (Record<string, VersionDiffEntry>), bundleSnapshotJSON.
 *
 * Immutable once created.
 */
export interface LessonVersion {
  id: string;
  chapterId: string;
  topicId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
  createdByRole?: string;
  status: LessonVersionStatus;

  /** Human-readable summary of what changed */
  changeSummary: string;

  // ---- NEW schema fields ----

  /** Which tabs changed (standardized keys: overview, scene_skybox, assets3d, etc.) */
  changed_tabs?: string[];

  /** Structured change records with type, old_value, new_value, asset_url */
  changes?: ChangeRecord[];

  /** Who edited (uid, email, role) */
  edited_by?: VersionEditedBy;

  /** Approval workflow */
  approval?: VersionApproval;

  /** Reference to lesson_snapshots/{id} — full bundle stored separately */
  snapshot_ref?: string | null;

  // ---- LEGACY schema fields (kept for backward compat) ----

  /** Legacy: field-level per-tab list of field names that changed */
  changed_fields?: Record<string, string[]>;

  /** Legacy: field-level diff "tab.field" → { old, new } */
  diff?: Record<string, VersionDiffEntry>;

  /** Legacy: Snapshot embedded in version doc (new versions use snapshot_ref) */
  bundleSnapshotJSON?: LessonBundleSnapshot;

  /** Legacy: Section keys that changed (old format) */
  changedSections: LessonSectionKey[];

  parentVersionId: string | null;
  diffJSON?: unknown;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

/** Input to create a new lesson version (draft) */
export interface CreateLessonVersionInput {
  chapterId: string;
  topicId: string;
  createdBy: string;
  createdByEmail?: string;
  createdByRole?: string;
  changeSummary: string;
  /** New: standardized snapshot for lesson_snapshots collection */
  draftSnapshot: LessonDraftSnapshot;
  parentVersionId: string | null;

  /** NEW: standardized tab keys */
  changed_tabs: EditableTabKey[];
  /** NEW: structured change records */
  changes: ChangeRecord[];
  /** NEW: who edited */
  edited_by: VersionEditedBy;

  // Legacy fields (still populated for backward compat)
  bundleSnapshot?: LessonBundleSnapshot;
  changedSections?: LessonSectionKey[];
  changed_fields?: Record<string, string[]>;
  diff?: Record<string, VersionDiffEntry>;
}

// ============================================================================
// Snapshot Document
// ============================================================================

/** Stored in lesson_snapshots/{snapshotId} — full bundle, kept separate from version doc */
export interface LessonSnapshotDocument {
  chapterId: string;
  topicId: string;
  version_number: number;
  lessonBundle: LessonDraftSnapshot;
  created_at: string;
}
