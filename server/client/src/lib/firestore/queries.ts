// Firestore Query Helpers for Curriculum Content Editor
// Optimized for minimal reads - works with existing curriculum_chapters collection

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
  DocumentSnapshot,
  onSnapshot,
  Unsubscribe,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Chapter,
  ChapterVersion,
  Topic,
  Scene,
  MCQ,
  Curriculum,
  Class,
  Subject,
  FlattenedMCQ,
} from '../../types/curriculum';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../types/firebase';

const PAGE_SIZE = 50;
const COLLECTION_NAME = 'curriculum_chapters';

// ============================================
// CURRICULUM NAVIGATION QUERIES
// Works with existing flat curriculum_chapters collection
// ============================================

// Get unique curriculums from existing chapters
export const getCurriculums = async (): Promise<Curriculum[]> => {
  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(chaptersRef);
    
    // Extract unique curriculum values
    const curriculumSet = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CurriculumChapter;
      if (data.curriculum) {
        curriculumSet.add(data.curriculum.toUpperCase());
      }
    });
    
    // Convert to array and sort
    const curriculums = Array.from(curriculumSet)
      .sort()
      .map((name) => ({
        id: name,
        name: name,
      }));
    
    // If no data exists, provide default options
    if (curriculums.length === 0) {
      return [
        { id: 'CBSE', name: 'CBSE' },
        { id: 'RBSE', name: 'RBSE' },
      ];
    }
    
    return curriculums;
  } catch (error) {
    console.error('Error fetching curriculums:', error);
    // Return defaults on error
    return [
      { id: 'CBSE', name: 'CBSE' },
      { id: 'RBSE', name: 'RBSE' },
    ];
  }
};

// Get unique classes for a curriculum
export const getClasses = async (curriculumId: string): Promise<Class[]> => {
  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    const q = query(
      chaptersRef,
      where('curriculum', '==', curriculumId.toUpperCase())
    );
    const snapshot = await getDocs(q);
    
    // Extract unique class values
    const classSet = new Set<number>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CurriculumChapter;
      if (data.class) {
        classSet.add(data.class);
      }
    });
    
    // Convert to array and sort
    const classes = Array.from(classSet)
      .sort((a, b) => a - b)
      .map((grade) => ({
        id: grade.toString(),
        name: `Class ${grade}`,
        grade: grade,
      }));
    
    // If no data exists, provide default class options
    if (classes.length === 0) {
      return [6, 7, 8, 9, 10].map((grade) => ({
        id: grade.toString(),
        name: `Class ${grade}`,
        grade: grade,
      }));
    }
    
    return classes;
  } catch (error) {
    console.error('Error fetching classes:', error);
    // Return defaults on error
    return [6, 7, 8, 9, 10].map((grade) => ({
      id: grade.toString(),
      name: `Class ${grade}`,
      grade: grade,
    }));
  }
};

// Get unique subjects for a curriculum and class
export const getSubjects = async (
  curriculumId: string,
  classId: string
): Promise<Subject[]> => {
  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    const q = query(
      chaptersRef,
      where('curriculum', '==', curriculumId.toUpperCase()),
      where('class', '==', parseInt(classId))
    );
    const snapshot = await getDocs(q);
    
    // Extract unique subject values
    const subjectSet = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CurriculumChapter;
      if (data.subject) {
        subjectSet.add(data.subject);
      }
    });
    
    // Convert to array and sort
    const subjects = Array.from(subjectSet)
      .sort()
      .map((name) => ({
        id: name.replace(/\s+/g, '_'),
        name: name,
      }));
    
    // If no data exists, provide default subjects
    if (subjects.length === 0) {
      return [
        { id: 'Science', name: 'Science' },
        { id: 'Mathematics', name: 'Mathematics' },
        { id: 'Social_Science', name: 'Social Science' },
        { id: 'English', name: 'English' },
        { id: 'Hindi', name: 'Hindi' },
      ];
    }
    
    return subjects;
  } catch (error) {
    console.error('Error fetching subjects:', error);
    // Return defaults on error
    return [
      { id: 'Science', name: 'Science' },
      { id: 'Mathematics', name: 'Mathematics' },
    ];
  }
};

