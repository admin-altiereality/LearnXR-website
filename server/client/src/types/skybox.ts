// Skybox Style Interface
export interface SkyboxStyle {
  id: number;
  name: string;
  description?: string;
  preview_image_url?: string;
  image_jpg?: string;
  image_webp?: string;
  category?: string;
  model?: string;
}

// Skybox Generation Request Interface
export interface SkyboxGenerationRequest {
  prompt: string;
  skybox_style_id: number;
  negative_text?: string;
  remix_imagine_id?: string;
  webhook_url?: string;
  userId?: string;
}

// Skybox Generation Response Interface
export interface SkyboxGenerationResponse {
  data: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    prompt?: string;
    skybox_style_id?: number;
  };
  success?: boolean;
  message?: string;
}

// Skybox Status Response Interface
export interface SkyboxStatusResponse {
  data: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'complete';
    prompt?: string;
    title?: string;
    file_url?: string;
    image?: string;
    thumb_url?: string;
    skybox_style_id?: number;
    created_at?: string;
    updated_at?: string;
    error_message?: string;
  };
  success?: boolean;
  message?: string;
}

// Skybox Generation Interface (for internal use)
export interface SkyboxGeneration {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  skybox_style_id: number;
  file_url?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

// Pagination Interface
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  totalPages: number;
}

