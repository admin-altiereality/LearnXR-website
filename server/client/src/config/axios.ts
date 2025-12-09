import axios from 'axios';
import { auth } from './firebase';

// API base URL - use environment variable or fallback to defaults
const getApiBaseUrl = () => {
  // Check for explicit API base URL from environment (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('🌐 Using explicit API base URL from VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Check if we're actually running on localhost in the browser
  // This is more reliable than import.meta.env.DEV which can be true in preview builds
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname === '');
  
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
});

// Add request interceptor to include Firebase auth token
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api; 