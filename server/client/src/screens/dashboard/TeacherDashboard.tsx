/**
 * Enhanced Teacher Dashboard
 * 
 * Displays comprehensive insights for teacher's assigned classes including:
 * - Overall class insights
 * - Subject-wise breakdown
 * - Ability to share class data with other teachers from the same school
 * - View data from both managed and shared classes
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, getDocs, getDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getClassEvaluation, type ClassEvaluation } from '../../services/evaluationService';
import type { Class, StudentScore, LessonLaunch } from '../../types/lms';
import { Link } from 'react-router-dom';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../Components/ui/card';
import { Button } from '../../Components/ui/button';
import { Badge } from '../../Components/ui/badge';
import { Progress } from '../../Components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../Components/ui/select';
import {
  FaChalkboardTeacher,
  FaUsers,
  FaChartLine,
  FaBook,
  FaGraduationCap,
  FaUserCheck,
  FaArrowRight,
  FaBell,
  FaClock,
  FaShareAlt,
  FaLock,
  FaUnlock,
  FaFilter,
  FaChartBar,
  FaTrophy,
  FaExclamationTriangle,
  FaRobot,
  FaFlask,
  FaMagic,
  FaVideo,
  FaCopy,
  FaStopCircle,
} from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../Components/ui/dialog';
import { toast } from 'react-toastify';

interface SubjectPerformance {
  subject: string;
  totalStudents: number;
  averageScore: number;
  totalQuizzes: number;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
}

interface ClassInsight {
  classId: string;
  className: string;
  curriculum: string;
  subject?: string;
  studentCount: number;
  averageScore: number;
  totalQuizzes: number;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
  isShared: boolean; // Whether this class is shared with the teacher
  isOwner: boolean; // Whether this teacher owns/manages the class
}

const TeacherDashboard = () => {
  const { user, profile } = useAuth();
  const {
    activeSessionId,
    activeSession,
    progressList,
    startSession,
    launchLesson: launchLessonToClass,
    endSession,
    leaveSessionAsTeacher,
    sessionLoading: sessionContextLoading,
    sessionError: sessionContextError,
    clearSessionError,
  } = useClassSession();
  const [managedClasses, setManagedClasses] = useState<Class[]>([]);
  const [sharedClasses, setSharedClasses] = useState<Class[]>([]);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [launches, setLaunches] = useState<LessonLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingClassId, setSharingClassId] = useState<string | null>(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [studentDisplayNames, setStudentDisplayNames] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({
    totalClasses: 0,
    sharedClasses: 0,
    totalStudents: 0,
    approvedStudents: 0,
    pendingStudents: 0,
    averageClassScore: 0,
    totalLessonLaunches: 0,
    completedLessons: 0,
  });
  const [evaluationClassId, setEvaluationClassId] = useState<string | null>(null);
  const [classEvaluation, setClassEvaluation] = useState<ClassEvaluation | null>(null);
  const [classEvaluationLoading, setClassEvaluationLoading] = useState(false);
  // Class launch session
  const [sessionClassId, setSessionClassId] = useState<string>('');
  const [launchLessonModalOpen, setLaunchLessonModalOpen] = useState(false);
  const [chaptersForLaunch, setChaptersForLaunch] = useState<any[]>([]);
  const [selectedLaunchChapterId, setSelectedLaunchChapterId] = useState<string>('');
  const [selectedLaunchTopicId, setSelectedLaunchTopicId] = useState<string>('');
  const [launchLessonModalLoading, setLaunchLessonModalLoading] = useState(false);

  // Get all classes (managed + shared)
  const allClasses = useMemo(() => {
    return [...managedClasses, ...sharedClasses];
  }, [managedClasses, sharedClasses]);

  // Fetch all teachers in the same school
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher' || !profile.school_id) return;

    const teachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('school_id', '==', profile.school_id)
    );

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setAllTeachers(teachersData.filter(t => t.uid !== user.uid)); // Exclude self
    }, (error) => {
      console.error('❌ TeacherDashboard: Error fetching teachers', error);
    });

    return () => unsubscribeTeachers();
  }, [user?.uid, profile]);

  // Fetch school code for display
  useEffect(() => {
    const schoolId = profile?.school_id || profile?.managed_school_id;
    if (!schoolId) return;
    getDoc(doc(db, 'schools', schoolId))
      .then((snap) => {
        if (snap.exists()) setSchoolCode(snap.data()?.schoolCode || null);
      })
      .catch(() => {});
  }, [profile?.school_id, profile?.managed_school_id]);

  // Fetch pending students
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher' || !profile.school_id) return;

    const pendingQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', profile.school_id),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      const pendingData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setPendingStudents(pendingData);
    }, (error) => {
      console.error('❌ TeacherDashboard: Error fetching pending students', error);
    });

    return () => unsubscribePending();
  }, [user?.uid, profile]);

  // Fetch managed classes (where teacher is in teacher_ids)
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher') {
      setLoading(false);
      return;
    }

    setLoading(true);

    let classesQuery;
    if (profile.school_id) {
      classesQuery = query(
        collection(db, 'classes'),
        where('school_id', '==', profile.school_id),
        where('teacher_ids', 'array-contains', user.uid)
      );
    } else {
      classesQuery = query(
        collection(db, 'classes'),
        where('teacher_ids', 'array-contains', user.uid)
      );
    }

    const unsubscribeClasses = onSnapshot(classesQuery, async (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Class[];

      setManagedClasses(classesData);

      // Auto-assign school_id if missing
      if (classesData.length > 0 && !profile.school_id && user?.uid) {
        const firstClass = classesData[0];
        if (firstClass.school_id) {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              school_id: firstClass.school_id,
              updatedAt: new Date().toISOString(),
            });
          } catch (error: any) {
            console.error('❌ TeacherDashboard: Error auto-assigning school_id', error);
          }
        }
      }
    }, (error) => {
      console.error('Error fetching managed classes:', error);
      setLoading(false);
    });

    return () => unsubscribeClasses();
  }, [user?.uid, profile]);

  // Fetch shared classes (where teacher is in shared_with_teachers)
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher' || !profile.school_id) return;

    const sharedClassesQuery = query(
      collection(db, 'classes'),
      where('school_id', '==', profile.school_id),
      where('shared_with_teachers', 'array-contains', user.uid)
    );

    const unsubscribeShared = onSnapshot(sharedClassesQuery, (snapshot) => {
      const sharedData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Class[];
      setSharedClasses(sharedData);
    }, (error) => {
      console.error('Error fetching shared classes:', error);
    });

    return () => unsubscribeShared();
  }, [user?.uid, profile]);

  // Fetch students, scores, and launches for all classes
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher' || allClasses.length === 0) {
      if (allClasses.length === 0) setLoading(false);
      return;
    }

    const classIds = allClasses.map(c => c.id);
    const schoolIdForQuery = profile.school_id || allClasses[0]?.school_id;

    if (!schoolIdForQuery) {
      setLoading(false);
      return;
    }

    // Fetch students
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', schoolIdForQuery),
      where('class_ids', 'array-contains-any', classIds)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setStudents(studentsData);
    }, (error) => {
      console.error('❌ TeacherDashboard: Error fetching students', error);
    });

    // Fetch scores
    const scoresQuery = query(
      collection(db, 'student_scores'),
      where('school_id', '==', schoolIdForQuery),
      where('class_id', 'in', classIds),
      orderBy('completed_at', 'desc')
    );

    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
      const scoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentScore[];
      setScores(scoresData);
    }, (error) => {
      console.error('❌ TeacherDashboard: Error fetching scores', error);
    });

    // Fetch launches
    const launchesQuery = query(
      collection(db, 'lesson_launches'),
      where('school_id', '==', schoolIdForQuery),
      where('class_id', 'in', classIds),
      orderBy('launched_at', 'desc')
    );

    const unsubscribeLaunches = onSnapshot(launchesQuery, (snapshot) => {
      const launchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as LessonLaunch[];
      setLaunches(launchesData);
      setLoading(false);
    }, (error) => {
      console.error('❌ TeacherDashboard: Error fetching launches', error);
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeScores();
      unsubscribeLaunches();
    };
  }, [user?.uid, profile, allClasses]);

  // Calculate subject-wise performance
  const subjectPerformance = useMemo((): SubjectPerformance[] => {
    const subjectMap = new Map<string, SubjectPerformance>();

    allClasses.forEach(classItem => {
      const subject = classItem.subject || 'All Subjects';
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, {
          subject,
          totalStudents: 0,
          averageScore: 0,
          totalQuizzes: 0,
          completedLessons: 0,
          totalLessons: 0,
          completionRate: 0,
        });
      }

      const subjectData = subjectMap.get(subject)!;
      const classStudents = students.filter(s => s.class_ids?.includes(classItem.id));
      const classScores = scores.filter(s => s.class_id === classItem.id);
      const classLaunches = launches.filter(l => l.class_id === classItem.id);
      const completedLaunches = classLaunches.filter(l => l.completion_status === 'completed');

      subjectData.totalStudents += classStudents.length;
      subjectData.totalQuizzes += classScores.length;
      subjectData.totalLessons += classLaunches.length;
      subjectData.completedLessons += completedLaunches.length;
    });

    // Calculate averages
    return Array.from(subjectMap.values()).map(subjectData => {
      const avgScore = scores
        .filter(s => {
          const classItem = allClasses.find(c => c.id === s.class_id);
          return classItem && (classItem.subject === subjectData.subject || (!classItem.subject && subjectData.subject === 'All Subjects'));
        })
        .reduce((sum, s) => sum + (s.score?.percentage || 0), 0);

      const scoreCount = scores.filter(s => {
        const classItem = allClasses.find(c => c.id === s.class_id);
        return classItem && (classItem.subject === subjectData.subject || (!classItem.subject && subjectData.subject === 'All Subjects'));
      }).length;

      subjectData.averageScore = scoreCount > 0 ? Math.round(avgScore / scoreCount) : 0;
      subjectData.completionRate = subjectData.totalLessons > 0
        ? Math.round((subjectData.completedLessons / subjectData.totalLessons) * 100)
        : 0;

      return subjectData;
    }).sort((a, b) => b.averageScore - a.averageScore);
  }, [allClasses, students, scores, launches]);

  // Calculate class insights
  const classInsights = useMemo((): ClassInsight[] => {
    return allClasses.map(classItem => {
      const classStudents = students.filter(s => s.class_ids?.includes(classItem.id));
      const classScores = scores.filter(s => s.class_id === classItem.id);
      const classLaunches = launches.filter(l => l.class_id === classItem.id);
      const completedLaunches = classLaunches.filter(l => l.completion_status === 'completed');

      const averageScore = classScores.length > 0
        ? Math.round(classScores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / classScores.length)
        : 0;

      return {
        classId: classItem.id,
        className: classItem.class_name,
        curriculum: classItem.curriculum,
        subject: classItem.subject,
        studentCount: classStudents.length,
        averageScore,
        totalQuizzes: classScores.length,
        completedLessons: completedLaunches.length,
        totalLessons: classLaunches.length,
        completionRate: classLaunches.length > 0
          ? Math.round((completedLaunches.length / classLaunches.length) * 100)
          : 0,
        isShared: sharedClasses.some(sc => sc.id === classItem.id),
        isOwner: managedClasses.some(mc => mc.id === classItem.id),
      };
    });
  }, [allClasses, students, scores, launches, sharedClasses, managedClasses]);

  // Set default class for evaluation when classes load
  useEffect(() => {
    if (allClasses.length > 0 && !evaluationClassId) {
      setEvaluationClassId(allClasses[0].id);
    }
  }, [allClasses, evaluationClassId]);

  // Fetch class evaluation when selected class changes (API may 404 if endpoint not deployed)
  useEffect(() => {
    if (!evaluationClassId) {
      setClassEvaluation(null);
      return;
    }
    setClassEvaluationLoading(true);
    getClassEvaluation(evaluationClassId)
      .then((data) => setClassEvaluation(data ?? null))
      .catch(() => setClassEvaluation(null))
      .finally(() => setClassEvaluationLoading(false));
  }, [evaluationClassId]);

  // Class launch: fetch chapters when launch modal opens; dedupe so each chapter appears once, merge topics
  const fetchChaptersForLaunch = useCallback(async () => {
    setLaunchLessonModalLoading(true);
    try {
      const snap = await getDocs(collection(db, 'curriculum_chapters'));
      const raw = snap.docs
        .map((d) => ({ id: d.id, ...d.data(), topics: d.data()?.topics || [] }))
        .filter((ch: any) => (ch.topics?.length || 0) > 0);

      // Dedupe by logical chapter (same name + curriculum + class + subject) so each chapter shows once
      const key = (ch: any) =>
        [ch.chapter_number, ch.chapter_name, ch.curriculum, ch.class_name ?? ch.class, ch.subject].join('|');
      const byKey = new Map<string, any[]>();
      for (const ch of raw) {
        const k = key(ch);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(ch);
      }

      const list = Array.from(byKey.entries())
        .map(([_, docs]) => {
          const first = docs[0];
          const seenTopicIds = new Set<string>();
          const mergedTopics: any[] = [];
          for (const doc of docs) {
            for (const t of doc.topics || []) {
              const tid = t.topic_id ?? t.id;
              if (!tid || seenTopicIds.has(tid)) continue;
              seenTopicIds.add(tid);
              mergedTopics.push({ ...t, topic_id: tid, topic_name: t.topic_name || String(tid) });
            }
          }
          return {
            ...first,
            topics: mergedTopics.sort((a: any, b: any) => (a.topic_priority ?? 999) - (b.topic_priority ?? 999)),
          };
        })
        .filter((ch: any) => (ch.topics?.length || 0) > 0)
        .sort((a: any, b: any) => (a.chapter_number || 0) - (b.chapter_number || 0));

      setChaptersForLaunch(list);
      setSelectedLaunchChapterId('');
      setSelectedLaunchTopicId('');
    } catch (e) {
      console.error('Fetch chapters for launch:', e);
      toast.error('Failed to load lessons');
    } finally {
      setLaunchLessonModalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (launchLessonModalOpen) fetchChaptersForLaunch();
  }, [launchLessonModalOpen, fetchChaptersForLaunch]);

  // Show session error to user
  useEffect(() => {
    if (sessionContextError) {
      toast.error(sessionContextError);
      clearSessionError();
    }
  }, [sessionContextError, clearSessionError]);

  // Subscribe to student profiles so we show current name (e.g. after they change it in profile)
  const progressStudentUids = useMemo(
    () => [...new Set(progressList.map((p) => p.student_uid))].sort().join(','),
    [progressList]
  );
  useEffect(() => {
    if (!activeSessionId || !progressStudentUids) {
      setStudentDisplayNames({});
      return;
    }
    const uids = progressStudentUids.split(',').filter(Boolean);
    const unsubs: Unsubscribe[] = uids.map((uid) =>
      onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const name = ((d.displayName ?? d.name) ?? '').toString().trim();
          if (name) setStudentDisplayNames((prev) => ({ ...prev, [uid]: name }));
        }
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeSessionId, progressStudentUids]);

  const copySessionCode = useCallback(() => {
    if (activeSession?.session_code) {
      navigator.clipboard.writeText(activeSession.session_code);
      toast.success('Session code copied');
    }
  }, [activeSession?.session_code]);

  const handleStartSession = useCallback(async () => {
    if (!sessionClassId) {
      toast.error('Select a class first');
      return;
    }
    const id = await startSession(sessionClassId);
    if (id) toast.success('Class session started. Share the code with students.');
  }, [sessionClassId, startSession]);

  const handleLaunchLesson = useCallback(async () => {
    if (!selectedLaunchChapterId || !selectedLaunchTopicId) {
      toast.error('Select a chapter and topic');
      return;
    }
    const ch = chaptersForLaunch.find((c: any) => c.id === selectedLaunchChapterId);
    const topic = ch?.topics?.find((t: any) => t.topic_id === selectedLaunchTopicId);
    if (!ch || !topic) return;
    const ok = await launchLessonToClass({
      chapter_id: selectedLaunchChapterId,
      topic_id: topic.topic_id,
      curriculum: ch.curriculum || '',
      class_name: String(ch.class_name ?? ch.class ?? ''),
      subject: ch.subject || '',
    });
    if (ok) {
      toast.success('Lesson launched to class');
      setLaunchLessonModalOpen(false);
    }
  }, [selectedLaunchChapterId, selectedLaunchTopicId, chaptersForLaunch, launchLessonToClass]);

  const handleEndSession = useCallback(async () => {
    const ok = await endSession();
    if (ok) toast.success('Session ended');
  }, [endSession]);

  // Update stats
  useEffect(() => {
    const totalClasses = allClasses.length;
    const sharedClassesCount = sharedClasses.length;
    const totalStudents = students.length;
    const approvedStudents = students.filter(s => s.approvalStatus === 'approved').length;
    const averageClassScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    const totalLessonLaunches = launches.length;
    const completedLessons = launches.filter(l => l.completion_status === 'completed').length;

    setStats({
      totalClasses,
      sharedClasses: sharedClassesCount,
      totalStudents,
      approvedStudents,
      pendingStudents: pendingStudents.length,
      averageClassScore: Math.round(averageClassScore),
      totalLessonLaunches,
      completedLessons,
    });
  }, [allClasses, sharedClasses, students, scores, launches, pendingStudents]);

  // Handle sharing/unsharing class
  const handleShareClass = async (classId: string, teacherId: string, share: boolean) => {
    if (!user?.uid) return;

    try {
      const classRef = doc(db, 'classes', classId);
      if (share) {
        await updateDoc(classRef, {
          shared_with_teachers: arrayUnion(teacherId),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(classRef, {
          shared_with_teachers: arrayRemove(teacherId),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('Error sharing class:', error);
      alert(`Failed to ${share ? 'share' : 'unshare'} class: ${error.message}`);
    }
  };

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

  const filteredClassInsights = selectedSubjectFilter === 'all'
    ? classInsights
    : classInsights.filter(ci => ci.subject === selectedSubjectFilter || (!ci.subject && selectedSubjectFilter === 'All Subjects'));

  const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
                <FaChalkboardTeacher className="text-primary text-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1 font-display" style={learnXRFontStyle}>
                  <span className="text-foreground">Learn</span>
                  <span className="text-primary">XR</span>
                  <TrademarkSymbol />
                </h1>
                <h2 className="text-xl font-semibold text-foreground">Teacher Dashboard</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-muted-foreground text-sm">Comprehensive insights for your assigned classes</p>
                  {schoolCode && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">School Code</span>
                      <span className="font-mono font-bold text-primary text-base tracking-wider">{schoolCode}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Class Session - Launch lesson to connected headsets */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaVideo className="text-primary" />
            Class Launch
          </h2>
          <Card className="border border-border bg-card max-w-2xl">
            <CardContent className="p-6">
              {!activeSessionId ? (
                <>
                  <p className="text-muted-foreground text-sm mb-4">
                    Start a session and share the code with students. When you launch a lesson, everyone in the session will receive it on their device.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px]">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Class</label>
                      <Select value={sessionClassId} onValueChange={setSessionClassId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {allClasses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.class_name} {c.subject ? `– ${c.subject}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleStartSession}
                      disabled={sessionContextLoading || allClasses.length === 0}
                    >
                      {sessionContextLoading ? 'Starting…' : 'Start class session'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <p className="text-muted-foreground text-sm">Session active. Students can join with this code:</p>
                    <Button variant="outline" size="sm" onClick={leaveSessionAsTeacher}>
                      Leave session (local)
                    </Button>
                  </div>
                  <div
                    className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30 mb-4 cursor-pointer hover:bg-primary/15 transition-colors"
                    onClick={copySessionCode}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && copySessionCode()}
                  >
                    <span className="font-mono text-2xl font-bold tracking-widest text-primary">
                      {activeSession?.session_code ?? '—'}
                    </span>
                    <FaCopy className="text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">Click to copy</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setLaunchLessonModalOpen(true)} className="gap-2">
                      <FaVideo className="w-4 h-4" />
                      Launch lesson to class
                    </Button>
                    <Button variant="destructive" onClick={handleEndSession} disabled={sessionContextLoading} className="gap-2">
                      <FaStopCircle className="w-4 h-4" />
                      End session
                    </Button>
                  </div>
                  {progressList.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm font-medium text-foreground mb-3">Live progress ({progressList.length} student(s))</p>
                      <div className="space-y-2">
                        {progressList.map((p) => {
                          const phaseLabel = (() => {
                            const pn = String(p.phase || 'idle');
                            if (pn === 'intro') return 'Intro';
                            if (pn === 'explanation') return 'Explanation';
                            if (pn === 'exploration') return 'Exploration';
                            if (pn === 'outro') return 'Outro';
                            if (pn === 'quiz') return 'Quiz';
                            if (pn === 'completed') return 'Completed';
                            if (pn === 'loading') return 'Loading…';
                            if (pn === 'idle') return 'Waiting';
                            return 'Waiting';
                          })();
                          const isComplete = p.phase === 'completed';
                          const isQuiz = p.phase === 'quiz';
                          const displayLabel = studentDisplayNames[p.student_uid] ?? [p.display_name?.trim(), p.email?.trim()].find(Boolean) ?? `Student ${p.student_uid.slice(0, 6)}`;
                          const lastUpdated = p.last_updated ? (typeof p.last_updated === 'string' ? new Date(p.last_updated) : (p.last_updated as { toDate?: () => Date })?.toDate?.() ?? null) : null;
                          const hasQuizData = p.quiz_score != null && p.quiz_total != null && (p.quiz_total as number) > 0;
                          const quizAnswers = (p.quiz_answers as Array<{ question_index: number; correct: boolean; selected_option_index: number }> | undefined) ?? [];
                          return (
                            <Card key={p.student_uid} className={`border ${isComplete ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
                              <CardContent className="p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isComplete ? 'bg-primary' : isQuiz ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                    <span className="font-medium text-foreground truncate" title={displayLabel}>{displayLabel}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={isComplete ? 'default' : isQuiz ? 'secondary' : 'outline'} className="font-normal">
                                      {phaseLabel}
                                    </Badge>
                                    {lastUpdated && (
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {hasQuizData && (
                                  <div className="pt-2 border-t border-border/60">
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                      Quiz: {String(p.quiz_score)}/{String(p.quiz_total)}
                                    </p>
                                    {quizAnswers.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {quizAnswers
                                          .slice()
                                          .sort((a, b) => a.question_index - b.question_index)
                                          .map((a, i) => (
                                            <span
                                              key={i}
                                              className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-medium ${a.correct ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}
                                              title={a.correct ? `Q${a.question_index + 1} correct` : `Q${a.question_index + 1} wrong`}
                                            >
                                              {a.correct ? '✓' : '✗'}
                                            </span>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Teaching & Creation Tools - Create (includes AI Teacher Support in top-right) */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaMagic className="text-primary" />
            Teaching & Creation Tools
          </h2>
          <Link to="/main">
            <Card className="border border-border bg-card hover:bg-accent/20 hover:border-primary/40 transition-all cursor-pointer group max-w-2xl">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/30 transition-colors">
                    <FaFlask className="text-cyan-400 text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground mb-1">Create</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Generate 360° skybox environments and 3D assets. Use AI Teacher Support in the top-right for lesson plans, content ideas, and grading rubrics.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">Skybox</Badge>
                      <Badge variant="secondary" className="text-xs">3D Assets</Badge>
                      <Badge variant="secondary" className="text-xs">AI Teacher Support</Badge>
                      <Badge variant="secondary" className="text-xs">XR Ready</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-primary text-sm font-medium">
                      <span>Open Create Studio</span>
                      <FaArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Student Approvals */}
        {pendingStudents.length > 0 && (
          <div className="mb-8">
            <Card className="border border-amber-500/40 bg-card">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg bg-primary/10 border border-border flex items-center justify-center relative">
                      <FaUserCheck className="text-primary text-2xl" />
                      <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
                        {pendingStudents.length}
                      </Badge>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-foreground">Student Approvals</h2>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <FaBell className="text-xs" />
                          {pendingStudents.length} pending
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">
                        You have {pendingStudents.length} student(s) waiting for approval.
                      </p>
                    </div>
                  </div>
                  <Link to="/teacher/approvals">
                    <Button variant="secondary" className="gap-2">
                      Review Approvals
                      <FaArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
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
                  <p className="text-muted-foreground text-sm">My Classes</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalClasses}</p>
                  {stats.sharedClasses > 0 && (
                    <p className="text-xs text-primary mt-1">{stats.sharedClasses} shared</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaUsers className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Students</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalStudents}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-primary">{stats.approvedStudents} approved</span>
                    {stats.pendingStudents > 0 && (
                      <span className="text-xs text-amber-400">{stats.pendingStudents} pending</span>
                    )}
                  </div>
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
                  <p className="text-muted-foreground text-sm">Avg Class Score</p>
                  <p className="text-2xl font-bold text-foreground">{stats.averageClassScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaGraduationCap className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Lesson Launches</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalLessonLaunches}</p>
                  <p className="text-xs text-primary mt-1">{stats.completedLessons} completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject performance bar chart */}
        {subjectPerformance.length > 0 && (
          <Card className="mb-8 border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FaChartBar className="text-primary" />
                Subject Performance
              </CardTitle>
              <CardDescription>Average score and completion by subject</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ minHeight: 200 }}>
                <ResponsiveContainer width="100%" height={280} minHeight={200}>
                  <BarChart data={subjectPerformance.slice(0, 8)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="subject" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} labelStyle={{ color: 'var(--foreground)' }} />
                    <Bar dataKey="averageScore" name="Avg Score %" radius={[4, 4, 0, 0]}>
                      {subjectPerformance.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Class evaluation (from evaluation API) */}
        {allClasses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FaTrophy className="text-primary" />
              Class Evaluation
            </h2>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <label className="text-muted-foreground text-sm">Class</label>
              <Select value={evaluationClassId ?? ''} onValueChange={(v) => setEvaluationClassId(v || null)}>
                <SelectTrigger className="w-[280px] bg-card border-border">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.class_name} {c.curriculum ? `(${c.curriculum})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {classEvaluationLoading ? (
              <Card className="border-border bg-card">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Loading evaluation...</p>
                </CardContent>
              </Card>
            ) : classEvaluation ? (
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-muted-foreground text-sm">Avg score</p>
                      <p className="text-xl font-bold text-foreground">{classEvaluation.aggregate.averageScore}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Total attempts</p>
                      <p className="text-xl font-bold text-foreground">{classEvaluation.aggregate.totalAttempts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Lesson completion</p>
                      <p className="text-xl font-bold text-foreground">{classEvaluation.aggregate.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Students</p>
                      <p className="text-xl font-bold text-foreground">{classEvaluation.studentSummaries.length}</p>
                    </div>
                  </div>
                  {classEvaluation.bySubject && classEvaluation.bySubject.length > 0 && (
                    <div>
                      <p className="text-muted-foreground text-sm mb-2">By subject</p>
                      <div className="flex flex-wrap gap-2">
                        {classEvaluation.bySubject.map((s) => (
                          <Badge key={s.subject} variant="secondary">
                            {s.subject}: {s.averageScore}% ({s.attemptCount} attempts)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">No evaluation data for this class yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Subject-wise Performance (cards) */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaChartBar className="text-primary" />
            Subject-wise Performance
          </h2>
          {subjectPerformance.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaBook className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No subject data available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectPerformance.map((subject) => (
                <Card key={subject.subject} className="border-border bg-card hover:bg-accent/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-foreground font-semibold text-lg">{subject.subject}</h3>
                      <span className={`text-2xl font-bold ${
                        subject.averageScore >= 70 ? 'text-primary' :
                        subject.averageScore >= 50 ? 'text-amber-400' : 'text-destructive'
                      }`}>
                        {subject.averageScore}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Students</span>
                        <span className="text-foreground">{subject.totalStudents}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Quizzes</span>
                        <span className="text-foreground">{subject.totalQuizzes}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completion Rate</span>
                        <span className="text-foreground">{subject.completionRate}%</span>
                      </div>
                      <Progress value={subject.completionRate} className="h-2 mt-3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Class Insights with Sharing */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <FaBook className="text-primary" />
              Class Insights
            </h2>
            <div className="flex items-center gap-2">
              <FaFilter className="text-muted-foreground" />
              <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                <SelectTrigger className="w-[180px] bg-card border-border">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {Array.from(new Set(classInsights.map(ci => ci.subject || 'All Subjects'))).map(subject => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredClassInsights.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaBook className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No classes available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClassInsights.map((insight) => {
                const classItem = allClasses.find(c => c.id === insight.classId);
                const isOwner = insight.isOwner;
                const sharedWith = classItem?.shared_with_teachers || [];

                return (
                  <Card
                    key={insight.classId}
                    className={`border p-4 transition-colors ${insight.isShared ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <CardContent className="p-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-foreground font-medium">{insight.className}</h3>
                            {insight.isShared && <Badge variant="secondary">Shared</Badge>}
                          </div>
                          <p className="text-muted-foreground text-sm mt-1">
                            {insight.curriculum} • {insight.subject || 'All Subjects'}
                          </p>
                        </div>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSharingClassId(sharingClassId === insight.classId ? null : insight.classId)}
                            title="Share class with other teachers"
                          >
                            <FaShareAlt className="text-primary" />
                          </Button>
                        )}
                      </div>

                      {isOwner && sharingClassId === insight.classId && (
                        <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-foreground text-sm mb-2 font-medium">Share with teachers:</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {allTeachers.length === 0 ? (
                              <p className="text-muted-foreground text-xs">No other teachers in your school</p>
                            ) : (
                              allTeachers.map(teacher => {
                                const isShared = sharedWith.includes(teacher.uid);
                                return (
                                  <div key={teacher.uid} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {teacher.name || teacher.displayName || teacher.email}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant={isShared ? 'secondary' : 'outline'}
                                      onClick={() => handleShareClass(insight.classId, teacher.uid, !isShared)}
                                    >
                                      {isShared ? <><FaUnlock className="mr-1 text-xs" /> Shared</> : <><FaLock className="mr-1 text-xs" /> Share</>}
                                    </Button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Students</span>
                          <span className="text-foreground">{insight.studentCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Avg Score</span>
                          <span className={`font-medium ${insight.averageScore >= 70 ? 'text-primary' : insight.averageScore >= 50 ? 'text-amber-400' : 'text-destructive'}`}>
                            {insight.averageScore}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Completion</span>
                          <span className="text-foreground">{insight.completedLessons} / {insight.totalLessons}</span>
                        </div>
                        <Progress value={insight.completionRate} className="h-2 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Student Activity */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recent Student Activity</h2>
          {scores.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaChartLine className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No student activity yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scores.slice(0, 10).map((score) => {
                const student = students.find(s => s.uid === score.student_id);
                return (
                  <Card key={score.id} className="border-border bg-card hover:bg-accent/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-foreground font-medium">
                              {student?.name || student?.displayName || 'Unknown Student'}
                            </h3>
                            {student?.approvalStatus && (
                              <Badge variant={student.approvalStatus === 'approved' ? 'default' : student.approvalStatus === 'pending' ? 'secondary' : 'destructive'}>
                                {student.approvalStatus}
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm mt-1">
                            {score.subject} - {score.curriculum} Class {score.class_name}
                          </p>
                          <p className="text-muted-foreground/70 text-xs mt-1">
                            Chapter: {score.chapter_id} • Attempt #{score.attempt_number}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <div className={`text-2xl font-bold ${score.score.percentage >= 70 ? 'text-primary' : score.score.percentage >= 50 ? 'text-amber-400' : 'text-destructive'}`}>
                            {score.score.percentage}%
                          </div>
                          <p className="text-muted-foreground text-sm">{score.score.correct}/{score.score.total}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Launch lesson to class modal – visual card-based selection */}
      <Dialog open={launchLessonModalOpen} onOpenChange={setLaunchLessonModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Launch lesson to class</DialogTitle>
            <DialogDescription className="sr-only">Select a chapter and topic to launch to all students in the class session.</DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Choose a chapter, then a topic. All joined students will receive this lesson.</p>
          {launchLessonModalLoading ? (
            <div className="py-6 text-center text-muted-foreground">Loading lessons…</div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {/* Chapter cards */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">Chapter</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {chaptersForLaunch.map((ch: any) => {
                    const selected = ch.id === selectedLaunchChapterId;
                    const meta = [ch.curriculum, ch.class_name ? `Class ${ch.class_name}` : '', ch.subject].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => { setSelectedLaunchChapterId(ch.id); setSelectedLaunchTopicId(''); }}
                        className={`text-left rounded-lg border-2 p-3 transition-all ${
                          selected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-border bg-card hover:border-primary/50 hover:bg-accent/20'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="w-16 h-16 rounded-md bg-muted flex-shrink-0 flex items-center justify-center text-muted-foreground">
                            <FaBook className="w-6 h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">
                              {ch.chapter_number != null ? `Ch ${ch.chapter_number}. ` : ''}{ch.chapter_name || ch.id}
                            </p>
                            {meta && <p className="text-xs text-muted-foreground truncate">{meta}</p>}
                            <p className="text-xs text-muted-foreground/80 mt-0.5">{ch.topics?.length || 0} topic(s)</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Topic list when chapter selected */}
              {selectedLaunchChapterId && (() => {
                const ch = chaptersForLaunch.find((c: any) => c.id === selectedLaunchChapterId);
                const topics = ch?.topics || [];
                return (
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-2">Topic</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {topics.map((t: any, idx: number) => {
                        const selected = t.topic_id === selectedLaunchTopicId;
                        const label = (t.topic_priority != null ? `${t.topic_priority}. ` : `${idx + 1}. `) + (t.topic_name || t.topic_id);
                        return (
                          <button
                            key={t.topic_id}
                            type="button"
                            onClick={() => setSelectedLaunchTopicId(t.topic_id)}
                            className={`text-left rounded-lg border-2 px-3 py-2.5 transition-all ${
                              selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50 hover:bg-accent/20'
                            }`}
                          >
                            <p className="text-sm font-medium text-foreground truncate">{label}</p>
                            {t.learning_objective && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.learning_objective}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Summary */}
              {selectedLaunchChapterId && selectedLaunchTopicId && (() => {
                const ch = chaptersForLaunch.find((c: any) => c.id === selectedLaunchChapterId);
                const topic = ch?.topics?.find((t: any) => t.topic_id === selectedLaunchTopicId);
                if (!ch || !topic) return null;
                const meta = [ch.curriculum, ch.class_name ? `Class ${ch.class_name}` : ''].filter(Boolean).join(' · ');
                return (
                  <div className="rounded-lg border-2 border-primary/40 bg-primary/10 p-3 space-y-1 flex-shrink-0">
                    <p className="text-xs font-medium text-muted-foreground">You will launch</p>
                    <p className="text-sm font-semibold text-foreground">
                      {ch.chapter_name || ch.id} → {topic.topic_name || topic.topic_id}
                    </p>
                    {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
            <Button variant="outline" onClick={() => setLaunchLessonModalOpen(false)}>Cancel</Button>
            <Button onClick={handleLaunchLesson} disabled={!selectedLaunchChapterId || !selectedLaunchTopicId || sessionContextLoading}>
              Launch to class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