// ============================================
// CHAPTER QUERIES
// ============================================

export interface GetChaptersOptions {
  curriculumId: string;
  classId: string;
  subjectId: string;
  searchTerm?: string;
  lastDoc?: DocumentSnapshot;
  pageSize?: number;
}

export interface GetChaptersResult {
  chapters: Chapter[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export const getChapters = async (
  options: GetChaptersOptions
): Promise<GetChaptersResult> => {
  const { curriculumId, classId, subjectId, searchTerm, lastDoc, pageSize = PAGE_SIZE } = options;

  try {
    const chaptersRef = collection(db, COLLECTION_NAME);
    
    // Build query with filters
    const constraints: QueryConstraint[] = [
      where('curriculum', '==', curriculumId.toUpperCase()),
      where('class', '==', parseInt(classId)),
    ];
    
    // Subject might be stored with spaces or underscores
    const subjectName = subjectId.replace(/_/g, ' ');
    constraints.push(where('subject', '==', subjectName));
    
    const q = query(chaptersRef, ...constraints);
    const snapshot = await getDocs(q);
    
    // Map to Chapter interface
    let chapters: Chapter[] = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as CurriculumChapter;
      return {
        id: docSnapshot.id,
        chapter_number: data.chapter_number,
        chapter_name: data.chapter_name,
        current_version: 'v1', // Default version
        topic_count: data.topics?.length || 0,
        updated_at: data.updatedAt,
        curriculum_id: data.curriculum,
        class_id: data.class.toString(),
        subject_id: data.subject,
      };
    });
    
    // Sort by chapter number
    chapters.sort((a, b) => a.chapter_number - b.chapter_number);
    
    // Client-side search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      chapters = chapters.filter((ch) =>
        ch.chapter_name.toLowerCase().includes(term)
      );
    }
    
    // Apply pagination
    const hasMore = chapters.length > pageSize;
    if (hasMore) {
      chapters = chapters.slice(0, pageSize);
    }
    
    return {
      chapters,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return {
      chapters: [],
      lastDoc: null,
      hasMore: false,
    };
  }
};

export const getChapterById = async (chapterId: string): Promise<Chapter | null> => {
  try {
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data() as CurriculumChapter;
    return {
      id: snapshot.id,
      chapter_number: data.chapter_number,
      chapter_name: data.chapter_name,
      current_version: 'v1',
      topic_count: data.topics?.length || 0,
      updated_at: data.updatedAt,
      curriculum_id: data.curriculum,
      class_id: data.class.toString(),
      subject_id: data.subject,
    };
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return null;
  }
};

// Alias for compatibility
export const getChapterDirect = getChapterById;

// ============================================
// VERSION QUERIES
// In the flat structure, we simulate versions
// ============================================

export const getChapterVersions = async (
  chapterId: string
): Promise<ChapterVersion[]> => {
  // In the flat structure, chapters don't have explicit versions
  // Return a default "v1" version
  return [{
    id: 'v1',
    version: 'v1',
    status: 'active',
    created_at: new Date().toISOString(),
  }];
};

export const getActiveVersion = async (
  chapterId: string
): Promise<ChapterVersion | null> => {
  return {
    id: 'v1',
    version: 'v1',
    status: 'active',
    created_at: new Date().toISOString(),
  };
};

// ============================================
// TOPIC QUERIES
// Topics are stored inline in the chapter document
// ============================================

export const getTopics = async (
  chapterId: string,
  versionId: string
): Promise<Topic[]> => {
  try {
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);
    
    if (!snapshot.exists()) return [];
    
    const data = snapshot.data() as CurriculumChapter;
    const topics = data.topics || [];
    
    // Map to Topic interface
    return topics.map((t: FirebaseTopic, index: number) => ({
      id: t.topic_id || `topic_${index}`,
      topic_name: t.topic_name,
      topic_priority: t.topic_priority || index + 1,
      scene_type: t.scene_type as 'interactive' | 'narrative' | 'quiz' | 'exploration',
      has_scene: !!(t.skybox_id || t.skybox_ids?.length || t.asset_ids?.length),
      has_mcqs: false, // MCQs would need separate check
      last_updated: t.generatedAt,
    }));
  } catch (error) {
    console.error('Error fetching topics:', error);
    return [];
  }
};

