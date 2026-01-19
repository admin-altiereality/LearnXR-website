// Curriculum Content Editor Types

export interface Curriculum {
  id: string;
  name: string; // e.g., "CBSE", "RBSE"
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
