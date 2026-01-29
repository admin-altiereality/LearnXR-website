/**
 * Student Dashboard
 * 
 * Displays lessons the student has launched/enrolled in, personal progress,
 * scores, and completion status. Students can ONLY see their own data.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { LessonLaunch, StudentScore } from '../../types/lms';
import { FaBook, FaChartLine, FaCheckCircle, FaClock, FaGraduationCap } from 'react-icons/fa';

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const [lessonLaunches, setLessonLaunches] = useState<LessonLaunch[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    averageScore: 0,
    totalAttempts: 0,
  });

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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FaGraduationCap className="text-white" />
            </div>
            My Dashboard
          </h1>
          <p className="text-white/50">Track your learning progress and performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <FaBook className="text-emerald-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Total Lessons</p>
                <p className="text-2xl font-bold text-white">{stats.totalLessons}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FaCheckCircle className="text-blue-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Completed</p>
                <p className="text-2xl font-bold text-white">{stats.completedLessons}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FaChartLine className="text-purple-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Average Score</p>
                <p className="text-2xl font-bold text-white">{stats.averageScore}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <FaClock className="text-amber-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Quiz Attempts</p>
                <p className="text-2xl font-bold text-white">{stats.totalAttempts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Lesson Launches */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Lessons</h2>
          {lessonLaunches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaBook className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No lessons launched yet</p>
              <p className="text-white/30 text-sm mt-2">Start learning by launching a lesson!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessonLaunches.slice(0, 10).map((launch) => (
                <div
                  key={launch.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium">
                        {launch.subject} - {launch.curriculum} Class {launch.class_name}
                      </h3>
                      <p className="text-white/50 text-sm mt-1">
                        Chapter: {launch.chapter_id} • Topic: {launch.topic_id}
                      </p>
                      <p className="text-white/30 text-xs mt-1">
                        Launched: {new Date(launch.launched_at as any).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-4">
                      {launch.completion_status === 'completed' ? (
                        <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20">
                          Completed
                        </span>
                      ) : launch.completion_status === 'in_progress' ? (
                        <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20">
                          In Progress
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-sm border border-amber-500/20">
                          Abandoned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Scores */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Quiz Scores</h2>
          {scores.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaChartLine className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No quiz attempts yet</p>
              <p className="text-white/30 text-sm mt-2">Complete lessons and take quizzes to see your scores!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scores.slice(0, 10).map((score) => (
                <div
                  key={score.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium">
                        {score.subject} - {score.curriculum} Class {score.class_name}
                      </h3>
                      <p className="text-white/50 text-sm mt-1">
                        Chapter: {score.chapter_id} • Topic: {score.topic_id} • Attempt #{score.attempt_number}
                      </p>
                      <p className="text-white/30 text-xs mt-1">
                        Completed: {new Date(score.completed_at as any).toLocaleDateString()}
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
                        {score.score.correct}/{score.score.total} correct
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
