/**
 * Diff Engine — Recursive JSON diff utility for lesson versioning.
 *
 * Compares two LessonDraftSnapshot objects and produces an array of ChangeRecord
 * entries. Only called at Save Draft time (never during History tab render).
 *
 * Rules:
 *   - Primitive change → type: "edit"
 *   - Array item added  → type: "add" (or "asset_add" for assets3d / images)
 *   - Array item removed → type: "remove"
 *   - Associate delete on assets3d / images → type: "asset_delete_request"
 *
 * The diff engine is asset-aware: for assets3d and images tabs it includes
 * `asset_url` in the change record.
 */

import type {
  ChangeRecord,
  ChangeType,
  EditableTabKey,
  LessonDraftSnapshot,
} from '../types/lessonVersion';
import { EDITABLE_TAB_KEYS } from '../types/lessonVersion';

// ============================================================================
// Helpers
// ============================================================================

/** Deep-equal comparison for two values (JSON-safe) */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

/** Serialize a value for Firestore-safe storage in change records */
function serializeValue(val: unknown): unknown {
  if (val === undefined || val === null) return null;
  return val;
}

/** Extract the primary URL from an asset or image object */
function extractAssetUrl(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const obj = item as Record<string, unknown>;
  // Try common URL fields
  return (
    (obj.glb_url as string) ||
    (obj.file_url as string) ||
    (obj.image_url as string) ||
    (obj.url as string) ||
    (obj.thumbnail_url as string) ||
    undefined
  );
}

/** Whether this tab holds asset/media arrays */
function isAssetTab(tab: EditableTabKey): boolean {
  return tab === 'assets3d' || tab === 'images';
}

// ============================================================================
// Object-level diff (for overview, scene_skybox, avatar_script)
// ============================================================================

/**
 * Compare two plain objects field by field.
 * Returns ChangeRecords for each changed field.
 */
function diffObjects(
  oldObj: Record<string, unknown> | undefined | null,
  newObj: Record<string, unknown> | undefined | null,
  tab: EditableTabKey
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const prev = oldObj ?? {};
  const next = newObj ?? {};
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    const oldVal = prev[key];
    const newVal = next[key];

    if (deepEqual(oldVal, newVal)) continue;

    const fieldPath = `${tab}.${key}`;

    if (oldVal === undefined || oldVal === null) {
      // Field was added
      changes.push({
        tab,
        field_path: fieldPath,
        type: 'add',
        old_value: null,
        new_value: serializeValue(newVal),
      });
    } else if (newVal === undefined || newVal === null) {
      // Field was removed
      changes.push({
        tab,
        field_path: fieldPath,
        type: 'remove',
        old_value: serializeValue(oldVal),
        new_value: null,
      });
    } else {
      // Field was edited
      changes.push({
        tab,
        field_path: fieldPath,
        type: 'edit',
        old_value: serializeValue(oldVal),
        new_value: serializeValue(newVal),
      });
    }
  }

  return changes;
}

// ============================================================================
// Array-level diff (for mcqs, assets3d, images)
// ============================================================================

/**
 * Diff two arrays of objects. Uses `id` field for matching.
 * For assets3d and images, produces asset_add / asset_delete_request.
 */
function diffArrays(
  oldArr: unknown[] | undefined | null,
  newArr: unknown[] | undefined | null,
  tab: EditableTabKey,
  options?: { isAssociateDelete?: boolean }
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const prev = (oldArr ?? []) as Array<Record<string, unknown>>;
  const next = (newArr ?? []) as Array<Record<string, unknown>>;

  // Build id → item maps
  const prevById = new Map<string, Record<string, unknown>>();
  const nextById = new Map<string, Record<string, unknown>>();

  prev.forEach((item, idx) => {
    const id = (item.id as string) || `__idx_${idx}`;
    prevById.set(id, item);
  });

  next.forEach((item, idx) => {
    const id = (item.id as string) || `__idx_${idx}`;
    nextById.set(id, item);
  });

  // Find removed items
  for (const [id, oldItem] of prevById) {
    if (!nextById.has(id)) {
      const assetUrl = isAssetTab(tab) ? extractAssetUrl(oldItem) : undefined;
      const deleteType: ChangeType =
        isAssetTab(tab) && options?.isAssociateDelete
          ? 'asset_delete_request'
          : 'remove';

      changes.push({
        tab,
        field_path: `${tab}.${id}`,
        type: deleteType,
        old_value: serializeValue(oldItem),
        new_value: null,
        ...(assetUrl ? { asset_url: assetUrl } : {}),
      });
    }
  }

  // Find added items
  for (const [id, newItem] of nextById) {
    if (!prevById.has(id)) {
      const assetUrl = isAssetTab(tab) ? extractAssetUrl(newItem) : undefined;
      const addType: ChangeType = isAssetTab(tab) ? 'asset_add' : 'add';

      changes.push({
        tab,
        field_path: `${tab}.${id}`,
        type: addType,
        old_value: null,
        new_value: serializeValue(newItem),
        ...(assetUrl ? { asset_url: assetUrl } : {}),
      });
    }
  }

  // Find edited items (present in both, but content changed)
  for (const [id, oldItem] of prevById) {
    const newItem = nextById.get(id);
    if (!newItem) continue; // Already handled as remove

    if (!deepEqual(oldItem, newItem)) {
      // For arrays of objects, find which fields changed
      const allKeys = new Set([...Object.keys(oldItem), ...Object.keys(newItem)]);
      for (const key of allKeys) {
        if (key === 'id') continue; // Skip id itself
        if (deepEqual(oldItem[key], newItem[key])) continue;

        changes.push({
          tab,
          field_path: `${tab}.${id}.${key}`,
          type: 'edit',
          old_value: serializeValue(oldItem[key]),
          new_value: serializeValue(newItem[key]),
        });
      }
    }
  }

  return changes;
}

