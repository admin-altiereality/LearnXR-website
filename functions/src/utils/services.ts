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

// Helper function to clean secrets (remove whitespace, newlines, etc.)
const cleanSecret = (secret: string | undefined): string => {
  if (!secret) return '';
  // Remove all whitespace, newlines, carriage returns, and trim
  return secret.trim().replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '').trim();
};

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
      BLOCKADE_API_KEY = cleanSecret(apiKey).replace(/[^\w\-]/g, '');
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
    let RAZORPAY_KEY_ID = secrets?.razorpayKeyId || getSecret('RAZORPAY_KEY_ID');
    let RAZORPAY_KEY_SECRET = secrets?.razorpayKeySecret || getSecret('RAZORPAY_KEY_SECRET');
    
    // CRITICAL: Clean the secrets to remove any newlines or whitespace
    RAZORPAY_KEY_ID = cleanSecret(RAZORPAY_KEY_ID);
    RAZORPAY_KEY_SECRET = cleanSecret(RAZORPAY_KEY_SECRET);
    
    // Validate credentials format
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      // Check if key_id looks valid (should start with rzp_ for live or rzp_test_ for test)
      const keyIdValid = RAZORPAY_KEY_ID.startsWith('rzp_');
      const keySecretValid = RAZORPAY_KEY_SECRET.length >= 20; // Secret should be at least 20 chars
      
      console.log('Razorpay credentials validation:', {
        keyIdValid,
        keyIdPrefix: RAZORPAY_KEY_ID.substring(0, 8),
        keyIdLength: RAZORPAY_KEY_ID.length,
        keySecretValid,
        keySecretLength: RAZORPAY_KEY_SECRET.length,
        keyIdHasNewlines: RAZORPAY_KEY_ID.includes('\n') || RAZORPAY_KEY_ID.includes('\r'),
        keySecretHasNewlines: RAZORPAY_KEY_SECRET.includes('\n') || RAZORPAY_KEY_SECRET.includes('\r')
      });
      
      if (!keyIdValid) {
        console.warn('⚠️ Razorpay key_id format looks invalid (should start with rzp_)');
      }
      
      if (!keySecretValid) {
        console.warn('⚠️ Razorpay key_secret length looks invalid');
      }
      
      if (RAZORPAY_KEY_ID.includes('\n') || RAZORPAY_KEY_ID.includes('\r')) {
        console.warn('⚠️ Razorpay key_id contains newlines - this will cause authentication to fail!');
      }
      
      if (RAZORPAY_KEY_SECRET.includes('\n') || RAZORPAY_KEY_SECRET.includes('\r')) {
        console.warn('⚠️ Razorpay key_secret contains newlines - this will cause authentication to fail!');
      }
      
      const RazorpayClass = getRazorpay();
      razorpay = new RazorpayClass({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
      });
      
      // Store credentials in instance for verification
      (razorpay as any)._key_id = RAZORPAY_KEY_ID;
      (razorpay as any)._key_secret = RAZORPAY_KEY_SECRET.substring(0, 4) + '...';
      
      console.log('Razorpay initialized successfully', {
        keyIdPrefix: RAZORPAY_KEY_ID.substring(0, 8),
        keyIdLength: RAZORPAY_KEY_ID.length,
        isTestMode: RAZORPAY_KEY_ID.includes('test')
      });
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
