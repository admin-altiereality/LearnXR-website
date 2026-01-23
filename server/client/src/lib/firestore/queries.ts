// Firestore Query Helpers for Curriculum Content Editor
// Updated to use NEW Firestore collections:
// - meshy_assets: 3D models from Meshy
// - chapter_mcqs: MCQ question sets per chapter
// - chapter_tts: TTS audio files per chapter
// - chapter_images: Educational images per chapter
// - skybox_glb_urls: Skybox GLB file URLs

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
  MeshyAsset,
  ChapterMCQ,
  ChapterTTS,
  ChapterImage,
  SkyboxGLBUrl,
  TopicResources,
  Image3DAsset,
  ChapterResourceIds,
  TopicResourceIds,
  LanguageCode,
  AvatarScripts,
} from '../../types/curriculum';
import type { CurriculumChapter, Topic as FirebaseTopic } from '../../types/firebase';

// ============================================
// NEW COLLECTION NAMES (must use these only)
// ============================================
const COLLECTION_MESHY_ASSETS = 'meshy_assets';
const COLLECTION_CHAPTER_MCQS = 'chapter_mcqs';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const COLLECTION_CHAPTER_IMAGES = 'chapter_images';
const COLLECTION_SKYBOX_GLB_URLS = 'skybox_glb_urls';

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

// ============================================
// CHAPTER RESOURCE IDS
// Get the ID arrays from curriculum_chapters document
// ============================================

/**
 * Get chapter resource IDs and inline data
 * This fetches the mcq_ids, tts_ids, image_ids, meshy_asset_ids arrays
 * as well as the inline image3dasset map
 */
export interface ChapterWithResourceIds {
  chapter_id: string;
  mcq_ids: string[];
  tts_ids: string[];
  image_ids: string[];
  meshy_asset_ids: string[];
  image3dasset?: Image3DAsset;
  topics: Array<{
    topic_id: string;
    topic_name: string;
    mcq_ids?: string[];
    tts_ids?: string[];
    meshy_asset_ids?: string[];
  }>;
}

export const getChapterResourceIds = async (
  chapterId: string
): Promise<ChapterWithResourceIds | null> => {
  try {
    console.log('📦 Fetching chapter resource IDs:', chapterId);
    
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const snapshot = await getDoc(chapterRef);
    
    if (!snapshot.exists()) {
      console.warn('❌ Chapter not found:', chapterId);
      return null;
    }
    
    const data = snapshot.data();
    
    // Extract image3dasset if present (check sharedAssets first, then legacy)
    let image3dAsset: Image3DAsset | undefined;
    const image3dSource = data.sharedAssets?.image3dasset || data.image3dasset;
    if (image3dSource) {
      const img3d = image3dSource;
      image3dAsset = {
        imageasset_id: img3d.imageasset_id || '',
        imageasset_name: img3d.imageasset_name || 'image_to_3d_asset',
        imageasset_url: img3d.imageasset_url || img3d.imagemodel_glb || '',
        imagemodel_fbx: img3d.imagemodel_fbx,
        imagemodel_glb: img3d.imagemodel_glb,
        imagemodel_usdz: img3d.imagemodel_usdz,
        ai_selection_reasoning: img3d.ai_selection_reasoning,
        ai_selection_score: img3d.ai_selection_score,
        completed: img3d.completed,
        status: img3d.status,
        source_image: img3d.source_image,
      };
    }
    
    // Extract resource IDs: Check sharedAssets first, then fallback to legacy fields
    // Merge both sources to ensure we don't lose any data
    // Images are chapter-level
    const sharedImageIds = Array.isArray(data.sharedAssets?.image_ids) ? data.sharedAssets.image_ids : [];
    const legacyImageIds = Array.isArray(data.image_ids) ? data.image_ids : [];
    // Merge: sharedAssets first (priority), then legacy
    const imageIds = [...new Set([...sharedImageIds, ...legacyImageIds])];
    
    // Meshy assets are topic-level, but we'll extract them per topic below
    // Chapter-level meshy_asset_ids are used as fallback
    const sharedChapterMeshyIds = Array.isArray(data.sharedAssets?.meshy_asset_ids) ? data.sharedAssets.meshy_asset_ids : [];
    const legacyChapterMeshyIds = Array.isArray(data.meshy_asset_ids) ? data.meshy_asset_ids : [];
    // Merge: sharedAssets first (priority), then legacy
    const chapterMeshyAssetIds = [...new Set([...sharedChapterMeshyIds, ...legacyChapterMeshyIds])];
    
    const result: ChapterWithResourceIds = {
      chapter_id: chapterId,
      mcq_ids: data.mcq_ids || [], // MCQs are language-specific, handled separately
      tts_ids: data.tts_ids || [], // TTS are language-specific, handled separately
      image_ids: imageIds, // Use sharedAssets or legacy
      meshy_asset_ids: chapterMeshyAssetIds, // Use sharedAssets or legacy (chapter-level fallback)
      image3dasset: image3dAsset,
      topics: (data.topics || []).map((t: FirebaseTopic) => {
        // For topics, check sharedAssets first, then legacy fields
        // Merge both sources to ensure we don't lose any data
        const topicSharedMeshyIds = Array.isArray(t.sharedAssets?.meshy_asset_ids) 
          ? t.sharedAssets.meshy_asset_ids 
          : (Array.isArray(t.sharedAssets?.asset_ids) ? t.sharedAssets.asset_ids : []);
        const topicLegacyMeshyIds = [
          ...(Array.isArray(t.meshy_asset_ids) ? t.meshy_asset_ids : []),
          ...(Array.isArray(t.asset_ids) ? t.asset_ids : []),
        ];
        // Merge: sharedAssets first (priority), then legacy
        const topicMeshyIds = [...new Set([...topicSharedMeshyIds, ...topicLegacyMeshyIds])];
        
        return {
          topic_id: t.topic_id,
          topic_name: t.topic_name,
          mcq_ids: t.mcq_ids || [], // Language-specific, handled separately
          tts_ids: t.tts_ids || [], // Language-specific, handled separately
          meshy_asset_ids: topicMeshyIds, // Merged from sharedAssets and legacy
        };
      }),
    };
    
    console.log('✅ Chapter resource IDs loaded:', {
      hasSharedAssets: !!data.sharedAssets,
      image_ids: {
        fromShared: sharedImageIds?.length || 0,
        fromLegacy: legacyImageIds?.length || 0,
        final: result.image_ids.length,
      },
      meshy_asset_ids: {
        fromShared: sharedChapterMeshyIds?.length || 0,
        fromLegacy: legacyChapterMeshyIds?.length || 0,
        final: result.meshy_asset_ids.length,
      },
      mcq_ids: result.mcq_ids.length,
      tts_ids: result.tts_ids.length,
      hasImage3d: !!result.image3dasset,
      topics: result.topics.length,
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error fetching chapter resource IDs:', error);
    return null;
  }
};

/**
 * Get topic-specific resource IDs from the chapter document
 */
export const getTopicResourceIds = async (
  chapterId: string,
  topicId: string
): Promise<TopicResourceIds & { image3dasset?: Image3DAsset } | null> => {
  try {
    const chapterData = await getChapterResourceIds(chapterId);
    if (!chapterData) return null;
    
    // Find the topic
    const topic = chapterData.topics.find((t) => t.topic_id === topicId);
    
    // Return topic-level IDs if they exist, otherwise fall back to chapter-level
    // Note: This function is used by getMeshyAssets, getChapterImages, etc.
    // It already gets data from getChapterResourceIds which handles sharedAssets
    return {
      mcq_ids: topic?.mcq_ids?.length ? topic.mcq_ids : chapterData.mcq_ids,
      tts_ids: topic?.tts_ids?.length ? topic.tts_ids : chapterData.tts_ids,
      image_ids: chapterData.image_ids, // Always chapter-level (already from sharedAssets or legacy)
      meshy_asset_ids: topic?.meshy_asset_ids?.length ? topic.meshy_asset_ids : chapterData.meshy_asset_ids, // Already from sharedAssets or legacy
      image3dasset: chapterData.image3dasset, // Already from sharedAssets or legacy
    };
  } catch (error) {
    console.error('Error fetching topic resource IDs:', error);
    return null;
  }
};

// ============================================
// NEW COLLECTION QUERIES
// These replace all legacy queries for resources
// ============================================

/**
 * Helper to get download URL from storage path with retry logic
 * Falls back to existing downloadUrl if storagePath is not available
 */
/**
 * Verify that a URL points to a valid GLB/GLTF file by checking Content-Type
 */
const verifyFileType = async (url: string): Promise<{ isValid: boolean; contentType?: string; error?: string }> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    
    // Check if it's a valid 3D model content type
    const isValid3DModel = contentType.includes('model/gltf') || 
                          contentType.includes('model/gltf-binary') ||
                          contentType.includes('application/octet-stream') ||
                          contentType.includes('model/');
    
    // Check if it's an image (should not be)
    const isImage = contentType.includes('image/');
    
    if (isImage) {
      return {
        isValid: false,
        contentType,
        error: `URL points to an image file (${contentType}), not a 3D model`
      };
    }
    
    if (!isValid3DModel && !contentType.includes('octet-stream')) {
      return {
        isValid: false,
        contentType,
        error: `Unexpected content type: ${contentType}. Expected 3D model file.`
      };
    }
    
    return { isValid: true, contentType };
  } catch (error) {
    // If verification fails (CORS, etc.), return valid but log warning
    console.warn('⚠️ Could not verify file type (may be CORS issue):', error);
    return { isValid: true }; // Assume valid if we can't verify
  }
};

