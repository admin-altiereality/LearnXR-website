// Skybox Style Interface
export interface SkyboxStyle {
  id: number;
  name: string;
  description?: string;
  preview_image_url?: string;
  category?: string;
}

// Skybox Generation Request Interface
export interface SkyboxGenerationRequest {
  prompt: string;
  skybox_style_id: number;
  remix_imagine_id?: string;
  webhook_url?: string;
}

// Skybox Generation Response Interface
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

// Skybox Styles Response Interface
export interface SkyboxStylesResponse {
  styles: SkyboxStyle[];
  pagination: PaginationInfo;
}

// User Skyboxes Response Interface
export interface UserSkyboxesResponse {
  data: SkyboxGeneration[];
  pagination: PaginationInfo;
}

// API Error Response Interface
export interface ApiErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: any;
}

// API Success Response Interface
export interface ApiSuccessResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
} 