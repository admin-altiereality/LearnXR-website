import { useState, useEffect } from 'react';
import { EditHistoryEntry } from '../../../lib/firestore/queries';
import type {
  LessonVersion,
  LessonSectionKey,
  LessonBundleSnapshot,
  VersionDiffEntry,
  ChangeRecord,
  EditableTabKey,
} from '../../../types/lessonVersion';
import { TAB_LABELS } from '../../../types/lessonVersion';
import {
  History,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  AlertTriangle,
  Image as ImageIcon,
  Package,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/Components/ui/badge';

// ============================================================================
// Constants for legacy format
// ============================================================================

const SECTION_LABELS: Record<LessonSectionKey, string> = {
  overview: 'Overview',
  scene: 'Scene',
  mcqs: 'MCQs',
  avatarScript: 'Avatar Script',
  skybox: 'Skybox',
  assets3D: '3D Assets',
  images: 'Images',
  audio: 'Audio',
  textTo3dAssets: 'Text-to-3D',
};

const LEGACY_TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  scene: 'Scene',
  avatar: 'Avatar Script',
  mcqs: 'MCQs',
  skybox: 'Skybox',
  assets3D: '3D Assets',
  images: 'Images',
  audio: 'Audio',
  script: 'Script',
  textTo3dAssets: 'Text-to-3D',
};

const SECTION_FIELD_LABELS: Record<string, string> = {
  intro: 'Intro',
  explanation: 'Explanation',
  outro: 'Outro',
  topic_id: 'Topic ID',
  topic_name: 'Topic name',
  topic_priority: 'Priority',
  scene_type: 'Scene type',
  learning_objective: 'Learning objective',
  in3d_prompt: '3D prompt',
  camera_guidance: 'Camera guidance',
  skybox_id: 'Skybox',
  asset_list: 'Asset list',
  sharedAssets: 'Shared assets',
};

// ============================================================================
// Helper to get label for a tab key (new or legacy)
// ============================================================================

function getTabLabel(key: string): string {
  return TAB_LABELS[key as EditableTabKey] ?? LEGACY_TAB_LABELS[key] ?? key;
}

// ============================================================================
// Formatting helpers
// ============================================================================

function formatSectionValue(val: unknown, maxLen = 400): string {
  if (val == null) return '—';
  if (typeof val === 'string') return val.length > maxLen ? val.slice(0, maxLen) + '…' : val;
  if (Array.isArray(val)) return `${val.length} item(s)`;
  try {
    const s = JSON.stringify(val, null, 2);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  } catch {
    return String(val);
  }
}

function truncate(s: string, max = 300): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ============================================================================
// NEW: Render structured ChangeRecord entries grouped by tab
// ============================================================================

function ChangeTypeIcon({ type }: { type: ChangeRecord['type'] }) {
  switch (type) {
    case 'add':
    case 'asset_add':
      return <Plus className="w-3.5 h-3.5 text-emerald-400" />;
    case 'remove':
      return <Minus className="w-3.5 h-3.5 text-red-400" />;
    case 'asset_delete_request':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    case 'edit':
    default:
      return <FileText className="w-3.5 h-3.5 text-blue-400" />;
  }
}

function changeTypeLabel(type: ChangeRecord['type']): string {
  switch (type) {
    case 'edit': return 'Edited';
    case 'add': return 'Added';
    case 'remove': return 'Removed';
    case 'asset_add': return 'Asset Added';
    case 'asset_delete_request': return 'Delete Requested';
    case 'reorder': return 'Reordered';
    default: return 'Changed';
  }
}

function changeTypeBadgeVariant(type: ChangeRecord['type']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'add':
    case 'asset_add':
      return 'default';
    case 'remove':
      return 'destructive';
    case 'asset_delete_request':
      return 'outline';
    default:
      return 'secondary';
  }
}

