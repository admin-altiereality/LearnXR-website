'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { canDeleteLesson, canEditLesson } from '../../utils/rbac';
import {
  getChapterWithDetails,
  getTopics,
  getCurrentScene,
  getMCQs,
  getEditHistory,
  checkForFlattenedMCQs,
  EditHistoryEntry,
  // extractTopicScriptsForLanguage is still used by getLessonBundle internally
  extractTopicScriptsForLanguage,
} from '../../lib/firestore/queries';
import {
  updateTopic,
  updateScene,
  createScene,
  publishScene,
  updateMCQs,
  normalizeFlattenedMCQs,
} from '../../lib/firestore/updateHelpers';
import { TopicList } from '../../Components/studio/TopicList';
import { TopicEditor } from '../../Components/studio/TopicEditor';
import { LaunchLessonButton } from '../../Components/studio/LaunchLessonButton';
import { LanguageSelector } from '../../Components/LanguageSelector';
import {
  Chapter,
  ChapterVersion,
  Topic,
  Scene,
  MCQ,
  MCQFormState,
  FlattenedMCQ,
  LanguageCode,
} from '../../types/curriculum';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../types/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  getChapterNameByLanguage,
  getTopicNameByLanguage,
  getLearningObjectiveByLanguage
} from '../../lib/firebase/utils/languageAvailability';
import {
  ArrowLeft,
  BookOpen,
  GitBranch,
  Loader2,
  AlertCircle,
  Save,
  Send,
  ChevronDown,
  Eye,
  EyeOff,
  Rocket,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

const ChapterEditor = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  
  // Context from navigation
  const navState = location.state as {
    curriculumId?: string;
    classId?: string;
    subjectId?: string;
    language?: LanguageCode;
  } | null;
  
  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    navState?.language || 'en'
  );
  
  // Chapter data
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<ChapterVersion | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  
  // Topics
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  // Scene and MCQs (lazy loaded)
  const [scene, setScene] = useState<Scene | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [flattenedMcqInfo, setFlattenedMcqInfo] = useState<{ hasFlattened: boolean; count: number }>({
    hasFlattened: false,
    count: 0,
  });
  
  // Form state for dirty tracking
  const [topicFormState, setTopicFormState] = useState<Partial<Topic>>({});
  const [sceneFormState, setSceneFormState] = useState<Partial<Scene>>({});
  const [mcqFormState, setMcqFormState] = useState<MCQFormState[]>([]);
  
  // Dirty tracking
  const [topicDirty, setTopicDirty] = useState(false);
  const [sceneDirty, setSceneDirty] = useState(false);
  const [mcqDirty, setMcqDirty] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showDeleteLessonModal, setShowDeleteLessonModal] = useState(false);
  const [deletingLesson, setDeletingLesson] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // Content availability state
  const [currentBundle, setCurrentBundle] = useState<any>(null); // Store current bundle for passing to tabs
  const [contentAvailability, setContentAvailability] = useState({
    hasMCQs: false,
    mcqCount: 0,
    has3DAssets: false,
    assetCount: 0,
    hasImages: false,
    imageCount: 0,
    loading: false,
  });
  
  // Load chapter and versions
  useEffect(() => {
    if (!chapterId) return;
    
    const loadChapter = async () => {
      setLoading(true);
      try {
        const result = await getChapterWithDetails(chapterId);
        setChapter(result.chapter);
        setVersions(result.versions);
        setCurrentVersion(result.currentVersion);
        
        if (result.currentVersion) {
          setSelectedVersionId(result.currentVersion.id);
          // Admin and superadmin can always edit, regardless of version status
          const canEdit = result.currentVersion.status === 'active' || 
                         (profile?.role === 'admin' || profile?.role === 'superadmin');
          setIsReadOnly(!canEdit);
        }
      } catch (error) {
        console.error('Error loading chapter:', error);
        toast.error('Failed to load chapter');
      } finally {
        setLoading(false);
      }
    };
    
    loadChapter();
  }, [chapterId]);
  
  // Load topics when version changes
  useEffect(() => {
    if (!chapterId || !selectedVersionId) return;
    
    const loadTopics = async () => {
      try {
        const topicsData = await getTopics(chapterId, selectedVersionId);
        setTopics(topicsData);
        
        // Auto-select first topic if none selected
        if (topicsData.length > 0 && !selectedTopic) {
          handleSelectTopic(topicsData[0]);
        }
      } catch (error) {
        console.error('Error loading topics:', error);
        toast.error('Failed to load topics');
      }
    };
    
    loadTopics();
  }, [chapterId, selectedVersionId]);
  
  // Load content availability for the topic - using bundle data only (unified pipeline)
  const loadContentAvailability = useCallback(async (topicId: string, bundle: any) => {
    if (!chapterId || !bundle) {
      setContentAvailability(prev => ({ ...prev, loading: false }));
      return;
    }
    
    setContentAvailability(prev => ({ ...prev, loading: true }));
    
    try {
      // Use bundle data exclusively (already language-filtered and complete)
      const mcqsData = bundle.mcqs || [];
      const ttsData = bundle.tts || [];
      const assetsData = bundle.assets3d || [];
      const imagesData = bundle.images || []; // Use bundle.images instead of separate fetch
      
      console.log('📊 Using bundle data for content availability:', {
        language: bundle.lang,
        mcqs: mcqsData.length,
        tts: ttsData.length,
        assets: assetsData.length,
        images: imagesData.length,
      });
      
      // Check if MCQs have options (for proper availability check)
      const mcqsWithOptions = mcqsData.filter(m => m.options && Array.isArray(m.options) && m.options.length > 0);
      
      // Check if TTS entries have audio URLs
      const ttsWithAudio = ttsData.filter(t => t.audio_url || t.audioUrl || t.url);
      
      setContentAvailability({
        hasMCQs: mcqsWithOptions.length > 0, // Only count MCQs with options
        mcqCount: mcqsWithOptions.length,
        has3DAssets: assetsData.length > 0,
        assetCount: assetsData.length,
        hasImages: imagesData.length > 0,
        imageCount: imagesData.length,
        loading: false,
      });
      
      console.log('📊 Content availability result:', {
        language: bundle.lang,
        mcqs: {
          total: mcqsData.length,
          withOptions: mcqsWithOptions.length,
        },
        tts: {
          total: ttsData.length,
          withAudio: ttsWithAudio.length,
        },
        assets: assetsData.length,
        images: imagesData.length,
      });
    } catch (error) {
      console.error('Error loading content availability:', error);
      setContentAvailability(prev => ({ ...prev, loading: false }));
    }
  }, [chapterId]);
  
  // Load scene data when topic changes - using unified bundle
  const loadTopicData = useCallback(async (topic: Topic) => {
    if (!chapterId || !selectedVersionId) return;
    
    setLoadingTopic(true);
    try {
      // Use unified bundle to fetch ALL data (MCQs, TTS, avatar scripts, images, etc.)
      const { getLessonBundle } = await import('../../services/firestore/getLessonBundle');
      const bundle = await getLessonBundle({
        chapterId,
        lang: selectedLanguage,
        topicId: topic.id, // Pass specific topic ID
      });
      
      console.log('📦 Loaded lesson bundle:', {
        lang: bundle.lang,
        mcqs: bundle.mcqs.length,
        tts: bundle.tts.length,
        hasAvatarScripts: !!bundle.avatarScripts,
        hasSkybox: !!bundle.skybox,
        assets3d: bundle.assets3d.length,
        images: bundle.images?.length || 0,
        textTo3dAssets: bundle.textTo3dAssets?.length || 0,
        textTo3dApproved: bundle.textTo3dAssets?.filter((a: any) => a.approval_status === true).length || 0,
      });
      
      // Store bundle for passing to tabs
      setCurrentBundle(bundle);
      
      // Load scene (still use getCurrentScene for scene-specific data)
      const sceneData = await getCurrentScene(chapterId, selectedVersionId, topic.id);
      console.log('📋 Loaded scene data:', {
        skybox_url: sceneData?.skybox_url || bundle.skybox?.imageUrl,
        skybox_id: sceneData?.skybox_id || bundle.skybox?.id,
        in3d_prompt: sceneData?.in3d_prompt?.substring(0, 50),
      });
      setScene(sceneData);
      
      // Populate scene form state with bundle data (avatar scripts from bundle)
      const avatarScripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
      setSceneFormState({
        ...sceneData,
        avatar_intro: avatarScripts.intro || sceneData?.avatar_intro || '',
        avatar_explanation: avatarScripts.explanation || sceneData?.avatar_explanation || '',
        avatar_outro: avatarScripts.outro || sceneData?.avatar_outro || '',
        skybox_url: bundle.skybox?.imageUrl || bundle.skybox?.file_url || sceneData?.skybox_url || '',
        skybox_id: bundle.skybox?.id || sceneData?.skybox_id || '',
      });
      
      // Populate MCQs from bundle (already language-filtered and options extracted)
      const mcqsFromBundle = bundle.mcqs.map((m) => {
        // Ensure options is always an array (bundle already extracted them)
        const options = Array.isArray(m.options) && m.options.length > 0 
          ? m.options 
          : [];
        
        return {
          id: m.id,
          question: m.question || m.question_text || '',
          options: options,
          correct_option_index: m.correct_option_index ?? 0,
          explanation: m.explanation || m.explanation_text || '',
          difficulty: m.difficulty || 'medium',
          order: m.order ?? 0,
        };
      });
      
      console.log(`✅ Loaded ${mcqsFromBundle.length} ${selectedLanguage} MCQs from bundle:`, {
        total: mcqsFromBundle.length,
        withOptions: mcqsFromBundle.filter(m => m.options && m.options.length > 0).length,
        sampleMcq: mcqsFromBundle.length > 0 ? {
          id: mcqsFromBundle[0].id,
          question: mcqsFromBundle[0].question?.substring(0, 50),
          optionsCount: mcqsFromBundle[0].options?.length || 0,
          options: mcqsFromBundle[0].options,
          correctIndex: mcqsFromBundle[0].correct_option_index,
        } : null,
      });
      
      setMcqs(mcqsFromBundle);
      setMcqFormState(mcqsFromBundle.map((m) => ({ ...m })));
      
      // Check for flattened MCQs (for legacy support)
      const flatInfo = await checkForFlattenedMCQs(chapterId, selectedVersionId, topic.id);
      setFlattenedMcqInfo(flatInfo);
      
      // Load content availability using bundle data (more accurate)
      loadContentAvailability(topic.id, bundle);
      
      // Reset dirty state
      setTopicDirty(false);
      setSceneDirty(false);
      setMcqDirty(false);
    } catch (error) {
      console.error('Error loading topic data:', error);
      toast.error('Failed to load topic data');
    } finally {
      setLoadingTopic(false);
    }
  }, [chapterId, selectedVersionId, selectedLanguage, loadContentAvailability]);
  
  // MCQs are now loaded via the bundle in loadTopicData - no separate function needed
  
  // Load edit history only when History tab is opened
  const loadHistory = useCallback(async () => {
    if (!chapterId || !selectedVersionId || !selectedTopic) return;
    
    try {
      const history = await getEditHistory(chapterId, selectedVersionId, selectedTopic.id);
      setEditHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, [chapterId, selectedVersionId, selectedTopic]);
  
  // Handle tab change - lazy load data
  useEffect(() => {
    if (activeTab === 'history' && selectedTopic) {
      loadHistory();
    }
  }, [activeTab, selectedTopic, loadHistory]);
  
  // Reload data when language changes - bundle will reload everything
  useEffect(() => {
    if (selectedTopic) {
      loadTopicData(selectedTopic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]);
  
  const handleSelectTopic = (topic: Topic) => {
    // Warn about unsaved changes
    if (topicDirty || sceneDirty || mcqDirty) {
      const confirm = window.confirm('You have unsaved changes. Discard them?');
      if (!confirm) return;
    }
    
    setSelectedTopic(topic);
    setTopicFormState({ ...topic });
    setMcqs([]);
    setMcqFormState([]);
    setMcqsLoaded(false); // Reset MCQ loaded state for new topic
    setEditHistory([]);
    loadTopicData(topic);
  };
  
  const handleVersionChange = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    setSelectedVersionId(versionId);
    setCurrentVersion(version || null);
    // Admin and superadmin can always edit, regardless of version status
    const canEdit = version?.status === 'active' || 
                   (profile?.role === 'admin' || profile?.role === 'superadmin');
    setIsReadOnly(!canEdit);
    setSelectedTopic(null);
    setScene(null);
    setMcqs([]);
  };
  
  // Form change handlers
  const handleTopicChange = (field: keyof Topic, value: unknown) => {
    setTopicFormState((prev) => ({ ...prev, [field]: value }));
    setTopicDirty(true);
  };
  
  const handleSceneChange = (field: keyof Scene, value: unknown) => {
    setSceneFormState((prev) => ({ ...prev, [field]: value }));
    setSceneDirty(true);
  };
  
  const handleMcqsChange = (mcqs: MCQFormState[]) => {
    setMcqFormState(mcqs);
    setMcqDirty(true);
  };
  
  // Save handler
  const handleSave = async () => {
    if (!chapterId || !selectedVersionId || !selectedTopic || !user?.email) {
      toast.error('Missing required data');
      return;
    }
    
    setSaving(true);
    try {
      // Save topic changes
      if (topicDirty) {
        await updateTopic({
          chapterId,
          versionId: selectedVersionId,
          topicId: selectedTopic.id,
          original: selectedTopic,
          updated: topicFormState,
          userId: user.email,
        });
        
        // Update local state
        setTopics((prev) =>
          prev.map((t) =>
            t.id === selectedTopic.id ? { ...t, ...topicFormState } : t
          )
        );
        setSelectedTopic((prev) => prev ? { ...prev, ...topicFormState } : null);
        setTopicDirty(false);
      }
      
      // Save scene changes
      if (sceneDirty) {
        if (scene) {
          await updateScene({
            chapterId,
            versionId: selectedVersionId,
            topicId: selectedTopic.id,
            original: scene,
            updated: sceneFormState,
            userId: user.email,
            language: selectedLanguage, // Pass language for new format
          });
        } else {
          await createScene({
            chapterId,
            versionId: selectedVersionId,
            topicId: selectedTopic.id,
            scene: sceneFormState,
            userId: user.email,
            language: selectedLanguage, // Pass language for new format
          });
        }
        
        setScene((prev) => prev ? { ...prev, ...sceneFormState } as Scene : sceneFormState as Scene);
        setSceneDirty(false);
      }
      
      // Save MCQ changes
      if (mcqDirty) {
        await updateMCQs({
          chapterId,
          versionId: selectedVersionId,
          topicId: selectedTopic.id,
          originalMcqs: mcqs,
          updatedMcqs: mcqFormState,
          userId: user.email,
        });
        
        // Refresh MCQs
        // MCQs are loaded via bundle in loadTopicData
        await loadTopicData(selectedTopic);
        setMcqDirty(false);
      }
      
      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };
  
  // Delete lesson handler (superadmin only)
  const handleDeleteLesson = async () => {
    if (!chapterId || !profile || !canDeleteLesson(profile)) {
      toast.error('Only superadmin can delete lessons');
      return;
    }
    
    setDeletingLesson(true);
    try {
      // Import deleteDoc
      const { deleteDoc } = await import('firebase/firestore');
      
      // Delete the chapter document
      const chapterRef = doc(db, 'curriculum_chapters', chapterId);
      await deleteDoc(chapterRef);
      
      // Also delete all related resources (MCQs, TTS, images, assets, etc.)
      // This is handled by Firestore cascade delete rules or we can do it manually
      // For now, we'll rely on the Firestore rules and manual cleanup if needed
      
      toast.success('Lesson deleted successfully');
      navigate('/studio/content');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Failed to delete lesson');
    } finally {
      setDeletingLesson(false);
      setShowDeleteLessonModal(false);
    }
  };
  
  // Publish handler
  const handlePublish = async () => {
    if (!chapterId || !selectedVersionId || !selectedTopic || !user?.email) {
      toast.error('Missing required data');
      return;
    }
    
    // Validation
    if (!sceneFormState.in3d_prompt) {
      toast.error('in3d_prompt is required for publishing');
      return;
    }
    if (!sceneFormState.skybox_url) {
      toast.error('Skybox is required for publishing');
      return;
    }
    
    setPublishing(true);
    try {
      // Save any pending changes first
      if (topicDirty || sceneDirty || mcqDirty) {
        await handleSave();
      }
      
      const result = await publishScene({
        chapterId,
        versionId: selectedVersionId,
        topicId: selectedTopic.id,
        userId: user.email,
      });
      
      if (result.success) {
        setSceneFormState((prev) => ({ ...prev, status: 'published' }));
        setScene((prev) => prev ? { ...prev, status: 'published' } : null);
        toast.success('Scene published successfully');
      } else {
        toast.error(result.error || 'Failed to publish');
      }
    } catch (error) {
      console.error('Error publishing:', error);
      toast.error('Failed to publish scene');
    } finally {
      setPublishing(false);
    }
  };
  
  // Normalize flattened MCQs
  const handleNormalizeMCQs = async () => {
    if (!chapterId || !selectedVersionId || !selectedTopic || !user?.email) return;
    
    try {
      // Get the topic document with flattened MCQs
      const topicDoc = await fetch(`/chapters/${chapterId}/versions/${selectedVersionId}/topics/${selectedTopic.id}`);
      // For now, we'll just show the button - actual implementation would need the raw topic data
      toast.info('MCQ normalization would convert legacy format to subcollection');
    } catch (error) {
      console.error('Error normalizing MCQs:', error);
      toast.error('Failed to normalize MCQs');
    }
  };
  
  const isDirty = topicDirty || sceneDirty || mcqDirty;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400">Loading chapter...</p>
        </div>
      </div>
    );
  }
  
  if (!chapter) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-semibold text-white">Chapter not found</h2>
          <button
            onClick={() => navigate('/studio/content')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-cyan-400 
                     bg-cyan-500/10 rounded-lg border border-cyan-500/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Content Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back + Chapter Info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/studio/content')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 
                         rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 
                              border border-cyan-500/30">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">
                    Chapter {chapter.chapter_number}: {getChapterNameByLanguage(chapter, selectedLanguage) || chapter.chapter_name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{topics.length} topics</span>
                    {selectedTopic && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-400">{getTopicNameByLanguage(selectedTopic, selectedLanguage) || selectedTopic.topic_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Center: Version Selector and Language Selector */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={selectedVersionId}
                  onChange={(e) => handleVersionChange(e.target.value)}
                  className="appearance-none bg-slate-800/50 border border-slate-600/50 rounded-lg
                           pl-4 pr-10 py-2 text-sm text-white
                           focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version || v.id} {v.status === 'active' ? '(active)' : `(${v.status})`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
              />
              
              {isReadOnly && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                              text-amber-400 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <EyeOff className="w-3.5 h-3.5" />
                  Read Only
                </div>
              )}
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Unsaved changes
                </span>
              )}
              
              <button
                onClick={handleSave}
                disabled={!isDirty || saving || isReadOnly}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                         text-white bg-slate-700 hover:bg-slate-600
                         rounded-lg border border-slate-600
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </button>
              
              <button
                onClick={handlePublish}
                disabled={publishing || isReadOnly || sceneFormState.status === 'published'}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                         text-white bg-gradient-to-r from-cyan-500 to-blue-600
                         hover:from-cyan-400 hover:to-blue-500
                         rounded-lg shadow-lg shadow-cyan-500/25
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Publish
              </button>
              
              {/* Launch Lesson Button */}
              {selectedTopic && chapterId && (
                <LaunchLessonButton
                  chapterId={chapterId}
                  chapterName={chapter.chapter_name}
                  chapterNumber={chapter.chapter_number}
                  curriculum={navState?.curriculumId || chapter.curriculum_id || 'CBSE'}
                  className={navState?.classId || chapter.class_id || '8'}
                  subject={navState?.subjectId || chapter.subject_id || 'Science'}
                  topicId={selectedTopic.id}
                  topicName={selectedTopic.topic_name}
                  topicPriority={selectedTopic.topic_priority}
                  learningObjective={sceneFormState.learning_objective as string}
                  in3dPrompt={sceneFormState.in3d_prompt as string}
                  avatarIntro={sceneFormState.avatar_intro as string}
                  avatarExplanation={sceneFormState.avatar_explanation as string}
                  avatarOutro={sceneFormState.avatar_outro as string}
                  skyboxId={sceneFormState.skybox_id as string}
                  skyboxUrl={sceneFormState.skybox_url as string}
                  assetList={sceneFormState.asset_list as string[]}
                  language={selectedLanguage}
                  size="md"
                />
              )}
              
              {/* Delete Lesson Button (Superadmin only) */}
              {canDeleteLesson(profile) && (
                <button
                  onClick={() => setShowDeleteLessonModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                           text-red-400 bg-red-500/10 hover:bg-red-500/20
                           rounded-lg border border-red-500/30
                           transition-all duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Lesson
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex">
        {/* Left Panel: Topic List */}
        <aside className="w-80 min-h-[calc(100vh-65px)] bg-[#0d1424] border-r border-slate-700/50">
          <TopicList
            topics={topics}
            selectedTopic={selectedTopic}
            onSelectTopic={handleSelectTopic}
            loading={loadingTopic}
          />
        </aside>
        
        {/* Right Panel: Topic Editor */}
        <main className="flex-1 min-h-[calc(100vh-65px)]">
          {selectedTopic ? (
            <TopicEditor
              topic={selectedTopic}
              scene={scene}
              mcqs={mcqs}
              editHistory={editHistory}
              topicFormState={topicFormState}
              sceneFormState={sceneFormState}
              mcqFormState={mcqFormState}
              onTopicChange={handleTopicChange}
              onSceneChange={handleSceneChange}
              onMcqsChange={handleMcqsChange}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isReadOnly={isReadOnly}
              loading={loadingTopic}
              chapterId={chapterId!}
              versionId={selectedVersionId}
              flattenedMcqInfo={flattenedMcqInfo}
              onNormalizeMCQs={handleNormalizeMCQs}
              contentAvailability={contentAvailability}
              selectedLanguage={selectedLanguage}
              language={selectedLanguage}
              bundle={currentBundle}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="p-4 rounded-2xl bg-slate-800/30 mb-4">
                <BookOpen className="w-12 h-12 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Select a Topic
              </h3>
              <p className="text-slate-400 text-center max-w-md">
                Choose a topic from the left panel to start editing.
              </p>
            </div>
          )}
        </main>
      </div>
      
      {/* Delete Lesson Confirmation Modal */}
      {showDeleteLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Delete Entire Lesson?</h3>
              <p className="text-slate-400 mb-2">
                Are you sure you want to delete <strong>"{chapter.chapter_name}"</strong>?
              </p>
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400 flex items-center gap-2 justify-center">
                  <AlertTriangle className="w-4 h-4" />
                  <span>This will <strong>permanently delete</strong> the entire lesson, all topics, MCQs, TTS, assets, and images. This action <strong>cannot be undone</strong>.</span>
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteLessonModal(false)}
                  className="px-6 py-2.5 text-sm font-medium text-slate-400 hover:text-white
                           bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteLesson}
                  disabled={deletingLesson}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium
                           text-white bg-red-600 hover:bg-red-500
                           rounded-lg transition-all disabled:opacity-50"
                >
                  {deletingLesson ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Lesson
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChapterEditor;
