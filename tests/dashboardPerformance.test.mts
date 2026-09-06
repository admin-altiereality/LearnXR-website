/**
 * Regression tests for the dashboard performance aggregations.
 *
 * These figures used to be computed inside TeacherDashboard, and a principal,
 * school admin and super admin needed the same ones. Copying the arithmetic into
 * three more screens is how a teacher and their principal end up looking at two
 * different averages for the same class with no way to tell which is right — so
 * it lives in one place and is tested once.
 *
 * The case worth the most attention is the orphaned score: every section filters
 * on class_id, so a score attributed to a class the viewer cannot see disappears
 * from all of them at once. Silently dropping it is exactly what made "no marks
 * anywhere" so hard to diagnose.
 *
 * Run: npx tsx --test tests/dashboardPerformance.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classInsights,
  subjectPerformance,
  summarisePerformance,
  type ClassRecord,
  type LaunchRecord,
  type ScoreRecord,
  type StudentRecord,
} from '../server/client/src/lib/dashboard/performance.ts';

const score = (
  classId: string | null,
  correct: number,
  total: number,
  extra: Partial<ScoreRecord> = {}
): ScoreRecord => ({
  class_id: classId,
  score: { correct, total, percentage: Math.round((correct / total) * 100) },
  ...extra,
});

const CLASSES: ClassRecord[] = [
  { id: 'c1', class_name: '8A', curriculum: 'CBSE', subject: 'Science' },
  { id: 'c2', class_name: '8B', curriculum: 'CBSE', subject: 'Science' },
  { id: 'c3', class_name: '9A', curriculum: 'CBSE', subject: 'Maths' },
];

const STUDENTS: StudentRecord[] = [
  { uid: 's1', class_ids: ['c1'] },
  { uid: 's2', class_ids: ['c1'] },
  { uid: 's3', class_ids: ['c2'] },
];

test('a class average is the mean of its own scores', () => {
  const insights = classInsights(
    CLASSES,
    STUDENTS,
    [score('c1', 8, 10), score('c1', 6, 10), score('c2', 5, 10)],
    []
  );

  const c1 = insights.find((i) => i.classId === 'c1')!;
  assert.equal(c1.averageScore, 70, '80 and 60 average to 70');
  assert.equal(c1.totalQuizzes, 2);
  assert.equal(c1.studentCount, 2);

  const c3 = insights.find((i) => i.classId === 'c3')!;
  assert.equal(c3.averageScore, 0, 'a class with no scores averages 0, not NaN');
  assert.equal(c3.totalQuizzes, 0);
});

test('completion rate counts completed launches against all of them', () => {
  const launches: LaunchRecord[] = [
    { class_id: 'c1', completion_status: 'completed' },
    { class_id: 'c1', completion_status: 'completed' },
    { class_id: 'c1', completion_status: 'abandoned' },
    { class_id: 'c1', completion_status: 'in_progress' },
  ];
  const c1 = classInsights(CLASSES, STUDENTS, [], launches).find((i) => i.classId === 'c1')!;

  assert.equal(c1.totalLessons, 4);
  assert.equal(c1.completedLessons, 2);
  assert.equal(c1.completionRate, 50);
});

test('an attempt cut short is counted, and counted separately', () => {
  // A student carried forward when the teacher advanced answered four of ten.
  // A student who worked to the end and got four right answered ten. Both are
  // 40%, and only one of them is a result about what the student knows.
  const insights = classInsights(
    CLASSES,
    STUDENTS,
    [score('c1', 4, 10, { completed: true }), score('c1', 4, 10, { completed: false, questions_attempted: 4 })],
    []
  );
  const c1 = insights.find((i) => i.classId === 'c1')!;

  assert.equal(c1.totalQuizzes, 2, 'both count as attempts');
  assert.equal(c1.partialQuizzes, 1, 'and one of them is flagged as unfinished');
});

test('scores written before partial attempts existed count as finished', () => {
  // `completed` is absent on older documents; treating absence as unfinished
  // would retroactively mark every historic result as cut short.
  const c1 = classInsights(CLASSES, STUDENTS, [score('c1', 7, 10)], []).find(
    (i) => i.classId === 'c1'
  )!;
  assert.equal(c1.partialQuizzes, 0);
});

test('a score belonging to no visible class is reported, not silently dropped', () => {
  const summary = summarisePerformance(
    CLASSES,
    STUDENTS,
    [score('c1', 8, 10), score('c_unknown', 9, 10), score(null, 5, 10)],
    []
  );

  assert.equal(summary.totalQuizzes, 1, 'only the in-scope score counts toward the figures');
  assert.equal(
    summary.orphanedScores,
    2,
    'the other two exist and will never appear — the dashboard must be able to say so'
  );
  assert.equal(summary.averageScore, 80, 'and they do not drag the average around');
});

test('a subject average is weighted by how many quizzes each class contributed', () => {
  // A class of two must not swing a subject average as far as a class of thirty.
  const scores: ScoreRecord[] = [
    score('c1', 10, 10),
    ...Array.from({ length: 9 }, () => score('c2', 5, 10)),
  ];
  const subjects = subjectPerformance(classInsights(CLASSES, STUDENTS, scores, []));
  const science = subjects.find((s) => s.subject === 'Science')!;

  // One 100% and nine 50%: the weighted mean is 55, the unweighted one 75.
  assert.equal(science.averageScore, 55);
  assert.equal(science.totalQuizzes, 10);
});

test('subjects come back best first', () => {
  const subjects = subjectPerformance(
    classInsights(CLASSES, STUDENTS, [score('c1', 4, 10), score('c3', 9, 10)], [])
  );
  assert.equal(subjects[0].subject, 'Maths', '90 before 40');
});

test('scope is the only thing that changes between a teacher and a principal', () => {
  const scores = [score('c1', 8, 10), score('c3', 6, 10)];
  const teacher = summarisePerformance([CLASSES[0]], STUDENTS, scores, []);
  const principal = summarisePerformance(CLASSES, STUDENTS, scores, []);

  assert.equal(teacher.totalQuizzes, 1, 'a teacher sees their own class');
  assert.equal(teacher.orphanedScores, 1, 'and is told the other exists');
  assert.equal(principal.totalQuizzes, 2, 'the principal sees the school');
  assert.equal(principal.orphanedScores, 0);

  // The one class they both see must read identically.
  const t = teacher.insights.find((i) => i.classId === 'c1')!;
  const p = principal.insights.find((i) => i.classId === 'c1')!;
  assert.deepEqual(t, p, 'one class, one set of numbers, whoever is looking');
});

test('nothing at all produces zeros rather than NaN', () => {
  const summary = summarisePerformance([], [], [], []);
  assert.equal(summary.averageScore, 0);
  assert.equal(summary.completionRate, 0);
  assert.equal(summary.totalStudents, 0);
  assert.equal(summary.orphanedScores, 0);
  assert.deepEqual(summary.subjects, []);
});

test('a class with no subject still rolls up somewhere', () => {
  const subjects = subjectPerformance(
    classInsights([{ id: 'cx', class_name: '7C' }], [], [score('cx', 6, 10)], [])
  );
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].subject, 'All Subjects', 'never dropped for want of a label');
});