/** Render a single ChangeRecord */
function ChangeEntry({ change }: { change: ChangeRecord }) {
  const fieldName = change.field_path.split('.').slice(1).join(' → ') || change.field_path;
  const isAssetChange = change.type === 'asset_add' || change.type === 'asset_delete_request';

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-muted/50">
        <ChangeTypeIcon type={change.type} />
        <span className="text-xs font-medium text-foreground flex-1">
          {SECTION_FIELD_LABELS[fieldName] ?? fieldName}
        </span>
        <Badge variant={changeTypeBadgeVariant(change.type)} className="text-[10px]">
          {changeTypeLabel(change.type)}
        </Badge>
      </div>

      {/* Asset URL */}
      {isAssetChange && change.asset_url && (
        <div className="px-3 py-2 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            {change.tab === 'images' ? (
              <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
            ) : (
              <Package className="w-3.5 h-3.5 text-primary" />
            )}
            <a
              href={change.asset_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate flex items-center gap-1"
            >
              {truncate(change.asset_url, 80)}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
        </div>
      )}

      {/* Delete request warning */}
      {change.type === 'asset_delete_request' ? (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Awaiting admin approval to delete
          </p>
        </div>
      ) : null}

      {/* Before / After for edits */}
      {change.type === 'edit' ? (
        <div className="grid grid-cols-2 divide-x divide-border min-h-[50px]">
          <div className="p-3">
            <div className="text-xs font-medium text-red-400/80 mb-1 flex items-center gap-1">
              <Minus className="w-3 h-3" /> Before
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
              {formatSectionValue(change.old_value, 300)}
            </pre>
          </div>
          <div className="p-3">
            <div className="text-xs font-medium text-emerald-400/80 mb-1 flex items-center gap-1">
              <Plus className="w-3 h-3" /> After
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
              {formatSectionValue(change.new_value, 300)}
            </pre>
          </div>
        </div>
      ) : null}

      {/* For adds, show what was added */}
      {(change.type === 'add' || change.type === 'asset_add') && change.new_value && !isAssetChange ? (
        <div className="p-3">
          <div className="text-xs font-medium text-emerald-400/80 mb-1 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Added
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
            {formatSectionValue(change.new_value, 300)}
          </pre>
        </div>
      ) : null}

      {/* For asset adds, show asset name if available */}
      {change.type === 'asset_add' && change.new_value && typeof change.new_value === 'object' ? (
        <div className="p-3">
          <div className="text-xs font-medium text-emerald-400/80 mb-1 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Added
          </div>
          <p className="text-xs text-foreground">
            {String((change.new_value as Record<string, unknown>).name ?? 'New asset')}
          </p>
        </div>
      ) : null}

      {/* For removes, show what was removed */}
      {change.type === 'remove' && change.old_value ? (
        <div className="p-3">
          <div className="text-xs font-medium text-red-400/80 mb-1 flex items-center gap-1">
            <Minus className="w-3 h-3" /> Removed
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
            {formatSectionValue(change.old_value, 300)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

/** Group changes by tab and render */
function ChangesGroupedByTab({ changes }: { changes: ChangeRecord[] }) {
  // Group by tab
  const grouped: Record<string, ChangeRecord[]> = {};
  for (const change of changes) {
    if (!grouped[change.tab]) grouped[change.tab] = [];
    grouped[change.tab].push(change);
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([tab, tabChanges]) => (
        <div key={tab}>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs font-medium">
              {getTabLabel(tab)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {tabChanges.length} change{tabChanges.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2 pl-2 border-l-2 border-border ml-2">
            {tabChanges.map((change, idx) => (
              <ChangeEntry key={`${change.field_path}-${idx}`} change={change} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// LEGACY: Render old diff format (for existing versions)
// ============================================================================

function DiffFromStored({
  path,
  entry,
}: {
  path: string;
  entry: VersionDiffEntry;
}) {
  const label = path.replace(/\./g, ' → ');
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        {label}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border min-h-[50px]">
        <div className="p-3">
          <div className="text-xs font-medium text-red-400/80 mb-1 flex items-center gap-1">
            <Minus className="w-3 h-3" /> Before
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
            {truncate(entry.old || '—')}
          </pre>
        </div>
        <div className="p-3">
          <div className="text-xs font-medium text-emerald-400/80 mb-1 flex items-center gap-1">
            <Plus className="w-3 h-3" /> After
          </div>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
            {truncate(entry.new || '—')}
          </pre>
        </div>
      </div>
    </div>
  );
}

function SectionDiff({
  sectionKey,
  before,
  after,
}: {
  sectionKey: LessonSectionKey;
  before: unknown;
  after: unknown;
}) {
  const label = SECTION_LABELS[sectionKey] ?? sectionKey;
  const isObject =
    before != null &&
    after != null &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after);
  const beforeObj = isObject ? (before as Record<string, unknown>) : null;
  const afterObj = isObject ? (after as Record<string, unknown>) : null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        {label}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border min-h-[60px]">
        <div className="p-3">
          <div className="text-xs font-medium text-red-400/80 mb-1 flex items-center gap-1">
            <Minus className="w-3 h-3" /> Before
          </div>
          {beforeObj ? (
            <div className="space-y-2 text-xs">
              {Object.keys(beforeObj).map((k) => (
                <div key={k}>
                  <span className="text-muted-foreground">{k}:</span>{' '}
                  <span className="text-foreground break-words">
                    {formatSectionValue(beforeObj[k], 200)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
              {formatSectionValue(before)}
            </pre>
          )}
        </div>
        <div className="p-3">
          <div className="text-xs font-medium text-emerald-400/80 mb-1 flex items-center gap-1">
            <Plus className="w-3 h-3" /> After
          </div>
          {afterObj ? (
            <div className="space-y-2 text-xs">
              {Object.keys(afterObj).map((k) => (
                <div key={k}>
                  <span className="text-muted-foreground">{k}:</span>{' '}
                  <span className="text-foreground break-words">
                    {formatSectionValue(afterObj[k], 200)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans">
              {formatSectionValue(after)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Legacy helper: get changed fields within a section
// ============================================================================

function getChangedFieldsInSection(
  sectionKey: LessonSectionKey,
  parentSnapshot: LessonBundleSnapshot | null,
  currentSnapshot: LessonBundleSnapshot
): string[] {
  const prevMap = parentSnapshot
    ? (parentSnapshot as unknown) as Record<string, unknown>
    : null;
  const nextMap = currentSnapshot as unknown as Record<string, unknown>;
  const prevVal = prevMap?.[sectionKey];
  const nextVal = nextMap[sectionKey];
  if (prevVal == null && nextVal == null) return [];
  if (prevVal != null && nextVal != null && typeof prevVal === 'object' && typeof nextVal === 'object' && !Array.isArray(prevVal) && !Array.isArray(nextVal)) {
    const prevObj = prevVal as Record<string, unknown>;
    const nextObj = nextVal as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
    const changed: string[] = [];
    for (const k of allKeys) {
      const p = prevObj[k];
      const n = nextObj[k];
      if (JSON.stringify(p) !== JSON.stringify(n)) {
        changed.push(SECTION_FIELD_LABELS[k] ?? k);
      }
    }
    return changed;
  }
  return [];
}

// ============================================================================
// Main History Tab
// ============================================================================

interface HistoryTabProps {
  editHistory: EditHistoryEntry[];
  lessonVersions?: LessonVersion[];
}

export const HistoryTab = ({ editHistory, lessonVersions = [] }: HistoryTabProps) => {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  useEffect(() => {
    if (lessonVersions.length > 0 && !hasAutoExpanded) {
      setExpandedVersionId(lessonVersions[0].id);
      setHasAutoExpanded(true);
    }
  }, [lessonVersions, hasAutoExpanded]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return formatDate(dateString);
    } catch {
      return dateString;
    }
  };

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'pending_review':
        return 'default';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'pending_review': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const hasVersions = lessonVersions.length > 0;

  return (
    <div className="p-6 max-w-3xl">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            {hasVersions ? 'Version History' : 'Edit History'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {hasVersions
              ? `${lessonVersions.length} version(s) for this lesson. Each Save Draft creates a commit with tab-level and field-level changes.`
              : `Last ${editHistory.length} edits to this scene`}
          </p>
        </div>

        {hasVersions ? (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-muted" />
            <div className="space-y-4">
              {lessonVersions.map((version, index) => {
                const parentVersion = lessonVersions[index + 1] ?? null;
                const parentSnapshot: LessonBundleSnapshot | null = parentVersion?.bundleSnapshotJSON ?? null;
                const currentSnapshot = version.bundleSnapshotJSON as LessonBundleSnapshot;

                // Determine which rendering path to use
                const hasNewChanges = version.changes && Array.isArray(version.changes) && version.changes.length > 0;
                const hasLegacyNewSchema = (version.changed_tabs?.length ?? 0) > 0;
                const hasLegacyDiff = version.diff && Object.keys(version.diff).length > 0;
                const hasLegacySections = version.changedSections?.length > 0;
                const hasAnyChanges = hasNewChanges || hasLegacyNewSchema || hasLegacySections || hasLegacyDiff;
                const isExpanded = expandedVersionId === version.id;

                // Get changed tabs for display
                const displayTabs: { key: string; label: string }[] = [];
                if (hasNewChanges) {
                  // New schema: extract tabs from changes array
                  const tabSet = new Set((version.changes as ChangeRecord[]).map((c) => c.tab));
                  tabSet.forEach((tab) => displayTabs.push({ key: tab, label: getTabLabel(tab) }));
                } else if (hasLegacyNewSchema && version.changed_tabs) {
                  version.changed_tabs.forEach((tab) => displayTabs.push({ key: tab, label: getTabLabel(tab) }));
                } else if (hasLegacySections) {
                  version.changedSections.forEach((key) => displayTabs.push({ key, label: SECTION_LABELS[key] ?? key }));
                }

                return (
                  <div key={version.id} className="relative flex gap-4">
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                        ${index === 0 ? 'bg-primary/20 border-2 border-primary/50' : 'bg-muted border-2 border-border'}`}
                    >
                      <Clock
                        className={`w-4 h-4 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                    </div>
                    <div className={`flex-1 pb-4 ${index === lessonVersions.length - 1 ? 'pb-0' : ''}`}>
                      <div
                        className={`p-4 rounded-xl border transition-all duration-200
                          ${index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border'}`}
                      >
                        {/* Summary */}
                        <div className="flex items-start gap-2 mb-3">
                          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-foreground leading-relaxed">
                              {version.changeSummary || 'Lesson updated'}
                            </p>
                            {hasAnyChanges && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {hasNewChanges
                                  ? `${(version.changes as ChangeRecord[]).length} change(s) across ${displayTabs.length} tab(s)`
                                  : hasLegacyDiff
                                    ? `${Object.keys(version.diff!).length} field(s) changed`
                                    : 'Section-level changes'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Changed tabs chips */}
                        {displayTabs.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {displayTabs.map((tab) => {
                              // Count changes per tab for the badge
                              const tabChangeCount = hasNewChanges
                                ? (version.changes as ChangeRecord[]).filter((c) => c.tab === tab.key).length
                                : undefined;

                              return (
                                <div
                                  key={tab.key}
                                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1"
                                >
                                  <Badge variant="secondary" className="text-xs font-medium px-1.5 py-0">
                                    {tab.label}
                                  </Badge>
                                  {tabChangeCount != null && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {tabChangeCount}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            {version.edited_by?.email || version.createdByEmail || version.createdBy}
                          </span>
                          {(version.edited_by?.role || version.createdByRole) && (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {version.edited_by?.role || version.createdByRole}
                            </Badge>
                          )}
                          <Badge variant={statusVariant(version.status)} className="text-[10px]">
                            {statusLabel(version.status)}
                          </Badge>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span title={formatDate(version.createdAt)}>
                              {formatRelativeTime(version.createdAt)}
                            </span>
                          </span>
                          <span className="text-muted-foreground/80">v{version.versionNumber}</span>
                        </div>

                        {/* Expand / collapse */}
                        {hasAnyChanges && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedVersionId(isExpanded ? null : version.id)
                              }
                              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              {isExpanded ? 'Hide changes' : 'Show what changed (before / after)'}
                            </button>

                            {isExpanded && (
                              <div className="mt-3 space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Changes in this version:
                                </p>

                                {/* NEW: Structured changes array */}
                                {hasNewChanges ? (
                                  <ChangesGroupedByTab changes={version.changes as ChangeRecord[]} />
                                ) : hasLegacyDiff ? (
                                  /* LEGACY: Old diff format */
                                  Object.entries(version.diff!).map(([path, entry]) => (
                                    <DiffFromStored key={path} path={path} entry={entry} />
                                  ))
                                ) : hasLegacySections && currentSnapshot ? (
                                  /* LEGACY: Section-level diff via snapshot comparison */
                                  version.changedSections.map((key) => {
                                    const prevMap = parentSnapshot
                                      ? (parentSnapshot as unknown) as Record<string, unknown>
                                      : null;
                                    const nextMap = currentSnapshot as unknown as Record<string, unknown>;
                                    return (
                                      <SectionDiff
                                        key={key}
                                        sectionKey={key}
                                        before={prevMap?.[key]}
                                        after={nextMap[key]}
                                      />
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    No detailed diff available for this version.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : editHistory.length > 0 ? (
          /* Legacy edit history (pre-version system) */
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-muted" />
            <div className="space-y-4">
              {editHistory.map((entry, index) => (
                <div key={index} className="relative flex gap-4">
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                      ${index === 0 ? 'bg-primary/20 border-2 border-primary/50' : 'bg-muted border-2 border-border'}`}
                  >
                    <Clock
                      className={`w-4 h-4 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <div className={`flex-1 pb-4 ${index === editHistory.length - 1 ? 'pb-0' : ''}`}>
                    <div
                      className={`p-4 rounded-xl border transition-all duration-200
                        ${index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border'}`}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground leading-relaxed">
                          {entry.change_summary || 'Scene updated'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          {entry.updated_by || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span title={formatDate(entry.updated_at)}>
                            {formatRelativeTime(entry.updated_at)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 bg-muted/50 rounded-xl border border-border">
            <History className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No history available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Save draft to create a version. Version history will appear here.
            </p>
          </div>
        )}

        <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-2">
          <p className="text-xs text-muted-foreground">
            {hasVersions
              ? 'Each Save Draft creates a version commit with tab-level and field-level diffs. Submit for approval to send the latest version to Admin.'
              : 'History is automatically tracked when changes are saved.'}
          </p>
        </div>
      </div>
    </div>
  );
};