const getAssetDownloadUrl = async (storagePath: string | undefined, existingUrl: string | undefined): Promise<string | null> => {
  // If we have storagePath, regenerate URL (more reliable)
  if (storagePath) {
    try {
      const { ref, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../../config/firebase');
      const storageRef = ref(storage, storagePath);
      const freshUrl = await getDownloadURL(storageRef);
      console.log(`✅ Regenerated download URL from storagePath: ${storagePath.substring(0, 50)}...`);
      
      // Verify the file type if it's a GLB file
      if (storagePath.toLowerCase().endsWith('.glb') || storagePath.toLowerCase().endsWith('.gltf')) {
        const verification = await verifyFileType(freshUrl);
        if (!verification.isValid) {
          console.error(`❌ File type verification failed: ${verification.error}`);
          console.error(`   Content-Type: ${verification.contentType}`);
          console.error(`   StoragePath: ${storagePath}`);
          // Still return the URL but log the error - let the viewer handle it
        } else {
          console.log(`✅ File type verified: ${verification.contentType || 'unknown'}`);
        }
      }
      
      return freshUrl;
    } catch (error) {
      console.warn(`⚠️ Failed to regenerate URL from storagePath ${storagePath}:`, error);
      // Fall back to existing URL if regeneration fails
      if (existingUrl) {
        console.log('📦 Using existing downloadUrl as fallback');
        return existingUrl;
      }
      return null;
    }
  }
  
  // If no storagePath, verify existing URL if available
  if (existingUrl) {
    // Quick verification for existing URLs (only for GLB files)
    const urlLower = existingUrl.toLowerCase();
    if (urlLower.includes('.glb') || urlLower.includes('.gltf')) {
      const verification = await verifyFileType(existingUrl);
      if (!verification.isValid) {
        console.error(`❌ Existing URL verification failed: ${verification.error}`);
        console.error(`   URL: ${existingUrl.substring(0, 100)}...`);
        // Still return it - let the viewer show the error
      }
    }
  }
  
  return existingUrl || null;
};

/**
 * Helper to convert meshy_assets document data to MeshyAsset interface
 * Handles various field naming conventions in the collection
 * Now includes storagePath support for reliable refetching
 */
const mapMeshyDocToAsset = async (docSnap: DocumentSnapshot, chapterId: string, topicId: string): Promise<MeshyAsset> => {
  const data = docSnap.data() || {};
  
  // Get storagePath for reliable refetching
  const storagePath = data.storagePath || data.storage_path;
  
  // Handle different field naming conventions for URLs
  const existingGlbUrl = data.glb_url || data.textured_model_glb || data.final_asset_url || data.asset_url || data.model_urls?.glb || '';
  const existingFbxUrl = data.fbx_url || data.textured_model_fbx || data.model_urls?.fbx;
  const existingUsdzUrl = data.usdz_url || data.textured_model_usdz || data.model_urls?.usdz;
  
  // Regenerate URLs from storagePath if available (for GLB - primary format)
  // Only regenerate if storagePath points to a GLB file
  let glbUrl = existingGlbUrl;
  
  // Check if storagePath is for a GLB file
  const isGlbFile = storagePath && (
    storagePath.toLowerCase().endsWith('.glb') || 
    storagePath.toLowerCase().includes('.glb?') ||
    storagePath.toLowerCase().includes('.glb&')
  );
  
  if (isGlbFile) {
    // Regenerate URL from storagePath for GLB files
    const regenerated = await getAssetDownloadUrl(storagePath, existingGlbUrl);
    if (regenerated) {
      glbUrl = regenerated;
      console.log(`✅ Using regenerated GLB URL from storagePath: ${storagePath}`);
    } else if (existingGlbUrl) {
      console.log(`⚠️ Failed to regenerate URL, using existing glb_url: ${existingGlbUrl.substring(0, 80)}...`);
      glbUrl = existingGlbUrl;
    }
  } else if (storagePath) {
    // storagePath exists but doesn't point to GLB - log warning
    console.warn(`⚠️ storagePath does not point to GLB file: ${storagePath}`);
    // Still use existing URL if available
    if (!existingGlbUrl) {
      console.warn(`⚠️ No existing glb_url and storagePath is not GLB - asset may not be loadable`);
    }
  }
  
  // Final validation: ensure we have a URL and it's not an image
  if (!glbUrl || glbUrl.trim() === '') {
    console.error(`❌ No GLB URL available for asset ${docSnap.id}. storagePath: ${storagePath}, existingGlbUrl: ${existingGlbUrl ? 'exists' : 'missing'}`);
    // Return empty string - caller should handle this
    glbUrl = '';
  } else {
    // Check if URL might be pointing to an image (common mistake)
    const urlLower = glbUrl.toLowerCase();
    const isImageUrl = urlLower.includes('thumbnail') || 
                      urlLower.includes('preview') ||
                      urlLower.includes('.jpg') ||
                      urlLower.includes('.jpeg') ||
                      urlLower.includes('.png') ||
                      urlLower.includes('image');
    
    if (isImageUrl) {
      console.error(`❌ CRITICAL: Asset ${docSnap.id} has an image URL stored as glb_url: ${glbUrl.substring(0, 100)}...`);
      console.error(`   This is likely a data error. The asset may need to be re-uploaded.`);
      // Don't return image URL - return empty string instead
      glbUrl = '';
    }
  }
  
  // Log final URL for debugging
  if (glbUrl) {
    console.log(`✅ Final GLB URL for asset ${docSnap.id}: ${glbUrl.substring(0, 100)}...`);
  } else {
    console.warn(`⚠️ Asset ${docSnap.id} (${data.name || 'unnamed'}) has no valid GLB URL`);
  }
  
  return {
    id: docSnap.id,
    chapter_id: data.chapter_id || chapterId,
    topic_id: data.topic_id || topicId,
    name: data.name || data.prompt || 'Meshy 3D Asset',
    prompt: data.prompt,
    glb_url: glbUrl || '', // Ensure we always return a string
    fbx_url: existingFbxUrl,
    usdz_url: existingUsdzUrl,
    thumbnail_url: data.thumbnail_url || data.thumbnail || data.previewUrl,
    meshy_id: data.meshy_id || data.meshyId || data.asset_id,
    status: data.status === 'completed' ? 'complete' : (data.status || 'complete'),
    created_at: data.created_at || data.createdAt,
    updated_at: data.updated_at || data.updatedAt,
    metadata: {
      ...data.metadata,
      storagePath, // Include storagePath in metadata for future refetching
    },
  };
};

/**
 * Fetch 3D Meshy assets from meshy_assets collection using ID array
 * IDs in meshy_asset_ids match the `asset_id` FIELD in meshy_assets documents
 * Also includes inline image3dasset from chapter document
 */
export const getMeshyAssets = async (
  chapterId: string,
  topicId: string
): Promise<MeshyAsset[]> => {
  try {
    console.log('🔍 Fetching Meshy assets for chapter/topic:', { chapterId, topicId });
    
    const assets: MeshyAsset[] = [];
    
    // Step 1: Get the resource IDs and inline image3dasset from the chapter
    const resourceIds = await getTopicResourceIds(chapterId, topicId);
    
    // Step 2: Include inline image3dasset if present (image-to-3D converted models)
    if (resourceIds?.image3dasset && resourceIds.image3dasset.imageasset_url) {
      const img3d = resourceIds.image3dasset;
      console.log('📦 Found inline image3dasset:', img3d.imageasset_id);
      
      assets.push({
        id: img3d.imageasset_id || 'image3d_inline',
        chapter_id: chapterId,
        topic_id: topicId,
        name: img3d.imageasset_name || 'Image to 3D Asset',
        prompt: `Source: ${img3d.source_image?.url || 'PDF Image'}`,
        glb_url: img3d.imagemodel_glb || img3d.imageasset_url || '',
        fbx_url: img3d.imagemodel_fbx,
        usdz_url: img3d.imagemodel_usdz,
        thumbnail_url: img3d.source_image?.url,
        meshy_id: img3d.imageasset_id,
        status: img3d.status === 'SUCCEEDED' ? 'complete' : (img3d.completed ? 'complete' : 'pending'),
        metadata: {
          ai_selection_reasoning: img3d.ai_selection_reasoning,
          ai_selection_score: img3d.ai_selection_score,
          source: 'image3dasset',
        },
      });
    }
    
    // Step 3: Fetch from meshy_assets collection by asset_id field
    const meshyAssetIds = resourceIds?.meshy_asset_ids || [];
    
    if (meshyAssetIds.length > 0) {
      console.log('🎨 Meshy asset IDs from chapter:', meshyAssetIds);
      
      // Query by asset_id field (not document ID) - Firestore 'in' query
      // Note: 'in' query supports max 30 items, so we might need to batch
      const batchSize = 10; // Use smaller batch for 'in' queries
      
      for (let i = 0; i < meshyAssetIds.length; i += batchSize) {
        const batch = meshyAssetIds.slice(i, i + batchSize);
        
        try {
          const assetsRef = collection(db, COLLECTION_MESHY_ASSETS);
          const q = query(assetsRef, where('asset_id', 'in', batch));
          const snapshot = await getDocs(q);
          
          console.log(`📦 Batch query for asset_ids returned ${snapshot.docs.length} results`);
          
          // Map documents to assets (now async)
          const batchAssets = await Promise.all(
            snapshot.docs.map((docSnap) => mapMeshyDocToAsset(docSnap, chapterId, topicId))
          );
          assets.push(...batchAssets);
        } catch (batchErr) {
          console.warn('⚠️ Batch query failed, trying individual fetches:', batchErr);
          
          // Fallback: Try fetching by document ID (in case asset_id IS the doc ID)
          for (const assetId of batch) {
            try {
              const assetRef = doc(db, COLLECTION_MESHY_ASSETS, assetId);
              const assetSnap = await getDoc(assetRef);
              
              if (assetSnap.exists()) {
                const asset = await mapMeshyDocToAsset(assetSnap, chapterId, topicId);
                assets.push(asset);
              }
            } catch (err) {
              console.warn(`⚠️ Could not fetch asset ${assetId}:`, err);
            }
          }
        }
      }
    }
    
    // Step 4: Fallback - query by chapter_id/topic_id if no assets found yet
    if (assets.length === 0) {
      console.log('ℹ️ No assets from IDs, trying chapter_id/topic_id query...');
      
      const assetsRef = collection(db, COLLECTION_MESHY_ASSETS);
      const q = query(
        assetsRef,
        where('chapter_id', '==', chapterId),
        where('topic_id', '==', topicId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        console.log('✅ Found Meshy assets via chapter_id/topic_id query:', snapshot.docs.length);
        const fallbackAssets = await Promise.all(
          snapshot.docs.map((docSnap) => mapMeshyDocToAsset(docSnap, chapterId, topicId))
        );
        assets.push(...fallbackAssets);
      }
    }
    
    console.log('✅ Total Meshy assets loaded:', assets.length);
    return assets;
  } catch (error) {
    console.error('❌ Error fetching Meshy assets:', error);
    return [];
  }
};

/**
 * Fetch MCQs from chapter_mcqs collection using ID array
 * First gets mcq_ids from chapter/topic, then fetches those documents
 */
export const getChapterMCQs = async (
  chapterId: string,
  topicId: string
): Promise<ChapterMCQ[]> => {
  try {
    console.log('🔍 Fetching MCQs for chapter/topic:', { chapterId, topicId });
    
    // Step 1: Get the mcq_ids from the chapter document
    const resourceIds = await getTopicResourceIds(chapterId, topicId);
    
    if (!resourceIds || !resourceIds.mcq_ids || resourceIds.mcq_ids.length === 0) {
      console.log('ℹ️ No mcq_ids found in chapter/topic');
      
      // Fallback: Try query by chapter_id/topic_id (legacy approach)
      const mcqsRef = collection(db, COLLECTION_CHAPTER_MCQS);
      const q = query(
        mcqsRef,
        where('chapter_id', '==', chapterId),
        where('topic_id', '==', topicId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        console.log('✅ Found MCQs via chapter_id/topic_id query:', snapshot.docs.length);
        return snapshot.docs.map((docSnap, index) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            question: data.question || '',
            options: data.options || [],
            correct_option_index: data.correct_option_index ?? 0,
            explanation: data.explanation || '',
            difficulty: data.difficulty || 'medium',
            order: data.order ?? index,
            created_at: data.created_at,
            updated_at: data.updated_at,
            created_by: data.created_by,
          };
        });
      }
      
      return [];
    }
    
    console.log('📋 MCQ IDs from chapter:', resourceIds.mcq_ids);
    
    // Step 2: Fetch each MCQ document by ID
    const mcqs: ChapterMCQ[] = [];
    
    for (let i = 0; i < resourceIds.mcq_ids.length; i++) {
      const mcqId = resourceIds.mcq_ids[i];
      try {
        const mcqRef = doc(db, COLLECTION_CHAPTER_MCQS, mcqId);
        const mcqSnap = await getDoc(mcqRef);
        
        if (mcqSnap.exists()) {
          const data = mcqSnap.data();
          
          // Handle various field name variations for options
          let options: string[] = [];
          if (Array.isArray(data.options) && data.options.length > 0) {
            options = data.options;
          } else if (Array.isArray(data.choices)) {
            options = data.choices;
          } else if (Array.isArray(data.answers)) {
            options = data.answers;
          } else {
            // Try to extract options from individual fields (A, B, C, D format)
            const extractedOptions: string[] = [];
            ['option_a', 'option_b', 'option_c', 'option_d', 'optionA', 'optionB', 'optionC', 'optionD',
             'option1', 'option2', 'option3', 'option4', 'a', 'b', 'c', 'd'].forEach(key => {
              if (data[key]) extractedOptions.push(data[key]);
            });
            if (extractedOptions.length > 0) {
              options = extractedOptions;
            }
          }
          
          // Handle various field name variations for correct answer index
          let correctIndex = data.correct_option_index ?? data.correct_index ?? data.correctIndex ?? data.correct ?? 0;
          if (typeof correctIndex !== 'number') {
            correctIndex = parseInt(String(correctIndex), 10) || 0;
          }
          // Handle if correct answer is stored as a letter (A, B, C, D)
          if (typeof data.correct_answer === 'string' && data.correct_answer.length === 1) {
            const letterIndex = data.correct_answer.toUpperCase().charCodeAt(0) - 65;
            if (letterIndex >= 0 && letterIndex < options.length) {
              correctIndex = letterIndex;
            }
          }
          
          console.log(`📋 MCQ ${mcqId}:`, {
            question: (data.question || data.question_text || '').substring(0, 50),
            optionsCount: options.length,
            correctIndex,
          });
          
          mcqs.push({
            id: mcqSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            question: data.question || data.question_text || '',
            options: options,
            correct_option_index: correctIndex,
            explanation: data.explanation || data.explanation_text || '',
            difficulty: data.difficulty || 'medium',
            order: data.order ?? i,
            created_at: data.created_at,
            updated_at: data.updated_at,
            created_by: data.created_by,
          });
        } else {
          console.warn(`⚠️ MCQ document not found: ${mcqId}`);
        }
      } catch (err) {
        console.warn(`⚠️ Error fetching MCQ ${mcqId}:`, err);
      }
    }
    
    // Sort by order
    mcqs.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log('✅ Loaded MCQs by ID:', mcqs.length);
    return mcqs;
  } catch (error) {
    console.error('❌ Error fetching MCQs:', error);
    return [];
  }
};

/**
 * Fetch TTS audio from chapter_tts collection using ID array
 * First gets tts_ids from chapter/topic, then fetches those documents
 */
export const getChapterTTS = async (
  chapterId: string,
  topicId: string
): Promise<ChapterTTS[]> => {
  try {
    console.log('🔍 Fetching TTS for chapter/topic:', { chapterId, topicId });
    
    // Step 1: Get the tts_ids from the chapter document
    const resourceIds = await getTopicResourceIds(chapterId, topicId);
    
    if (!resourceIds || !resourceIds.tts_ids || resourceIds.tts_ids.length === 0) {
      console.log('ℹ️ No tts_ids found in chapter/topic');
      
      // Fallback: Try query by chapter_id/topic_id (legacy approach)
      const ttsRef = collection(db, COLLECTION_CHAPTER_TTS);
      const q = query(
        ttsRef,
        where('chapter_id', '==', chapterId),
        where('topic_id', '==', topicId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        console.log('✅ Found TTS via chapter_id/topic_id query:', snapshot.docs.length);
        return snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            script_type: data.script_type || 'full',
            script_text: data.script_text || data.text || '',
            audio_url: data.audio_url || data.url,
            duration_seconds: data.duration_seconds || data.duration,
            voice_id: data.voice_id,
            voice_name: data.voice_name,
            language: data.language || 'en',
            status: data.status || 'complete',
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        });
      }
      
      return [];
    }
    
    console.log('🎤 TTS IDs from chapter:', resourceIds.tts_ids);
    
    // Step 2: Fetch each TTS document by ID
    const ttsData: ChapterTTS[] = [];
    
    for (const ttsId of resourceIds.tts_ids) {
      try {
        const ttsRef = doc(db, COLLECTION_CHAPTER_TTS, ttsId);
        const ttsSnap = await getDoc(ttsRef);
        
        if (ttsSnap.exists()) {
          const data = ttsSnap.data();
          ttsData.push({
            id: ttsSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            script_type: data.script_type || 'full',
            script_text: data.script_text || data.text || '',
            audio_url: data.audio_url || data.url,
            duration_seconds: data.duration_seconds || data.duration,
            voice_id: data.voice_id,
            voice_name: data.voice_name,
            language: data.language || 'en',
            status: data.status || 'complete',
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        } else {
          console.warn(`⚠️ TTS document not found: ${ttsId}`);
        }
      } catch (err) {
        console.warn(`⚠️ Error fetching TTS ${ttsId}:`, err);
      }
    }
    
    console.log('✅ Loaded TTS by ID:', ttsData.length);
    return ttsData;
  } catch (error) {
    console.error('❌ Error fetching TTS:', error);
    return [];
  }
};

/**
 * Fetch images from chapter_images collection using ID array
 * First gets image_ids from chapter, then fetches those documents
 */
export const getChapterImages = async (
  chapterId: string,
  topicId: string
): Promise<ChapterImage[]> => {
  try {
    console.log('🔍 Fetching images for chapter/topic:', { chapterId, topicId });
    
    // Step 1: Get the image_ids from the chapter document
    const resourceIds = await getTopicResourceIds(chapterId, topicId);
    
    if (!resourceIds || !resourceIds.image_ids || resourceIds.image_ids.length === 0) {
      console.log('ℹ️ No image_ids found in chapter');
      
      // Fallback: Try query by chapter_id/topic_id (legacy approach)
      const imagesRef = collection(db, COLLECTION_CHAPTER_IMAGES);
      const q = query(
        imagesRef,
        where('chapter_id', '==', chapterId),
        where('topic_id', '==', topicId)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        console.log('✅ Found images via chapter_id/topic_id query:', snapshot.docs.length);
        return snapshot.docs.map((docSnap, index) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            name: data.name || `Image ${index + 1}`,
            description: data.description,
            image_url: data.image_url || data.url || '',
            thumbnail_url: data.thumbnail_url,
            type: data.type || 'other',
            order: data.order ?? index,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        });
      }
      
      return [];
    }
    
    console.log('🖼️ Image IDs from chapter:', resourceIds.image_ids);
    
    // Step 2: Fetch each image document by ID
    const images: ChapterImage[] = [];
    
    for (let i = 0; i < resourceIds.image_ids.length; i++) {
      const imageId = resourceIds.image_ids[i];
      try {
        const imageRef = doc(db, COLLECTION_CHAPTER_IMAGES, imageId);
        const imageSnap = await getDoc(imageRef);
        
        if (imageSnap.exists()) {
          const data = imageSnap.data();
          images.push({
            id: imageSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            name: data.name || `Image ${i + 1}`,
            description: data.description,
            image_url: data.image_url || data.url || '',
            thumbnail_url: data.thumbnail_url,
            type: data.type || 'other',
            order: data.order ?? i,
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        } else {
          console.warn(`⚠️ Image document not found: ${imageId}`);
        }
      } catch (err) {
        console.warn(`⚠️ Error fetching image ${imageId}:`, err);
      }
    }
    
    // Sort by order
    images.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    console.log('✅ Loaded images by ID:', images.length);
    return images;
  } catch (error) {
    console.error('❌ Error fetching images:', error);
    return [];
  }
};

/**
 * Fetch skybox GLB URLs from skybox_glb_urls collection
 * NEW collection for skybox GLB file URLs
 */
export const getSkyboxGLBUrls = async (
  chapterId: string,
  topicId: string
): Promise<SkyboxGLBUrl[]> => {
  try {
    console.log('🔍 Fetching skybox GLB URLs from new collection:', { chapterId, topicId });
    
    const skyboxRef = collection(db, COLLECTION_SKYBOX_GLB_URLS);
    const q = query(
      skyboxRef,
      where('chapter_id', '==', chapterId),
      where('topic_id', '==', topicId)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('ℹ️ No skybox GLB URLs found in skybox_glb_urls collection');
      return [];
    }
    
    const skyboxUrls: SkyboxGLBUrl[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        chapter_id: data.chapter_id || chapterId,
        topic_id: data.topic_id || topicId,
        skybox_id: data.skybox_id,
        glb_url: data.glb_url || data.url || '',
        preview_url: data.preview_url || data.imageUrl,
        prompt_used: data.prompt_used || data.prompt,
        style_id: data.style_id,
        style_name: data.style_name,
        status: data.status || 'complete',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    });
    
    console.log('✅ Loaded skybox GLB URLs:', skyboxUrls.length);
    return skyboxUrls;
  } catch (error) {
    console.error('❌ Error fetching skybox GLB URLs:', error);
    return [];
  }
};

/**
 * Fetch ALL resources for a topic from new collections
 * This is the primary function to use in the editor
 * Also fetches inline image3dAsset from the chapter document
 */
export const getTopicResources = async (
  chapterId: string,
  topicId: string
): Promise<TopicResources> => {
  console.log('📦 Fetching all topic resources from new collections:', { chapterId, topicId });
  
  try {
    // First get the resource IDs (which also fetches image3dAsset)
    const resourceIds = await getTopicResourceIds(chapterId, topicId);
    
    // Fetch all resources in parallel for performance
    const [meshyAssets, mcqs, ttsAudio, images, skyboxGLBUrls] = await Promise.all([
      getMeshyAssets(chapterId, topicId),
      getChapterMCQs(chapterId, topicId),
      getChapterTTS(chapterId, topicId),
      getChapterImages(chapterId, topicId),
      getSkyboxGLBUrls(chapterId, topicId),
    ]);
    
    console.log('✅ All topic resources loaded:', {
      meshyAssets: meshyAssets.length,
      mcqs: mcqs.length,
      ttsAudio: ttsAudio.length,
      images: images.length,
      skyboxGLBUrls: skyboxGLBUrls.length,
      hasImage3dAsset: !!resourceIds?.image3dasset,
    });
    
    return {
      meshyAssets,
      mcqs,
      ttsAudio,
      images,
      skyboxGLBUrls,
      image3dAsset: resourceIds?.image3dasset,
      loading: false,
    };
  } catch (error) {
    console.error('❌ Error fetching topic resources:', error);
    return {
      meshyAssets: [],
      mcqs: [],
      ttsAudio: [],
      images: [],
      skyboxGLBUrls: [],
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to load resources',
    };
  }
};

/**
 * Real-time subscription for topic resources
 * Use this for live updates in the editor
 */
export const subscribeToTopicResources = (
  chapterId: string,
  topicId: string,
  callback: (resources: TopicResources) => void
): Unsubscribe => {
  const resources: TopicResources = {
    meshyAssets: [],
    mcqs: [],
    ttsAudio: [],
    images: [],
    skyboxGLBUrls: [],
    loading: true,
  };
  
  const unsubscribers: Unsubscribe[] = [];
  
  // Subscribe to meshy_assets
  const meshyRef = collection(db, COLLECTION_MESHY_ASSETS);
  const meshyQuery = query(meshyRef, where('chapter_id', '==', chapterId), where('topic_id', '==', topicId));
  unsubscribers.push(
    onSnapshot(meshyQuery, (snapshot) => {
      resources.meshyAssets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MeshyAsset));
      resources.loading = false;
      callback({ ...resources });
    })
  );
  
  // Subscribe to chapter_mcqs
  const mcqsRef = collection(db, COLLECTION_CHAPTER_MCQS);
  const mcqsQuery = query(mcqsRef, where('chapter_id', '==', chapterId), where('topic_id', '==', topicId));
  unsubscribers.push(
    onSnapshot(mcqsQuery, (snapshot) => {
      resources.mcqs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChapterMCQ));
      callback({ ...resources });
    })
  );
  
  // Subscribe to chapter_tts
  const ttsRef = collection(db, COLLECTION_CHAPTER_TTS);
  const ttsQuery = query(ttsRef, where('chapter_id', '==', chapterId), where('topic_id', '==', topicId));
  unsubscribers.push(
    onSnapshot(ttsQuery, (snapshot) => {
      resources.ttsAudio = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChapterTTS));
      callback({ ...resources });
    })
  );
  
  // Subscribe to chapter_images
  const imagesRef = collection(db, COLLECTION_CHAPTER_IMAGES);
  const imagesQuery = query(imagesRef, where('chapter_id', '==', chapterId), where('topic_id', '==', topicId));
  unsubscribers.push(
    onSnapshot(imagesQuery, (snapshot) => {
      resources.images = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChapterImage));
      callback({ ...resources });
    })
  );
  
  // Subscribe to skybox_glb_urls
  const skyboxRef = collection(db, COLLECTION_SKYBOX_GLB_URLS);
  const skyboxQuery = query(skyboxRef, where('chapter_id', '==', chapterId), where('topic_id', '==', topicId));
  unsubscribers.push(
    onSnapshot(skyboxQuery, (snapshot) => {
      resources.skyboxGLBUrls = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SkyboxGLBUrl));
      callback({ ...resources });
    })
  );
  
  // Return a function that unsubscribes from all listeners
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
};

