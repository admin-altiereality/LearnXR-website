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
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
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
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="w-4 h-4" />
            <span className="font-medium text-sm">Topics</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {topics.length} items
          </span>
        </div>
      </div>
      
      {/* Topic List */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && topics.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <Layers className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              No topics in this version
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {topics.map((topic, index) => {
              const status = getStatusColor(topic);
              const isSelected = selectedTopic?.id === topic.id;
              const StatusIcon = status.icon;
              
              const topicId = (topic as any).topic_id || topic.id;
              const approval = (topic as any).approval || {};
              const isApproved = approval?.approved === true || approval?.approved === 'true';
              const approvalKey = `${chapterId}_${topicId || ''}`;
              const isUpdating = updatingApproval === approvalKey;
              
              return (
                <div
                  key={topic.id}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-200 group border',
                    isSelected
                      ? 'bg-primary/10 border-primary/30'
                      : 'hover:bg-muted/50 border-transparent'
                  )}
                >
                  {/* Priority/Order */}
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                    <span className={cn(
                      'text-xs font-semibold w-5 h-5 flex items-center justify-center rounded',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {topic.topic_priority || index + 1}
                    </span>
                  </div>
                  
                  {/* Content - title and status badges only; stays in flow and truncates */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <Button
                        variant="ghost"
                        className="flex-1 min-w-0 justify-start h-auto p-0 font-medium text-left hover:bg-transparent max-w-full"
                        onClick={() => onSelectTopic(topic)}
                      >
                        <h4 className={cn(
                          'text-sm font-medium truncate block',
                          isSelected ? 'text-foreground' : 'text-foreground/90'
                        )}>
                          {(topic.topic_name && topic.topic_name.trim()) 
                            ? topic.topic_name 
                            : `Untitled Topic ${topic.topic_priority || index + 1}`}
                        </h4>
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn('gap-1 text-[10px]', status.bg, status.border, status.text)}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {status.label}
                      </Badge>
                      {topic.has_scene && (
                        <Badge variant="outline" className="gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20">
                          <FileText className="w-2.5 h-2.5" />
                          Scene
                        </Badge>
                      )}
                      {topic.has_mcqs && (
                        <Badge variant="outline" className="gap-1 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20">
                          <HelpCircle className="w-2.5 h-2.5" />
                          MCQs
                        </Badge>
                      )}
                    </div>
                    
                    {topic.scene_type && (
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {topic.scene_type}
                      </span>
                    )}
                  </div>
                  
                  {/* Right column: approval badge + approve button - never shrinks, no overlap */}
                  <div className="flex flex-shrink-0 items-start gap-2">
                    {isApproved ? (
                      <Badge variant="default" className="gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-600 whitespace-nowrap">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 whitespace-nowrap">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Not Approved
                      </Badge>
                    )}
                    {canApprove && topicId && (
                      <Button
                        variant={isApproved ? 'destructive' : 'default'}
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={(e) => handleApprovalToggle(e, topic)}
                        disabled={isUpdating}
                        title={isApproved ? 'Unapprove topic' : 'Approve topic'}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isApproved ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