// ============================================================================
// Public API
// ============================================================================

export interface DiffOptions {
  /** If true, asset removals become asset_delete_request instead of remove */
  isAssociateDelete?: boolean;
}

/**
 * Compare two LessonDraftSnapshots and return all change records.
 *
 * @param original - The previously committed snapshot (null if first version)
 * @param draft    - The current working snapshot
 * @param options  - { isAssociateDelete: true } for Associate role
 * @returns Array of ChangeRecord entries
 */
export function computeDiff(
  original: LessonDraftSnapshot | null,
  draft: LessonDraftSnapshot,
  options?: DiffOptions
): ChangeRecord[] {
  const allChanges: ChangeRecord[] = [];

  for (const tab of EDITABLE_TAB_KEYS) {
    const oldSection = original ? (original as Record<string, unknown>)[tab] : undefined;
    const newSection = (draft as Record<string, unknown>)[tab];

    // Skip if both are deeply equal
    if (deepEqual(oldSection, newSection)) continue;

    // Determine if this section is an array (mcqs, assets3d, images) or object
    const isArray = tab === 'mcqs' || tab === 'assets3d' || tab === 'images';

    if (isArray) {
      const changes = diffArrays(
        oldSection as unknown[] | undefined,
        newSection as unknown[] | undefined,
        tab,
        { isAssociateDelete: options?.isAssociateDelete }
      );
      allChanges.push(...changes);
    } else {
      const changes = diffObjects(
        oldSection as Record<string, unknown> | undefined,
        newSection as Record<string, unknown> | undefined,
        tab
      );
      allChanges.push(...changes);
    }
  }

  return allChanges;
}

/**
 * Extract which tabs were changed from a list of change records.
 */
export function getChangedTabsFromChanges(changes: ChangeRecord[]): EditableTabKey[] {
  const tabs = new Set<EditableTabKey>();
  for (const change of changes) {
    tabs.add(change.tab);
  }
  return Array.from(tabs);
}

/**
 * Group change records by tab for display purposes.
 */
export function groupChangesByTab(
  changes: ChangeRecord[]
): Record<EditableTabKey, ChangeRecord[]> {
  const grouped = {} as Record<EditableTabKey, ChangeRecord[]>;
  for (const tab of EDITABLE_TAB_KEYS) {
    const tabChanges = changes.filter((c) => c.tab === tab);
    if (tabChanges.length > 0) {
      grouped[tab] = tabChanges;
    }
  }
  return grouped;
}

/**
 * Build a human-readable change summary from change records.
 */
export function buildChangeSummary(changes: ChangeRecord[]): string {
  if (changes.length === 0) return 'No changes';

  const grouped = groupChangesByTab(changes);
  const parts: string[] = [];

  for (const [tab, tabChanges] of Object.entries(grouped)) {
    const adds = tabChanges.filter((c) => c.type === 'add' || c.type === 'asset_add');
    const edits = tabChanges.filter((c) => c.type === 'edit');
    const removes = tabChanges.filter(
      (c) => c.type === 'remove' || c.type === 'asset_delete_request'
    );

    const tabLabel =
      tab === 'overview' ? 'Overview'
      : tab === 'scene_skybox' ? 'Scene'
      : tab === 'assets3d' ? '3D Assets'
      : tab === 'images' ? 'Images'
      : tab === 'avatar_script' ? 'Avatar Script'
      : tab === 'mcqs' ? 'MCQs'
      : tab;

    const subParts: string[] = [];
    if (edits.length > 0) subParts.push(`${edits.length} edit${edits.length > 1 ? 's' : ''}`);
    if (adds.length > 0) subParts.push(`${adds.length} added`);
    if (removes.length > 0) subParts.push(`${removes.length} removed`);

    parts.push(`${tabLabel}: ${subParts.join(', ')}`);
  }

  return parts.join(' · ');
}
