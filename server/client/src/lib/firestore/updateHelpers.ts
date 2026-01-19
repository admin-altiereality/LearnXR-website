// Firestore Update Helpers for Curriculum Content Editor
// Optimized for minimal writes - works with existing curriculum_chapters collection

import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
  collection,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Topic,
  Scene,
  MCQ,
  MCQFormState,
  DocumentDiff,
  FieldDiff,
  FlattenedMCQ,
} from '../../types/curriculum';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../types/firebase';
import { extractFlattenedMCQs } from './queries';

const COLLECTION_NAME = 'curriculum_chapters';

// ============================================
// DIFF CALCULATION
// ============================================

export const computeDiff = <T extends Record<string, unknown>>(
  original: T,
  updated: T
): DocumentDiff => {
  const fields: FieldDiff[] = [];

  const allKeys = new Set([
    ...Object.keys(original),
    ...Object.keys(updated),
  ]);

  for (const key of allKeys) {
    const oldValue = original[key];
    const newValue = updated[key];

    // Deep comparison for arrays and objects
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      fields.push({
        field: key,
        oldValue,
        newValue,
      });
    }
  }

  return {
    fields,
    hasChanges: fields.length > 0,
  };
};

export const getChangedFields = <T extends Record<string, unknown>>(
  original: T,
  updated: T
): Partial<T> => {
  const diff = computeDiff(original, updated);
  const changes: Record<string, unknown> = {};

  for (const { field, newValue } of diff.fields) {
    changes[field] = newValue;
  }

  return changes as Partial<T>;
};

// ============================================
// TOPIC UPDATES
// Topics are stored inline in the chapter document
// ============================================

export interface UpdateTopicOptions {
  chapterId: string;
  versionId: string;
  topicId: string;
  original: Partial<Topic>;
  updated: Partial<Topic>;
  userId: string;
}

export const updateTopic = async (options: UpdateTopicOptions): Promise<void> => {
  const { chapterId, topicId, original, updated, userId } = options;

  const changes = getChangedFields(original, updated);

  if (Object.keys(changes).length === 0) {
    console.log('No changes to save for topic');
    return;
  }

  // Get the chapter document
  const chapterRef = doc(db, COLLECTION_NAME, chapterId);
  const chapterSnap = await getDoc(chapterRef);
  
  if (!chapterSnap.exists()) {
    throw new Error('Chapter not found');
  }
  
  const chapter = chapterSnap.data() as CurriculumChapter;
  const topicIndex = chapter.topics?.findIndex((t) => t.topic_id === topicId);
  
  if (topicIndex === undefined || topicIndex === -1) {
    throw new Error('Topic not found');
  }
  
  // Update the topic in the array
  const updatedTopics = [...chapter.topics];
  updatedTopics[topicIndex] = {
    ...updatedTopics[topicIndex],
    topic_name: (changes.topic_name as string) || updatedTopics[topicIndex].topic_name,
    topic_priority: (changes.topic_priority as number) || updatedTopics[topicIndex].topic_priority,
    scene_type: (changes.scene_type as 'mesh' | 'skybox' | 'mixed') || updatedTopics[topicIndex].scene_type,
  };
  
  await updateDoc(chapterRef, {
    topics: updatedTopics,
    updatedAt: serverTimestamp(),
  });
  
  // Add to history
  await addHistoryEntry(chapterId, userId, `Updated topic: ${updatedTopics[topicIndex].topic_name}`);
};

// ============================================
// SCENE UPDATES
// Scene data is stored inline in the topic
// ============================================

export interface UpdateSceneOptions {
  chapterId: string;
  versionId: string;
  topicId: string;
  sceneVersionId?: string;
  original: Partial<Scene>;
  updated: Partial<Scene>;
  userId: string;
  changeSummary?: string;
}

export const updateScene = async (options: UpdateSceneOptions): Promise<void> => {
  const {
    chapterId,
    topicId,
    original,
    updated,
    userId,
    changeSummary,
  } = options;

  const changes = getChangedFields(original, updated);

  if (Object.keys(changes).length === 0) {
    console.log('No changes to save for scene');
    return;
  }

  // Get the chapter document
  const chapterRef = doc(db, COLLECTION_NAME, chapterId);
  const chapterSnap = await getDoc(chapterRef);
  
  if (!chapterSnap.exists()) {
    throw new Error('Chapter not found');
  }
  
  const chapter = chapterSnap.data() as CurriculumChapter;
  const topicIndex = chapter.topics?.findIndex((t) => t.topic_id === topicId);
  
  if (topicIndex === undefined || topicIndex === -1) {
    throw new Error('Topic not found');
  }
  
  // Update the topic with scene data
  const updatedTopics = [...chapter.topics];
  const currentTopic = updatedTopics[topicIndex];
  
  // Map avatar_* fields to topic_avatar_* fields for storage
  updatedTopics[topicIndex] = {
    ...currentTopic,
    learning_objective: (changes.learning_objective as string) ?? currentTopic.learning_objective,
    in3d_prompt: (changes.in3d_prompt as string) ?? currentTopic.in3d_prompt,
    asset_list: (changes.asset_list as string[]) ?? currentTopic.asset_list,
    camera_guidance: (changes.camera_guidance as string) ?? currentTopic.camera_guidance,
    skybox_id: (changes.skybox_id as string) ?? currentTopic.skybox_id,
    // Map avatar fields to topic_avatar_* format
    topic_avatar_intro: (changes.avatar_intro as string) ?? currentTopic.topic_avatar_intro,
    topic_avatar_explanation: (changes.avatar_explanation as string) ?? currentTopic.topic_avatar_explanation,
    topic_avatar_outro: (changes.avatar_outro as string) ?? currentTopic.topic_avatar_outro,
    generatedAt: new Date().toISOString(),
  };
  
  await updateDoc(chapterRef, {
    topics: updatedTopics,
    updatedAt: serverTimestamp(),
  });
  
  // Generate change summary if not provided
  const autoSummary = changeSummary || generateChangeSummary(changes);
  await addHistoryEntry(chapterId, userId, autoSummary);
};

