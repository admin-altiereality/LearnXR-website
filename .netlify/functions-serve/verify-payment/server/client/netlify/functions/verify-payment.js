"use strict";

// server/client/netlify/functions/verify-payment.js
var crypto = require("crypto");
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required payment verification data"
        })
      };
    }
    const generated_signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id + "|" + razorpay_payment_id).digest("hex");
    if (generated_signature === razorpay_signature) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: "success",
          message: "Payment verified successfully"
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid signature"
        })
      };
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to verify payment"
      })
    };
  }
};
//# sourceMappingURL=verify-payment.js.map
