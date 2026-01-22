/**
 * Firestore Debug Fetch Functions
 * 
 * These functions fetch sample documents from each collection to help debug
 * data structure, language fields, and ID relationships.
 * 
 * Used by the Firestore Explorer Debug Screen to inspect raw data.
 */

import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Collection names
const COLLECTION_CURRICULUM_CHAPTERS = 'curriculum_chapters';
const COLLECTION_CHAPTER_MCQS = 'chapter_mcqs';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const COLLECTION_CHAPTER_AVATAR_SCRIPTS = 'chapter_avatar_scripts';
const COLLECTION_SKYBOXES = 'skyboxes';
const COLLECTION_PDFS = 'pdfs';
const COLLECTION_TEXT_TO_3D_ASSETS = 'text_to_3d_assets';

/**
 * Language field detection result
 */
export interface LanguageFieldAnalysis {
  totalDocs: number;
  docsWithEn: number;
  docsWithHi: number;
  languageFieldNames: string[];
  languageStructure: 'field' | 'nested' | 'array' | 'unknown';
  sampleStructure: any;
}

/**
 * Fetch sample curriculum chapters
 */
export async function fetchSampleCurriculumChapters(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching curriculum_chapters sample...');
    const chaptersRef = collection(db, COLLECTION_CURRICULUM_CHAPTERS);
    const q = query(chaptersRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] curriculum_chapters sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error) {
    console.error('[DEBUG] Error fetching curriculum_chapters:', error);
    throw error;
  }
}

/**
 * Fetch sample MCQs
 */
export async function fetchSampleMcqs(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching chapter_mcqs sample...');
    if (!db) {
      throw new Error('Firestore database not initialized');
    }
    const mcqsRef = collection(db, COLLECTION_CHAPTER_MCQS);
    const q = query(mcqsRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] chapter_mcqs sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error: any) {
    console.error('[DEBUG] Error fetching chapter_mcqs:', error);
    const errorMessage = error?.code === 'permission-denied' 
      ? 'Permission denied. Make sure you are authenticated and Firestore rules allow read access.'
      : error?.message || 'Unknown error';
    throw new Error(`Failed to fetch chapter_mcqs: ${errorMessage}`);
  }
}

/**
 * Fetch sample TTS documents
 */
export async function fetchSampleTts(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching chapter_tts sample...');
    if (!db) {
      throw new Error('Firestore database not initialized');
    }
    const ttsRef = collection(db, COLLECTION_CHAPTER_TTS);
    const q = query(ttsRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] chapter_tts sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error: any) {
    console.error('[DEBUG] Error fetching chapter_tts:', error);
    const errorMessage = error?.code === 'permission-denied' 
      ? 'Permission denied. Make sure you are authenticated and Firestore rules allow read access.'
      : error?.message || 'Unknown error';
    throw new Error(`Failed to fetch chapter_tts: ${errorMessage}`);
  }
}

/**
 * Fetch sample avatar scripts
 */
export async function fetchSampleAvatarScripts(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching chapter_avatar_scripts sample...');
    if (!db) {
      throw new Error('Firestore database not initialized');
    }
    const scriptsRef = collection(db, COLLECTION_CHAPTER_AVATAR_SCRIPTS);
    const q = query(scriptsRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] chapter_avatar_scripts sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error: any) {
    console.error('[DEBUG] Error fetching chapter_avatar_scripts:', error);
    const errorMessage = error?.code === 'permission-denied' 
      ? 'Permission denied. Make sure you are authenticated and Firestore rules allow read access.'
      : error?.message || 'Unknown error';
    throw new Error(`Failed to fetch chapter_avatar_scripts: ${errorMessage}`);
  }
}

/**
 * Fetch sample skyboxes
 */
export async function fetchSampleSkyboxes(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching skyboxes sample...');
    const skyboxesRef = collection(db, COLLECTION_SKYBOXES);
    const q = query(skyboxesRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] skyboxes sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error) {
    console.error('[DEBUG] Error fetching skyboxes:', error);
    throw error;
  }
}

/**
 * Fetch sample PDFs
 */
export async function fetchSamplePdfs(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching pdfs sample...');
    if (!db) {
      throw new Error('Firestore database not initialized');
    }
    const pdfsRef = collection(db, COLLECTION_PDFS);
    const q = query(pdfsRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] pdfs sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error: any) {
    console.error('[DEBUG] Error fetching pdfs:', error);
    const errorMessage = error?.code === 'permission-denied' 
      ? 'Permission denied. Make sure you are authenticated and Firestore rules allow read access.'
      : error?.message || 'Unknown error';
    throw new Error(`Failed to fetch pdfs: ${errorMessage}`);
  }
}

/**
 * Fetch sample 3D assets
 */
export async function fetchSample3dAssets(limitCount: number = 5): Promise<Array<{ id: string; data: any }>> {
  try {
    console.log('[DEBUG] Fetching text_to_3d_assets sample...');
    if (!db) {
      throw new Error('Firestore database not initialized');
    }
    const assetsRef = collection(db, COLLECTION_TEXT_TO_3D_ASSETS);
    const q = query(assetsRef, limit(limitCount));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    console.log(`[DEBUG] text_to_3d_assets sample: ${docs.length} docs`, docs);
    return docs;
  } catch (error: any) {
    console.error('[DEBUG] Error fetching text_to_3d_assets:', error);
    const errorMessage = error?.code === 'permission-denied' 
      ? 'Permission denied. Make sure you are authenticated and Firestore rules allow read access.'
      : error?.message || 'Unknown error';
    throw new Error(`Failed to fetch text_to_3d_assets: ${errorMessage}`);
  }
}

