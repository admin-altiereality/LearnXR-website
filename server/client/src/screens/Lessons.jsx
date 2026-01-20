/**
 * Lessons Page - Browse and launch VR lessons
 * 
 * Features:
 * - Grid and List view modes
 * - Lesson detail modal with background data fetching
 * - Launch button enabled only when data is ready
 * - Clean, professional UX transitions
 */

import { collection, onSnapshot, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db } from '../config/firebase';
import { useLesson } from '../contexts/LessonContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookOpen, 
  Play, 
  GraduationCap, 
  ChevronDown,
  Grid3X3, 
  List, 
  Search,
  Sparkles,
  HelpCircle,
  Volume2,
  Box,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Target,
  CheckCircle,
  Mic,
  Trophy,
  Star,
  Glasses,
  Monitor
} from 'lucide-react';
import { getVRCapabilities, getVRRecommendation } from '../utils/vrDetection';

const Lessons = ({ setBackgroundSkybox }) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Lesson Detail Modal State
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [lessonData, setLessonData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [dataReady, setDataReady] = useState(false);
  
  // Completed lessons tracking
  const [completedLessons, setCompletedLessons] = useState({});
  
  // VR capabilities
  const [vrCapabilities, setVRCapabilities] = useState(null);
  const [vrChecking, setVRChecking] = useState(true);
  
  // Filter states
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // Expanded topics state
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  
  const navigate = useNavigate();
  
  // Use LessonContext to properly start the lesson
  const { startLesson: contextStartLesson } = useLesson();
  
  // Get current user for tracking completed lessons
  const { user } = useAuth();

  // Check VR capabilities on mount
  useEffect(() => {
    const checkVR = async () => {
      try {
        const capabilities = await getVRCapabilities();
        setVRCapabilities(capabilities);
        console.log('🥽 VR Capabilities:', capabilities);
      } catch (err) {
        console.warn('Failed to check VR capabilities:', err);
      } finally {
        setVRChecking(false);
      }
    };
    checkVR();
  }, []);

  // Fetch chapters from Firestore (basic list - no heavy data fetching)
  useEffect(() => {
    setLoading(true);
    
    if (!db) {
      setError('Database not initialized. Please refresh the page.');
      setLoading(false);
      return;
    }
    
    const constraints = [];
    if (selectedCurriculum) {
      constraints.push(where('curriculum', '==', selectedCurriculum.toUpperCase()));
    }
    if (selectedClass) {
      constraints.push(where('class', '==', parseInt(selectedClass)));
    }
    if (selectedSubject) {
      constraints.push(where('subject', '==', selectedSubject));
    }
    
    const chaptersRef = collection(db, 'curriculum_chapters');
    const chaptersQuery = constraints.length > 0 
      ? query(chaptersRef, ...constraints)
      : query(chaptersRef);
    
    const unsubscribe = onSnapshot(
      chaptersQuery,
      (snapshot) => {
        try {
          const chaptersData = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              topicCount: data.topics?.length || 0,
              // Basic content indicators (no deep validation)
              hasSkybox: data.topics?.some(t => t.skybox_url || t.skybox_id),
              hasScript: data.topics?.some(t => t.topic_avatar_intro || t.topic_avatar_explanation),
              hasAssets: data.meshy_asset_ids?.length > 0 || !!data.image3dasset?.imageasset_url,
              hasMcqs: data.mcq_ids?.length > 0,
            };
          });
          
          // Sort
          chaptersData.sort((a, b) => {
            if (a.curriculum !== b.curriculum) return (a.curriculum || '').localeCompare(b.curriculum || '');
            if (a.class !== b.class) return (a.class || 0) - (b.class || 0);
            if (a.subject !== b.subject) return (a.subject || '').localeCompare(b.subject || '');
            return (a.chapter_number || 0) - (b.chapter_number || 0);
          });
          
          setChapters(chaptersData);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error("Lessons Error:", err);
          setError("Error loading lessons: " + err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error("Firestore error:", err);
        setError(`Failed to load lessons: ${err.message}`);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [selectedCurriculum, selectedClass, selectedSubject]);

  // Fetch user's completed lessons
  useEffect(() => {
    if (!user?.uid || !db) return;
    
    const fetchCompletedLessons = async () => {
      try {
        const progressRef = collection(db, 'user_lesson_progress');
        const q = query(progressRef, where('userId', '==', user.uid), where('completed', '==', true));
        const snapshot = await getDocs(q);
        
        const completed = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.chapterId) {
            completed[data.chapterId] = {
              completed: true,
              quizCompleted: data.quizCompleted || false,
              quizScore: data.quizScore || null,
              completedAt: data.completedAt,
            };
          }
        });
        
        setCompletedLessons(completed);
        console.log('📚 Loaded completed lessons:', Object.keys(completed).length);
      } catch (err) {
        console.warn('Failed to fetch completed lessons:', err);
      }
    };
    
    fetchCompletedLessons();
    
    // Also subscribe to real-time updates
    const progressRef = collection(db, 'user_lesson_progress');
    const q = query(progressRef, where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const completed = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.chapterId && data.completed) {
          completed[data.chapterId] = {
            completed: true,
            quizCompleted: data.quizCompleted || false,
            quizScore: data.quizScore || null,
            completedAt: data.completedAt,
          };
        }
      });
      setCompletedLessons(completed);
    }, (err) => {
      console.warn('Realtime progress subscription error:', err);
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  // Filter options
  const availableCurricula = useMemo(() => {
    const unique = [...new Set(chapters.map(c => c.curriculum).filter(Boolean))];
    return unique.sort();
  }, [chapters]);

  const availableClasses = useMemo(() => {
    if (!selectedCurriculum) return [];
    const filtered = chapters.filter(c => c.curriculum === selectedCurriculum);
    const unique = [...new Set(filtered.map(c => c.class).filter(Boolean))];
    return unique.sort((a, b) => a - b);
  }, [chapters, selectedCurriculum]);

  const availableSubjects = useMemo(() => {
    if (!selectedCurriculum || !selectedClass) return [];
    const filtered = chapters.filter(
      c => c.curriculum === selectedCurriculum && c.class === parseInt(selectedClass)
    );
    const unique = [...new Set(filtered.map(c => c.subject).filter(Boolean))];
    return unique.sort();
  }, [chapters, selectedCurriculum, selectedClass]);

  // Search/filter
  const filteredChapters = useMemo(() => {
    let result = chapters;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(chapter => 
        chapter.chapter_name?.toLowerCase().includes(q) ||
        chapter.subject?.toLowerCase().includes(q) ||
        chapter.topics?.some(t => t.topic_name?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [chapters, searchQuery]);

  const toggleChapter = useCallback((chapterId) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  }, []);

  // Close lesson modal
  const closeLessonModal = useCallback(() => {
    setSelectedLesson(null);
    setLessonData(null);
    setDataLoading(false);
    setDataError(null);
    setDataReady(false);
  }, []);

  // Fetch lesson data in background (defined before openLessonModal)
  const fetchLessonData = useCallback(async (chapter, topicInput) => {
    try {
      const chapterRef = doc(db, 'curriculum_chapters', chapter.id);
      const chapterSnap = await getDoc(chapterRef);
      
      if (!chapterSnap.exists()) {
        throw new Error('Lesson not found in database');
      }
      
      const fullData = chapterSnap.data();
      
      // Find the best topic
      const topic = topicInput 
        ? fullData.topics?.find(t => t.topic_id === topicInput.topic_id) || topicInput
        : fullData.topics?.find(t => t.skybox_url || t.topic_avatar_intro || t.topic_avatar_explanation) 
          || fullData.topics?.[0];
      
      if (!topic) {
        throw new Error('No content available for this lesson');
      }

      // Build asset URLs
      let assetUrls = topic.asset_urls || [];
      let assetIds = topic.asset_ids || [];
      
      // Include image3dasset if available
      if (fullData.image3dasset?.imageasset_url || fullData.image3dasset?.imagemodel_glb) {
        const img3d = fullData.image3dasset;
        const primaryUrl = img3d.imagemodel_glb || img3d.imageasset_url;
        if (primaryUrl && !assetUrls.includes(primaryUrl)) {
          assetUrls = [primaryUrl, ...assetUrls];
          assetIds = [img3d.imageasset_id || 'image3d_asset', ...assetIds];
        }
      }

      // Build lesson data
      const preparedData = {
        chapter: {
          chapter_id: chapter.id,
          chapter_name: fullData.chapter_name || chapter.chapter_name,
          chapter_number: fullData.chapter_number || chapter.chapter_number,
          curriculum: fullData.curriculum || chapter.curriculum,
          class_name: `Class ${fullData.class || chapter.class}`,
          subject: fullData.subject || chapter.subject,
          mcq_ids: fullData.mcq_ids || [],
          tts_ids: fullData.tts_ids || [],
          meshy_asset_ids: fullData.meshy_asset_ids || [],
          image_ids: fullData.image_ids || [],
        },
        topic: {
          topic_id: topic.topic_id || `topic_${chapter.id}_1`,
          topic_name: topic.topic_name || fullData.chapter_name,
          topic_priority: topic.topic_priority || 1,
          learning_objective: topic.learning_objective || '',
          in3d_prompt: topic.in3d_prompt || '',
          scene_type: topic.scene_type || 'narrative',
          status: topic.status || 'generated',
          skybox_id: topic.skybox_id || null,
          skybox_url: topic.skybox_url || '',
          skybox_remix_id: topic.skybox_remix_id || null,
          avatar_intro: topic.topic_avatar_intro || topic.avatar_intro || '',
          avatar_explanation: topic.topic_avatar_explanation || topic.avatar_explanation || '',
          avatar_outro: topic.topic_avatar_outro || topic.avatar_outro || '',
          asset_list: topic.asset_list || [],
          asset_urls: assetUrls,
          asset_ids: assetIds,
          mcq_ids: topic.mcq_ids || [],
          tts_ids: topic.tts_ids || [],
          meshy_asset_ids: topic.meshy_asset_ids || [],
          mcqs: [],
        },
        image3dasset: fullData.image3dasset || null,
        startedAt: new Date().toISOString(),
        // Extra metadata for the modal
        _meta: {
          hasSkybox: !!topic.skybox_url,
          hasScript: !!(topic.topic_avatar_intro || topic.topic_avatar_explanation),
          hasAssets: assetUrls.length > 0 || !!fullData.image3dasset,
          hasMcqs: (fullData.mcq_ids?.length || 0) > 0 || (topic.mcq_ids?.length || 0) > 0,
          topicCount: fullData.topics?.length || 1,
          scriptSections: [
            topic.topic_avatar_intro || topic.avatar_intro,
            topic.topic_avatar_explanation || topic.avatar_explanation,
            topic.topic_avatar_outro || topic.avatar_outro,
          ].filter(Boolean).length,
        }
      };

      // Validate essential content
      if (!preparedData._meta.hasSkybox && !preparedData._meta.hasScript) {
        throw new Error('This lesson has no content yet (no skybox or script available)');
      }

      setLessonData(preparedData);
      setDataReady(true);
      setDataLoading(false);
      
    } catch (err) {
      console.error('Failed to fetch lesson data:', err);
      setDataError(err.message);
      setDataLoading(false);
    }
  }, []);

  // Open lesson detail modal and start fetching data
  const openLessonModal = useCallback((chapter, topicInput) => {
    setSelectedLesson({ chapter, topicInput });
    setLessonData(null);
    setDataLoading(true);
    setDataError(null);
    setDataReady(false);
    
    // Start fetching data in background
    fetchLessonData(chapter, topicInput);
  }, [fetchLessonData]);

  // Comprehensive validation function
  const validateLessonData = useCallback((data) => {
    const errors = [];
    
    // Check chapter data
    if (!data?.chapter) {
      errors.push('Missing chapter data');
    } else {
      if (!data.chapter.chapter_id) errors.push('Missing chapter_id');
      if (!data.chapter.chapter_name) errors.push('Missing chapter_name');
    }
    
    // Check topic data
    if (!data?.topic) {
      errors.push('Missing topic data');
    } else {
      if (!data.topic.topic_id) errors.push('Missing topic_id');
      if (!data.topic.topic_name) errors.push('Missing topic_name');
    }
    
    // Check for at least some content
    const hasContent = data?.topic && (
      data.topic.skybox_url ||
      data.topic.avatar_intro ||
      data.topic.avatar_explanation ||
      data.topic.avatar_outro
    );
    
    if (!hasContent) {
      errors.push('Lesson has no playable content (no skybox or narration)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  // Launch the lesson (after data is ready) - with comprehensive checks
  const launchLesson = useCallback(async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 [Lessons] LAUNCH LESSON INITIATED');
    console.log('═══════════════════════════════════════════════════════');
    
    // STEP 0: Check if we have lesson data
    if (!lessonData) {
      console.error('❌ [Step 0] No lesson data available');
      setDataError('No lesson data available. Please try again.');
      return;
    }
    console.log('✅ [Step 0] Lesson data exists');
    
    // STEP 1: Validate the data structure
    console.log('📋 [Step 1] Validating lesson data structure...');
    try {
      const validation = validateLessonData(lessonData);
      
      if (!validation.isValid) {
        console.error('❌ [Step 1] Validation failed:', validation.errors);
        setDataError(`Lesson data validation failed: ${validation.errors.join(', ')}`);
        return;
      }
      console.log('✅ [Step 1] Validation passed');
    } catch (validationErr) {
      console.error('❌ [Step 1] Validation threw error:', validationErr);
      setDataError('Error validating lesson data');
      return;
    }
    
    // STEP 2: Prepare clean lesson data
    console.log('🧹 [Step 2] Preparing clean lesson data...');
    let cleanChapter, cleanTopic, fullLessonData;
    
    try {
      cleanChapter = {
        chapter_id: String(lessonData.chapter?.chapter_id ?? ''),
        chapter_name: String(lessonData.chapter?.chapter_name ?? 'Untitled Chapter'),
        chapter_number: Number(lessonData.chapter?.chapter_number) || 1,
        curriculum: String(lessonData.chapter?.curriculum ?? 'Unknown'),
        class_name: String(lessonData.chapter?.class_name ?? 'Unknown'),
        subject: String(lessonData.chapter?.subject ?? 'Unknown'),
      };
      
      cleanTopic = {
        topic_id: String(lessonData.topic?.topic_id ?? ''),
        topic_name: String(lessonData.topic?.topic_name ?? 'Untitled Topic'),
        topic_priority: Number(lessonData.topic?.topic_priority) || 1,
        learning_objective: String(lessonData.topic?.learning_objective ?? ''),
        in3d_prompt: String(lessonData.topic?.in3d_prompt ?? ''),
        skybox_id: lessonData.topic?.skybox_id ?? null,
        skybox_url: String(lessonData.topic?.skybox_url ?? ''),
        avatar_intro: String(lessonData.topic?.avatar_intro ?? ''),
        avatar_explanation: String(lessonData.topic?.avatar_explanation ?? ''),
        avatar_outro: String(lessonData.topic?.avatar_outro ?? ''),
        asset_list: Array.isArray(lessonData.topic?.asset_list) ? [...lessonData.topic.asset_list] : [],
        asset_urls: Array.isArray(lessonData.topic?.asset_urls) ? [...lessonData.topic.asset_urls] : [],
        asset_ids: Array.isArray(lessonData.topic?.asset_ids) ? [...lessonData.topic.asset_ids] : [],
        mcq_ids: Array.isArray(lessonData.topic?.mcq_ids) ? [...lessonData.topic.mcq_ids] : [],
        tts_ids: Array.isArray(lessonData.topic?.tts_ids) ? [...lessonData.topic.tts_ids] : [],
        mcqs: Array.isArray(lessonData.topic?.mcqs) ? [...lessonData.topic.mcqs] : [],
      };
      
      fullLessonData = {
        chapter: cleanChapter,
        topic: cleanTopic,
        image3dasset: lessonData.image3dasset ?? null,
        startedAt: lessonData.startedAt ?? new Date().toISOString(),
        launchedAt: new Date().toISOString(),
        _meta: lessonData._meta ?? null,
      };
      
      console.log('✅ [Step 2] Clean data prepared:', {
        chapterId: cleanChapter.chapter_id,
        topicId: cleanTopic.topic_id,
        hasSkybox: !!cleanTopic.skybox_url,
        hasNarration: !!(cleanTopic.avatar_intro || cleanTopic.avatar_explanation),
      });
    } catch (prepErr) {
      console.error('❌ [Step 2] Error preparing data:', prepErr);
      setDataError('Error preparing lesson data');
      return;
    }
    
    // STEP 3: Save to sessionStorage FIRST
    console.log('💾 [Step 3] Saving to sessionStorage...');
    try {
      const jsonString = JSON.stringify(fullLessonData);
      sessionStorage.setItem('activeLesson', jsonString);
      
      // Verify it was saved correctly
      const verified = sessionStorage.getItem('activeLesson');
      if (!verified) {
        throw new Error('SessionStorage verification failed');
      }
      console.log('✅ [Step 3] SessionStorage saved and verified');
    } catch (storageErr) {
      console.error('⚠️ [Step 3] SessionStorage error (continuing anyway):', storageErr);
    }
    
    // STEP 4: Update LessonContext
    console.log('🔄 [Step 4] Updating LessonContext...');
    try {
      // Check if context function exists
      if (typeof contextStartLesson !== 'function') {
        throw new Error('contextStartLesson is not a function');
      }
      
      contextStartLesson(cleanChapter, cleanTopic);
      console.log('✅ [Step 4] LessonContext updated');
    } catch (contextErr) {
      console.error('❌ [Step 4] Context update error:', contextErr);
      // Don't fail here - sessionStorage has the data
      console.log('⚠️ [Step 4] Continuing with sessionStorage fallback...');
    }
    
    // STEP 5: Close modal
    console.log('🚪 [Step 5] Closing modal...');
    try {
      closeLessonModal();
      console.log('✅ [Step 5] Modal closed');
    } catch (modalErr) {
      console.error('⚠️ [Step 5] Modal close error:', modalErr);
    }
    
    // STEP 6: Navigate with delay
    console.log('🧭 [Step 6] Preparing navigation...');
    console.log('═══════════════════════════════════════════════════════');
    
    // Use longer delay and wrap in try-catch
    setTimeout(() => {
      try {
        console.log('🚀 [Step 6] Navigating to /vrlessonplayer NOW');
        navigate('/vrlessonplayer');
      } catch (navErr) {
        console.error('❌ [Step 6] Navigation error:', navErr);
        // Fallback: use window.location
        window.location.href = '/vrlessonplayer';
      }
    }, 200);
    
  }, [lessonData, navigate, closeLessonModal, contextStartLesson, validateLessonData]);
  
  // Launch lesson in VR mode (opens /xrlessonplayer)
  const launchVRLesson = useCallback(async () => {
    console.log('🥽 [Lessons] LAUNCH VR LESSON');
    
    if (!lessonData) {
      console.error('❌ No lesson data for VR launch');
      setDataError('No lesson data available');
      return;
    }
    
    // Validate data first
    const validation = validateLessonData(lessonData);
    if (!validation.isValid) {
      console.error('❌ Validation failed for VR:', validation.errors);
      setDataError(`Lesson not ready: ${validation.errors.join(', ')}`);
      return;
    }
    
    // Prepare and save to sessionStorage
    try {
      const cleanChapter = {
        chapter_id: String(lessonData.chapter?.chapter_id ?? ''),
        chapter_name: String(lessonData.chapter?.chapter_name ?? 'Untitled Chapter'),
        chapter_number: Number(lessonData.chapter?.chapter_number) || 1,
        curriculum: String(lessonData.chapter?.curriculum ?? 'Unknown'),
        class_name: String(lessonData.chapter?.class_name ?? 'Unknown'),
        subject: String(lessonData.chapter?.subject ?? 'Unknown'),
      };
      
      const cleanTopic = {
        topic_id: String(lessonData.topic?.topic_id ?? ''),
        topic_name: String(lessonData.topic?.topic_name ?? 'Untitled Topic'),
        topic_priority: Number(lessonData.topic?.topic_priority) || 1,
        learning_objective: String(lessonData.topic?.learning_objective ?? ''),
        skybox_url: String(lessonData.topic?.skybox_url ?? ''),
        avatar_intro: String(lessonData.topic?.avatar_intro ?? ''),
        avatar_explanation: String(lessonData.topic?.avatar_explanation ?? ''),
        avatar_outro: String(lessonData.topic?.avatar_outro ?? ''),
        asset_urls: Array.isArray(lessonData.topic?.asset_urls) ? [...lessonData.topic.asset_urls] : [],
      };
      
      const fullLessonData = {
        chapter: cleanChapter,
        topic: cleanTopic,
        image3dasset: lessonData.image3dasset ?? null,
        startedAt: new Date().toISOString(),
        _meta: lessonData._meta ?? null,
      };
      
      sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
      console.log('✅ Saved lesson for VR');
      
      // Close modal
      closeLessonModal();
      
      // Navigate to XR lesson player with query params
      const params = new URLSearchParams({
        lessonId: cleanChapter.chapter_id,
        topicId: cleanTopic.topic_id,
      });
      
      setTimeout(() => {
        navigate(`/xrlessonplayer?${params.toString()}`);
      }, 100);
      
    } catch (err) {
      console.error('❌ Failed to prepare VR lesson:', err);
      setDataError('Failed to prepare VR lesson');
    }
  }, [lessonData, navigate, closeLessonModal, validateLessonData]);
  
  // Check if launch is safe
  const canLaunchLesson = useMemo(() => {
    if (!dataReady || dataError || !lessonData) return false;
    const validation = validateLessonData(lessonData);
    return validation.isValid;
  }, [dataReady, dataError, lessonData, validateLessonData]);

  // Get thumbnail
  const getThumbnail = (chapter) => {
    return chapter.topics?.find(t => t.skybox_url)?.skybox_url || null;
  };

  // Content indicators (simple badges)
  const ContentBadges = ({ chapter }) => (
    <div className="flex items-center gap-1.5">
      {chapter.hasSkybox && (
        <div className="w-6 h-6 rounded bg-purple-500/20 border border-purple-500/30 flex items-center justify-center" title="360° Skybox">
          <Sparkles className="w-3 h-3 text-purple-400" />
        </div>
      )}
      {chapter.hasScript && (
        <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center" title="Voice Script">
          <Volume2 className="w-3 h-3 text-emerald-400" />
        </div>
      )}
      {chapter.hasAssets && (
        <div className="w-6 h-6 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center" title="3D Assets">
          <Box className="w-3 h-3 text-blue-400" />
        </div>
      )}
      {chapter.hasMcqs && (
        <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center" title="Quiz Questions">
          <HelpCircle className="w-3 h-3 text-amber-400" />
        </div>
      )}
    </div>
  );

  // Lesson Detail Modal - Shows lesson info while loading data
  const LessonDetailModal = () => {
    if (!selectedLesson) return null;
    
    const { chapter, topicInput } = selectedLesson;
    const thumbnail = chapter.topics?.find(t => t.skybox_url)?.skybox_url;
    const topicName = topicInput?.topic_name || chapter.topics?.[0]?.topic_name || chapter.chapter_name;
    const learningObjective = topicInput?.learning_objective || chapter.topics?.[0]?.learning_objective || '';
    const isCompleted = completedLessons[chapter.id];
    const quizScore = isCompleted?.quizScore;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={closeLessonModal}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 
                     rounded-3xl border shadow-2xl overflow-hidden ${
                       isCompleted ? 'border-emerald-500/40' : 'border-slate-700/50'
                     }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={closeLessonModal}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white/70 
                     hover:bg-black/70 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header with Thumbnail */}
          <div className="relative h-48 overflow-hidden">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={chapter.chapter_name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-cyan-900/50 to-purple-900/50 flex items-center justify-center">
                <GraduationCap className="w-16 h-16 text-cyan-400/50" />
              </div>
            )}
            
            {/* Completed Overlay */}
            {isCompleted && (
              <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
            )}
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
            
            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {isCompleted && (
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/90 text-white backdrop-blur-sm">
                  <Trophy className="w-3.5 h-3.5" />
                  {quizScore ? `${quizScore.percentage}% Score` : 'Completed'}
                </span>
              )}
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm">
                {chapter.curriculum}
              </span>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 backdrop-blur-sm">
                Class {chapter.class}
              </span>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
                Chapter {chapter.chapter_number}
              </span>
            </div>

            {/* Title - Positioned at bottom */}
            <div className="absolute bottom-4 left-6 right-6">
              <p className={`text-sm font-medium mb-1 ${isCompleted ? 'text-emerald-400' : 'text-cyan-400'}`}>{chapter.subject}</p>
              <h2 className="text-2xl font-bold text-white leading-tight">{topicName}</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Learning Objective */}
            {learningObjective && (
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Learning Objective</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{learningObjective}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Content Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className={`p-3 rounded-xl border ${
                lessonData?._meta?.hasSkybox || chapter.hasSkybox 
                  ? 'bg-purple-500/10 border-purple-500/30' 
                  : 'bg-slate-800/30 border-slate-700/30'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className={`w-4 h-4 ${
                    lessonData?._meta?.hasSkybox || chapter.hasSkybox ? 'text-purple-400' : 'text-slate-500'
                  }`} />
                  <span className="text-xs font-medium text-slate-400">360° View</span>
                </div>
                <p className={`text-sm font-semibold ${
                  lessonData?._meta?.hasSkybox || chapter.hasSkybox ? 'text-purple-300' : 'text-slate-500'
                }`}>
                  {lessonData?._meta?.hasSkybox || chapter.hasSkybox ? 'Available' : 'Not set'}
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                lessonData?._meta?.hasScript || chapter.hasScript 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-slate-800/30 border-slate-700/30'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Mic className={`w-4 h-4 ${
                    lessonData?._meta?.hasScript || chapter.hasScript ? 'text-emerald-400' : 'text-slate-500'
                  }`} />
                  <span className="text-xs font-medium text-slate-400">Narration</span>
                </div>
                <p className={`text-sm font-semibold ${
                  lessonData?._meta?.hasScript || chapter.hasScript ? 'text-emerald-300' : 'text-slate-500'
                }`}>
                  {lessonData?._meta?.scriptSections 
                    ? `${lessonData._meta.scriptSections} sections`
                    : chapter.hasScript ? 'Available' : 'Not set'}
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                lessonData?._meta?.hasAssets || chapter.hasAssets 
                  ? 'bg-blue-500/10 border-blue-500/30' 
                  : 'bg-slate-800/30 border-slate-700/30'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Box className={`w-4 h-4 ${
                    lessonData?._meta?.hasAssets || chapter.hasAssets ? 'text-blue-400' : 'text-slate-500'
                  }`} />
                  <span className="text-xs font-medium text-slate-400">3D Assets</span>
                </div>
                <p className={`text-sm font-semibold ${
                  lessonData?._meta?.hasAssets || chapter.hasAssets ? 'text-blue-300' : 'text-slate-500'
                }`}>
                  {lessonData?._meta?.hasAssets || chapter.hasAssets ? 'Available' : 'Not set'}
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                lessonData?._meta?.hasMcqs || chapter.hasMcqs 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-slate-800/30 border-slate-700/30'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <HelpCircle className={`w-4 h-4 ${
                    lessonData?._meta?.hasMcqs || chapter.hasMcqs ? 'text-amber-400' : 'text-slate-500'
                  }`} />
                  <span className="text-xs font-medium text-slate-400">Quiz</span>
                </div>
                <p className={`text-sm font-semibold ${
                  lessonData?._meta?.hasMcqs || chapter.hasMcqs ? 'text-amber-300' : 'text-slate-500'
                }`}>
                  {lessonData?._meta?.hasMcqs || chapter.hasMcqs ? 'Available' : 'Not set'}
                </p>
              </div>
            </div>

            {/* Status / Error */}
            {dataError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-300 mb-1">Unable to load lesson</h3>
                    <p className="text-xs text-red-300/70">{dataError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* VR Launch Option */}
            {vrCapabilities && (
              <div className={`mb-4 p-4 rounded-xl border ${
                vrCapabilities.isVRSupported 
                  ? 'bg-purple-500/10 border-purple-500/30' 
                  : 'bg-slate-800/50 border-slate-700/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {vrCapabilities.isVRSupported ? (
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Glasses className="w-5 h-5 text-purple-400" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className={`text-sm font-medium ${vrCapabilities.isVRSupported ? 'text-purple-300' : 'text-slate-300'}`}>
                        {vrCapabilities.isVRSupported ? 'VR Mode Available' : '2D Mode'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {vrCapabilities.isVRSupported 
                          ? `Ready for ${vrCapabilities.deviceType.replace('-', ' ')}`
                          : getVRRecommendation(vrCapabilities).message}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={launchVRLesson}
                    disabled={!canLaunchLesson}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      canLaunchLesson && vrCapabilities.isVRSupported
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg'
                        : canLaunchLesson
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Glasses className="w-4 h-4" />
                    {vrCapabilities.isVRSupported ? 'Launch in VR' : 'Preview in 3D'}
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={closeLessonModal}
                className="flex-1 px-6 py-3 text-sm font-medium text-slate-300 
                         bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700
                         transition-all"
              >
                Cancel
              </button>
              
              <button
                onClick={launchLesson}
                disabled={!canLaunchLesson}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold
                         rounded-xl shadow-lg transition-all ${
                  canLaunchLesson
                    ? isCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {dataLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing Lesson...
                  </>
                ) : dataError ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    {dataError.length > 30 ? 'Not Available' : dataError}
                  </>
                ) : canLaunchLesson ? (
                  <>
                    <Play className="w-4 h-4" />
                    {isCompleted ? 'Replay Lesson' : 'Launch Lesson'}
                  </>
                ) : dataReady && !canLaunchLesson ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Incomplete Data
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                )}
              </button>
            </div>

            {/* Loading Status */}
            {dataLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Fetching lesson content...
              </div>
            )}
            
            {dataReady && !dataError && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Lesson ready to launch
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // GRID VIEW - Chapter Card
  const ChapterCard = ({ chapter }) => {
    const thumbnail = getThumbnail(chapter);
    const firstTopic = chapter.topics?.find(t => t.skybox_url || t.topic_avatar_intro) || chapter.topics?.[0];
    const isCompleted = completedLessons[chapter.id];
    const quizScore = isCompleted?.quizScore;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className={`bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm 
                   rounded-2xl border overflow-hidden
                   hover:shadow-lg transition-all duration-300 cursor-pointer group
                   ${isCompleted 
                     ? 'border-emerald-500/50 hover:border-emerald-400/60 hover:shadow-emerald-500/10' 
                     : 'border-slate-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/10'}`}
        onClick={() => openLessonModal(chapter, firstTopic)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-slate-800">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={chapter.chapter_name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <BookOpen className="w-12 h-12 text-slate-600" />
            </div>
          )}
          
          {/* Completed Overlay */}
          {isCompleted && (
            <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm">
              {chapter.curriculum}
            </span>
            <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 backdrop-blur-sm">
              Class {chapter.class}
            </span>
          </div>
          
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {isCompleted && (
              <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/90 text-white backdrop-blur-sm">
                <Trophy className="w-3 h-3" />
                {quizScore ? `${quizScore.percentage}%` : 'Done'}
              </span>
            )}
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-black/50 text-white border border-white/20 backdrop-blur-sm">
              Ch {chapter.chapter_number}
            </span>
          </div>
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
              isCompleted ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-cyan-500 shadow-cyan-500/50'
            }`}>
              {isCompleted ? (
                <Play className="w-8 h-8 text-white ml-1" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-2">
            <h3 className={`text-sm font-semibold mb-2 line-clamp-2 transition-colors flex-1 ${
              isCompleted ? 'text-emerald-300 group-hover:text-emerald-200' : 'text-white group-hover:text-cyan-300'
            }`}>
              {chapter.chapter_name}
            </h3>
            {isCompleted && (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
          </div>
          
          <p className="text-xs text-slate-400 mb-3">{chapter.subject}</p>
          
          {/* Stats */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-slate-500">
              {chapter.topicCount} topic{chapter.topicCount !== 1 ? 's' : ''}
            </div>
            <ContentBadges chapter={chapter} />
          </div>
        </div>
      </motion.div>
    );
  };

  // LIST VIEW - Topic Row
  const TopicRow = ({ topic, chapter, index }) => {
    const hasSkybox = !!topic.skybox_url || !!topic.skybox_id;
    const hasScript = !!(topic.topic_avatar_intro || topic.topic_avatar_explanation);

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        className="flex items-center gap-4 px-4 py-3 ml-4 border-l-2 border-slate-700 
                   hover:border-cyan-500 bg-slate-800/30 hover:bg-slate-800/50 
                   transition-all duration-200 cursor-pointer"
        onClick={() => openLessonModal(chapter, topic)}
      >
        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-xs font-mono text-slate-400">
          {topic.topic_priority || index + 1}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate hover:text-cyan-300 transition-colors">
            {topic.topic_name || `Topic ${index + 1}`}
          </h4>
          {topic.learning_objective && (
            <p className="text-xs text-slate-500 truncate">{topic.learning_objective}</p>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          {hasSkybox && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
          {hasScript && <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
        
        <button 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg 
                   bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium
                   hover:bg-cyan-500/30 hover:border-cyan-400 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            openLessonModal(chapter, topic);
          }}
        >
          <Play className="w-3 h-3" />
          View
        </button>
      </motion.div>
    );
  };

  // LIST VIEW - Chapter Item
  const ChapterListItem = ({ chapter }) => {
    const isExpanded = expandedChapters.has(chapter.id);
    const topics = chapter.topics || [];
    const firstTopic = topics.find(t => t.skybox_url || t.topic_avatar_intro) || topics[0];
    const isCompleted = completedLessons[chapter.id];
    const quizScore = isCompleted?.quizScore;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-slate-900/50 backdrop-blur-sm rounded-xl border overflow-hidden ${
          isCompleted ? 'border-emerald-500/40' : 'border-slate-800/50'
        }`}
      >
        <div 
          className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
            isCompleted ? 'hover:bg-emerald-900/10' : 'hover:bg-slate-800/30'
          }`}
          onClick={() => topics.length > 1 ? toggleChapter(chapter.id) : openLessonModal(chapter, firstTopic)}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isCompleted 
              ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30' 
              : 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30'
          }`}>
            {isCompleted ? (
              <Trophy className="w-5 h-5 text-emerald-400" />
            ) : (
              <span className="text-lg font-bold text-cyan-300">{chapter.chapter_number || '?'}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-semibold text-cyan-400 uppercase">{chapter.curriculum}</span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] font-medium text-purple-400">Class {chapter.class}</span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] font-medium text-slate-400">{chapter.subject}</span>
              {isCompleted && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    {quizScore ? `${quizScore.percentage}%` : 'Completed'}
                  </span>
                </>
              )}
            </div>
            <h3 className={`text-base font-semibold truncate ${
              isCompleted ? 'text-emerald-300' : 'text-white'
            }`}>{chapter.chapter_name}</h3>
          </div>
          
          <ContentBadges chapter={chapter} />
          
          {topics.length > 1 ? (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center"
            >
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </motion.div>
          ) : (
            <button 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-lg ${
                isCompleted 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-cyan-500/20'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                openLessonModal(chapter, firstTopic);
              }}
            >
              <Play className="w-4 h-4" />
              {isCompleted ? 'Replay' : 'View'}
            </button>
          )}
        </div>
        
        <AnimatePresence>
          {isExpanded && topics.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-800/50"
            >
              <div className="py-2">
                {topics.map((topic, index) => (
                  <TopicRow 
                    key={topic.topic_id || index} 
                    topic={topic} 
                    chapter={chapter}
                    index={index}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 
                            border border-cyan-500/30 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Available Lessons</h1>
                <p className="text-xs text-slate-400">Click any lesson to start learning</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 p-3 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800/50"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                         text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
            
            <select
              value={selectedCurriculum}
              onChange={(e) => {
                setSelectedCurriculum(e.target.value);
                setSelectedClass('');
                setSelectedSubject('');
              }}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer"
            >
              <option value="">All Curricula</option>
              {availableCurricula.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSubject('');
              }}
              disabled={!selectedCurriculum}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer disabled:opacity-50"
            >
              <option value="">All Classes</option>
              {availableClasses.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedClass}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer disabled:opacity-50"
            >
              <option value="">All Subjects</option>
              {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {(selectedCurriculum || selectedClass || selectedSubject || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCurriculum('');
                  setSelectedClass('');
                  setSelectedSubject('');
                  setSearchQuery('');
                }}
                className="px-3 py-2 text-sm text-slate-400 hover:text-white bg-slate-800/30 rounded-lg border border-slate-700/50"
              >
                Clear
              </button>
            )}

            <div className="ml-auto px-3 py-1.5 bg-slate-800/30 rounded-lg">
              <span className="text-sm font-medium text-cyan-400">{filteredChapters.length}</span>
              <span className="text-sm text-slate-500 ml-1">lessons</span>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {error ? (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-300">Error</h3>
                <p className="text-sm text-red-300/70">{error}</p>
              </div>
              <button onClick={() => window.location.reload()} className="p-2 bg-red-500/20 text-red-300 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
            <p className="text-slate-400">Loading lessons...</p>
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BookOpen className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Lessons Found</h3>
            <p className="text-sm text-slate-400">Try adjusting your filters</p>
          </div>
        ) : viewMode === 'grid' ? (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredChapters.map(chapter => (
              <ChapterCard key={chapter.id} chapter={chapter} />
            ))}
          </motion.div>
        ) : (
          <motion.div layout className="space-y-3">
            {filteredChapters.map(chapter => (
              <ChapterListItem key={chapter.id} chapter={chapter} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Lesson Detail Modal */}
      <AnimatePresence>
        <LessonDetailModal />
      </AnimatePresence>
    </div>
  );
};

export default Lessons;
