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
}));
