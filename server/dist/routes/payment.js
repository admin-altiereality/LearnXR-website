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
const express_1 = require("express");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("../config/firebase-admin");
const admin = __importStar(require("firebase-admin"));
const router = (0, express_1.Router)();
// Initialize Razorpay
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});
// Create order
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', planId } = req.body;
        if (!amount || !planId) {
            return res.status(400).json({
                status: 'error',
                message: 'Amount and plan ID are required'
            });
        }
        const options = {
            amount: amount,
            currency,
            receipt: `order_${Date.now()}`,
            notes: {
                planId
            }
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    }
    catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to create order'
        });
    }
});
// Verify payment
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, userId, planId } = req.body;
        const generated_signature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        if (generated_signature === razorpay_signature) {
            // Update subscription in Firestore
            const subscriptionRef = firebase_admin_1.db.collection('subscriptions').doc(userId);
            const subscriptionData = {
                planId,
                status: 'active',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id
            };
            await subscriptionRef.set(subscriptionData, { merge: true });
            res.json({
                status: 'success',
                message: 'Payment verified successfully'
            });
        }
        else {
            res.status(400).json({
                status: 'error',
                message: 'Invalid payment signature'
            });
        }
    }
    catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Payment verification failed'
        });
    }
});
exports.default = router;
