// Curriculum Content Editor Types
// Updated to support new Firestore collections:
// - meshy_assets, chapter_mcqs, chapter_tts, chapter_images, skybox_glb_urls

export interface Curriculum {
  id: string;
  name: string; // e.g., "CBSE", "RBSE"
}

// ============================================
// NEW COLLECTION TYPES (from new Firestore schema)
// ============================================

/**
 * MeshyAsset - 3D models from meshy_assets collection
 * Contains Meshy-generated 3D models and metadata
 * Also used for inline image3dasset (image-to-3D converted models)
 */
export interface MeshyAsset {
  id: string;
  chapter_id: string;
  topic_id: string;
  name: string;
  prompt?: string;
  glb_url: string;
  fbx_url?: string;
  usdz_url?: string;
  thumbnail_url?: string;
  meshy_id?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'completed';
  created_at?: string;
  updated_at?: string;
  metadata?: {
    ai_selection_reasoning?: string;
    ai_selection_score?: number;
    source?: 'meshy_assets' | 'image3dasset';
    [key: string]: unknown;
  };
}

/**
 * ChapterMCQ - MCQ data from chapter_mcqs collection
 * MCQ question sets tied to chapter/lesson
 */
export interface ChapterMCQ {
  id: string;
  chapter_id: string;
  topic_id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  order?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

/**
 * ChapterTTS - TTS audio from chapter_tts collection
 * TTS audio files and narration script metadata
 */
export interface ChapterTTS {
  id: string;
  chapter_id: string;
  topic_id: string;
  script_type: 'intro' | 'explanation' | 'outro' | 'full';
  script_text: string;
  audio_url?: string;
  duration_seconds?: number;
  voice_id?: string;
  voice_name?: string;
  language?: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  created_at?: string;
  updated_at?: string;
}

/**
 * ChapterImage - Images from chapter_images collection
 * Educational images for chapters
 */
export interface ChapterImage {
  id: string;
  chapter_id: string;
  topic_id: string;
  name: string;
  description?: string;
  image_url: string;
  thumbnail_url?: string;
  type: 'diagram' | 'illustration' | 'photo' | 'infographic' | 'other';
  order?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * SkyboxGLBUrl - Skybox GLB URLs from skybox_glb_urls collection
 * Contains URLs pointing to skybox GLB files in storage buckets
 */
export interface SkyboxGLBUrl {
  id: string;
  chapter_id: string;
  topic_id: string;
  skybox_id?: string;
  glb_url: string;
  preview_url?: string;
  prompt_used?: string;
  style_id?: number;
  style_name?: string;
  status: 'pending' | 'complete' | 'failed';
  created_at?: string;
  updated_at?: string;
}

/**
 * Image3DAsset - 3D models generated from images
 * Stored inline in curriculum_chapters as image3dasset map
 * Contains multiple format URLs (GLB, FBX, USDZ) from Meshy
 */
export interface Image3DAsset {
  imageasset_id: string;
  imageasset_name: string;
  imageasset_url: string; // Primary GLB URL
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
 * ChapterResourceIds - ID arrays stored in curriculum_chapters
 * Used to reference documents in separate collections
 */
export interface ChapterResourceIds {
  mcq_ids?: string[];
  tts_ids?: string[];
  image_ids?: string[];
  meshy_asset_ids?: string[];
}

/**
 * TopicResourceIds - ID arrays stored in topic objects
 * Similar to chapter-level but topic-specific
 */
export interface TopicResourceIds {
  mcq_ids?: string[];
  tts_ids?: string[];
  image_ids?: string[];
  meshy_asset_ids?: string[];
}

/**
 * Aggregated topic resources from all new collections
 */
export interface TopicResources {
  meshyAssets: MeshyAsset[];
  mcqs: ChapterMCQ[];
  ttsAudio: ChapterTTS[];
  images: ChapterImage[];
  skyboxGLBUrls: SkyboxGLBUrl[];
  image3dAsset?: Image3DAsset; // Inline 3D asset from chapter document
  loading: boolean;
  error?: string;
}

export interface Class {
  id: string;
  name: string; // e.g., "Class 6", "Class 7"
  grade: number;
}

export interface Subject {
  id: string;
  name: string; // e.g., "Science", "Mathematics"
}

export interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
  current_version: string; // e.g., "v1", "v2"
  topic_count: number;
  updated_at?: string;
  curriculum_id?: string;
  class_id?: string;
  subject_id?: string;
}

export interface ChapterVersion {
  id: string;
  version: string; // e.g., "v1", "v2"
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  created_by?: string;
}

export interface Topic {
  id: string;
  topic_name: string;
  topic_priority: number;
  scene_type: 'interactive' | 'narrative' | 'quiz' | 'exploration';
  has_scene: boolean;
  has_mcqs: boolean;
  last_updated?: string;
}

export interface Scene {
  id: string;
  learning_objective: string;
  in3d_prompt: string;
  asset_list: string[];
  generated_assets?: GeneratedAsset[];
  camera_guidance: string;
  skybox_id?: string;
  skybox_url?: string;
  skybox_remix_id?: string;
  avatar_intro: string;
  avatar_explanation: string;
  avatar_outro: string;
  status: 'draft' | 'published';
  updated_at: string;
  updated_by: string;
  change_summary?: string;
}

export interface GeneratedAsset {
  name: string;
  glb_url: string;
  thumbnail_url?: string;
  generated_at: string;
}

export interface MCQ {
  id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  order?: number;
}

// Legacy flattened MCQ format (for normalization)
export interface FlattenedMCQ {
  mcq1_question?: string;
  mcq1_options?: string[];
  mcq1_correct?: number;
  mcq1_explanation?: string;
  mcq2_question?: string;
  mcq2_options?: string[];
  mcq2_correct?: number;
  mcq2_explanation?: string;
  // ... up to mcq10
  [key: string]: string | string[] | number | undefined;
}

export interface EditHistory {
  updated_at: string;
  updated_by: string;
  change_summary: string;
}

// Form state types for dirty tracking
export interface TopicFormState {
  topic_name: string;
  topic_priority: number;
  scene_type: Topic['scene_type'];
  learning_objective: string;
}

export interface SceneFormState {
  in3d_prompt: string;
  asset_list: string[];
  camera_guidance: string;
  skybox_id: string;
  skybox_url: string;
  skybox_remix_id: string;
  avatar_intro: string;
  avatar_explanation: string;
  avatar_outro: string;
}

export interface MCQFormState extends Omit<MCQ, 'id'> {
  id?: string;
  _isNew?: boolean;
  _isDeleted?: boolean;
}

// Filter state for content library
export interface ContentFilters {
  curriculum: string;
  classId: string;
  subject: string;
  search: string;
}

// API response types
export interface ChapterListResponse {
  chapters: Chapter[];
  total: number;
  hasMore: boolean;
}

// Diff tracking
export interface FieldDiff<T = unknown> {
  field: string;
  oldValue: T;
  newValue: T;
}

export interface DocumentDiff {
  fields: FieldDiff[];
  hasChanges: boolean;
}
