/**
 * Service initialization utilities
 * Lazy initialization of external services
 */

import * as admin from 'firebase-admin';
import { getSecret } from './config';

// Lazy import Razorpay
let Razorpay: any = null;
export const getRazorpay = () => {
  if (!Razorpay) {
    Razorpay = require('razorpay');
  }
  return Razorpay;
};

// Initialize Firebase Admin (lazy)
let adminInitialized = false;
export const initializeAdmin = () => {
  if (!adminInitialized) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      adminInitialized = true;
    } catch (error) {
      // Ignore errors during deployment analysis
    }
  }
  return admin;
};

// Service state
export let BLOCKADE_API_KEY = '';
export let razorpay: any = null;

// Initialize services
// Optionally accepts secret values directly (for Firebase Functions v2)
export const initializeServices = (secrets?: {
  blockadelabsApiKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
}) => {
  try {
    // Use provided secrets or fall back to environment variables
    const apiKey = secrets?.blockadelabsApiKey || getSecret('BLOCKADE_API_KEY');
    if (apiKey) {
      BLOCKADE_API_KEY = apiKey.replace(/[^\w\-]/g, '');
      console.log('BlockadeLabs API key configured successfully, length:', BLOCKADE_API_KEY.length);
    } else {
      console.warn('BLOCKADE_API_KEY not found', {
        hasProvided: !!secrets?.blockadelabsApiKey,
        hasEnv: !!process.env.BLOCKADE_API_KEY,
        envValue: process.env.BLOCKADE_API_KEY ? '***' : 'empty'
      });
      BLOCKADE_API_KEY = '';
    }
  } catch (error) {
    console.error('Failed to configure BlockadeLabs API key:', error);
    BLOCKADE_API_KEY = '';
  }

  try {
    const RAZORPAY_KEY_ID = secrets?.razorpayKeyId || getSecret('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = secrets?.razorpayKeySecret || getSecret('RAZORPAY_KEY_SECRET');
    
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      const RazorpayClass = getRazorpay();
      razorpay = new RazorpayClass({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
      });
      console.log('Razorpay initialized successfully');
    } else {
      console.warn('Razorpay credentials not found', {
        hasKeyId: !!RAZORPAY_KEY_ID,
        hasSecret: !!RAZORPAY_KEY_SECRET,
        providedKeyId: !!secrets?.razorpayKeyId,
        providedSecret: !!secrets?.razorpayKeySecret,
        envKeyId: !!process.env.RAZORPAY_KEY_ID,
        envSecret: !!process.env.RAZORPAY_KEY_SECRET
      });
      razorpay = null;
    }
  } catch (error) {
    console.error('Failed to initialize Razorpay:', error);
    razorpay = null;
  }
};