/**
 * Analyze language fields in a collection
 */
export function analyzeLanguageFields(
  docs: Array<{ id: string; data: any }>,
  collectionName: string
): LanguageFieldAnalysis {
  const analysis: LanguageFieldAnalysis = {
    totalDocs: docs.length,
    docsWithEn: 0,
    docsWithHi: 0,
    languageFieldNames: [],
    languageStructure: 'unknown',
    sampleStructure: null,
  };

  if (docs.length === 0) {
    return analysis;
  }

  const languageFields = new Set<string>();
  let hasNestedEn = false;
  let hasNestedHi = false;
  let hasArrayWithLang = false;
  let hasDirectLangField = false;

  for (const doc of docs) {
    const data = doc.data;
    
    // Check for direct language field
    if (data.language || data.lang) {
      hasDirectLangField = true;
      languageFields.add(data.language ? 'language' : 'lang');
      if (data.language === 'en' || data.lang === 'en') analysis.docsWithEn++;
      if (data.language === 'hi' || data.lang === 'hi') analysis.docsWithHi++;
    }

    // Check for nested language structure (e.g., content.en, content.hi)
    if (data.content?.en || data.content?.hi) {
      hasNestedEn = true;
      hasNestedHi = true;
      languageFields.add('content.en/hi');
    }

    // Check for intro/explanation/outro with language
    if (data.intro?.en || data.intro?.hi) {
      hasNestedEn = true;
      hasNestedHi = true;
      languageFields.add('intro.en/hi');
    }

    // Check for arrays with language objects
    if (Array.isArray(data.mcqs) || Array.isArray(data.scripts)) {
      const array = data.mcqs || data.scripts;
      for (const item of array) {
        if (item && typeof item === 'object') {
          if (item.language === 'en' || item.lang === 'en') {
            hasArrayWithLang = true;
            analysis.docsWithEn++;
          }
          if (item.language === 'hi' || item.lang === 'hi') {
            hasArrayWithLang = true;
            analysis.docsWithHi++;
          }
        }
      }
    }

    // Check for topic_avatar_scripts structure
    if (data.topic_avatar_scripts) {
      if (data.topic_avatar_scripts.en) {
        hasNestedEn = true;
        analysis.docsWithEn++;
      }
      if (data.topic_avatar_scripts.hi) {
        hasNestedHi = true;
        analysis.docsWithHi++;
      }
      languageFields.add('topic_avatar_scripts.en/hi');
    }

    // Check for mcqs_by_language structure
    if (data.mcqs_by_language) {
      if (data.mcqs_by_language.en) {
        hasNestedEn = true;
        analysis.docsWithEn++;
      }
      if (data.mcqs_by_language.hi) {
        hasNestedHi = true;
        analysis.docsWithHi++;
      }
      languageFields.add('mcqs_by_language.en/hi');
    }
  }

  analysis.languageFieldNames = Array.from(languageFields);

  // Determine structure type
  if (hasDirectLangField) {
    analysis.languageStructure = 'field';
  } else if (hasNestedEn || hasNestedHi) {
    analysis.languageStructure = 'nested';
  } else if (hasArrayWithLang) {
    analysis.languageStructure = 'array';
  }

  // Store sample structure from first doc
  if (docs.length > 0) {
    analysis.sampleStructure = {
      id: docs[0].id,
      hasLanguage: !!(docs[0].data.language || docs[0].data.lang),
      hasContentEn: !!docs[0].data.content?.en,
      hasContentHi: !!docs[0].data.content?.hi,
      hasMcqsByLanguage: !!docs[0].data.mcqs_by_language,
      hasAvatarScripts: !!docs[0].data.topic_avatar_scripts,
      keys: Object.keys(docs[0].data).slice(0, 20), // First 20 keys
    };
  }

  console.log(`[DEBUG] Language analysis for ${collectionName}:`, analysis);
  return analysis;
}

/**
 * Analyze all collections and return language field summary
 */
export async function analyzeAllCollections(): Promise<Record<string, LanguageFieldAnalysis>> {
  const results: Record<string, LanguageFieldAnalysis> = {};

  try {
    const [chapters, mcqs, tts, scripts, skyboxes, pdfs, assets3d] = await Promise.all([
      fetchSampleCurriculumChapters(10),
      fetchSampleMcqs(10),
      fetchSampleTts(10),
      fetchSampleAvatarScripts(10),
      fetchSampleSkyboxes(10),
      fetchSamplePdfs(10),
      fetchSample3dAssets(10),
    ]);

    results.curriculum_chapters = analyzeLanguageFields(chapters, 'curriculum_chapters');
    results.chapter_mcqs = analyzeLanguageFields(mcqs, 'chapter_mcqs');
    results.chapter_tts = analyzeLanguageFields(tts, 'chapter_tts');
    results.chapter_avatar_scripts = analyzeLanguageFields(scripts, 'chapter_avatar_scripts');
    results.skyboxes = analyzeLanguageFields(skyboxes, 'skyboxes');
    results.pdfs = analyzeLanguageFields(pdfs, 'pdfs');
    results.text_to_3d_assets = analyzeLanguageFields(assets3d, 'text_to_3d_assets');

    console.log('[DEBUG] Complete language analysis:', results);
    return results;
  } catch (error) {
    console.error('[DEBUG] Error analyzing collections:', error);
    throw error;
  }
}
