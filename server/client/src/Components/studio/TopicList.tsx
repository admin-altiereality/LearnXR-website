import { Topic } from '../../types/curriculum';
import {
  Layers,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  FileText,
  HelpCircle,
  Loader2,
} from 'lucide-react';

interface TopicListProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  loading?: boolean;
}

export const TopicList = ({
  topics,
  selectedTopic,
  onSelectTopic,
  loading,
}: TopicListProps) => {
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
              
              return (
                <button
                  key={topic.id}
                  onClick={() => onSelectTopic(topic)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left
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
                    <h4 className={`text-sm font-medium truncate mb-1
                                  ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {topic.topic_name}
                    </h4>
                    
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
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
