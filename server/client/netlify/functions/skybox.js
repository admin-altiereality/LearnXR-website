const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Add comprehensive logging
  console.log('=== SKYBOX FUNCTION CALLED ===');
  console.log('Event path:', event.path);
  console.log('Event httpMethod:', event.httpMethod);
  console.log('Event headers:', event.headers);
  console.log('Event queryStringParameters:', event.queryStringParameters);
  console.log('Event body:', event.body);
  console.log('Context:', context);
  
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
    // Get BlockadeLabs API key from environment
    const apiKey = process.env.BLOCKADELABS_API_KEY || process.env.API_KEY || 'hcmELHEKZuGMVCjrHgojXQDoKoXJJzcKpVaGEonoaNktA8WmIqTGlzsTZ9gh';
    
    if (!apiKey) {
      console.error('No BlockadeLabs API key configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'API key not configured',
          message: 'BLOCKADELABS_API_KEY or API_KEY environment variable is not set'
        })
      };
    }

    // Handle different endpoints
    if (event.path.includes('/styles') || event.path.includes('/getSkyboxStyles')) {
      console.log('Handling styles request');
      return await handleGetStyles(headers, apiKey);
    } else if (event.path.includes('/generate')) {
      console.log('Handling generation request');
      return await handleGenerate(headers, apiKey, event);
    } else if (event.path.includes('/status/')) {
      console.log('Handling status request');
      return await handleGetStatus(headers, apiKey, event);
    } else if (event.path.includes('/test')) {
      console.log('Handling test request');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Skybox function is working!',
          path: event.path,
          method: event.httpMethod,
          timestamp: new Date().toISOString()
        })
      };
    } else {
      console.log('Unknown endpoint:', event.path);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Endpoint not found',
          message: `Unknown endpoint: ${event.path}`,
          availableEndpoints: ['/styles', '/generate', '/status/:id', '/test']
        })
      };
    }
  } catch (error) {
    console.error('Skybox function error:', error);
    console.error('Error stack:', error.stack);
    
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

// Handle getting skybox styles
async function handleGetStyles(headers, apiKey) {
  try {
    console.log('Fetching skybox styles from BlockadeLabs API');
    
    const response = await fetch('https://api.blockadelabs.com/v1/skybox/styles', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BlockadeLabs API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Failed to fetch styles',
          message: `BlockadeLabs API error: ${response.status} ${response.statusText}`,
          details: errorText
        })
      };
    }

    const data = await response.json();
    console.log('Successfully fetched skybox styles:', data);

    // Format response to match backend API structure
    const formattedResponse = {
      success: true,
      data: {
        styles: data
      },
      message: `Retrieved ${data.length} skybox styles`,
      pagination: {
        page: 1,
        limit: data.length,
        total: data.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedResponse)
    };
  } catch (error) {
    console.error('Error fetching styles:', error);
    throw error;
  }
}

// Handle skybox generation
async function handleGenerate(headers, apiKey, event) {
  try {
    console.log('Generating skybox with BlockadeLabs API');
    
    const requestBody = JSON.parse(event.body || '{}');
    console.log('Generation request body:', requestBody);

    const response = await fetch('https://api.blockadelabs.com/v1/skybox', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: requestBody.prompt,
        skybox_style_id: requestBody.skybox_style_id,
        webhook_url: requestBody.webhook_url
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BlockadeLabs generation error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Generation failed',
          message: `BlockadeLabs API error: ${response.status} ${response.statusText}`,
          details: errorText
        })
      };
    }

    const data = await response.json();
    console.log('Successfully initiated skybox generation:', data);

    // Format response to match backend API structure
    const formattedResponse = {
      success: true,
      data: {
        id: data.id.toString(),
        status: data.status
      },
      message: 'Skybox generation initiated successfully'
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedResponse)
    };
  } catch (error) {
    console.error('Error generating skybox:', error);
    throw error;
  }
}

// Handle getting generation status
async function handleGetStatus(headers, apiKey, event) {
  try {
    const generationId = event.path.split('/status/')[1];
    console.log('Getting status for generation:', generationId);
    
    const response = await fetch(`https://api.blockadelabs.com/v1/skybox/${generationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BlockadeLabs status error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Failed to get status',
          message: `BlockadeLabs API error: ${response.status} ${response.statusText}`,
          details: errorText
        })
      };
    }

    const data = await response.json();
    console.log('Successfully got generation status:', data);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: data,
        message: 'Generation status retrieved successfully'
      })
    };
  } catch (error) {
    console.error('Error getting generation status:', error);
    throw error;
  }
} 