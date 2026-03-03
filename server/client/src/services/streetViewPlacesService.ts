import { getApiBaseUrl } from '../utils/apiConfig';

export interface StreetViewPlacePrediction {
  place_id: string;
  description: string;
}

export interface PlacesAutocompleteResult {
  success: boolean;
  predictions?: StreetViewPlacePrediction[];
  error?: string;
}

export interface PlaceDetailsResult {
  success: boolean;
  lat?: number;
  lng?: number;
  formatted_address?: string;
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
    const res = await fetch(url);
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
    const res = await fetch(url);
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
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to fetch place details',
    };
  }
}

