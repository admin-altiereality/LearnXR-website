/**
 * fetchDocsByIds – read a set of documents by id, in batches Firestore accepts.
 *
 * Lifted out of `services/firestore/getLessonBundle.ts`, which had the only copy.
 * The studio's asset-health check needs exactly the same read, and a second
 * hand-written version of a batching-and-fallback routine is how the two end up
 * behaving differently under load or under a rules change.
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { db } from '../../config/firebase';

/** Firestore rejects an `in` filter with more than 30 values. */
export const ID_CHUNK_SIZE = 30;

export function chunkArray<T>(array: T[], size: number = ID_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Every document that exists among `ids`. Missing ones are simply absent from
 * the result — callers decide what an id with no document means.
 *
 * @param label Used in warnings, so a failure names the caller that hit it.
 */
export async function fetchDocsByIds(
  collectionName: string,
  ids: string[],
  label = 'fetchDocsByIds'
): Promise<any[]> {
  if (ids.length === 0) return [];

  const chunks = chunkArray(ids);
  const allDocs: any[] = [];

  for (const chunk of chunks) {
    try {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, where(documentId(), 'in', chunk));
      const snapshot = await getDocs(q);

      snapshot.docs.forEach((docSnap) => {
        allDocs.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (error) {
      console.warn(`[${label}] Error fetching ${collectionName} chunk:`, error);

      // Fall back to individual reads only when retrying could plausibly succeed.
      // A rules rejection or a signed-out client fails identically for every
      // document in the chunk, so an unconditional loop turns one refused read
      // into thirty — the read amplification is worst exactly when nothing would
      // load anyway.
      const code = (error as { code?: string } | null)?.code ?? '';
      if (code === 'permission-denied' || code === 'unauthenticated') {
        console.warn(
          `[${label}] Skipping per-document retry for ${collectionName}: ${code} applies to the whole chunk.`
        );
        continue;
      }

      for (const id of chunk) {
        try {
          const docSnap = await getDoc(doc(db, collectionName, id));
          if (docSnap.exists()) {
            allDocs.push({ id: docSnap.id, ...docSnap.data() });
          }
        } catch (err) {
          console.warn(`[${label}] Failed to fetch ${collectionName}/${id}:`, err);
        }
      }
    }
  }

  return allDocs;
}
