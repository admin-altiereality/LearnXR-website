/**
 * Lessons Page - Browse and launch VR lessons
 * 
 * Features:
 * - Grid and List view modes
 * - Lesson detail modal with background data fetching
 * - Launch button enabled only when data is ready
 * - Clean, professional UX transitions
 * - Memoized components to prevent flickering
 */

import { collection, onSnapshot, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
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
  Monitor,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { getVRCapabilities, getVRRecommendation } from '../utils/vrDetection';
import { LanguageToggle } from '../Components/LanguageSelector';
import { 
  chapterHasContentForLanguage,
  getChapterNameByLanguage,
  getTopicNameByLanguage,
  getLearningObjectiveByLanguage,
  getSubjectNameByLanguage
} from '../lib/firebase/utils/languageAvailability';
import { updateTopicApproval } from '../lib/firestore/updateHelpers';
import { isAdminOnly, isSuperadmin } from '../utils/rbac';

// Content indicators (simple badges) - Memoized
const ContentBadges = memo(({ chapter }) => (
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
));

// GRID VIEW - Chapter Card - Memoized to prevent flickering
const ChapterCard = memo(({ chapter, completedLessons, onOpenModal, getThumbnail, selectedLanguage = 'en' }) => {
  const thumbnail = getThumbnail(chapter);
  const firstTopic = chapter.topics?.find(t => t.skybox_url || t.topic_avatar_intro) || chapter.topics?.[0];
  const isCompleted = completedLessons[chapter.id];
  const quizScore = isCompleted?.quizScore;
  
  // Get language-specific chapter name
  const chapterName = getChapterNameByLanguage(chapter._rawData || chapter, selectedLanguage) || chapter.chapter_name;

  return (
    <div
      className={`bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm 
                 rounded-2xl border overflow-hidden
                 hover:shadow-lg transition-all duration-300 cursor-pointer group
                 transform hover:-translate-y-1
                 ${isCompleted 
                   ? 'border-emerald-500/50 hover:border-emerald-400/60 hover:shadow-emerald-500/10' 
                   : 'border-slate-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/10'}`}
      onClick={() => onOpenModal(chapter, firstTopic)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-slate-800">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={chapterName}
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
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-2">
          <h3 className={`text-sm font-semibold mb-2 line-clamp-2 transition-colors flex-1 ${
            isCompleted ? 'text-emerald-300 group-hover:text-emerald-200' : 'text-white group-hover:text-cyan-300'
          }`}>
            {chapterName}
          </h3>
          {isCompleted && (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          )}
        </div>
        
        <p className="text-xs text-slate-400 mb-3">{getSubjectNameByLanguage(chapter.subject || '', selectedLanguage)}</p>
        
        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            {chapter.topicCount} topic{chapter.topicCount !== 1 ? 's' : ''}
          </div>
          <ContentBadges chapter={chapter} />
        </div>
      </div>
    </div>
  );
});

// LIST VIEW - Topic Row - Memoized
const TopicRow = memo(({ topic, chapter, index, onOpenModal, selectedLanguage = 'en', onApprovalChange }) => {
  const { profile } = useAuth();
  const [updatingApproval, setUpdatingApproval] = useState(false);
  
  const hasSkybox = !!topic.skybox_url || !!topic.skybox_id;
  const hasScript = !!(topic.topic_avatar_intro || topic.topic_avatar_explanation);
  
  // Get language-specific names
  const topicName = getTopicNameByLanguage(topic, selectedLanguage) || topic.topic_name || `Topic ${index + 1}`;
  const learningObjective = getLearningObjectiveByLanguage(topic, selectedLanguage) || topic.learning_objective;
  
  // Check if user can approve (admin or superadmin)
  const canApprove = profile && (isAdminOnly(profile) || isSuperadmin(profile));
  
  // Get approval status
  const approval = topic.approval || {};
  const isApproved = approval.approved === true;
  const approvedAt = approval.approvedAt;
  
  // Format approvedAt timestamp
  const formatApprovedAt = (timestamp) => {
    if (!timestamp) return null;
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return null;
    }
  };
  
  const handleApprovalToggle = async (e) => {
    e.stopPropagation();
    if (!canApprove || !profile) return;
    
    const newApproved = !isApproved;
    setUpdatingApproval(true);
    
    try {
      await updateTopicApproval({
        chapterId: chapter.id,
        topicId: topic.topic_id,
        approved: newApproved,
        userId: profile.uid,
      });
      
      // Optimistic update - call parent callback to refresh
      if (onApprovalChange) {
        onApprovalChange(chapter.id, topic.topic_id, newApproved);
      }
      
      toast.success(`Topic ${newApproved ? 'approved' : 'unapproved'} successfully`);
    } catch (error) {
      console.error('Error updating topic approval:', error);
      toast.error('Failed to update approval status');
    } finally {
      setUpdatingApproval(false);
    }
  };

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 ml-4 border-l-2 border-slate-700 
                 hover:border-cyan-500 bg-slate-800/30 hover:bg-slate-800/50 
                 transition-all duration-200 cursor-pointer"
      onClick={() => onOpenModal(chapter, topic)}
    >
      <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-xs font-mono text-slate-400">
        {topic.topic_priority || index + 1}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-white truncate hover:text-cyan-300 transition-colors">
            {topicName}
          </h4>
          {/* Approval Status Badge */}
          {isApproved ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <XCircle className="w-3 h-3" />
              Not Approved
            </span>
          )}
        </div>
        {learningObjective && (
          <p className="text-xs text-slate-500 truncate">{learningObjective}</p>
        )}
        {isApproved && approvedAt && (
          <p className="text-[10px] text-slate-500 mt-0.5">
            Approved {formatApprovedAt(approvedAt)}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-1.5">
        {hasSkybox && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
        {hasScript && <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
      </div>
      
      <div className="flex items-center gap-2">
        {/* Approval Controls (Admin/Superadmin only) */}
        {canApprove && (
          <button
            onClick={handleApprovalToggle}
            disabled={updatingApproval}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed
                       ${isApproved
                         ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:border-red-400'
                         : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400'
                       }`}
            title={isApproved ? 'Unapprove topic' : 'Approve topic'}
          >
            {updatingApproval ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isApproved ? (
              <>
                <XCircle className="w-3 h-3" />
                Unapprove
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Approve
              </>
            )}
          </button>
        )}
        
        <button 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg 
                   bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium
                   hover:bg-cyan-500/30 hover:border-cyan-400 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(chapter, topic);
          }}
        >
          <Play className="w-3 h-3" />
          View
        </button>
      </div>
    </div>
  );
});

// LIST VIEW - Chapter Item - Memoized
const ChapterListItem = memo(({ chapter, completedLessons, expandedChapters, onOpenModal, onToggleChapter, selectedLanguage = 'en', onApprovalChange }) => {
  const isExpanded = expandedChapters.has(chapter.id);
  const topics = chapter.topics || [];
  const firstTopic = topics.find(t => t.skybox_url || t.topic_avatar_intro) || topics[0];
  const isCompleted = completedLessons[chapter.id];
  const quizScore = isCompleted?.quizScore;

  return (
    <div
      className={`bg-slate-900/50 backdrop-blur-sm rounded-xl border overflow-hidden ${
        isCompleted ? 'border-emerald-500/40' : 'border-slate-800/50'
      }`}
    >
      <div 
        className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
          isCompleted ? 'hover:bg-emerald-900/10' : 'hover:bg-slate-800/30'
        }`}
        onClick={() => topics.length > 1 ? onToggleChapter(chapter.id) : onOpenModal(chapter, firstTopic)}
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
            <span className="text-[10px] font-medium text-slate-400">{getSubjectNameByLanguage(chapter.subject || '', selectedLanguage)}</span>
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
          }`}>{getChapterNameByLanguage(chapter, selectedLanguage) || chapter.chapter_name}</h3>
        </div>
        
        <ContentBadges chapter={chapter} />
        
        {topics.length > 1 ? (
          <div
            className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        ) : (
          <button 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-lg ${
              isCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-cyan-500/20'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(chapter, firstTopic);
            }}
          >
            <Play className="w-4 h-4" />
            {isCompleted ? 'Replay' : 'View'}
          </button>
        )}
      </div>
      
      {/* Expanded Topics */}
      {isExpanded && topics.length > 0 && (
        <div className="border-t border-slate-800/50">
          <div className="py-2">
            {topics.map((topic, index) => (
              <TopicRow 
                key={topic.topic_id || index} 
                topic={topic} 
                chapter={chapter}
                index={index}
                onOpenModal={onOpenModal}
                selectedLanguage={selectedLanguage}
                onApprovalChange={onApprovalChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

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
  
  // Countdown state for data preparation (10 seconds)
  const [countdown, setCountdown] = useState(0);
  const countdownRef = React.useRef(null);
  
  // Completed lessons tracking
  const [completedLessons, setCompletedLessons] = useState({});
  
  // VR capabilities
  const [vrCapabilities, setVRCapabilities] = useState(null);
  const [vrChecking, setVRChecking] = useState(true);
  
  // Filter states
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  
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
    
    // CRITICAL: Only show approved lessons on /lessons page
    constraints.push(where('approved', '==', true));
    
    const chaptersRef = collection(db, 'curriculum_chapters');
    const chaptersQuery = constraints.length > 0 
      ? query(chaptersRef, ...constraints)
      : query(chaptersRef);
    
    const unsubscribe = onSnapshot(
      chaptersQuery,
      async (snapshot) => {
        try {
          // Import language availability checker
          const { chapterHasContentForLanguage } = await import('../lib/firebase/utils/languageAvailability');
          
          const chaptersData = await Promise.all(
              snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const chapterData = data;
              
              // Check language availability
              const hasContentForLanguage = chapterHasContentForLanguage(chapterData, selectedLanguage);
              
              return {
                id: docSnap.id,
                ...data,
                topicCount: data.topics?.length || 0,
                // Basic content indicators (no deep validation)
                hasSkybox: data.topics?.some(t => t.skybox_url || t.skybox_id),
                hasScript: data.topics?.some(t => t.topic_avatar_intro || t.topic_avatar_explanation),
                hasAssets: data.meshy_asset_ids?.length > 0 || !!data.image3dasset?.imageasset_url,
                hasMcqs: data.mcq_ids?.length > 0,
                hasContentForSelectedLanguage: hasContentForLanguage,
                _rawData: chapterData, // Store raw data for language checking
              };
            })
          );
          
          // Filter by language availability
          const filteredChapters = chaptersData.filter(ch => ch.hasContentForSelectedLanguage !== false);
          
          // Sort
          filteredChapters.sort((a, b) => {
            if (a.curriculum !== b.curriculum) return (a.curriculum || '').localeCompare(b.curriculum || '');
            if (a.class !== b.class) return (a.class || 0) - (b.class || 0);
            if (a.subject !== b.subject) return (a.subject || '').localeCompare(b.subject || '');
            return (a.chapter_number || 0) - (b.chapter_number || 0);
          });
          
          setChapters(filteredChapters);
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
  }, [selectedCurriculum, selectedClass, selectedSubject, selectedLanguage]);

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

  // Search/filter - use language-specific names
  const filteredChapters = useMemo(() => {
    let result = chapters;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(chapter => {
        const chapterName = getChapterNameByLanguage(chapter._rawData || chapter, selectedLanguage) || chapter.chapter_name || '';
        const matchesChapterName = chapterName.toLowerCase().includes(q);
        const matchesSubject = chapter.subject?.toLowerCase().includes(q);
        const matchesTopic = chapter.topics?.some(t => {
          const topicName = getTopicNameByLanguage(t, selectedLanguage) || t.topic_name || '';
          return topicName.toLowerCase().includes(q);
        });
        return matchesChapterName || matchesSubject || matchesTopic;
      });
    }
    return result;
  }, [chapters, searchQuery, selectedLanguage]);

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

  // Handle topic approval change - optimistic update
  const handleApprovalChange = useCallback((chapterId, topicId, approved) => {
    setChapters(prevChapters => {
      return prevChapters.map(chapter => {
        if (chapter.id === chapterId) {
          const updatedTopics = chapter.topics?.map(topic => {
            if (topic.topic_id === topicId) {
              return {
                ...topic,
                approval: {
                  approved: approved,
                  approvedAt: approved ? new Date().toISOString() : null,
                },
              };
            }
            return topic;
          });
          return {
            ...chapter,
            topics: updatedTopics,
          };
        }
        return chapter;
      });
    });
  }, []);

  // Close lesson modal
  const closeLessonModal = useCallback(() => {
    // Clear countdown timer
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
    setSelectedLesson(null);
    setLessonData(null);
    setDataLoading(false);
    setDataError(null);
    setDataReady(false);
  }, []);
  
  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Fetch lesson data in background using unified bundle pipeline
  const fetchLessonData = useCallback(async (chapter, topicInput) => {
    try {
      // Use unified getLessonBundle function
      const { getLessonBundle } = await import('../services/firestore/getLessonBundle');
      
      // Fetch complete lesson bundle for selected language
      const bundle = await getLessonBundle({
        chapterId: chapter.id,
        lang: selectedLanguage,
      });

      const fullData = bundle.chapter;
      
      // Find the best topic
      const topic = topicInput 
        ? fullData.topics?.find(t => t.topic_id === topicInput.topic_id) || topicInput
        : fullData.topics?.find(t => t.skybox_url || t.topic_avatar_intro || t.topic_avatar_explanation) 
          || fullData.topics?.[0];
      
      if (!topic) {
        throw new Error('No content available for this lesson');
      }

      // Build asset URLs from bundle
      let assetUrls = topic.asset_urls || [];
      let assetIds = topic.asset_ids || [];
      
      // Include 3D assets from bundle - safe defaults
      const safeAssets3d = Array.isArray(bundle.assets3d) ? bundle.assets3d : [];
      if (safeAssets3d.length > 0) {
        safeAssets3d.forEach(asset => {
          if (asset && asset.glb_url && !assetUrls.includes(asset.glb_url)) {
            assetUrls.push(asset.glb_url);
            assetIds.push(asset.id || `asset_${assetUrls.length}`);
          }
        });
      }
      
      // Include image3dasset if available
      if (fullData.image3dasset?.imageasset_url || fullData.image3dasset?.imagemodel_glb) {
        const img3d = fullData.image3dasset;
        const primaryUrl = img3d.imagemodel_glb || img3d.imageasset_url;
        if (primaryUrl && !assetUrls.includes(primaryUrl)) {
          assetUrls = [primaryUrl, ...assetUrls];
          assetIds = [img3d.imageasset_id || 'image3d_asset', ...assetIds];
        }
      }

      // Use avatar scripts from bundle
      const scripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
      console.log(`📝 Using ${selectedLanguage} avatar scripts from bundle:`, {
        hasIntro: !!scripts.intro,
        hasExplanation: !!scripts.explanation,
        hasOutro: !!scripts.outro,
      });

      // Use MCQs from bundle (already language-filtered) - safe defaults
      const safeMcqs = Array.isArray(bundle.mcqs) ? bundle.mcqs : [];
      const mcqs = safeMcqs.map(m => ({
        id: m.id || `mcq_${Math.random()}`,
        question: m.question || m.question_text || '',
        options: Array.isArray(m.options) ? m.options : [],
        correct_option_index: m.correct_option_index ?? 0,
        explanation: m.explanation || '',
      }));

      // Use TTS from bundle (already language-filtered) - safe defaults
      // Transform TTS to expected format with language field and double-check filtering
      const safeTts = Array.isArray(bundle.tts) ? bundle.tts : [];
      const ttsAudio = safeTts
        .map((tts) => {
          // Determine language from TTS data
          let ttsLanguage = tts.language || tts.lang || selectedLanguage;
          
          // If no explicit language field, check ID pattern
          if (!tts.language && !tts.lang && tts.id) {
            const idLower = String(tts.id).toLowerCase();
            if (idLower.includes('_hi') || idLower.includes('_hindi') || idLower.includes('hi_') || idLower.endsWith('_hi')) {
              ttsLanguage = 'hi';
            } else {
              ttsLanguage = 'en';
            }
          }
          
          return {
            id: tts.id || '',
            script_type: tts.script_type || tts.section || 'full',
            audio_url: tts.audio_url || tts.audioUrl || tts.url || '',
            language: ttsLanguage, // Explicitly set language field
            text: tts.script_text || tts.text || tts.content || '',
          };
        })
        .filter((tts) => {
          // Language filtering (strict match)
          const ttsLang = (tts.language || 'en').toLowerCase().trim();
          const targetLang = selectedLanguage.toLowerCase().trim();
          return ttsLang === targetLang;
        });

      // Get language-specific names
      const chapterName = getChapterNameByLanguage(fullData, selectedLanguage) || fullData.chapter_name || chapter.chapter_name;
      const topicName = getTopicNameByLanguage(topic, selectedLanguage) || topic.topic_name || chapterName;
      const learningObjective = getLearningObjectiveByLanguage(topic, selectedLanguage) || topic.learning_objective || '';

      // Get skybox URL from bundle or topic
      const skyboxUrl = bundle.skybox?.imageUrl || bundle.skybox?.file_url || topic.skybox_url || '';

      // Build lesson data with language-specific content from bundle
      const preparedData = {
        chapter: {
          chapter_id: chapter.id,
          chapter_name: chapterName,
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
          topic_name: topicName,
          topic_priority: topic.topic_priority || 1,
          learning_objective: learningObjective,
          in3d_prompt: topic.in3d_prompt || '',
          scene_type: topic.scene_type || 'narrative',
          status: topic.status || 'generated',
          skybox_id: bundle.skybox?.id || topic.skybox_id || null,
          skybox_url: skyboxUrl,
          skybox_remix_id: topic.skybox_remix_id || null,
          // Use language-specific scripts from bundle
          avatar_intro: scripts.intro || '',
          avatar_explanation: scripts.explanation || '',
          avatar_outro: scripts.outro || '',
          asset_list: topic.asset_list || [],
          asset_urls: assetUrls,
          asset_ids: assetIds,
          mcq_ids: topic.mcq_ids || [],
          tts_ids: topic.tts_ids || [],
          meshy_asset_ids: topic.meshy_asset_ids || [],
          mcqs: mcqs, // Include MCQs from bundle
        },
        image3dasset: fullData.image3dasset || null,
        ttsAudio: ttsAudio, // Include TTS from bundle
        language: selectedLanguage, // Store selected language
        startedAt: new Date().toISOString(),
        // Extra metadata for the modal
        _meta: {
          hasSkybox: !!skyboxUrl,
          hasScript: !!(scripts.intro || scripts.explanation || scripts.outro),
          hasAssets: assetUrls.length > 0 || !!fullData.image3dasset,
          hasMcqs: mcqs.length > 0,
          topicCount: fullData.topics?.length || 1,
          scriptSections: [
            scripts.intro,
            scripts.explanation,
            scripts.outro,
          ].filter(Boolean).length,
          // Include 3D assets from bundle for lesson players - safe defaults
          assets3d: safeAssets3d,
          meshy_asset_ids: fullData.meshy_asset_ids || [],
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
      console.error('❌ Failed to fetch lesson data:', err);
      // Provide safe error message
      const errorMessage = err?.message || 'Failed to load lesson data';
      // Check for specific errors
      if (errorMessage.includes('assetsRaw') || errorMessage.includes('not defined')) {
        setDataError('Lesson data structure error. Please refresh the page.');
      } else {
        setDataError(errorMessage);
      }
      setDataLoading(false);
      setDataReady(false);
    }
  }, [selectedLanguage]);

  // Open lesson detail modal and start fetching data
  const openLessonModal = useCallback((chapter, topicInput) => {
    setSelectedLesson({ chapter, topicInput });
    setLessonData(null);
    setDataLoading(true);
    setDataError(null);
    setDataReady(false);
    
    // Start 10-second countdown for data preparation
    setCountdown(10);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
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
    
    // Check if we have lesson data
    if (!lessonData) {
      setDataError('No lesson data available. Please try again.');
      return;
    }
    
    // Validate the data structure
    try {
      const validation = validateLessonData(lessonData);
      if (!validation.isValid) {
        setDataError(`Lesson data validation failed: ${validation.errors.join(', ')}`);
        return;
      }
    } catch (validationErr) {
      console.error('Validation error:', validationErr);
      setDataError('Error validating lesson data');
      return;
    }
    
    // Prepare clean lesson data
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
        language: lessonData.language || 'en',
        ttsAudio: Array.isArray(lessonData.ttsAudio) ? [...lessonData.ttsAudio] : [],
      };
      
      fullLessonData = {
        chapter: cleanChapter,
        topic: cleanTopic,
        image3dasset: lessonData.image3dasset ?? null,
        startedAt: lessonData.startedAt ?? new Date().toISOString(),
        launchedAt: new Date().toISOString(),
        _meta: lessonData._meta ?? null,
      };
    } catch (prepErr) {
      console.error('Error preparing lesson data:', prepErr);
      setDataError('Error preparing lesson data');
      return;
    }
    
    // Save to sessionStorage
    try {
      sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
    } catch (storageErr) {
      console.error('SessionStorage error:', storageErr);
    }
    
    // Update LessonContext
    try {
      if (typeof contextStartLesson === 'function') {
        contextStartLesson(cleanChapter, cleanTopic);
      }
    } catch (contextErr) {
      console.error('Context update error:', contextErr);
    }
    
    // Close modal and navigate
    closeLessonModal();
    setTimeout(() => {
      navigate('/vrlessonplayer');
    }, 200);
    
  }, [lessonData, navigate, closeLessonModal, contextStartLesson, validateLessonData]);
  
  // Validate VR lesson data - stricter check for XRLessonPlayerV2
  // VR lessons REQUIRE either a skybox OR 3D assets to be meaningful
  const validateVRLessonData = useCallback((data) => {
    const errors = [];
    const warnings = [];
    
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
    
    // VR-specific checks - need skybox_id to fetch GLB from skyboxes collection
    const hasSkyboxId = data?.topic?.skybox_id || data?.topic?.skybox_remix_id;
    const hasSkyboxUrl = data?.topic?.skybox_url || data?.topic?.skybox_glb_url;
    const hasSkybox = hasSkyboxId || hasSkyboxUrl;
    
    // Check for 3D assets - either from meshy_asset_ids, image3dasset, or asset_urls
    const hasMeshyAssets = data?._meta?.meshy_asset_ids?.length > 0;
    const hasImage3DAsset = data?.image3dasset?.imagemodel_glb || data?.image3dasset?.imageasset_url;
    const hasAssetUrls = data?.topic?.asset_urls?.length > 0;
    const has3DAssets = hasMeshyAssets || hasImage3DAsset || hasAssetUrls;
    
    // VR REQUIRES a skybox - it's the core immersive environment
    if (!hasSkybox) {
      errors.push('VR lesson requires a 360° skybox environment. Please add a skybox to this lesson.');
    }
    
    // 3D assets are optional but recommended
    if (!has3DAssets) {
      warnings.push('No 3D assets found (lesson will show skybox only)');
    }
    
    // Check for audio content (optional but recommended)
    const hasTTS = data?.topic?.avatar_intro || data?.topic?.avatar_explanation || data?.topic?.avatar_outro;
    if (!hasTTS) {
      warnings.push('No TTS narration available');
    }
    
    // Log warnings but don't fail for those
    if (warnings.length > 0) {
      console.warn('⚠️ VR Lesson warnings:', warnings);
    }
    
    // Log errors
    if (errors.length > 0) {
      console.error('❌ VR Lesson validation errors:', errors);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      assets: {
        hasSkybox,
        skyboxId: data?.topic?.skybox_id || data?.topic?.skybox_remix_id || null,
        has3DAssets,
        hasTTS,
        hasMCQ: data?._meta?.mcq_ids?.length > 0 || data?.topic?.mcq_ids?.length > 0,
      },
    };
  }, []);

  // Launch lesson in VR mode (opens /xrlessonplayer)
  const launchVRLesson = useCallback(async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🥽 [Lessons] LAUNCH VR LESSON (XRLessonPlayer)');
    console.log('═══════════════════════════════════════════════════════');
    
    if (!lessonData) {
      console.error('❌ No lesson data for VR launch');
      setDataError('No lesson data available');
      return;
    }
    
    // Validate data with VR-specific checks
    console.log('📋 Validating VR lesson data...');
    const validation = validateVRLessonData(lessonData);
    
    if (!validation.isValid) {
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
        // Skybox - include ID for fetching GLB from skyboxes collection
        skybox_id: lessonData.topic?.skybox_id ?? null,
        skybox_remix_id: lessonData.topic?.skybox_remix_id ?? null,
        skybox_url: String(lessonData.topic?.skybox_url ?? ''),
        skybox_glb_url: String(lessonData.topic?.skybox_glb_url ?? ''),
        // Narration
        avatar_intro: String(lessonData.topic?.avatar_intro ?? ''),
        avatar_explanation: String(lessonData.topic?.avatar_explanation ?? ''),
        avatar_outro: String(lessonData.topic?.avatar_outro ?? ''),
        // Assets
        asset_urls: Array.isArray(lessonData.topic?.asset_urls) ? [...lessonData.topic.asset_urls] : [],
        asset_ids: Array.isArray(lessonData.topic?.asset_ids) ? [...lessonData.topic.asset_ids] : [],
        // MCQ - Include both IDs and the actual MCQs array from bundle
        mcq_ids: Array.isArray(lessonData.topic?.mcq_ids) ? [...lessonData.topic.mcq_ids] : [],
        mcqs: Array.isArray(lessonData.topic?.mcqs) ? lessonData.topic.mcqs.map(m => ({
          id: m.id || '',
          question: m.question || '',
          options: Array.isArray(m.options) ? [...m.options] : [],
          correct_option_index: m.correct_option_index ?? 0,
          explanation: m.explanation || '',
        })) : [],
        // TTS
        tts_ids: Array.isArray(lessonData.topic?.tts_ids) ? [...lessonData.topic.tts_ids] : [],
        tts_audio_url: String(lessonData.topic?.tts_audio_url ?? ''),
        // Include TTS audio array from bundle
        ttsAudio: Array.isArray(lessonData.ttsAudio) ? lessonData.ttsAudio.map(t => ({
          id: t.id || '',
          script_type: t.script_type || 'full',
          audio_url: t.audio_url || t.url || '',
          language: t.language || lessonData.language || 'en',
        })) : [],
        // Language
        language: String(lessonData.language || 'en'),
      };
      
      const fullLessonData = {
        chapter: cleanChapter,
        topic: cleanTopic,
        image3dasset: lessonData.image3dasset ?? null,
        // Include meshy assets info
        meshy_asset_ids: lessonData._meta?.meshy_asset_ids ?? [],
        // Include 3D assets from bundle
        assets3d: lessonData._meta?.assets3d || [],
        startedAt: new Date().toISOString(),
        _meta: lessonData._meta ?? null,
        // Include language and TTS audio array
        language: lessonData.language || 'en',
        ttsAudio: lessonData.ttsAudio || [],
      };
      
      // Save to sessionStorage
      sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
      
      // Update context
      if (typeof contextStartLesson === 'function') {
        contextStartLesson(cleanChapter, cleanTopic);
      }
      
      // Close modal and navigate
      closeLessonModal();
      setTimeout(() => {
        navigate('/xrlessonplayer');
      }, 100);
      
    } catch (err) {
      console.error('Failed to prepare VR lesson:', err);
      setDataError('Failed to prepare VR lesson');
    }
  }, [lessonData, navigate, closeLessonModal, validateVRLessonData, contextStartLesson]);

  
  // Check if launch is safe - requires countdown finished AND data ready
  const canLaunchLesson = useMemo(() => {
    // Must wait for countdown to finish
    if (countdown > 0) return false;
    // Must have data ready
    if (!dataReady || dataError || !lessonData) return false;
    // Validate data
    const validation = validateLessonData(lessonData);
    return validation.isValid;
  }, [countdown, dataReady, dataError, lessonData, validateLessonData]);

  // Check if VR launch is possible - stricter validation requiring skybox OR 3D assets
  const canLaunchVRLesson = useMemo(() => {
    // First check basic launch requirements
    if (!canLaunchLesson) return false;
    // Then check VR-specific requirements (must have skybox OR 3D assets)
    const vrValidation = validateVRLessonData(lessonData);
    return vrValidation.isValid;
  }, [canLaunchLesson, lessonData, validateVRLessonData]);

  // Get VR validation error message for display
  const vrValidationError = useMemo(() => {
    if (!lessonData) return null;
    const vrValidation = validateVRLessonData(lessonData);
    if (!vrValidation.isValid && vrValidation.errors.length > 0) {
      return vrValidation.errors[0];
    }
    return null;
  }, [lessonData, validateVRLessonData]);

  // Check if VR is available
  const isVRAvailable = useMemo(() => {
    return vrCapabilities?.isVRSupported === true;
  }, [vrCapabilities]);

  // Get thumbnail
  const getThumbnail = useCallback((chapter) => {
    return chapter.topics?.find(t => t.skybox_url)?.skybox_url || null;
  }, []);

  // Lesson Detail Modal - Shows lesson info while loading data
  // Rendered as a stable component to prevent flickering
  const renderModal = () => {
    if (!selectedLesson) return null;
    
    const { chapter, topicInput } = selectedLesson;
    const thumbnail = chapter.topics?.find(t => t.skybox_url)?.skybox_url;
    const topic = topicInput || chapter.topics?.[0];
    const topicName = topic 
      ? (getTopicNameByLanguage(topic, selectedLanguage) || topic.topic_name || chapter.chapter_name)
      : (getChapterNameByLanguage(chapter, selectedLanguage) || chapter.chapter_name);
    const learningObjective = topic 
      ? (getLearningObjectiveByLanguage(topic, selectedLanguage) || topic.learning_objective || '')
      : '';
    const isCompleted = completedLessons[chapter.id];
    const quizScore = isCompleted?.quizScore;
    
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={closeLessonModal}
      >
        <div
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
              <p className={`text-sm font-medium mb-1 ${isCompleted ? 'text-emerald-400' : 'text-cyan-400'}`}>{getSubjectNameByLanguage(chapter.subject || '', selectedLanguage)}</p>
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

            {/* VR Status Section */}
            <div className={`mb-4 p-4 rounded-xl border ${
              isVRAvailable 
                ? 'bg-purple-500/10 border-purple-500/30' 
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isVRAvailable ? (
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Glasses className="w-5 h-5 text-purple-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${isVRAvailable ? 'text-purple-300' : 'text-amber-300'}`}>
                      {isVRAvailable ? 'VR Device Detected' : 'No VR Detected'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isVRAvailable 
                        ? `Ready for ${vrCapabilities.deviceType?.replace('-', ' ') || 'VR'}`
                        : 'Connect a VR headset for immersive experience'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={launchVRLesson}
                  disabled={!canLaunchVRLesson || !isVRAvailable}
                  title={vrValidationError || (!isVRAvailable ? 'VR headset not detected' : '')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    canLaunchVRLesson && isVRAvailable
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Glasses className="w-4 h-4" />
                  {!isVRAvailable 
                    ? 'No VR Detected'
                    : vrValidationError
                      ? 'No VR Assets'
                      : countdown > 0 
                        ? `Ready in ${countdown}s...`
                        : 'Launch in VR'}
                </button>
                {/* Show error tooltip if VR assets missing */}
                {vrValidationError && isVRAvailable && countdown === 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    {vrValidationError}
                  </p>
                )}
                
              </div>
            </div>

            {/* Countdown Progress */}
            {countdown > 0 && (
              <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-cyan-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-cyan-300">Preparing lesson data...</span>
                  <span className="text-lg font-bold text-cyan-400">{countdown}s</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${((10 - countdown) / 10) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Loading skybox, assets, and lesson content...</p>
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
                {countdown > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    Ready in {countdown}s...
                  </>
                ) : dataLoading ? (
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
                    Finalizing...
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
        </div>
      </div>
    );
  };

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - No animation to prevent flicker */}
        <div className="mb-6">
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
        </div>

        {/* Filters - No animation to prevent flicker */}
        <div className="mb-6 p-3 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800/50">
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
            
            {/* Language Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <span className="text-xs text-slate-400">Language:</span>
              <LanguageToggle
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                size="sm"
                showFlags={true}
              />
            </div>

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
        </div>

        {/* Content - No layout animation */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredChapters.map(chapter => (
              <ChapterCard 
                key={chapter.id} 
                chapter={chapter}
                completedLessons={completedLessons}
                onOpenModal={openLessonModal}
                getThumbnail={getThumbnail}
                selectedLanguage={selectedLanguage}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredChapters.map(chapter => (
              <ChapterListItem
                selectedLanguage={selectedLanguage} 
                key={chapter.id} 
                chapter={chapter}
                completedLessons={completedLessons}
                expandedChapters={expandedChapters}
                onOpenModal={openLessonModal}
                onToggleChapter={toggleChapter}
                onApprovalChange={handleApprovalChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lesson Detail Modal - Rendered outside AnimatePresence to prevent flicker */}
      {selectedLesson && renderModal()}
    </div>
  );
};

export default Lessons;
