const fetch = require('node-fetch');

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
    // Get the API URL from environment variables
    const apiUrl = process.env.API_URL || process.env.VITE_API_URL || 'https://your-backend-server.com';
    const path = event.path.replace('/.netlify/functions/api', '');
    const url = `${apiUrl}${path}`;

    console.log(`Proxying request to: ${url}`);
    console.log('Request method:', event.httpMethod);
    console.log('Request headers:', event.headers);
    console.log('Request body:', event.body);

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

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body: data
    };
  } catch (error) {
    console.error('API proxy error:', error);
    
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