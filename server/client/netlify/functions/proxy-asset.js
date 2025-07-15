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
    const { url } = event.queryStringParameters || {};
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter is required' })
      };
    }

    console.log('🔗 Proxying asset request:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'In3D.ai-WebApp/1.0',
      },
    });

    if (!response.ok) {
      console.error('❌ Asset proxy failed:', response.status, response.statusText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Failed to fetch asset: ${response.status} ${response.statusText}` 
        })
      };
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Get the response body as buffer
    const buffer = await response.buffer();
    
    console.log('✅ Asset proxy successful, size:', buffer.length, 'bytes');
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('❌ Asset proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 