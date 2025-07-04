const fetch = require('node-fetch');

// Fallback skybox styles data
const fallbackSkyboxStyles = {
  success: true,
  data: {
    styles: [
      {
        id: 44,
        name: "1960s Ethereal Fantasy",
        description: "Alien landscapes in the high-contrast painterly look of 1960s progressive fantasy art",
        "max-char": 380,
        "negative-text-max-char": 240,
        image: "https://images.blockadelabs.com/images/skybox/dZIHHi5rc6xc8WSY299UaJW73CmknYjqiybN5kCF.webp",
        image_jpg: "https://images.blockadelabs.com/images/skybox/dZIHHi5rc6xc8WSY299UaJW73CmknYjqiybN5kCF.jpg",
        model: "Model 2",
        model_version: "2",
        sort_order: 1,
        premium: 0,
        new: 0,
        experimental: 0,
        skybox_style_families_id: 3
      },
      {
        id: 13,
        name: "Advanced (no style)",
        description: null,
        "max-char": 540,
        "negative-text-max-char": 220,
        image: null,
        image_jpg: null,
        model: "Model 2",
        model_version: "2",
        sort_order: 2,
        premium: 0,
        new: 0,
        experimental: 0,
        skybox_style_families_id: null
      },
      {
        id: 3,
        name: "Anime",
        description: "Classic Japanese animation style shapes and restrained coloring",
        "max-char": 443,
        "negative-text-max-char": 220,
        image: "https://images.blockadelabs.com/images/skybox/qbiTeIVO7sTpy5mKHkX4WYUFvgUuFs8VWGzlW2b3.webp",
        image_jpg: "https://images.blockadelabs.com/images/skybox/qbiTeIVO7sTpy5mKHkX4WYUFvgUuFs8VWGzlW2b3.jpg",
        model: "Model 2",
        model_version: "2",
        sort_order: 3,
        premium: 0,
        new: 0,
        experimental: 0,
        skybox_style_families_id: 11
      },
      {
        id: 43,
        name: "Art Mix",
        description: "Multimedia painterly art that pulls from watercolor, marker, paint, pastels, and more",
        "max-char": 412,
        "negative-text-max-char": 210,
        image: "https://images.blockadelabs.com/images/skybox/MYklQhpxG7wbn7HkftNTNxLZMc5mBjYvUuRajHpp.webp",
        image_jpg: "https://images.blockadelabs.com/images/skybox/MYklQhpxG7wbn7HkftNTNxLZMc5mBjYvUuRajHpp.jpg",
        model: "Model 2",
        model_version: "2",
        sort_order: 4,
        premium: 0,
        new: 0,
        experimental: 0,
        skybox_style_families_id: 7
      },
      {
        id: 29,
        name: "Cartoon",
        description: "Cel-shaded and cute kid's cartoon forms and bright colors",
        "max-char": 466,
        "negative-text-max-char": 170,
        image: "https://images.blockadelabs.com/images/skybox/K8rMhBSxeR7gZdSxoQLUu3RrJyhBrIDiANqMrVrh.webp",
        image_jpg: "https://images.blockadelabs.com/images/skybox/K8rMhBSxeR7gZdSxoQLUu3RrJyhBrIDiANqMrVrh.jpg",
        model: "Model 2",
        model_version: "2",
        sort_order: 5,
        premium: 0,
        new: 0,
        experimental: 0,
        skybox_style_families_id: 11
      }
    ]
  },
  message: "Retrieved 5 skybox styles",
  pagination: {
    page: 1,
    limit: 5,
    total: 84,
    totalPages: 17,
    hasNext: true,
    hasPrev: false
  }
};

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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
    // For styles endpoint, return fallback data if no backend is configured
    if (event.path.includes('/styles') || event.path.includes('/getSkyboxStyles')) {
      console.log('Returning fallback skybox styles');
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackSkyboxStyles)
      };
    }

    // Get the API URL from environment variables
    const apiUrl = process.env.API_URL || process.env.VITE_API_URL;
    
    if (!apiUrl) {
      console.error('No API URL configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Backend service not configured',
          message: 'API_URL or VITE_API_URL environment variable is not set'
        })
      };
    }

    const path = event.path.replace('/.netlify/functions/skybox', '');
    const url = `${apiUrl}/api/skybox${path}`;

    console.log(`Skybox function: Proxying request to: ${url}`);
    console.log('Request method:', event.httpMethod);
    console.log('Request headers:', event.headers);
    console.log('Request body:', event.body);
    console.log('Environment API_URL:', process.env.API_URL);
    console.log('Environment VITE_API_URL:', process.env.VITE_API_URL);

    // Prepare request headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Netlify-Function/1.0'
    };

    // Add authorization header if present
    if (event.headers.authorization) {
      requestHeaders.Authorization = event.headers.authorization;
    }

    // Forward the request to your backend server
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: requestHeaders,
      body: event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' ? event.body : undefined
    });

    const data = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('Backend response error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
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
    console.error('Skybox function error:', error);
    console.error('Error stack:', error.stack);
    
    // For styles endpoint, return fallback data if there's an error
    if (event.path.includes('/styles') || event.path.includes('/getSkyboxStyles')) {
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
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
}; 