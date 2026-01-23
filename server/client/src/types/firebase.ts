import type { LanguageCode, AvatarScripts, AvatarScriptsByLanguage, IdsByLanguage } from './curriculum';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Skybox {
  id: string;
  userId: string;
  imageUrl: string;
  promptUsed: string;
  styleId: number;
  metadata: {
    theme?: string;
    location?: string;
    resolution?: string;
    style?: string;
  };
  createdAt: string;
  title?: string;
  status: 'pending' | 'complete' | 'failed';
  // Optional curriculum metadata (added when generated with avatar config)
  curriculum?: string; // e.g., "CBSE", "RBSE"
  class?: number; // e.g., 8
  subject?: string; // e.g., "Science"
}

/**
 * Image3DAsset - 3D models generated from images (stored inline in chapter)
 */
export interface Image3DAsset {
  imageasset_id: string;
  imageasset_name: string;
  imageasset_url: string;
  imagemodel_fbx?: string;
  imagemodel_glb?: string;
  imagemodel_usdz?: string;
  ai_selection_reasoning?: string;
  ai_selection_score?: number;
  completed?: boolean;
  status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  source_image?: {
    url: string;
    width?: number;
    height?: number;
    mime_type?: string;
    index?: number;
    page?: number | null;
  };
}

/**
 * Curriculum Chapter Schema
 * Represents a chapter within a curriculum, class, and subject
 * Document ID format: {curriculum}_{class}_{subject}_ch{chapter_number}
 * Example: "CBSE_8_Science_ch3"
 * 
 * UPDATED: Now includes multi-language support and approval gating
 */
export interface CurriculumChapter {
  curriculum: string; // e.g., "CBSE", "RBSE"
  class: number; // e.g., 8
  subject: string; // e.g., "Science"
  chapter_number: number; // e.g., 3
  chapter_name: string; // e.g., "Synthetic Fibres and Plastics"
  topics: Topic[];
  createdAt?: string; // Firestore timestamp
  updatedAt?: string; // Firestore timestamp
  
  // ============================================
  // APPROVAL FIELDS (NEW)
  // ============================================
  approved?: boolean; // Default false - only admin/superadmin can set true
  approvedAt?: string | null; // Timestamp when approved
  approvedBy?: string | null; // UID of admin who approved
  
  // ============================================
  // MULTI-LANGUAGE SUPPORT (NEW)
  // ============================================
  supported_languages?: LanguageCode[]; // e.g., ["en", "hi"]
  
  // ============================================
  // SHARED ASSETS (Language-independent)
  // Images, Skyboxes, 3D Assets, Text-to-3D Models are shared across all languages
  // ============================================
  sharedAssets?: {
    image_ids?: string[]; // References to chapter_images collection
    skybox_id?: string; // Reference to skyboxes collection (topic-level, but stored here for compatibility)
    meshy_asset_ids?: string[]; // References to meshy_assets collection
    text_to_3d_asset_ids?: string[]; // References to text_to_3d_assets collection
    skybox_glb_urls?: string[]; // Direct skybox GLB URLs
    meshy_glb_urls?: string[]; // Direct meshy GLB URLs
    image3dasset?: Image3DAsset; // Inline 3D asset from Meshy (generated from image)
  };
  
  // ============================================
  // LOCALIZED CONTENT (Language-specific)
  // MCQs, TTS, Avatar Scripts are language-specific
  // ============================================
  localized?: {
    [lang in LanguageCode]?: {
      mcq_ids?: string[]; // References to chapter_mcqs collection
      tts_ids?: string[]; // References to chapter_tts collection
      avatar_scripts?: AvatarScripts; // Avatar scripts for this language
    };
  };
  
  // Language-specific MCQ IDs (kept for backward compatibility, will migrate to localized)
  mcq_ids_by_language?: IdsByLanguage; // { en: string[], hi: string[] }
  
  // Language-specific TTS IDs (kept for backward compatibility, will migrate to localized)
  tts_ids_by_language?: IdsByLanguage; // { en: string[], hi: string[] }
  
  // Language-specific avatar scripts (chapter-level fallback, kept for backward compatibility)
  avatar_scripts_by_language?: AvatarScriptsByLanguage;
  
