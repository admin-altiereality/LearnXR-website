const crypto = require('crypto');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    const { path } = event;
    const body = JSON.parse(event.body || '{}');

    // Route based on path
    if (path.includes('/create-order')) {
      return await handleCreateOrder(body, headers);
    } else if (path.includes('/verify-payment')) {
      return await handleVerifyPayment(body, headers);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }
  } catch (error) {
    console.error('Payment function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function handleCreateOrder(body, headers) {
  try {
    const { amount, currency, planId } = body;
    
    if (!amount || !currency || !planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Amount, currency, and planId are required'
        })
      };
    }

    const amountInPaise = parseInt(amount);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: { planId }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        data: order
      })
    };
  } catch (error) {
    console.error('Create order error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create order'
      })
    };
  }
}

async function handleVerifyPayment(body, headers) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required payment verification data'
        })
      };
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Here you would typically update the user's subscription in your database
      // For now, we'll just return success
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          message: 'Payment verified successfully'
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid signature'
        })
      };
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to verify payment'
      })
    };
  }
} 