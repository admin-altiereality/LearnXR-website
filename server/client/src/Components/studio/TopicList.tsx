import { Topic } from '../../types/curriculum';
import { useState, useEffect } from 'react';
import {
  Layers,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  FileText,
  HelpCircle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { updateTopicApproval } from '../../lib/firestore/updateHelpers';
import { isAdminOnly, isSuperadmin } from '../../utils/rbac';
import { toast } from 'react-hot-toast';

interface TopicListProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  loading?: boolean;
  chapterId: string;
  onApprovalChange?: () => void;
}

export const TopicList = ({
  topics,
  selectedTopic,
  onSelectTopic,
  loading,
  chapterId,
  onApprovalChange,
}: TopicListProps) => {
  const { profile } = useAuth();
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  
  // Check if user can approve (admin or superadmin)
  const canApprove = profile && (isAdminOnly(profile) || isSuperadmin(profile));
  
  // Debug logging
  useEffect(() => {
    if (topics.length > 0) {
      const sampleTopic = topics[0];
      console.log('📋 TopicList Debug:', {
        totalTopics: topics.length,
        canApprove,
        userRole: profile?.role,
        sampleTopic: {
          id: sampleTopic.id,
          topic_id: (sampleTopic as any).topic_id,
          topic_name: sampleTopic.topic_name,
          hasApproval: !!(sampleTopic as any).approval,
          approval: (sampleTopic as any).approval,
          approvalStatus: (sampleTopic as any).approval?.approved,
        },
        allTopics: topics.map(t => ({
          id: t.id,
          topic_id: (t as any).topic_id,
          topic_name: t.topic_name,
          approval: (t as any).approval,
        })),
      });
    }
  }, [topics, canApprove, profile]);
  
  // Handle topic approval toggle
  const handleApprovalToggle = async (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation();
    // Topic.id is mapped from topic_id in getTopics(), but we need the original topic_id
    // Check both topic.id and (topic as any).topic_id for compatibility
    const topicId = (topic as any).topic_id || topic.id;
    if (!canApprove || !profile || !topicId) return;
    
    const approval = (topic as any).approval || {};
    const currentApproved = approval.approved === true;
    const approvalKey = `${chapterId}_${topicId}`;
    
    setUpdatingApproval(approvalKey);
    
    try {
      await updateTopicApproval({
        chapterId,
        topicId: topicId,
        approved: !currentApproved,
        userId: profile.uid,
      });
      
      toast.success(`Topic ${!currentApproved ? 'approved' : 'unapproved'} successfully`);
      
      // Trigger refresh callback if provided
      if (onApprovalChange) {
        onApprovalChange();
      }
    } catch (error) {
      console.error('Error updating topic approval:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingApproval(null);
    }
  };
  
  const getStatusColor = (topic: Topic) => {
    // Determine status based on has_scene and other factors
    if (topic.has_scene) {
      return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: CheckCircle2,
        label: 'Published',
      };
    }
    return {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: AlertCircle,
      label: 'Draft',
    };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <Layers className="w-4 h-4" />
            <span className="font-medium text-sm">Topics</span>
          </div>
          <span className="text-xs text-slate-500">
            {topics.length} items
          </span>
        </div>
      </div>
      
      {/* Topic List */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && topics.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Layers className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500 text-center">
              No topics in this version
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {topics.map((topic, index) => {
              const status = getStatusColor(topic);
              const isSelected = selectedTopic?.id === topic.id;
              const StatusIcon = status.icon;
              
              // Get topic_id - check both topic_id (from Firebase) and id (from normalized Topic)
              const topicId = (topic as any).topic_id || topic.id;
              // Handle both Firestore Timestamp and plain object formats for approval
              const approval = (topic as any).approval || {};
              const isApproved = approval?.approved === true || approval?.approved === 'true';
              const approvalKey = `${chapterId}_${topicId || ''}`;
              const isUpdating = updatingApproval === approvalKey;
              
              return (
                <div
                  key={topic.id}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg
                            transition-all duration-200 group
                            ${isSelected
                              ? 'bg-cyan-500/10 border border-cyan-500/30'
                              : 'hover:bg-slate-800/50 border border-transparent'
                            }`}
                >
                  {/* Priority/Order */}
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <GripVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 
                                           transition-opacity cursor-grab" />
                    <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center
                                    rounded ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {topic.topic_priority || index + 1}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onSelectTopic(topic)}
                        className="flex-1 text-left"
                      >
                        <h4 className={`text-sm font-medium truncate
                                      ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {(topic.topic_name && topic.topic_name.trim()) 
                            ? topic.topic_name 
                            : `Untitled Topic ${topic.topic_priority || index + 1}`}
                        </h4>
                      </button>
                      
                      {/* Approval Status Badge */}
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 
                                       text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 
                                       rounded border border-emerald-500/30 flex-shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 
                                       text-[10px] font-semibold bg-amber-500/10 text-amber-300 
                                       rounded border border-amber-500/30 flex-shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Not Approved
                        </span>
                      )}
                    </div>
                    
                    {/* Status & Indicators */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 
                                      text-[10px] font-medium rounded
                                      ${status.bg} ${status.border} ${status.text} border`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {status.label}
                      </span>
                      
                      {/* Has Scene */}
                      {topic.has_scene && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 
                                       text-[10px] font-medium text-blue-400 
                                       bg-blue-500/10 rounded border border-blue-500/20">
                          <FileText className="w-2.5 h-2.5" />
                          Scene
                        </span>
                      )}
                      
                      {/* Has MCQs */}
                      {topic.has_mcqs && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 
                                       text-[10px] font-medium text-purple-400 
                                       bg-purple-500/10 rounded border border-purple-500/20">
                          <HelpCircle className="w-2.5 h-2.5" />
                          MCQs
                        </span>
                      )}
                    </div>
                    
                    {/* Scene Type */}
                    {topic.scene_type && (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {topic.scene_type}
                      </span>
                    )}
                  </div>
                  
                  {/* Approval Button */}
                  {canApprove && topicId && (
                    <button
                      onClick={(e) => handleApprovalToggle(e, topic)}
                      disabled={isUpdating}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold
                                 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0
                                 ${isApproved
                                   ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:border-red-400'
                                   : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400'
                                 }`}
                      title={isApproved ? 'Unapprove topic' : 'Approve topic'}
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isApproved ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
