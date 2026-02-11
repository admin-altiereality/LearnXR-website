import { Topic, Scene, MCQ, MCQFormState, FlattenedMCQ, TopicResources, MeshyAsset, ChapterImage, LanguageCode } from '../../types/curriculum';
import type { LessonVersion } from '../../types/lessonVersion';
import { UI_TAB_TO_VERSION_KEY } from '../../types/lessonVersion';
import type { EditableTabKey } from '../../types/lessonVersion';
import { EditHistoryEntry } from '../../lib/firestore/queries';
import { useLessonDraftStore } from '../../stores/lessonDraftStore';
import { OverviewTab } from './tabs/OverviewTab';
import { SceneTab } from './tabs/SceneTab';
import { AvatarTab } from './tabs/AvatarTab';
import { McqTab } from './tabs/McqTab';
import { HistoryTab } from './tabs/HistoryTab';
import { AssetsTab } from './tabs/AssetsTab';
import { ImagesTab } from './tabs/ImagesTab';
import { SourceTab } from './tabs/SourceTab';
import {
  FileText,
  Image,
  ImageIcon,
  User,
  HelpCircle,
  History,
  Loader2,
  Package,
  BookOpen,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';

interface ContentAvailability {
  hasMCQs: boolean;
  mcqCount: number;
  has3DAssets: boolean;
  assetCount: number;
  hasImages: boolean;
  imageCount: number;
  loading: boolean;
}

interface TopicEditorProps {
  topic: Topic;
  scene: Scene | null;
  mcqs: MCQ[];
  editHistory: EditHistoryEntry[];
  lessonVersions?: LessonVersion[];
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
  contentAvailability?: ContentAvailability;
  language?: LanguageCode;
  bundle?: any; // Lesson bundle for passing to tabs
  /** For MCQ tab: AI generation context */
  learningObjective?: string;
  subject?: string;
  classLevel?: string;
  curriculum?: string;
  /** When false (e.g. Associate), hide delete content actions */
  canDeleteContent?: boolean;
  /** When Associate: pass for draft overlay in AvatarTab */
  userId?: string;
  userRole?: string;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'scene', label: 'Scene & Skybox', icon: Image },
  { id: 'assets', label: '3D Assets', icon: Package },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'avatar', label: 'Avatar Scripts', icon: User },
  { id: 'mcqs', label: 'MCQs', icon: HelpCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'source', label: 'Source', icon: BookOpen },
];

export const TopicEditor = ({
  topic,
  scene,
  mcqs,
  editHistory,
  lessonVersions = [],
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
  contentAvailability,
  language = 'en',
  bundle,
  learningObjective,
  subject,
  classLevel,
  curriculum,
  canDeleteContent = true,
  userId,
  userRole,
}: TopicEditorProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Loading topic...</span>
        </div>
      </div>
    );
  }

  // Read dirty state from the Zustand draft store for tab indicators
  const dirtyTabs = useLessonDraftStore((s) => s.dirtyTabs);

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col">
        <div className="border-b border-border bg-muted/30 px-6">
          <TabsList className="h-12 w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              // Map UI tab id to version key to check dirty state
              const versionKey = UI_TAB_TO_VERSION_KEY[tab.id] as EditableTabKey | undefined;
              const isDirty = versionKey ? dirtyTabs[versionKey] === true : false;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="relative flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none"
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isDirty && (
                    <span
                      className="absolute top-2 right-1.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                      title="Unsaved changes"
                    />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <TabsContent value="overview" className="mt-0 h-full">
          <OverviewTab
            topicFormState={topicFormState}
            sceneFormState={sceneFormState}
            onTopicChange={onTopicChange}
            onSceneChange={onSceneChange}
            isReadOnly={isReadOnly}
            contentAvailability={contentAvailability}
            chapterId={chapterId}
            topicId={topic.id}
          />
          </TabsContent>
        
          <TabsContent value="scene" className="mt-0 h-full">
          <SceneTab
            sceneFormState={sceneFormState}
            onSceneChange={onSceneChange}
            isReadOnly={isReadOnly}
            chapterId={chapterId}
            versionId={versionId}
            topicId={topic.id}
          />
          </TabsContent>
        
          <TabsContent value="assets" className="mt-0 h-full">
          <AssetsTab
            chapterId={chapterId}
            topicId={topic.id}
            bundle={bundle}
            language={language}
          />
          </TabsContent>
        
          <TabsContent value="images" className="mt-0 h-full">
          <ImagesTab
            chapterId={chapterId}
            topicId={topic.id}
            bundle={bundle}
          />
          </TabsContent>
        
          <TabsContent value="avatar" className="mt-0 h-full">
          <AvatarTab
            sceneFormState={sceneFormState}
            onSceneChange={onSceneChange}
            isReadOnly={isReadOnly}
            chapterId={chapterId}
            topicId={topic.id}
            language={language}
            userId={userId}
            userRole={userRole}
          />
          </TabsContent>
        
          <TabsContent value="mcqs" className="mt-0 h-full">
          <McqTab
            mcqs={mcqs}
            mcqFormState={mcqFormState}
            onMcqsChange={onMcqsChange}
            isReadOnly={isReadOnly}
            flattenedMcqInfo={flattenedMcqInfo}
            onNormalizeMCQs={onNormalizeMCQs}
            chapterId={chapterId}
            topicId={topic.id}
            language={language}
            learningObjective={learningObjective}
            subject={subject}
            classLevel={classLevel}
            curriculum={curriculum}
            canDeleteContent={canDeleteContent}
          />
          </TabsContent>

          <TabsContent value="source" className="mt-0 h-full">
            <SourceTab bundle={bundle} chapterId={chapterId} topicId={topic.id} />
          </TabsContent>
        
          <TabsContent value="history" className="mt-0 h-full">
            <HistoryTab editHistory={editHistory} lessonVersions={lessonVersions} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
