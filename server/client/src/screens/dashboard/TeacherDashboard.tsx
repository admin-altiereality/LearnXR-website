/**
 * Enhanced Teacher Dashboard
 * 
 * Displays comprehensive insights for teacher's assigned classes including:
 * - Overall class insights
 * - Subject-wise breakdown
 * - Ability to share class data with other teachers from the same school
 * - View data from both managed and shared classes
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getClassEvaluation, type ClassEvaluation } from '../../services/evaluationService';
import type { Class, StudentScore, LessonLaunch } from '../../types/lms';
import { Link } from 'react-router-dom';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
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
  FaExclamationTriangle
} from 'react-icons/fa';

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

  // Fetch class evaluation when selected class changes
  useEffect(() => {
    if (!evaluationClassId) {
      setClassEvaluation(null);
      return;
    }
    setClassEvaluationLoading(true);
    getClassEvaluation(evaluationClassId)
      .then(setClassEvaluation)
      .catch(() => setClassEvaluation(null))
      .finally(() => setClassEvaluationLoading(false));
  }, [evaluationClassId]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white/60">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredClassInsights = selectedSubjectFilter === 'all'
    ? classInsights
    : classInsights.filter(ci => ci.subject === selectedSubjectFilter || (!ci.subject && selectedSubjectFilter === 'All Subjects'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FaChalkboardTeacher className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                  <span className="text-white">Learn</span>
                  <span className="text-purple-700">XR</span>
                  <TrademarkSymbol />
                </h1>
                <h2 className="text-xl font-semibold text-white">Teacher Dashboard</h2>
                <p className="text-white/50 text-sm mt-0.5">Comprehensive insights for your assigned classes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Student Approvals */}
        {pendingStudents.length > 0 && (
          <div className="mb-8">
            <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center relative">
                    <FaUserCheck className="text-2xl text-amber-400" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {pendingStudents.length}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">Student Approvals</h2>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-full border border-amber-500/30 flex items-center gap-1">
                        <FaBell className="text-xs" />
                        {pendingStudents.length} pending
                      </span>
                    </div>
                    <p className="text-white/60 text-sm mt-1">
                      You have {pendingStudents.length} student(s) waiting for approval.
                    </p>
                  </div>
                </div>
                <Link
                  to="/teacher/approvals"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition-colors border border-amber-500/30"
                >
                  Review Approvals
                  <FaArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FaBook className="text-blue-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">My Classes</p>
                <p className="text-2xl font-bold text-white">{stats.totalClasses}</p>
                {stats.sharedClasses > 0 && (
                  <p className="text-xs text-blue-400 mt-1">{stats.sharedClasses} shared</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FaUsers className="text-purple-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Total Students</p>
                <p className="text-2xl font-bold text-white">{stats.totalStudents}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-emerald-400">{stats.approvedStudents} approved</span>
                  {stats.pendingStudents > 0 && (
                    <span className="text-xs text-amber-400">{stats.pendingStudents} pending</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <FaChartLine className="text-emerald-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Avg Class Score</p>
                <p className="text-2xl font-bold text-white">{stats.averageClassScore}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <FaGraduationCap className="text-amber-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Lesson Launches</p>
                <p className="text-2xl font-bold text-white">{stats.totalLessonLaunches}</p>
                <p className="text-xs text-emerald-400 mt-1">{stats.completedLessons} completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Class evaluation (from evaluation API) */}
        {allClasses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FaTrophy className="text-amber-400" />
              Class Evaluation
            </h2>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <label className="text-white/70 text-sm">Class</label>
              <select
                value={evaluationClassId ?? ''}
                onChange={(e) => setEvaluationClassId(e.target.value || null)}
                className="rounded-lg border border-white/20 bg-white/5 text-white px-4 py-2 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              >
                {allClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name} {c.curriculum ? `(${c.curriculum})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {classEvaluationLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-2" />
                <p className="text-white/50 text-sm">Loading evaluation...</p>
              </div>
            ) : classEvaluation ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-white/50 text-sm">Avg score</p>
                    <p className="text-xl font-bold text-white">{classEvaluation.aggregate.averageScore}%</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Total attempts</p>
                    <p className="text-xl font-bold text-white">{classEvaluation.aggregate.totalAttempts}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Lesson completion</p>
                    <p className="text-xl font-bold text-white">{classEvaluation.aggregate.completionRate}%</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Students</p>
                    <p className="text-xl font-bold text-white">{classEvaluation.studentSummaries.length}</p>
                  </div>
                </div>
                {classEvaluation.bySubject && classEvaluation.bySubject.length > 0 && (
                  <div>
                    <p className="text-white/70 text-sm mb-2">By subject</p>
                    <div className="flex flex-wrap gap-2">
                      {classEvaluation.bySubject.map((s) => (
                        <span
                          key={s.subject}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm"
                        >
                          {s.subject}: {s.averageScore}% ({s.attemptCount} attempts)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
                <p className="text-white/50 text-sm">No evaluation data for this class yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Subject-wise Performance */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FaChartBar className="text-cyan-400" />
            Subject-wise Performance
          </h2>
          {subjectPerformance.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaBook className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No subject data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectPerformance.map((subject) => (
                <div
                  key={subject.subject}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">{subject.subject}</h3>
                    <span className={`text-2xl font-bold ${
                      subject.averageScore >= 70 ? 'text-emerald-400' :
                      subject.averageScore >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {subject.averageScore}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Students</span>
                      <span className="text-white">{subject.totalStudents}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Quizzes</span>
                      <span className="text-white">{subject.totalQuizzes}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Completion Rate</span>
                      <span className="text-white">{subject.completionRate}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          subject.completionRate >= 70 ? 'bg-emerald-500' :
                          subject.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${subject.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class Insights with Sharing */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FaBook className="text-purple-400" />
              Class Insights
            </h2>
            <div className="flex items-center gap-2">
              <FaFilter className="text-white/50" />
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer"
              >
                <option value="all">All Subjects</option>
                {Array.from(new Set(classInsights.map(ci => ci.subject || 'All Subjects'))).map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
          </div>
          {filteredClassInsights.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaBook className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No classes available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClassInsights.map((insight) => {
                const classItem = allClasses.find(c => c.id === insight.classId);
                const isOwner = insight.isOwner;
                const sharedWith = classItem?.shared_with_teachers || [];

                return (
                  <div
                    key={insight.classId}
                    className={`rounded-xl border p-4 hover:bg-white/[0.05] transition-colors ${
                      insight.isShared ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium">{insight.className}</h3>
                          {insight.isShared && (
                            <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs rounded-full border border-cyan-500/30">
                              Shared
                            </span>
                          )}
                        </div>
                        <p className="text-white/50 text-sm mt-1">
                          {insight.curriculum} • {insight.subject || 'All Subjects'}
                        </p>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => setSharingClassId(sharingClassId === insight.classId ? null : insight.classId)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Share class with other teachers"
                        >
                          <FaShareAlt className="text-blue-400" />
                        </button>
                      )}
                    </div>

                    {/* Sharing UI */}
                    {isOwner && sharingClassId === insight.classId && (
                      <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <p className="text-white/70 text-sm mb-2 font-medium">Share with teachers:</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {allTeachers.length === 0 ? (
                            <p className="text-white/50 text-xs">No other teachers in your school</p>
                          ) : (
                            allTeachers.map(teacher => {
                              const isShared = sharedWith.includes(teacher.uid);
                              return (
                                <div key={teacher.uid} className="flex items-center justify-between text-sm">
                                  <span className="text-white/70">
                                    {teacher.name || teacher.displayName || teacher.email}
                                  </span>
                                  <button
                                    onClick={() => handleShareClass(insight.classId, teacher.uid, !isShared)}
                                    className={`px-2 py-1 rounded text-xs transition-colors ${
                                      isShared
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-slate-700/50 text-white/70 border border-slate-600/50 hover:bg-slate-700'
                                    }`}
                                  >
                                    {isShared ? (
                                      <span className="flex items-center gap-1">
                                        <FaUnlock className="text-xs" />
                                        Shared
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <FaLock className="text-xs" />
                                        Share
                                      </span>
                                    )}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Students</span>
                        <span className="text-white">{insight.studentCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Avg Score</span>
                        <span className={`font-medium ${
                          insight.averageScore >= 70 ? 'text-emerald-400' :
                          insight.averageScore >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {insight.averageScore}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Completion</span>
                        <span className="text-white">
                          {insight.completedLessons} / {insight.totalLessons}
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${
                            insight.completionRate >= 70 ? 'bg-emerald-500' :
                            insight.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${insight.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Student Activity */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Student Activity</h2>
          {scores.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaChartLine className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No student activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scores.slice(0, 10).map((score) => {
                const student = students.find(s => s.uid === score.student_id);
                return (
                  <div
                    key={score.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium">
                            {student?.name || student?.displayName || 'Unknown Student'}
                          </h3>
                          {student?.approvalStatus && (
                            <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                              student.approvalStatus === 'approved' 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : student.approvalStatus === 'pending'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              {student.approvalStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-white/50 text-sm mt-1">
                          {score.subject} - {score.curriculum} Class {score.class_name}
                        </p>
                        <p className="text-white/30 text-xs mt-1">
                          Chapter: {score.chapter_id} • Attempt #{score.attempt_number}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <div className={`text-2xl font-bold ${
                          score.score.percentage >= 70 ? 'text-emerald-400' :
                          score.score.percentage >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {score.score.percentage}%
                        </div>
                        <p className="text-white/50 text-sm">
                          {score.score.correct}/{score.score.total}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
