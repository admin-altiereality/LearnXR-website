/**
 * School Administrator Dashboard
 * 
 * Displays all lesson launches across all classes, student quiz scores,
 * and curriculum completion levels for their school.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { StudentScore, LessonLaunch, Class } from '../../types/lms';
import { Link } from 'react-router-dom';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { SchoolCodeBlock } from '../../Components/SchoolCodeBlock';
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
  FaBell,
  FaCheckCircle,
  FaHourglassHalf,
} from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary/30 border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading school dashboard...</p>
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
                <FaSchool className="text-primary text-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1" style={learnXRFontStyle}>
                  <span className="text-foreground">Learn</span>
                  <span className="text-primary">XR</span>
                  <TrademarkSymbol />
                </h1>
                <h2 className="text-xl font-semibold text-foreground">School Administrator Dashboard</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-muted-foreground text-sm">Monitor lesson launches, quiz scores, and curriculum completion</p>
                  {schoolCode && (
                    <SchoolCodeBlock code={schoolCode} variant="dashboard" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <FaFilter className="text-muted-foreground" />
            <span className="text-muted-foreground text-sm">Filters:</span>
          </div>
          <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
            <SelectTrigger className="w-[200px] h-10 border border-input bg-background text-foreground">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCurriculumFilter} onValueChange={setSelectedCurriculumFilter}>
            <SelectTrigger className="w-[200px] h-10 border border-input bg-background text-foreground">
              <SelectValue placeholder="All Curricula" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Curricula</SelectItem>
              {Array.from(new Set(chapters.map(c => c.curriculum))).map(cur => (
                <SelectItem key={cur} value={cur}>{cur}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaBook className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Classes</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalClasses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaChalkboardTeacher className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Teachers</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalTeachers}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-primary">{stats.approvedTeachers} approved</span>
                    {stats.pendingTeachersCount > 0 && (
                      <span className="text-xs text-amber-500">{stats.pendingTeachersCount} pending</span>
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
                  <FaUsers className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Students</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalStudents}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-primary">{stats.approvedStudents} approved</span>
                    {stats.pendingStudentsCount > 0 && (
                      <span className="text-xs text-amber-500">{stats.pendingStudentsCount} pending</span>
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
                  <p className="text-muted-foreground text-sm">Avg Score</p>
                  <p className="text-2xl font-bold text-foreground">{stats.averageSchoolScore}%</p>
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
                  <p className="text-muted-foreground text-sm">Launches</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalLessonLaunches}</p>
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
        </div>

        {/* Time Tracking Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaClock className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Avg Time/Lesson</p>
                  <p className="text-2xl font-bold text-foreground">{Math.round(stats.averageTimePerLesson / 60)} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                  <FaHourglassHalf className="text-primary text-xl" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Learning Time</p>
                  <p className="text-2xl font-bold text-foreground">{Math.round(stats.totalLearningTime / 3600)} hrs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="border border-border bg-card">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                    <FaBook className="text-primary text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Class Management</h2>
                    <p className="text-muted-foreground text-sm mt-1">Manage classes and assign teachers.</p>
                  </div>
                </div>
                <Button asChild variant="secondary" className="gap-2 shrink-0">
                  <Link to="/admin/classes">Open <FaArrowRight className="w-4 h-4" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className={`border bg-card ${pendingTeachers.length > 0 ? 'border-amber-500/40' : 'border-border'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 border border-border flex items-center justify-center relative">
                    <FaChalkboardTeacher className="text-primary text-2xl" />
                    {pendingTeachers.length > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
                        {pendingTeachers.length}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-foreground">Teacher Approvals</h2>
                      {pendingTeachers.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <FaBell className="text-xs" /> {pendingTeachers.length} pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                      {pendingTeachers.length > 0 ? `${pendingTeachers.length} teacher(s) waiting.` : 'Approve teachers for your school.'}
                    </p>
                  </div>
                </div>
                <Button asChild variant={pendingTeachers.length > 0 ? 'default' : 'secondary'} className="gap-2 shrink-0">
                  <Link to="/school/approvals">
                    {pendingTeachers.length > 0 ? 'Review' : 'Open'}
                    <FaArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Curriculum Completion */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Curriculum Completion</h2>
          {curriculumCompletion.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaGraduationCap className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No curriculum data available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {curriculumCompletion.map((curriculum) => (
                <Card key={curriculum.curriculum} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-foreground font-semibold text-lg">{curriculum.curriculum}</h3>
                      <span className={`text-2xl font-bold ${
                        curriculum.completionPercentage >= 70 ? 'text-primary' :
                        curriculum.completionPercentage >= 50 ? 'text-amber-500' : 'text-destructive'
                      }`}>
                        {curriculum.completionPercentage}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completed Topics</span>
                        <span className="text-foreground">{curriculum.completedTopics}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Topics</span>
                        <span className="text-foreground">{curriculum.totalTopics}</span>
                      </div>
                      <Progress value={curriculum.completionPercentage} className="h-2 mt-3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quiz Scores */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Recent Quiz Scores</h2>
          {scores.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaChartLine className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No quiz scores yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scores.slice(0, 10).map((score) => {
                const student = students.find(s => s.uid === score.student_id);
                return (
                  <Card key={score.id} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-foreground font-medium">
                            {student?.name || student?.displayName || 'Unknown Student'}
                          </h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            {score.subject} - {score.curriculum} Class {score.class_name}
                          </p>
                          <p className="text-muted-foreground/70 text-xs mt-1">
                            Chapter: {score.chapter_id} • Attempt #{score.attempt_number}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <div className={`text-2xl font-bold ${
                            score.score.percentage >= 70 ? 'text-primary' :
                            score.score.percentage >= 50 ? 'text-amber-500' : 'text-destructive'
                          }`}>
                            {score.score.percentage}%
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {score.score.correct}/{score.score.total}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Student Performance Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaChartBar className="text-primary" />
            Student Performance Overview
          </h2>
          {studentPerformance.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaUsers className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No student performance data available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Top Performers */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                  <FaTrophy className="text-primary" />
                  Top Performers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {studentPerformance
                    .sort((a, b) => b.averageScore - a.averageScore)
                    .slice(0, 6)
                    .map((student) => (
                      <Card key={student.studentId} className="border border-primary/30 bg-primary/5">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-foreground font-medium truncate" title={student.studentName}>{student.studentName}</h4>
                            <span className="text-primary font-bold">{student.averageScore}%</span>
                          </div>
                          <p className="text-muted-foreground text-xs mb-2">{student.className}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Quizzes: {student.totalQuizzes}</span>
                            <span>Completion: {student.completionRate}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              {/* Students Needing Attention */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
                  <FaExclamationTriangle className="text-destructive" />
                  Students Needing Attention
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {studentPerformance
                    .filter(s => s.averageScore < 50 || s.completionRate < 30)
                    .sort((a, b) => a.averageScore - b.averageScore)
                    .slice(0, 6)
                    .map((student) => (
                      <Card key={student.studentId} className="border border-destructive/30 bg-destructive/5">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-foreground font-medium truncate" title={student.studentName}>{student.studentName}</h4>
                            <span className="text-destructive font-bold">{student.averageScore}%</span>
                          </div>
                          <p className="text-muted-foreground text-xs mb-2">{student.className}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Quizzes: {student.totalQuizzes}</span>
                            <span>Completion: {student.completionRate}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              {/* All Students Table */}
              <Card className="border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Avg Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Quizzes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Completion</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
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
                          <tr key={student.studentId} className="hover:bg-accent/30">
                            <td className="px-4 py-3 text-foreground">{student.studentName}</td>
                            <td className="px-4 py-3">
                              {studentData?.approvalStatus && (
                                <Badge variant={studentData.approvalStatus === 'approved' ? 'default' : studentData.approvalStatus === 'pending' ? 'secondary' : 'destructive'} className="text-xs">
                                  {studentData.approvalStatus}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{student.className}</td>
                            <td className="px-4 py-3">
                              <span className={`font-medium ${
                                student.averageScore >= 70 ? 'text-primary' :
                                student.averageScore >= 50 ? 'text-amber-500' : 'text-destructive'
                              }`}>
                                {student.averageScore}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{student.totalQuizzes}</td>
                            <td className="px-4 py-3 text-muted-foreground">{student.completionRate}%</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {Math.round(student.totalTimeSpent / 60)} min
                            </td>
                          </tr>
                        )})}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Teacher Performance Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaChalkboardTeacher className="text-primary" />
            Teacher Performance Overview
          </h2>
          {teacherPerformance.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaChalkboardTeacher className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No teacher performance data available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {teacherPerformance.map((teacher) => {
                const teacherData = teachers.find(t => t.uid === teacher.teacherId);
                return (
                <Card key={teacher.teacherId} className="border border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-foreground font-medium truncate" title={teacher.teacherName}>{teacher.teacherName}</h4>
                        {teacherData?.approvalStatus && (
                          <Badge variant={teacherData.approvalStatus === 'approved' ? 'default' : teacherData.approvalStatus === 'pending' ? 'secondary' : 'destructive'} className="text-xs">
                            {teacherData.approvalStatus}
                          </Badge>
                        )}
                      </div>
                      <span className="text-primary font-bold">{teacher.averageStudentScore}%</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Classes Managed</span>
                        <span className="text-foreground">{teacher.classesManaged}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Students Taught</span>
                        <span className="text-foreground">{teacher.studentsTaught}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Total Approvals</span>
                        <span className="text-foreground">{teacher.totalApprovals}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Recent Activity (7d)</span>
                        <span className="text-primary">{teacher.recentActivity}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </div>

        {/* Class Performance Comparison */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <FaBook className="text-primary" />
            Class Performance Comparison
          </h2>
          {classPerformance.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaBook className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No class performance data available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classPerformance
                .sort((a, b) => b.averageScore - a.averageScore)
                .map((classItem) => (
                  <Card key={classItem.classId} className="border border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-foreground font-medium" title={classItem.className}>{classItem.className}</h4>
                        <span className={`font-bold ${
                          classItem.averageScore >= 70 ? 'text-primary' :
                          classItem.averageScore >= 50 ? 'text-amber-500' : 'text-destructive'
                        }`}>
                          {classItem.averageScore}%
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Students</span>
                          <span className="text-foreground">{classItem.studentCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Completion Rate</span>
                          <span className="text-foreground">{classItem.completionRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Lessons</span>
                          <span className="text-foreground">
                            {classItem.completedLessons} / {classItem.totalLessons}
                          </span>
                        </div>
                        <Progress value={classItem.completionRate} className="h-2 mt-3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>

        {/* Recent Lesson Launches */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Recent Lesson Launches</h2>
          {launches.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-8 text-center">
                <FaGraduationCap className="text-4xl text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No lesson launches yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {launches.slice(0, 10).map((launch) => {
                const student = students.find(s => s.uid === launch.student_id);
                return (
                  <Card key={launch.id} className="border border-border bg-card hover:bg-accent/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-foreground font-medium">
                            {student?.name || student?.displayName || 'Unknown Student'}
                          </h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            {launch.curriculum} Class {launch.class_name} • {launch.subject}
                          </p>
                          <p className="text-muted-foreground/70 text-xs mt-1">
                            Chapter: {launch.chapter_id} • Topic: {launch.topic_id}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <Badge variant={launch.completion_status === 'completed' ? 'default' : 'secondary'} className="text-sm">
                            {launch.completion_status === 'completed' ? 'Completed' : 'In Progress'}
                          </Badge>
                          <p className="text-muted-foreground text-xs mt-1">
                            {launch.launched_at?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </p>
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
    </div>
  );
};

export default SchoolDashboard;
