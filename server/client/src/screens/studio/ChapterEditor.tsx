'use client';

import { doc } from 'firebase/firestore';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    EyeOff,
    Loader2,
    Save,
    Send,
    Trash2
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select';
import { LanguageSelector } from '../../Components/LanguageSelector';
import { LaunchLessonButton } from '../../Components/studio/LaunchLessonButton';
import { TopicEditor } from '../../Components/studio/TopicEditor';
import { TopicList } from '../../Components/studio/TopicList';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
    getChapterNameByLanguage,
    getTopicNameByLanguage
} from '../../lib/firebase/utils/languageAvailability';
import {
    checkForFlattenedMCQs,
    EditHistoryEntry,
    getChapterWithDetails,
    getCurrentScene,
    getEditHistory,
    getTopics
} from '../../lib/firestore/queries';
import { publishScene } from '../../lib/firestore/updateHelpers';
import {
    Chapter,
    ChapterVersion,
    LanguageCode,
    MCQ,
    MCQFormState,
    Scene,
    Topic
} from '../../types/curriculum';
import {
  createEditRequest,
  getPendingRequestForChapter,
  getLatestEditRequestForChapter,
} from '../../services/chapterEditRequestService';
import {
  buildSnapshotFromBundle,
  buildDraftSnapshotFromBundle,
  buildChangedTabsFieldsAndDiff,
  createVersionInChapter,
  getChangedSections,
  getLatestVersionFromChapter,
  getVersionsFromChapter,
} from '../../services/lessonVersionService';
import type { LessonVersion } from '../../types/lessonVersion';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../types/firebase';
import { canDeleteLesson, canDeleteContent, canSubmitLessonForApproval } from '../../utils/rbac';
import { useLessonDraftStore, getStoredDraft } from '../../stores/lessonDraftStore';
import { computeDiff, getChangedTabsFromChanges, buildChangeSummary, appendTtsToChangeSummary } from '../../utils/diffEngine';

