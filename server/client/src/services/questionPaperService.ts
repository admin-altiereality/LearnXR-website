/**
 * Question Paper Service
 *
 * - Calls the server to generate question papers (OpenAI)
 * - CRUD against the `question_papers` Firestore collection
 * - Uploads source PDFs to Storage under `question_papers/{uid}/source/*.pdf`
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { immutableUploadMetadata } from '../utils/firebaseStorage';
import api from '../config/axios';
import { auth, db, storage } from '../config/firebase';
import type {
  AnswerKeyEntry,
  GenerateQuestionPaperRequest,
  GenerateQuestionPaperResponse,
  GeneratedQuestion,
  PaperBlueprint,
  PaperSource,
  QuestionPaperDoc,
} from '../types/questionPaper';

const COLLECTION = 'question_papers';

// ---------------------------------------------------------------------------
// AI generation (server)
// ---------------------------------------------------------------------------

export async function generateQuestionPaper(
  params: GenerateQuestionPaperRequest
): Promise<GenerateQuestionPaperResponse> {
  try {
    const response = await api.post<{
      success: boolean;
      data?: GenerateQuestionPaperResponse;
      error?: string;
      message?: string;
    }>('/ai-education/generate-question-paper', params);

    const data = response.data;
    if (!data.success || !data.data) {
      const msg = data.error ?? data.message ?? 'Failed to generate question paper';
      throw new Error(msg);
    }
    return data.data;
  } catch (err: unknown) {
    const ax = err as {
      response?: { data?: { error?: string; message?: string } };
      message?: string;
    };
    const serverMsg = ax.response?.data?.error ?? ax.response?.data?.message;
    if (serverMsg) throw new Error(serverMsg);
    if (err instanceof Error) throw err;
    throw new Error('Failed to generate question paper');
  }
}

// ---------------------------------------------------------------------------
// Storage: upload a source PDF for this user
// ---------------------------------------------------------------------------

export interface UploadedSource {
  storagePath: string;
  pdfUrl: string;
  fileName: string;
}

export async function uploadSourcePdf(file: File): Promise<UploadedSource> {
  if (!storage) throw new Error('Firebase Storage is not available.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be signed in to upload a source PDF.');
  if (file.type !== 'application/pdf') {
    throw new Error('Please select a PDF file.');
  }
  const MAX_MB = 20;
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`PDF must be under ${MAX_MB} MB.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const storagePath = `question_papers/${uid}/source/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, immutableUploadMetadata('application/pdf'));
  const pdfUrl = await getDownloadURL(storageRef);
  return { storagePath, pdfUrl, fileName: safeName };
}

// ---------------------------------------------------------------------------
// Firestore CRUD
// ---------------------------------------------------------------------------

export interface CreatePaperInput {
  blueprint: PaperBlueprint;
  source: PaperSource;
  questions: GeneratedQuestion[];
  answer_key: AnswerKeyEntry[];
  model?: string;
  status?: 'draft' | 'final';
  school_id?: string;
  class_id?: string;
}

export async function createQuestionPaper(input: CreatePaperInput): Promise<QuestionPaperDoc> {
  if (!db) throw new Error('Firestore is not initialized.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be signed in.');

  const colRef = collection(db, COLLECTION);
  const payload = {
    created_by_uid: uid,
    school_id: input.school_id ?? null,
    class_id: input.class_id ?? null,
    curriculum: input.blueprint.curriculum ?? null,
    subject: input.blueprint.subject,
    chapter_ids: input.blueprint.chapter_ids ?? [],
    source: input.source,
    status: input.status ?? 'draft',
    blueprint: input.blueprint,
    questions: input.questions,
    answer_key: input.answer_key,
    model: input.model ?? null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const docRef = await addDoc(colRef, payload);
  const created = await getDoc(docRef);
  return { id: docRef.id, ...(created.data() as Omit<QuestionPaperDoc, 'id'>) };
}

export async function updateQuestionPaper(
  paperId: string,
  patch: Partial<Omit<QuestionPaperDoc, 'id' | 'created_by_uid' | 'created_at'>>
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const ref = doc(db, COLLECTION, paperId);
  await updateDoc(ref, { ...patch, updated_at: serverTimestamp() });
}

export async function getQuestionPaper(paperId: string): Promise<QuestionPaperDoc | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const ref = doc(db, COLLECTION, paperId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<QuestionPaperDoc, 'id'>) };
}

export async function deleteQuestionPaper(paperId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await deleteDoc(doc(db, COLLECTION, paperId));
}

export interface ListPapersOptions {
  /** Owner filter — defaults to the current user */
  uid?: string;
  schoolId?: string;
  /** Multiple schools (e.g. a partner's portfolio). Uses a Firestore 'in' filter (max 30). */
  schoolIds?: string[];
  subject?: string;
  classFilter?: string;
  limit?: number;
  /** If true, fetch all papers (admin view) */
  all?: boolean;
}

