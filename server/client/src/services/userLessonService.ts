/**
 * Client service for teacher/partner-authored lessons (Street View, Create-page
 * scenes, Spiral scenes). Drafts are launchable immediately by their creator;
 * submission for Super Admin review is a separate, optional action.
 */

import { getApiBaseUrl } from '../utils/apiConfig';
import { auth } from '../config/firebase';

export type UserGeneratedLessonSource = 'street_view' | 'create_scene' | 'spiral_scene';
export type UserGeneratedLessonStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TourStopAsset {
  id: string;
  assetId?: string;
  glbUrl: string;
  ath: number;
  atv: number;
  depth?: number;
  scale?: number;
  rotationY?: number;
}

export interface TourStopLink {
  panoId: string;
  heading: number;
  text?: string;
}

export interface TourStopVoiceover {
  script?: string;
  audioUrl?: string;
  language?: string;
}

export interface TourStop {
  id: string;
  order: number;
  panoId: string;
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  label?: string;
  skyboxUrl: string;
  links: TourStopLink[];
  assets: TourStopAsset[];
  voiceover: TourStopVoiceover | null;
  copyright?: string;
}

export type TourTileZoom = 2 | 3 | 4;

export interface StreetViewTour {
  stops: TourStop[];
  tileZoom: TourTileZoom;
}

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
  streetViewTour?: StreetViewTour;
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

export interface ExploreResult {
  success: boolean;
  panoId: string;
  lat: number;
  lng: number;
  heading: number;
  skyboxUrl: string;
  links: TourStopLink[];
  copyright: string | null;
  zoom: TourTileZoom;
}

/** Resolves a location (lat/lng) or panoId to a stitched skybox + metadata + links (Tile API). */
export async function exploreStreetView(
  lessonId: string,
  params: { lat?: number; lng?: number; panoId?: string; zoom?: TourTileZoom }
): Promise<ExploreResult> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/explore`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to load Street View imagery');
  return data;
}

/** Hops to a linked neighboring panorama ("walking"). Same response shape as `exploreStreetView`. */
export async function walkToPanorama(
  lessonId: string,
  toPanoId: string,
  zoom?: TourTileZoom
): Promise<ExploreResult> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/walk`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ toPanoId, zoom }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to walk to the next panorama');
  return data;
}

/** Bookmarks the currently-explored panorama as a new ordered tour stop. */
export async function addTourStop(
  lessonId: string,
  params: { panoId: string; heading: number; pitch: number; label?: string; zoom?: TourTileZoom }
): Promise<{ success: boolean; stop: TourStop }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to add tour stop');
  return data;
}

export async function updateTourStop(
  lessonId: string,
  stopId: string,
  fields: Partial<{ label: string; heading: number; pitch: number }>
): Promise<{ success: boolean; stop: TourStop }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops/${stopId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to update tour stop');
  return data;
}

export async function deleteTourStop(lessonId: string, stopId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops/${stopId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to delete tour stop');
  return data;
}

export async function reorderTourStops(
  lessonId: string,
  stopIds: string[]
): Promise<{ success: boolean; stops: TourStop[] }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops/reorder`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ stopIds }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to reorder tour stops');
  return data;
}

/** Places a floating 3D asset on a tour stop at the given spherical position (ath/atv, degrees). */
export async function addTourStopAsset(
  lessonId: string,
  stopId: string,
  params: { assetId?: string; glbUrl: string; ath: number; atv: number; depth?: number; scale?: number; rotationY?: number }
): Promise<{ success: boolean; asset: TourStopAsset }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops/${stopId}/assets`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to place 3D asset on stop');
  return data;
}

export async function removeTourStopAsset(
  lessonId: string,
  stopId: string,
  assetInstanceId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops/${stopId}/assets/${assetInstanceId}`,
    { method: 'DELETE', headers: await authHeaders() }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to remove 3D asset from stop');
  return data;
}

/** Generates narration audio for a stop via OpenAI TTS and stores it as the stop's voiceover. */
export async function generateTourStopVoiceover(
  lessonId: string,
  stopId: string,
  script: string
): Promise<{ success: boolean; voiceover: TourStopVoiceover }> {
  const response = await fetch(`${getApiBaseUrl()}/user-lessons/${lessonId}/streetview-tour/stops/${stopId}/voiceover`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ script }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to generate voiceover');
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
