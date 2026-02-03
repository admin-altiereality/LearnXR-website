/**
 * School Administrator Dashboard
 * 
 * Displays all lesson launches across all classes, student quiz scores,
 * and curriculum completion levels for their school.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { StudentScore, LessonLaunch, Class } from '../../types/lms';
import { Link } from 'react-router-dom';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { 
  FaSchool, 
  FaUsers, 
  FaChalkboardTeacher, 
  FaChartLine, 
  FaGraduationCap, 
  FaArrowRight, 
  FaBook,
  FaTrophy,
  FaExclamationTriangle,
  FaClock,
  FaFilter,
  FaChartBar,
  FaUserCheck,
  FaTimesCircle,
  FaBell
} from 'react-icons/fa';

interface CurriculumCompletion {
  curriculum: string;
  completedTopics: number;
  totalTopics: number;
  completionPercentage: number;
}

interface StudentPerformance {
  studentId: string;
  studentName: string;
  studentEmail: string;
  averageScore: number;
  totalQuizzes: number;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
  totalTimeSpent: number; // in seconds
  className?: string;
}

interface TeacherPerformance {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  classesManaged: number;
  studentsTaught: number;
  averageStudentScore: number;
  totalApprovals: number;
  recentActivity: number; // approvals in last 7 days
}

interface ClassPerformance {
  classId: string;
  className: string;
  studentCount: number;
  averageScore: number;
  completionRate: number;
  totalLessons: number;
  completedLessons: number;
}

const SchoolDashboard = () => {
  const { user, profile } = useAuth();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [launches, setLaunches] = useState<LessonLaunch[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedCurriculumFilter, setSelectedCurriculumFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalTeachers: 0,
    approvedTeachers: 0,
    pendingTeachersCount: 0,
    totalStudents: 0,
    approvedStudents: 0,
    pendingStudentsCount: 0,
    averageSchoolScore: 0,
    totalLessonLaunches: 0,
    completedLessons: 0,
    averageTimePerLesson: 0,
    totalLearningTime: 0,
  });

  // Fetch pending students and teachers
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'school') {
      console.warn('⚠️ SchoolDashboard: Missing required data', {
        hasUser: !!user?.uid,
        hasProfile: !!profile,
        role: profile?.role,
      });
      return;
    }

    // Use fallback: school_id or managed_school_id (same as SchoolApprovals)
    const schoolId = profile.school_id || profile.managed_school_id;
    
    if (!schoolId) {
      console.warn('⚠️ SchoolDashboard: No school_id or managed_school_id found', {
        profileSchoolId: profile.school_id,
        profileManagedSchoolId: profile.managed_school_id,
        profileRole: profile.role,
        profileUid: profile.uid,
      });
      return;
    }

    console.log('🔍 SchoolDashboard: Starting queries', {
      schoolId,
      profileSchoolId: profile.school_id,
      profileManagedSchoolId: profile.managed_school_id,
      adminUid: user.uid,
    });

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
      
      console.log('🔍 SchoolDashboard: Pending students query result', {
        total: pendingData.length,
        schoolId,
        students: pendingData.map(s => ({
          uid: s.uid,
          name: s.name || s.displayName,
          school_id: s.school_id,
          approvalStatus: s.approvalStatus,
        })),
      });
      
      setPendingStudents(pendingData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching pending students', {
        error,
        errorObject: error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
        errorStack: error.stack,
        profileRole: profile.role,
        profileSchoolId: profile.school_id,
        profileManagedSchoolId: profile.managed_school_id,
      });
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
      
      console.log('🔍 SchoolDashboard: Pending teachers query result', {
        total: pendingData.length,
        schoolId,
        teachers: pendingData.map(t => ({
          uid: t.uid,
          name: t.name || t.displayName,
          school_id: t.school_id,
          approvalStatus: t.approvalStatus,
        })),
      });
      
      setPendingTeachers(pendingData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching pending teachers', {
        error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
      });
    });

    return () => {
      unsubscribePendingStudents();
      unsubscribePendingTeachers();
    };
  }, [user?.uid, profile]);

  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'school') return;

    // Use fallback: school_id or managed_school_id (same as SchoolApprovals)
    const schoolId = profile.school_id || profile.managed_school_id;
    
    if (!schoolId) {
      console.warn('⚠️ SchoolDashboard: No school_id or managed_school_id found for school admin', {
        profileRole: profile.role,
        profileSchoolId: profile.school_id,
        profileManagedSchoolId: profile.managed_school_id,
        profileUid: profile.uid,
      });
      setLoading(false);
      return;
    }

    console.log('🔍 SchoolDashboard: Starting queries', {
      schoolId,
      profileRole: profile.role,
      profileSchoolId: profile.school_id,
      profileManagedSchoolId: profile.managed_school_id,
    });

    setLoading(true);

    // Get all classes in school
    const classesQuery = query(
      collection(db, 'classes'),
      where('school_id', '==', schoolId)
    );

    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      const classesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('🔍 SchoolDashboard: Classes query result', {
        total: classesData.length,
        schoolId,
      });
      setClasses(classesData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching classes', {
        error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
      });
    });

    // Get all teachers in school
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
      console.log('🔍 SchoolDashboard: Teachers query result', {
        total: teachersData.length,
        schoolId,
        teachers: teachersData.map(t => ({
          uid: t.uid,
          name: t.name || t.displayName,
          school_id: t.school_id,
          approvalStatus: t.approvalStatus,
        })),
      });
      setTeachers(teachersData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching teachers', {
        error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
        profileRole: profile.role,
        profileSchoolId: profile.school_id,
        profileManagedSchoolId: profile.managed_school_id,
      });
    });

    // Get all students in school
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
      console.log('🔍 SchoolDashboard: Students query result', {
        total: studentsData.length,
        schoolId,
        students: studentsData.map(s => ({
          uid: s.uid,
          name: s.name || s.displayName,
          school_id: s.school_id,
          approvalStatus: s.approvalStatus,
          class_ids: s.class_ids,
        })),
      });
      setStudents(studentsData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching students', {
        error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
        profileRole: profile.role,
        profileSchoolId: profile.school_id,
        profileManagedSchoolId: profile.managed_school_id,
      });
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
      console.log('🔍 SchoolDashboard: Scores query result', {
        total: scoresData.length,
        schoolId,
      });
      setScores(scoresData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching scores', {
        error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
      });
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
      console.log('🔍 SchoolDashboard: Launches query result', {
        total: launchesData.length,
        schoolId,
      });
      setLaunches(launchesData);
    }, (error) => {
      console.error('❌ SchoolDashboard: Error fetching launches', {
        error,
        schoolId,
        errorCode: error.code,
        errorMessage: error.message,
      });
    });

    // Fetch all chapters for curriculum completion calculation
    const fetchChapters = async () => {
      try {
        const chaptersRef = collection(db, 'curriculum_chapters');
        const chaptersSnapshot = await getDocs(chaptersRef);
        const chaptersData = chaptersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setChapters(chaptersData);
      } catch (error) {
        console.error('Error fetching chapters:', error);
      }
    };

    fetchChapters();

    // Cleanup
    return () => {
      unsubscribeClasses();
      unsubscribeTeachers();
      unsubscribeStudents();
      unsubscribeScores();
      unsubscribeLaunches();
    };
  }, [user?.uid, profile]);

  // Calculate curriculum completion
  const curriculumCompletion = useMemo((): CurriculumCompletion[] => {
    if (chapters.length === 0) return [];

    const curriculumMap = new Map<string, { completed: number; total: number }>();

    chapters.forEach(chapter => {
      const curriculum = chapter.curriculum || 'UNKNOWN';
      if (!curriculumMap.has(curriculum)) {
        curriculumMap.set(curriculum, { completed: 0, total: 0 });
      }

      const curriculumData = curriculumMap.get(curriculum)!;
      
      if (chapter.topics && Array.isArray(chapter.topics)) {
        chapter.topics.forEach(topic => {
          curriculumData.total++;
          // Check if topic is completed by any student in the school
          const isCompleted = launches.some(launch => 
            launch.chapter_id === chapter.id &&
            launch.topic_id === topic.topic_id &&
            launch.completion_status === 'completed'
          );
          if (isCompleted) {
            curriculumData.completed++;
          }
        });
      }
    });

    return Array.from(curriculumMap.entries()).map(([curriculum, data]) => ({
      curriculum,
      completedTopics: data.completed,
      totalTopics: data.total,
      completionPercentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    })).sort((a, b) => b.completionPercentage - a.completionPercentage);
  }, [chapters, launches]);

  // Calculate student performance metrics
  const studentPerformance = useMemo((): StudentPerformance[] => {
    const performanceMap = new Map<string, StudentPerformance>();

    students.forEach(student => {
      const studentScores = scores.filter(s => s.student_id === student.uid);
      const studentLaunches = launches.filter(l => l.student_id === student.uid);
      const completedLaunches = studentLaunches.filter(l => l.completion_status === 'completed');

      const totalScore = studentScores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0);
      const averageScore = studentScores.length > 0 ? totalScore / studentScores.length : 0;

      // Calculate total time spent
      const totalTime = studentScores.reduce((sum, s) => sum + (s.time_taken_seconds || 0), 0) +
                       studentLaunches.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);

      // Get class name
      let className = student.class || 'Not Assigned';
      if (student.class_ids && student.class_ids.length > 0) {
        const classData = classes.find(c => c.id === student.class_ids[0]);
        if (classData) {
          className = classData.class_name;
        }
      }

      performanceMap.set(student.uid, {
        studentId: student.uid,
        studentName: student.name || student.displayName || 'Unknown',
        studentEmail: student.email || '',
        averageScore: Math.round(averageScore),
        totalQuizzes: studentScores.length,
        completedLessons: completedLaunches.length,
        totalLessons: studentLaunches.length,
        completionRate: studentLaunches.length > 0 
          ? Math.round((completedLaunches.length / studentLaunches.length) * 100) 
          : 0,
        totalTimeSpent: totalTime,
        className,
      });
    });

    return Array.from(performanceMap.values());
  }, [students, scores, launches, classes]);

  // Calculate teacher performance metrics
  const teacherPerformance = useMemo((): TeacherPerformance[] => {
    const performanceMap = new Map<string, TeacherPerformance>();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    teachers.forEach(teacher => {
      const teacherClasses = classes.filter(c => 
        c.teacher_ids?.includes(teacher.uid)
      );
      const classIds = teacherClasses.map(c => c.id);
      const teacherStudents = students.filter(s =>
        s.class_ids?.some(cid => classIds.includes(cid))
      );

      // Get scores for students in teacher's classes
      const teacherScores = scores.filter(s =>
        teacherStudents.some(ts => ts.uid === s.student_id)
      );
      const averageStudentScore = teacherScores.length > 0
        ? teacherScores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / teacherScores.length
        : 0;

      // Count recent approvals (students approved by this teacher in last 7 days)
      const recentApprovals = students.filter(s => {
        const approvedAt = (s as any).approvedAt;
        if (!approvedAt) return false;
        const approvedDate = approvedAt.toDate ? approvedAt.toDate() : new Date(approvedAt);
        return approvedDate >= sevenDaysAgo && (s as any).approvedBy === teacher.uid;
      }).length;

      performanceMap.set(teacher.uid, {
        teacherId: teacher.uid,
        teacherName: teacher.name || teacher.displayName || 'Unknown',
        teacherEmail: teacher.email || '',
        classesManaged: teacherClasses.length,
        studentsTaught: teacherStudents.length,
        averageStudentScore: Math.round(averageStudentScore),
        totalApprovals: students.filter(s => (s as any).approvedBy === teacher.uid).length,
        recentActivity: recentApprovals,
      });
    });

    return Array.from(performanceMap.values());
  }, [teachers, classes, students, scores]);

  // Calculate class performance metrics
  const classPerformance = useMemo((): ClassPerformance[] => {
    return classes.map(classItem => {
      const classStudents = students.filter(s =>
        s.class_ids?.includes(classItem.id)
      );
      const classScores = scores.filter(s =>
        classStudents.some(cs => cs.uid === s.student_id)
      );
      const classLaunches = launches.filter(l =>
        classStudents.some(cs => cs.uid === l.student_id)
      );
      const completedLaunches = classLaunches.filter(l => l.completion_status === 'completed');

      const averageScore = classScores.length > 0
        ? classScores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / classScores.length
        : 0;

      return {
        classId: classItem.id,
        className: classItem.class_name,
        studentCount: classStudents.length,
        averageScore: Math.round(averageScore),
        completionRate: classLaunches.length > 0
          ? Math.round((completedLaunches.length / classLaunches.length) * 100)
          : 0,
        totalLessons: classLaunches.length,
        completedLessons: completedLaunches.length,
      };
    });
  }, [classes, students, scores, launches]);

  // Calculate time tracking metrics
  const timeMetrics = useMemo(() => {
    const totalTime = scores.reduce((sum, s) => sum + (s.time_taken_seconds || 0), 0) +
                     launches.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const completedLaunches = launches.filter(l => l.completion_status === 'completed');
    const averageTimePerLesson = completedLaunches.length > 0
      ? totalTime / completedLaunches.length
      : 0;

    return {
      totalLearningTime: totalTime, // in seconds
      averageTimePerLesson: Math.round(averageTimePerLesson), // in seconds
      totalLessons: launches.length,
      completedLessons: completedLaunches.length,
    };
  }, [scores, launches]);

  // Update stats
  useEffect(() => {
    const totalClasses = classes.length;
    const totalTeachers = teachers.length;
    const approvedTeachers = teachers.filter(t => t.approvalStatus === 'approved').length;
    // Use pendingTeachers state instead of filtering teachers array (more accurate)
    const pendingTeachersCount = pendingTeachers.length;
    const totalStudents = students.length;
    const approvedStudents = students.filter(s => s.approvalStatus === 'approved').length;
    // Use pendingStudents state instead of filtering students array (more accurate)
    const pendingStudentsCount = pendingStudents.length;
    const averageSchoolScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    const totalLessonLaunches = launches.length;
    const completedLessons = launches.filter(l => l.completion_status === 'completed').length;

    setStats({
      totalClasses,
      totalTeachers,
      approvedTeachers,
      pendingTeachersCount,
      totalStudents,
      approvedStudents,
      pendingStudentsCount,
      averageSchoolScore: Math.round(averageSchoolScore),
      totalLessonLaunches,
      completedLessons,
      averageTimePerLesson: timeMetrics.averageTimePerLesson,
      totalLearningTime: timeMetrics.totalLearningTime,
    });
    setLoading(false);
  }, [classes, teachers, students, scores, launches, timeMetrics, pendingTeachers, pendingStudents]);

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
                <h2 className="text-xl font-semibold text-white">School Administrator Dashboard</h2>
                <p className="text-white/50 text-sm mt-0.5">Monitor lesson launches, quiz scores, and curriculum completion</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <FaFilter className="text-white/50" />
            <span className="text-white/70 text-sm">Filters:</span>
          </div>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>
          <select
            value={selectedCurriculumFilter}
            onChange={(e) => setSelectedCurriculumFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer"
          >
            <option value="all">All Curricula</option>
            {Array.from(new Set(chapters.map(c => c.curriculum))).map(cur => (
              <option key={cur} value={cur}>{cur}</option>
            ))}
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FaBook className="text-purple-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Classes</p>
                <p className="text-2xl font-bold text-white">{stats.totalClasses}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FaChalkboardTeacher className="text-blue-400 text-xl" />
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

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <FaUsers className="text-cyan-400 text-xl" />
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

          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <FaGraduationCap className="text-violet-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Completed</p>
                <p className="text-2xl font-bold text-white">{stats.completedLessons}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Tracking Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <FaClock className="text-indigo-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Avg Time/Lesson</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round(stats.averageTimePerLesson / 60)} min
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                <FaClock className="text-pink-400 text-xl" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Total Learning Time</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round(stats.totalLearningTime / 3600)} hrs
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Class Management */}
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FaBook className="text-purple-400 text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Class Management</h2>
                  <p className="text-white/60 text-sm mt-1">
                    Manage classes and assign teachers.
                  </p>
                </div>
              </div>
              <Link
                to="/admin/classes"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium transition-colors border border-purple-500/30"
              >
                Open
                <FaArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Teacher Approvals Card */}
          <div className={`rounded-2xl border p-6 ${
            pendingTeachers.length > 0 
              ? 'border-amber-500/50 bg-amber-500/10' 
              : 'border-blue-500/30 bg-blue-500/10'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center relative ${
                  pendingTeachers.length > 0 ? 'bg-amber-500/20' : 'bg-blue-500/20'
                }`}>
                  <FaChalkboardTeacher className={`text-2xl ${
                    pendingTeachers.length > 0 ? 'text-amber-400' : 'text-blue-400'
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
                      ? `${pendingTeachers.length} teacher(s) waiting.`
                      : 'Approve teachers for your school.'}
                  </p>
                </div>
              </div>
              <Link
                to="/school/approvals"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors border ${
                  pendingTeachers.length > 0
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30'
                }`}
              >
                {pendingTeachers.length > 0 ? 'Review' : 'Open'}
                <FaArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Curriculum Completion */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Curriculum Completion</h2>
          {curriculumCompletion.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaGraduationCap className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No curriculum data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {curriculumCompletion.map((curriculum) => (
                <div
                  key={curriculum.curriculum}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">{curriculum.curriculum}</h3>
                    <span className={`text-2xl font-bold ${
                      curriculum.completionPercentage >= 70 ? 'text-emerald-400' :
                      curriculum.completionPercentage >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {curriculum.completionPercentage}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Completed Topics</span>
                      <span className="text-white">{curriculum.completedTopics}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Total Topics</span>
                      <span className="text-white">{curriculum.totalTopics}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          curriculum.completionPercentage >= 70 ? 'bg-emerald-500' :
                          curriculum.completionPercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${curriculum.completionPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quiz Scores */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Quiz Scores</h2>
          {scores.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaChartLine className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No quiz scores yet</p>
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

        {/* Student Performance Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FaChartBar className="text-cyan-400" />
            Student Performance Overview
          </h2>
          {studentPerformance.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaUsers className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No student performance data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top Performers */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <FaTrophy className="text-amber-400" />
                  Top Performers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {studentPerformance
                    .sort((a, b) => b.averageScore - a.averageScore)
                    .slice(0, 6)
                    .map((student) => (
                      <div
                        key={student.studentId}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-medium truncate">{student.studentName}</h4>
                          <span className="text-emerald-400 font-bold">{student.averageScore}%</span>
                        </div>
                        <p className="text-white/50 text-xs mb-2">{student.className}</p>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Quizzes: {student.totalQuizzes}</span>
                          <span>Completion: {student.completionRate}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Students Needing Attention */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <FaExclamationTriangle className="text-red-400" />
                  Students Needing Attention
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {studentPerformance
                    .filter(s => s.averageScore < 50 || s.completionRate < 30)
                    .sort((a, b) => a.averageScore - b.averageScore)
                    .slice(0, 6)
                    .map((student) => (
                      <div
                        key={student.studentId}
                        className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-medium truncate">{student.studentName}</h4>
                          <span className="text-red-400 font-bold">{student.averageScore}%</span>
                        </div>
                        <p className="text-white/50 text-xs mb-2">{student.className}</p>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Quizzes: {student.totalQuizzes}</span>
                          <span>Completion: {student.completionRate}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* All Students Table */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Class</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Avg Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Quizzes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Completion</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70 uppercase">Time Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {studentPerformance
                        .filter(sp => {
                          if (selectedClassFilter !== 'all') {
                            const student = students.find(s => s.uid === sp.studentId);
                            return student?.class_ids?.includes(selectedClassFilter);
                          }
                          return true;
                        })
                        .slice(0, 20)
                        .map((student) => {
                          const studentData = students.find(s => s.uid === student.studentId);
                          return (
                          <tr key={student.studentId} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-white">{student.studentName}</td>
                            <td className="px-4 py-3">
                              {studentData?.approvalStatus && (
                                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                                  studentData.approvalStatus === 'approved' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : studentData.approvalStatus === 'pending'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}>
                                  {studentData.approvalStatus}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-white/70">{student.className}</td>
                            <td className="px-4 py-3">
                              <span className={`font-medium ${
                                student.averageScore >= 70 ? 'text-emerald-400' :
                                student.averageScore >= 50 ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {student.averageScore}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/70">{student.totalQuizzes}</td>
                            <td className="px-4 py-3 text-white/70">{student.completionRate}%</td>
                            <td className="px-4 py-3 text-white/70">
                              {Math.round(student.totalTimeSpent / 60)} min
                            </td>
                          </tr>
                        )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Teacher Performance Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FaChalkboardTeacher className="text-blue-400" />
            Teacher Performance Overview
          </h2>
          {teacherPerformance.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaChalkboardTeacher className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No teacher performance data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {teacherPerformance.map((teacher) => {
                const teacherData = teachers.find(t => t.uid === teacher.teacherId);
                return (
                <div
                  key={teacher.teacherId}
                  className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-medium truncate">{teacher.teacherName}</h4>
                      {teacherData?.approvalStatus && (
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                          teacherData.approvalStatus === 'approved' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : teacherData.approvalStatus === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {teacherData.approvalStatus}
                        </span>
                      )}
                    </div>
                    <span className="text-blue-400 font-bold">{teacher.averageStudentScore}%</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-white/70">
                      <span>Classes Managed</span>
                      <span className="text-white">{teacher.classesManaged}</span>
                    </div>
                    <div className="flex items-center justify-between text-white/70">
                      <span>Students Taught</span>
                      <span className="text-white">{teacher.studentsTaught}</span>
                    </div>
                    <div className="flex items-center justify-between text-white/70">
                      <span>Total Approvals</span>
                      <span className="text-white">{teacher.totalApprovals}</span>
                    </div>
                    <div className="flex items-center justify-between text-white/70">
                      <span>Recent Activity (7d)</span>
                      <span className="text-emerald-400">{teacher.recentActivity}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Class Performance Comparison */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FaBook className="text-purple-400" />
            Class Performance Comparison
          </h2>
          {classPerformance.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaBook className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No class performance data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classPerformance
                .sort((a, b) => b.averageScore - a.averageScore)
                .map((classItem) => (
                  <div
                    key={classItem.classId}
                    className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">{classItem.className}</h4>
                      <span className={`font-bold ${
                        classItem.averageScore >= 70 ? 'text-emerald-400' :
                        classItem.averageScore >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {classItem.averageScore}%
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-white/70">
                        <span>Students</span>
                        <span className="text-white">{classItem.studentCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-white/70">
                        <span>Completion Rate</span>
                        <span className="text-white">{classItem.completionRate}%</span>
                      </div>
                      <div className="flex items-center justify-between text-white/70">
                        <span>Lessons</span>
                        <span className="text-white">
                          {classItem.completedLessons} / {classItem.totalLessons}
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                        <div
                          className={`h-2 rounded-full ${
                            classItem.completionRate >= 70 ? 'bg-emerald-500' :
                            classItem.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${classItem.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Recent Lesson Launches */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Lesson Launches</h2>
          {launches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <FaGraduationCap className="text-4xl text-white/30 mx-auto mb-4" />
              <p className="text-white/50">No lesson launches yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {launches.slice(0, 10).map((launch) => {
                const student = students.find(s => s.uid === launch.student_id);
                return (
                  <div
                    key={launch.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">
                          {student?.name || student?.displayName || 'Unknown Student'}
                        </h3>
                        <p className="text-white/50 text-sm mt-1">
                          {launch.curriculum} Class {launch.class_name} • {launch.subject}
                        </p>
                        <p className="text-white/30 text-xs mt-1">
                          Chapter: {launch.chapter_id} • Topic: {launch.topic_id}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          launch.completion_status === 'completed' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {launch.completion_status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                        <p className="text-white/50 text-xs mt-1">
                          {launch.launched_at?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
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

export default SchoolDashboard;
