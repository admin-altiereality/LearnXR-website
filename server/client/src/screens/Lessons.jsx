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

import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import {
    AlertCircle,
    BookOpen,
    Box,
    CheckCircle,
    CheckCircle2,
    Clock,
    Glasses,
    GraduationCap,
    Grid3X3,
    HelpCircle,
    List,
    Loader2,
    Mic,
    Play,
    RefreshCw,
    Search,
    Sparkles,
    Target,
    Trophy,
    Volume2,
    X,
    XCircle
} from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { LanguageToggle } from '../Components/LanguageSelector';
import { Button } from '../Components/ui/button';
import { Card, CardContent } from '../Components/ui/card';
import { Input } from '../Components/ui/input';
import { PrismFluxLoader } from '../Components/ui/prism-flux-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Components/ui/select';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesson } from '../contexts/LessonContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import {
    getChapterNameByLanguage,
    getLearningObjectiveByLanguage,
    getSubjectNameByLanguage,
    getTopicNameByLanguage
} from '../lib/firebase/utils/languageAvailability';
import { isAdminOnly, isSuperadmin } from '../utils/rbac';
import { getVRCapabilities } from '../utils/vrDetection';

// Guest student: fixed demo curriculum/class; only first lesson is unlocked
const GUEST_DEMO_CURRICULUM = 'CBSE';
const GUEST_DEMO_CLASS = 6;

// Content indicators (simple badges) - Memoized; theme tokens
const ContentBadges = memo(({ chapter }) => (
  <div className="flex items-center gap-1.5">
    {chapter.hasSkybox && (
      <div className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center" title="360° Skybox">
        <Sparkles className="w-3 h-3 text-primary" />
      </div>
    )}
    {chapter.hasScript && (
      <div className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center" title="Voice Script">
        <Volume2 className="w-3 h-3 text-primary" />
      </div>
    )}
    {chapter.hasAssets && (
      <div className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center" title="3D Assets">
        <Box className="w-3 h-3 text-primary" />
      </div>
    )}
    {chapter.hasMcqs && (
      <div className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center" title="Quiz Questions">
        <HelpCircle className="w-3 h-3 text-primary" />
      </div>
    )}
  </div>
));

// GRID VIEW - Lesson Card (Topic-based) - Memoized to prevent flickering
// Approval status is read-only (no approve/unapprove from this page - use Approvals page)
const LessonCard = memo(({ lessonItem, completedLessons, onOpenModal, getThumbnail, selectedLanguage = 'en', isLockedForGuest = false, onGuestSignup, onGuestLogin }) => {
  const { topic, chapter, chapterInfo } = lessonItem;
  const thumbnail = topic.skybox_url || chapter.topics?.find(t => t.skybox_url)?.skybox_url || null;
  const isCompleted = completedLessons[chapter.id];
  const quizScore = isCompleted?.quizScore;
  
  // Read-only approval status from topic or chapter (curriculum chapter collection)
  const approval = topic.approval || {};
  const isApproved = approval.approved === true || approval.approved === 'true' || topic.approved === true || chapter.approved === true;
  
  // Get language-specific topic name (primary) and chapter name (secondary)
  const topicName = getTopicNameByLanguage(topic, selectedLanguage) || topic.topic_name || 'Untitled Topic';
  const chapterName = getChapterNameByLanguage(chapter._rawData || chapter, selectedLanguage) || chapter.chapter_name;

  return (
    <div
      className={`h-full flex flex-col bg-card rounded-2xl border overflow-hidden border-border relative
                 transition-all duration-300 group
                 ${isLockedForGuest ? 'cursor-default' : 'cursor-pointer hover:shadow-lg hover:border-primary/50 hover:shadow-primary/10'}`}
      onClick={() => !isLockedForGuest && onOpenModal(chapter, topic)}
    >
      {isLockedForGuest && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-background/80 backdrop-blur-md p-4 pointer-events-auto text-center space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
            <p className="text-sm font-medium text-foreground">Sign up to unlock this lesson</p>
            <Button size="sm" className="shadow-lg" onClick={onGuestSignup}>
              Create free account
            </Button>
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <button type="button" onClick={onGuestLogin} className="text-primary underline hover:no-underline font-medium">
                Log in
              </button>
            </p>
        </div>
      )}
      <div className={isLockedForGuest ? 'pointer-events-none select-none blur-sm' : ''}>
      {/* Thumbnail - fixed aspect so card height is consistent */}
      <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-muted">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={topicName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {isCompleted && (
          <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
        )}
        
        {/* Badges: solid white text on dark pill — curriculum, class, chapter */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/80 border border-white/20">
              <span className="text-[10px] font-bold text-white antialiased">
                {chapterInfo.curriculum || '—'}
              </span>
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/80 border border-white/20">
              <span className="text-[10px] font-bold text-white antialiased">
                Class {chapterInfo.class ?? '—'}
              </span>
            </span>
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 border border-white/20">
                <Trophy className="w-3 h-3 text-white antialiased" />
                <span className="text-[10px] font-bold text-white antialiased">
                  {quizScore?.percentage != null ? `${quizScore.percentage}%` : 'Done'}
                </span>
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-black/80 border border-white/20">
              <span className="text-[10px] font-bold text-white antialiased">
                Ch {chapterInfo.chapterNumber ?? '—'}
              </span>
            </span>
          </div>
        </div>
        
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg bg-primary text-primary-foreground">
            <Play className="w-7 h-7 ml-0.5" />
          </div>
        </div>
      </div>
      
      {/* Content - fixed min height so all cards align */}
      <div className="flex flex-col flex-1 min-h-0 p-3">
        <div className="flex items-start gap-2 min-h-0">
          <h3 className="text-sm font-semibold line-clamp-2 transition-colors flex-1 text-foreground group-hover:text-primary">
            {topicName}
          </h3>
          {isCompleted && (
            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{getSubjectNameByLanguage(chapterInfo.subject || '', selectedLanguage)}</p>
        <p className="text-[10px] text-muted-foreground mb-1 line-clamp-1">{chapterName}</p>
        <div className="flex items-center justify-between mt-auto pt-1 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-muted-foreground">Topic {topic.topic_priority ?? '?'}</span>
            {isApproved ? (
              <span className="flex items-center gap-0.5 text-[10px] text-primary" title="Approved">
                <CheckCircle2 className="w-3 h-3" />
                Approved
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Not approved">
                <XCircle className="w-3 h-3" />
                Not approved
              </span>
            )}
          </div>
          <ContentBadges chapter={chapter} />
        </div>
      </div>
      </div>
    </div>
  );
});

