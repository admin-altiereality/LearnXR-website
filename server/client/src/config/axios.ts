import axios from 'axios';
import { auth } from './firebase';

// API base URL - use environment variable or fallback to defaults
const getApiBaseUrl = () => {
  // Check for explicit API base URL from environment
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Use local backend in development
  if (import.meta.env.DEV) {
    return 'http://localhost:5001/in3devoneuralai/us-central1/api';
  }
  
  // Use Firebase Functions in production
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
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