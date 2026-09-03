import axios from 'axios';
import { auth } from './firebase';
import { productionLogger } from '../services/productionLogger';
import { resolveProductionApiBase } from '../utils/apiConfig';

// Debug helper — development only
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).checkAuthState = async () => {
    console.log('🔍 Checking auth state...');
    console.log('auth.currentUser:', auth.currentUser);
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        console.log('✅ Token available, length:', token.length);
        console.log('Token preview:', token.substring(0, 20) + '...');
        return { user: auth.currentUser, token: token.substring(0, 20) + '...' };
      } catch (error) {
        console.error('❌ Error getting token:', error);
        return { user: auth.currentUser, error };
      }
    } else {
      console.warn('⚠️ No authenticated user');
      return { user: null };
    }
  };
}

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
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
      const productionUrl = resolveProductionApiBase(projectId);
      console.log('🌐 Using production API base:', productionUrl);
      return productionUrl;
    }
    console.log('🌐 Using explicit API base URL from VITE_API_BASE_URL:', explicitUrl);
    return explicitUrl;
  }
  
  // Only use local emulator if we're actually on localhost AND in dev mode
  if (isLocalhost && import.meta.env.DEV) {
    const localUrl = 'http://localhost:5001/learnxr-evoneuralai/us-central1/api';
    console.log('🌐 Using local Firebase emulator:', localUrl);
    return localUrl;
  }
  
  // Production/preview: same-origin through the Hosting CDN where the rewrite exists,
  // otherwise straight to the function (see resolveProductionApiBase).
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
  const productionUrl = resolveProductionApiBase(projectId);
  console.log('🌐 Using production API base:', productionUrl, {
    sameOrigin: productionUrl.startsWith(window.location.origin),
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

// Track request start time for duration calculation
const requestStartTimes = new Map<string, number>();

// Add request interceptor to include Firebase auth token
api.interceptors.request.use(async (config) => {
  // Dynamically override baseURL when running inside a WebView that sets
  // window.__LEARNXR_API_BASE_URL (e.g. MainStandalone with same-origin /api).
  // This must run before the request is sent because the axios instance was
  // created with a static baseURL at module-load time.
  if (typeof window !== 'undefined' && (window as any).__LEARNXR_API_BASE_URL) {
    config.baseURL = (window as any).__LEARNXR_API_BASE_URL;
  }

  const requestId = `${config.method}_${config.url}`;
  requestStartTimes.set(requestId, Date.now());
  
  // Store requestId in config for response interceptor
  (config as any).__requestId = requestId;
  
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
    
    // Ensure headers object exists (axios will create it if needed)
    if (!config.headers) {
      config.headers = {} as any;
    }
    
    // Get current user - try multiple times if needed
    let user = auth.currentUser;
    
    // If no current user, wait for auth state to initialize (with timeout)
    // This handles the case where auth state hasn't propagated yet after login
    if (!user) {
      try {
        // Wait for auth state change with a timeout
        const authReady = await new Promise<typeof auth.currentUser>((resolve) => {
          let resolved = false;
          let timeoutId: NodeJS.Timeout;
          
          // First, check immediately if user is available
          const immediateCheck = auth.currentUser;
          if (immediateCheck) {
            resolve(immediateCheck);
            return;
          }
          
          // Set timeout
          timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              // Final check before resolving with null
              const finalCheck = auth.currentUser;
              resolve(finalCheck);
            }
          }, 3000); // Wait max 3 seconds
          
          // Listen for auth state changes
          const unsubscribe = auth.onAuthStateChanged((authUser) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              unsubscribe();
              resolve(authUser);
            }
          });
        });
        
        user = authReady || auth.currentUser;
      } catch (waitError) {
        // Continue even if wait fails
        console.warn('⚠️ Error waiting for auth state:', waitError);
        user = auth.currentUser; // Try one more time
      }
    }
    
    // Log auth state for debugging protected endpoints
    const isQuietRequest = Boolean((config as any).__quiet);
    if (!isQuietRequest && (config.url?.includes('assistant') || config.url?.includes('skybox'))) {
      console.log('🔍 Auth check for:', config.url);
      console.log('   auth.currentUser:', user ? `${user.uid} (${user.email})` : 'null');
    }
    
    if (user) {
      try {
        const forceRefresh = config.url?.includes('assistant') || config.url?.includes('skybox');
        let token: string | undefined;
        try {
          token = await user.getIdToken(forceRefresh);
        } catch (refreshErr: any) {
          // Force-refresh can fail in WebView (auth/network-request-failed).
          // Fall back to the cached token which is still valid if the user
          // signed in recently (e.g. via signInWithCustomToken in MainStandalone).
          if (forceRefresh) {
            console.warn('⚠️ Token force-refresh failed, using cached token for:', config.url);
            token = await user.getIdToken(false);
          } else {
            throw refreshErr;
          }
        }
        
        if (token && token.length > 0) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.error('❌ Got empty token for:', config.url);
        }
      } catch (tokenError: any) {
        console.error('❌ Error getting auth token:', config.url);
        console.error('   Error code:', tokenError.code);
        console.error('   Error message:', tokenError.message);
      }
    } else {
      // Log warning for protected endpoints
      if (!isQuietRequest && (config.url?.includes('assistant') || config.url?.includes('skybox'))) {
        console.error('❌ No authenticated user for request:', config.url);
        console.error('   auth.currentUser is null');
        console.error('   User needs to log in before making this request');
      }
    }
  } catch (error) {
    console.error('❌ Error in request interceptor:', error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to log errors and handle 401s
api.interceptors.response.use(
  (response) => {
    const requestId = (response.config as any).__requestId || `${response.config.method}_${response.config.url}`;
    const startTime = requestStartTimes.get(requestId);
    const duration = startTime ? Date.now() - startTime : undefined;
    requestStartTimes.delete(requestId);

    const method = response.config.method?.toUpperCase() || 'GET';
    const url = response.config.url || 'unknown';
    const status = response.status;
    const isQuietRequest = Boolean((response.config as any).__quiet);

    // Enhanced console logging for API calls
    if (isQuietRequest && status >= 400) {
      // Expected fallback path (e.g. TTS quota); caller handles it.
    } else if (response.config.url?.includes('enhance')) {
      console.log(
        `%c✅ API Response: ${method} ${url} - Status: ${status}${duration ? ` (${duration}ms)` : ''}`,
        'color: #10b981; font-weight: bold;',
        response.data
      );
    } else {
      // Log all API calls to console for debugging (F12)
      const logLevel = status >= 400 ? 'warn' : 'log';
      const emoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
      const color = status >= 500 ? '#f87171' : status >= 400 ? '#fbbf24' : '#10b981';
      
      console[logLevel](
        `%c${emoji} API: ${method} ${url} [${status}]${duration ? ` (${duration}ms)` : ''}`,
        `color: ${color}; font-weight: bold;`,
        response.data
      );
    }

    // Log successful API call to production logger
    if (!(isQuietRequest && status >= 400)) {
      productionLogger.logApiCall(
        url,
        method,
        status,
        duration
      );
    }

    return response;
  },
  async (error) => {
    const requestId = (error.config as any)?.__requestId || `${error.config?.method}_${error.config?.url}`;
    const startTime = requestStartTimes.get(requestId);
    const duration = startTime ? Date.now() - startTime : undefined;
    requestStartTimes.delete(requestId);
    const url = error.config?.url || 'unknown';
    const isQuietRequest = Boolean((error.config as any)?.__quiet);

    // 401 retry for assistant URLs: refresh token once and retry
    if (error.response?.status === 401 && typeof url === 'string' && url.includes('assistant')) {
      const user = auth.currentUser;
      const alreadyRetried = (error.config as any).__assistant401Retried;
      if (user && !alreadyRetried && error.config) {
        try {
          const token = await user.getIdToken(true);
          (error.config as any).__assistant401Retried = true;
          if (token && error.config.headers) {
            error.config.headers.Authorization = `Bearer ${token}`;
            return api.request(error.config);
          }
        } catch (tokenError) {
          // Fall through to normal error handling
        }
      }
    }

    // Handle 401 errors - log for debugging
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized for:', url);
      console.error('   Request headers:', error.config?.headers);
      console.error('   Has Authorization header:', !!error.config?.headers?.Authorization);
      console.error('   Auth header value:', error.config?.headers?.Authorization ? 'Bearer ***' : 'MISSING');
      console.error('   Error response:', error.response?.data);
      const user = auth.currentUser;
      if (!user) {
        console.error('   ⚠️ No authenticated user found. User needs to log in.');
      } else {
        console.error('   User exists:', user.uid, user.email);
      }
    }

    const method = error.config?.method?.toUpperCase() || 'GET';
    const status = error.response?.status;

    // Skip noisy logging for 404 on optional endpoints (e.g. evaluation not deployed)
    if (status === 404 && url?.includes('/evaluation')) {
      return Promise.reject(error);
    }

    // Enhanced console logging for API errors
    if (!isQuietRequest) {
      console.groupCollapsed(
        `%c❌ API Error: ${method} ${url}${status ? ` [${status}]` : ''}${duration ? ` (${duration}ms)` : ''}`,
        'color: #f87171; font-weight: bold; background: #fee2e2; padding: 2px 4px; border-radius: 2px;'
      );
      console.error('Method:', method);
      console.error('URL:', url);
      console.error('Status:', status || 'No response');
      if (error.response?.data) {
        console.error('Response data:', error.response.data);
      }
      if (error.message) {
        console.error('Error message:', error.message);
      }
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
      console.groupEnd();
    }

    // Log failed API call to production logger (skip for 404 evaluation)
    if (!isQuietRequest && !(status === 404 && url?.includes('/evaluation'))) {
      const apiError = error.response 
        ? new Error(`API Error: ${error.response.status} ${error.response.statusText}`)
        : error;
      productionLogger.logApiCall(
        url,
        method,
        status,
        duration,
        apiError
      );
    }

    return Promise.reject(error);
  }
);

export default api; 