// LIST VIEW - Topic Row - Memoized
// Approval status is read-only (no approve/unapprove from this page - use Approvals page)
const TopicRow = memo(({ topic, chapter, index, onOpenModal, selectedLanguage = 'en' }) => {
  const hasSkybox = !!topic.skybox_url || !!topic.skybox_id;
  const hasScript = !!(topic.topic_avatar_intro || topic.topic_avatar_explanation);
  
  // Get language-specific names
  const topicName = getTopicNameByLanguage(topic, selectedLanguage) || topic.topic_name || `Topic ${index + 1}`;
  const learningObjective = getLearningObjectiveByLanguage(topic, selectedLanguage) || topic.learning_objective;
  
  // Read-only approval status from topic or chapter (curriculum chapter collection)
  const approval = topic.approval || {};
  const isApproved = approval.approved === true || approval.approved === 'true' || topic.approved === true || chapter.approved === true;
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

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 ml-4 border-l-2 border-border 
                 hover:border-primary bg-card/50 hover:bg-card 
                 transition-all duration-200 cursor-pointer"
      onClick={() => onOpenModal(chapter, topic)}
    >
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
        {topic.topic_priority || index + 1}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors">
            {topicName}
          </h4>
          {/* Approval Status Badge */}
          {isApproved ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
              <XCircle className="w-3 h-3" />
              Not Approved
            </span>
          )}
        </div>
        {learningObjective && (
          <p className="text-xs text-muted-foreground truncate">{learningObjective}</p>
        )}
        {isApproved && approvedAt && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Approved {formatApprovedAt(approvedAt)}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-1.5">
        {hasSkybox && <Sparkles className="w-3.5 h-3.5 text-primary" />}
        {hasScript && <Volume2 className="w-3.5 h-3.5 text-primary" />}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(chapter, topic);
          }}
        >
          <Play className="w-3 h-3" />
          View
        </Button>
      </div>
    </div>
  );
});

