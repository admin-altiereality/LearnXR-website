/**
 * Client service for Google Street View → skybox.
 * Calls backend proxy POST /api/streetview/generate-skybox.
 */

import { getApiBaseUrl } from '../utils/apiConfig';
import { auth } from '../config/firebase';

export interface StreetViewSkyboxParams {
  location?: { lat: number; lng: number };
  placeId?: string;
  panoId?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  size?: string;
  chapterId: string;
  topicId: string;
  userId?: string;
}

export interface StreetViewSkyboxSuccess {
  success: true;
  skyboxId: string;
  imageUrl: string;
}

export interface StreetViewSkyboxError {
  success: false;
  error: string;
}

export type StreetViewSkyboxResult = StreetViewSkyboxSuccess | StreetViewSkyboxError;

export async function generateStreetViewSkybox(
  params: StreetViewSkyboxParams
): Promise<StreetViewSkyboxResult> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/streetview/generate-skybox`;
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      location: params.location,
      placeId: params.placeId,
      panoId: params.panoId,
      heading: params.heading,
      pitch: params.pitch,
      fov: params.fov,
      size: params.size,
      chapterId: params.chapterId,
      topicId: params.topicId,
      userId: params.userId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success === true && data.skyboxId && data.imageUrl) {
    return { success: true, skyboxId: data.skyboxId, imageUrl: data.imageUrl };
  }
  const rawError: string = data.error || data.message || `Request failed (${res.status})`;

  // Map common backend error messages to clearer, user-friendly explanations.
  let friendlyError = rawError;
  const lower = String(rawError).toLowerCase();

  if (lower.includes('no street view imagery')) {
    friendlyError = 'No Street View imagery is available for this location/panorama. Try a nearby spot or a different place.';
  } else if (lower.includes('quota')) {
    friendlyError = 'Street View API quota has been exceeded. Please try again later.';
  } else if (lower.includes('api key') || lower.includes('request denied')) {
    friendlyError =
      'Street View API key is not authorized for this project. Please ask an admin to check the Google Cloud API configuration.';
  } else if (lower.includes('image format not supported') || lower.includes('unsupported image type')) {
    friendlyError =
      'Google returned an image format that this server cannot process. Ensure Street View Static API is configured to return JPEG images.';
  }

  return {
    success: false,
    error: friendlyError,
  };
}