  // ============================================
  // LEGACY FIELDS (kept for backwards compatibility)
  // ============================================
  // Resource ID arrays - reference documents in separate collections
  // These will be migrated to sharedAssets and localized
  mcq_ids?: string[]; // Legacy: contains both languages mixed
  tts_ids?: string[]; // Legacy: contains both languages mixed
  image_ids?: string[]; // Legacy: will migrate to sharedAssets.image_ids
  meshy_asset_ids?: string[]; // Legacy: will migrate to sharedAssets.meshy_asset_ids
  
  // Skybox GLB URLs (NEW - from skybox_glb_urls collection or inline)
  skybox_glb_urls?: string[]; // Legacy: will migrate to sharedAssets.skybox_glb_urls
  meshy_glb_urls?: string[]; // Legacy: will migrate to sharedAssets.meshy_glb_urls
  
  // Inline 3D asset from Meshy (generated from image)
  image3dasset?: Image3DAsset; // Legacy: will migrate to sharedAssets.image3dasset
  
  // PDF metadata
  pdf_id?: string;
  pdf_hash?: string;
  pdf_images_count?: number;
  pdf_images_validated_at?: string;
}

/**
 * Topic Schema
 * Represents a topic within a chapter
 * 
 * UPDATED: Now includes multi-language avatar scripts and resource IDs
 */
export interface Topic {
  topic_id: string; // Auto-generated UUID
  topic_name: string; // e.g., "Structure of Synthetic Fibres"
  topic_priority: number; // 1-15 (priority order)
  learning_objective: string; // What students should learn
  scene_type: 'mesh' | 'skybox' | 'mixed'; // Type of 3D scene
  in3d_prompt: string; // Detailed prompt for In3D.ai generation
  asset_list: string[]; // List of 3D assets needed (e.g., ["polymer chains", "fiber strands"])
  camera_guidance: string; // Camera movement instructions
  skybox_id?: string; // Reference to skyboxes collection (if skybox generated)
  skybox_url?: string; // Direct skybox image URL (from N8N workflow)
  skybox_remix_id?: number; // Skybox remix ID from Blockade Labs
  skybox_ids?: string[]; // Multiple skybox references (if multiple variations)
  asset_ids?: string[]; // References to 3d_assets collection (if 3D assets generated)
  asset_urls?: string[]; // Direct asset URLs (from N8N workflow)
  status?: 'pending' | 'generated' | 'failed'; // Generation status
  generatedAt?: string; // When skybox/assets were generated
  
  // ============================================
  // MULTI-LANGUAGE AVATAR SCRIPTS (NEW)
  // ============================================
  avatar_scripts_by_language?: AvatarScriptsByLanguage; // { en: {intro, explanation, outro}, hi: {...} }
  
  // ============================================
  // SHARED ASSETS (Language-independent)
  // Images, Skyboxes, 3D Assets, Text-to-3D Models are shared across all languages
  // ============================================
  sharedAssets?: {
    skybox_id?: string; // Reference to skyboxes collection (topic-level)
    meshy_asset_ids?: string[]; // References to meshy_assets collection
    text_to_3d_asset_ids?: string[]; // References to text_to_3d_assets collection
    asset_ids?: string[]; // Legacy field name, same as meshy_asset_ids
    asset_urls?: string[]; // Direct asset URLs (from N8N workflow)
  };
  
  // Language-specific resource IDs (NEW)
  mcq_ids_by_language?: IdsByLanguage; // { en: string[], hi: string[] }
  tts_ids_by_language?: IdsByLanguage; // { en: string[], hi: string[] }
  
  // ============================================
  // LEGACY AVATAR SCRIPTS (kept for backwards compatibility)
  // ============================================
  topic_avatar_intro?: string; // Introduction script for the avatar
  topic_avatar_explanation?: string; // Main explanation script
  topic_avatar_outro?: string; // Conclusion/outro script
  
  // Legacy resource ID arrays (may contain mixed languages)
  // These will be migrated to sharedAssets
  mcq_ids?: string[];
  tts_ids?: string[];
  meshy_asset_ids?: string[]; // Legacy: will migrate to sharedAssets.meshy_asset_ids
  asset_ids?: string[]; // Legacy: same as meshy_asset_ids, will migrate to sharedAssets.asset_ids
  asset_urls?: string[]; // Legacy: will migrate to sharedAssets.asset_urls
  
  // ============================================
  // APPROVAL FIELDS (NEW)
  // ============================================
  approval?: {
    approved: boolean;
    approvedAt: string | null; // Firestore timestamp
  };
} 