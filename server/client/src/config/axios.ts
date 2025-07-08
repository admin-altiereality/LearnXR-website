import axios from 'axios';

// Determine the base URL based on environment
const isProduction = import.meta.env.PROD && window.location.hostname !== 'localhost';
const baseURL = isProduction 
  ? 'https://us-central1-in3devoneuralai.cloudfunctions.net/api'  // Firebase Functions URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:5002'); // Use local server in development

console.log('API Base URL:', baseURL);
console.log('Environment:', import.meta.env.MODE);
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('isProduction:', isProduction);
console.log('hostname:', window.location.hostname);

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    console.log('Full URL:', `${config.baseURL}${config.url}`);
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