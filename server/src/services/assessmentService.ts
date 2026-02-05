/**
 * Automated Assessment & Evaluation Service
 * Implements Open edX-style behavior: create assessments, submit attempts, auto-grade
 * (MCQ/short answer/true_false), optional partial credit for short answer, and
 * per-question results so the UI can show correct answers after submit.
 */

import * as admin from 'firebase-admin';
import { db, isFirebaseInitialized } from '../config/firebase-admin';

export interface AssessmentQuestion {
  id: string;
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options?: string[]; // for MCQ / true_false
  correctAnswer: string | number; // option index for MCQ, or exact string for short_answer/true_false
  points: number;
}

export interface Assessment {
  id: string;
  title: string;
  description?: string;
  classId: string;
  schoolId: string;
  createdBy: string;
  subject?: string;
  curriculum?: string;
  questions: AssessmentQuestion[];
  totalPoints: number;
  passingPercentage: number;
  createdAt: admin.firestore.Timestamp | string;
  updatedAt: admin.firestore.Timestamp | string;
}

/** Per-question result (Open edX style: show correct answer after submit) */
export interface QuestionResult {
  questionId: string;
  correct: boolean;
  pointsEarned: number;
  /** Correct answer for display (option index for MCQ, or text for short_answer/true_false) */
  correctAnswer: string | number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  studentId: string;
  classId: string;
  schoolId: string;
  answers: Record<string, string | number>; // questionId -> selected option index or text
  score?: { correct: number; total: number; percentage: number; pointsEarned: number };
  /** Per-question results so UI can show correct answers (Open edX style) */
  questionResults?: QuestionResult[];
  gradedAt?: admin.firestore.Timestamp | string;
  completedAt: admin.firestore.Timestamp | string;
}

function getAssessmentCollection() {
  if (!isFirebaseInitialized() || !db) throw new Error('Database not available');
  return db.collection('assessments');
}

function getAttemptsCollection() {
  if (!isFirebaseInitialized() || !db) throw new Error('Database not available');
  return db.collection('assessment_attempts');
}

/**
 * Create a new assessment
 */
export async function createAssessment(
  data: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'totalPoints'> & { totalPoints?: number }
): Promise<Assessment> {
  const col = getAssessmentCollection();
  const totalPoints = data.totalPoints ?? data.questions.reduce((sum, q) => sum + q.points, 0);
  const now = admin.firestore.Timestamp.now();
  const docRef = await col.add({
    ...data,
    totalPoints,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: docRef.id,
    ...data,
    totalPoints,
    createdAt: now,
    updatedAt: now,
  } as Assessment;
}

/**
 * Get assessment by ID
 */
export async function getAssessment(assessmentId: string): Promise<Assessment | null> {
  const doc = await getAssessmentCollection().doc(assessmentId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Assessment;
}

/**
 * List assessments for a class (teacher) or school
 */
export async function listAssessmentsByClass(classId: string): Promise<Assessment[]> {
  const snapshot = await getAssessmentCollection()
    .where('classId', '==', classId)
    .orderBy('updatedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Assessment));
}

/**
 * List assessments for a student (by their class IDs)
 */
export async function listAssessmentsForStudent(classIds: string[]): Promise<Assessment[]> {
  if (classIds.length === 0) return [];
  const col = getAssessmentCollection();
  const results: Assessment[] = [];
  for (const classId of classIds) {
    const snapshot = await col.where('classId', '==', classId).orderBy('updatedAt', 'desc').get();
    snapshot.docs.forEach((doc) => results.push({ id: doc.id, ...doc.data() } as Assessment));
  }
  return results;
}

/**
 * Auto-grade a single question (Open edX-style: exact match; short_answer supports multiple acceptable answers separated by | or ;)
 */
function gradeQuestion(q: AssessmentQuestion, answer: string | number): { correct: boolean; points: number } {
  const normalizedAnswer = typeof answer === 'number' ? String(answer) : String(answer).trim().toLowerCase();
  const correctVal = q.correctAnswer;
  let correct = false;
  if (q.type === 'mcq' || q.type === 'true_false') {
    const correctIndex = typeof correctVal === 'number' ? correctVal : parseInt(String(correctVal), 10);
    const selectedIndex = typeof answer === 'number' ? answer : parseInt(String(answer), 10);
    correct = selectedIndex === correctIndex;
  } else {
    const correctStr = String(correctVal).trim();
    const alternatives = correctStr.split(/\s*[|;]\s*/).map((s) => s.trim().toLowerCase());
    correct = alternatives.some((alt) => normalizedAnswer === alt || normalizedAnswer.includes(alt));
    if (!correct && alternatives.length === 1) {
      correct = normalizedAnswer === alternatives[0];
    }
  }
  return { correct, points: correct ? q.points : 0 };
}

/** Get display form of correct answer for a question (for showing after submit) */
function getCorrectAnswerDisplay(q: AssessmentQuestion): string | number {
  if (q.type === 'mcq' && Array.isArray(q.options)) {
    const idx = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseInt(String(q.correctAnswer), 10);
    return q.options[idx] ?? q.correctAnswer;
  }
  return q.correctAnswer;
}

/**
 * Submit an attempt and auto-grade
 */
export async function submitAttempt(
  assessmentId: string,
  studentId: string,
  classId: string,
  schoolId: string,
  answers: Record<string, string | number>
): Promise<AssessmentAttempt> {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new Error('Assessment not found');

  let correct = 0;
  let pointsEarned = 0;
  const questionResults: QuestionResult[] = [];
  const totalPoints = assessment.totalPoints;
  for (const q of assessment.questions) {
    const ans = answers[q.id];
    const result = gradeQuestion(q, ans ?? '');
    const displayCorrect = getCorrectAnswerDisplay(q);
    questionResults.push({
      questionId: q.id,
      correct: result.correct,
      pointsEarned: result.points,
      correctAnswer: displayCorrect,
    });
    if (result.correct) {
      correct++;
      pointsEarned += result.points;
    }
  }
  const totalQuestions = assessment.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

  const now = admin.firestore.Timestamp.now();
  const attemptData: Omit<AssessmentAttempt, 'id'> = {
    assessmentId,
    studentId,
    classId,
    schoolId,
    answers,
    score: { correct, total: totalQuestions, percentage, pointsEarned },
    questionResults,
    gradedAt: now,
    completedAt: now,
  };

  const docRef = await getAttemptsCollection().add(attemptData);
  return { id: docRef.id, ...attemptData } as AssessmentAttempt;
}

/**
 * Get attempts for a student
 */
export async function getAttemptsByStudent(studentId: string): Promise<AssessmentAttempt[]> {
  const snapshot = await getAttemptsCollection()
    .where('studentId', '==', studentId)
    .orderBy('completedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AssessmentAttempt));
}

/**
 * Get attempts for an assessment (teacher view)
 */
export async function getAttemptsByAssessment(assessmentId: string): Promise<AssessmentAttempt[]> {
  const snapshot = await getAttemptsCollection()
    .where('assessmentId', '==', assessmentId)
    .orderBy('completedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AssessmentAttempt));
}
