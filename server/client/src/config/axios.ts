import axios from 'axios';
import { auth } from './firebase';

// API base URL - use environment variable or fallback to defaults
const getApiBaseUrl = () => {
  // Check if we're actually running on localhost in the browser
  // This is more reliable than import.meta.env.DEV which can be true in preview builds
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname === '');
  
  // Check for explicit API base URL from environment (but validate it's not localhost for non-localhost environments)
  if (import.meta.env.VITE_API_BASE_URL) {
    const explicitUrl = import.meta.env.VITE_API_BASE_URL;
    // If we're not on localhost but the URL is localhost, use production instead
    if (!isLocalhost && explicitUrl.includes('localhost')) {
      console.warn('⚠️ VITE_API_BASE_URL is set to localhost but app is not running on localhost. Using production URL instead.');
      const region = 'us-central1';
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
      const productionUrl = `https://${region}-${projectId}.cloudfunctions.net/api`;
      console.log('🌐 Using production Firebase Functions:', productionUrl);
      return productionUrl;
    }
    console.log('🌐 Using explicit API base URL from VITE_API_BASE_URL:', explicitUrl);
    return explicitUrl;
  }
  
  // Only use local emulator if we're actually on localhost AND in dev mode
  if (isLocalhost && import.meta.env.DEV) {
    const localUrl = 'http://localhost:5001/in3devoneuralai/us-central1/api';
    console.log('🌐 Using local Firebase emulator:', localUrl);
    return localUrl;
  }
  
  // Use Firebase Functions in production/preview (default)
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
  const productionUrl = `https://${region}-${projectId}.cloudfunctions.net/api`;
  console.log('🌐 Using production Firebase Functions:', productionUrl, {
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
    isLocalhost,
    isDev: import.meta.env.DEV,
    mode: import.meta.env.MODE
  });
  return productionUrl;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: false,
  maxRedirects: 0, // Prevent redirects that might change POST to GET
  validateStatus: (status: number) => status < 500 // Don't throw on 4xx errors, let us handle them
});

// Add request interceptor to include Firebase auth token
api.interceptors.request.use(async (config) => {
  try {
    // Log request method to debug
    if (config.url?.includes('enhance')) {
      console.log('🔍 Request interceptor - Method:', config.method?.toUpperCase() || 'UNDEFINED', 'URL:', config.url);
      console.log('🔍 Full config:', {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL,
        data: config.data
      });
    }
    
    // CRITICAL: Ensure POST method is set for enhance endpoint
    if (config.url?.includes('enhance')) {
      if (!config.method || config.method.toLowerCase() !== 'post') {
        console.error('❌ ERROR: Method is not POST! Setting to POST...', {
          originalMethod: config.method,
          url: config.url
        });
        config.method = 'POST';
      }
    }
    
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔐 Auth token attached to request:', config.url);
      } else {
        console.warn('⚠️ User exists but no token available');
      }
    } else {
      console.warn('⚠️ No authenticated user for request:', config.url);
    }
  } catch (error) {
    console.error('❌ Error getting auth token:', error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to log actual request method used
api.interceptors.response.use(
  (response) => {
    if (response.config.url?.includes('enhance')) {
      console.log('✅ Response interceptor - Actual method used:', response.config.method?.toUpperCase(), 'Status:', response.status);
    }
    return response;
  },
  (error) => {
    if (error.config?.url?.includes('enhance')) {
      console.error('❌ Response error - Method used:', error.config.method?.toUpperCase(), 'Status:', error.response?.status);
      console.error('❌ Error details:', {
        method: error.config?.method,
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    return Promise.reject(error);
  }
);

export default api; 