import { Topic, Scene } from '../../../types/curriculum';
import { FileText, Hash, Tag, Target } from 'lucide-react';

interface OverviewTabProps {
  topicFormState: Partial<Topic>;
  sceneFormState: Partial<Scene>;
  onTopicChange: (field: keyof Topic, value: unknown) => void;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  isReadOnly: boolean;
}

const sceneTypes = [
  { value: 'interactive', label: 'Interactive' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exploration', label: 'Exploration' },
];

export const OverviewTab = ({
  topicFormState,
  sceneFormState,
  onTopicChange,
  onSceneChange,
  isReadOnly,
}: OverviewTabProps) => {
  return (
    <div className="p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Topic Name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <FileText className="w-4 h-4 text-cyan-400" />
            Topic Name
          </label>
          <input
            type="text"
            value={topicFormState.topic_name || ''}
            onChange={(e) => onTopicChange('topic_name', e.target.value)}
            disabled={isReadOnly}
            placeholder="Enter topic name..."
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                     px-4 py-3 text-white placeholder:text-slate-500
                     focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          />
        </div>
        
        {/* Priority & Scene Type Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Topic Priority */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Hash className="w-4 h-4 text-cyan-400" />
              Topic Priority
            </label>
            <input
              type="number"
              value={topicFormState.topic_priority || 1}
              onChange={(e) => onTopicChange('topic_priority', parseInt(e.target.value) || 1)}
              disabled={isReadOnly}
              min={1}
              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                       px-4 py-3 text-white
                       focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            />
            <p className="text-xs text-slate-500">
              Determines the order in the topic list
            </p>
          </div>
          
          {/* Scene Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Tag className="w-4 h-4 text-cyan-400" />
              Scene Type
            </label>
            <select
              value={topicFormState.scene_type || 'interactive'}
              onChange={(e) => onTopicChange('scene_type', e.target.value)}
              disabled={isReadOnly}
              className="w-full appearance-none bg-slate-800/50 border border-slate-600/50 rounded-xl
                       px-4 py-3 text-white
                       focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            >
              {sceneTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Defines how the scene will be presented
            </p>
          </div>
        </div>
        
        {/* Learning Objective */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Target className="w-4 h-4 text-cyan-400" />
            Learning Objective
          </label>
          <textarea
            value={sceneFormState.learning_objective || ''}
            onChange={(e) => onSceneChange('learning_objective', e.target.value)}
            disabled={isReadOnly}
            placeholder="What should students learn from this topic?"
            rows={4}
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl
                     px-4 py-3 text-white placeholder:text-slate-500
                     focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                     disabled:opacity-50 disabled:cursor-not-allowed resize-none
                     transition-all duration-200"
          />
          <p className="text-xs text-slate-500">
            A clear statement of what learners will be able to do after completing this topic
          </p>
        </div>
        
        {/* Status Info Card */}
        <div className="mt-8 p-5 bg-slate-800/30 rounded-xl border border-slate-700/30">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Status Information</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Scene Status</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg
                             ${sceneFormState.status === 'published'
                               ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                               : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                             }`}>
                {sceneFormState.status || 'draft'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Has Scene</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg
                             ${topicFormState.has_scene
                               ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                               : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                             }`}>
                {topicFormState.has_scene ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Has MCQs</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg
                             ${topicFormState.has_mcqs
                               ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                               : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                             }`}>
                {topicFormState.has_mcqs ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
