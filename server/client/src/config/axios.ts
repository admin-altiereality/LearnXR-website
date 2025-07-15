import axios from 'axios';
import { auth } from './firebase';

// API base URL - use Firebase Functions in production, localhost in development
const getApiBaseUrl = () => {
  const region = 'us-central1';
  const projectId = 'in3devoneuralai';
  return import.meta.env.PROD 
    ? `https://${region}-${projectId}.cloudfunctions.net/api`
    : 'http://localhost:5001/in3devoneuralai/us-central1/api';
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