const ChapterEditor = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // Zustand draft store — single source of truth for lesson edits
  const draftStore = useLessonDraftStore();
  const isDraftDirty = useLessonDraftStore((s) => s.isDirty());

  // Persist draft before leave so Associate can return and continue (and optionally warn)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const store = useLessonDraftStore.getState();
      if (store.isDirty() && user?.uid && store.meta) {
        store.persistToLocalStorage(user.uid);
      }
      if (store.isDirty()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Your progress is saved locally so you can continue later.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user?.uid]);

  // Debounced auto-persist for Associates so Launch lesson / navigation doesn't lose work
  useEffect(() => {
    if (profile?.role !== 'associate' || !user?.uid || !isDraftDirty) return;
    const t = setTimeout(() => {
      const store = useLessonDraftStore.getState();
      if (store.isDirty() && store.meta) store.persistToLocalStorage(user.uid);
    }, 2000);
    return () => clearTimeout(t);
  }, [isDraftDirty, profile?.role, user?.uid]);
  
  // Context from navigation
  const navState = location.state as {
    curriculumId?: string;
    classId?: string;
    subjectId?: string;
    language?: LanguageCode;
    /** When set (e.g. from Lesson Edit Requests), load chapter with this user's draft so Super Admin can view/approve */
    viewDraftForUserId?: string;
  } | null;
  const viewDraftForUserId = navState?.viewDraftForUserId;
  
  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    navState?.language || 'en'
  );
  
  // Chapter data
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [_currentVersion, setCurrentVersion] = useState<ChapterVersion | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  
  // Topics
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  // Scene and MCQs (lazy loaded)
  const [scene, setScene] = useState<Scene | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [lessonVersions, setLessonVersions] = useState<LessonVersion[]>([]);
  const [flattenedMcqInfo, setFlattenedMcqInfo] = useState<{ hasFlattened: boolean; count: number }>({
    hasFlattened: false,
    count: 0,
  });
  
  // Form state for dirty tracking (shared across all tabs — switching Overview/Scene/Avatar/MCQs does NOT reset these; only switching topic or language does, so you can edit multiple tabs and Save draft once)
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
  const [pendingEditRequest, setPendingEditRequest] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [lastRejectionReason, setLastRejectionReason] = useState<string | null>(null);
  
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
          // Admin, superadmin, and associate can always edit. Associate can use all tabs (Overview, Scene, 3D Assets, Images, Avatar, MCQs), Save Draft, Publish, and Submit for approval.
          const canEdit = result.currentVersion.status === 'active' ||
                         (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'associate');
          setIsReadOnly(!canEdit);
        }
        // Associate: check for existing pending edit request and latest rejected reason
        if (profile?.role === 'associate' && user?.uid && chapterId) {
          const [pending, latest] = await Promise.all([
            getPendingRequestForChapter(chapterId, user.uid),
            getLatestEditRequestForChapter(chapterId, user.uid),
          ]);
          setPendingEditRequest(!!pending);
          if (latest?.status === 'rejected' && latest.rejectionReason) {
            setLastRejectionReason(latest.rejectionReason);
          } else {
            setLastRejectionReason(null);
          }
        }
      } catch (error) {
        console.error('Error loading chapter:', error);
        toast.error('Failed to load chapter');
      } finally {
        setLoading(false);
      }
    };
    
    loadChapter();
  }, [chapterId, profile?.role, user?.uid]);
  
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
  const loadContentAvailability = useCallback(async (_topicId: string, bundle: any) => {
    if (!chapterId || !bundle) {
      setContentAvailability(prev => ({ ...prev, loading: false }));
      return;
    }
    
    setContentAvailability(prev => ({ ...prev, loading: true }));
    
    try {
      // Use bundle data exclusively (already language-filtered and complete)
      const mcqsData = (bundle.mcqs || []) as Array<{ options?: unknown }>;
      const ttsData = (bundle.tts || []) as Array<{ audio_url?: string; audioUrl?: string; url?: string }>;
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
      type TtsEntry = { audio_url?: string; audioUrl?: string; url?: string };
      const ttsWithAudio = ttsData.filter((t: TtsEntry) => !!(t.audio_url || t.audioUrl || t.url));
      
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
      // When user is Associate, pass userId + userRole so their draft is overlayed.
      // When Super Admin is viewing a request (viewDraftForUserId), overlay that associate's draft.
      const { getLessonBundle } = await import('../../services/firestore/getLessonBundle');
      const bundleUserId = viewDraftForUserId ?? (profile?.role === 'associate' ? user?.uid : undefined);
      const bundleUserRole = viewDraftForUserId ? 'associate' : (profile?.role === 'associate' ? 'associate' : undefined);
      const bundle = await getLessonBundle({
        chapterId,
        lang: selectedLanguage,
        topicId: topic.id, // Pass specific topic ID
        userId: bundleUserId,
        userRole: bundleUserRole,
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

      // Update topic form state from bundle (includes Associate draft overlay if any)
      const overlayedTopic = bundle.chapter?.topics?.find(
        (t: { topic_id?: string }) => t.topic_id === topic.id || t.topic_id === (topic as { topic_id?: string }).topic_id
      );
      if (overlayedTopic) {
        setTopicFormState((prev) => ({
          ...prev,
          topic_name: overlayedTopic.topic_name ?? prev?.topic_name,
          learning_objective: overlayedTopic.learning_objective ?? prev?.learning_objective,
          topic_priority: overlayedTopic.topic_priority ?? prev?.topic_priority,
          scene_type: overlayedTopic.scene_type ?? prev?.scene_type,
          in3d_prompt: overlayedTopic.in3d_prompt ?? prev?.in3d_prompt,
          camera_guidance: overlayedTopic.camera_guidance ?? prev?.camera_guidance,
          skybox_id: overlayedTopic.skybox_id ?? prev?.skybox_id,
          skybox_url: overlayedTopic.skybox_url ?? prev?.skybox_url,
        }));
      }

      // Load the new standardized snapshot into the Zustand draft store.
      // If Associate has a locally persisted draft for this topic, restore it so their work is preserved.
      try {
        const draftSnapshot = buildDraftSnapshotFromBundle(bundle, topic.id);
        const meta = {
          chapterId,
          topicId: topic.id,
          versionId: selectedVersionId,
          lang: selectedLanguage,
        };
        const isAssociateEditing = profile?.role === 'associate' && user?.uid && !viewDraftForUserId;
        const stored = isAssociateEditing ? getStoredDraft(chapterId, topic.id, user.uid) : null;
        if (stored && stored.meta.chapterId === chapterId && stored.meta.topicId === topic.id) {
          draftStore.loadLessonFromStored(stored);
          // Sync form state from stored snapshot so UI matches
          const o = stored.snapshot.overview;
          const s = stored.snapshot.scene_skybox;
          const a = stored.snapshot.avatar_script;
          setTopicFormState((prev) => ({
            ...prev,
            topic_name: o?.topic_name ?? prev?.topic_name,
            learning_objective: o?.learning_objective ?? prev?.learning_objective,
            topic_priority: o?.topic_priority ?? prev?.topic_priority,
            scene_type: o?.scene_type ?? prev?.scene_type,
          }));
          setSceneFormState((prev) => ({
            ...prev,
            in3d_prompt: s?.in3d_prompt ?? prev?.in3d_prompt,
            camera_guidance: s?.camera_guidance ?? prev?.camera_guidance,
            skybox_id: s?.skybox_id ?? prev?.skybox_id,
            skybox_url: s?.skybox_url ?? prev?.skybox_url,
            avatar_intro: a?.intro ?? prev?.avatar_intro,
            avatar_explanation: a?.explanation ?? prev?.avatar_explanation,
            avatar_outro: a?.outro ?? prev?.avatar_outro,
          }));
          const restoredMcqs = (stored.snapshot.mcqs ?? []).map((m: any) => ({
            id: m.id,
            question: m.question ?? '',
            options: m.options ?? [],
            correct_option_index: m.correct_option_index ?? 0,
            explanation: m.explanation ?? '',
            difficulty: m.difficulty ?? 'medium',
            order: m.order ?? 0,
          }));
          setMcqs(restoredMcqs);
          setMcqFormState(restoredMcqs.map((m) => ({ ...m })));
          console.log('📦 Draft store restored from local storage');
        } else {
          draftStore.loadLesson(draftSnapshot, meta);
          console.log('📦 Draft store loaded with standardized snapshot');
        }
      } catch (storeError) {
        console.warn('Draft store load failed (non-blocking):', storeError);
      }
    } catch (error) {
      console.error('Error loading topic data:', error);
      toast.error('Failed to load topic data');
    } finally {
      setLoadingTopic(false);
    }
  }, [chapterId, selectedVersionId, selectedLanguage, loadContentAvailability, user?.uid, profile?.role, viewDraftForUserId]);
  
  // MCQs are now loaded via the bundle in loadTopicData - no separate function needed
  
  // Load edit history (legacy) and lesson versions when History tab is opened
  const loadHistory = useCallback(async () => {
    if (!chapterId || !selectedTopic?.id) return;
    
    try {
      const [history, versions] = await Promise.all([
        getEditHistory(chapterId, selectedVersionId || '', selectedTopic.id),
        getVersionsFromChapter(chapterId, selectedTopic.id),
      ]);
      setEditHistory(history);
      setLessonVersions(versions);
    } catch (error) {
      console.error('Error loading history:', error);
      setLessonVersions([]);
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
    // Persist current draft to localStorage so Associate can return to this topic and continue (no discard prompt).
    const store = useLessonDraftStore.getState();
    const hadDraft = store.isDirty() || topicDirty || sceneDirty || mcqDirty;
    if (hadDraft && user?.uid && store.meta?.chapterId && store.meta?.topicId) {
      store.persistToLocalStorage(user.uid);
      toast.info('Your progress has been saved locally. You can continue editing when you return to this topic.');
    }

    draftStore.resetStore();
    setSelectedTopic(topic);
    setTopicFormState({ ...topic });
    setMcqs([]);
    setMcqFormState([]);
    setEditHistory([]);
    setLessonVersions([]);
    loadTopicData(topic);
  };
  
  const handleVersionChange = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    setSelectedVersionId(versionId);
    setCurrentVersion(version || null);
    // Admin, superadmin, and associate can always edit (all tabs, Save Draft, Publish, Submit for approval)
    const canEdit = version?.status === 'active' ||
                   (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'associate');
    setIsReadOnly(!canEdit);
    setSelectedTopic(null);
    setScene(null);
    setMcqs([]);
  };
  
  // Form change handlers — update both local state AND Zustand draft store
  const handleTopicChange = (field: keyof Topic, value: unknown) => {
    setTopicFormState((prev) => ({ ...prev, [field]: value }));
    setTopicDirty(true);
    // Also update the draft store (overview tab)
    const { draftSnapshot, updateTabPartial } = useLessonDraftStore.getState();
    if (draftSnapshot) {
      updateTabPartial('overview', { [field]: value } as Partial<typeof draftSnapshot.overview>);
    }
  };
  
  const handleSceneChange = (field: keyof Scene, value: unknown) => {
    setSceneFormState((prev) => ({ ...prev, [field]: value }));
    setSceneDirty(true);
    // Map scene fields to the correct draft store tab
    const { draftSnapshot, updateTabPartial } = useLessonDraftStore.getState();
    if (draftSnapshot) {
      const avatarFields = ['avatar_intro', 'avatar_explanation', 'avatar_outro'];
      if (avatarFields.includes(field as string)) {
        // Avatar script field — map to avatar_script tab
        const avatarKey = (field as string).replace('avatar_', '') as string;
        updateTabPartial('avatar_script', { [avatarKey]: value } as Partial<typeof draftSnapshot.avatar_script>);
      } else {
        // Scene/skybox field — map to scene_skybox tab
        updateTabPartial('scene_skybox', { [field]: value } as Partial<typeof draftSnapshot.scene_skybox>);
      }
    }
  };
  
  const handleMcqsChange = (mcqs: MCQFormState[]) => {
    setMcqFormState(mcqs);
    setMcqDirty(true);
    // Also update the draft store (mcqs tab)
    const { updateTab } = useLessonDraftStore.getState();
    updateTab('mcqs', mcqs.map((m) => ({
      id: m.id,
      question: m.question,
      options: m.options,
      correct_option_index: m.correct_option_index,
      explanation: m.explanation,
      difficulty: m.difficulty,
    })));
  };
  
  // Save handler — writes to curriculum_chapters/{chapterId}/versions ONLY (main doc untouched until Superadmin approves)
  const handleSave = async () => {
    if (!chapterId || !selectedVersionId || !selectedTopic || !user?.email) {
      toast.error('Missing required data');
      return;
    }

    setSaving(true);
    try {
      // Update local state so UI reflects edits (no Firestore write to main collections)
      if (topicDirty) {
        setTopics((prev) =>
          prev.map((t) =>
            t.id === selectedTopic.id ? { ...t, ...topicFormState } : t
          )
        );
        setSelectedTopic((prev) => prev ? { ...prev, ...topicFormState } : null);
        setTopicDirty(false);
      }
      if (sceneDirty) {
        setScene((prev) => (prev ? { ...prev, ...sceneFormState } as Scene : sceneFormState as Scene));
        setSceneDirty(false);
      }
      if (mcqDirty) {
        setMcqs(mcqFormState.filter((m) => !(m as { _isDeleted?: boolean })._isDeleted));
        setMcqDirty(false);
      }

      // Create version in curriculum_chapters/{chapterId}/versions (main doc untouched)
      try {
        const { getLessonBundle } = await import('../../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({
          chapterId,
          lang: selectedLanguage,
          topicId: selectedTopic.id,
          userId: profile?.role === 'associate' ? user?.uid : undefined,
          userRole: profile?.role === 'associate' ? 'associate' : undefined,
        });

        const storeState = useLessonDraftStore.getState();
        const originalSnapshot = storeState.originalSnapshot;
        let newDraftSnapshot = storeState.draftSnapshot ?? buildDraftSnapshotFromBundle(bundle, selectedTopic.id);

        let draftForDiff = newDraftSnapshot;
        if (storeState.pendingDeleteRequests.length > 0) {
          draftForDiff = JSON.parse(JSON.stringify(newDraftSnapshot)) as typeof newDraftSnapshot;
          for (const req of storeState.pendingDeleteRequests) {
            if (req.tab === 'assets3d') {
              draftForDiff.assets3d = (draftForDiff.assets3d || []).filter((a: { id?: string }) => a.id !== req.itemId);
            } else if (req.tab === 'images') {
              draftForDiff.images = (draftForDiff.images || []).filter((i: { id?: string }) => i.id !== req.itemId);
            }
          }
        }

        const isAssociateDelete = profile?.role === 'associate';
        const changes = computeDiff(originalSnapshot, draftForDiff, { isAssociateDelete });
        const changedTabsNew = getChangedTabsFromChanges(changes);
        const baseSummary = changes.length > 0 ? buildChangeSummary(changes) : 'Saved';
        const changeSummaryNew = appendTtsToChangeSummary(baseSummary, originalSnapshot, draftForDiff);

        const newSnapshot = buildSnapshotFromBundle(bundle, selectedTopic.id);
        const prevVersion = await getLatestVersionFromChapter(chapterId, selectedTopic.id);
        const legacyChangedSections =
          changes.length === 0
            ? getChangedSections(prevVersion?.bundleSnapshotJSON ?? null, newSnapshot)
            : [];
        const legacyBuild =
          changes.length === 0
            ? buildChangedTabsFieldsAndDiff(prevVersion?.bundleSnapshotJSON ?? null, newSnapshot)
            : { changed_fields: {} as Record<string, string[]>, diff: {} as Record<string, { old: string; new: string }> };

        await createVersionInChapter({
          chapterId,
          topicId: selectedTopic.id,
          createdBy: user.uid,
          createdByEmail: user.email ?? undefined,
          createdByRole: profile?.role,
          changeSummary: changeSummaryNew,
          draftSnapshot: draftForDiff,
          changed_tabs: changedTabsNew,
          changes,
          edited_by: { uid: user.uid, email: user.email ?? undefined, role: profile?.role },
          bundleSnapshot: newSnapshot,
          parentVersionId: prevVersion?.id ?? null,
          changedSections: legacyChangedSections,
          changed_fields: legacyBuild.changed_fields,
          diff: legacyBuild.diff,
        });

        // Sync store to the snapshot we persisted (with pending deletes applied) so next diff is correct
        const meta = useLessonDraftStore.getState().meta;
        if (meta) {
          useLessonDraftStore.getState().loadLesson(draftForDiff, meta);
        } else {
          draftStore.commitDraft();
        }
        if (user?.uid) draftStore.clearLocalDraftForCurrent(user.uid);

        const versions = await getVersionsFromChapter(chapterId, selectedTopic.id);
        setLessonVersions(versions);
      } catch (versionError) {
        console.warn('Version creation failed:', versionError);
        toast.error('Failed to save version');
        return;
      }

      toast.success('Draft saved. Your changes are stored and will remain for approval.');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };
  
  // Submit for approval (Associate only). Saves any unsaved changes first, then creates the request.
  const handleSubmitForApproval = async () => {
    if (!chapterId || !user?.uid || !chapter) return;
    if (pendingEditRequest) {
      toast.info('You already have a pending approval request for this chapter.');
      return;
    }
    setSubmittingForApproval(true);
    try {
      if (topicDirty || sceneDirty || mcqDirty) {
        await handleSave();
      }
      await createEditRequest({
        chapterId,
        requestedBy: user.uid,
        requestedByEmail: user.email ?? undefined,
        chapterName: getChapterNameByLanguage(chapter as unknown as CurriculumChapter, selectedLanguage) || chapter.chapter_name,
        chapterNumber: chapter.chapter_number,
      });
      setPendingEditRequest(true);
      toast.success('Submitted for approval. An Admin will review your changes.');
    } catch (error: unknown) {
      console.error('Error submitting for approval:', error);
      const msg = error && typeof (error as any).message === 'string' ? (error as any).message : '';
      const isPermission = /permission|insufficient|denied/i.test(msg);
      if (isPermission || /ERR_BLOCKED_BY_CLIENT|network/i.test(msg)) {
        toast.error(
          'Request blocked or denied. Try disabling ad blockers or privacy extensions for this site, or use an incognito window. Then retry.'
        );
      } else {
        toast.error('Failed to submit for approval');
      }
    } finally {
      setSubmittingForApproval(false);
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
      await fetch(`/chapters/${chapterId}/versions/${selectedVersionId}/topics/${selectedTopic.id}`);
      // For now, we'll just show the button - actual implementation would need the raw topic data
      toast.info('MCQ normalization would convert legacy format to subcollection');
    } catch (error) {
      console.error('Error normalizing MCQs:', error);
      toast.error('Failed to normalize MCQs');
    }
  };
  
  const isDirty = topicDirty || sceneDirty || mcqDirty;
  const viewOnlyDraft = !!viewDraftForUserId;
  const effectiveReadOnly = isReadOnly || viewOnlyDraft;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading chapter...</p>
        </div>
      </div>
    );
  }
  
  if (!chapter) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">Chapter not found</h2>
          <Button variant="outline" onClick={() => navigate('/studio/content')}>
            <ArrowLeft className="w-4 h-4" />
            Back to Content Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {viewDraftForUserId && (
        <div className="bg-primary/15 border-b border-primary/30 px-6 py-2 text-sm text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Viewing Associate&apos;s draft for approval.</strong> Content below reflects their suggested changes. Use Lesson Edit Requests to Approve or Reject.
          </span>
        </div>
      )}
      {lastRejectionReason && profile?.role === 'associate' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-3 text-sm text-foreground flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-800 dark:text-amber-200">Your last edit request was rejected</p>
            <p className="mt-1 text-muted-foreground">{lastRejectionReason}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLastRejectionReason(null)} className="shrink-0 text-amber-700 dark:text-amber-300">
            Dismiss
          </Button>
        </div>
      )}
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back + Chapter Info */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/studio/content')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/30">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    Chapter {chapter.chapter_number}: {getChapterNameByLanguage(chapter as unknown as CurriculumChapter, selectedLanguage) || chapter.chapter_name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{topics.length} topics</span>
                    {selectedTopic && (
                      <>
                        <span>•</span>
                        <span className="text-primary">{getTopicNameByLanguage(selectedTopic as unknown as FirebaseTopic, selectedLanguage) || selectedTopic.topic_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Center: Version Selector and Language Selector */}
            <div className="flex items-center gap-3">
              <Select value={selectedVersionId} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.version || v.id} {v.status === 'active' ? '(active)' : `(${v.status})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <LanguageSelector
                value={selectedLanguage}
                onChange={setSelectedLanguage}
              />
              
              {(effectiveReadOnly) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <EyeOff className="w-3.5 h-3.5" />
                  Read Only
                </div>
              )}
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
              )}
              
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={!isDirty || saving || effectiveReadOnly}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </Button>
              
              <Button
                onClick={handlePublish}
                disabled={publishing || effectiveReadOnly || sceneFormState.status === 'published'}
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Publish
              </Button>
              
              {/* Associate: Submit for approval (saves unsaved changes automatically if any) */}
              {canSubmitLessonForApproval(profile) && (
                <Button
                  variant="outline"
                  onClick={handleSubmitForApproval}
                  disabled={submittingForApproval || pendingEditRequest}
                  title={pendingEditRequest ? 'Request already pending' : 'Save and send your changes to Admin for approval'}
                >
                  {submittingForApproval ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {pendingEditRequest ? 'Pending approval' : 'Submit for approval'}
                </Button>
              )}
              
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
                  topicName={(topicFormState.topic_name ?? selectedTopic.topic_name) ?? ''}
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
              {/* Launch krpano – opens lesson in krpano 360° player */}
              {selectedTopic && chapterId && (
                <LaunchLessonButton
                  chapterId={chapterId}
                  chapterName={chapter.chapter_name}
                  chapterNumber={chapter.chapter_number}
                  curriculum={navState?.curriculumId || chapter.curriculum_id || 'CBSE'}
                  className={navState?.classId || chapter.class_id || '8'}
                  subject={navState?.subjectId || chapter.subject_id || 'Science'}
                  topicId={selectedTopic.id}
                  topicName={(topicFormState.topic_name ?? selectedTopic.topic_name) ?? ''}
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
                  launchTarget="vrlessonplayer-krpano"
                  label="Launch krpano"
                />
              )}
              
              {/* Delete Lesson Button (Superadmin only) */}
              {canDeleteLesson(profile) && (
                <Button variant="destructive" onClick={() => setShowDeleteLessonModal(true)}>
                  <Trash2 className="w-4 h-4" />
                  Delete Lesson
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex">
        {/* Left Panel: Topic List */}
        <aside className="w-80 min-h-[calc(100vh-65px)] bg-card border-r border-border">
          <TopicList
            topics={topics}
            selectedTopic={selectedTopic}
            onSelectTopic={handleSelectTopic}
            loading={loadingTopic}
            chapterId={chapterId!}
            onApprovalChange={() => {
              // Reload topics after approval change
              if (chapterId && selectedVersionId) {
                getTopics(chapterId, selectedVersionId).then(setTopics).catch(console.error);
              }
            }}
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
              lessonVersions={lessonVersions}
              topicFormState={topicFormState}
              sceneFormState={sceneFormState}
              mcqFormState={mcqFormState}
              onTopicChange={handleTopicChange}
              onSceneChange={handleSceneChange}
              onMcqsChange={handleMcqsChange}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isReadOnly={effectiveReadOnly}
              loading={loadingTopic}
              chapterId={chapterId!}
              versionId={selectedVersionId}
              flattenedMcqInfo={flattenedMcqInfo}
              onNormalizeMCQs={handleNormalizeMCQs}
              contentAvailability={contentAvailability}
              language={selectedLanguage}
              bundle={currentBundle}
              learningObjective={sceneFormState?.learning_objective as string | undefined}
              subject={navState?.subjectId ?? (chapter as any)?.subject_id}
              classLevel={navState?.classId ?? (chapter as any)?.class_id}
              curriculum={navState?.curriculumId ?? (chapter as any)?.curriculum_id}
              canDeleteContent={canDeleteContent(profile)}
              userId={profile?.role === 'associate' ? user?.uid : undefined}
              userRole={profile?.role === 'associate' ? 'associate' : undefined}
            />
          ) : (
            <Card className="m-6 flex flex-col items-center justify-center py-20">
              <CardContent className="flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-muted mb-4">
                  <BookOpen className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Select a Topic
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Choose a topic from the left panel to start editing.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
      
      {/* Delete Lesson Confirmation Modal */}
      <Dialog open={showDeleteLessonModal} onOpenChange={setShowDeleteLessonModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete Entire Lesson?</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to delete <strong>"{chapter.chapter_name}"</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive flex items-center gap-2 justify-center">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>This will <strong>permanently delete</strong> the entire lesson, all topics, MCQs, TTS, assets, and images. This action <strong>cannot be undone</strong>.</span>
            </p>
          </div>
          <DialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <Button variant="outline" onClick={() => setShowDeleteLessonModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLesson} disabled={deletingLesson}>
              {deletingLesson ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChapterEditor;
