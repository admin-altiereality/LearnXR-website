/**
 * Unified Curriculum Chapters Query Utility
 * 
 * This is the SINGLE source for fetching curriculum chapters.
 * Both /lessons and /studio/content should use this.
 * 
 * Features:
 * - Approval gating (approvedOnly filter)
 * - Curriculum/class/subject filtering
 * - Multi-language support via normalizer
 * - Consistent sorting (chapter_number, topic_priority)
 * - Pagination support
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  serverTimestamp,
  DocumentSnapshot,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { CurriculumChapter } from '../../../types/firebase';
import { invalidateLessonBundleCache } from '../../../services/firestore/getLessonBundle';
import { persistentGet, persistentSet } from '../../cache/persistentCache';
import type {
  LanguageCode,
  NormalizedChapter,
  FetchChaptersParams,
  FetchChaptersResult,
} from '../../../types/curriculum';
import {
  normalizeChapter,
  normalizeChapters,
  countMcqsByLanguage,
  countTtsByLanguage,
} from '../normalizers/chapterNormalizer';

// ============================================
// CONSTANTS
// ============================================

const COLLECTION_NAME = 'curriculum_chapters';
const DEFAULT_PAGE_SIZE = 50;

// ============================================
// CORE FETCH FUNCTION
// ============================================

/**
 * Fetch curriculum chapters with optional filters
 * This is the unified query function used by both /lessons and /studio
 * 
 * @param params - Query parameters
 * @param language - Language to normalize content for (default: 'en')
 */
export async function fetchCurriculumChapters(
  params: FetchChaptersParams,
  language: LanguageCode = 'en'
): Promise<FetchChaptersResult> {
  const {
    curriculum,
    classNumber,
    subject,
    approvedOnly = false,
    searchTerm,
    pageSize = DEFAULT_PAGE_SIZE,
    startAfterDoc,
  } = params;

  try {
    console.log('📚 fetchCurriculumChapters:', { 
      curriculum, classNumber, subject, approvedOnly, language,
      searchTerm: searchTerm?.substring(0, 20),
    });

    const chaptersRef = collection(db, COLLECTION_NAME);
    const constraints: QueryConstraint[] = [];

    // Filter by curriculum
    if (curriculum) {
      constraints.push(where('curriculum', '==', curriculum.toUpperCase()));
    }

    // Filter by class
    if (classNumber !== undefined) {
      constraints.push(where('class', '==', classNumber));
    }

    // Filter by subject
    if (subject) {
      // Subject might be stored with spaces or underscores
      const subjectName = subject.replace(/_/g, ' ');
      constraints.push(where('subject', '==', subjectName));
    }

    // APPROVAL GATING - Critical for /lessons
    if (approvedOnly) {
      constraints.push(where('approved', '==', true));
    }

    // Build and execute query
    const q = query(chaptersRef, ...constraints);
    const snapshot = await getDocs(q);

    console.log(`📊 Query returned ${snapshot.docs.length} documents`);

    // Map to raw data with IDs
    let rawChapters = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data() as CurriculumChapter,
    }));

    // Sort by chapter number (Firestore can't always do multi-field sorts with filters)
    rawChapters.sort((a, b) => {
      const aNum = a.data.chapter_number || 0;
      const bNum = b.data.chapter_number || 0;
      return aNum - bNum;
    });

    // Client-side search filter (if search term provided)
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      rawChapters = rawChapters.filter(({ data }) =>
        data.chapter_name?.toLowerCase().includes(term) ||
        data.subject?.toLowerCase().includes(term) ||
        data.topics?.some(t => t.topic_name?.toLowerCase().includes(term))
      );
    }

    // Pagination
    const hasMore = rawChapters.length > pageSize;
    if (hasMore) {
      rawChapters = rawChapters.slice(0, pageSize);
    }

    // Normalize all chapters for the specified language
    const normalizedChapters = normalizeChapters(rawChapters, language);

    console.log('✅ Normalized chapters:', normalizedChapters.length);

    return {
      chapters: normalizedChapters,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore,
      total: snapshot.docs.length,
    };
  } catch (error) {
    console.error('❌ Error fetching curriculum chapters:', error);
    return {
      chapters: [],
      lastDoc: null,
      hasMore: false,
      total: 0,
    };
  }
}

// ============================================
// SINGLE CHAPTER FETCH
// ============================================

/**
 * Fetch a single chapter by document ID
 * @param chapterId - Firestore document ID
 * @param language - Language to normalize content for
 */
export async function fetchChapterById(
  chapterId: string,
  language: LanguageCode = 'en'
): Promise<NormalizedChapter | null> {
  try {
    console.log('📖 fetchChapterById:', { chapterId, language });

    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);

    if (!snapshot.exists()) {
      console.warn('⚠️ Chapter not found:', chapterId);
      return null;
    }

    const chapter = normalizeChapter(
      snapshot.id,
      snapshot.data() as CurriculumChapter,
      language
    );

    console.log('✅ Fetched chapter:', chapter.chapterName);
    return chapter;
  } catch (error) {
    console.error('❌ Error fetching chapter:', error);
    return null;
  }
}

