/**
 * Lesson Draft Store — Zustand global store for draft editing.
 *
 * This is the single source of truth for all editable lesson data.
 * All 6 editable tabs read from and write to this store:
 *   overview, scene_skybox, assets3d, images, avatar_script, mcqs
 *
 * Key concepts:
 * - `originalSnapshot`: The last committed state (set on load or after Save Draft)
 * - `draftSnapshot`: The current working copy (tabs read/write here)
 * - `dirtyTabs`: Which tabs have unsaved changes
 * - `pendingDeleteRequests`: Asset IDs that Associate has requested to delete
 *
 * Save Draft reads originalSnapshot vs draftSnapshot, runs the diff engine,
 * creates a version commit, then resets dirty state.
 *
 * Optional: draft can be persisted to localStorage (keyed by chapterId:topicId:userId)
 * so associates can switch topic or go to lesson and return without losing work.
 * Stored draft is cleared on Save draft success so server remains source of truth.
 */

import { create } from 'zustand';
import type {
  EditableTabKey,
  LessonDraftSnapshot,
} from '../types/lessonVersion';
import { EDITABLE_TAB_KEYS } from '../types/lessonVersion';

// ============================================================================
// Types
// ============================================================================

/** Metadata about which lesson is loaded */
export interface LessonMeta {
  chapterId: string;
  topicId: string;
  versionId: string;
  lang: string;
}

/** A pending delete request (Associate can't hard delete, creates a request instead) */
export interface PendingDeleteRequest {
  tab: 'assets3d' | 'images';
  itemId: string;
  assetUrl: string;
  itemName?: string;
}

export interface LessonDraftState {
  /** Whether the store has been loaded with a lesson */
  isLoaded: boolean;

  /** Metadata about the current lesson */
  meta: LessonMeta | null;

  /** The last committed snapshot (from Firestore or after Save Draft) */
  originalSnapshot: LessonDraftSnapshot | null;

  /** The current working copy — all editable tabs read/write here */
  draftSnapshot: LessonDraftSnapshot | null;

  /** Which tabs have unsaved changes: { overview: true, images: true } */
  dirtyTabs: Partial<Record<EditableTabKey, boolean>>;

  /** Asset IDs that Associate has requested to delete (stored until Save Draft) */
  pendingDeleteRequests: PendingDeleteRequest[];

  // ---- Actions ----

  /**
   * Load a lesson into the store. Called when topic is selected.
   * Sets both originalSnapshot and draftSnapshot.
   */
  loadLesson: (snapshot: LessonDraftSnapshot, meta: LessonMeta) => void;

  /**
   * Load from a previously persisted StoredDraft (e.g. from localStorage).
   * Restores snapshot, meta, dirtyTabs, and pendingDeleteRequests so work can continue.
   */
  loadLessonFromStored: (stored: StoredDraft) => void;

  /**
   * Update a specific tab section of the draft.
   * Automatically marks that tab as dirty.
   */
  updateTab: <K extends EditableTabKey>(
    tabKey: K,
    data: LessonDraftSnapshot[K]
  ) => void;

  /**
   * Partially update fields within a tab section.
   * For object sections (overview, scene_skybox, avatar_script): merges fields.
   * For array sections (mcqs, assets3d, images): replaces the entire array.
   */
  updateTabPartial: <K extends EditableTabKey>(
    tabKey: K,
    partialData: Partial<LessonDraftSnapshot[K]>
  ) => void;

  /**
   * Manually mark a tab as dirty (e.g. when a child component modifies state).
   */
  markDirty: (tabKey: EditableTabKey) => void;

  /**
   * Set draft TTS (Associate-generated); stored in snapshot and applied to chapter_tts on approval.
   */
  setDraftTts: (tts: LessonDraftSnapshot['tts']) => void;

  /**
   * Add a pending delete request (Associate can't hard delete).
   */
  addDeleteRequest: (request: PendingDeleteRequest) => void;

  /**
   * Remove a pending delete request (user cancels before Save Draft).
   */
  removeDeleteRequest: (itemId: string) => void;

  /**
   * After successful Save Draft: set originalSnapshot = draftSnapshot clone,
   * clear dirtyTabs, clear pendingDeleteRequests.
   */
  commitDraft: () => void;

