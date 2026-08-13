export type LicensedDeliveryMode = 'krpano_native' | 'hosted_embed';
export type LicensedContentStatus = 'draft' | 'review' | 'published' | 'suspended' | 'retired';

export interface LicensedContentSummary {
  id: string;
  provider: string;
  provider_content_id: string;
  revision: string;
  title: string;
  description: string;
  subject: string;
  grade_bands: string[];
  curriculum_tags: string[];
  languages: string[];
  content_type: string;
  delivery_mode: LicensedDeliveryMode;
  collection_ids: string[];
  capabilities: string[];
  attribution: string;
  status: LicensedContentStatus;
  thumbnail_url?: string | null;
}

export interface LicensedContentManifest extends LicensedContentSummary {
  artifact_url?: string | null;
  environment_url?: string | null;
  interaction_manifest?: Record<string, unknown> | null;
  expires_at?: string;
  hosted?: {
    xr_supported: boolean;
    sdk_post_message: boolean;
  } | null;
}

export interface LicensedCatalogResponse {
  items: LicensedContentSummary[];
  entitled: boolean;
  access_target: { type: 'school' | 'partner'; id: string } | null;
  catalog_state?: {
    availability: 'ready' | 'staging_only' | 'catalog_empty' | 'not_entitled' | 'no_accessible_content';
    published_count: number;
    accessible_count: number;
    total_count?: number;
    draft_count?: number;
    review_count?: number;
  };
}

export interface LicensedManifestImport {
  provider: string;
  provider_content_id: string;
  revision: string;
  title: string;
  description: string;
  subject: string;
  grade_bands: string[];
  curriculum_tags: string[];
  languages: string[];
  thumbnail_storage_path?: string;
  content_type: string;
  delivery_mode: LicensedDeliveryMode;
  collection_ids: string[];
  capabilities: string[];
  attribution: string;
  native?: {
    artifact_storage_path: string;
    sha256: string;
    environment_storage_path?: string;
    interaction_manifest?: Record<string, unknown>;
  };
  hosted?: {
    approved_origins: string[];
    embed_approved: boolean;
    sso_enabled: boolean;
    xr_supported?: boolean;
    sdk_post_message?: boolean;
  };
}
