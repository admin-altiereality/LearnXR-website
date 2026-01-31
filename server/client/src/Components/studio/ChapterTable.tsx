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
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
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

  return (
    <div className="bg-[#0d1424] rounded-2xl border border-slate-700/30 overflow-hidden shadow-xl shadow-slate-900/50 relative">
      {/* Table Header */}
      <div className="grid grid-cols-[50px_1fr_120px_200px_100px_140px_180px] gap-4 px-6 py-4 
                      bg-gradient-to-r from-slate-800/50 to-slate-800/30 border-b border-slate-700/30">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <Hash className="w-3 h-3 text-cyan-500/50" />
          Priority
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <BookOpen className="w-3 h-3 text-cyan-500/50" />
          Topic Name
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Status
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Content
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <GitBranch className="w-3 h-3 text-cyan-500/50" />
          Version
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          <Calendar className="w-3 h-3 text-cyan-500/50" />
          Updated
        </div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-right">
          Actions
        </div>
      </div>
      
      {/* Table Body - Grouped by Chapter */}
      <div className="divide-y divide-slate-700/20">
        {groups.map((group) => {
          const groupKey = `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`;
          const isExpanded = expandedGroups.has(groupKey);
          
          return (
            <div key={groupKey} className="bg-slate-800/20">
              {/* Chapter Group Header */}
              <div className="grid grid-cols-[50px_1fr_120px_200px_100px_140px_180px] gap-4 px-6 py-4
                           hover:bg-slate-800/40 transition-all duration-200
                           border-l-4 border-cyan-500/50 bg-slate-800/10 group">
                <div className="flex items-center">
                  <button 
                    onClick={() => toggleGroup(groupKey)}
                    className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-cyan-400" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                    <BookOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-white group-hover:text-cyan-50 transition-colors">{group.chapterName}</span>
                      <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-700/50 rounded border border-slate-600/30">Ch. {group.chapterNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wide px-2 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20">{group.curriculum}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[10px] text-purple-400 font-medium px-2 py-0.5 bg-purple-500/10 rounded border border-purple-500/20">Class {group.class}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[10px] text-slate-300 font-medium">{group.subject}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 
                                 text-xs font-semibold text-slate-200 
                                 bg-slate-700/50 rounded-lg border border-slate-600/50">
                    <Layers className="w-3.5 h-3.5" />
                    {group.topics.length} {group.topics.length === 1 ? 'topic' : 'topics'}
                  </span>
                </div>
                <div></div>
                <div></div>
                <div className="flex items-center justify-end gap-2">
                  {canApprove && group.topics.length > 0 && (() => {
                    const firstChapter = group.topics[0].chapter;
                    const isApproved = (firstChapter as any).approved === true;
                    const isUpdating = updatingChapterApproval === firstChapter.id;
                    
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChapterApprovalToggle(firstChapter.id, isApproved);
                        }}
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5
                                 text-xs font-semibold text-white 
                                 ${isApproved 
                                   ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500' 
                                   : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500'
                                 }
                                 rounded-lg shadow-lg transition-all duration-200
                                 opacity-0 group-hover:opacity-100
                                 hover:scale-105 active:scale-95
                                 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {isApproved ? 'Unapproving...' : 'Approving...'}
                          </>
                        ) : (
                          <>
                            {isApproved ? (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Unapprove
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })()}
                  {group.topics.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open the first topic (highest priority)
                        const firstTopic = group.topics[0];
                        if (firstTopic) {
                          onOpenChapter(firstTopic.chapter);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5
                               text-xs font-semibold text-white 
                               bg-gradient-to-r from-cyan-500 to-blue-600
                               hover:from-cyan-400 hover:to-blue-500
                               rounded-lg shadow-lg shadow-cyan-500/20
                               transition-all duration-200
                               opacity-0 group-hover:opacity-100
                               hover:scale-105 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Open
                    </button>
                  )}
                </div>
              </div>
              
              {/* Topics List (when expanded) */}
              {isExpanded && (
                <div className="divide-y divide-slate-700/10 bg-slate-900/20">
                  {group.topics.map(({ chapter, topic, topicPriority }) => {
                    const contentStatus = getContentStatus(chapter);
                    // Use topic_name if it exists and is not empty, otherwise use a generic topic name
                    // Never fallback to chapter_name as that's confusing
                    const topicName = (topic?.topic_name && topic.topic_name.trim()) 
                      ? topic.topic_name 
                      : `Topic ${topicPriority || '?'}`;
                    
                    return (
                      <div
                        key={chapter.id}
                        className="grid grid-cols-[50px_1fr_120px_200px_100px_140px_180px] gap-4 px-6 py-4 pl-14
                                   hover:bg-slate-800/40 transition-all duration-200 group
                                   border-l-2 border-transparent hover:border-cyan-500/50"
                      >
                        {/* Topic Priority */}
                        <div className="flex items-center">
                          <span className="inline-flex items-center justify-center w-9 h-9 
                                         text-xs font-bold text-cyan-400 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 
                                         rounded-lg border border-cyan-500/30 shadow-sm">
                            {topicPriority}
                          </span>
                        </div>
                        
                        {/* Topic Name */}
                        <div className="flex items-center min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-white group-hover:text-cyan-50 transition-colors truncate">
                                {topicName}
                              </span>
                            </div>
                            {topic?.learning_objective && (
                              <p className="text-xs text-slate-400 truncate" title={
                                typeof topic.learning_objective === 'string' 
                                  ? topic.learning_objective 
                                  : topic.learning_objective?.en || topic.learning_objective?.hi || ''
                              }>
                                {typeof topic.learning_objective === 'string' 
                                  ? topic.learning_objective 
                                  : topic.learning_objective?.en || topic.learning_objective?.hi || ''}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Approval Status */}
                        <div className="flex flex-col items-start gap-1.5">
                          {(() => {
                            // Get topic approval status (prefer topic.approval over chapter.approved)
                            // Handle both Firestore Timestamp and plain object formats
                            const approval = topic?.approval || {};
                            let isApproved = approval?.approved === true || approval?.approved === 'true';
                            
                            // Fallback: if topic has no approval, check chapter-level approval (backward compatibility)
                            if (!topic?.approval && (chapter as any).approved === true) {
                              isApproved = true;
                            }
                            
                            const approvedAt = approval?.approvedAt;
                            
                            // Debug logging for approval status
                            if (topic && !topic.approval && !(chapter as any).approved) {
                              console.log('⚠️ Topic missing approval field:', {
                                topicId: topic.topic_id,
                                topicName: topic.topic_name,
                                hasApproval: !!topic.approval,
                                approvalValue: topic.approval,
                                chapterApproved: (chapter as any).approved,
                              });
                            }
                            
                            return (
                              <>
                                {isApproved ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 
                                                 text-xs font-semibold text-emerald-400 
                                                 bg-emerald-500/10 rounded-lg border border-emerald-500/30 shadow-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Approved
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 
                                                 text-xs font-semibold text-amber-400 
                                                 bg-amber-500/10 rounded-lg border border-amber-500/30 shadow-sm">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Not Approved
                                  </span>
                                )}
                                
                                {/* Approved At Timestamp */}
                                {isApproved && approvedAt && (
                                  <span className="text-[10px] text-slate-500" title={`Approved ${formatApprovedAt(approvedAt)}`}>
                                    {formatApprovedAt(approvedAt)}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        
                        {/* Content Status Indicators */}
                        <div className="flex items-center gap-1.5">
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold
                                        ${contentStatus.hasMCQs 
                                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                                          : 'text-slate-500 bg-slate-700/40 border border-slate-600/30'}`}
                               title={contentStatus.hasMCQs ? 'Has MCQs' : 'No MCQs'}>
                            <HelpCircle className="w-3 h-3" />
                            MCQ
                          </div>
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold
                                        ${contentStatus.has3DAssets 
                                          ? 'text-violet-400 bg-violet-500/10 border border-violet-500/20' 
                                          : 'text-slate-500 bg-slate-700/40 border border-slate-600/30'}`}
                               title={contentStatus.has3DAssets ? 'Has 3D Assets' : 'No 3D Assets'}>
                            <Box className="w-3 h-3" />
                            3D
                          </div>
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold
                                        ${contentStatus.hasImages 
                                          ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' 
                                          : 'text-slate-500 bg-slate-700/40 border border-slate-600/30'}`}
                               title={contentStatus.hasImages ? 'Has Images' : 'No Images'}>
                            <Image className="w-3 h-3" />
                            IMG
                          </div>
                        </div>
                        
                        {/* Version */}
                        <div className="flex items-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 
                                         text-xs font-semibold text-slate-300 
                                         bg-slate-700/40 rounded-lg border border-slate-600/30">
                            <GitBranch className="w-3 h-3" />
                            {chapter.current_version || 'v1'}
                          </span>
                        </div>
                        
                        {/* Updated At */}
                        <div className="flex items-center">
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {formatDate(chapter.updated_at)}
                          </span>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Approval Controls (Admin/Superadmin only) - Moved to Actions column for better visibility */}
                          {(() => {
                            const approval = topic?.approval || {};
                            const isApproved = approval.approved === true;
                            const approvalKey = `${chapter.id}_${topic?.topic_id || ''}`;
                            const isUpdating = updatingApproval === approvalKey;
                            
                            // Debug logging
                            if (canApprove && topic?.topic_id) {
                              console.log('✅ Approval button should be visible:', {
                                chapterId: chapter.id,
                                topicId: topic.topic_id,
                                isApproved,
                                canApprove,
                              });
                            }
                            
                            return (
                              <>
                                {canApprove && topic?.topic_id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprovalToggle(chapter.id, topic.topic_id, isApproved);
                                    }}
                                    disabled={isUpdating}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                               transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                               ${isApproved
                                                 ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:border-red-400'
                                                 : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400'
                                               }`}
                                    title={isApproved ? 'Unapprove topic' : 'Approve topic'}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isApproved ? (
                                      <>
                                        <XCircle className="w-3.5 h-3.5" />
                                        Unapprove
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Approve
                                      </>
                                    )}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChapter(chapter);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5
                                     text-sm font-semibold text-white 
                                     bg-gradient-to-r from-cyan-500 to-blue-600
                                     hover:from-cyan-400 hover:to-blue-500
                                     rounded-lg shadow-lg shadow-cyan-500/30
                                     transition-all duration-200
                                     hover:scale-105 active:scale-95
                                     hover:shadow-xl hover:shadow-cyan-500/40"
                          >
                            <Play className="w-4 h-4" />
                            Open Lesson
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChapter(chapter);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5
                                     text-xs font-semibold text-slate-300 
                                     bg-slate-700/60 hover:bg-slate-600/70
                                     border border-slate-600/50 hover:border-slate-500/50
                                     rounded-lg
                                     transition-all duration-200
                                     hover:scale-105 active:scale-95"
                            title="Edit lesson content"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
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
      
      {/* Loading overlay */}
      {loading && chapters.length > 0 && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Loading chapters...</p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-2xl bg-slate-800/30 mb-4">
            <BookOpen className="w-12 h-12 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm font-medium">No chapters found</p>
          <p className="text-slate-500 text-xs mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};
