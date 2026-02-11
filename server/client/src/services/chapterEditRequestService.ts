/**
 * Chapter Edit Request Service
 * Associate submits lesson changes for approval; Admin/Super Admin approve or reject.
 * Collection: chapter_edit_requests
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getLatestUnapprovedVersionForUser,
  getChapterSnapshot,
  applySnapshotToMainAndApproveTopic,
} from './lessonVersionService';
import { approveChapter } from '../lib/firebase/queries/curriculumChapters';

const COLLECTION = 'chapter_edit_requests';

export type EditRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ChapterEditRequest {
  id: string;
  chapterId: string;
  requestedBy: string; // uid
  requestedByEmail?: string;
  requestedAt: Timestamp | null;
  status: EditRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Timestamp | null;
  chapterName?: string;
  chapterNumber?: number;
}

export interface CreateRequestInput {
  chapterId: string;
  requestedBy: string;
  requestedByEmail?: string;
  chapterName?: string;
  chapterNumber?: number;
}

/**
 * Create a new edit request (Associate clicks "Submit for approval")
 */
export async function createEditRequest(input: CreateRequestInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    chapterId: input.chapterId,
    requestedBy: input.requestedBy,
    requestedByEmail: input.requestedByEmail || null,
    requestedAt: serverTimestamp(),
    status: 'pending',
    chapterName: input.chapterName || null,
    chapterNumber: input.chapterNumber ?? null,
  });
  return ref.id;
}

/**
 * Check if there is already a pending request for this chapter by this associate
 */
export async function getPendingRequestForChapter(
  chapterId: string,
  requestedBy: string
): Promise<ChapterEditRequest | null> {
  const q = query(
    collection(db, COLLECTION),
    where('chapterId', '==', chapterId),
    where('requestedBy', '==', requestedBy),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    chapterId: data.chapterId,
    requestedBy: data.requestedBy,
    requestedByEmail: data.requestedByEmail,
    requestedAt: data.requestedAt ?? null,
    status: data.status,
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt ?? null,
    chapterName: data.chapterName,
    chapterNumber: data.chapterNumber,
  };
}

/**
 * Fetch all pending edit requests (for Admin / Super Admin)
 */
export async function fetchPendingEditRequests(): Promise<ChapterEditRequest[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      chapterId: data.chapterId,
      requestedBy: data.requestedBy,
      requestedByEmail: data.requestedByEmail,
      requestedAt: data.requestedAt ?? null,
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedAt: data.reviewedAt ?? null,
      chapterName: data.chapterName,
      chapterNumber: data.chapterNumber,
    };
  });
  list.sort((a, b) => {
    const at = a.requestedAt?.toMillis?.() ?? 0;
    const bt = b.requestedAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  return list;
}

/**
 * Approve an edit request.
 * Performs BOTH: (1) merge Associate's draft from versions into main schema,
 * (2) approve the topic(s) so they're visible on the Lessons page.
 */
export async function approveEditRequest(requestId: string, reviewedBy: string): Promise<void> {
  const req = await getEditRequest(requestId);
  if (!req) throw new Error('Edit request not found');
  if (req.status !== 'pending') throw new Error('Edit request is not pending');

  const chapterId = req.chapterId;
  const requestedBy = req.requestedBy;

  // Get chapter to find topics
  const chapterRef = doc(db, 'curriculum_chapters', chapterId);
  const chapterSnap = await getDoc(chapterRef);
  if (!chapterSnap.exists()) throw new Error('Chapter not found');

  const chapterData = chapterSnap.data() as { topics?: Array<{ topic_id: string }> };
  const topics = chapterData.topics || [];

  // For each topic, get latest unapproved version by this Associate and apply it
  for (const topic of topics) {
    const topicId = topic.topic_id;
    const version = await getLatestUnapprovedVersionForUser(chapterId, topicId, requestedBy);
    if (!version?.snapshot_ref) continue;

    const draft = await getChapterSnapshot(version.snapshot_ref);
    if (!draft) continue;

    await applySnapshotToMainAndApproveTopic(
      chapterId,
      topicId,
      draft,
      version.id,
      reviewedBy
    );
  }

  // Approve the chapter so it shows as Approved on the Lessons page
  await approveChapter(chapterId, reviewedBy);

  // Mark edit request as approved
  const ref = doc(db, COLLECTION, requestId);
  await updateDoc(ref, {
    status: 'approved',
    reviewedBy,
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Reject an edit request
 */
export async function rejectEditRequest(requestId: string, reviewedBy: string): Promise<void> {
  const ref = doc(db, COLLECTION, requestId);
  await updateDoc(ref, {
    status: 'rejected',
    reviewedBy,
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Get a single request by id
 */
export async function getEditRequest(requestId: string): Promise<ChapterEditRequest | null> {
  const ref = doc(db, COLLECTION, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    chapterId: data.chapterId,
    requestedBy: data.requestedBy,
    requestedByEmail: data.requestedByEmail,
    requestedAt: data.requestedAt ?? null,
    status: data.status,
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt ?? null,
    chapterName: data.chapterName,
    chapterNumber: data.chapterNumber,
  };
}
