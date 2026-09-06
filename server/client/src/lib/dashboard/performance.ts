/**
 * performance – how a class is doing, computed once for everyone who asks.
 *
 * These aggregations lived inside TeacherDashboard as `useMemo` blocks. A
 * principal, a school admin and a super admin all need the same figures, and
 * copying the arithmetic into three more screens is how a teacher and their
 * principal end up looking at two different averages for one class and neither
 * knows which is right. Pure functions over plain data, so every screen that
 * shows a number is showing the same number.
 *
 * Two things these deliberately surface rather than hide:
 *
 *   - **Orphaned scores.** Every section filters on `class_id`, so a score
 *     attributed to a class the viewer cannot see vanishes from all of them at
 *     once. Silently dropping it is what made "no marks anywhere" impossible to
 *     diagnose; it is counted here so a dashboard can say so.
 *   - **Unfinished attempts.** A student carried forward when the teacher
 *     advanced the class answered four of ten; a student who worked to the end
 *     and got four right answered ten. Averaging them together understates the
 *     first, so they are counted separately.
 */

export interface ScoreRecord {
  id?: string;
  student_id?: string;
  class_id?: string | null;
  school_id?: string;
  chapter_id?: string;
  topic_id?: string;
  subject?: string;
  score?: { correct: number; total: number; percentage: number };
  /** Absent on scores written before partial attempts were recorded. */
  completed?: boolean;
  questions_attempted?: number;
}

export interface LaunchRecord {
  id?: string;
  class_id?: string | null;
  completion_status?: string;
}

export interface StudentRecord {
  uid: string;
  class_ids?: string[];
}

export interface ClassRecord {
  id: string;
  class_name?: string;
  curriculum?: string;
  subject?: string;
}

export interface ClassInsight {
  classId: string;
  className: string;
  curriculum: string;
  subject?: string;
  studentCount: number;
  averageScore: number;
  totalQuizzes: number;
  /** Attempts cut short by the class moving on. Part of totalQuizzes. */
  partialQuizzes: number;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
}

export interface SubjectPerformance {
  subject: string;
  totalStudents: number;
  averageScore: number;
  totalQuizzes: number;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
}

export interface PerformanceSummary {
  insights: ClassInsight[];
  subjects: SubjectPerformance[];
  totalStudents: number;
  totalQuizzes: number;
  averageScore: number;
  completionRate: number;
  /**
   * Scores that belong to no class in scope.
   *
   * Never silently discarded: a non-zero count here means marks exist that no
   * dashboard will ever show, which is worth saying out loud rather than
   * rendering an empty page.
   */
  orphanedScores: number;
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Mean of a list, rounded, and 0 rather than NaN when there is nothing to average. */
function meanPercentage(scores: ScoreRecord[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + (s.score?.percentage || 0), 0);
  return Math.round(total / scores.length);
}

/** An attempt the class moved on from before the student finished. */
function isPartial(score: ScoreRecord): boolean {
  // `completed` is absent on scores written before partial attempts existed;
  // those were all finished quizzes, so absence means complete.
  return score.completed === false;
}

/**
 * Per-class figures for every class in scope.
 *
 * Scope is whatever the caller passes: a teacher's own classes, or every class
 * in a school. The arithmetic does not change with the audience, which is the
 * point.
 */
export function classInsights(
  classes: ClassRecord[],
  students: StudentRecord[],
  scores: ScoreRecord[],
  launches: LaunchRecord[]
): ClassInsight[] {
  return classes.map((classItem) => {
    const classStudents = students.filter((s) => s.class_ids?.includes(classItem.id));
    const classScores = scores.filter((s) => s.class_id === classItem.id);
    const classLaunches = launches.filter((l) => l.class_id === classItem.id);
    const completedLaunches = classLaunches.filter((l) => l.completion_status === 'completed');

    return {
      classId: classItem.id,
      className: classItem.class_name || 'Untitled class',
      curriculum: classItem.curriculum || '',
      subject: classItem.subject,
      studentCount: classStudents.length,
      averageScore: meanPercentage(classScores),
      totalQuizzes: classScores.length,
      partialQuizzes: classScores.filter(isPartial).length,
      completedLessons: completedLaunches.length,
      totalLessons: classLaunches.length,
      completionRate: percent(completedLaunches.length, classLaunches.length),
    };
  });
}

/** The same figures rolled up by subject, highest average first. */
export function subjectPerformance(insights: ClassInsight[]): SubjectPerformance[] {
  const bySubject = new Map<string, { insights: ClassInsight[] }>();

  for (const insight of insights) {
    const subject = insight.subject || 'All Subjects';
    if (!bySubject.has(subject)) bySubject.set(subject, { insights: [] });
    bySubject.get(subject)!.insights.push(insight);
  }

  return Array.from(bySubject.entries())
    .map(([subject, { insights: group }]) => {
      const totalQuizzes = group.reduce((n, i) => n + i.totalQuizzes, 0);
      const totalLessons = group.reduce((n, i) => n + i.totalLessons, 0);
      const completedLessons = group.reduce((n, i) => n + i.completedLessons, 0);
      // Weighted by how many quizzes each class contributed, so a class of two
      // does not swing the subject average as far as a class of thirty.
      const weighted = group.reduce((sum, i) => sum + i.averageScore * i.totalQuizzes, 0);

      return {
        subject,
        totalStudents: group.reduce((n, i) => n + i.studentCount, 0),
        averageScore: totalQuizzes > 0 ? Math.round(weighted / totalQuizzes) : 0,
        totalQuizzes,
        completedLessons,
        totalLessons,
        completionRate: percent(completedLessons, totalLessons),
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

/** Everything a performance panel needs, from one pass over the data. */
export function summarisePerformance(
  classes: ClassRecord[],
  students: StudentRecord[],
  scores: ScoreRecord[],
  launches: LaunchRecord[]
): PerformanceSummary {
  const insights = classInsights(classes, students, scores, launches);
  const inScope = new Set(classes.map((c) => c.id));
  const scoped = scores.filter((s) => s.class_id && inScope.has(s.class_id));

  return {
    insights,
    subjects: subjectPerformance(insights),
    totalStudents: insights.reduce((n, i) => n + i.studentCount, 0),
    totalQuizzes: scoped.length,
    averageScore: meanPercentage(scoped),
    completionRate: percent(
      insights.reduce((n, i) => n + i.completedLessons, 0),
      insights.reduce((n, i) => n + i.totalLessons, 0)
    ),
    orphanedScores: scores.length - scoped.length,
  };
}

/** The most recent attempts, newest first, for the activity feed. */
export function recentActivity(scores: ScoreRecord[], limit = 10): ScoreRecord[] {
  return scores.slice(0, limit);
}