export async function listQuestionPapers(opts: ListPapersOptions = {}): Promise<QuestionPaperDoc[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  const filters: Array<ReturnType<typeof where>> = [];

  if (!opts.all) {
    const uid = opts.uid ?? auth.currentUser?.uid;
    if (!uid) return [];
    filters.push(where('created_by_uid', '==', uid));
  }
  if (opts.schoolIds && opts.schoolIds.length > 0) {
    filters.push(where('school_id', 'in', opts.schoolIds.slice(0, 30)));
  } else if (opts.schoolId) {
    filters.push(where('school_id', '==', opts.schoolId));
  }
  if (opts.subject) filters.push(where('subject', '==', opts.subject));

  let q: Query<DocumentData> = collection(db, COLLECTION);
  for (const f of filters) {
    q = query(q, f);
  }
  q = query(q, orderBy('created_at', 'desc'), limit(opts.limit ?? 50));

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuestionPaperDoc, 'id'>) }));
  } catch (err) {
    // If the ordered query fails (missing index), retry without the orderBy clause
    console.warn('[questionPaperService] orderBy query failed, retrying without:', err);
    let qFallback: Query<DocumentData> = collection(db, COLLECTION);
    for (const f of filters) qFallback = query(qFallback, f);
    qFallback = query(qFallback, limit(opts.limit ?? 50));
    const snap = await getDocs(qFallback);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuestionPaperDoc, 'id'>) }));
  }
}

/** Overwrite a paper's questions and answer key after a regenerate / manual edit. */
export async function saveQuestions(
  paperId: string,
  questions: GeneratedQuestion[],
  answer_key: AnswerKeyEntry[]
): Promise<void> {
  await updateQuestionPaper(paperId, { questions, answer_key });
}

/** Duplicate a paper — new doc owned by the current user, status reset to draft. */
export async function duplicateQuestionPaper(paper: QuestionPaperDoc): Promise<QuestionPaperDoc> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be signed in.');
  const duplicateTitle = `${paper.blueprint.title} (Copy)`;
  const input: CreatePaperInput = {
    blueprint: { ...paper.blueprint, title: duplicateTitle },
    source: paper.source,
    questions: paper.questions,
    answer_key: paper.answer_key,
    model: paper.model,
    status: 'draft',
    school_id: paper.school_id,
    class_id: paper.class_id,
  };
  return createQuestionPaper(input);
}

/** Narrow helper used to pick a storage-linked source from a Firestore chapter document. */
export function sourceFromChapter(
  chapterId: string,
  chapter: { pdf_storage_url?: string } | null | undefined
): PaperSource {
  return {
    type: 'chapter',
    chapterId,
    pdfUrl: chapter?.pdf_storage_url,
  };
}

/** Promise-safe overwrite for a single generated question (used by regenerate-single). */
export async function replaceQuestion(
  paperId: string,
  replacement: GeneratedQuestion,
  newAnswerKey?: AnswerKeyEntry
): Promise<void> {
  const paper = await getQuestionPaper(paperId);
  if (!paper) throw new Error('Paper not found.');
  const idx = paper.questions.findIndex((q) => q.id === replacement.id);
  const updatedQs =
    idx === -1 ? [...paper.questions, replacement] : paper.questions.map((q, i) => (i === idx ? replacement : q));

  let updatedKey = paper.answer_key;
  if (newAnswerKey) {
    const keyIdx = paper.answer_key.findIndex((k) => k.question_id === newAnswerKey.question_id);
    updatedKey =
      keyIdx === -1
        ? [...paper.answer_key, newAnswerKey]
        : paper.answer_key.map((k, i) => (i === keyIdx ? newAnswerKey : k));
  }
  await saveQuestions(paperId, updatedQs, updatedKey);
}

/** Low-level document writer for admins (not used by UI today). */
export async function adminWritePaper(paperId: string, data: Partial<QuestionPaperDoc>): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await setDoc(doc(db, COLLECTION, paperId), { ...data, updated_at: serverTimestamp() }, { merge: true });
}
