/**
 * Centralized API configuration utility
 * Provides consistent API base URL across the application
 */

/**
 * Get the API base URL from environment variables or fallback to defaults
 * @returns The API base URL string
 */
export const getApiBaseUrl = (): string => {
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

/**
 * Get Firebase project configuration
 */
export const getFirebaseProjectConfig = () => {
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
  return {
    region,
    projectId,
    functionsUrl: `https://${region}-${projectId}.cloudfunctions.net`
  };
};

