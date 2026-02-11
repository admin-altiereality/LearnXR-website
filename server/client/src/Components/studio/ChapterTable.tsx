import { Chapter } from '../../types/curriculum';
import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Hash,
  BookOpen,
  Layers,
  Clock,
  GitBranch,
  HelpCircle,
  Box,
  Image,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Tag,
  Edit,
  Eye,
  Play,
  MoreVertical,
  Calendar,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateTopicApproval } from '../../lib/firestore/updateHelpers';
import { approveChapter, unapproveChapter } from '../../lib/firebase/queries/curriculumChapters';
import { isAdminOnly, isSuperadmin } from '../../utils/rbac';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { PrismFluxLoader } from '../ui/prism-flux-loader';

interface ChapterTableProps {
  chapters: Chapter[];
  onOpenChapter: (chapter: Chapter) => void;
  loading?: boolean;
  onApprovalChange?: () => void; // Callback to refresh data after approval change
}

interface GroupedChapter {
  curriculum: string;
  class: number;
  subject: string;
  chapterNumber: number;
  chapterName: string;
  topics: Array<{
    chapter: Chapter;
    topic: any;
    topicPriority: number;
  }>;
}

export const ChapterTable = ({
  chapters,
  onOpenChapter,
  loading,
  onApprovalChange,
}: ChapterTableProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { profile } = useAuth();
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  const [updatingChapterApproval, setUpdatingChapterApproval] = useState<string | null>(null);
  
  // Debug: Log approval permissions
  useEffect(() => {
    if (profile) {
      const canApproveCheck = isAdminOnly(profile) || isSuperadmin(profile);
      console.log('🔐 Approval permissions check:', {
        userRole: profile.role,
        isAdminOnly: isAdminOnly(profile),
        isSuperadmin: isSuperadmin(profile),
        canApprove: canApproveCheck,
      });
    }
  }, [profile]);
  
  const formatDate = (dateInput?: string | { toDate?: () => Date } | null) => {
    if (dateInput == null) return '—';
    try {
      const date = typeof dateInput === 'object' && typeof dateInput.toDate === 'function'
        ? dateInput.toDate()
        : new Date(dateInput as string);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };
  
  // Group chapters by curriculum/class/subject/chapter_number
  // Chapters with same curriculum/class/subject/chapter_number are topics of the same chapter
  const groupedChapters = (): GroupedChapter[] => {
    const groups = new Map<string, GroupedChapter>();
    
    chapters.forEach((chapter) => {
      const key = `${chapter.curriculum || ''}_${chapter.class || ''}_${chapter.subject || ''}_${chapter.chapter_number || ''}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          curriculum: chapter.curriculum || '',
          class: chapter.class || 0,
          subject: chapter.subject || '',
          chapterNumber: chapter.chapter_number || 0,
          chapterName: chapter.chapter_name || '',
          topics: [],
        });
      }
      
      const group = groups.get(key)!;
      
      // Extract topics from chapter
      if (chapter.topics && Array.isArray(chapter.topics)) {
        chapter.topics.forEach((topic) => {
          group.topics.push({
            chapter,
            topic,
            topicPriority: topic.topic_priority || 999, // Default to high number if missing
          });
        });
      } else {
        // If no topics array, treat the chapter itself as a topic
        group.topics.push({
          chapter,
          topic: null,
          topicPriority: 1,
        });
      }
    });
    
    // Sort topics within each group by topicPriority, then by updatedAt
    const sortedGroups = Array.from(groups.values()).map((group) => ({
      ...group,
      topics: group.topics.sort((a, b) => {
        // Primary sort: topicPriority ascending
        if (a.topicPriority !== b.topicPriority) {
          return a.topicPriority - b.topicPriority;
        }
        // Secondary sort: updatedAt descending
        const aDate = a.chapter.updated_at ? new Date(a.chapter.updated_at).getTime() : 0;
        const bDate = b.chapter.updated_at ? new Date(b.chapter.updated_at).getTime() : 0;
        return bDate - aDate;
      }),
    }));
    
    // Sort groups by curriculum, class, subject, chapterNumber
    return sortedGroups.sort((a, b) => {
      if (a.curriculum !== b.curriculum) return a.curriculum.localeCompare(b.curriculum);
      if (a.class !== b.class) return a.class - b.class;
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return a.chapterNumber - b.chapterNumber;
    });
  };
  
  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };
  
  // Check if user can approve (admin or superadmin)
  const canApprove = profile && (isAdminOnly(profile) || isSuperadmin(profile));
  
  // Handle chapter approval toggle
  const handleChapterApprovalToggle = async (chapterId: string, currentApproved: boolean) => {
    if (!canApprove || !profile) return;
    
    setUpdatingChapterApproval(chapterId);
    
    try {
      if (currentApproved) {
        await unapproveChapter(chapterId);
        toast.success('Chapter unapproved successfully');
      } else {
        await approveChapter(chapterId, profile.uid);
        toast.success('Chapter approved successfully');
      }
      
      // Trigger a refresh by calling the callback if provided
      if (onApprovalChange) {
        onApprovalChange();
      } else {
        // Fallback: reload page if no callback provided
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating chapter approval:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingChapterApproval(null);
    }
  };
  
  // Handle topic approval toggle
  const handleApprovalToggle = async (chapterId: string, topicId: string, currentApproved: boolean) => {
    if (!canApprove || !profile) return;
    
    const approvalKey = `${chapterId}_${topicId}`;
    setUpdatingApproval(approvalKey);
    
    try {
      await updateTopicApproval({
        chapterId,
        topicId,
        approved: !currentApproved,
        userId: profile.uid,
      });
      
      toast.success(`Topic ${!currentApproved ? 'approved' : 'unapproved'} successfully`);
      
      // Trigger a refresh by calling the callback if provided
      if (onApprovalChange) {
        onApprovalChange();
      } else {
        // Fallback: reload page if no callback provided
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating topic approval:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingApproval(null);
    }
  };
  
  // Format approvedAt timestamp
  const formatApprovedAt = (timestamp: any) => {
    if (!timestamp) return null;
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return null;
    }
  };
  
  // Helper to check if chapter has content
  const getContentStatus = (chapter: Chapter) => {
    const hasMCQs = (chapter.mcq_ids && chapter.mcq_ids.length > 0) || 
                   (chapter.topics?.some(t => t.mcq_ids && t.mcq_ids.length > 0));
    const has3DAssets = (chapter.meshy_asset_ids && chapter.meshy_asset_ids.length > 0) ||
                        (chapter.image3dasset?.imageasset_url) ||
                        (chapter.topics?.some(t => t.meshy_asset_ids && t.meshy_asset_ids.length > 0));
    const hasImages = (chapter.image_ids && chapter.image_ids.length > 0);
    
    return { hasMCQs, has3DAssets, hasImages };
  };
  
  const groups = groupedChapters();

  const tableGrid = 'grid grid-cols-[56px_minmax(0,1fr)_110px_140px_80px_110px_160px] gap-2 sm:gap-4 px-4 sm:px-6';

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden relative">
      {/* Table Header - aligned columns, clear hierarchy */}
      <header className={`${tableGrid} py-3 bg-muted/50 border-b border-border items-center min-h-[44px]`}>
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Hash className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>#</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Topic Name</span>
        </div>
        <div className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Status</span>
        </div>
        <div className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Content</span>
        </div>
        <div className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Version</span>
        </div>
        <div className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Updated</span>
        </div>
        <div className="flex items-center justify-end text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Actions</span>
        </div>
      </header>
      
      {/* Table Body - Grouped by Chapter */}
      <div className="divide-y divide-border">
        {groups.map((group) => {
          const groupKey = `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`;
          const isExpanded = expandedGroups.has(groupKey);
          
          return (
            <div key={groupKey} className="bg-card/30">
              {/* Chapter row - same grid as header for column alignment */}
              <div className={`${tableGrid} py-3.5 items-center min-h-[52px] hover:bg-muted/30 transition-colors border-l-4 border-primary/50 bg-card group`}>
                <div className="flex items-center justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary hover:bg-primary/10 shrink-0"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 border border-border shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground truncate">{group.chapterName}</span>
                      <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded border border-border shrink-0">Ch. {group.chapterNumber}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] font-semibold text-primary uppercase px-2 py-0.5 bg-primary/10 rounded border border-primary/20">{group.curriculum}</span>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <span className="text-[10px] text-muted-foreground">Class {group.class}</span>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <span className="text-[10px] text-muted-foreground truncate">{group.subject}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-foreground bg-muted rounded-md border border-border">
                    {group.topics.length} {group.topics.length === 1 ? 'topic' : 'topics'}
                  </span>
                </div>
                <div className="flex items-center" aria-hidden />
                <div className="flex items-center" aria-hidden />
                <div className="flex items-center" aria-hidden />
                <div className="flex items-center justify-end gap-2">
                  {canApprove && group.topics.length > 0 && (() => {
                    const firstChapter = group.topics[0].chapter;
                    const isApproved = (firstChapter as any).approved === true;
                    const isUpdating = updatingChapterApproval === firstChapter.id;
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant={isApproved ? 'destructive' : 'default'}
                        className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChapterApprovalToggle(firstChapter.id, isApproved);
                        }}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isApproved ? 'Unapproving...' : 'Approving...'}</>
                        ) : isApproved ? (
                          <><XCircle className="w-3.5 h-3.5" />Unapprove</>
                        ) : (
                          <><CheckCircle2 className="w-3.5 h-3.5" />Approve</>
                        )}
                      </Button>
                    );
                  })()}
                  {group.topics.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        const firstTopic = group.topics[0];
                        if (firstTopic) onOpenChapter(firstTopic.chapter);
                      }}
                    >
                      <Play className="w-3.5 h-3.5" />
                      Open
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Topics List (when expanded) */}
              {isExpanded && (
                <div className="divide-y divide-border bg-muted/10">
                  {group.topics.map(({ chapter, topic, topicPriority }, index) => {
                    const contentStatus = getContentStatus(chapter);
                    const displayNum = topic?.topic_priority ?? index + 1;
                    const topicName = (topic?.topic_name && topic.topic_name.trim())
                      ? topic.topic_name
                      : `Topic ${displayNum}`;
                    const approval = topic?.approval || {};
                    const isApproved =
                      approval?.approved === true ||
                      approval?.approved === 'true' ||
                      (topic as { approved?: boolean })?.approved === true ||
                      (!topic?.approval && (chapter as { approved?: boolean }).approved === true);

                    return (
                      <div
                        key={`${chapter.id}_${topic?.topic_id ?? index}`}
                        className={`${tableGrid} py-3 items-center min-h-[52px] pl-12 sm:pl-14 hover:bg-muted/20 transition-colors border-l-2 border-transparent hover:border-primary/40`}
                      >
                        <div className="flex items-center justify-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 text-xs font-bold text-primary bg-primary/10 rounded-md border border-border">
                            {displayNum}
                          </span>
                        </div>
                        <div className="flex items-center min-w-0">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-foreground truncate block">{topicName}</span>
                            {topic?.learning_objective && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={typeof topic.learning_objective === 'string' ? topic.learning_objective : (topic.learning_objective?.en || topic.learning_objective?.hi || '')}>
                                {typeof topic.learning_objective === 'string' ? topic.learning_objective : (topic.learning_objective?.en || topic.learning_objective?.hi || '')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-md border border-primary/20">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-600 bg-amber-500/10 rounded-md border border-amber-500/30 dark:text-amber-400">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              Not Approved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${contentStatus.hasMCQs ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground bg-muted border border-border'}`} title="MCQ">MCQ</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${contentStatus.has3DAssets ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground bg-muted border border-border'}`} title="3D">3D</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${contentStatus.hasImages ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground bg-muted border border-border'}`} title="IMG">IMG</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted rounded border border-border">
                            {chapter.current_version || 'v1'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-[11px] text-muted-foreground" title={formatDate(chapter.updated_at)}>
                            {formatDate(chapter.updated_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          {(() => {
                            const approvalInner = topic?.approval || {};
                            const isApprovedInner =
                              approvalInner?.approved === true ||
                              approvalInner?.approved === 'true' ||
                              (topic as { approved?: boolean })?.approved === true;
                            const approvalKey = `${chapter.id}_${topic?.topic_id ?? ''}`;
                            const isUpdating = updatingApproval === approvalKey;
                            return (
                              <>
                                {canApprove && topic?.topic_id && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isApprovedInner ? 'destructive' : 'default'}
                                    className="gap-1.5 text-xs h-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprovalToggle(chapter.id, topic.topic_id, isApprovedInner);
                                    }}
                                    disabled={isUpdating}
                                    title={isApprovedInner ? 'Unapprove topic' : 'Approve topic'}
                                  >
                                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isApprovedInner ? <><XCircle className="w-3.5 h-3.5" />Unapprove</> : <><CheckCircle2 className="w-3.5 h-3.5" />Approve</>}
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2 h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChapter(chapter);
                            }}
                          >
                            <Play className="w-4 h-4" />
                            Open Lesson
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-9 text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChapter(chapter);
                            }}
                            title="Edit lesson content"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Loading overlay - clear layer, no overlap with content */}
      {loading && chapters.length > 0 && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-b-xl bg-background/85 backdrop-blur-sm border-t border-border pointer-events-auto"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card border border-border shadow-lg">
            <PrismFluxLoader
              size={40}
              speed={5}
              textSize={13}
              statuses={['Refreshing…', 'Loading…', 'Syncing…']}
            />
          </div>
        </div>
      )}

      {/* Empty state - theme tokens */}
      {!loading && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="p-4 rounded-xl bg-muted border border-border mb-4">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
          </div>
          <p className="text-foreground text-sm font-medium">No chapters found</p>
          <p className="text-muted-foreground text-xs mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};
