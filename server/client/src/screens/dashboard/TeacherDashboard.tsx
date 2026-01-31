/**
 * Teacher Dashboard
 * 
 * Displays students in teacher's classes, student scores and progress,
 * lesson activity analytics for their classes only. Cannot see other
 * teachers' students or cross-school data.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { Class, StudentScore, LessonLaunch } from '../../types/lms';
import { Link } from 'react-router-dom';
import { FaChalkboardTeacher, FaUsers, FaChartLine, FaBook, FaGraduationCap, FaUserCheck, FaArrowRight, FaBell, FaClock } from 'react-icons/fa';

const TeacherDashboard = () => {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [launches, setLaunches] = useState<LessonLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    approvedStudents: 0,
    pendingStudents: 0,
    averageClassScore: 0,
    totalLessonLaunches: 0,
  });

  // Fetch pending students for approval count
  // NOTE: Pending students don't have class_ids yet, so show ALL pending students in the school
  // Teachers can approve any student in their school, then assign them to classes
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher' || !profile.school_id) {
      console.warn('⚠️ TeacherDashboard: Missing required data', {
        hasUser: !!user?.uid,
        hasProfile: !!profile,
        role: profile?.role,
        schoolId: profile?.school_id,
      });
      return;
    }

    console.log('🔍 TeacherDashboard: Starting pending students query', {
      schoolId: profile.school_id,
      teacherId: user.uid,
      teacherName: profile.name || profile.displayName,
      teacherClassIds: profile.managed_class_ids,
    });

    // Fetch all pending students in the same school (no class_ids filter for pending)
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
      
      console.log('🔍 TeacherDashboard: Pending students query result', {
        total: pendingData.length,
        schoolId: profile.school_id,
        teacherClassIds: profile.managed_class_ids,
        students: pendingData.map(s => ({
          uid: s.uid,
          name: s.name || s.displayName,
          school_id: s.school_id,
          approvalStatus: s.approvalStatus,
        })),
      });
      
      // For pending students: Show ALL students in the school (they don't have class_ids yet)
      // After approval, students can be assigned to specific classes
      setPendingStudents(pendingData);
    }, (error) => {
      console.error('❌ TeacherDashboard: Error fetching pending students', {
        error,
        schoolId: profile.school_id,
        errorCode: error.code,
        errorMessage: error.message,
      });
    });

    return () => unsubscribePending();
  }, [user?.uid, profile]);

  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'teacher') {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get teacher's classes
    // If teacher has school_id, filter by it for better security and performance
    // If not, query by teacher_ids only (Firestore rules will still protect access)
    let classesQuery;
    if (profile.school_id) {
      classesQuery = query(
        collection(db, 'classes'),
        where('school_id', '==', profile.school_id),
        where('teacher_ids', 'array-contains', user.uid)
      );
    } else {
      console.warn('⚠️ TeacherDashboard: Teacher missing school_id, querying by teacher_ids only', {
        teacherId: user.uid,
        teacherName: profile.name || profile.displayName,
      });
      // Query without school_id filter - Firestore rules will still protect access
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
      
      console.log('🔍 TeacherDashboard: Classes updated', {
        total: classesData.length,
        classIds: classesData.map(c => c.id),
        classNames: classesData.map(c => c.class_name),
        teacherId: user.uid,
      });
      
      setClasses(classesData);

      // Auto-assign school_id if teacher is missing it but has classes assigned
      if (classesData.length > 0 && !profile.school_id && user?.uid) {
        const firstClass = classesData[0];
        if (firstClass.school_id) {
          try {
            console.log('🔧 TeacherDashboard: Auto-assigning school_id from class', {
              teacherId: user.uid,
              schoolId: firstClass.school_id,
              classId: firstClass.id,
            });
            await updateDoc(doc(db, 'users', user.uid), {
              school_id: firstClass.school_id,
              updatedAt: new Date().toISOString(),
            });
            console.log('✅ TeacherDashboard: Successfully assigned school_id to teacher');
            // Note: The profile will update via AuthContext listener, so we don't need to manually update state
          } catch (error: any) {
            console.error('❌ TeacherDashboard: Error auto-assigning school_id', {
              error,
              errorCode: error.code,
              errorMessage: error.message,
            });
          }
        }
      }

      // Get students in these classes (both approved and pending)
      if (classesData.length > 0) {
        const classIds = classesData.map(c => c.id);
        // Use school_id from profile, or fallback to first class's school_id
        const schoolIdForQuery = profile.school_id || classesData[0]?.school_id;
        
        if (!schoolIdForQuery) {
          console.warn('⚠️ TeacherDashboard: Cannot query students - no school_id available', {
            teacherId: user?.uid,
            hasProfileSchoolId: !!profile.school_id,
            hasClassSchoolId: !!classesData[0]?.school_id,
          });
          setStudents([]);
          setScores([]);
          setLaunches([]);
          setLoading(false);
          return;
        }

        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('school_id', '==', schoolIdForQuery),
          where('class_ids', 'array-contains-any', classIds)
        );

        // Use real-time listener for students so dashboard updates when students are assigned
        const unsubscribeStudents = onSnapshot(studentsQuery, (studentsSnapshot) => {
          const studentsData = studentsSnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
          }));
          console.log('🔍 TeacherDashboard: Students updated', {
            total: studentsData.length,
            approved: studentsData.filter(s => s.approvalStatus === 'approved').length,
            pending: studentsData.filter(s => s.approvalStatus === 'pending').length,
            classIds,
            schoolId: schoolIdForQuery,
            studentDetails: studentsData.map(s => ({
              uid: s.uid,
              name: s.name || s.displayName,
              approvalStatus: s.approvalStatus,
              class_ids: s.class_ids,
              school_id: s.school_id,
            })),
          });
          setStudents(studentsData);
        }, (error) => {
          console.error('❌ TeacherDashboard: Error fetching students', {
            error,
            errorCode: error.code,
            errorMessage: error.message,
            classIds,
            schoolId: schoolIdForQuery,
          });
        });

        // Get scores for these classes
        const scoresQuery = query(
          collection(db, 'student_scores'),
          where('school_id', '==', schoolIdForQuery),
          where('class_id', 'in', classIds),
          orderBy('completed_at', 'desc')
        );

        const unsubscribeScores = onSnapshot(scoresQuery, (scoresSnapshot) => {
          const scoresData = scoresSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as StudentScore[];
          setScores(scoresData);
        });

        // Get lesson launches for these classes
        const launchesQuery = query(
          collection(db, 'lesson_launches'),
          where('school_id', '==', schoolIdForQuery),
          where('class_id', 'in', classIds),
          orderBy('launched_at', 'desc')
        );

        const unsubscribeLaunches = onSnapshot(launchesQuery, (launchesSnapshot) => {
          const launchesData = launchesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as LessonLaunch[];
          setLaunches(launchesData);
          setLoading(false);
        });

        return () => {
          unsubscribeStudents();
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

  // Update stats when data changes
  useEffect(() => {
    const totalClasses = classes.length;
    const totalStudents = students.length;
    const approvedStudents = students.filter(s => s.approvalStatus === 'approved').length;
    // Use pendingStudents state (includes all pending students in school, not just those in classes)
    // Don't calculate from students as that only includes students already assigned to classes
    const averageClassScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    const totalLessonLaunches = launches.length;

    setStats({
      totalClasses,
      totalStudents,
      approvedStudents,
      pendingStudents: pendingStudents.length, // Use state value, not calculated from students
      averageClassScore: Math.round(averageClassScore),
      totalLessonLaunches,
    });
  }, [classes, students, scores, launches, pendingStudents]);

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
          <div className={`rounded-2xl border p-6 ${
            pendingStudents.length > 0 
              ? 'border-amber-500/50 bg-amber-500/10 animate-pulse-slow' 
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
                      ? `You have ${pendingStudents.length} student(s) waiting for approval.`
                      : 'Review and approve students joining your classes.'}
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
                {pendingStudents.length > 0 ? 'Review Approvals' : 'Open Student Approvals'}
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
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white/50">
                          {classStudents.length} students
                        </span>
                        <div className="flex gap-2 text-xs">
                          <span className="text-emerald-400">
                            {classStudents.filter(s => s.approvalStatus === 'approved').length} approved
                          </span>
                          {classStudents.filter(s => s.approvalStatus === 'pending').length > 0 && (
                            <span className="text-amber-400">
                              {classStudents.filter(s => s.approvalStatus === 'pending').length} pending
                            </span>
                          )}
                        </div>
                      </div>
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
