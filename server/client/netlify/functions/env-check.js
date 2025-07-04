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
    // Return environment information (without sensitive data)
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL ? 'Set' : 'Not set',
      VITE_API_URL: process.env.VITE_API_URL ? 'Set' : 'Not set',
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not set',
      VITE_RAZORPAY_KEY_ID: process.env.VITE_RAZORPAY_KEY_ID ? 'Set' : 'Not set',
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(envInfo)
    };
  } catch (error) {
    console.error('Environment check error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}; 