// LIST VIEW - Lesson Item (Topic-based) - Memoized
// Approval status is read-only (no approve/unapprove from this page - use Approvals page)
const LessonListItem = memo(({ lessonItem, completedLessons, onOpenModal, selectedLanguage = 'en', isLockedForGuest = false, onGuestSignup, onGuestLogin }) => {
  const { topic, chapter, chapterInfo } = lessonItem;
  const isCompleted = completedLessons[chapter.id];
  const quizScore = isCompleted?.quizScore;
  
  // Read-only approval status from topic or chapter (curriculum chapter collection)
  const approval = topic.approval || {};
  const isApproved = approval.approved === true || approval.approved === 'true' || topic.approved === true || chapter.approved === true;
  
  // Get language-specific topic name (primary) and chapter name (secondary)
  const topicName = getTopicNameByLanguage(topic, selectedLanguage) || topic.topic_name || 'Untitled Topic';
  const chapterName = getChapterNameByLanguage(chapter._rawData || chapter, selectedLanguage) || chapter.chapter_name;
  const learningObjective = getLearningObjectiveByLanguage(topic, selectedLanguage) || topic.learning_objective;

  return (
    <Card className={`rounded-xl overflow-hidden border-border relative ${isCompleted ? 'border-primary/40' : ''} ${isLockedForGuest ? 'blur-sm' : ''}`}>
      {isLockedForGuest && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md p-4 pointer-events-auto text-center space-y-3 rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-medium text-foreground">Sign up to unlock this lesson</p>
          <Button size="sm" className="shadow-lg" onClick={onGuestSignup}>
            Create free account
          </Button>
          <p className="text-xs text-muted-foreground">
            Already have an account?{' '}
            <button type="button" onClick={onGuestLogin} className="text-primary underline hover:no-underline font-medium">
              Log in
            </button>
          </p>
        </div>
      )}
      <div 
        className={`flex items-center gap-4 p-4 transition-colors ${isLockedForGuest ? 'pointer-events-none' : 'cursor-pointer hover:bg-muted/50'}`}
        onClick={() => !isLockedForGuest && onOpenModal(chapter, topic)}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 border border-border">
          {isCompleted ? (
            <Trophy className="w-5 h-5 text-primary" />
          ) : (
            <span className="text-lg font-bold text-primary">{topic.topic_priority || '?'}</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] text-white font-semibold text-primary uppercase">{chapterInfo.curriculum}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-[10px] text-white font-medium text-muted-foreground">Class {chapterInfo.class}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-[10px] text-white font-medium text-muted-foreground">{getSubjectNameByLanguage(chapterInfo.subject || '', selectedLanguage)}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-[10px] text-white font-medium text-muted-foreground">Ch {chapterInfo.chapterNumber}</span>
            {isCompleted && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                  <CheckCircle className="w-3 h-3" />
                  {quizScore ? `${quizScore.percentage}%` : 'Completed'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold truncate text-foreground">{topicName}</h3>
            {isApproved ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                Approved
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border shrink-0">
                <XCircle className="w-3 h-3" />
                Not Approved
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mb-1">{chapterName}</p>
          {learningObjective && (
            <p className="text-xs text-muted-foreground truncate">{learningObjective}</p>
          )}
        </div>
        
        <ContentBadges chapter={chapter} />
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2 shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(chapter, topic);
            }}
          >
            <Play className="w-4 h-4" />
            {isCompleted ? 'Replay' : 'View'}
          </Button>
        </div>
      </div>
    </Card>
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
  const { user, profile, logout } = useAuth();
  const {
    joinedSessionId,
    joinedSession,
    joinSession,
    leaveSessionAsStudent,
    sessionLoading: sessionJoinLoading,
    sessionError: sessionJoinError,
    clearSessionError,
  } = useClassSession();
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const launchedLessonHandledRef = React.useRef(null);
  const launchedSceneHandledRef = React.useRef(null);
  
  // Student class data
  const [studentClasses, setStudentClasses] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const isStudent = profile?.role === 'student';
  const isTeacher = profile?.role === 'teacher';
  const isGuest = !!(profile?.isGuest === true && profile?.role === 'student');

  // Guest: logout then navigate so user can sign up or log in with a full account
  const handleGuestSignup = useCallback(async () => {
    try {
      await logout();
      navigate('/signup');
    } catch (e) {
      console.warn('Logout before signup failed:', e);
      navigate('/signup');
    }
  }, [logout, navigate]);
  const handleGuestLogin = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.warn('Logout before login failed:', e);
      navigate('/login');
    }
  }, [logout, navigate]);

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

  // Fetch student's classes to get class numbers for filtering
  useEffect(() => {
    if (!isStudent || !profile?.class_ids || profile.class_ids.length === 0 || !db) {
      setStudentClasses([]);
      return;
    }

    const fetchStudentClasses = async () => {
      try {
        const classesPromises = profile.class_ids.map(async (classId) => {
          try {
            const classDoc = await getDoc(doc(db, 'classes', classId));
            if (classDoc.exists()) {
              const classData = classDoc.data();
              return {
                id: classId,
                ...classData,
              };
            }
          } catch (err) {
            console.warn(`Error fetching class ${classId}:`, err);
          }
          return null;
        });

        const classesData = (await Promise.all(classesPromises)).filter(Boolean);
        setStudentClasses(classesData);

        // Set default class and curriculum filter if not already set
        if (classesData.length > 0) {
          const firstClass = classesData[0];
          
          // Extract class number from class_name (e.g., "Class 5" -> 5)
          if (!selectedClass) {
            const classNumberMatch = firstClass.class_name?.match(/\d+/);
            if (classNumberMatch) {
              setSelectedClass(classNumberMatch[0]);
            }
          }
          
          // Set curriculum from class if not already set
          if (!selectedCurriculum && firstClass.curriculum) {
            setSelectedCurriculum(firstClass.curriculum);
          }
        }
      } catch (error) {
        console.error('Error fetching student classes:', error);
      }
    };

    fetchStudentClasses();
  }, [isStudent, profile?.class_ids, db, selectedClass]);

  // Fetch teacher's classes to get class numbers for filtering
  useEffect(() => {
    if (!isTeacher || !profile?.managed_class_ids || profile.managed_class_ids.length === 0 || !db) {
      setTeacherClasses([]);
      return;
    }

    const fetchTeacherClasses = async () => {
      try {
        console.log('📚 Lessons: Fetching teacher classes', {
          teacherId: profile.uid,
          managedClassIds: profile.managed_class_ids,
        });

        const classesPromises = profile.managed_class_ids.map(async (classId) => {
          try {
            const classDoc = await getDoc(doc(db, 'classes', classId));
            if (classDoc.exists()) {
              const classData = classDoc.data();
              return {
                id: classId,
                ...classData,
              };
            }
          } catch (err) {
            console.warn(`Error fetching class ${classId}:`, err);
          }
          return null;
        });

        const classesData = (await Promise.all(classesPromises)).filter(Boolean);
        console.log('📚 Lessons: Teacher classes fetched', {
          count: classesData.length,
          classes: classesData.map(c => ({
            id: c.id,
            class_name: c.class_name,
            curriculum: c.curriculum,
          })),
        });
        setTeacherClasses(classesData);

        // Set default class and curriculum filter if not already set
        if (classesData.length > 0) {
          const firstClass = classesData[0];
          
          // Extract class number from class_name (e.g., "Class 5" -> 5)
          setSelectedClass(prev => {
            if (prev) return prev; // Don't override if already set
            const classNumberMatch = firstClass.class_name?.match(/\d+/);
            if (classNumberMatch) {
              const extractedClass = classNumberMatch[0];
              console.log('📚 Lessons: Setting teacher class filter', {
                className: firstClass.class_name,
                extractedClass,
              });
              return extractedClass;
            }
            return prev;
          });
          
          // Set curriculum from class if not already set
          setSelectedCurriculum(prev => {
            if (prev) return prev; // Don't override if already set
            if (firstClass.curriculum) {
              const normalizedCurriculum = firstClass.curriculum.toUpperCase().trim();
              console.log('📚 Lessons: Setting teacher curriculum filter', {
                original: firstClass.curriculum,
                normalized: normalizedCurriculum,
              });
              return normalizedCurriculum;
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error fetching teacher classes:', error);
      }
    };

    fetchTeacherClasses();
  }, [isTeacher, profile?.managed_class_ids, db]);

  // Fetch chapters from Firestore (basic list - no heavy data fetching)
  useEffect(() => {
    setLoading(true);
    
    if (!db) {
      setError('Database not initialized. Please refresh the page.');
      setLoading(false);
      return;
    }
    
    // For students and teachers: automatically filter by their class and curriculum
    let effectiveCurriculum = selectedCurriculum;
    let effectiveClass = selectedClass;
    
    const userClasses = isStudent ? studentClasses : (isTeacher ? teacherClasses : []);
    
    // Guest: use fixed demo curriculum/class; skip waiting for classes
    if (isGuest) {
      effectiveCurriculum = GUEST_DEMO_CURRICULUM;
      effectiveClass = String(GUEST_DEMO_CLASS);
    }
    
    // Wait for classes to load if user is student/teacher (not guest) and classes are expected
    if ((isStudent || isTeacher) && !isGuest && profile?.class_ids?.length > 0 && isStudent && studentClasses.length === 0) {
      console.log('⏳ Lessons: Waiting for student classes to load', { role: 'student', profileClassIds: profile?.class_ids?.length });
      return;
    }
    if ((isStudent || isTeacher) && profile?.managed_class_ids?.length > 0 && isTeacher && teacherClasses.length === 0) {
      console.log('⏳ Lessons: Waiting for teacher classes to load', { role: 'teacher', profileClassIds: profile?.managed_class_ids?.length });
      return;
    }
    
    if ((isStudent || isTeacher) && !isGuest && userClasses.length > 0) {
      // Use the first class's curriculum and class number
      const firstClass = userClasses[0];
      if (!effectiveCurriculum && firstClass.curriculum) {
        effectiveCurriculum = firstClass.curriculum.toUpperCase().trim();
      }
      if (!effectiveClass) {
        const classNumberMatch = firstClass.class_name?.match(/\d+/);
        if (classNumberMatch) {
          effectiveClass = classNumberMatch[0];
        }
      }
    }
    
    const constraints = [];
    if (effectiveCurriculum) {
      constraints.push(where('curriculum', '==', effectiveCurriculum.toUpperCase()));
    }
    if (effectiveClass) {
      constraints.push(where('class', '==', parseInt(effectiveClass)));
    }
    if (selectedSubject) {
      constraints.push(where('subject', '==', selectedSubject));
    }
    
    // For students and teachers (not guest): require both curriculum and class to be set
    if ((isStudent || isTeacher) && !isGuest && (!effectiveCurriculum || !effectiveClass)) {
      console.log(`⚠️ ${isStudent ? 'Student' : 'Teacher'} lessons: Missing curriculum or class filter`, {
        effectiveCurriculum,
        effectiveClass,
        userClasses: userClasses.length,
        profileClassIds: isStudent ? profile?.class_ids?.length : profile?.managed_class_ids?.length,
      });
      setChapters([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    // Note: We filter by topic-level approval in groupedTopicsByChapter
    // Don't filter by chapter-level approval here to allow showing topics from any chapter
    
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
  }, [selectedCurriculum, selectedClass, selectedSubject, selectedLanguage, isStudent, isTeacher, isGuest, studentClasses, teacherClasses, profile?.class_ids, profile?.managed_class_ids]);

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

  // Check if user can approve (admin or superadmin)
  const canApprove = profile && (isAdminOnly(profile) || isSuperadmin(profile));
  
  // Group topics by chapter and create lesson items
  // Each topic becomes a lesson, grouped by its parent chapter
  const groupedTopicsByChapter = useMemo(() => {
    // Extract all topics from chapters
    const allTopics = [];
    
    // For students and teachers: get class numbers and curriculum from their classes (guest uses demo values)
    const userClasses = isStudent ? studentClasses : (isTeacher ? teacherClasses : []);
    const userClassNumbers = isGuest
      ? [GUEST_DEMO_CLASS]
      : (isStudent || isTeacher) && userClasses.length > 0
        ? userClasses.map(c => {
            const match = c.class_name?.match(/\d+/);
            return match ? parseInt(match[0]) : null;
          }).filter(Boolean)
        : [];
    
    const userCurricula = isGuest
      ? [GUEST_DEMO_CURRICULUM.toUpperCase()]
      : (isStudent || isTeacher) && userClasses.length > 0
        ? [...new Set(userClasses.map(c => c.curriculum?.toUpperCase().trim()).filter(Boolean))]
        : [];
    
    chapters.forEach(chapter => {
      // For students and teachers: filter by their class numbers AND curriculum
      if (isStudent || isTeacher) {
        // If user has classes, only show chapters matching their classes
        if (userClassNumbers.length > 0) {
          if (!userClassNumbers.includes(chapter.class)) {
            return; // Skip chapters not in user's classes
          }
        } else {
          // If user has no classes yet, don't show any lessons
          return;
        }
        
        // Also filter by curriculum if user's classes have curriculum (normalize for comparison)
        if (userCurricula.length > 0) {
          const chapterCurriculum = chapter.curriculum?.toUpperCase().trim();
          if (!userCurricula.includes(chapterCurriculum)) {
            return; // Skip chapters not matching user's curriculum
          }
        }
      }
      
      if (chapter.topics && Array.isArray(chapter.topics)) {
        chapter.topics.forEach(topic => {
          // For /lessons page:
          // - Admins/superadmins can see ALL topics (for approval management)
          // - Students can ONLY see APPROVED topics (teacher approval required)
          // - Other regular users only see APPROVED topics
          const approval = topic.approval || {};
          // Handle both boolean true and string "true" for approval
          const isTopicApproved = approval.approved === true || approval.approved === 'true' || topic.approved === true;
          const isChapterApproved = chapter.approved === true;
          
          // Check if topic has an approval field (not empty object)
          const hasTopicApproval = topic.approval && typeof topic.approval === 'object' && Object.keys(topic.approval).length > 0;
          
          // Topic visibility: individually approved topics visible to students/teachers
          // Fallback: topic with no approval field shows when chapter is approved (legacy content)
          const shouldShowTopic = isTopicApproved || (isChapterApproved && !hasTopicApproval);
          
          if (canApprove) {
            // Admins/superadmins see all topics (including unapproved, to manage approval)
            allTopics.push({
              topic,
              chapter,
            });
          } else if (isStudent || isTeacher) {
            // Students and teachers: approved topics OR legacy (chapter approved, no topic approval field)
            if (shouldShowTopic) {
              allTopics.push({
                topic,
                chapter,
              });
            }
          } else if (shouldShowTopic) {
            // Other users: same visibility rule
            allTopics.push({
              topic,
              chapter,
            });
          }
        });
      }
    });
    
    console.log('📚 Grouped topics:', {
      totalChapters: chapters.length,
      totalTopics: allTopics.length,
      canApprove,
      sampleTopic: allTopics[0] ? {
        topicId: allTopics[0].topic.topic_id,
        topicName: allTopics[0].topic.topic_name,
        approved: allTopics[0].topic.approval?.approved,
      } : null,
    });
    
    // Group topics by chapter key (curriculum/class/subject/chapter_number)
    const groups = new Map();
    
    allTopics.forEach(({ topic, chapter }) => {
      const groupKey = `${chapter.curriculum || ''}_${chapter.class || ''}_${chapter.subject || ''}_${chapter.chapter_number || ''}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          curriculum: chapter.curriculum || '',
          class: chapter.class || 0,
          subject: chapter.subject || '',
          chapterNumber: chapter.chapter_number || 0,
          chapterName: chapter.chapter_name || '',
          chapterId: chapter.id,
          chapterData: chapter,
          topics: [],
        });
      }
      
      const group = groups.get(groupKey);
      group.topics.push({
        topic,
        chapter,
        topicPriority: topic.topic_priority || 999,
      });
    });
    
    // Sort groups by chapter sequence (curriculum, class, subject, chapter_number)
    // Apply the same sorting for students and teachers
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.curriculum !== b.curriculum) return a.curriculum.localeCompare(b.curriculum);
      if (a.class !== b.class) return a.class - b.class;
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return a.chapterNumber - b.chapterNumber;
    });
    
    // Sort topics within each group by priority
    // Apply the same sorting for students and teachers
    sortedGroups.forEach(group => {
      group.topics.sort((a, b) => {
        if (a.topicPriority !== b.topicPriority) {
          return a.topicPriority - b.topicPriority;
        }
        return 0;
      });
    });
    
    return sortedGroups;
  }, [chapters, canApprove, isStudent, isTeacher, isGuest, studentClasses, teacherClasses]);
  
  // Flatten grouped topics into lesson items for display
  const lessonItems = useMemo(() => {
    const items = [];
    
    groupedTopicsByChapter.forEach(group => {
      group.topics.forEach(({ topic, chapter }) => {
        items.push({
          topic,
          chapter,
          groupKey: `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`,
          chapterInfo: {
            curriculum: group.curriculum,
            class: group.class,
            subject: group.subject,
            chapterNumber: group.chapterNumber,
            chapterName: group.chapterName,
            chapterId: group.chapterId,
          },
        });
      });
    });
    
    console.log('📦 Lesson items created:', {
      totalItems: items.length,
      sampleItem: items[0] ? {
        topicName: items[0].topic.topic_name,
        chapterName: items[0].chapter.chapter_name,
        groupKey: items[0].groupKey,
      } : null,
    });
    
    return items;
  }, [groupedTopicsByChapter]);
  
  // Search/filter - use language-specific names
  const filteredLessonItems = useMemo(() => {
    let result = lessonItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        const topicName = getTopicNameByLanguage(item.topic, selectedLanguage) || item.topic.topic_name || '';
        const chapterName = getChapterNameByLanguage(item.chapter._rawData || item.chapter, selectedLanguage) || item.chapter.chapter_name || '';
        const matchesTopicName = topicName.toLowerCase().includes(q);
        const matchesChapterName = chapterName.toLowerCase().includes(q);
        const matchesSubject = item.chapter.subject?.toLowerCase().includes(q);
        return matchesTopicName || matchesChapterName || matchesSubject;
      });
    }
    return result;
  }, [lessonItems, searchQuery, selectedLanguage]);

  // Guest: only the first lesson is unlocked; key = chapterId_topicId
  const guestUnlockedLessonKey = useMemo(() => {
    if (!isGuest || lessonItems.length === 0) return null;
    const first = lessonItems[0];
    return `${first.chapter.id}_${first.topic.topic_id}`;
  }, [isGuest, lessonItems]);

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
      
      const isAssociate = profile?.role === 'associate';
      
      // Fetch complete lesson bundle for selected language
      // When Associate: overlay their latest unapproved draft so they see their edits after refresh
      const bundle = await getLessonBundle({
        chapterId: chapter.id,
        lang: selectedLanguage,
        topicId: topicInput?.topic_id,
        ...(isAssociate && user?.uid ? { userId: user.uid, userRole: 'associate' } : {}),
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
  }, [selectedLanguage, profile?.role, user?.uid]);

  // When teacher launches a lesson to the class, fetch bundle and open XR player
  React.useEffect(() => {
    const launched = joinedSession?.launched_lesson;
    if (!launched || !joinedSessionId || !user?.uid) return;
    const key = `${launched.chapter_id}_${launched.topic_id}`;
    if (launchedLessonHandledRef.current === key) return;
    launchedLessonHandledRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const { getLessonBundle } = await import('../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({
          chapterId: launched.chapter_id,
          lang: selectedLanguage,
          topicId: launched.topic_id,
        });
        if (cancelled) return;
        const fullData = bundle.chapter;
        const topic = fullData.topics?.find((t) => t.topic_id === launched.topic_id) || fullData.topics?.[0];
        if (!topic) return;
        const scripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
        let assetUrls = topic.asset_urls || [];
        const assetIds = topic.asset_ids || [];
        const safeAssets3d = Array.isArray(bundle.assets3d) ? bundle.assets3d : [];
        safeAssets3d.forEach((asset) => {
          if (asset?.glb_url && !assetUrls.includes(asset.glb_url)) {
            assetUrls.push(asset.glb_url);
            assetIds.push(asset.id || `asset_${assetUrls.length}`);
          }
        });
        const safeMcqs = Array.isArray(bundle.mcqs) ? bundle.mcqs : [];
        const mcqs = safeMcqs.map((m) => ({
          id: m.id || `mcq_${Math.random()}`,
          question: m.question || m.question_text || '',
          options: Array.isArray(m.options) ? m.options : [],
          correct_option_index: m.correct_option_index ?? 0,
          explanation: m.explanation || '',
        }));
        const safeTts = Array.isArray(bundle.tts) ? bundle.tts : [];
        const ttsAudio = safeTts
          .map((tts) => ({
            id: tts.id || '',
            script_type: tts.script_type || tts.section || 'full',
            audio_url: tts.audio_url || tts.audioUrl || tts.url || '',
            language: tts.language || tts.lang || selectedLanguage,
          }))
          .filter((tts) => (tts.language || 'en').toLowerCase() === selectedLanguage.toLowerCase());
        const skyboxUrl = bundle.skybox?.imageUrl || bundle.skybox?.file_url || topic.skybox_url || '';
        const skyboxGlb = bundle.skybox?.stored_glb_url || bundle.skybox?.glb_url || topic.skybox_glb_url || '';

        const cleanChapter = {
          chapter_id: String(launched.chapter_id),
          chapter_name: fullData.chapter_name || 'Untitled Chapter',
          chapter_number: Number(fullData.chapter_number) || 1,
          curriculum: String(launched.curriculum || fullData.curriculum || ''),
          class_name: String((launched.class_name || fullData.class_name) ?? ''),
          subject: String((launched.subject || fullData.subject) ?? ''),
        };
        const cleanTopic = {
          topic_id: String(topic.topic_id ?? launched.topic_id),
          topic_name: topic.topic_name || 'Untitled Topic',
          topic_priority: Number(topic.topic_priority) || 1,
          learning_objective: topic.learning_objective || '',
          skybox_id: bundle.skybox?.id ?? topic.skybox_id ?? null,
          skybox_remix_id: topic.skybox_remix_id ?? null,
          skybox_url: skyboxUrl,
          skybox_glb_url: skyboxGlb,
          avatar_intro: scripts.intro || '',
          avatar_explanation: scripts.explanation || '',
          avatar_outro: scripts.outro || '',
          asset_urls: assetUrls,
          asset_ids: assetIds,
          mcq_ids: topic.mcq_ids || [],
          mcqs,
          tts_ids: topic.tts_ids || [],
          tts_audio_url: topic.tts_audio_url || '',
          ttsAudio,
          language: selectedLanguage,
        };
        const fullLessonData = {
          chapter: cleanChapter,
          topic: cleanTopic,
          image3dasset: fullData.image3dasset ?? null,
          meshy_asset_ids: fullData.meshy_asset_ids ?? [],
          assets3d: safeAssets3d,
          startedAt: new Date().toISOString(),
          _meta: { assets3d: safeAssets3d, meshy_asset_ids: fullData.meshy_asset_ids || [] },
          language: selectedLanguage,
          ttsAudio,
        };
        sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
        sessionStorage.setItem('learnxr_class_session_id', joinedSessionId);
        if (typeof contextStartLesson === 'function') contextStartLesson(cleanChapter, cleanTopic);
        // Short delay so third-party iframes (e.g. Firebase Auth) can finish and avoid "message port closed" errors
        setTimeout(() => navigate('/xrlessonplayer'), 200);
      } catch (err) {
        console.error('Failed to open launched lesson:', err);
        launchedLessonHandledRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, [joinedSession?.launched_lesson, joinedSessionId, user?.uid, selectedLanguage, navigate, contextStartLesson]);

  // When teacher sends a scene to the class, open class-scene viewer
  React.useEffect(() => {
    const scene = joinedSession?.launched_scene;
    if (!scene || scene.type !== 'create_scene' || !joinedSessionId || !user?.uid) return;
    const key = `scene_${joinedSessionId}_${scene.skybox_image_url || scene.skybox_id || 'default'}`;
    if (launchedSceneHandledRef.current === key) return;
    launchedSceneHandledRef.current = key;
    try {
      sessionStorage.setItem('learnxr_launched_scene', JSON.stringify(scene));
      sessionStorage.setItem('learnxr_class_session_id', joinedSessionId);
      setTimeout(() => navigate('/class-scene'), 200);
    } catch (e) {
      console.error('Failed to open launched scene:', e);
      launchedSceneHandledRef.current = null;
    }
  }, [joinedSession?.launched_scene, joinedSessionId, user?.uid, navigate]);

  // Show session join error
  React.useEffect(() => {
    if (sessionJoinError) {
      toast.error(sessionJoinError);
      clearSessionError();
    }
  }, [sessionJoinError, clearSessionError]);

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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm overflow-y-auto"
        onClick={closeLessonModal}
      >
        <div
          className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card rounded-2xl border shadow-2xl overflow-hidden border-border my-auto ${isCompleted ? 'ring-2 ring-primary/30' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeLessonModal}
            className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/90 text-foreground hover:bg-muted shadow-sm"
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Hero */}
          <div className="relative h-36 sm:h-44 flex-shrink-0 overflow-hidden">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <GraduationCap className="w-14 h-14 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            {isCompleted && <div className="absolute inset-0 bg-primary/5 pointer-events-none" />}

            <div className="absolute top-3 left-4 flex flex-wrap gap-2">
              {isCompleted && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Trophy className="w-3 h-3" />
                  {quizScore ? `${quizScore.percentage}%` : 'Done'}
                </span>
              )}
              <span className="px-2.5 py-1 text-[11px] text-white font-semibold rounded-full bg-primary/25 border border-primary/40 backdrop-blur-sm">
                {chapter.curriculum}
              </span>
              <span className="px-2.5 py-1 text-[11px] text-white font-semibold rounded-full bg-primary/25 border border-primary/40 backdrop-blur-sm">
                Class {chapter.class}
              </span>
              <span className="px-2.5 py-1 text-[11px] text-white font-medium rounded-full bg-background/60 border border-white/20 backdrop-blur-sm">
                Ch. {chapter.chapter_number}
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">
                {getSubjectNameByLanguage(chapter.subject || '', selectedLanguage)}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight drop-shadow-sm">
                {topicName}
              </h2>
            </div>
          </div>

          {/* Content - single scroll area */}
          <div className="px-5 sm:px-6 pt-4 pb-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
            {learningObjective && (
              <div className="flex gap-3 p-4 rounded-xl bg-muted/40 border border-border">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Learning objective
                  </p>
                  <p className="text-sm text-foreground leading-snug">{learningObjective}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
                Content
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'skybox', has: lessonData?._meta?.hasSkybox || chapter.hasSkybox, Icon: Sparkles, label: '360° View' },
                  { key: 'script', has: lessonData?._meta?.hasScript || chapter.hasScript, Icon: Mic, label: 'Narration', sub: lessonData?._meta?.scriptSections ? `${lessonData._meta.scriptSections} sections` : null },
                  { key: 'assets', has: lessonData?._meta?.hasAssets || chapter.hasAssets, Icon: Box, label: '3D Assets' },
                  { key: 'mcqs', has: lessonData?._meta?.hasMcqs || chapter.hasMcqs, Icon: HelpCircle, label: 'Quiz' },
                ].map(({ key, has, Icon, label, sub }) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${has ? 'bg-primary/5 border-primary/25 hover:bg-primary/10' : 'bg-muted/30 border-border'}`}
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${has ? 'bg-primary/15' : 'bg-muted'}`}>
                      <Icon className={`w-4 h-4 ${has ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{label}</p>
                      <p className={`text-[11px] font-semibold truncate ${has ? 'text-primary' : 'text-muted-foreground'}`}>
                        {sub || (has ? 'Available' : '—')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {dataError && (
              <div className="flex gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/25">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Unable to load lesson</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{dataError}</p>
                </div>
              </div>
            )}

            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border ${isVRAvailable ? 'bg-primary/5 border-primary/25' : 'bg-muted/30 border-border'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVRAvailable ? 'bg-primary/15' : 'bg-muted'}`}>
                  <Glasses className={`w-5 h-5 ${isVRAvailable ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isVRAvailable ? 'text-primary' : 'text-foreground'}`}>
                    {isVRAvailable ? 'VR ready' : 'No VR detected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isVRAvailable ? (vrCapabilities?.deviceType?.replace('-', ' ') || 'VR') : 'Connect a headset for immersive mode'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 sm:items-end">
                <Button
                  size="sm"
                  variant={isVRAvailable && canLaunchVRLesson ? 'default' : 'secondary'}
                  onClick={launchVRLesson}
                  disabled={!canLaunchVRLesson || !isVRAvailable}
                  title={vrValidationError || (!isVRAvailable ? 'VR headset not detected' : '')}
                  className="w-full sm:w-auto"
                >
                  <Glasses className="w-3.5 h-3.5" />
                  {!isVRAvailable ? 'No VR' : vrValidationError ? 'No VR assets' : countdown > 0 ? `Ready in ${countdown}s` : 'Launch in VR'}
                </Button>
                {vrValidationError && isVRAvailable && countdown === 0 && (
                  <p className="text-[11px] text-destructive text-right">{vrValidationError}</p>
                )}
              </div>
            </div>

            {countdown > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/25">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Preparing lesson</span>
                  <span className="text-sm font-bold tabular-nums text-primary">{countdown}s</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${((10 - countdown) / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Skybox, assets & content</p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
              <Button
                variant="outline"
                className="sm:flex-1 border-border h-11"
                onClick={closeLessonModal}
              >
                Cancel
              </Button>
              <Button
                className="sm:flex-1 h-11 gap-2 font-semibold"
                onClick={launchLesson}
                disabled={!canLaunchLesson}
              >
                {countdown > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    Ready in {countdown}s…
                  </>
                ) : dataLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing…
                  </>
                ) : dataError ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    {dataError.length > 30 ? 'Unavailable' : dataError}
                  </>
                ) : canLaunchLesson ? (
                  <>
                    <Play className="w-4 h-4" />
                    {isCompleted ? 'Replay' : 'Launch lesson'}
                  </>
                ) : dataReady && !canLaunchLesson ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Incomplete data
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finalizing…
                  </>
                )}
              </Button>
            </div>

            {dataLoading && !countdown && (
              <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Fetching content…
              </p>
            )}
            {dataReady && !dataError && !dataLoading && (
              <p className="text-center text-xs text-primary font-medium flex items-center justify-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Lesson ready to launch
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Available Lessons</h1>
                <p className="text-xs text-muted-foreground">Click any lesson to start learning</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 p-1 bg-card rounded-lg border border-border">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Join class session - students only */}
        {isStudent && (
          <Card className="mb-6 rounded-xl border-primary/30 border bg-card">
            <CardContent className="p-4">
              {!joinedSessionId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Join class session (enter code from your teacher):</span>
                  <Input
                    type="text"
                    value={sessionCodeInput}
                    onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123"
                    className="w-28 font-mono uppercase tracking-wider bg-background border-border"
                    maxLength={8}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const ok = await joinSession(sessionCodeInput.trim());
                      if (ok) setSessionCodeInput('');
                    }}
                    disabled={sessionJoinLoading || !sessionCodeInput.trim()}
                  >
                    {sessionJoinLoading ? 'Joining…' : 'Join'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-primary font-medium">Joined. Waiting for teacher to launch a lesson or scene…</span>
                  <Button size="sm" variant="outline" onClick={leaveSessionAsStudent}>
                    Leave session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6 rounded-xl border-border">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              
              {!isStudent && !isTeacher && (
                <Select
                  value={selectedCurriculum || '__all__'}
                  onValueChange={(v) => {
                    setSelectedCurriculum(v === '__all__' ? '' : v);
                    setSelectedClass('');
                    setSelectedSubject('');
                  }}
                >
                  <SelectTrigger className="w-[140px] bg-background border-border text-foreground">
                    <SelectValue placeholder="All Curricula" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Curricula</SelectItem>
                    {availableCurricula.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(isStudent || isTeacher) && (isStudent ? studentClasses : teacherClasses).length > 0 && (
                <div className="px-3 py-2 bg-muted border border-border rounded-md text-sm text-muted-foreground min-w-[120px]">
                  {selectedCurriculum || (isStudent ? studentClasses : teacherClasses)[0]?.curriculum || 'N/A'} (Locked)
                </div>
              )}

              {!isStudent && !isTeacher && (
                <Select
                  value={selectedClass || '__all__'}
                  onValueChange={(v) => {
                    setSelectedClass(v === '__all__' ? '' : v);
                    setSelectedSubject('');
                  }}
                  disabled={!selectedCurriculum}
                >
                  <SelectTrigger className="w-[120px] bg-background border-border text-foreground">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Classes</SelectItem>
                    {availableClasses.map(c => (
                      <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(isStudent || isTeacher) && (isStudent ? studentClasses : teacherClasses).length > 0 && (
                <div className="px-3 py-2 bg-muted border border-border rounded-md text-sm text-muted-foreground min-w-[100px]">
                  Class {selectedClass || (isStudent ? studentClasses : teacherClasses)[0]?.class_name?.match(/\d+/)?.[0] || 'N/A'} (Locked)
                </div>
              )}

              <Select
                value={selectedSubject || '__all__'}
                onValueChange={(v) => setSelectedSubject(v === '__all__' ? '' : v)}
                disabled={!selectedClass}
              >
                <SelectTrigger className="w-[140px] bg-background border-border text-foreground">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Subjects</SelectItem>
                  {availableSubjects.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md">
                <span className="text-xs text-muted-foreground">Language:</span>
                <LanguageToggle
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                  size="sm"
                  showFlags={true}
                />
              </div>

              {(selectedCurriculum || selectedClass || selectedSubject || searchQuery) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedCurriculum('');
                    setSelectedClass('');
                    setSelectedSubject('');
                    setSearchQuery('');
                  }}
                >
                  Clear
                </Button>
              )}

              <div className="ml-auto px-3 py-1.5 bg-muted rounded-md border border-border">
                <span className="text-sm font-medium text-primary">{filteredLessonItems.length}</span>
                <span className="text-sm text-muted-foreground ml-1">lessons</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {error ? (
          <Card className="rounded-xl border-border border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">Error</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => window.location.reload()} className="border-border">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card className="rounded-xl border-border">
            <CardContent className="py-20">
              <PrismFluxLoader statuses={['Loading lessons…', 'Fetching curriculum…', 'Syncing topics…']} />
            </CardContent>
          </Card>
        ) : filteredLessonItems.length === 0 ? (
          <Card className="rounded-xl border-border">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Lessons Found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="space-y-6">
            {/* Group topics by chapter and display as stacked cards */}
            {groupedTopicsByChapter.map((group) => {
              const groupItems = filteredLessonItems.filter(item => 
                item.groupKey === `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`
              );
              
              if (groupItems.length === 0) return null;
              
              const chapterName = getChapterNameByLanguage(group.chapterData._rawData || group.chapterData, selectedLanguage) || group.chapterName;
              
              return (
                <div key={group.groupKey || `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`} className="space-y-3">
                  {/* Chapter Header */}
                  <div className="px-4 py-3 bg-card rounded-xl border border-border backdrop-blur-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-primary uppercase">{group.curriculum}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-muted-foreground">Class {group.class}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-muted-foreground">{getSubjectNameByLanguage(group.subject || '', selectedLanguage)}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm font-semibold text-foreground">Chapter {group.chapterNumber}: {chapterName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">({groupItems.length} topic{groupItems.length !== 1 ? 's' : ''})</span>
                    </div>
                  </div>
                  
                  {/* Same-size cards: aspect ~10px shorter than 5/6 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupItems.map((lessonItem, index) => {
                      const itemKey = `${lessonItem.chapter.id}_${lessonItem.topic.topic_id}`;
                      const isLockedForGuest = isGuest && guestUnlockedLessonKey !== null && guestUnlockedLessonKey !== itemKey;
                      return (
                      <div
                        key={`${itemKey}_${index}`}
                        className="w-full min-w-0"
                        style={{ aspectRatio: '25 / 27' }}
                      >
                        <LessonCard 
                          lessonItem={lessonItem}
                          completedLessons={completedLessons}
                          onOpenModal={openLessonModal}
                          getThumbnail={getThumbnail}
                          selectedLanguage={selectedLanguage}
                          isLockedForGuest={isLockedForGuest}
                          onGuestSignup={handleGuestSignup}
                          onGuestLogin={handleGuestLogin}
                        />
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Group lessons by chapter for visual organization */}
            {groupedTopicsByChapter.map((group) => {
              const groupItems = filteredLessonItems.filter(item => 
                item.groupKey === `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`
              );
              
              if (groupItems.length === 0) return null;
              
              const chapterName = getChapterNameByLanguage(group.chapterData._rawData || group.chapterData, selectedLanguage) || group.chapterName;
              
              return (
                <div key={group.groupKey || `${group.curriculum}_${group.class}_${group.subject}_${group.chapterNumber}`} className="space-y-2">
                  {/* Chapter Header */}
                  <div className="px-4 py-2 bg-card/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary uppercase">{group.curriculum}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-muted-foreground">Class {group.class}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-muted-foreground">{getSubjectNameByLanguage(group.subject || '', selectedLanguage)}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm font-semibold text-foreground">Chapter {group.chapterNumber}: {chapterName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">({groupItems.length} topic{groupItems.length !== 1 ? 's' : ''})</span>
                    </div>
                  </div>
                  {/* Topic Items */}
                  {groupItems.map((lessonItem, index) => {
                    const itemKey = `${lessonItem.chapter.id}_${lessonItem.topic.topic_id}`;
                    const isLockedForGuest = isGuest && guestUnlockedLessonKey !== null && guestUnlockedLessonKey !== itemKey;
                    return (
                    <LessonListItem
                      key={`${itemKey}_${index}`}
                      lessonItem={lessonItem}
                      completedLessons={completedLessons}
                      onOpenModal={openLessonModal}
                      selectedLanguage={selectedLanguage}
                      isLockedForGuest={isLockedForGuest}
                      onGuestSignup={handleGuestSignup}
                      onGuestLogin={handleGuestLogin}
                    />
                  );})}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lesson Detail Modal - Rendered outside AnimatePresence to prevent flicker */}
      {selectedLesson && renderModal()}
    </div>
  );
};

export default Lessons;