  /**
   * Discard all unsaved changes: reset draftSnapshot to originalSnapshot,
   * clear dirtyTabs, clear pendingDeleteRequests.
   */
  discardDraft: () => void;

  /**
   * Full reset — clear everything (e.g. when navigating away from editor).
   */
  resetStore: () => void;

  // ---- Computed helpers ----

  /** Returns list of dirty tab keys */
  getChangedTabs: () => EditableTabKey[];

  /** Whether any tab has unsaved changes */
  isDirty: () => boolean;

  /** Check if a specific tab has unsaved changes */
  isTabDirty: (tabKey: EditableTabKey) => boolean;

  /** Get pending delete requests for a specific tab */
  getDeleteRequestsForTab: (tab: 'assets3d' | 'images') => PendingDeleteRequest[];

  /** Check if an item has a pending delete request */
  hasDeleteRequest: (itemId: string) => boolean;

  /**
   * Persist current draft to localStorage (keyed by chapterId:topicId:userId).
   * Call before switching topic or navigating away so draft can be restored later.
   */
  persistToLocalStorage: (userId: string) => void;

  /**
   * Clear the stored draft for the currently loaded lesson (call after Save draft success).
   */
  clearLocalDraftForCurrent: (userId: string) => void;
}

/** Stored draft shape for localStorage */
export interface StoredDraft {
  snapshot: LessonDraftSnapshot;
  meta: LessonMeta;
  dirtyTabs: Partial<Record<EditableTabKey, boolean>>;
  pendingDeleteRequests: PendingDeleteRequest[];
  savedAt: string;
}

const DRAFT_STORAGE_PREFIX = 'lessonDraft:';

