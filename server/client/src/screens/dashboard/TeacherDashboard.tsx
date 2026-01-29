/**
 * Teacher Dashboard
 * 
 * Displays students in teacher's classes, student scores and progress,
 * lesson activity analytics for their classes only. Cannot see other
 * teachers' students or cross-school data.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { Class, StudentScore, LessonLaunch } from '../../types/lms';
import { Link } from 'react-router-dom';
import { FaChalkboardTeacher, FaUsers, FaChartLine, FaBook, FaGraduationCap, FaUserCheck, FaArrowRight } from 'react-icons/fa';

const TeacherDashboard = () => {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [launches, setLaunches] = useState<LessonLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    averageClassScore: 0,
    totalLessonLaunches: 0,
  });

  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher') return;

    setLoading(true);

    // Get teacher's classes
    const classesQuery = query(
      collection(db, 'classes'),
      where('teacher_ids', 'array-contains', user.uid)
    );

    const unsubscribeClasses = onSnapshot(classesQuery, async (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Class[];
      setClasses(classesData);

      // Get students in these classes
      if (classesData.length > 0) {
        const classIds = classesData.map(c => c.id);
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('school_id', '==', profile.school_id),
          where('class_ids', 'array-contains-any', classIds)
        );

        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsData = studentsSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        }));
        setStudents(studentsData);

        // Get scores for these classes
        const scoresQuery = query(
          collection(db, 'student_scores'),
          where('school_id', '==', profile.school_id),
          where('class_id', 'in', classIds),
          orderBy('completed_at', 'desc')
        );

        const unsubscribeScores = onSnapshot(scoresQuery, (scoresSnapshot) => {
          const scoresData = scoresSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as StudentScore[];
          setScores(scoresData);
          updateStats(classesData, studentsData, scoresData, launches);
        });

        // Get lesson launches for these classes
        const launchesQuery = query(
          collection(db, 'lesson_launches'),
          where('school_id', '==', profile.school_id),
          where('class_id', 'in', classIds),
          orderBy('launched_at', 'desc')
        );

        const unsubscribeLaunches = onSnapshot(launchesQuery, (launchesSnapshot) => {
          const launchesData = launchesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as LessonLaunch[];
          setLaunches(launchesData);
          updateStats(classesData, studentsData, scores, launchesData);
          setLoading(false);
        });

        return () => {
          unsubscribeScores();
          unsubscribeLaunches();
        };
      } else {
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching classes:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeClasses();
    };
  }, [user?.uid, profile]);

  const updateStats = (
    classesData: Class[],
    studentsData: any[],
    scoresData: StudentScore[],
    launchesData: LessonLaunch[]
  ) => {
    const totalClasses = classesData.length;
    const totalStudents = studentsData.length;
    const averageClassScore = scoresData.length > 0
      ? scoresData.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scoresData.length
      : 0;
    const totalLessonLaunches = launchesData.length;

    setStats({
      totalClasses,
      totalStudents,
      averageClassScore: Math.round(averageClassScore),
      totalLessonLaunches,
    });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <FaChalkboardTeacher className="text-white" />
            </div>
            Teacher Dashboard
          </h1>
          <p className="text-white/50">Manage your classes and track student progress</p>
        </div>

        {/* Student Approvals - quick access for Teacher */}
        <div className="mb-8">
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FaUserCheck className="text-blue-400 text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Student Approvals</h2>
                  <p className="text-white/60 text-sm mt-1">
                    Review and approve students joining your classes.
                  </p>
                </div>
              </div>
              <Link
                to="/teacher/approvals"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium transition-colors border border-blue-500/30"
              >
                Open Student Approvals
                <FaArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

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
              </div>
            </div>
          </div>
        </div>

        {/* My Classes */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">My Classes</h2>
          {classes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaBook className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No classes assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((classItem) => {
                const classStudents = students.filter(s => 
                  s.class_ids?.includes(classItem.id)
                );
                const classScores = scores.filter(s => s.class_id === classItem.id);
                const avgScore = classScores.length > 0
                  ? Math.round(classScores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / classScores.length)
                  : 0;

                return (
                  <div
                    key={classItem.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <h3 className="text-white font-medium mb-2">{classItem.class_name}</h3>
                    <p className="text-white/50 text-sm mb-3">
                      {classItem.curriculum} • {classItem.subject || 'All Subjects'}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">
                        {classStudents.length} students
                      </span>
                      <span className="text-emerald-400 font-medium">
                        Avg: {avgScore}%
                      </span>
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
                        <h3 className="text-white font-medium">
                          {student?.name || student?.displayName || 'Unknown Student'}
                        </h3>
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
