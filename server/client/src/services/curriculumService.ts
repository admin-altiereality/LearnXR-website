import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { CurriculumChapter, Topic } from '../types/firebase';
import {
  generateChapterDocumentId,
  parseChapterDocumentId,
  createCurriculumChapter,
  validateCurriculumChapter,
  type CurriculumQueryFilters,
} from '../utils/curriculumUtils';

/**
 * Service for managing curriculum chapters in Firestore
 */
export class CurriculumService {
  private db: Firestore;
  private collectionName = 'curriculum_chapters';

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Get a chapter by its document ID
   */
  async getChapterById(documentId: string): Promise<CurriculumChapter | null> {
    try {
      const chapterRef = doc(this.db, this.collectionName, documentId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        return null;
      }

      return chapterSnap.data() as CurriculumChapter;
    } catch (error) {
      console.error('Error getting chapter:', error);
      throw error;
    }
  }

  /**
   * Get a chapter by curriculum, class, subject, and chapter number
   */
  async getChapter(
    curriculum: string,
    classNum: number,
    subject: string,
    chapterNumber: number
  ): Promise<CurriculumChapter | null> {
    const documentId = generateChapterDocumentId(
      curriculum,
      classNum,
      subject,
      chapterNumber
    );
    return this.getChapterById(documentId);
  }

  /**
   * Get all chapters matching the provided filters
   */
  async getChapters(filters: CurriculumQueryFilters): Promise<CurriculumChapter[]> {
    try {
      const constraints: any[] = [];

      if (filters.curriculum) {
        constraints.push(where('curriculum', '==', filters.curriculum.toUpperCase()));
      }
      if (filters.class !== undefined) {
        constraints.push(where('class', '==', filters.class));
      }
      if (filters.subject) {
        constraints.push(where('subject', '==', filters.subject));
      }
      if (filters.chapter_number !== undefined) {
        constraints.push(where('chapter_number', '==', filters.chapter_number));
      }

      const chaptersQuery = query(
        collection(this.db, this.collectionName),
        ...constraints
      );

      const querySnapshot = await getDocs(chaptersQuery);
      const chapters: CurriculumChapter[] = [];

      querySnapshot.forEach((doc) => {
        chapters.push(doc.data() as CurriculumChapter);
      });

      return chapters;
    } catch (error) {
      console.error('Error getting chapters:', error);
      throw error;
    }
  }

  /**
   * Create or update a curriculum chapter
   */
  async saveChapter(
    curriculum: string,
    classNum: number,
    subject: string,
    chapterNumber: number,
    chapterName: string,
    topics: Omit<Topic, 'topic_id'>[]
  ): Promise<string> {
    try {
      // Create the chapter object
      const chapter = createCurriculumChapter(
        curriculum,
        classNum,
        subject,
        chapterNumber,
        chapterName,
        topics
      );

      // Validate the chapter
      const validation = validateCurriculumChapter(chapter);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate document ID
      const documentId = generateChapterDocumentId(
        curriculum,
        classNum,
        subject,
        chapterNumber
      );

      // Check if document exists
      const existingDoc = await getDoc(doc(this.db, this.collectionName, documentId));
      const isNewDocument = !existingDoc.exists();

      // Prepare data with timestamps
      const chapterData: any = {
        ...chapter,
        updatedAt: serverTimestamp(),
      };

      if (isNewDocument) {
        chapterData.createdAt = serverTimestamp();
      } else {
        // Preserve existing createdAt
        const existingData = existingDoc.data();
        if (existingData?.createdAt) {
          chapterData.createdAt = existingData.createdAt;
        } else {
          chapterData.createdAt = serverTimestamp();
        }
      }

      // Save to Firestore
      const chapterRef = doc(this.db, this.collectionName, documentId);
      await setDoc(chapterRef, chapterData, { merge: true });

      console.log(`✅ Saved chapter: ${documentId}`);
      return documentId;
    } catch (error) {
      console.error('Error saving chapter:', error);
      throw error;
    }
  }

  /**
   * Update a topic's skybox reference
   */
  async updateTopicSkybox(
    documentId: string,
    topicId: string,
    skyboxId: string
  ): Promise<void> {
    try {
      const chapterRef = doc(this.db, this.collectionName, documentId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        throw new Error('Chapter not found');
      }

      const chapter = chapterSnap.data() as CurriculumChapter;
      const topicIndex = chapter.topics.findIndex((t) => t.topic_id === topicId);

      if (topicIndex === -1) {
        throw new Error('Topic not found');
      }

      // Update the topic
      const updatedTopics = [...chapter.topics];
      updatedTopics[topicIndex] = {
        ...updatedTopics[topicIndex],
        skybox_id: skyboxId,
        status: 'generated',
        generatedAt: new Date().toISOString(),
      };

      // Update the chapter
      await updateDoc(chapterRef, {
        topics: updatedTopics,
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Updated topic ${topicId} with skybox ${skyboxId}`);
    } catch (error) {
      console.error('Error updating topic skybox:', error);
      throw error;
    }
  }

  /**
   * Add multiple skybox IDs to a topic
   */
  async addTopicSkyboxes(
    documentId: string,
    topicId: string,
    skyboxIds: string[]
  ): Promise<void> {
    try {
      const chapterRef = doc(this.db, this.collectionName, documentId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        throw new Error('Chapter not found');
      }

      const chapter = chapterSnap.data() as CurriculumChapter;
      const topicIndex = chapter.topics.findIndex((t) => t.topic_id === topicId);

      if (topicIndex === -1) {
        throw new Error('Topic not found');
      }

      // Update the topic
      const updatedTopics = [...chapter.topics];
      const existingSkyboxIds = updatedTopics[topicIndex].skybox_ids || [];
      updatedTopics[topicIndex] = {
        ...updatedTopics[topicIndex],
        skybox_ids: [...existingSkyboxIds, ...skyboxIds],
        status: 'generated',
        generatedAt: new Date().toISOString(),
      };

      // Update the chapter
      await updateDoc(chapterRef, {
        topics: updatedTopics,
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Added ${skyboxIds.length} skyboxes to topic ${topicId}`);
    } catch (error) {
      console.error('Error adding topic skyboxes:', error);
      throw error;
    }
  }

  /**
   * Update a topic's asset references
   */
  async updateTopicAssets(
    documentId: string,
    topicId: string,
    assetIds: string[]
  ): Promise<void> {
    try {
      const chapterRef = doc(this.db, this.collectionName, documentId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        throw new Error('Chapter not found');
      }

      const chapter = chapterSnap.data() as CurriculumChapter;
      const topicIndex = chapter.topics.findIndex((t) => t.topic_id === topicId);

      if (topicIndex === -1) {
        throw new Error('Topic not found');
      }

      // Update the topic
      const updatedTopics = [...chapter.topics];
      updatedTopics[topicIndex] = {
        ...updatedTopics[topicIndex],
        asset_ids: assetIds,
        status: 'generated',
        generatedAt: new Date().toISOString(),
      };

      // Update the chapter
      await updateDoc(chapterRef, {
        topics: updatedTopics,
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Updated topic ${topicId} with ${assetIds.length} assets`);
    } catch (error) {
      console.error('Error updating topic assets:', error);
      throw error;
    }
  }
}

/**
 * Create a curriculum service instance
 */
export function createCurriculumService(db: Firestore): CurriculumService {
  return new CurriculumService(db);
}