// Real-time subscription for topic list
export const subscribeToTopics = (
  chapterId: string,
  versionId: string,
  callback: (topics: Topic[]) => void
): Unsubscribe => {
  const chapterRef = doc(db, COLLECTION_NAME, chapterId);
  
  return onSnapshot(chapterRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const data = snapshot.data() as CurriculumChapter;
    const topics = data.topics || [];
    
    const mappedTopics = topics.map((t: FirebaseTopic, index: number) => ({
      id: t.topic_id || `topic_${index}`,
      topic_name: t.topic_name,
      topic_priority: t.topic_priority || index + 1,
      scene_type: t.scene_type as 'interactive' | 'narrative' | 'quiz' | 'exploration',
      has_scene: !!(t.skybox_id || t.skybox_ids?.length || t.asset_ids?.length),
      has_mcqs: false,
      last_updated: t.generatedAt,
    }));
    
    callback(mappedTopics);
  });
};

export const getTopicById = async (
  chapterId: string,
  versionId: string,
  topicId: string
): Promise<Topic | null> => {
  try {
    const topics = await getTopics(chapterId, versionId);
    return topics.find((t) => t.id === topicId) || null;
  } catch (error) {
    console.error('Error fetching topic:', error);
    return null;
  }
};

// ============================================
// SCENE QUERIES
// Scene data is embedded in topic (in3d_prompt, skybox_id, etc.)
// ============================================

export const getScene = async (
  chapterId: string,
  versionId: string,
  topicId: string,
  sceneVersionId: string = 'current'
): Promise<Scene | null> => {
  return getCurrentScene(chapterId, versionId, topicId);
};

export const getCurrentScene = async (
  chapterId: string,
  versionId: string,
  topicId: string
): Promise<Scene | null> => {
  try {
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data() as CurriculumChapter;
    const topic = data.topics?.find((t) => t.topic_id === topicId);
    
    if (!topic) return null;
    
    console.log('📍 Topic data for scene:', {
      topic_id: topic.topic_id,
      skybox_id: topic.skybox_id,
      skybox_url: topic.skybox_url,
      in3d_prompt: topic.in3d_prompt?.substring(0, 50),
    });
    
    // Priority 1: Use skybox_url directly from topic (set by N8N workflow)
    let skyboxUrl = topic.skybox_url || '';
    
    // Priority 2: If no direct URL, try to fetch from skyboxes collection using skybox_id
    if (!skyboxUrl && topic.skybox_id) {
      try {
        console.log('🔍 Fetching skybox from collection:', topic.skybox_id);
        const skyboxRef = doc(db, 'skyboxes', topic.skybox_id);
        const skyboxSnap = await getDoc(skyboxRef);
        if (skyboxSnap.exists()) {
          const skyboxData = skyboxSnap.data();
          skyboxUrl = skyboxData?.imageUrl || skyboxData?.file_url || '';
          console.log('✅ Found skybox URL:', skyboxUrl?.substring(0, 50));
        } else {
          console.warn('❌ Skybox document not found:', topic.skybox_id);
        }
      } catch (skyboxError) {
        console.warn('Could not fetch skybox:', skyboxError);
      }
    }
    
    console.log('🖼️ Final skybox URL:', skyboxUrl?.substring(0, 80) || 'None');
    
    // Get asset URLs from topic
    const assetUrls = topic.asset_urls || [];
    const assetIds = topic.asset_ids || [];
    
    console.log('📦 Asset data:', { assetIds, assetUrls: assetUrls.length });
    
    // Build Scene from topic data
    // Map topic_avatar_* fields to avatar_* fields
    return {
      id: 'current',
      learning_objective: topic.learning_objective || '',
      in3d_prompt: topic.in3d_prompt || '',
      asset_list: topic.asset_list || [],
      camera_guidance: topic.camera_guidance || '',
      skybox_id: topic.skybox_id || '',
      skybox_url: skyboxUrl,
      avatar_intro: topic.topic_avatar_intro || '',
      avatar_explanation: topic.topic_avatar_explanation || '',
      avatar_outro: topic.topic_avatar_outro || '',
      status: topic.status === 'generated' ? 'published' : 'draft',
      updated_at: topic.generatedAt || data.updatedAt || '',
      updated_by: '',
      // Include 3D asset data
      generated_assets: assetUrls.map((url, idx) => ({
        id: assetIds[idx] || `asset_${idx}`,
        name: topic.asset_list?.[idx] || `Asset ${idx + 1}`,
        glb_url: url,
        thumbnail_url: '',
        status: 'complete',
      })),
    };
  } catch (error) {
    console.error('Error fetching scene:', error);
    return null;
  }
};

