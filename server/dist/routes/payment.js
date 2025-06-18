"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const razorpay_1 = __importDefault(require("razorpay"));
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("../config/firebase-admin");
const admin = __importStar(require("firebase-admin"));
dotenv_1.default.config();
const router = express_1.default.Router();
console.log('Payment routes being initialized...');
// Initialize Razorpay
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});
console.log('Razorpay initialized with key_id:', process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing');
// Debug middleware for payment routes
router.use((req, res, next) => {
    console.log('Payment route received request:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        body: req.body,
        headers: req.headers
    });
    next();
});
// Create order endpoint
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency, planId } = req.body;
        // Validate required fields
        if (!amount || !currency || !planId) {
            return res.status(400).json({
                status: 'error',
                message: 'Amount, currency, and planId are required'
            });
        }
        // Convert amount to paise and validate
        const amountInPaise = parseInt(amount);
        if (isNaN(amountInPaise) || amountInPaise <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid amount'
            });
        }
        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: currency,
            receipt: `receipt_${Date.now()}`,
            notes: {
                planId: planId
            }
        });
        // Return the order details
        res.json({
            status: 'success',
            data: order
        });
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to create order'
        });
    }
});
// Verify payment endpoint
router.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required payment verification data'
            });
        }
        // Verify signature
        const generated_signature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');
        if (generated_signature === razorpay_signature) {
            // Update subscription in Firestore
            if (userId && planId) {
                const subscriptionRef = firebase_admin_1.db.collection('subscriptions').doc(userId);
                const subscriptionData = {
                    planId,
                    status: 'active',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id
                };
                await subscriptionRef.set(subscriptionData, { merge: true });
            }
            res.json({
                status: 'success',
                message: 'Payment verified successfully'
            });
        }
        else {
            res.status(400).json({
                status: 'error',
                message: 'Invalid signature'
            });
        }
    }
    catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to verify payment'
        });
    }
});
console.log('Payment routes initialized with endpoints:');
console.log('- POST /create-order');
console.log('- POST /verify-payment');
exports.default = router;
