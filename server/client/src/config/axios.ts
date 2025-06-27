import axios from 'axios';

// Determine the base URL based on environment
const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost';
const baseURL = isProduction 
  ? '/.netlify/functions/api'  // Use Netlify functions in production
  : (import.meta.env.VITE_API_URL || 'http://localhost:5002'); // Use local server in development

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    return Promise.reject(error);
  }
);

export default api; 