// ============================================
// MCQ QUERIES
// MCQs might be stored inline in topic, in a subcollection, or as flattened fields
// ============================================

export const getMCQs = async (
  chapterId: string,
  versionId: string,
  topicId: string
): Promise<MCQ[]> => {
  try {
    // First, check the main chapter document for inline MCQs in the topic
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const chapterSnapshot = await getDoc(chapterRef);
    
    if (chapterSnapshot.exists()) {
      const data = chapterSnapshot.data() as CurriculumChapter & { 
        topics: (Topic & { 
          mcqs?: MCQ[];
          [key: string]: unknown;
        })[] 
      };
      
      const topic = data.topics?.find((t) => t.topic_id === topicId);
      
      if (topic) {
        console.log('📝 Checking MCQs for topic:', topicId);
        
        // Check if MCQs are stored as array
        if (topic.mcqs && Array.isArray(topic.mcqs) && topic.mcqs.length > 0) {
          console.log('✅ Found MCQs array:', topic.mcqs.length);
          return topic.mcqs.map((mcq, index) => ({
            id: mcq.id || `mcq_${index}`,
            question: mcq.question,
            options: mcq.options,
            correct_option_index: mcq.correct_option_index,
            explanation: mcq.explanation || '',
            difficulty: mcq.difficulty || 'medium',
            order: index,
          }));
        }
        
        // Check for flattened MCQ format (mcq1_question, mcq1_option1, mcq1_option2, etc.)
        const flattenedMcqs: MCQ[] = [];
        for (let i = 1; i <= 10; i++) {
          const question = topic[`mcq${i}_question`] as string | undefined;
          if (question) {
            // Build options array from individual option fields
            const options: string[] = [];
            for (let j = 1; j <= 6; j++) {
              const option = topic[`mcq${i}_option${j}`] as string | undefined;
              if (option) {
                options.push(option);
              }
            }
            
            // Fallback to array format if individual options don't exist
            if (options.length === 0) {
              const optionsArray = topic[`mcq${i}_options`] as string[] | undefined;
              if (optionsArray && Array.isArray(optionsArray)) {
                options.push(...optionsArray);
              }
            }
            
            // Default to 4 empty options if nothing found
            while (options.length < 4) {
              options.push('');
            }
            
            // Get correct option index - handle both numeric and text-based matching
            let correctIndex = 0;
            const correctIndexVal = topic[`mcq${i}_correct_option_index`];
            const correctText = topic[`mcq${i}_correct_option_text`] as string | undefined;
            
            if (typeof correctIndexVal === 'number') {
              correctIndex = correctIndexVal;
            } else if (correctText && options.length > 0) {
              // Try to find the correct option by matching text
              const idx = options.findIndex(opt => opt === correctText);
              if (idx !== -1) {
                correctIndex = idx;
              }
            }
            
            flattenedMcqs.push({
              id: (topic[`mcq${i}_question_id`] as string) || `mcq_${i}`,
              question,
              options,
              correct_option_index: correctIndex,
              explanation: (topic[`mcq${i}_explanation`] as string) || '',
              difficulty: 'medium',
              order: i - 1,
            });
          }
        }
        
        if (flattenedMcqs.length > 0) {
          console.log('✅ Found flattened MCQs:', flattenedMcqs.length);
          return flattenedMcqs;
        }
      }
    }
    
    // Try subcollection as fallback
    try {
      const mcqsRef = collection(db, COLLECTION_NAME, chapterId, 'mcqs');
      const q = query(mcqsRef, where('topic_id', '==', topicId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.log('✅ Found MCQs in subcollection:', snapshot.docs.length);
        return snapshot.docs.map((docSnap, index) => ({
          id: docSnap.id,
          ...docSnap.data(),
          order: index,
        })) as MCQ[];
      }
    } catch (subCollectionError) {
      // Subcollection doesn't exist or isn't accessible, that's fine
      console.log('No MCQ subcollection found');
    }
    
    console.log('ℹ️ No MCQs found for topic:', topicId);
    return [];
  } catch (error) {
    console.error('Error fetching MCQs:', error);
    return [];
  }
};

// Check if topic has legacy flattened MCQs
export const checkForFlattenedMCQs = async (
  chapterId: string,
  versionId: string,
  topicId: string
): Promise<{ hasFlattened: boolean; count: number }> => {
  try {
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);
    
    if (!snapshot.exists()) return { hasFlattened: false, count: 0 };
    
    const data = snapshot.data();
    const topic = data.topics?.find((t: { topic_id: string }) => t.topic_id === topicId);
    
    if (!topic) return { hasFlattened: false, count: 0 };
    
    // Check for flattened MCQ format
    let count = 0;
    for (let i = 1; i <= 10; i++) {
      if (topic[`mcq${i}_question`]) {
        count++;
      }
    }
    
    return { hasFlattened: count > 0, count };
  } catch (error) {
    console.error('Error checking for flattened MCQs:', error);
    return { hasFlattened: false, count: 0 };
  }
};