/**
 * Fetch raw chapter data (for editing in studio)
 */
export async function fetchRawChapter(
  chapterId: string
): Promise<{ id: string; data: CurriculumChapter } | null> {
  try {
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      data: snapshot.data() as CurriculumChapter,
    };
  } catch (error) {
    console.error('❌ Error fetching raw chapter:', error);
    return null;
  }
}

// ============================================
// REAL-TIME SUBSCRIPTION
// ============================================

/**
 * Subscribe to chapters with real-time updates
 * @param params - Query parameters
 * @param language - Language for normalization
 * @param callback - Called when data changes
 * @returns Unsubscribe function
 */
export function subscribeToChapters(
  params: FetchChaptersParams,
  language: LanguageCode,
  callback: (result: FetchChaptersResult) => void
): Unsubscribe {
  const {
    curriculum,
    classNumber,
    subject,
    approvedOnly = false,
  } = params;

  const chaptersRef = collection(db, COLLECTION_NAME);
  const constraints: QueryConstraint[] = [];

  if (curriculum) {
    constraints.push(where('curriculum', '==', curriculum.toUpperCase()));
  }
  if (classNumber !== undefined) {
    constraints.push(where('class', '==', classNumber));
  }
  if (subject) {
    constraints.push(where('subject', '==', subject.replace(/_/g, ' ')));
  }
  if (approvedOnly) {
    constraints.push(where('approved', '==', true));
  }

  const q = query(chaptersRef, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const rawChapters = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        data: docSnap.data() as CurriculumChapter,
      }));

      // Sort by chapter number
      rawChapters.sort((a, b) => 
        (a.data.chapter_number || 0) - (b.data.chapter_number || 0)
      );

      const normalizedChapters = normalizeChapters(rawChapters, language);

      callback({
        chapters: normalizedChapters,
        lastDoc: null,
        hasMore: false,
        total: snapshot.docs.length,
      });
    },
    (error) => {
      console.error('❌ Subscription error:', error);
      callback({
        chapters: [],
        lastDoc: null,
        hasMore: false,
        total: 0,
      });
    }
  );
}

// ============================================
// APPROVAL FUNCTIONS
// ============================================

/**
 * Approve a chapter (admin/superadmin only)
 * @param chapterId - Document ID of chapter to approve
 * @param approvedBy - UID of admin approving
 */
export async function approveChapter(
  chapterId: string,
  approvedBy: string
): Promise<boolean> {
  try {
    console.log('✅ Approving chapter:', { chapterId, approvedBy });

    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    await updateDoc(chapterRef, {
      approved: true,
      approvedAt: serverTimestamp(),
      approvedBy,
      updatedAt: serverTimestamp(),
    });
    invalidateLessonBundleCache(chapterId);
    console.log('✅ Chapter approved successfully');
    return true;
  } catch (error) {
    console.error('❌ Error approving chapter:', error);
    return false;
  }
}

/**
 * Unapprove a chapter (admin/superadmin only)
 * @param chapterId - Document ID of chapter to unapprove
 */
export async function unapproveChapter(chapterId: string): Promise<boolean> {
  try {
    console.log('🚫 Unapproving chapter:', chapterId);

    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    await updateDoc(chapterRef, {
      approved: false,
      approvedAt: null,
      approvedBy: null,
      updatedAt: serverTimestamp(),
    });
    invalidateLessonBundleCache(chapterId);
    console.log('✅ Chapter unapproved successfully');
    return true;
  } catch (error) {
    console.error('❌ Error unapproving chapter:', error);
    return false;
  }
}

/**
 * Fetch all unapproved chapters (for admin dashboard)
 */
export async function fetchUnapprovedChapters(
  language: LanguageCode = 'en'
): Promise<NormalizedChapter[]> {
  try {
    console.log('📋 Fetching unapproved chapters');

    const chaptersRef = collection(db, COLLECTION_NAME);
    const q = query(
      chaptersRef,
      where('approved', '==', false)
    );

    const snapshot = await getDocs(q);

    // Also include chapters where approved field doesn't exist
    const qNoField = query(chaptersRef);
    const snapshotAll = await getDocs(qNoField);
    
    // Combine: explicitly false + missing field
    const unapprovedDocs = new Map<string, DocumentSnapshot>();
    
    snapshot.docs.forEach(doc => unapprovedDocs.set(doc.id, doc));
    snapshotAll.docs.forEach(doc => {
      const data = doc.data();
      if (data.approved === undefined || data.approved === false) {
        unapprovedDocs.set(doc.id, doc);
      }
    });

    const rawChapters = Array.from(unapprovedDocs.values()).map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data() as CurriculumChapter,
    }));

    // Sort by updated time (newest first)
    rawChapters.sort((a, b) => {
      const aTime = a.data.updatedAt || a.data.createdAt || '';
      const bTime = b.data.updatedAt || b.data.createdAt || '';
      return bTime.localeCompare(aTime);
    });

    const normalizedChapters = normalizeChapters(rawChapters, language);

    console.log('✅ Found unapproved chapters:', normalizedChapters.length);
    return normalizedChapters;
  } catch (error) {
    console.error('❌ Error fetching unapproved chapters:', error);
    return [];
  }
}

