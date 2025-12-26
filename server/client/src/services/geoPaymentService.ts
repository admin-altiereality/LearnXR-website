/**
 * Geo-based Payment Provider Routing Service
 * 
 * Determines the appropriate payment provider based on user location:
 * - India (IN) → Razorpay (UPI, local cards, better conversion)
 * - Outside India → Paddle (international cards, compliance handled)
 */

import api from '../config/axios';
import { 
  PaymentProvider, 
  CountrySource, 
  PaymentProviderResult,
  UserGeoInfo,
  shouldUseRazorpay 
} from '../types/subscription';

export interface GeoDetectionResult {
  country: string;
  countryName: string;
  source: CountrySource;
  confidence: 'high' | 'medium' | 'low';
}

// Cache for geo detection to avoid repeated API calls
let cachedGeoInfo: GeoDetectionResult | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Detect country from browser locale/timezone (lowest trust)
 */
const detectCountryFromLocale = (): { country: string; confidence: 'low' } | null => {
  try {
    // Try navigator.language
    const locale = navigator.language || (navigator as any).userLanguage;
    if (locale) {
      // Extract country code from locale (e.g., 'en-IN' -> 'IN')
      const parts = locale.split('-');
      if (parts.length >= 2 && parts[1].length === 2) {
        return { country: parts[1].toUpperCase(), confidence: 'low' };
      }
    }

    // Try timezone-based detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      // Map common Indian timezones
      if (timezone.includes('Kolkata') || timezone.includes('Calcutta') || timezone.includes('India')) {
        return { country: 'IN', confidence: 'low' };
      }
      // Map US timezones
      if (timezone.includes('America/')) {
        return { country: 'US', confidence: 'low' };
      }
      // Map UK timezones
      if (timezone.includes('Europe/London')) {
        return { country: 'GB', confidence: 'low' };
      }
    }
  } catch (error) {
    console.warn('Failed to detect country from locale:', error);
  }
  return null;
};

/**
 * Detect country from IP address (server-side, medium trust)
 */
const detectCountryFromIP = async (): Promise<GeoDetectionResult | null> => {
  try {
    // Try our backend first (which should use a reliable IP geolocation service)
    const response = await api.get('/payment/detect-country');
    if (response.data.success && response.data.data?.country) {
      return {
        country: response.data.data.country,
        countryName: response.data.data.countryName || response.data.data.country,
        source: 'ip',
        confidence: 'medium'
      };
    }
  } catch (error) {
    console.warn('Failed to detect country from backend:', error);
  }

  // Fallback to ipapi.co (free tier, 1000 requests/day)
  try {
    const response = await fetch('https://ipapi.co/json/', {
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.country_code) {
        return {
          country: data.country_code,
          countryName: data.country_name || data.country_code,
          source: 'ip',
          confidence: 'medium'
        };
      }
    }
  } catch (error) {
    console.warn('Failed to detect country from ipapi.co:', error);
  }

  // Second fallback to ip-api.com (free, 45 requests/minute)
  try {
    const response = await fetch('https://ip-api.com/json/?fields=countryCode,country');
    if (response.ok) {
      const data = await response.json();
      if (data.countryCode) {
        return {
          country: data.countryCode,
          countryName: data.country || data.countryCode,
          source: 'ip',
          confidence: 'medium'
        };
      }
    }
  } catch (error) {
    console.warn('Failed to detect country from ip-api.com:', error);
  }

  return null;
};

/**
 * Get cached geo info or detect fresh
 */
export const detectUserCountry = async (): Promise<GeoDetectionResult> => {
  // Check cache first
  const now = Date.now();
  if (cachedGeoInfo && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedGeoInfo;
  }

  // Try IP-based detection first (most reliable for fresh visitors)
  const ipResult = await detectCountryFromIP();
  if (ipResult) {
    cachedGeoInfo = ipResult;
    cacheTimestamp = now;
    return ipResult;
  }

  // Fallback to locale detection
  const localeResult = detectCountryFromLocale();
  if (localeResult) {
    const result: GeoDetectionResult = {
      country: localeResult.country,
      countryName: localeResult.country, // We don't have country name from locale
      source: 'locale',
      confidence: 'low'
    };
    cachedGeoInfo = result;
    cacheTimestamp = now;
    return result;
  }

  // Ultimate fallback - assume international (safer for conversions)
  const fallbackResult: GeoDetectionResult = {
    country: 'US',
    countryName: 'Unknown',
    source: 'locale',
    confidence: 'low'
  };
  cachedGeoInfo = fallbackResult;
  cacheTimestamp = now;
  return fallbackResult;
};

/**
 * Determine the payment provider based on country
 * 
 * Priority order:
 * 1. User-selected billing country (highest trust)
 * 2. IP-based country (medium trust)
 * 3. Browser locale (lowest trust)
 * 
 * Rules:
 * - India (IN) → Razorpay
 * - All other countries → Paddle
 * - On detection failure → Paddle (safer for international)
 */
export const determinePaymentProvider = async (
  billingCountry?: string, // User-selected during checkout
  ipCountry?: string,      // Pre-detected IP country
): Promise<PaymentProviderResult> => {
  // Priority 1: User-selected billing country (highest trust)
  if (billingCountry && billingCountry.length === 2) {
    const country = billingCountry.toUpperCase();
    return {
      provider: shouldUseRazorpay(country) ? 'razorpay' : 'paddle',
      country,
      countrySource: 'billing',
      confidence: 'high'
    };
  }

  // Priority 2: IP-based detection (medium trust)
  if (ipCountry && ipCountry.length === 2) {
    const country = ipCountry.toUpperCase();
    return {
      provider: shouldUseRazorpay(country) ? 'razorpay' : 'paddle',
      country,
      countrySource: 'ip',
      confidence: 'medium'
    };
  }

  // Priority 3: Fresh detection
  const detected = await detectUserCountry();
  return {
    provider: shouldUseRazorpay(detected.country) ? 'razorpay' : 'paddle',
    country: detected.country,
    countrySource: detected.source,
    confidence: detected.confidence
  };
};

/**
 * Store user's geo info for payment routing
 */
export const saveUserGeoInfo = async (
  userId: string,
  geoInfo: UserGeoInfo
): Promise<void> => {
  try {
    await api.post('/user/geo-info', {
      userId,
      ...geoInfo
    });
  } catch (error) {
    console.error('Failed to save user geo info:', error);
    // Don't throw - this is not critical for payment flow
  }
};

/**
 * Get stored user geo info
 */
export const getUserGeoInfo = async (userId: string): Promise<UserGeoInfo | null> => {
  try {
    const response = await api.get(`/user/geo-info/${userId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
  } catch (error) {
    console.warn('Failed to get user geo info:', error);
  }
  return null;
};

/**
 * Clear cached geo info (useful when user manually changes country)
 */
export const clearGeoCache = (): void => {
  cachedGeoInfo = null;
  cacheTimestamp = 0;
};

// Common country list for billing country selector
export const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
];

export const getCountryName = (code: string): string => {
  const country = COUNTRIES.find(c => c.code === code.toUpperCase());
  return country?.name || code;
};

export const getCountryFlag = (code: string): string => {
  const country = COUNTRIES.find(c => c.code === code.toUpperCase());
  return country?.flag || '🌍';
};

export default {
  detectUserCountry,
  determinePaymentProvider,
  saveUserGeoInfo,
  getUserGeoInfo,
  clearGeoCache,
  COUNTRIES,
  getCountryName,
  getCountryFlag
};