// Extract flattened MCQs from topic document
export const extractFlattenedMCQs = (data: FlattenedMCQ): Omit<MCQ, 'id'>[] => {
  const mcqs: Omit<MCQ, 'id'>[] = [];
  
  for (let i = 1; i <= 10; i++) {
    const question = data[`mcq${i}_question`] as string | undefined;
    if (question) {
      mcqs.push({
        question,
        options: (data[`mcq${i}_options`] as string[]) || [],
        correct_option_index: (data[`mcq${i}_correct`] as number) || 0,
        explanation: (data[`mcq${i}_explanation`] as string) || '',
        difficulty: 'medium',
        order: i - 1,
      });
    }
  }
  
  return mcqs;
};

// ============================================
// SKYBOX QUERIES
// Fetches skybox data from skyboxes collection
// ============================================

export interface SkyboxData {
  id: string;
  imageUrl: string;
  file_url?: string;
  promptUsed: string;
  styleId?: number;
  styleName?: string;
  status: 'pending' | 'complete' | 'failed';
  createdAt?: string;
  title?: string;
  remix_id?: string;
  obfuscated_id?: string;
  depth_map_url?: string;
  thumb_url?: string;
}

export const getSkyboxById = async (skyboxId: string): Promise<SkyboxData | null> => {
  try {
    console.log('🔍 Fetching skybox from collection:', skyboxId);
    const skyboxRef = doc(db, 'skyboxes', skyboxId);
    const skyboxSnap = await getDoc(skyboxRef);
    
    if (!skyboxSnap.exists()) {
      console.warn('❌ Skybox document not found:', skyboxId);
      return null;
    }
    
    const data = skyboxSnap.data();
    console.log('✅ Found skybox data:', {
      id: skyboxId,
      hasImageUrl: !!data.imageUrl,
      hasFileUrl: !!data.file_url,
      status: data.status,
      promptLength: data.promptUsed?.length || data.prompt?.length || 0,
    });
    
    return {
      id: skyboxId,
      imageUrl: data.imageUrl || data.file_url || data.image || '',
      file_url: data.file_url || data.imageUrl || data.image || '',
      promptUsed: data.promptUsed || data.prompt || '',
      styleId: data.styleId || data.style_id,
      styleName: data.styleName || data.style_name || data.metadata?.style,
      status: data.status || 'complete',
      createdAt: data.createdAt,
      title: data.title,
      remix_id: data.remix_id || data.remixId,
      obfuscated_id: data.obfuscated_id || data.obfuscatedId,
      depth_map_url: data.depth_map_url || data.depthMapUrl,
      thumb_url: data.thumb_url || data.thumbUrl || data.thumbnail,
    };
  } catch (error) {
    console.error('Error fetching skybox:', error);
    return null;
  }
};