// ============================================
// FILTER OPTIONS (for dropdowns)
// ============================================

/**
 * Distinct-value lookups over curriculum_chapters, cached on disk.
 *
 * Firestore has no DISTINCT, so deriving "which curriculums exist" means reading
 * documents — and `getAvailableCurriculums` read the *entire* collection, whose
 * documents are the largest in the database (each carries every topic with its full
 * id arrays). These lists change only when a chapter is created or re-tagged, so
 * paying that on every picker mount was the expensive part, not the query itself.
 *
 * An hour of staleness is the trade: a newly added curriculum shows up within the
 * hour, or immediately in a new session on a device that has not cached it.
 */
const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000;

async function withCatalogCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = await persistentGet<T>(key);
  if (cached !== null) return cached;

  const value = await load();
  void persistentSet(key, value, CATALOG_CACHE_TTL_MS);
  return value;
}

/**
 * Get unique curriculums from existing chapters
 */
export async function getAvailableCurriculums(): Promise<string[]> {
  return withCatalogCache('catalog:curriculums', getAvailableCurriculumsUncached);
}

async function getAvailableCurriculumsUncached(): Promise<string[]> {
  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(chaptersRef);

    const curriculumSet = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CurriculumChapter;
      if (data.curriculum) {
        curriculumSet.add(data.curriculum.toUpperCase());
      }
    });

    const curriculums = Array.from(curriculumSet).sort();
    
    if (curriculums.length === 0) {
      return ['CBSE', 'RBSE']; // Defaults
    }

    return curriculums;
  } catch (error) {
    console.error('Error fetching curriculums:', error);
    return ['CBSE', 'RBSE'];
  }
}

/**
 * Get unique classes for a curriculum
 */
export async function getAvailableClasses(curriculum: string): Promise<number[]> {
  return withCatalogCache(`catalog:classes:${curriculum.toUpperCase()}`, () =>
    getAvailableClassesUncached(curriculum)
  );
}

async function getAvailableClassesUncached(curriculum: string): Promise<number[]> {
  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    const q = query(
      chaptersRef,
      where('curriculum', '==', curriculum.toUpperCase())
    );
    const snapshot = await getDocs(q);

    const classSet = new Set<number>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CurriculumChapter;
      if (data.class) {
        classSet.add(data.class);
      }
    });

    const classes = Array.from(classSet).sort((a, b) => a - b);

    if (classes.length === 0) {
      return [6, 7, 8, 9, 10]; // Defaults
    }

    return classes;
  } catch (error) {
    console.error('Error fetching classes:', error);
    return [6, 7, 8, 9, 10];
  }
}

/**
 * Get unique subjects for a curriculum and class
 */
export async function getAvailableSubjects(
  curriculum: string,
  classNumber: number
): Promise<string[]> {
  return withCatalogCache(`catalog:subjects:${curriculum.toUpperCase()}:${classNumber}`, () =>
    getAvailableSubjectsUncached(curriculum, classNumber)
  );
}

async function getAvailableSubjectsUncached(
  curriculum: string,
  classNumber: number
): Promise<string[]> {
  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    const q = query(
      chaptersRef,
      where('curriculum', '==', curriculum.toUpperCase()),
      where('class', '==', classNumber)
    );
    const snapshot = await getDocs(q);

    const subjectSet = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CurriculumChapter;
      if (data.subject) {
        subjectSet.add(data.subject);
      }
    });

    const subjects = Array.from(subjectSet).sort();

    if (subjects.length === 0) {
      return ['Science', 'Mathematics', 'Social Science', 'English', 'Hindi'];
    }

    return subjects;
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return ['Science', 'Mathematics'];
  }
}

// ============================================
// STATS
// ============================================

/**
 * Get chapter statistics (for dashboard)
 */
export async function getChapterStats(): Promise<{
  total: number;
  approved: number;
  pending: number;
  byCurriculum: Record<string, number>;
}> {
  try {
    // Counted server-side rather than by reading every chapter. An aggregation query
    // is billed at one read per 1000 documents matched, so this is a handful of reads
    // where the old implementation downloaded the entire collection — the heaviest
    // documents in the database — purely to increment three counters.
    const chaptersRef = collection(db, COLLECTION_NAME);
    const curriculums = await getAvailableCurriculums();

    const [totalSnap, approvedSnap, ...curriculumSnaps] = await Promise.all([
      getCountFromServer(chaptersRef),
      getCountFromServer(query(chaptersRef, where('approved', '==', true))),
      ...curriculums.map((curriculum) =>
        getCountFromServer(query(chaptersRef, where('curriculum', '==', curriculum)))
      ),
    ]);

    const total = totalSnap.data().count;
    const approved = approvedSnap.data().count;

    const byCurriculum: Record<string, number> = {};
    curriculums.forEach((curriculum, index) => {
      byCurriculum[curriculum] = curriculumSnaps[index]?.data().count ?? 0;
    });

    return {
      total,
      approved,
      pending: total - approved,
      byCurriculum,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      total: 0,
      approved: 0,
      pending: 0,
      byCurriculum: {},
    };
  }
}
