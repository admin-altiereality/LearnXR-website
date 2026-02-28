/**
 * Student Dashboard
 * 
 * Displays lessons the student has launched/enrolled in, personal progress,
 * scores, and completion status. Students can ONLY see their own data.
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { useLesson } from '../../contexts/LessonContext';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { LessonLaunch, StudentScore, Class, UserProfile } from '../../types/lms';
import { getStudentEvaluation, type StudentEvaluation } from '../../services/evaluationService';
import { FaBook, FaChartLine, FaCheckCircle, FaClock, FaGraduationCap, FaChalkboardTeacher, FaUsers, FaKey } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../Components/ui/card';
import { Badge } from '../../Components/ui/badge';
import { Progress } from '../../Components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../Components/ui/avatar';
import { Button } from '../../Components/ui/button';
import { Input } from '../../Components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const GUEST_AVATAR_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=LearnXRGuest';

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { startLesson: contextStartLesson } = useLesson();
  const {
    joinedSessionId,
    joinedSession,
    joinSession,
    leaveSessionAsStudent,
    sessionLoading: sessionJoinLoading,
    sessionError: sessionJoinError,
    clearSessionError,
  } = useClassSession();
  const isGuest = profile?.isGuest === true && profile?.role === 'student';
  const [lessonLaunches, setLessonLaunches] = useState<LessonLaunch[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classTeachers, setClassTeachers] = useState<Map<string, UserProfile>>(new Map());
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const launchedLessonHandledRef = useRef<string | null>(null);
  const launchedSceneHandledRef = useRef<string | null>(null);
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    averageScore: 0,
    totalAttempts: 0,
  });
  const [evaluation, setEvaluation] = useState<StudentEvaluation | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid || !profile) return;

    setLoading(true);

    // Subscribe to lesson launches (only student's own)
    const launchesQuery = query(
      collection(db, 'lesson_launches'),
      where('student_id', '==', user.uid),
      orderBy('launched_at', 'desc')
    );

    const unsubscribeLaunches = onSnapshot(launchesQuery, (snapshot) => {
      const launches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as LessonLaunch[];
      setLessonLaunches(launches);
      updateStats(launches, scores);
    }, (error) => {
      console.error('Error fetching lesson launches:', error);
      setLoading(false);
    });

    // Subscribe to student scores (only student's own)
    const scoresQuery = query(
      collection(db, 'student_scores'),
      where('student_id', '==', user.uid),
      orderBy('completed_at', 'desc')
    );

    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
      const scoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentScore[];
      setScores(scoresData);
      updateStats(lessonLaunches, scoresData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching scores:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeLaunches();
      unsubscribeScores();
    };
  }, [user?.uid, profile]);

  // When teacher launches a lesson to the class, fetch bundle and open XR player
  useEffect(() => {
    const launched = joinedSession?.launched_lesson;
    if (!launched || !joinedSessionId || !user?.uid) return;
    const key = `${launched.chapter_id}_${launched.topic_id}`;
    if (launchedLessonHandledRef.current === key) return;
    launchedLessonHandledRef.current = key;

    const effectiveLang = launched.lang ?? 'en';
    let cancelled = false;
    (async () => {
      try {
        const { getLessonBundle } = await import('../../services/firestore/getLessonBundle');
        const bundle = await getLessonBundle({
          chapterId: launched.chapter_id,
          lang: effectiveLang,
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
            language: tts.language || tts.lang || effectiveLang,
          }))
          .filter((tts) => (tts.language || 'en').toLowerCase() === effectiveLang.toLowerCase());
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
          language: effectiveLang,
        };
        const fullLessonData = {
          chapter: cleanChapter,
          topic: cleanTopic,
          image3dasset: fullData.image3dasset ?? null,
          meshy_asset_ids: fullData.meshy_asset_ids ?? [],
          assets3d: safeAssets3d,
          startedAt: new Date().toISOString(),
          _meta: { assets3d: safeAssets3d, meshy_asset_ids: fullData.meshy_asset_ids || [] },
          language: effectiveLang,
          ttsAudio,
        };
        sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
        sessionStorage.setItem('learnxr_class_session_id', joinedSessionId);
        if (typeof contextStartLesson === 'function') contextStartLesson(cleanChapter, cleanTopic);
        setTimeout(() => navigate('/vrlessonplayer-krpano'), 200);
      } catch (err) {
        console.error('Failed to open launched lesson:', err);
        launchedLessonHandledRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, [joinedSession?.launched_lesson, joinedSessionId, user?.uid, navigate, contextStartLesson]);

  // When teacher sends a scene to the class, open class-scene viewer
  useEffect(() => {
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
  useEffect(() => {
    if (sessionJoinError) {
      toast.error(sessionJoinError);
      clearSessionError();
    }
  }, [sessionJoinError, clearSessionError]);

  // Fetch student's classes and their teachers (skip for guest)
  useEffect(() => {
    if (!profile?.uid || profile?.isGuest || !profile?.class_ids || profile.class_ids.length === 0) {
      setClasses([]);
      setClassTeachers(new Map());
      return;
    }

    console.log('🔍 StudentDashboard: Fetching classes and teachers', {
      studentId: profile.uid,
      classIds: profile.class_ids,
    });

    const unsubscribes: (() => void)[] = [];
    const classesData: Class[] = [];
    const teacherMap = new Map<string, UserProfile>();

    // Set up real-time listeners for each class
    for (const classId of profile.class_ids) {
      try {
        const classRef = doc(db, 'classes', classId);
        const unsubscribe = onSnapshot(classRef, async (classDoc) => {
          if (classDoc.exists()) {
            const classData = { id: classDoc.id, ...classDoc.data() } as Class;
            
            // Update classes array
            const existingIndex = classesData.findIndex(c => c.id === classId);
            if (existingIndex >= 0) {
              classesData[existingIndex] = classData;
            } else {
              classesData.push(classData);
            }
            setClasses([...classesData]);

            // Fetch teacher if class_teacher_id is set
            if (classData.class_teacher_id) {
              try {
                const teacherDoc = await getDoc(doc(db, 'users', classData.class_teacher_id));
                if (teacherDoc.exists()) {
                  const teacherData = { uid: teacherDoc.id, ...teacherDoc.data() } as UserProfile;
                  teacherMap.set(classId, teacherData);
                  setClassTeachers(new Map(teacherMap));
                  console.log('✅ StudentDashboard: Teacher loaded', {
                    classId,
                    teacherId: classData.class_teacher_id,
                    teacherName: teacherData.name || teacherData.displayName,
                  });
                }
              } catch (err) {
                console.warn(`Error fetching teacher ${classData.class_teacher_id} for class ${classId}:`, err);
              }
            } else {
              // Remove teacher from map if class_teacher_id is cleared
              teacherMap.delete(classId);
              setClassTeachers(new Map(teacherMap));
              console.log('⚠️ StudentDashboard: Class has no class_teacher_id', { classId });
            }
          } else {
            // Class doesn't exist, remove it
            const index = classesData.findIndex(c => c.id === classId);
            if (index >= 0) {
              classesData.splice(index, 1);
              setClasses([...classesData]);
            }
            teacherMap.delete(classId);
            setClassTeachers(new Map(teacherMap));
          }
        }, (error) => {
          console.error(`Error listening to class ${classId}:`, error);
        });
        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.warn(`Error setting up listener for class ${classId}:`, err);
      }
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [profile?.uid, profile?.class_ids]);

  const updateStats = (launches: LessonLaunch[], scoresData: StudentScore[]) => {
    const totalLessons = launches.length;
    const completedLessons = launches.filter(l => l.completion_status === 'completed').length;
    const totalAttempts = scoresData.length;
    const averageScore = scoresData.length > 0
      ? scoresData.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scoresData.length
      : 0;

    setStats({
      totalLessons,
      completedLessons,
      averageScore: Math.round(averageScore),
      totalAttempts,
    });
  };

  useEffect(() => {
    if (!user?.uid || !profile) return;
    setEvaluationLoading(true);
    getStudentEvaluation(user.uid)
      .then(setEvaluation)
      .catch(() => setEvaluation(null))
      .finally(() => setEvaluationLoading(false));
  }, [user?.uid, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary/30 border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
                <FaGraduationCap className="text-primary text-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                  <span className="text-foreground">Learn</span>
                  <span className="text-primary">XR</span>
                  <TrademarkSymbol />
                </h1>
                <h2 className="text-xl font-semibold text-foreground">My Dashboard</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {isGuest ? 'Exploring as guest — try one lesson, then sign up to unlock more' : 'Track your learning progress and performance'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Personalized Avatar - prominent for guest */}
        <Card className="mb-8 border border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6">
              <Avatar className="h-24 w-24 rounded-2xl border-2 border-primary/30 ring-2 ring-primary/10">
                <AvatarImage src={isGuest ? GUEST_AVATAR_URL : undefined} alt="AI learning companion" />
                <AvatarFallback className="rounded-2xl bg-primary/20 text-primary text-2xl">
                  {isGuest ? 'G' : (profile?.name?.charAt(0) || profile?.displayName?.charAt(0) || '?')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {isGuest ? 'Your AI learning companion' : 'Your learning guide'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isGuest
                    ? 'Explore one free lesson, then sign up to get personalized recommendations and unlock all lessons.'
                    : 'Get personalized recommendations and track your progress across subjects.'}
                </p>
                {isGuest ? (
                  <Link to="/personalized-learning" className="text-primary font-medium text-sm hover:underline">
                    See demo recommendations →
                  </Link>
                ) : (
                  <Link to="/personalized-learning" className="text-primary font-medium text-sm hover:underline">
                    View personalized learning →
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Join class session - students only */}
        {!isGuest && (
          <Card className="mb-8 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <FaUsers className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Join a class session</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Enter the code your teacher shared to join the live session
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6">
              {!joinedSessionId ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 min-w-0">
                      <label htmlFor="student-join-code" className="sr-only">Class session code</label>
                      <FaKey className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="student-join-code"
                        type="text"
                        value={sessionCodeInput}
                        onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. ABC123"
                        className="pl-9 w-full sm:w-40 font-mono text-sm uppercase tracking-wider bg-background border-border rounded-lg"
                        maxLength={8}
                      />
                    </div>
                    <Button
                      size="default"
                      className="shrink-0"
                      onClick={async () => {
                        const ok = await joinSession(sessionCodeInput.trim());
                        if (ok) setSessionCodeInput('');
                      }}
                      disabled={sessionJoinLoading || !sessionCodeInput.trim()}
                    >
                      {sessionJoinLoading ? 'Joining…' : 'Join session'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prefer to pick from active classes?{' '}
                    <Link to="/join-class" className="text-primary font-medium hover:underline">View active classes</Link>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <p className="text-sm font-medium text-primary flex items-center gap-2">
                    <FaCheckCircle className="h-4 w-4 shrink-0" />
                    Joined. Waiting for teacher to launch a lesson…
                  </p>
                  <Button size="sm" variant="outline" onClick={leaveSessionAsStudent} className="shrink-0">
                    Leave session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Class Teacher Information - guest sees CTA to sign up */}
        {isGuest && (
          <div className="mb-8">
            <Card className="border border-dashed border-border bg-muted/30">
              <CardContent className="p-6 text-center">
                <FaChalkboardTeacher className="text-3xl text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground font-medium">Exploring as guest</p>
                <p className="text-sm text-muted-foreground mt-1">Sign up and join a class to see your teachers and full curriculum.</p>
                <Link to="/signup" className="inline-block mt-3 text-primary font-medium text-sm hover:underline">Create free account</Link>
              </CardContent>
            </Card>
          </div>
        )}
        {!isGuest && classes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaChalkboardTeacher className="text-primary" />
              My Class Teachers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => {
                const teacher = classTeachers.get(cls.id);
                if (!teacher) return null;
                return (
                  <Card key={cls.id} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-border flex items-center justify-center flex-shrink-0">
                          <FaChalkboardTeacher className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-foreground font-medium truncate">
                            {teacher.name || teacher.displayName || 'Unknown Teacher'}
                          </h3>
                          <p className="text-muted-foreground text-sm mt-1 truncate">
                            {cls.class_name}
                          </p>
                          {teacher.email && (
                            <p className="text-muted-foreground text-xs mt-1 truncate">
                              {teacher.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {classes.every(cls => !classTeachers.has(cls.id)) && (
              <Card className="border border-border bg-card">
                <CardContent className="p-8 text-center">
                  <FaChalkboardTeacher className="text-4xl text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No class teacher assigned yet</p>
                  <p className="text-muted-foreground text-sm mt-2">Your teacher will be assigned by your school administrator</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaBook className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Lessons</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalLessons}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaCheckCircle className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{stats.completedLessons}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaChartLine className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Average Score</p>
                  <p className="text-2xl font-bold text-foreground">{stats.averageScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaClock className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Quiz Attempts</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalAttempts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress by subject (from evaluation API) */}
        {(Array.isArray(evaluation?.bySubject) && evaluation.bySubject.length > 0 || evaluationLoading) && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaChartLine className="text-primary" />
              Progress by Subject
            </h2>
            {evaluationLoading ? (
              <Card className="border border-border bg-card">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Loading evaluation...</p>
                </CardContent>
              </Card>
            ) : evaluation?.bySubject && evaluation.bySubject.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {evaluation.bySubject.map((s) => (
                  <Card key={s.subject} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                    <CardContent className="p-4">
                      <h3 className="text-foreground font-medium truncate">{s.subject}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{s.attemptCount} attempt{s.attemptCount !== 1 ? 's' : ''}</p>
                      <p className={`text-lg font-bold mt-2 ${
                        s.averageScore >= 70 ? 'text-primary' : s.averageScore >= 50 ? 'text-amber-500' : 'text-destructive'
                      }`}>
                        {s.averageScore}% avg
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Learning objectives (from evaluation API) */}
        {(evaluation?.objectives?.length > 0 || evaluationLoading) && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaGraduationCap className="text-primary" />
              Learning Objectives
            </h2>
            {!evaluationLoading && evaluation?.objectives && evaluation.objectives.length > 0 ? (
              <div className="space-y-3">
                {evaluation.objectives.map((obj, idx) => (
                  <Card
                    key={`${obj.chapterId}-${obj.topicId}-${idx}`}
                    className={`border transition-colors ${
                      obj.met ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-accent/30'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground text-sm">
                            {obj.subject} • Ch.{obj.chapterId} • Topic {obj.topicId}
                          </p>
                          {obj.topicObjective && (
                            <p className="text-foreground text-sm mt-1 line-clamp-2">{obj.topicObjective}</p>
                          )}
                          <p className="text-muted-foreground text-xs mt-2">
                            {obj.attemptCount} attempt{obj.attemptCount !== 1 ? 's' : ''} • Score: {obj.scoreUsed}%
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {obj.met ? (
                            <Badge variant="default" className="gap-1.5">
                              <FaCheckCircle className="w-4 h-4" />
                              Met
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1.5">
                              In progress
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Recent Lesson Launches */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaBook className="text-primary" />
            Recent Lessons
          </h2>
          {lessonLaunches.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaBook className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No lessons launched yet</p>
                <p className="text-muted-foreground text-sm mt-2">Start learning by launching a lesson!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lessonLaunches.slice(0, 10).map((launch) => (
                <Card key={launch.id} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground font-medium">
                          {launch.subject} - {launch.curriculum} Class {launch.class_name}
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1">
                          Chapter: {launch.chapter_id} • Topic: {launch.topic_id}
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Launched: {new Date(launch.launched_at as any).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="ml-4 shrink-0">
                        {launch.completion_status === 'completed' ? (
                          <Badge variant="default">Completed</Badge>
                        ) : launch.completion_status === 'in_progress' ? (
                          <Badge variant="secondary">In Progress</Badge>
                        ) : (
                          <Badge variant="outline">Abandoned</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Scores */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recent Quiz Scores</h2>
          {scores.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaChartLine className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No quiz attempts yet</p>
                <p className="text-muted-foreground text-sm mt-2">Complete lessons and take quizzes to see your scores!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scores.slice(0, 10).map((score) => (
                <Card key={score.id} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground font-medium">
                          {score.subject} - {score.curriculum} Class {score.class_name}
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1">
                          Chapter: {score.chapter_id} • Topic: {score.topic_id} • Attempt #{score.attempt_number}
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Completed: {new Date(score.completed_at as any).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="ml-4 text-right shrink-0">
                        <div className={`text-2xl font-bold ${
                          score.score.percentage >= 70 ? 'text-primary' :
                          score.score.percentage >= 50 ? 'text-amber-500' : 'text-destructive'
                        }`}>
                          {score.score.percentage}%
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {score.score.correct}/{score.score.total} correct
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
