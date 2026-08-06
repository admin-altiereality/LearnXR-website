/**
 * Client service for teacher/partner-authored lessons (Street View, Create-page
 * scenes, Spiral scenes). Drafts are launchable immediately by their creator;
 * submission for Super Admin review is a separate, optional action.
 */

import { getApiBaseUrl } from '../utils/apiConfig';
import { auth } from '../config/firebase';

export type UserGeneratedLessonSource = 'street_view' | 'create_scene' | 'spiral_scene';
export type UserGeneratedLessonStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface UserGeneratedLesson {
  id: string;
  ownerUid: string;
  ownerRole: string;
  source: UserGeneratedLessonSource;
  title: string;
  skybox_url?: string;
  skybox_glb_url?: string;
  asset_urls?: string[];
  asset_ids?: string[];
  meshy_asset_ids?: string[];
  streetView?: {
    lat?: number | null;
    lng?: number | null;
    panoId?: string | null;
    formattedAddress?: string | null;
    placeId?: string | null;
  };
  moderation: {
    status: UserGeneratedLessonStatus;
    submittedAt?: unknown;
    reviewedBy?: string;
    reviewedAt?: unknown;
    rejectionReason?: string | null;
    promotedChapterId?: string;
    promotedTopicId?: string;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function createDraftLesson(
  title: string,
  source: UserGeneratedLessonSource
): Promise<{ success: boolean; lessonId: string }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ title, source }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to create draft lesson');
  return data;
}

export async function updateDraftLesson(
  lessonId: string,
  fields: Partial<{
    title: string;
    skybox_url: string;
    skybox_glb_url: string;
    asset_urls: string[];
    asset_ids: string[];
    curriculum: string;
    class_name: string;
    subject: string;
  }>
): Promise<{ success: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to update draft lesson');
  return data;
}

export async function listMyLessons(): Promise<{ success: boolean; lessons: UserGeneratedLesson[] }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/mine`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to list your lessons');
  return data;
}

export async function generateLessonStreetView(
  lessonId: string,
  params: {
    lat?: number;
    lng?: number;
    panoId?: string;
    heading?: number;
    pitch?: number;
    fov?: number;
    formattedAddress?: string;
    placeId?: string;
  }
): Promise<{ success: boolean; imageUrl: string }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/street-view`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to generate Street View skybox');
  return data;
}

export async function attachLibraryAsset(
  lessonId: string,
  assetId: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/attach-asset`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ assetId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to attach 3D asset');
  return data;
}

export async function submitLessonForReview(lessonId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/submit`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to submit lesson for review');
  return data;
}

export async function listLessonsForReview(
  status: UserGeneratedLessonStatus | 'all' = 'submitted'
): Promise<{ success: boolean; lessons: UserGeneratedLesson[] }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/admin/list?status=${encodeURIComponent(status)}`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to list lessons for review');
  return data;
}

export async function reviewLesson(
  lessonId: string,
  decision: { approve: boolean; markAsDemo?: boolean; rejectionReason?: string }
): Promise<{ success: boolean; status: string; chapterId?: string; topicId?: string }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/admin/${lessonId}/review`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(decision),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to review lesson');
  return data;
}