// ============================================
// LEGACY FUNCTION DEPRECATION NOTICE
// The following functions now route to new collections
// ============================================

/**
 * @deprecated Use getMeshyAssets instead
 * Legacy get3DAssets now fetches from meshy_assets collection
 */
export const get3DAssetsLegacy = getMeshyAssets;

/**
 * @deprecated Use getChapterMCQs instead  
 * Legacy getMCQs function - kept for backwards compatibility
 * Now fetches from chapter_mcqs collection
 */
export const getMCQsNew = getChapterMCQs;

// ============================================
// LANGUAGE-SPECIFIC QUERY FUNCTIONS
// ============================================

/**
 * Extract MCQ IDs for a specific language from topic or chapter
 * Handles inline MCQs in mcqs_by_language and language-specific ID arrays
 * Note: If inline MCQs are full objects (not IDs), this returns empty array
 * as getChapterMCQsByLanguage will handle them directly
 */
function extractMcqIdsForLanguage(
  topic: FirebaseTopic,
  chapter: CurriculumChapter,
  language: LanguageCode
): string[] {
  // Priority 1: Check for inline MCQs in topic.mcqs_by_language[language]
  // If they are full objects (have 'question' field), return empty - they'll be handled directly
  const inlineMcqs = (topic as any).mcqs_by_language?.[language];
  if (inlineMcqs && Array.isArray(inlineMcqs) && inlineMcqs.length > 0) {
    // If first item is a full MCQ object (has 'question'), return empty - handled directly
    if (typeof inlineMcqs[0] === 'object' && inlineMcqs[0].question) {
      return []; // Full objects are handled in getChapterMCQsByLanguage
    }
    // If first item is a string (ID), return the IDs
    if (typeof inlineMcqs[0] === 'string') {
      return inlineMcqs;
    }
    // If first item has question_id but no question, extract IDs
    if (typeof inlineMcqs[0] === 'object' && inlineMcqs[0].question_id) {
      return inlineMcqs.map((mcq: any) => mcq.question_id || mcq.id).filter(Boolean);
    }
  }
  
  // Priority 2: Check topic-level language-specific IDs
  if (topic.mcq_ids_by_language?.[language]?.length) {
    return topic.mcq_ids_by_language[language];
  }
  
  // Priority 3: Check chapter-level language-specific IDs
  if (chapter.mcq_ids_by_language?.[language]?.length) {
    return chapter.mcq_ids_by_language[language];
  }
  
  // Priority 4: Filter legacy IDs by language pattern (for English, use all; for Hindi, filter _hi)
  if (language === 'hi') {
    const allIds = [...(topic.mcq_ids || []), ...(chapter.mcq_ids || [])];
    return allIds.filter(id => id.includes('_hi') || id.includes('_HI'));
  }
  
  // For English, return all non-Hindi IDs
  const allIds = [...(topic.mcq_ids || []), ...(chapter.mcq_ids || [])];
  return allIds.filter(id => !id.includes('_hi') && !id.includes('_HI'));
}