export const createScene = async (options: {
  chapterId: string;
  versionId: string;
  topicId: string;
  scene: Partial<Scene>;
  userId: string;
}): Promise<void> => {
  // In the flat structure, scene data is part of the topic
  // Just update the topic with scene fields
  await updateScene({
    chapterId: options.chapterId,
    versionId: options.versionId,
    topicId: options.topicId,
    original: {},
    updated: options.scene,
    userId: options.userId,
    changeSummary: 'Created scene',
  });
};

export const publishScene = async (options: {
  chapterId: string;
  versionId: string;
  topicId: string;
  sceneVersionId?: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> => {
  const { chapterId, topicId, userId } = options;

  try {
    // Get the chapter document
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const chapterSnap = await getDoc(chapterRef);
    
    if (!chapterSnap.exists()) {
      return { success: false, error: 'Chapter not found' };
    }
    
    const chapter = chapterSnap.data() as CurriculumChapter;
    const topicIndex = chapter.topics?.findIndex((t) => t.topic_id === topicId);
    
    if (topicIndex === undefined || topicIndex === -1) {
      return { success: false, error: 'Topic not found' };
    }
    
    // Update topic status to generated/published
    const updatedTopics = [...chapter.topics];
    updatedTopics[topicIndex] = {
      ...updatedTopics[topicIndex],
      status: 'generated',
      generatedAt: new Date().toISOString(),
    };
    
    await updateDoc(chapterRef, {
      topics: updatedTopics,
      updatedAt: serverTimestamp(),
    });
    
    await addHistoryEntry(chapterId, userId, 'Scene published');
    
    return { success: true };
  } catch (error) {
    console.error('Error publishing scene:', error);
    return { success: false, error: String(error) };
  }
};

// ============================================
// MCQ UPDATES
// MCQs stored in subcollection
// ============================================

export interface UpdateMCQsOptions {
  chapterId: string;
  versionId: string;
  topicId: string;
  originalMcqs: MCQ[];
  updatedMcqs: MCQFormState[];
  userId: string;
}

export const updateMCQs = async (options: UpdateMCQsOptions): Promise<void> => {
  const { chapterId, topicId, originalMcqs, updatedMcqs, userId } = options;

  const batch = writeBatch(db);
  const mcqsCollectionPath = `${COLLECTION_NAME}/${chapterId}/mcqs`;

  // Track which MCQs to create, update, or delete
  const originalMap = new Map(originalMcqs.map((m) => [m.id, m]));

  // Delete removed MCQs
  for (const original of originalMcqs) {
    const updated = updatedMcqs.find((m) => m.id === original.id);
    if (!updated || updated._isDeleted) {
      const mcqRef = doc(db, mcqsCollectionPath, original.id);
      batch.delete(mcqRef);
    }
  }

  // Update existing and create new MCQs
  for (let i = 0; i < updatedMcqs.length; i++) {
    const mcq = updatedMcqs[i];

    if (mcq._isDeleted) continue;

    if (mcq._isNew || !mcq.id) {
      // Create new MCQ
      const newMcqRef = doc(collection(db, mcqsCollectionPath));
      batch.set(newMcqRef, {
        topic_id: topicId,
        question: mcq.question,
        options: mcq.options,
        correct_option_index: mcq.correct_option_index,
        explanation: mcq.explanation,
        difficulty: mcq.difficulty,
        order: i,
        created_at: new Date().toISOString(),
        created_by: userId,
      });
    } else {
      // Update existing MCQ only if changed
      const original = originalMap.get(mcq.id);
      if (original) {
        const changes = getChangedFields(
          {
            question: original.question,
            options: original.options,
            correct_option_index: original.correct_option_index,
            explanation: original.explanation,
            difficulty: original.difficulty,
            order: original.order,
          },
          {
            question: mcq.question,
            options: mcq.options,
            correct_option_index: mcq.correct_option_index,
            explanation: mcq.explanation,
            difficulty: mcq.difficulty,
            order: i,
          }
        );

        if (Object.keys(changes).length > 0) {
          const mcqRef = doc(db, mcqsCollectionPath, mcq.id);
          batch.update(mcqRef, {
            ...changes,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          });
        }
      }
    }
  }

  await batch.commit();
  await addHistoryEntry(chapterId, userId, 'Updated MCQs');
};

export const deleteMCQ = async (
  chapterId: string,
  versionId: string,
  topicId: string,
  mcqId: string
): Promise<void> => {
  const mcqRef = doc(db, COLLECTION_NAME, chapterId, 'mcqs', mcqId);
  await deleteDoc(mcqRef);
};

// ============================================
// MCQ NORMALIZATION
// ============================================

export const normalizeFlattenedMCQs = async (options: {
  chapterId: string;
  versionId: string;
  topicId: string;
  flattenedData: FlattenedMCQ;
  userId: string;
}): Promise<{ success: boolean; count: number; error?: string }> => {
  const { chapterId, topicId, flattenedData, userId } = options;

  try {
    const mcqs = extractFlattenedMCQs(flattenedData);

    if (mcqs.length === 0) {
      return { success: true, count: 0 };
    }

    const batch = writeBatch(db);
    const mcqsCollectionPath = `${COLLECTION_NAME}/${chapterId}/mcqs`;

    // Create MCQ documents
    for (const mcq of mcqs) {
      const mcqRef = doc(collection(db, mcqsCollectionPath));
      batch.set(mcqRef, {
        topic_id: topicId,
        ...mcq,
        created_at: new Date().toISOString(),
        created_by: userId,
        normalized_from_legacy: true,
      });
    }

    await batch.commit();
    await addHistoryEntry(chapterId, userId, `Normalized ${mcqs.length} MCQs from legacy format`);

    return { success: true, count: mcqs.length };
  } catch (error) {
    console.error('Error normalizing MCQs:', error);
    return { success: false, count: 0, error: String(error) };
  }
};

// ============================================
// SKYBOX UPDATES
// ============================================

export const updateSkybox = async (options: {
  chapterId: string;
  versionId: string;
  topicId: string;
  sceneVersionId?: string;
  skyboxId: string;
  skyboxUrl: string;
  skyboxRemixId?: string;
  userId: string;
}): Promise<void> => {
  const {
    chapterId,
    topicId,
    skyboxId,
    skyboxRemixId,
    userId,
  } = options;

  // Get the chapter document
  const chapterRef = doc(db, COLLECTION_NAME, chapterId);
  const chapterSnap = await getDoc(chapterRef);
  
  if (!chapterSnap.exists()) {
    throw new Error('Chapter not found');
  }
  
  const chapter = chapterSnap.data() as CurriculumChapter;
  const topicIndex = chapter.topics?.findIndex((t) => t.topic_id === topicId);
  
  if (topicIndex === undefined || topicIndex === -1) {
    throw new Error('Topic not found');
  }
  
  // Update the topic with skybox
  const updatedTopics = [...chapter.topics];
  const currentSkyboxIds = updatedTopics[topicIndex].skybox_ids || [];
  
  updatedTopics[topicIndex] = {
    ...updatedTopics[topicIndex],
    skybox_id: skyboxId,
    skybox_ids: [...currentSkyboxIds, skyboxId],
    status: 'generated',
    generatedAt: new Date().toISOString(),
  };
  
  await updateDoc(chapterRef, {
    topics: updatedTopics,
    updatedAt: serverTimestamp(),
  });
  
  const summary = skyboxRemixId ? 'Skybox remixed' : 'Skybox updated';
  await addHistoryEntry(chapterId, userId, summary);
};

// ============================================
// HISTORY
// ============================================

const addHistoryEntry = async (
  chapterId: string,
  userId: string,
  changeSummary: string
): Promise<void> => {
  try {
    const historyRef = collection(db, COLLECTION_NAME, chapterId, 'history');
    await addDoc(historyRef, {
      updated_at: new Date().toISOString(),
      updated_by: userId,
      change_summary: changeSummary,
    });
  } catch (error) {
    // History is optional, don't fail the main operation
    console.warn('Failed to add history entry:', error);
  }
};

const generateChangeSummary = (changes: Record<string, unknown>): string => {
  const fields = Object.keys(changes);
  if (fields.length === 0) return 'No changes';
  if (fields.length === 1) return `Updated ${fields[0]}`;
  if (fields.length <= 3) return `Updated ${fields.join(', ')}`;
  return `Updated ${fields.slice(0, 3).join(', ')} and ${fields.length - 3} more fields`;
};

// ============================================
// VERSION MANAGEMENT
// ============================================

export const createNewVersion = async (options: {
  chapterId: string;
  fromVersionId: string;
  newVersionId: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> => {
  // In the flat structure, versioning would require duplicating the document
  console.log('Version creation not implemented for flat structure');
  return { success: false, error: 'Not implemented' };
};
