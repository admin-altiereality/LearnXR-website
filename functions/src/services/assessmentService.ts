/**
 * Automated Assessment & Evaluation Service (Firebase Functions)
 * Open edX-style: create assessments, submit attempts, auto-grade (MCQ/short answer/true_false),
 * partial credit for short answer, per-question results for showing correct answers after submit.
 */

import * as admin from 'firebase-admin';

export interface AssessmentQuestion {
  id: string;
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options?: string[];
  correctAnswer: string | number;
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

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  pointsEarned: number;
  correctAnswer: string | number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  studentId: string;
  classId: string;
  schoolId: string;
  answers: Record<string, string | number>;
  score?: { correct: number; total: number; percentage: number; pointsEarned: number };
  questionResults?: QuestionResult[];
  gradedAt?: admin.firestore.Timestamp | string;
  completedAt: admin.firestore.Timestamp | string;
}

function getDb() {
  return admin.firestore();
}

function getAssessmentCollection() {
  return getDb().collection('assessments');
}

function getAttemptsCollection() {
  return getDb().collection('assessment_attempts');
}

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

export async function getAssessment(assessmentId: string): Promise<Assessment | null> {
  const doc = await getAssessmentCollection().doc(assessmentId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Assessment;
}

export async function listAssessmentsByClass(classId: string): Promise<Assessment[]> {
  const snapshot = await getAssessmentCollection()
    .where('classId', '==', classId)
    .orderBy('updatedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Assessment));
}

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

function getCorrectAnswerDisplay(q: AssessmentQuestion): string | number {
  if (q.type === 'mcq' && Array.isArray(q.options)) {
    const idx = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseInt(String(q.correctAnswer), 10);
    return q.options[idx] ?? q.correctAnswer;
  }
  return q.correctAnswer;
}

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

export async function getAttemptsByStudent(studentId: string): Promise<AssessmentAttempt[]> {
  const snapshot = await getAttemptsCollection()
    .where('studentId', '==', studentId)
    .orderBy('completedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AssessmentAttempt));
}

export async function getAttemptsByAssessment(assessmentId: string): Promise<AssessmentAttempt[]> {
  const snapshot = await getAttemptsCollection()
    .where('assessmentId', '==', assessmentId)
    .orderBy('completedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AssessmentAttempt));
}