export const getTopicSkybox = async (
  chapterId: string,
  topicId: string
): Promise<SkyboxData | null> => {
  try {
    // Get the topic to find skybox_id
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const chapterSnap = await getDoc(chapterRef);
    
    if (!chapterSnap.exists()) return null;
    
    const data = chapterSnap.data() as CurriculumChapter;
    const topic = data.topics?.find((t) => t.topic_id === topicId);
    
    if (!topic) return null;
    
    console.log('📍 Topic skybox data:', {
      skybox_id: topic.skybox_id,
      skybox_url: topic.skybox_url?.substring(0, 50),
      in3d_prompt: topic.in3d_prompt?.substring(0, 50),
    });
    
    // If we have a direct URL, build a partial skybox data object
    if (topic.skybox_url) {
      return {
        id: topic.skybox_id || 'direct_url',
        imageUrl: topic.skybox_url,
        file_url: topic.skybox_url,
        promptUsed: topic.in3d_prompt || '',
        status: 'complete',
      };
    }
    
    // If we have a skybox_id, fetch from collection
    if (topic.skybox_id) {
      return await getSkyboxById(topic.skybox_id);
    }
    
    // No skybox data available
    return null;
  } catch (error) {
    console.error('Error fetching topic skybox:', error);
    return null;
  }
};

// ============================================
// 3D ASSETS QUERIES
// Fetches generated 3D assets from topic or subcollection
// ============================================

export interface Generated3DAsset {
  id: string;
  name: string;
  glb_url: string;
  fbx_url?: string;
  usdz_url?: string;
  thumbnail_url?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  created_at?: string;
  meshy_id?: string;
  prompt?: string;
}

