import { Topic, Scene, MCQ, MCQFormState, FlattenedMCQ } from '../../types/curriculum';
import { EditHistoryEntry } from '../../lib/firestore/queries';
import { OverviewTab } from './tabs/OverviewTab';
import { SceneTab } from './tabs/SceneTab';
import { AvatarTab } from './tabs/AvatarTab';
import { McqTab } from './tabs/McqTab';
import { HistoryTab } from './tabs/HistoryTab';
import { AssetsTab } from './tabs/AssetsTab';
import {
  FileText,
  Image,
  User,
  HelpCircle,
  History,
  Loader2,
  Package,
} from 'lucide-react';

interface TopicEditorProps {
  topic: Topic;
  scene: Scene | null;
  mcqs: MCQ[];
  editHistory: EditHistoryEntry[];
  topicFormState: Partial<Topic>;
  sceneFormState: Partial<Scene>;
  mcqFormState: MCQFormState[];
  onTopicChange: (field: keyof Topic, value: unknown) => void;
  onSceneChange: (field: keyof Scene, value: unknown) => void;
  onMcqsChange: (mcqs: MCQFormState[]) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isReadOnly: boolean;
  loading: boolean;
  chapterId: string;
  versionId: string;
  flattenedMcqInfo: { hasFlattened: boolean; count: number };
  onNormalizeMCQs: () => void;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'scene', label: 'Scene & Skybox', icon: Image },
  { id: 'assets', label: '3D Assets', icon: Package },
  { id: 'avatar', label: 'Avatar Scripts', icon: User },
  { id: 'mcqs', label: 'MCQs', icon: HelpCircle },
  { id: 'history', label: 'History', icon: History },
];

export const TopicEditor = ({
  topic,
  scene,
  mcqs,
  editHistory,
  topicFormState,
  sceneFormState,
  mcqFormState,
  onTopicChange,
  onSceneChange,
  onMcqsChange,
  activeTab,
  onTabChange,
  isReadOnly,
  loading,
  chapterId,
  versionId,
  flattenedMcqInfo,
  onNormalizeMCQs,
}: TopicEditorProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading topic...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-slate-700/50 bg-[#0d1424]/50">
        <div className="flex items-center gap-1 px-6 pt-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                          rounded-t-lg transition-all duration-200 border-b-2 -mb-[1px]
                          ${isActive
                            ? 'text-cyan-400 bg-[#0a0f1a] border-cyan-500'
                            : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/30'
                          }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <OverviewTab
            topicFormState={topicFormState}
            sceneFormState={sceneFormState}
            onTopicChange={onTopicChange}
            onSceneChange={onSceneChange}
            isReadOnly={isReadOnly}
          />
        )}
        
        {activeTab === 'scene' && (
          <SceneTab
            sceneFormState={sceneFormState}
            onSceneChange={onSceneChange}
            isReadOnly={isReadOnly}
            chapterId={chapterId}
            versionId={versionId}
            topicId={topic.id}
          />
        )}
        
        {activeTab === 'assets' && (
          <AssetsTab
            chapterId={chapterId}
            topicId={topic.id}
          />
        )}
        
        {activeTab === 'avatar' && (
          <AvatarTab
            sceneFormState={sceneFormState}
            onSceneChange={onSceneChange}
            isReadOnly={isReadOnly}
          />
        )}
        
        {activeTab === 'mcqs' && (
          <McqTab
            mcqs={mcqs}
            mcqFormState={mcqFormState}
            onMcqsChange={onMcqsChange}
            isReadOnly={isReadOnly}
            flattenedMcqInfo={flattenedMcqInfo}
            onNormalizeMCQs={onNormalizeMCQs}
          />
        )}
        
        {activeTab === 'history' && (
          <HistoryTab editHistory={editHistory} />
        )}
      </div>
    </div>
  );
};
