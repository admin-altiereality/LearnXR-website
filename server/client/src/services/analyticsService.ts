/**
 * Analytics Service
 * 
 * Provides analytics functions for students, classes, and schools.
 * All queries are automatically scoped by role and school/class assignments.
 */

import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserProfile } from '../utils/rbac';
import type { StudentScore, LessonLaunch } from '../types/lms';

export interface StudentAnalytics {
  studentId: string;
  totalLessons: number;
  completedLessons: number;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  completionRate: number;
  recentScores: StudentScore[];
  recentLaunches: LessonLaunch[];
}

export interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  totalAttempts: number;
  averageScore: number;
  completionRate: number;
  topPerformers: Array<{ studentId: string; averageScore: number }>;
  strugglingStudents: Array<{ studentId: string; averageScore: number }>;
}

export interface SchoolAnalytics {
  schoolId: string;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  totalAttempts: number;
  averageScore: number;
  completionRate: number;
  lessonEngagement: number;
  teacherActivity: Array<{ teacherId: string; classesCount: number; studentsCount: number }>;
}

/**
 * Get analytics for a specific student
 * Access: Student (own), Teacher (their students), Principal (their school), Admin/Superadmin (all)
 */
export async function getStudentAnalytics(
  profile: UserProfile | null,
  studentId: string
): Promise<StudentAnalytics | null> {
  if (!profile) return null;

  // Permission check - students can only see own analytics
  if (profile.role === 'student' && profile.uid !== studentId) {
    return null;
  }

  try {
    // Get student's scores
    const scoresQuery = query(
      collection(db, 'student_scores'),
      where('student_id', '==', studentId),
      orderBy('completed_at', 'desc')
    );
    const scoresSnapshot = await getDocs(scoresQuery);
    const scores = scoresSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as StudentScore[];

    // Get student's lesson launches
    const launchesQuery = query(
      collection(db, 'lesson_launches'),
      where('student_id', '==', studentId),
      orderBy('launched_at', 'desc')
    );
    const launchesSnapshot = await getDocs(launchesQuery);
    const launches = launchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as LessonLaunch[];

    const totalLessons = launches.length;
    const completedLessons = launches.filter(l => l.completion_status === 'completed').length;
    const totalAttempts = scores.length;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    const bestScore = scores.length > 0
      ? Math.max(...scores.map(s => s.score?.percentage || 0))
      : 0;
    const worstScore = scores.length > 0
      ? Math.min(...scores.map(s => s.score?.percentage || 0))
      : 0;
    const completionRate = totalLessons > 0
      ? (completedLessons / totalLessons) * 100
      : 0;

    return {
      studentId,
      totalLessons,
      completedLessons,
      totalAttempts,
      averageScore: Math.round(averageScore),
      bestScore,
      worstScore,
      completionRate: Math.round(completionRate),
      recentScores: scores.slice(0, 10),
      recentLaunches: launches.slice(0, 10),
    };
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    return null;
  }
}

/**
 * Get analytics for a specific class
 * Access: Teacher (their classes), Principal (their school), Admin/Superadmin (all)
 */
