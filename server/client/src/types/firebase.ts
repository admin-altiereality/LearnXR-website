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
  skybox_ids?: string[]; // Multiple skybox references (if multiple variations)
  asset_ids?: string[]; // References to 3d_assets collection (if 3D assets generated)
  status?: 'pending' | 'generated' | 'failed'; // Generation status
  generatedAt?: string; // When skybox/assets were generated
} 