/**
 * Extract avatar scripts for a specific language from topic
 */
export function extractTopicScriptsForLanguage(
  topic: FirebaseTopic,
  language: LanguageCode
): AvatarScripts {
  // Priority 1: topic_avatar_scripts[language] (NEW schema - matches mock data)
  const topicAvatarScripts = (topic as any).topic_avatar_scripts?.[language];
  if (topicAvatarScripts && typeof topicAvatarScripts === 'object') {
    return {
      intro: topicAvatarScripts.intro || '',
      explanation: topicAvatarScripts.explanation || '',
      outro: topicAvatarScripts.outro || '',
    };
  }
  
  // Priority 2: avatar_scripts_by_language[language] (alternative naming)
  if (topic.avatar_scripts_by_language?.[language]) {
    const scripts = topic.avatar_scripts_by_language[language];
    return {
      intro: scripts.intro || '',
      explanation: scripts.explanation || '',
      outro: scripts.outro || '',
    };
  }
  
  // Priority 3: Legacy fields (only for English)
  if (language === 'en') {
    return {
      intro: topic.topic_avatar_intro || '',
      explanation: topic.topic_avatar_explanation || '',
      outro: topic.topic_avatar_outro || '',
    };
  }
  
  return { intro: '', explanation: '', outro: '' };
}

