import { getApiBaseUrl } from '../utils/apiConfig';
import { auth } from '../config/firebase';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface StreetViewPlacePrediction {
  place_id: string;
  description: string;
  rating?: number;
  user_ratings_total?: number;
  walkable?: boolean;
  link_count?: number;
}

export interface PlacesAutocompleteResult {
  success: boolean;
  predictions?: StreetViewPlacePrediction[];
  error?: string;
  filter?: { minRating: number; walkableOnly: boolean };
}

export interface PlaceDetailsResult {
  success: boolean;
  lat?: number;
  lng?: number;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  walkable?: boolean;
  panoId?: string;
  link_count?: number;
  error?: string;
}

export async function fetchPlaceSuggestions(input: string): Promise<PlacesAutocompleteResult> {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: true, predictions: [] };
  }

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/streetview/places-autocomplete?input=${encodeURIComponent(trimmed)}`;

  try {
    const res = await fetch(url, { headers: await authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      return {
        success: false,
        error: data.error || data.message || `Request failed (${res.status})`,
      };
    }
    return {
      success: true,
      predictions: data.predictions || [],
      filter: data.filter,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to fetch place suggestions',
    };
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const trimmed = placeId.trim();
  if (!trimmed) {
    return { success: false, error: 'place_id is required' };
  }

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/streetview/place-details?place_id=${encodeURIComponent(trimmed)}`;

  try {
    const res = await fetch(url, { headers: await authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      return {
        success: false,
        error: data.error || data.message || `Request failed (${res.status})`,
      };
    }
    return {
      success: true,
      lat: data.lat,
      lng: data.lng,
      formatted_address: data.formatted_address,
      rating: data.rating,
      user_ratings_total: data.user_ratings_total,
      walkable: data.walkable,
      panoId: data.panoId,
      link_count: data.link_count,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to fetch place details',
    };
  }
}
