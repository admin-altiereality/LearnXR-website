import { Topic, Scene } from '../../../types/curriculum';
import { FileText, Hash, Tag, Target, HelpCircle, Box, Image, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ContentAvailability {
  hasMCQs: boolean;
  mcqCount: number;
  has3DAssets: boolean;
  assetCount: number;
  hasImages: boolean;
  imageCount: number;
  loading: boolean;
}

interface OverviewTabProps {
  topicFormState: Partial<Topic>;
  sceneFormState: Partial<Scene>;
  onTopicChange: (field: keyof Topic, value: unknown) => void;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  isReadOnly: boolean;
  contentAvailability?: ContentAvailability;
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
  contentAvailability,
}: OverviewTabProps) => {
  const availability = contentAvailability || {
    hasMCQs: false,
    mcqCount: 0,
    has3DAssets: false,
    assetCount: 0,
    hasImages: false,
    imageCount: 0,
    loading: false,
  };
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
        
        {/* Content Availability Card */}
        <div className="mt-8 p-5 bg-slate-800/30 rounded-xl border border-slate-700/30">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Content Availability
          </h3>
          
          {availability.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="ml-2 text-sm text-slate-400">Checking content...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Scene Status */}
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Scene Status</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg
                               ${sceneFormState.status === 'published'
                                 ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                 : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                               }`}>
                  {sceneFormState.status === 'published' ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                  {sceneFormState.status || 'Draft'}
                </span>
              </div>
              
              {/* MCQ Status */}
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <HelpCircle className="w-3 h-3 text-cyan-400" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">MCQs</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg
                                 ${availability.hasMCQs
                                   ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                   : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                                 }`}>
                    {availability.hasMCQs ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {availability.hasMCQs ? `${availability.mcqCount} MCQs` : 'None'}
                  </span>
                </div>
              </div>
              
              {/* 3D Assets Status */}
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <Box className="w-3 h-3 text-violet-400" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">3D Assets</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg
                                 ${availability.has3DAssets
                                   ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                   : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                                 }`}>
                    {availability.has3DAssets ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {availability.has3DAssets ? `${availability.assetCount} Assets` : 'None'}
                  </span>
                </div>
              </div>
              
              {/* Images Status */}
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <Image className="w-3 h-3 text-amber-400" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Images</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg
                                 ${availability.hasImages
                                   ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                   : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                                 }`}>
                    {availability.hasImages ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {availability.hasImages ? `${availability.imageCount} Images` : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Scene Status Card */}
        <div className="mt-4 p-4 bg-slate-800/20 rounded-xl border border-slate-700/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                            ${topicFormState.has_scene 
                              ? 'bg-emerald-500/10 border border-emerald-500/20' 
                              : 'bg-slate-700/30 border border-slate-600/30'}`}>
                {topicFormState.has_scene ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">Scene Configuration</p>
                <p className="text-xs text-slate-400">
                  {topicFormState.has_scene ? 'Scene is configured with skybox/assets' : 'No scene configured yet'}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1.5 text-xs font-semibold rounded-full
                           ${topicFormState.has_scene
                             ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                             : 'text-slate-400 bg-slate-700/50 border border-slate-600/30'
                           }`}>
              {topicFormState.has_scene ? 'Ready' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