/**
 * Fetch language-specific MCQs for a chapter/topic
 * Handles inline MCQs in mcqs_by_language and language-specific ID arrays
 */
export const getChapterMCQsByLanguage = async (
  chapterId: string,
  topicId: string,
  language: LanguageCode
): Promise<ChapterMCQ[]> => {
  try {
    console.log(`🔍 Fetching MCQs for ${language} language:`, { chapterId, topicId });
    
    // Fetch chapter document to check for inline MCQs
    const chapterRef = doc(db, COLLECTION_NAME, chapterId);
    const chapterSnap = await getDoc(chapterRef);
    
    if (!chapterSnap.exists()) {
      console.warn('❌ Chapter not found:', chapterId);
      return [];
    }
    
    const chapterData = chapterSnap.data() as CurriculumChapter;
    const topic = chapterData.topics?.find(t => t.topic_id === topicId);
    
    if (!topic) {
      console.warn('❌ Topic not found:', topicId);
      return [];
    }
    
    // Priority 1: Check for inline MCQs in mcqs_by_language[language]
    const inlineMcqs = (topic as any).mcqs_by_language?.[language];
    if (inlineMcqs && Array.isArray(inlineMcqs) && inlineMcqs.length > 0) {
      // Check if first item is a full MCQ object (has 'question' field)
      const firstItem = inlineMcqs[0];
      if (typeof firstItem === 'object' && firstItem !== null && 'question' in firstItem) {
        console.log(`✅ Found ${inlineMcqs.length} inline MCQs for ${language}`);
        return inlineMcqs.map((mcq: any, index: number) => {
          // Comprehensive options extraction (matching bundle logic)
          let options: string[] = [];
          // Priority 1: Check for options array
          if (Array.isArray(mcq.options) && mcq.options.length > 0) {
            options = mcq.options;
          }
          // Priority 2: Check for choices array
          else if (Array.isArray(mcq.choices) && mcq.choices.length > 0) {
            options = mcq.choices;
          }
          // Priority 3: Check for answers array
          else if (Array.isArray(mcq.answers) && mcq.answers.length > 0) {
            options = mcq.answers;
          }
          // Priority 4: Extract from individual fields (option_a, option_b, etc.)
          else {
            const extractedOptions: string[] = [];
            const optionFields = [
              'option_a', 'option_b', 'option_c', 'option_d',
              'optionA', 'optionB', 'optionC', 'optionD',
              'option1', 'option2', 'option3', 'option4',
              'a', 'b', 'c', 'd',
              'option_1', 'option_2', 'option_3', 'option_4',
            ];
            optionFields.forEach(key => {
              if (mcq[key]) extractedOptions.push(String(mcq[key]));
            });
            if (extractedOptions.length > 0) {
              options = extractedOptions;
            }
          }
          
          // Comprehensive correct index extraction (matching bundle logic)
          let correctIndex = mcq.correct_option_index ?? mcq.correct_index ?? mcq.correctIndex ?? mcq.correct ?? 0;
          if (typeof correctIndex !== 'number') {
            const parsed = parseInt(String(correctIndex), 10);
            if (!isNaN(parsed)) {
              correctIndex = parsed;
            } else {
              // Check if correct answer is stored as a letter (A, B, C, D)
              if (typeof mcq.correct_answer === 'string' && mcq.correct_answer.length === 1) {
                const letterIndex = mcq.correct_answer.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
                if (letterIndex >= 0 && letterIndex < options.length) {
                  correctIndex = letterIndex;
                }
              }
              // Check correct_option_text and find matching index
              else if (mcq.correct_option_text && options.length > 0) {
                const index = options.findIndex(opt => opt === mcq.correct_option_text);
                if (index >= 0) {
                  correctIndex = index;
                }
              }
            }
          }
          // Ensure correctIndex is within bounds
          if (options.length > 0) {
            if (correctIndex < 0) correctIndex = 0;
            if (correctIndex >= options.length) correctIndex = options.length - 1;
          }
          
          return {
            id: mcq.question_id || mcq.id || `inline_${language}_${index}`,
            chapter_id: chapterId,
            topic_id: topicId,
            question: mcq.question || mcq.question_text || '',
            options: options,
            correct_option_index: correctIndex,
            explanation: mcq.explanation || mcq.explanation_text || '',
            difficulty: (mcq.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
            order: mcq.order ?? index,
            created_at: mcq.created_at,
            updated_at: mcq.updated_at,
          };
        });
      }
    }
    
    // Priority 2: Extract language-specific MCQ IDs
    const mcqIds = extractMcqIdsForLanguage(topic, chapterData, language);
    
    if (mcqIds.length === 0) {
      console.log(`ℹ️ No MCQ IDs found for ${language}`);
      return [];
    }
    
    console.log(`📋 MCQ IDs for ${language}:`, mcqIds);
    
    // Fetch each MCQ document by ID
    const mcqs: ChapterMCQ[] = [];
    
    for (const mcqId of mcqIds) {
      try {
        const mcqRef = doc(db, COLLECTION_CHAPTER_MCQS, mcqId);
        const mcqSnap = await getDoc(mcqRef);
        
        if (mcqSnap.exists()) {
          const data = mcqSnap.data();
          
          // Comprehensive options extraction (matching bundle logic)
          let options: string[] = [];
          // Priority 1: Check for options array
          if (Array.isArray(data.options) && data.options.length > 0) {
            options = data.options;
          }
          // Priority 2: Check for choices array
          else if (Array.isArray(data.choices) && data.choices.length > 0) {
            options = data.choices;
          }
          // Priority 3: Check for answers array
          else if (Array.isArray(data.answers) && data.answers.length > 0) {
            options = data.answers;
          }
          // Priority 4: Extract from individual fields (option_a, option_b, etc.)
          else {
            const extractedOptions: string[] = [];
            const optionFields = [
              'option_a', 'option_b', 'option_c', 'option_d',
              'optionA', 'optionB', 'optionC', 'optionD',
              'option1', 'option2', 'option3', 'option4',
              'a', 'b', 'c', 'd',
              'option_1', 'option_2', 'option_3', 'option_4',
            ];
            optionFields.forEach(key => {
              if (data[key]) extractedOptions.push(String(data[key]));
            });
            if (extractedOptions.length > 0) {
              options = extractedOptions;
            }
          }
          
          // Comprehensive correct index extraction (matching bundle logic)
          let correctIndex = data.correct_option_index ?? data.correct_index ?? data.correctIndex ?? data.correct ?? 0;
          if (typeof correctIndex !== 'number') {
            const parsed = parseInt(String(correctIndex), 10);
            if (!isNaN(parsed)) {
              correctIndex = parsed;
            } else {
              // Check if correct answer is stored as a letter (A, B, C, D)
              if (typeof data.correct_answer === 'string' && data.correct_answer.length === 1) {
                const letterIndex = data.correct_answer.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
                if (letterIndex >= 0 && letterIndex < options.length) {
                  correctIndex = letterIndex;
                }
              }
              // Check correct_option_text and find matching index
              else if (data.correct_option_text && options.length > 0) {
                const index = options.findIndex(opt => opt === data.correct_option_text);
                if (index >= 0) {
                  correctIndex = index;
                }
              }
            }
          }
          // Ensure correctIndex is within bounds
          if (options.length > 0) {
            if (correctIndex < 0) correctIndex = 0;
            if (correctIndex >= options.length) correctIndex = options.length - 1;
          }
          
          mcqs.push({
            id: mcqSnap.id,
            chapter_id: data.chapter_id || chapterId,
            topic_id: data.topic_id || topicId,
            question: data.question || data.question_text || '',
            options: options,
            correct_option_index: correctIndex,
            explanation: data.explanation || data.explanation_text || '',
            difficulty: data.difficulty || 'medium',
            order: data.order ?? mcqs.length,
            created_at: data.created_at,
            updated_at: data.updated_at,
            created_by: data.created_by,
          });
        }
      } catch (err) {
        console.warn(`⚠️ Error fetching MCQ ${mcqId}:`, err);
      }
    }
    
    mcqs.sort((a, b) => (a.order || 0) - (b.order || 0));
    console.log(`✅ Loaded ${mcqs.length} MCQs for ${language}`);
    return mcqs;
  } catch (error) {
    console.error(`❌ Error fetching MCQs for ${language}:`, error);
    return [];
  }
};

/**
 * Fetch language-specific TTS audio for a chapter/topic
 * Filters TTS by language field
 */
export const getChapterTTSByLanguage = async (
  chapterId: string,
  topicId: string,
  language: LanguageCode
): Promise<ChapterTTS[]> => {
  try {
    console.log(`🔍 Fetching TTS for ${language} language:`, { chapterId, topicId });
    
    // Get all TTS first
    const allTTS = await getChapterTTS(chapterId, topicId);
    
    // Filter by language
    const filteredTTS = allTTS.filter(tts => {
      // If language field exists, use it
      if (tts.language) {
        return tts.language === language;
      }
      // For legacy data without language field, assume English
      return language === 'en';
    });
    
    console.log(`✅ Loaded ${filteredTTS.length} TTS files for ${language} (from ${allTTS.length} total)`);
    return filteredTTS;
  } catch (error) {
    console.error(`❌ Error fetching TTS for ${language}:`, error);
    return [];
  }
};