export function getDraftStorageKey(chapterId: string, topicId: string, userId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${chapterId}:${topicId}:${userId}`;
}

/** Read stored draft for a lesson (returns null if none or invalid). */
export function getStoredDraft(
  chapterId: string,
  topicId: string,
  userId: string
): StoredDraft | null {
  try {
    const key = getDraftStorageKey(chapterId, topicId, userId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed?.snapshot || !parsed?.meta?.chapterId || !parsed?.meta?.topicId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove stored draft for a lesson. */
export function clearLocalDraft(chapterId: string, topicId: string, userId: string): void {
  try {
    localStorage.removeItem(getDraftStorageKey(chapterId, topicId, userId));
  } catch {
    // ignore
  }
}

// ============================================================================
// Initial state
// ============================================================================

function createEmptySnapshot(lang = 'en'): LessonDraftSnapshot {
  return {
    lang,
    overview: {},
    scene_skybox: {},
    assets3d: [],
    images: [],
    avatar_script: {},
    mcqs: [],
  };
}

/** Deep clone a snapshot (JSON round-trip) */
function cloneSnapshot(snapshot: LessonDraftSnapshot): LessonDraftSnapshot {
  return JSON.parse(JSON.stringify(snapshot));
}

// ============================================================================
// Store
// ============================================================================

export const useLessonDraftStore = create<LessonDraftState>((set, get) => ({
  // State
  isLoaded: false,
  meta: null,
  originalSnapshot: null,
  draftSnapshot: null,
  dirtyTabs: {},
  pendingDeleteRequests: [],

  // ---- Actions ----

  loadLesson: (snapshot, meta) => {
    set({
      isLoaded: true,
      meta,
      originalSnapshot: cloneSnapshot(snapshot),
      draftSnapshot: cloneSnapshot(snapshot),
      dirtyTabs: {},
      pendingDeleteRequests: [],
    });
  },

  loadLessonFromStored: (stored) => {
    const snapshot = cloneSnapshot(stored.snapshot);
    set({
      isLoaded: true,
      meta: stored.meta,
      originalSnapshot: snapshot,
      draftSnapshot: cloneSnapshot(snapshot),
      dirtyTabs: {},
      pendingDeleteRequests: [],
    });
  },

  updateTab: (tabKey, data) => {
    const { draftSnapshot } = get();
    if (!draftSnapshot) return;

    set({
      draftSnapshot: {
        ...draftSnapshot,
        [tabKey]: data,
      },
      dirtyTabs: {
        ...get().dirtyTabs,
        [tabKey]: true,
      },
    });
  },

  updateTabPartial: (tabKey, partialData) => {
    const { draftSnapshot } = get();
    if (!draftSnapshot) return;

    const currentSection = draftSnapshot[tabKey];

    // For array sections, partial update replaces the whole array
    if (Array.isArray(currentSection)) {
      set({
        draftSnapshot: {
          ...draftSnapshot,
          [tabKey]: partialData,
        },
        dirtyTabs: {
          ...get().dirtyTabs,
          [tabKey]: true,
        },
      });
    } else {
      // For object sections, merge fields
      set({
        draftSnapshot: {
          ...draftSnapshot,
          [tabKey]: {
            ...(currentSection as Record<string, unknown>),
            ...(partialData as Record<string, unknown>),
          },
        },
        dirtyTabs: {
          ...get().dirtyTabs,
          [tabKey]: true,
        },
      });
    }
  },

  markDirty: (tabKey) => {
    set({
      dirtyTabs: {
        ...get().dirtyTabs,
        [tabKey]: true,
      },
    });
  },

  setDraftTts: (tts: LessonDraftSnapshot['tts']) => {
    const { draftSnapshot } = get();
    if (!draftSnapshot) return;
    set({
      draftSnapshot: {
        ...draftSnapshot,
        tts: tts ?? undefined,
      },
      dirtyTabs: {
        ...get().dirtyTabs,
        avatar_script: true,
      },
    });
  },

  addDeleteRequest: (request) => {
    const existing = get().pendingDeleteRequests;
    // Don't add duplicate
    if (existing.some((r) => r.itemId === request.itemId)) return;
    set({
      pendingDeleteRequests: [...existing, request],
      dirtyTabs: {
        ...get().dirtyTabs,
        [request.tab]: true,
      },
    });
  },

  removeDeleteRequest: (itemId) => {
    set({
      pendingDeleteRequests: get().pendingDeleteRequests.filter(
        (r) => r.itemId !== itemId
      ),
    });
  },

  commitDraft: () => {
    const { draftSnapshot } = get();
    if (!draftSnapshot) return;

    set({
      originalSnapshot: cloneSnapshot(draftSnapshot),
      dirtyTabs: {},
      pendingDeleteRequests: [],
    });
  },

  discardDraft: () => {
    const { originalSnapshot } = get();
    if (!originalSnapshot) return;

    set({
      draftSnapshot: cloneSnapshot(originalSnapshot),
      dirtyTabs: {},
      pendingDeleteRequests: [],
    });
  },

  resetStore: () => {
    set({
      isLoaded: false,
      meta: null,
      originalSnapshot: null,
      draftSnapshot: null,
      dirtyTabs: {},
      pendingDeleteRequests: [],
    });
  },

  // ---- Computed helpers ----

  getChangedTabs: () => {
    const { dirtyTabs } = get();
    return EDITABLE_TAB_KEYS.filter((tab) => dirtyTabs[tab] === true) as EditableTabKey[];
  },

  isDirty: () => {
    const { dirtyTabs } = get();
    return Object.values(dirtyTabs).some((v) => v === true);
  },

  isTabDirty: (tabKey) => {
    return get().dirtyTabs[tabKey] === true;
  },

  getDeleteRequestsForTab: (tab) => {
    return get().pendingDeleteRequests.filter((r) => r.tab === tab);
  },

  hasDeleteRequest: (itemId) => {
    return get().pendingDeleteRequests.some((r) => r.itemId === itemId);
  },

  persistToLocalStorage: (userId) => {
    const { meta, draftSnapshot, dirtyTabs, pendingDeleteRequests } = get();
    if (!meta || !draftSnapshot || !userId) return;
    try {
      const key = getDraftStorageKey(meta.chapterId, meta.topicId, userId);
      const stored: StoredDraft = {
        snapshot: cloneSnapshot(draftSnapshot),
        meta: { ...meta },
        dirtyTabs: { ...dirtyTabs },
        pendingDeleteRequests: [...pendingDeleteRequests],
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // ignore
    }
  },

  clearLocalDraftForCurrent: (userId) => {
    const { meta } = get();
    if (!meta || !userId) return;
    clearLocalDraft(meta.chapterId, meta.topicId, userId);
  },
}));
