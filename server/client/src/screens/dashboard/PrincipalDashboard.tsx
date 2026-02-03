/**
 * Principal Dashboard
 * 
 * Displays all teachers, all students, school-wide analytics, and teacher
 * activity metrics for their school only. Cannot see other schools' data.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { StudentScore, LessonLaunch } from '../../types/lms';
import { Link } from 'react-router-dom';
import { FaSchool, FaUsers, FaChalkboardTeacher, FaChartLine, FaGraduationCap, FaArrowRight, FaUserCheck, FaBell } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';

const PrincipalDashboard = () => {
  const { user, profile } = useAuth();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [launches, setLaunches] = useState<LessonLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTeachers: 0,
    approvedTeachers: 0,
    pendingTeachersCount: 0,
    totalStudents: 0,
    approvedStudents: 0,
    pendingStudentsCount: 0,
    averageSchoolScore: 0,
    totalLessonLaunches: 0,
    completedLessons: 0,
  });

  // Fetch pending students for approval count
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'principal' || !profile.managed_school_id) return;

    const schoolId = profile.managed_school_id;

    // Fetch all pending students in the school
    const pendingStudentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', schoolId),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribePendingStudents = onSnapshot(pendingStudentsQuery, (snapshot) => {
      const pendingData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      
      console.log('🔍 PrincipalDashboard: Pending students', {
        total: pendingData.length,
        schoolId,
      });
      
      setPendingStudents(pendingData);
    }, (error) => {
      console.error('Error fetching pending students:', error);
    });

    // Fetch all pending teachers in the school
    const pendingTeachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('school_id', '==', schoolId),
      where('approvalStatus', '==', 'pending')
    );

    const unsubscribePendingTeachers = onSnapshot(pendingTeachersQuery, (snapshot) => {
      const pendingData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      
      console.log('🔍 PrincipalDashboard: Pending teachers', {
        total: pendingData.length,
        schoolId,
      });
      
      setPendingTeachers(pendingData);
    }, (error) => {
      console.error('Error fetching pending teachers:', error);
    });

    return () => {
      unsubscribePendingStudents();
      unsubscribePendingTeachers();
    };
  }, [user?.uid, profile]);

  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'principal' || !profile.managed_school_id) return;

    setLoading(true);
    const schoolId = profile.managed_school_id;

    // Get all teachers in school (both approved and pending)
    const teachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('school_id', '==', schoolId)
    );

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setTeachers(teachersData);
    });

    // Get all students in school (both approved and pending)
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', schoolId)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setStudents(studentsData);
    });

    // Get all scores in school
    const scoresQuery = query(
      collection(db, 'student_scores'),
      where('school_id', '==', schoolId),
      orderBy('completed_at', 'desc')
    );

    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
      const scoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentScore[];
      setScores(scoresData);
      updateStats(teachers, students, scoresData, launches);
    });

    // Get all lesson launches in school
    const launchesQuery = query(
      collection(db, 'lesson_launches'),
      where('school_id', '==', schoolId),
      orderBy('launched_at', 'desc')
    );

    const unsubscribeLaunches = onSnapshot(launchesQuery, (snapshot) => {
      const launchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as LessonLaunch[];
      setLaunches(launchesData);
      updateStats(teachers, students, scores, launchesData);
      setLoading(false);
    });

    return () => {
      unsubscribeTeachers();
      unsubscribeStudents();
      unsubscribeScores();
      unsubscribeLaunches();
    };
  }, [user?.uid, profile]);

  const updateStats = (
    teachersData: any[],
    studentsData: any[],
    scoresData: StudentScore[],
    launchesData: LessonLaunch[]
  ) => {
    const totalTeachers = teachersData.length;
    const approvedTeachers = teachersData.filter(t => t.approvalStatus === 'approved').length;
    const pendingTeachersCount = teachersData.filter(t => t.approvalStatus === 'pending').length;
    const totalStudents = studentsData.length;
    const approvedStudents = studentsData.filter(s => s.approvalStatus === 'approved').length;
    const pendingStudentsCount = studentsData.filter(s => s.approvalStatus === 'pending').length;
    const averageSchoolScore = scoresData.length > 0
      ? scoresData.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scoresData.length
      : 0;
    const totalLessonLaunches = launchesData.length;
    const completedLessons = launchesData.filter(l => l.completion_status === 'completed').length;

    setStats({
      totalTeachers,
      approvedTeachers,
      pendingTeachersCount,
      totalStudents,
      approvedStudents,
      pendingStudentsCount,
      averageSchoolScore: Math.round(averageSchoolScore),
      totalLessonLaunches,
      completedLessons,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white/60">Loading school dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <FaSchool className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                  <span className="text-white">Learn</span>
                  <span className="text-purple-700">XR</span>
                  <TrademarkSymbol />
                </h1>
                <h2 className="text-xl font-semibold text-white">School Dashboard</h2>
                <p className="text-white/50 text-sm mt-0.5">School-wide analytics and management</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FaChalkboardTeacher className="text-purple-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Teachers</p>
                <p className="text-2xl font-bold text-white">{stats.totalTeachers}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-emerald-400">{stats.approvedTeachers} approved</span>
                  {stats.pendingTeachersCount > 0 && (
                    <span className="text-xs text-amber-400">{stats.pendingTeachersCount} pending</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FaUsers className="text-blue-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Students</p>
                <p className="text-2xl font-bold text-white">{stats.totalStudents}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-emerald-400">{stats.approvedStudents} approved</span>
                  {stats.pendingStudentsCount > 0 && (
                    <span className="text-xs text-amber-400">{stats.pendingStudentsCount} pending</span>
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
                <p className="text-white/50 text-sm">Avg Score</p>
                <p className="text-2xl font-bold text-white">{stats.averageSchoolScore}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <FaGraduationCap className="text-amber-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Launches</p>
                <p className="text-2xl font-bold text-white">{stats.totalLessonLaunches}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <FaGraduationCap className="text-cyan-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Completed</p>
                <p className="text-2xl font-bold text-white">{stats.completedLessons}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Student Approvals Card */}
          <div className={`rounded-2xl border p-6 ${
            pendingStudents.length > 0 
              ? 'border-amber-500/50 bg-amber-500/10' 
              : 'border-blue-500/30 bg-blue-500/10'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center relative ${
                  pendingStudents.length > 0 ? 'bg-amber-500/20' : 'bg-blue-500/20'
                }`}>
                  <FaUserCheck className={`text-2xl ${
                    pendingStudents.length > 0 ? 'text-amber-400' : 'text-blue-400'
                  }`} />
                  {pendingStudents.length > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {pendingStudents.length}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">Student Approvals</h2>
                    {pendingStudents.length > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-full border border-amber-500/30 flex items-center gap-1">
                        <FaBell className="text-xs" />
                        {pendingStudents.length} pending
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm mt-1">
                    {pendingStudents.length > 0 
                      ? `${pendingStudents.length} student(s) waiting for approval.`
                      : 'Review and approve students joining your school.'}
                  </p>
                </div>
              </div>
              <Link
                to="/teacher/approvals"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors border ${
                  pendingStudents.length > 0
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30'
                }`}
              >
                {pendingStudents.length > 0 ? 'Review Students' : 'Student Approvals'}
                <FaArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Teacher Approvals Card */}
          <div className={`rounded-2xl border p-6 ${
            pendingTeachers.length > 0 
              ? 'border-amber-500/50 bg-amber-500/10' 
              : 'border-purple-500/30 bg-purple-500/10'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center relative ${
                  pendingTeachers.length > 0 ? 'bg-amber-500/20' : 'bg-purple-500/20'
                }`}>
                  <FaChalkboardTeacher className={`text-2xl ${
                    pendingTeachers.length > 0 ? 'text-amber-400' : 'text-purple-400'
                  }`} />
                  {pendingTeachers.length > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {pendingTeachers.length}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">Teacher Approvals</h2>
                    {pendingTeachers.length > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-full border border-amber-500/30 flex items-center gap-1">
                        <FaBell className="text-xs" />
                        {pendingTeachers.length} pending
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm mt-1">
                    {pendingTeachers.length > 0 
                      ? `${pendingTeachers.length} teacher(s) waiting for approval.`
                      : 'Review and approve teachers joining your school.'}
                  </p>
                </div>
              </div>
              <Link
                to="/school/approvals"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors border ${
                  pendingTeachers.length > 0
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/30'
                }`}
              >
                {pendingTeachers.length > 0 ? 'Review Teachers' : 'Teacher Approvals'}
                <FaArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Teacher Management - quick access for Principal */}
        <div className="mb-8">
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FaChalkboardTeacher className="text-purple-400 text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Teacher Management</h2>
                  <p className="text-white/60 text-sm mt-1">
                    View and manage teachers, assign classes, and oversee school staff.
                  </p>
                </div>
              </div>
              <Link
                to="/admin/classes"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium transition-colors border border-purple-500/30"
              >
                Open Class Management
                <FaArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Teachers Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Teachers ({teachers.length})</h2>
          {teachers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaChalkboardTeacher className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No teachers in your school yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((teacher) => {
                const teacherClasses = teacher.managed_class_ids?.length || 0;
                const teacherStudents = students.filter(s => 
                  s.class_ids?.some(classId => teacher.managed_class_ids?.includes(classId))
                ).length;

                return (
                  <div
                    key={teacher.uid}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-medium">
                        {teacher.name || teacher.displayName || 'Unknown Teacher'}
                      </h3>
                      {teacher.approvalStatus && (
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                          teacher.approvalStatus === 'approved' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : teacher.approvalStatus === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {teacher.approvalStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-sm mb-3">{teacher.email}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">
                        {teacherClasses} classes
                      </span>
                      <span className="text-blue-400">
                        {teacherStudents} students
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent School Activity */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent School Activity</h2>
          {scores.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaChartLine className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No activity yet</p>
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

export default PrincipalDashboard;
