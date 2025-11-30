import axios from 'axios';
import { auth } from './firebase';

// API base URL - use local server in development, Firebase Functions in production
const getApiBaseUrl = () => {
  // Use local backend in development
  if (import.meta.env.DEV) {
    return 'http://localhost:5002/api';
  }
  // Use Firebase Functions in production
  const region = 'us-central1';
  const projectId = 'in3devoneuralai';
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