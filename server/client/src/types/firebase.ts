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
  
  // Resource ID arrays - reference documents in separate collections
  mcq_ids?: string[];
  tts_ids?: string[];
  image_ids?: string[];
  meshy_asset_ids?: string[];
  
  // Inline 3D asset from Meshy (generated from image)
  image3dasset?: Image3DAsset;
  
  // PDF metadata
  pdf_id?: string;
  pdf_hash?: string;
  pdf_images_count?: number;
  pdf_images_validated_at?: string;
}

/**
 * Topic Schema
 * Represents a topic within a chapter
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
  
  // Avatar scripts
  topic_avatar_intro?: string; // Introduction script for the avatar
  topic_avatar_explanation?: string; // Main explanation script
  topic_avatar_outro?: string; // Conclusion/outro script
  
  // Resource ID arrays - reference documents in separate collections
  mcq_ids?: string[];
  tts_ids?: string[];
  meshy_asset_ids?: string[];
} 