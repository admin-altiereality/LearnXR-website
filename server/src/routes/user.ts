import express from 'express';
import * as admin from 'firebase-admin';
import { db, isFirebaseInitialized } from '../config/firebase-admin';
import { UserGeoInfo, shouldUseRazorpay } from '../types/subscription';

const router = express.Router();

console.log('User routes being initialized...');

/**
 * Save user geo info
 * POST /user/geo-info
 */
router.post('/geo-info', async (req, res) => {
  try {
    const { userId, country, countryName, paymentProvider, countrySource, detectedAt } = req.body;

    if (!userId || !country) {
      return res.status(400).json({
        success: false,
        error: 'userId and country are required'
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    const geoInfo: UserGeoInfo = {
      country: country.toUpperCase(),
      countryName: countryName || country,
      paymentProvider: paymentProvider || (shouldUseRazorpay(country) ? 'razorpay' : 'paddle'),
      countrySource: countrySource || 'ip',
      detectedAt: detectedAt || new Date().toISOString()
    };

    // Update user document with geo info
    await db.collection('users').doc(userId).set(
      { 
        geoInfo,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    res.json({
      success: true,
      data: geoInfo
    });

  } catch (error) {
    console.error('Error saving user geo info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save geo info'
    });
  }
});

/**
 * Get user geo info
 * GET /user/geo-info/:userId
 */
router.get('/geo-info/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.json({
        success: true,
        data: null
      });
    }

    const userData = userDoc.data();
    const geoInfo = userData?.geoInfo || null;

    res.json({
      success: true,
      data: geoInfo
    });

  } catch (error) {
    console.error('Error getting user geo info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get geo info'
    });
  }
});

/**
 * Update user billing country (manual selection)
 * POST /user/billing-country
 */
router.post('/billing-country', async (req, res) => {
  try {
    const { userId, country, countryName } = req.body;

    if (!userId || !country) {
      return res.status(400).json({
        success: false,
        error: 'userId and country are required'
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    const upperCountry = country.toUpperCase();
    const paymentProvider = shouldUseRazorpay(upperCountry) ? 'razorpay' : 'paddle';

    // Update user document
    await db.collection('users').doc(userId).set(
      { 
        geoInfo: {
          country: upperCountry,
          countryName: countryName || upperCountry,
          paymentProvider,
          countrySource: 'billing',
          detectedAt: new Date().toISOString()
        },
        billingCountry: upperCountry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    // Also update subscription if exists
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (subscriptionDoc.exists) {
      await subscriptionRef.update({
        provider: paymentProvider,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        country: upperCountry,
        paymentProvider
      }
    });

  } catch (error) {
    console.error('Error updating billing country:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update billing country'
    });
  }
});

console.log('User routes initialized with endpoints:');
console.log('- POST /geo-info');
console.log('- GET /geo-info/:userId');
console.log('- POST /billing-country');

export default router;

