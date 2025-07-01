const fetch = require('node-fetch');

// Fallback skybox styles data in case the backend is not available
const fallbackSkyboxStyles = {
  "styles": [
    {
      "id": 1,
      "name": "Cinematic",
      "description": "Professional cinematic style"
    },
    {
      "id": 2,
      "name": "Photographic",
      "description": "Realistic photographic style"
    },
    {
      "id": 3,
      "name": "Digital Art",
      "description": "Digital art style"
    },
    {
      "id": 4,
      "name": "Anime",
      "description": "Anime style"
    },
    {
      "id": 5,
      "name": "Fantasy Art",
      "description": "Fantasy art style"
    }
  ]
};

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get the API URL from environment variables
    const apiUrl = process.env.API_URL || process.env.VITE_API_URL;
    
    // If no API URL is configured, return fallback data for getSkyboxStyles
    if (!apiUrl) {
      console.log('No API URL configured, using fallback data');
      
      if (event.path.includes('/getSkyboxStyles')) {
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fallbackSkyboxStyles)
        };
      } else {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'Backend service not configured',
            message: 'API_URL environment variable is not set'
          })
        };
      }
    }

    const path = event.path.replace('/.netlify/functions/skybox', '');
    const url = `${apiUrl}/api/skybox${path}`;

    console.log(`Skybox API: Proxying request to: ${url}`);
    console.log('Request method:', event.httpMethod);
    console.log('Request path:', path);
    console.log('Environment API_URL:', process.env.API_URL);
    console.log('Environment VITE_API_URL:', process.env.VITE_API_URL);

    // Prepare request headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Netlify-Skybox-Function/1.0'
    };

    // Add authorization header if present
    if (event.headers.authorization) {
      requestHeaders.Authorization = event.headers.authorization;
    }

    // Add API key if available
    if (process.env.API_KEY) {
      requestHeaders['X-API-Key'] = process.env.API_KEY;
    }

    // Add any other necessary headers from the original request
    if (event.headers['x-api-key']) {
      requestHeaders['X-API-Key'] = event.headers['x-api-key'];
    }

    console.log('Request headers being sent:', requestHeaders);

    // Forward the request to your backend server
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: requestHeaders,
      body: event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' ? event.body : undefined
    });

    const data = await response.text();
    console.log('Skybox API Response status:', response.status);
    console.log('Skybox API Response headers:', Object.fromEntries(response.headers.entries()));

    // If the response is not ok, log the error details
    if (!response.ok) {
      console.error('Skybox API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
      
      // For getSkyboxStyles, return fallback data if backend fails
      if (event.path.includes('/getSkyboxStyles')) {
        console.log('Backend failed, returning fallback skybox styles');
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fallbackSkyboxStyles)
        };
      }
    }

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body: data
    };
  } catch (error) {
    console.error('Skybox API proxy error:', error);
    console.error('Error stack:', error.stack);
    
    // For getSkyboxStyles, return fallback data if there's an error
    if (event.path.includes('/getSkyboxStyles')) {
      console.log('Error occurred, returning fallback skybox styles');
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackSkyboxStyles)
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Skybox API error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 