export async function getClassAnalytics(
  profile: UserProfile | null,
  classId: string
): Promise<ClassAnalytics | null> {
  if (!profile) return null;

  try {
    // Get class document
    const classDoc = await getDocs(query(
      collection(db, 'classes'),
      where('__name__', '==', classId)
    ));
    
    if (classDoc.empty) return null;
    
    const classData = classDoc.docs[0].data();
    const studentIds = classData.student_ids || [];

    // Get scores for this class
    const scoresQuery = query(
      collection(db, 'student_scores'),
      where('class_id', '==', classId),
      orderBy('completed_at', 'desc')
    );
    const scoresSnapshot = await getDocs(scoresQuery);
    const scores = scoresSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as StudentScore[];

    // Calculate analytics
    const totalStudents = studentIds.length;
    const totalAttempts = scores.length;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    const completionRate = scores.length > 0
      ? (scores.filter(s => s.score?.percentage >= 70).length / scores.length) * 100
      : 0;

    // Calculate per-student averages
    const studentAverages: Record<string, { total: number; sum: number }> = {};
    scores.forEach(score => {
      if (!studentAverages[score.student_id]) {
        studentAverages[score.student_id] = { total: 0, sum: 0 };
      }
      studentAverages[score.student_id].total++;
      studentAverages[score.student_id].sum += score.score?.percentage || 0;
    });

    const topPerformers = Object.entries(studentAverages)
      .map(([studentId, data]) => ({
        studentId,
        averageScore: Math.round(data.sum / data.total),
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);

    const strugglingStudents = Object.entries(studentAverages)
      .map(([studentId, data]) => ({
        studentId,
        averageScore: Math.round(data.sum / data.total),
      }))
      .filter(s => s.averageScore < 50)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    return {
      classId,
      className: classData.class_name || 'Unknown',
      totalStudents,
      totalAttempts,
      averageScore: Math.round(averageScore),
      completionRate: Math.round(completionRate),
      topPerformers,
      strugglingStudents,
    };
  } catch (error) {
    console.error('Error fetching class analytics:', error);
    return null;
  }
}

/**
 * Get analytics for a specific school
 * Access: Principal (their school), Admin/Superadmin (all)
 */
export async function getSchoolAnalytics(
  profile: UserProfile | null,
  schoolId: string
): Promise<SchoolAnalytics | null> {
  if (!profile) return null;

  // Permission check
  if (profile.role === 'principal' && profile.managed_school_id !== schoolId) {
    return null;
  }

  try {
    // Get teachers
    const teachersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('school_id', '==', schoolId)
    );
    const teachersSnapshot = await getDocs(teachersQuery);
    const teachers = teachersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    // Get students
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('school_id', '==', schoolId)
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    // Get classes
    const classesQuery = query(
      collection(db, 'classes'),
      where('school_id', '==', schoolId)
    );
    const classesSnapshot = await getDocs(classesQuery);

    // Get scores
    const scoresQuery = query(
      collection(db, 'student_scores'),
      where('school_id', '==', schoolId)
    );
    const scoresSnapshot = await getDocs(scoresQuery);
    const scores = scoresSnapshot.docs.map(doc => doc.data()) as StudentScore[];

    // Get lesson launches
    const launchesQuery = query(
      collection(db, 'lesson_launches'),
      where('school_id', '==', schoolId)
    );
    const launchesSnapshot = await getDocs(launchesQuery);
    const launches = launchesSnapshot.docs.map(doc => doc.data()) as LessonLaunch[];

    // Calculate analytics
    const totalTeachers = teachers.length;
    const totalStudents = studentsSnapshot.size;
    const totalClasses = classesSnapshot.size;
    const totalAttempts = scores.length;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0) / scores.length
      : 0;
    const completionRate = scores.length > 0
      ? (scores.filter(s => s.score?.percentage >= 70).length / scores.length) * 100
      : 0;
    const lessonEngagement = launches.length > 0
      ? (launches.filter(l => l.completion_status === 'completed').length / launches.length) * 100
      : 0;

    // Teacher activity
    const teacherActivity = teachers.map(teacher => {
      const teacherClasses = teacher.managed_class_ids?.length || 0;
      const teacherStudents = studentsSnapshot.docs.filter(s => {
        const studentClassIds = s.data().class_ids || [];
        return studentClassIds.some(classId => teacher.managed_class_ids?.includes(classId));
      }).length;

      return {
        teacherId: teacher.uid,
        classesCount: teacherClasses,
        studentsCount: teacherStudents,
      };
    });

    return {
      schoolId,
      totalTeachers,
      totalStudents,
      totalClasses,
      totalAttempts,
      averageScore: Math.round(averageScore),
      completionRate: Math.round(completionRate),
      lessonEngagement: Math.round(lessonEngagement),
      teacherActivity,
    };
  } catch (error) {
    console.error('Error fetching school analytics:', error);
    return null;
  }
}