export const get3DAssets = async (
  chapterId: string,
  topicId: string
): Promise<Generated3DAsset[]> => {
  try {
    // First, check the topic document for inline asset data
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const chapterSnapshot = await getDoc(chapterRef);
    
    if (chapterSnapshot.exists()) {
      const data = chapterSnapshot.data() as CurriculumChapter;
      const topic = data.topics?.find((t) => t.topic_id === topicId);
      
      if (topic) {
        const assetUrls = topic.asset_urls || [];
        const assetIds = topic.asset_ids || [];
        const assetList = topic.asset_list || [];
        
        // If we have asset URLs, build asset objects
        if (assetUrls.length > 0) {
          console.log('✅ Found 3D assets in topic:', assetUrls.length);
          return assetUrls.map((url, idx) => ({
            id: assetIds[idx] || `asset_${idx}`,
            name: assetList[idx] || `Asset ${idx + 1}`,
            glb_url: url,
            thumbnail_url: '',
            status: 'complete' as const,
          }));
        }
        
        // Check for asset_ids and fetch from 3d_assets collection
        if (assetIds.length > 0) {
          console.log('🔍 Fetching assets from 3d_assets collection:', assetIds);
          const assets: Generated3DAsset[] = [];
          
          for (const assetId of assetIds) {
            try {
              const assetRef = doc(db, '3d_assets', assetId);
              const assetSnap = await getDoc(assetRef);
              if (assetSnap.exists()) {
                const assetData = assetSnap.data();
                assets.push({
                  id: assetId,
                  name: assetData.name || assetData.prompt || 'Unnamed Asset',
                  glb_url: assetData.glb_url || assetData.model_urls?.glb || '',
                  fbx_url: assetData.fbx_url || assetData.model_urls?.fbx,
                  usdz_url: assetData.usdz_url || assetData.model_urls?.usdz,
                  thumbnail_url: assetData.thumbnail_url || assetData.thumbnail,
                  status: assetData.status || 'complete',
                  created_at: assetData.created_at || assetData.createdAt,
                  meshy_id: assetData.meshy_id || assetData.meshyId,
                  prompt: assetData.prompt,
                });
              }
            } catch (err) {
              console.warn('Failed to fetch asset:', assetId, err);
            }
          }
          
          return assets;
        }
      }
    }
    
    // Try subcollection as fallback
    try {
      const assetsRef = collection(db, COLLECTION_NAME, chapterId, '3d_assets');
      const q = query(assetsRef, where('topic_id', '==', topicId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        console.log('✅ Found 3D assets in subcollection:', snapshot.docs.length);
        return snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || data.prompt || 'Unnamed Asset',
            glb_url: data.glb_url || data.model_urls?.glb || '',
            fbx_url: data.fbx_url || data.model_urls?.fbx,
            usdz_url: data.usdz_url || data.model_urls?.usdz,
            thumbnail_url: data.thumbnail_url || data.thumbnail,
            status: data.status || 'complete',
            created_at: data.created_at || data.createdAt,
            meshy_id: data.meshy_id || data.meshyId,
            prompt: data.prompt,
          };
        });
      }
    } catch (subCollectionError) {
      console.log('No 3D assets subcollection found');
    }
    
    console.log('ℹ️ No 3D assets found for topic:', topicId);
    return [];
  } catch (error) {
    console.error('Error fetching 3D assets:', error);
    return [];
  }
};

// ============================================
// EDIT HISTORY QUERIES
// ============================================

export interface EditHistoryEntry {
  updated_at: string;
  updated_by: string;
  change_summary: string;
}

export const getEditHistory = async (
  chapterId: string,
  versionId: string,
  topicId: string,
  limitCount: number = 10
): Promise<EditHistoryEntry[]> => {
  // Check for history subcollection
  try {
    const historyRef = collection(db, COLLECTION_NAME, chapterId, 'history');
    const q = query(historyRef, orderBy('updated_at', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs.map((doc) => doc.data() as EditHistoryEntry);
    }
    
    // Fallback: return chapter's updatedAt
    const chapter = await getChapterById(chapterId);
    if (chapter?.updated_at) {
      return [{
        updated_at: chapter.updated_at,
        updated_by: 'System',
        change_summary: 'Chapter updated',
      }];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
};

// ============================================
// BATCH OPERATIONS
// ============================================

export const getChapterWithDetails = async (
  chapterId: string,
  versionId?: string
): Promise<{
  chapter: Chapter | null;
  versions: ChapterVersion[];
  currentVersion: ChapterVersion | null;
}> => {
  const [chapter, versions] = await Promise.all([
    getChapterById(chapterId),
    getChapterVersions(chapterId),
  ]);
  
  const currentVersion = versions[0] || null;
  
  return { chapter, versions, currentVersion };
};

// ============================================
// RAW DATA ACCESS (for editing)
// ============================================

export const getRawChapterData = async (
  chapterId: string
): Promise<CurriculumChapter | null> => {
  try {
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);
    
    if (!snapshot.exists()) return null;
    
    return snapshot.data() as CurriculumChapter;
  } catch (error) {
    console.error('Error fetching raw chapter data:', error);
    return null;
  }
};

export const getRawTopicData = async (
  chapterId: string,
  topicId: string
): Promise<FirebaseTopic | null> => {
  try {
    const chapter = await getRawChapterData(chapterId);
    if (!chapter) return null;
    
    return chapter.topics?.find((t) => t.topic_id === topicId) || null;
  } catch (error) {
    console.error('Error fetching raw topic data:', error);
    return null;
  }
};
