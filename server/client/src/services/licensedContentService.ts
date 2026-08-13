import api from '../config/axios';
import type {
  LicensedCatalogResponse,
  LicensedContentManifest,
  LicensedManifestImport,
} from '../types/licensedContent';

function unwrap<T>(response: { status: number; data?: { success?: boolean; data?: T; error?: string } }): T {
  if (response.status >= 400 || response.data?.success !== true || response.data.data === undefined) {
    throw new Error(response.data?.error || 'Licensed content request failed.');
  }
  return response.data.data;
}

export async function listLicensedContent(params: {
  search?: string;
  subject?: string;
  grade?: string;
  deliveryMode?: string;
  includeDrafts?: boolean;
} = {}): Promise<LicensedCatalogResponse> {
  const response = await api.get('/licensed-content/catalog', { params });
  return unwrap<LicensedCatalogResponse>(response);
}

export async function getLicensedContentManifest(contentId: string): Promise<LicensedContentManifest> {
  const response = await api.get(`/licensed-content/${encodeURIComponent(contentId)}/manifest`);
  return unwrap<LicensedContentManifest>(response);
}

export async function getLicensedLessonContent(chapterId: string, topicId: string): Promise<Array<LicensedContentManifest & {
  placement?: Record<string, unknown> | null;
  phase?: string;
  priority?: number;
}>> {
  const response = await api.get('/licensed-content/lesson-links', { params: { chapterId, topicId } });
  return unwrap<{ items: Array<LicensedContentManifest & { placement?: Record<string, unknown> | null; phase?: string; priority?: number }> }>(response).items;
}

export async function startLicensedEmbedSession(contentId: string): Promise<{ launch_url: string; expires_at: string }> {
  const response = await api.post(`/licensed-content/${encodeURIComponent(contentId)}/embed-session`);
  return unwrap(response);
}

export async function importLicensedManifest(manifest: LicensedManifestImport) {
  const response = await api.post('/licensed-content/admin/import', manifest);
  return unwrap<{ id: string; import_key: string; status: string }>(response);
}

export async function importLicensedManifestBatch(items: LicensedManifestImport[]) {
  const response = await api.post('/licensed-content/admin/import-batch', { items });
  return unwrap<{ imported: number; items: Array<{ id: string; import_key: string; status: string }> }>(response);
}

export async function updateLicensedContentStatus(contentId: string, status: string) {
  const response = await api.post(`/licensed-content/admin/${encodeURIComponent(contentId)}/status`, { status });
  return unwrap<{ id: string; status: string }>(response);
}

export async function upsertContentEntitlement(input: {
  target_type: 'school' | 'partner';
  target_id: string;
  provider: string;
  collection_ids: string[];
  status: 'active' | 'suspended' | 'expired';
  starts_at?: string | null;
  ends_at?: string | null;
}) {
  const response = await api.post('/licensed-content/admin/entitlements', input);
  return unwrap<{ id: string; status: string }>(response);
}

export async function upsertLessonContentLink(input: {
  licensed_content_id: string;
  chapter_id: string;
  topic_id: string;
  phase?: string;
  priority?: number;
  teaching_notes?: string;
}) {
  const response = await api.post('/licensed-content/admin/lesson-links', input);
  return unwrap<{ id: string }>(response);
}
